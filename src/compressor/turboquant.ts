/**
 * TurboQuant — TypeScript Port
 * Based on: "TurboQuant: Online Vector Quantization with Near-optimal Distortion Rate"
 * Authors: Zandieh, Daliri, Hadian, Mirrokni (Google Research, ICLR 2026)
 *
 * Implements Algorithm 1 (TurboQuant_mse):
 * 1. Random orthogonal rotation (makes coordinates near-iid Gaussian/Beta)
 * 2. Lloyd-Max scalar quantization per coordinate (optimal for the resulting distribution)
 * 3. Bit-packed storage for compressed embeddings
 *
 * Used to compress embedding vectors for semantic section ranking,
 * achieving ~8x compression on 384-dim float32 vectors with near-zero accuracy loss.
 */

export interface TurboQuantConfig {
    numBits?: number;
    seed?: number;
    codebookSize?: number;
}

export interface CompressedVectors {
    quantized: Uint8Array;
    norms: Float32Array;
    rotationMatrix: Float32Array;
    codebook: Float32Array;
    dimensions: number;
    count: number;
    numBits: number;
}

const DEFAULT_CONFIG: Required<TurboQuantConfig> = {
    numBits: 4,
    seed: 42,
    codebookSize: 16,
};

export class TurboQuantMSE {
    private config: Required<TurboQuantConfig>;
    private rng: SeededRNG;

    constructor(config: TurboQuantConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.config.codebookSize = 1 << this.config.numBits;
        this.rng = new SeededRNG(this.config.seed);
    }

    compress(vectors: Float32Array[], dimensions: number): CompressedVectors {
        const count = vectors.length;
        const dim = dimensions;

        const norms = new Float32Array(count);
        const normalized = new Array<Float32Array>(count);

        for (let i = 0; i < count; i++) {
            let norm = 0;
            for (let j = 0; j < dim; j++) {
                norm += vectors[i][j] * vectors[i][j];
            }
            norm = Math.sqrt(norm);
            norms[i] = norm;
            const invNorm = norm > 1e-10 ? 1 / norm : 0;
            normalized[i] = new Float32Array(dim);
            for (let j = 0; j < dim; j++) {
                normalized[i][j] = vectors[i][j] * invNorm;
            }
        }

        const rotationMatrix = this.generateRandomRotation(dim);

        const rotated = new Array<Float32Array>(count);
        for (let i = 0; i < count; i++) {
            rotated[i] = this.applyRotation(normalized[i], rotationMatrix, dim);
        }

        const codebook = this.computeLloydMaxCodebook(rotated, dim);

        const bitsPerValue = this.config.numBits;
        const valuesPerByte = 8 / bitsPerValue;
        const totalValues = count * dim;
        const packedSize = Math.ceil(totalValues / valuesPerByte);
        const quantized = new Uint8Array(packedSize);

        let packIndex = 0;
        let bitBuffer = 0;
        let bitsInBuffer = 0;
        const mask = (1 << bitsPerValue) - 1;

        for (let i = 0; i < count; i++) {
            for (let j = 0; j < dim; j++) {
                const code = this.quantizeScalar(rotated[i][j], codebook);
                bitBuffer = (bitBuffer << bitsPerValue) | (code & mask);
                bitsInBuffer += bitsPerValue;

                if (bitsInBuffer >= 8) {
                    quantized[packIndex++] = (bitBuffer >> (bitsInBuffer - 8)) & 0xff;
                    bitsInBuffer -= 8;
                    bitBuffer &= (1 << bitsInBuffer) - 1;
                }
            }
        }

        if (bitsInBuffer > 0) {
            quantized[packIndex++] = (bitBuffer << (8 - bitsInBuffer)) & 0xff;
        }

        return {
            quantized,
            norms,
            rotationMatrix,
            codebook,
            dimensions: dim,
            count,
            numBits: bitsPerValue,
        };
    }

