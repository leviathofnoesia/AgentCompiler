import { describe, it, expect } from 'vitest';
import { SectionRanker } from '../../src/compressor/ranker.js';

describe('SectionRanker', () => {
    it('should allocate token budgets based on scores', () => {
        const ranker = new SectionRanker({ targetSizeBytes: 8192 });

        const scored = [
            { path: 'docs/getting-started.mdx', name: 'Getting Started', score: 0.95, tokenBudget: 0, isCritical: true },
            { path: 'docs/routing.mdx', name: 'Routing', score: 0.85, tokenBudget: 0, isCritical: true },
            { path: 'docs/api-reference.mdx', name: 'API Reference', score: 0.70, tokenBudget: 0, isCritical: true },
            { path: 'docs/advanced.mdx', name: 'Advanced', score: 0.40, tokenBudget: 0, isCritical: false },
            { path: 'docs/examples.mdx', name: 'Examples', score: 0.20, tokenBudget: 0, isCritical: false },
        ];

        const result = (ranker as any).allocateBudget(scored, 2048);

        expect(result.length).toBeGreaterThan(0);

        for (const section of result) {
            expect(section.tokenBudget).toBeGreaterThan(0);
        }

        const critical = result.filter(s => s.isCritical);
        const nonCritical = result.filter(s => !s.isCritical);

        if (critical.length > 0 && nonCritical.length > 0) {
            const avgCritical = critical.reduce((s, c) => s + c.tokenBudget, 0) / critical.length;
            const avgNonCritical = nonCritical.reduce((s, c) => s + c.tokenBudget, 0) / nonCritical.length;
            expect(avgCritical).toBeGreaterThanOrEqual(avgNonCritical - 5);
        }
    });

    it('should identify critical sections', () => {
        const ranker = new SectionRanker();

        const sections = [
            { path: 'docs/getting-started.mdx', name: 'Getting Started', content: 'Install the framework', vector: new Float32Array(128) },
            { path: 'docs/advanced/custom-plugins.mdx', name: 'Custom Plugins', content: 'Create custom plugins for the framework', vector: new Float32Array(128) },
        ];

        const projectVector = new Float32Array(128);
        const scored = (ranker as any).scoreSections(sections, projectVector, 'nextjs');

        expect(scored.length).toBe(2);

        const gettingStarted = scored.find(s => s.name === 'Getting Started');
        expect(gettingStarted).toBeDefined();
        expect(gettingStarted!.isCritical).toBe(true);

        const customPlugins = scored.find(s => s.name === 'Custom Plugins');
        expect(customPlugins).toBeDefined();
        expect(customPlugins!.isCritical).toBe(false);
    });

    it('should generate fallback embedding for unknown frameworks', () => {
        const ranker = new SectionRanker();
        const vector = (ranker as any).embedProjectFallback('unknown-framework');

        expect(vector.length).toBe(128);

        let norm = 0;
        for (let i = 0; i < 128; i++) norm += vector[i] * vector[i];
        norm = Math.sqrt(norm);
        expect(norm).toBeCloseTo(1, 1);
    });

    it('should enforce minimum sections', () => {
        const ranker = new SectionRanker({ targetSizeBytes: 500, minSections: 3 });

        const sections = [];
        for (let i = 0; i < 20; i++) {
            sections.push({
                path: `docs/section-${i}.mdx`,
                name: `Section ${i}`,
                score: 1 - i * 0.05,
                tokenBudget: 100,
                isCritical: i < 3,
            });
        }

        const result = (ranker as any).allocateBudget(sections, 125);

        expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should score critical sections higher than non-critical', () => {
        const ranker = new SectionRanker({ boostCritical: 1.5 });

        const sections = [
            { path: 'docs/getting-started.mdx', name: 'Getting Started', content: 'Setup guide', vector: new Float32Array(128) },
            { path: 'docs/misc.mdx', name: 'Misc Notes', content: 'Random notes', vector: new Float32Array(128) },
        ];

        const zeroVector = new Float32Array(128);
        const scored = (ranker as any).scoreSections(sections, zeroVector, 'nextjs');

        const gettingStarted = scored.find(s => s.isCritical);
        const misc = scored.find(s => !s.isCritical);

        expect(gettingStarted!.score).toBeGreaterThanOrEqual(misc!.score);
    });
});
