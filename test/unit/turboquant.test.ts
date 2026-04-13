import { describe, it, expect } from 'vitest';
import { TurboQuantMSE, computeCompressionRatio, estimateDistortion } from '../../src/compressor/turboquant.js';

function generateRandomVectors(count: number, dim: number, seed: number = 42): Float32Array[] {
    const vectors: Float32Array[] = [];
    let state = seed;
    const next = () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 4294967296;
    };
    for (let i = 0; i < count; i++) {
        const vec = new Float32Array(dim);
        for (let j = 0; j < dim; j++) {
            const u1 = next();
            const u2 = next();
            vec[j] = Math.sqrt(-2 * Math.log(u1 > 0 ? u1 : 1e-10)) * Math.cos(2 * Math.PI * u2);
        }
        vectors.push(vec);
    }
    return vectors;
}

describe('TurboQuant', () => {
    it('should compress and decompress vectors without crashing', () => {
        const tq = new TurboQuantMSE({ numBits: 4, seed: 42 });
        const vectors = generateRandomVectors(10, 32);
        const compressed = tq.compress(vectors, 32);

        expect(compressed.count).toBe(10);
        expect(compressed.dimensions).toBe(32);
        expect(compressed.numBits).toBe(4);
        expect(compressed.quantized.length).toBeGreaterThan(0);
        expect(compressed.norms.length).toBe(10);
        expect(compressed.rotationMatrix.length).toBe(32 * 32);
        expect(compressed.codebook.length).toBe(16);

        const reconstructed = tq.decompress(compressed);
        expect(reconstructed.length).toBe(10);
        expect(reconstructed[0].length).toBe(32);
    });

    it('should achieve reasonable MSE distortion', () => {
        const tq = new TurboQuantMSE({ numBits: 4, seed: 42 });
        const vectors = generateRandomVectors(20, 64);
        const compressed = tq.compress(vectors, 64);
        const reconstructed = tq.decompress(compressed);

        const { mse, cosinePreservation } = estimateDistortion(vectors, reconstructed);

        expect(mse).toBeLessThan(0.5);
        expect(cosinePreservation).toBeGreaterThan(0.5);
    });

    it('should preserve cosine similarity for similar vectors', () => {
        const tq = new TurboQuantMSE({ numBits: 4, seed: 42 });

        const base = new Float32Array(32);
        for (let i = 0; i < 32; i++) base[i] = Math.cos(i * 0.3);

        const similar = new Float32Array(32);
        for (let i = 0; i < 32; i++) similar[i] = Math.cos(i * 0.3) + 0.01;

        const different = new Float32Array(32);
        for (let i = 0; i < 32; i++) different[i] = Math.sin(i * 0.7);

        const vectors = [base, similar, different];
        const compressed = tq.compress(vectors, 32);
        const reconstructed = tq.decompress(compressed);

        function cosSim(a: Float32Array, b: Float32Array): number {
            let dot = 0, na = 0, nb = 0;
            for (let i = 0; i < a.length; i++) {
                dot += a[i] * b[i];
                na += a[i] * a[i];
                nb += b[i] * b[i];
            }
            return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
        }

        const originalSimilar = cosSim(base, similar);
        const reconSimilar = cosSim(reconstructed[0], reconstructed[1]);
        expect(Math.abs(originalSimilar - reconSimilar)).toBeLessThan(0.3);
    });

    it('should query similar vectors correctly', () => {
        const tq = new TurboQuantMSE({ numBits: 4, seed: 42 });
        const vectors = generateRandomVectors(50, 32);
        const compressed = tq.compress(vectors, 32);

        const results = tq.querySimilarity(compressed, vectors[0], 5);

        expect(results.length).toBe(5);
        expect(results[0].index).toBe(0);
        expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should produce deterministic results with same seed', () => {
        const tq1 = new TurboQuantMSE({ numBits: 4, seed: 123 });
        const tq2 = new TurboQuantMSE({ numBits: 4, seed: 123 });
        const vectors = generateRandomVectors(5, 16);

        const c1 = tq1.compress(vectors, 16);
        const c2 = tq2.compress(vectors, 16);

        expect(c1.quantized).toEqual(c2.quantized);
        expect(c1.codebook).toEqual(c2.codebook);
    });

    it('should handle single vector', () => {
        const tq = new TurboQuantMSE({ numBits: 4 });
        const vec = new Float32Array(16);
        for (let i = 0; i < 16; i++) vec[i] = i / 16;

        const compressed = tq.compress([vec], 16);
        const reconstructed = tq.decompress(compressed);

        expect(reconstructed.length).toBe(1);
        expect(reconstructed[0].length).toBe(16);
    });

    it('should handle zero vectors gracefully', () => {
        const tq = new TurboQuantMSE({ numBits: 4 });
        const zero = new Float32Array(8);
        const nonzero = new Float32Array(8);
        for (let i = 0; i < 8; i++) nonzero[i] = 1;

        const compressed = tq.compress([zero, nonzero], 8);
        const reconstructed = tq.decompress(compressed);

        expect(reconstructed.length).toBe(2);
    });

    it('should achieve expected compression ratio', () => {
        const ratio = computeCompressionRatio(100, 384, 4);
        expect(ratio).toBeGreaterThan(0.1);
        expect(ratio).toBeLessThan(20);
    });

    it('should work with 2-bit quantization', () => {
        const tq = new TurboQuantMSE({ numBits: 2 });
        const vectors = generateRandomVectors(5, 32);
        const compressed = tq.compress(vectors, 32);

        expect(compressed.numBits).toBe(2);
        expect(compressed.codebook.length).toBe(4);

        const reconstructed = tq.decompress(compressed);
        expect(reconstructed.length).toBe(5);
    });

    it('should handle non-byte-aligned bit widths (3-bit)', () => {
        const tq = new TurboQuantMSE({ numBits: 3 });
        const vectors = generateRandomVectors(10, 32);
        const compressed = tq.compress(vectors, 32);

        expect(compressed.numBits).toBe(3);
        expect(compressed.codebook.length).toBe(8);

        const reconstructed = tq.decompress(compressed);
        expect(reconstructed.length).toBe(10);
        expect(reconstructed[0].length).toBe(32);

        const { mse, cosinePreservation } = estimateDistortion(vectors, reconstructed);
        expect(mse).toBeLessThan(1);
        expect(cosinePreservation).toBeGreaterThan(0.3);
    });
});
