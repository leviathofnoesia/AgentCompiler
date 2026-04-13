/**
 * Semantic Section Ranker
 *
 * Ranks documentation sections by relevance to the project's actual code patterns.
 * Uses compressed embedding vectors (TurboQuant) for efficient similarity search.
 *
 * Flow:
 * 1. Embed project context (package.json, source files, configs)
 * 2. Embed each documentation section
 * 3. Compute cosine similarity between project context and each section
 * 4. Rank sections by score, with guaranteed minimums for critical sections
 * 5. Allocate token budget proportionally to relevance scores
 */

import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { SectionEmbedder, type SectionEmbedding, type EmbeddingIndex } from './embeddings.js';
import { TurboQuantMSE } from './turboquant.js';

export interface RankedSection {
    path: string;
    name: string;
    score: number;
    tokenBudget: number;
    isCritical: boolean;
    children?: RankedSection[];
}

export interface RankingResult {
    sections: RankedSection[];
    projectRelevance: number;
    method: 'tfidf' | 'onnx';
    totalBudget: number;
    usedBudget: number;
}

export interface RankingOptions {
    targetSizeBytes: number;
    avgTokenBytes: number;
    criticalPatterns: string[];
    minSections: number;
    boostCritical: number;
    semanticRanking?: boolean;
    embeddingModel?: string;
}

const DEFAULT_OPTIONS: RankingOptions = {
    targetSizeBytes: 8192,
    avgTokenBytes: 4,
    criticalPatterns: [
        'getting-started',
        'installation',
        'quickstart',
        'introduction',
        'api-reference',
        'configuration',
        'project-structure',
    ],
    minSections: 5,
    boostCritical: 1.5,
};

const CRITICAL_KEYWORDS: Record<string, string[]> = {
    nextjs: ['app-router', 'routing', 'rendering', 'caching', 'api-reference', 'getting-started'],
    react: ['hooks', 'components', 'reference', 'getting-started', 'api'],
    vue: ['composition-api', 'reactivity', 'components', 'routing', 'getting-started'],
    astro: ['pages', 'components', 'islands', 'routing', 'getting-started'],
    sveltekit: ['routing', 'load', 'actions', 'getting-started'],
    supabase: ['auth', 'database', 'storage', 'getting-started'],
    tailwindcss: ['configuration', 'utility-classes', 'responsive', 'getting-started'],
    prisma: ['schema', 'queries', 'migrations', 'getting-started'],
    django: ['models', 'views', 'urls', 'admin', 'getting-started'],
    fastapi: ['path-operations', 'dependencies', 'security', 'getting-started'],
    express: ['routing', 'middleware', 'error-handling', 'getting-started'],
    flask: ['routing', 'templates', 'blueprints', 'getting-started'],
    gin: ['routing', 'middleware', 'binding', 'getting-started'],
};

export class SectionRanker {
    private embedder: SectionEmbedder;
    private options: RankingOptions;

