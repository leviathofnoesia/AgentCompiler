/**
 * Section Embedder
 * Generates vector embeddings for documentation sections.
 *
 * Strategy:
 * 1. Primary: TF-IDF based embeddings (always available, zero deps)
 * 2. Optional: ONNX Runtime with sentence-transformers (higher quality, requires download)
 *
 * TF-IDF embeddings are lightweight but capture enough signal for section ranking.
 * The embedding vectors are then compressed via TurboQuant for storage efficiency.
 */

import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { TurboQuantMSE, type CompressedVectors } from './turboquant.js';

export interface SectionEmbedding {
    path: string;
    name: string;
    content: string;
    vector: Float32Array;
}

export interface EmbeddingIndex {
    sections: { path: string; name: string }[];
    compressed: CompressedVectors;
    method: 'tfidf' | 'onnx';
    dimensions: number;
}

const TFIDF_DIM = 128;
const CACHE_FILENAME = '.embedding-index.json';

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'this', 'that', 'are', 'be',
    'was', 'will', 'can', 'has', 'have', 'had', 'not', 'they', 'we', 'you',
    'do', 'if', 'as', 'no', 'so', 'up', 'out', 'about', 'into', 'over',
    'after', 'all', 'also', 'any', 'been', 'being', 'between', 'both',
    'each', 'few', 'get', 'got', 'he', 'her', 'here', 'him', 'his', 'how',
    'its', 'just', 'let', 'may', 'most', 'must', 'my', 'new', 'now',
    'only', 'other', 'our', 'own', 'same', 'she', 'should', 'some', 'such',
    'than', 'them', 'then', 'there', 'these', 'they', 'those', 'through',
    'too', 'under', 'very', 'what', 'when', 'where', 'which', 'while',
    'who', 'why', 'would', 'your', 'use', 'using', 'used', 'like', 'make',
    'more', 'example', 'see', 'code', 'return', 'import', 'export', 'const',
    'function', 'class', 'async', 'await', 'true', 'false', 'null',
]);

export class SectionEmbedder {
    private tfidfVectorizer: TFIDFVectorizer;
    private method: 'tfidf' | 'onnx' = 'tfidf';
    private onnxRuntime: any = null;
    private onnxInferenceSession: any = null;

    constructor() {
        this.tfidfVectorizer = new TFIDFVectorizer(TFIDF_DIM);
    }

    async initialize(): Promise<void> {
        try {
            // @ts-ignore - optional dependency
            const onnxruntime = await import('onnxruntime-node');
            this.onnxRuntime = onnxruntime;
            const modelPath = join(process.cwd(), '.agent-docs', '.models', 'model.onnx');
            if (existsSync(modelPath)) {
                this.onnxInferenceSession = await onnxruntime.InferenceSession.create(modelPath);
            }
            this.method = this.onnxInferenceSession ? 'onnx' : 'tfidf';
        } catch {
            this.method = 'tfidf';
        }
    }

    getMethod(): 'tfidf' | 'onnx' {
        return this.method;
    }

    async embedSections(
        docsDir: string,
        rootDir: string
    ): Promise<SectionEmbedding[]> {
        const sections = await this.extractSections(docsDir, rootDir);

        if (sections.length === 0) {
            return [];
        }

        if (this.method === 'onnx' && this.onnxInferenceSession) {
            await this.embedWithONNX(sections);
        } else {
            this.embedWithTFIDF(sections);
        }

        return sections;
    }

