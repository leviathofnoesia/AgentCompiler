/**
 * Index Compressor
 * Compresses documentation into <8KB indexes using Vercel's pipe-delimited format
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, relative, basename, extname } from 'path';
import type { DetectedSkill } from '../scanner/index.js';
import { getRegistry } from '../registries/index.js';

const TARGET_SIZE_KB = 8;
const TARGET_SIZE_BYTES = TARGET_SIZE_KB * 1024;

interface FileNode {
    path: string;
    name: string;
    isDir: boolean;
    children?: FileNode[];
}

/**
 * Compress documentation into a minimal index string
 */
export async function compressIndex(skill: DetectedSkill): Promise<string> {
    const cacheDir = join(process.cwd(), '.agent-docs', skill.name);
    const registry = getRegistry(skill.name);

    // Build file tree
    const tree = await buildFileTree(cacheDir);

    // Generate index with priority ordering
    const priority = registry?.priority || [];
    const orderedTree = prioritizeTree(tree, priority);

    // Format as pipe-delimited index
    let index = formatIndex(skill, orderedTree, cacheDir);

    // Compress if over target size
    if (Buffer.byteLength(index, 'utf-8') > TARGET_SIZE_BYTES) {
        index = compressAggressively(index, skill);
    }

    return index;
}

/**
 * Build a file tree from a directory
 */
async function buildFileTree(dir: string): Promise<FileNode[]> {
    const nodes: FileNode[] = [];

    try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            // Skip cache metadata
            if (entry.name.startsWith('.')) continue;

            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                const children = await buildFileTree(fullPath);
                if (children.length > 0) {
                    nodes.push({
                        path: fullPath,
                        name: entry.name,
                        isDir: true,
                        children,
                    });
                }
            } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
                nodes.push({
                    path: fullPath,
                    name: entry.name,
                    isDir: false,
                });
            }
        }
    } catch {
        // Directory doesn't exist
    }

    return nodes;
}

/**
 * Reorder tree based on priority sections
 */
function prioritizeTree(tree: FileNode[], priority: string[]): FileNode[] {
    if (priority.length === 0) return tree;

    const prioritized: FileNode[] = [];
    const remaining: FileNode[] = [];

    for (const node of tree) {
        const priorityIndex = priority.findIndex(p =>
            node.name.toLowerCase().includes(p.toLowerCase())
        );
        if (priorityIndex >= 0) {
            prioritized[priorityIndex] = node;
        } else {
            remaining.push(node);
        }
    }

    return [...prioritized.filter(Boolean), ...remaining];
}

/**
 * Format tree as pipe-delimited index
 */
function formatIndex(skill: DetectedSkill, tree: FileNode[], rootDir: string): string {
    const displayName = skill.displayName || skill.name;
    const lines: string[] = [
        `[${displayName} Docs Index]|root: ./.agent-docs/${skill.name}`,
        `|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for ${displayName} tasks.`,
    ];

    // Format each directory as a section
    for (const node of tree) {
        if (node.isDir && node.children) {
            const sectionPath = relative(rootDir, node.path);
            const files = node.children
                .filter(c => !c.isDir)
                .map(c => c.name)
                .join(',');

            if (files) {
                lines.push(`|${sectionPath}:{${files}}`);
            }

            // Handle nested directories
            for (const child of node.children.filter(c => c.isDir)) {
                const nestedPath = relative(rootDir, child.path);
                const nestedFiles = child.children
                    ?.filter(c => !c.isDir)
                    .map(c => c.name)
                    .join(',');

                if (nestedFiles) {
                    lines.push(`|${nestedPath}:{${nestedFiles}}`);
                }
            }
        } else if (!node.isDir) {
            // Root-level files
            lines.push(`|{${node.name}}`);
        }
    }

    return lines.join('\n');
}

/**
 * Aggressively compress index to meet target size
 */
function compressAggressively(index: string, skill: DetectedSkill): string {
    let compressed = index;

    // 1. Remove extensions
    compressed = compressed.replace(/\.mdx?/g, '');

    // 2. Abbreviate common path prefixes
    compressed = compressed.replace(/getting-started/g, 'gs');
    compressed = compressed.replace(/api-reference/g, 'api');
    compressed = compressed.replace(/building-your-application/g, 'build');
    compressed = compressed.replace(/configuration/g, 'config');

    // 3. Use numbered prefixes: 01-app -> 1a
    compressed = compressed.replace(/(\d{2})-([a-z])/g, (_, num, letter) => {
        return `${parseInt(num)}${letter}`;
    });

    // 4. Remove redundant separators
    compressed = compressed.replace(/\|+/g, '|');

    // 5. If still too large, truncate least important sections
    while (Buffer.byteLength(compressed, 'utf-8') > TARGET_SIZE_BYTES) {
        const lines = compressed.split('\n');
        if (lines.length <= 3) break; // Keep header + instruction + at least one section
        lines.pop();
        compressed = lines.join('\n');
    }

    return compressed;
}

/**
 * Get compression stats
 */
export async function getCompressionStats(skill: DetectedSkill): Promise<{
    originalSize: number;
    compressedSize: number;
    reductionPercent: number;
}> {
    const cacheDir = join(process.cwd(), '.agent-docs', skill.name);
    let originalSize = 0;

    // Calculate original docs size
    async function calcDirSize(dir: string): Promise<number> {
        let size = 0;
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    size += await calcDirSize(fullPath);
                } else {
                    const s = await stat(fullPath);
                    size += s.size;
                }
            }
        } catch { }
        return size;
    }

    originalSize = await calcDirSize(cacheDir);

    const compressed = await compressIndex(skill);
    const compressedSize = Buffer.byteLength(compressed, 'utf-8');

    return {
        originalSize,
        compressedSize,
        reductionPercent: originalSize > 0
            ? Math.round((1 - compressedSize / originalSize) * 100)
            : 0,
    };
}