    decompress(compressed: CompressedVectors): Float32Array[] {
        const { quantized, norms, rotationMatrix, codebook, dimensions: dim, count, numBits } = compressed;

        const valuesPerByte = 8 / numBits;
        const mask = (1 << numBits) - 1;

        const rotated = new Array<Float32Array>(count);
        for (let i = 0; i < count; i++) {
            rotated[i] = new Float32Array(dim);
        }

        let bitIndex = 0;
        for (let i = 0; i < count; i++) {
            for (let j = 0; j < dim; j++) {
                const byteIndex = Math.floor(bitIndex / 8);
                const bitOffset = 8 - numBits - (bitIndex % 8);
                const code = (quantized[byteIndex] >> bitOffset) & mask;
                rotated[i][j] = codebook[code];
                bitIndex += numBits;
            }
        }

        const invRotation = this.transposeMatrix(rotationMatrix, dim);

        const result = new Array<Float32Array>(count);
        for (let i = 0; i < count; i++) {
            const denormed = this.applyRotation(rotated[i], invRotation, dim);
            result[i] = new Float32Array(dim);
            for (let j = 0; j < dim; j++) {
                result[i][j] = denormed[j] * norms[i];
            }
        }

        return result;
    }

    querySimilarity(
        compressed: CompressedVectors,
        queryVector: Float32Array,
        topK: number = 10
    ): { index: number; score: number }[] {
        const { norms, rotationMatrix, codebook, dimensions: dim, count, numBits } = compressed;

        let queryNorm = 0;
        for (let j = 0; j < dim; j++) {
            queryNorm += queryVector[j] * queryVector[j];
        }
        queryNorm = Math.sqrt(queryNorm);
        const invQueryNorm = queryNorm > 1e-10 ? 1 / queryNorm : 0;
        const normalizedQuery = new Float32Array(dim);
        for (let j = 0; j < dim; j++) {
            normalizedQuery[j] = queryVector[j] * invQueryNorm;
        }

        const rotatedQuery = this.applyRotation(normalizedQuery, rotationMatrix, dim);

        const quantizedQuery = new Float32Array(dim);
        for (let j = 0; j < dim; j++) {
            quantizedQuery[j] = codebook[this.quantizeScalar(rotatedQuery[j], codebook)];
        }

        const scores: { index: number; score: number }[] = [];

        const mask = (1 << numBits) - 1;
        let bitIndex = 0;

        for (let i = 0; i < count; i++) {
            let dotProduct = 0;
            for (let j = 0; j < dim; j++) {
                const byteIndex = Math.floor(bitIndex / 8);
                const bitOffset = 8 - numBits - (bitIndex % 8);
                const code = (compressed.quantized[byteIndex] >> bitOffset) & mask;
                dotProduct += quantizedQuery[j] * codebook[code];
                bitIndex += numBits;
            }

            const score = dotProduct * norms[i] * queryNorm;
            scores.push({ index: i, score });
        }

        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, topK);
    }

    private generateRandomRotation(dim: number): Float32Array {
        const matrix = new Float32Array(dim * dim);

        for (let i = 0; i < dim * dim; i++) {
            matrix[i] = this.rng.gaussian();
        }

        for (let col = 0; col < dim; col++) {
            for (let row = 0; row < col; row++) {
                let dot = 0;
                for (let k = 0; k < dim; k++) {
                    dot += matrix[k * dim + row] * matrix[k * dim + col];
                }
                for (let k = 0; k < dim; k++) {
                    matrix[k * dim + col] -= dot * matrix[k * dim + row];
                }
            }

            let norm = 0;
            for (let k = 0; k < dim; k++) {
                norm += matrix[k * dim + col] * matrix[k * dim + col];
            }
            norm = Math.sqrt(norm);
            const invNorm = norm > 1e-10 ? 1 / norm : 0;
            for (let k = 0; k < dim; k++) {
                matrix[k * dim + col] *= invNorm;
            }
        }

        return matrix;
    }

    private applyRotation(vector: Float32Array, matrix: Float32Array, dim: number): Float32Array {
        const result = new Float32Array(dim);
        for (let i = 0; i < dim; i++) {
            let sum = 0;
            for (let j = 0; j < dim; j++) {
                sum += vector[j] * matrix[j * dim + i];
            }
            result[i] = sum;
        }
        return result;
    }

    private transposeMatrix(matrix: Float32Array, dim: number): Float32Array {
        const transposed = new Float32Array(dim * dim);
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                transposed[j * dim + i] = matrix[i * dim + j];
            }
        }
        return transposed;
    }

    private computeLloydMaxCodebook(
        rotatedVectors: Float32Array[],
        dim: number
    ): Float32Array {
        const K = this.config.codebookSize;

        let allMin = Infinity, allMax = -Infinity;
        for (const vec of rotatedVectors) {
            for (let j = 0; j < dim; j++) {
                if (vec[j] < allMin) allMin = vec[j];
                if (vec[j] > allMax) allMax = vec[j];
            }
        }

        const range = allMax - allMin;
        const step = range / K;
        const codebook = new Float32Array(K);
        for (let i = 0; i < K; i++) {
            codebook[i] = allMin + step * (i + 0.5);
        }

        for (let iter = 0; iter < 20; iter++) {
            const sums = new Float64Array(K);
            const counts = new Float64Array(K);

            for (const vec of rotatedVectors) {
                for (let j = 0; j < dim; j++) {
                    let bestIdx = 0;
                    let bestDist = Math.abs(vec[j] - codebook[0]);
                    for (let k = 1; k < K; k++) {
                        const dist = Math.abs(vec[j] - codebook[k]);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestIdx = k;
                        }
                    }
                    sums[bestIdx] += vec[j];
                    counts[bestIdx]++;
                }
            }

            let changed = false;
            for (let k = 0; k < K; k++) {
                if (counts[k] > 0) {
                    const newVal = sums[k] / counts[k];
                    if (Math.abs(newVal - codebook[k]) > 1e-8) {
                        codebook[k] = newVal;
                        changed = true;
                    }
                }
            }

            if (!changed) break;
        }

        return codebook;
    }

    private quantizeScalar(value: number, codebook: Float32Array): number {
        let bestIdx = 0;
        let bestDist = Math.abs(value - codebook[0]);
        for (let k = 1; k < codebook.length; k++) {
            const dist = Math.abs(value - codebook[k]);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = k;
            }
        }
        return bestIdx;
    }
}