    async embedProjectContext(projectDir: string): Promise<Float32Array> {
        const texts: string[] = [];

        const packageJsonPath = join(projectDir, 'package.json');
        if (existsSync(packageJsonPath)) {
            try {
                const content = await readFile(packageJsonPath, 'utf-8');
                const pkg = JSON.parse(content);
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                texts.push(Object.keys(deps).join(' '));
                if (pkg.scripts) {
                    texts.push(Object.values(pkg.scripts).join(' '));
                }
            } catch {}
        }

        const configFiles = [
            'tsconfig.json', 'next.config.js', 'next.config.mjs',
            'vite.config.ts', 'nuxt.config.ts', 'svelte.config.js',
            'astro.config.mjs', '.skill-compiler.json',
        ];

        for (const cfg of configFiles) {
            const cfgPath = join(projectDir, cfg);
            if (existsSync(cfgPath)) {
                try {
                    texts.push(await readFile(cfgPath, 'utf-8'));
                } catch {}
            }
        }

        const srcDir = join(projectDir, 'src');
        if (existsSync(srcDir)) {
            const srcFiles = await collectSourceFiles(srcDir, 20);
            for (const file of srcFiles.slice(0, 10)) {
                try {
                    const content = await readFile(file, 'utf-8');
                    texts.push(content.slice(0, 2000));
                } catch {}
            }
        }

        const combined = texts.join('\n');
        const tokens = this.tfidfVectorizer.tokenize(combined);

        if (this.method === 'onnx' && this.onnxInferenceSession) {
            return this.embedTextONNX(combined);
        }

        return this.tfidfVectorizer.transform(tokens);
    }

    buildIndex(sections: SectionEmbedding[]): EmbeddingIndex | null {
        if (sections.length === 0) return null;

        const vectors = sections.map(s => s.vector);
        const dim = vectors[0].length;

        const tq = new TurboQuantMSE({ numBits: 4, seed: 42 });
        const compressed = tq.compress(vectors, dim);

        return {
            sections: sections.map(s => ({ path: s.path, name: s.name })),
            compressed,
            method: this.method,
            dimensions: dim,
        };
    }

    async saveIndex(index: EmbeddingIndex, cacheDir: string): Promise<void> {
        await mkdir(cacheDir, { recursive: true });

        const serialized = {
            sections: index.sections,
            method: index.method,
            dimensions: index.dimensions,
            compressed: {
                quantized: Array.from(index.compressed.quantized),
                norms: Array.from(index.compressed.norms),
                rotationMatrix: Array.from(index.compressed.rotationMatrix),
                codebook: Array.from(index.compressed.codebook),
                dimensions: index.compressed.dimensions,
                count: index.compressed.count,
                numBits: index.compressed.numBits,
            },
        };

        await writeFile(
            join(cacheDir, CACHE_FILENAME),
            JSON.stringify(serialized),
            'utf-8'
        );
    }

    async loadIndex(cacheDir: string): Promise<EmbeddingIndex | null> {
        const indexPath = join(cacheDir, CACHE_FILENAME);
        if (!existsSync(indexPath)) return null;

        try {
            const raw = await readFile(indexPath, 'utf-8');
            const data = JSON.parse(raw);

            return {
                sections: data.sections,
                method: data.method,
                dimensions: data.dimensions,
                compressed: {
                    quantized: new Uint8Array(data.compressed.quantized),
                    norms: new Float32Array(data.compressed.norms),
                    rotationMatrix: new Float32Array(data.compressed.rotationMatrix),
                    codebook: new Float32Array(data.compressed.codebook),
                    dimensions: data.compressed.dimensions,
                    count: data.compressed.count,
                    numBits: data.compressed.numBits,
                },
            };
        } catch {
            return null;
        }
    }