    constructor(options: Partial<RankingOptions> = {}) {
        this.embedder = new SectionEmbedder();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    async rankSections(
        docsDir: string,
        rootDir: string,
        frameworkName: string
    ): Promise<RankingResult> {
        await this.embedder.initialize();

        const cacheDir = join(docsDir, '.cache');

        let projectVector: Float32Array;
        try {
            projectVector = await this.embedder.embedProjectContext(rootDir);
        } catch {
            projectVector = this.embedProjectFallback(frameworkName);
        }

        let sections: SectionEmbedding[];
        let embeddingIndex: EmbeddingIndex | null = null;

        const cachedIndex = await this.embedder.loadIndex(cacheDir);
        sections = await this.embedder.embedSections(docsDir, rootDir);

        let cacheHit = false;
        if (cachedIndex && sections.length > 0 && cachedIndex.sections.length === sections.length) {
            cacheHit = sections.every((s, i) =>
                s.path === cachedIndex.sections[i].path && s.name === cachedIndex.sections[i].name
            );
        }

        if (cacheHit && cachedIndex) {
            embeddingIndex = cachedIndex;
            const tq = new TurboQuantMSE({ numBits: 4, seed: 42 });
            const reconstructed = tq.decompress(cachedIndex.compressed);
            for (let i = 0; i < sections.length; i++) {
                sections[i].vector = reconstructed[i];
            }
        } else {
            if (sections.length > 0) {
                this.embedWithTFIDFInline(sections);
                embeddingIndex = this.embedder.buildIndex(sections);
                if (embeddingIndex) {
                    try {
                        await this.embedder.saveIndex(embeddingIndex, cacheDir);
                    } catch {}
                }
            }
        }

        if (sections.length === 0) {
            return {
                sections: [],
                projectRelevance: 0,
                method: this.embedder.getMethod(),
                totalBudget: this.options.targetSizeBytes,
                usedBudget: 0,
            };
        }

        const scored = this.scoreSections(sections, projectVector, frameworkName);

        const totalTokens = Math.floor(this.options.targetSizeBytes / this.options.avgTokenBytes);
        const ranked = this.allocateBudget(scored, totalTokens);

        const avgScore = ranked.length > 0
            ? ranked.reduce((sum, s) => sum + s.score, 0) / ranked.length
            : 0;

        const usedBudget = ranked.reduce(
            (sum, s) => sum + s.tokenBudget * this.options.avgTokenBytes,
            0
        );

        return {
            sections: ranked,
            projectRelevance: avgScore,
            method: this.embedder.getMethod(),
            totalBudget: this.options.targetSizeBytes,
            usedBudget,
        };
    }

    private scoreSections(
        sections: SectionEmbedding[],
        projectVector: Float32Array,
        frameworkName: string
    ): RankedSection[] {
        const criticalSections = CRITICAL_KEYWORDS[frameworkName] || [];
        const allCritical = [...this.options.criticalPatterns, ...criticalSections];

        const scored: RankedSection[] = sections.map(section => {
            const cosineSim = cosineSimilarity(section.vector, projectVector);

            const pathLower = section.path.toLowerCase() + section.name.toLowerCase();
            const isCritical = allCritical.some(pattern =>
                pathLower.includes(pattern.replace(/-/g, '/')) ||
                pathLower.includes(pattern)
            );

            const score = isCritical
                ? Math.max(cosineSim, 0.3) * this.options.boostCritical
                : cosineSim;

            return {
                path: section.path,
                name: section.name,
                score: Math.max(score, 0),
                tokenBudget: 0,
                isCritical,
            };
        });

        scored.sort((a, b) => b.score - a.score);

        return scored;
    }

    private allocateBudget(
        sections: RankedSection[],
        totalTokens: number
    ): RankedSection[] {
        if (sections.length === 0) return [];

        const headerTokens = 100;
        const availableTokens = totalTokens - headerTokens;

        const criticalSections = sections.filter(s => s.isCritical);
        const nonCriticalSections = sections.filter(s => !s.isCritical);

        const criticalBudget = Math.floor(availableTokens * 0.6);
        const nonCriticalBudget = availableTokens - criticalBudget;

        const minTokensPerSection = 50;
        const minCritical = Math.min(criticalSections.length, this.options.minSections);

        if (criticalSections.length > 0) {
            const perCritical = Math.max(
                Math.floor(criticalBudget / Math.max(criticalSections.length, 1)),
                minTokensPerSection
            );
            for (const section of criticalSections) {
                section.tokenBudget = perCritical;
            }
        }

        if (nonCriticalSections.length > 0) {
            const totalNonCriticalScore = nonCriticalSections.reduce(
                (sum, s) => sum + Math.max(s.score, 0.01),
                0
            );

            for (const section of nonCriticalSections) {
                const proportion = Math.max(section.score, 0.01) / totalNonCriticalScore;
                section.tokenBudget = Math.max(
                    Math.floor(nonCriticalBudget * proportion),
                    minTokensPerSection
                );
            }
        }

        const result = [...criticalSections, ...nonCriticalSections];

        let totalAllocated = result.reduce((sum, s) => sum + s.tokenBudget, 0);
        if (totalAllocated > availableTokens) {
            const scale = availableTokens / totalAllocated;
            for (const section of result) {
                section.tokenBudget = Math.max(
                    Math.floor(section.tokenBudget * scale),
                    minTokensPerSection
                );
            }
        }

        while (result.length > this.options.minSections) {
            totalAllocated = result.reduce((sum, s) => sum + s.tokenBudget, 0);
            if (totalAllocated <= availableTokens) break;

            const last = result[result.length - 1];
            if (!last.isCritical) {
                result.pop();
            } else {
                break;
            }
        }

        return result;
    }

    private embedWithTFIDFInline(sections: SectionEmbedding[]): void {
        const allTokens = sections.map(s =>
            (this.embedder as any).tfidfVectorizer.tokenize(s.content)
        );
        (this.embedder as any).tfidfVectorizer.fit(allTokens);
        for (let i = 0; i < sections.length; i++) {
            sections[i].vector = (this.embedder as any).tfidfVectorizer.transform(allTokens[i]);
        }
    }

    private embedProjectFallback(frameworkName: string): Float32Array {
        const keywords = CRITICAL_KEYWORDS[frameworkName] || ['getting-started', 'api'];
        const vector = new Float32Array(128);

        for (const keyword of keywords) {
            let hash = 0;
            for (let i = 0; i < keyword.length; i++) {
                hash = ((hash << 5) - hash + keyword.charCodeAt(i)) | 0;
            }
            const bucket = Math.abs(hash) % 128;
            vector[bucket] += 1;
        }

        let norm = 0;
        for (let i = 0; i < 128; i++) norm += vector[i] * vector[i];
        norm = Math.sqrt(norm);
        if (norm > 1e-10) {
            for (let i = 0; i < 128; i++) vector[i] /= norm;
        }

        return vector;
    }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const minLen = Math.min(a.length, b.length);
    if (minLen === 0) return 0;

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < minLen; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 1e-10 ? dot / denominator : 0;
}
