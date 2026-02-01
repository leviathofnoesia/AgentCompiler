/**
 * Index Compressor
 * Compresses documentation into <8KB indexes using Vercel's pipe-delimited format
 * Supports v1 (basic) and v2 (semantic) compression formats
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, relative, basename, extname } from 'path';
import type { DetectedSkill } from '../scanner/index.js';
import { getRegistry } from '../registries/index.js';
import { loadConfig } from '../config/index.js';

const DEFAULT_TARGET_SIZE_BYTES = 8 * 1024;

interface FileNode {
    path: string;
    name: string;
    isDir: boolean;
    children?: FileNode[];
    headings?: string[];
    firstParagraph?: string;
}

interface CompressionOptions {
    format?: 'v1' | 'v2';
    targetSize?: number;
    cwd?: string;
}

/**
 * Compress documentation into a minimal index string
 */
export async function compressIndex(skill: DetectedSkill, options?: CompressionOptions): Promise<string> {
    const cwd = options?.cwd || process.cwd();
    const cacheDir = join(cwd, '.agent-docs', skill.name);
    const registry = getRegistry(skill.name);

    // Load config for compression settings
    const config = await loadConfig(cwd);
    const format = options?.format || config.compression?.format || 'v1';
    const targetSize = options?.targetSize || config.compression?.targetSize || DEFAULT_TARGET_SIZE_BYTES;

    // Build file tree
    const tree = await buildFileTree(cacheDir, format === 'v2');

    // Generate index with priority ordering
    const priority = registry?.priority || [];
    const orderedTree = prioritizeTree(tree, priority);

    // Format based on version
    let index = format === 'v2'
        ? formatIndexV2(skill, orderedTree, cacheDir)
        : formatIndexV1(skill, orderedTree, cacheDir);

    // Compress if over target size
    if (Buffer.byteLength(index, 'utf-8') > targetSize) {
        index = compressAggressively(index, skill, targetSize);
    }

    return index;
}

/**
 * Build a file tree from a directory
 */
async function buildFileTree(dir: string, extractContent: boolean = false): Promise<FileNode[]> {
    const nodes: FileNode[] = [];

    try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            // Skip cache metadata
            if (entry.name.startsWith('.')) continue;

            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                const children = await buildFileTree(fullPath, extractContent);
                if (children.length > 0) {
                    nodes.push({
                        path: fullPath,
                        name: entry.name,
                        isDir: true,
                        children,
                    });
                }
            } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
                const node: FileNode = {
                    path: fullPath,
                    name: entry.name,
                    isDir: false,
                };

                // Extract headings and first paragraph for v2 format
                if (extractContent) {
                    try {
                        const content = await readFile(fullPath, 'utf-8');
                        node.headings = extractHeadings(content);
                        node.firstParagraph = extractFirstParagraph(content);
                    } catch {
                        // Ignore read errors
                    }
                }

                nodes.push(node);
            }
        }
    } catch {
        // Directory doesn't exist
    }

    return nodes;
}

/**
 * Extract H1/H2 headings from markdown content
 */