    private async extractSections(
        docsDir: string,
        rootDir: string
    ): Promise<SectionEmbedding[]> {
        const sections: SectionEmbedding[] = [];

        async function walk(dir: string): Promise<void> {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;

                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
                    try {
                        const content = await readFile(fullPath, 'utf-8');
                        const chunks = chunkByHeadings(content);

                        for (const chunk of chunks) {
                            sections.push({
                                path: relative(rootDir, fullPath),
                                name: chunk.title || entry.name,
                                content: chunk.text,
                                vector: new Float32Array(0),
                            });
                        }

                        if (chunks.length === 0) {
                            sections.push({
                                path: relative(rootDir, fullPath),
                                name: entry.name,
                                content: content.slice(0, 2000),
                                vector: new Float32Array(0),
                            });
                        }
                    } catch {}
                }
            }
        }

        if (existsSync(docsDir)) {
            await walk(docsDir);
        }

        return sections;
    }

    private embedWithTFIDF(sections: SectionEmbedding[]): void {
        const allTokens = sections.map(s => this.tfidfVectorizer.tokenize(s.content));
        this.tfidfVectorizer.fit(allTokens);

        for (let i = 0; i < sections.length; i++) {
            sections[i].vector = this.tfidfVectorizer.transform(allTokens[i]);
        }
    }

    private async embedWithONNX(sections: SectionEmbedding[]): Promise<void> {
        for (const section of sections) {
            section.vector = await this.embedTextONNX(section.content);
        }
    }

    private async embedTextONNX(text: string): Promise<Float32Array> {
        if (!this.onnxInferenceSession || !this.onnxRuntime) {
            return this.tfidfVectorizer.transform(this.tfidfVectorizer.tokenize(text));
        }

        try {
            const { Tensor } = this.onnxRuntime;

            const tokens = text.toLowerCase().split(/\s+/).slice(0, 512);
            const inputIds = new BigInt64Array(tokens.length);
            for (let i = 0; i < tokens.length; i++) {
                inputIds[i] = BigInt(i + 1);
            }

            const feeds = {
                input_ids: new Tensor('int64', inputIds, [1, tokens.length]),
                attention_mask: new Tensor('int64', new BigInt64Array(tokens.length).fill(1n), [1, tokens.length]),
            };

            const results = await this.onnxInferenceSession.run(feeds);
            const output = results['last_hidden_state'] || results['sentence_embedding'];

            if (output) {
                const data = output.data as Float32Array;
                const dim = output.dims[output.dims.length - 1];
                const result = new Float32Array(dim);

                for (let i = 0; i < dim; i++) {
                    let sum = 0;
                    const tokenCount = output.dims[1] || 1;
                    for (let t = 0; t < tokenCount; t++) {
                        sum += data[t * dim + i];
                    }
                    result[i] = sum / tokenCount;
                }

                let norm = 0;
                for (let i = 0; i < dim; i++) norm += result[i] * result[i];
                norm = Math.sqrt(norm);
                if (norm > 1e-10) {
                    for (let i = 0; i < dim; i++) result[i] /= norm;
                }

                return result;
            }
        } catch {}

        return this.tfidfVectorizer.transform(this.tfidfVectorizer.tokenize(text));
    }
}

class TFIDFVectorizer {
    private dim: number;
    private vocabulary: Map<string, number> = new Map();
    private idf: Float32Array = new Float32Array(0);
    private hashSeeds: number[];

    constructor(dim: number) {
        this.dim = dim;
        this.hashSeeds = [];
        for (let i = 0; i < dim; i++) {
            this.hashSeeds.push(murmurHash3(`seed_${i}`, 42));
        }
    }

    tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2 && !STOP_WORDS.has(t));
    }

    fit(allTokenLists: string[][]): void {
        const docFreq = new Map<string, number>();
        const totalDocs = allTokenLists.length;

        for (const tokens of allTokenLists) {
            const unique = new Set(tokens);
            for (const token of unique) {
                docFreq.set(token, (docFreq.get(token) || 0) + 1);
            }
        }

        const sortedVocab = [...docFreq.entries()]
            .filter(([, freq]) => freq > 1 || totalDocs < 5)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10000);

        this.vocabulary = new Map();
        for (const [word] of sortedVocab) {
            this.vocabulary.set(word, this.vocabulary.size);
        }

        this.idf = new Float32Array(Math.max(this.vocabulary.size, 1));
        for (const [word, idx] of this.vocabulary) {
            const df = docFreq.get(word) || 1;
            this.idf[idx] = Math.log((totalDocs + 1) / (df + 1)) + 1;
        }
    }

    transform(tokens: string[]): Float32Array {
        const vector = new Float32Array(this.dim);

        if (this.vocabulary.size === 0) {
            for (const token of tokens) {
                for (let d = 0; d < this.dim; d++) {
                    vector[d] += murmurHash3(token, this.hashSeeds[d]) / 2147483647;
                }
            }
        } else {
            const tf = new Map<string, number>();
            for (const token of tokens) {
                tf.set(token, (tf.get(token) || 0) + 1);
            }

            const maxTf = Math.max(...tf.values(), 1);

            for (const [token, count] of tf) {
                const vocabIdx = this.vocabulary.get(token);
                if (vocabIdx === undefined) continue;

                const tfidf = (count / maxTf) * (this.idf[vocabIdx] || 1);

                const hash = murmurHash3(token, 0);
                const bucket = Math.abs(hash) % this.dim;
                vector[bucket] += tfidf;
            }
        }

        let norm = 0;
        for (let i = 0; i < this.dim; i++) norm += vector[i] * vector[i];
        norm = Math.sqrt(norm);
        if (norm > 1e-10) {
            for (let i = 0; i < this.dim; i++) vector[i] /= norm;
        }

        return vector;
    }
}

