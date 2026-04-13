import { describe, it, expect } from 'vitest';
import { SectionEmbedder } from '../../src/compressor/embeddings.js';

describe('SectionEmbedder', () => {
    it('should initialize with TF-IDF when ONNX is unavailable', async () => {
        const embedder = new SectionEmbedder();
        await embedder.initialize();
        expect(embedder.getMethod()).toBe('tfidf');
    });

    it('should embed text via TF-IDF', async () => {
        const embedder = new SectionEmbedder();
        await embedder.initialize();

        const text = 'Next.js is a React framework for building full-stack web applications with server components and routing';
        const tokens = (embedder as any).tfidfVectorizer.tokenize(text);

        expect(tokens.length).toBeGreaterThan(3);
        expect(tokens).not.toContain('the');
        expect(tokens).not.toContain('for');
        expect(tokens).toContain('next');
        expect(tokens).toContain('framework');
    });

    it('should produce normalized TF-IDF vectors', async () => {
        const embedder = new SectionEmbedder();
        await embedder.initialize();

        const allTokens = [
            ['react', 'component', 'hooks', 'state', 'render'],
            ['vue', 'component', 'reactive', 'template', 'render'],
            ['angular', 'service', 'component', 'dependency', 'inject'],
        ];

        (embedder as any).tfidfVectorizer.fit(allTokens);

        for (const tokens of allTokens) {
            const vector = (embedder as any).tfidfVectorizer.transform(tokens);
            expect(vector.length).toBe(128);

            let norm = 0;
            for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
            norm = Math.sqrt(norm);
            expect(Math.abs(norm - 1)).toBeLessThan(0.01);
        }
    });

    it('should build and serialize an embedding index', async () => {
        const embedder = new SectionEmbedder();
        await embedder.initialize();

        const sections = [
            {
                path: 'docs/getting-started.mdx',
                name: 'Getting Started',
                content: 'Install Next.js with npm create-next-app. Set up your project structure with app directory.',
                vector: new Float32Array(128),
            },
            {
                path: 'docs/routing.mdx',
                name: 'Routing',
                content: 'Next.js App Router uses file-based routing with dynamic segments and layout nesting.',
                vector: new Float32Array(128),
            },
        ];

        (embedder as any).tfidfVectorizer.fit(sections.map(s => (embedder as any).tfidfVectorizer.tokenize(s.content)));
        for (const section of sections) {
            section.vector = (embedder as any).tfidfVectorizer.transform(
                (embedder as any).tfidfVectorizer.tokenize(section.content)
            );
        }

        const index = embedder.buildIndex(sections);

        expect(index).not.toBeNull();
        expect(index!.sections.length).toBe(2);
        expect(index!.method).toBe('tfidf');
        expect(index!.dimensions).toBe(128);
        expect(index!.compressed.count).toBe(2);
        expect(index!.compressed.quantized.length).toBeGreaterThan(0);
    });

    it('should return null index for empty sections', async () => {
        const embedder = new SectionEmbedder();
        const index = embedder.buildIndex([]);
        expect(index).toBeNull();
    });

    it('should tokenize and remove stop words', async () => {
        const embedder = new SectionEmbedder();
        const tokenizer = (embedder as any).tfidfVectorizer;

        const tokens = tokenizer.tokenize('The quick brown fox jumps over the lazy dog and the cat');
        expect(tokens).not.toContain('the');
        expect(tokens).not.toContain('and');
        expect(tokens).not.toContain('over');
        expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle empty content gracefully', async () => {
        const embedder = new SectionEmbedder();
        const tokenizer = (embedder as any).tfidfVectorizer;

        const tokens = tokenizer.tokenize('');
        expect(tokens).toEqual([]);

        const tokens2 = tokenizer.tokenize('  a  b  c  ');
        expect(tokens2).toEqual([]);
    });
});