function extractHeadings(content: string): string[] {
    const headings: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const h1Match = line.match(/^# (.+)/);
        const h2Match = line.match(/^## (.+)/);

        if (h1Match) {
            headings.push(h1Match[1].trim());
        } else if (h2Match) {
            headings.push(h2Match[1].trim());
        }
    }

    return headings.slice(0, 5); // Limit to 5 headings
}

/**
 * Extract first meaningful paragraph from markdown
 */
function extractFirstParagraph(content: string): string | undefined {
    const lines = content.split('\n');
    let paragraph = '';
    let inParagraph = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip frontmatter, headings, code blocks, etc.
        if (trimmed.startsWith('---') || trimmed.startsWith('#') ||
            trimmed.startsWith('```') || trimmed.startsWith('import ')) {
            if (inParagraph && paragraph) break;
            continue;
        }

        if (trimmed.length === 0) {
            if (inParagraph && paragraph) break;
            continue;
        }

        inParagraph = true;
        paragraph += (paragraph ? ' ' : '') + trimmed;

        // Limit length
        if (paragraph.length > 150) {
            paragraph = paragraph.slice(0, 147) + '...';
            break;
        }
    }

    return paragraph || undefined;
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
 * Format tree as pipe-delimited index (v1 format)
 */
function formatIndexV1(skill: DetectedSkill, tree: FileNode[], rootDir: string): string {
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
 * Format tree as semantic index (v2 format)
 * Includes headings and breaking change warnings
 */
function formatIndexV2(skill: DetectedSkill, tree: FileNode[], rootDir: string): string {
    const displayName = skill.displayName || skill.name;
    const lines: string[] = [
        `[${displayName} Docs Index]|v${skill.version}|root:./.agent-docs/${skill.name}`,
        `|PREFER retrieval over pre-training for ${displayName} tasks.`,
    ];

    // Add breaking changes for known frameworks
    const breakingChanges = getBreakingChanges(skill.name, skill.version);
    for (const change of breakingChanges) {
        lines.push(`|BREAKING: ${change}`);
    }

    // Add new API highlights
    const newApis = getNewApis(skill.name, skill.version);
    for (const api of newApis.slice(0, 5)) {
        lines.push(`|NEW: ${api}`);
    }

    // Format sections with headings
    for (const node of tree) {
        if (node.isDir && node.children) {
            const sectionPath = relative(rootDir, node.path).replace(/\\/g, '/');
            const files = node.children
                .filter(c => !c.isDir)
                .map(c => c.name.replace(/\.mdx?$/, ''))
                .join(',');

            if (files) {
                lines.push(`|${sectionPath}:{${files}}`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Get breaking changes for a framework version
 */
function getBreakingChanges(framework: string, version: string): string[] {
    const changes: Record<string, Record<string, string[]>> = {
        'nextjs': {
            '15': [
                'cookies()/headers() are now async',
                'fetch() no longer cached by default',
            ],
            '16': [
                'cookies()/headers() are now async',
                'fetch() no longer cached by default',
            ],
        },
        'react': {
            '19': [
                'forwardRef no longer needed',
                'useContext removed, use use() instead',
            ],
        },
    };

    const major = version.split('.')[0];
    return changes[framework]?.[major] || [];
}

/**
 * Get new APIs for a framework version
 */
function getNewApis(framework: string, version: string): string[] {
    const apis: Record<string, Record<string, string[]>> = {
        'nextjs': {
            '15': [
                'after() for post-response work',
                'instrumentation for OpenTelemetry',
            ],
            '16': [
                "connection() for dynamic rendering",
                "'use cache' directive for caching",
                "cacheLife() for custom expiration",
                "cacheTag() for cache invalidation",
                "forbidden()/unauthorized() responses",
            ],
        },
        'react': {
            '19': [
                'use() for promises and context',
                'useOptimistic() for optimistic updates',
                'useActionState() for form actions',
            ],
        },
    };

    const major = version.split('.')[0];
    return apis[framework]?.[major] || [];
}

/**
 * Aggressively compress index to meet target size
 */
function compressAggressively(index: string, skill: DetectedSkill, targetSize: number): string {
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
    while (Buffer.byteLength(compressed, 'utf-8') > targetSize) {
        const lines = compressed.split('\n');
        if (lines.length <= 5) break; // Keep header + instructions + at least some content
        lines.pop();
        compressed = lines.join('\n');
    }

    return compressed;
}

/**
 * Get compression stats
 */
export async function getCompressionStats(skill: DetectedSkill, options: { cwd?: string } = {}): Promise<{
    originalSize: number;
    compressedSize: number;
    reductionPercent: number;
}> {
    const cwd = options.cwd || process.cwd();
    const cacheDir = join(cwd, '.agent-docs', skill.name);
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

    const compressed = await compressIndex(skill, { cwd });
    const compressedSize = Buffer.byteLength(compressed, 'utf-8');

    return {
        originalSize,
        compressedSize,
        reductionPercent: originalSize > 0
            ? Math.round((1 - compressedSize / originalSize) * 100)
            : 0,
    };
}