function murmurHash3(str: string, seed: number): number {
    let h1 = seed >>> 0;
    const len = str.length;
    const nblocks = len >> 2;

    const C1 = 0xcc9e2d51;
    const C2 = 0x1b873593;

    for (let i = 0; i < nblocks; i++) {
        let k1 =
            (str.charCodeAt(i * 4) & 0xff) |
            ((str.charCodeAt(i * 4 + 1) & 0xff) << 8) |
            ((str.charCodeAt(i * 4 + 2) & 0xff) << 16) |
            ((str.charCodeAt(i * 4 + 3) & 0xff) << 24);

        k1 = Math.imul(k1, C1);
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = Math.imul(k1, C2);

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1 = Math.imul(h1, 5) + 0xe6546b64;
    }

    let k1 = 0;
    const tailStart = nblocks * 4;
    switch (len & 3) {
        case 3: k1 ^= (str.charCodeAt(tailStart + 2) & 0xff) << 16;
        case 2: k1 ^= (str.charCodeAt(tailStart + 1) & 0xff) << 8;
        case 1:
            k1 ^= str.charCodeAt(tailStart) & 0xff;
            k1 = Math.imul(k1, C1);
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = Math.imul(k1, C2);
            h1 ^= k1;
    }

    h1 ^= len;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
}

interface HeadingChunk {
    title: string;
    text: string;
}

function chunkByHeadings(content: string): HeadingChunk[] {
    const chunks: HeadingChunk[] = [];
    const lines = content.split('\n');
    let currentTitle = '';
    let currentText: string[] = [];
    let inFrontmatter = false;
    let inCodeBlock = false;

    for (const line of lines) {
        if (line.trim() === '---' && !inCodeBlock) {
            if (inFrontmatter) {
                inFrontmatter = false;
                continue;
            }
            if (currentText.length === 0 && chunks.length === 0) {
                inFrontmatter = true;
                continue;
            }
        }
        if (inFrontmatter) continue;

        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) continue;

        const h2Match = line.match(/^## (.+)/);
        const h1Match = line.match(/^# (.+)/);

        if (h1Match || h2Match) {
            if (currentText.length > 0 && currentText.join('\n').trim().length > 50) {
                chunks.push({
                    title: currentTitle,
                    text: currentText.join('\n').trim().slice(0, 2000),
                });
            }
            currentTitle = (h1Match || h2Match)![1].trim();
            currentText = [];
        } else {
            currentText.push(line);
        }
    }

    if (currentText.length > 0 && currentText.join('\n').trim().length > 50) {
        chunks.push({
            title: currentTitle,
            text: currentText.join('\n').trim().slice(0, 2000),
        });
    }

    return chunks;
}

async function collectSourceFiles(dir: string, maxFiles: number): Promise<string[]> {
    const files: string[] = [];

    async function walk(d: string): Promise<void> {
        if (files.length >= maxFiles) return;
        const entries = await readdir(d, { withFileTypes: true });
        for (const entry of entries) {
            if (files.length >= maxFiles) return;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = join(d, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (/\.(ts|tsx|js|jsx|py|go)$/.test(entry.name)) {
                files.push(fullPath);
            }
        }
    }

    try {
        await walk(dir);
    } catch {}

    return files;
}