class SeededRNG {
    private state: number;

    constructor(seed: number) {
        this.state = seed;
    }

    next(): number {
        this.state ^= this.state << 13;
        this.state ^= this.state >> 17;
        this.state ^= this.state << 5;
        return (this.state >>> 0) / 4294967296;
    }

    gaussian(): number {
        const u1 = this.next();
        const u2 = this.next();
        const mag = Math.sqrt(-2 * Math.log(u1 > 0 ? u1 : 1e-10));
        return mag * Math.cos(2 * Math.PI * u2);
    }
}

export function computeCompressionRatio(
    count: number,
    dimensions: number,
    numBits: number
): number {
    const originalBytes = count * dimensions * 4;
    const compressedBytes = Math.ceil((count * dimensions * numBits) / 8) + count * 4 + dimensions * dimensions * 4 + (1 << numBits) * 4;
    return originalBytes / compressedBytes;
}

export function estimateDistortion(
    original: Float32Array[],
    reconstructed: Float32Array[]
): { mse: number; cosinePreservation: number } {
    const count = original.length;
    const dim = original[0].length;
    let totalMSE = 0;

    const originalNorms: number[] = [];
    const reconstructedNorms: number[] = [];
    for (let i = 0; i < count; i++) {
        let oNorm = 0, rNorm = 0;
        let sqErr = 0;
        for (let j = 0; j < dim; j++) {
            sqErr += (original[i][j] - reconstructed[i][j]) ** 2;
            oNorm += original[i][j] ** 2;
            rNorm += reconstructed[i][j] ** 2;
        }
        totalMSE += sqErr / dim;
        originalNorms.push(Math.sqrt(oNorm));
        reconstructedNorms.push(Math.sqrt(rNorm));
    }

    const mse = totalMSE / count;

    let cosinePreservation = 0;
    let pairCount = 0;
    const sampleSize = Math.min(count, 50);
    for (let i = 0; i < sampleSize; i++) {
        for (let j = i + 1; j < sampleSize; j++) {
            let oDot = 0, rDot = 0;
            for (let k = 0; k < dim; k++) {
                oDot += original[i][k] * original[j][k];
                rDot += reconstructed[i][k] * reconstructed[j][k];
            }
            const oCos = oDot / (originalNorms[i] * originalNorms[j] + 1e-10);
            const rCos = rDot / (reconstructedNorms[i] * reconstructedNorms[j] + 1e-10);
            cosinePreservation += 1 - Math.abs(oCos - rCos);
            pairCount++;
        }
    }
    cosinePreservation = pairCount > 0 ? cosinePreservation / pairCount : 1;

    return { mse, cosinePreservation };
}
