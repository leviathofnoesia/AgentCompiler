import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { glob } from 'glob';
import { join, relative, dirname, basename } from 'path';
import type { KnowledgeBaseConfig } from '../../config/index.js';
import type { AdapterResult, KnowledgeAdapter, KnowledgeItem } from '../types.js';

const DEFAULT_INCLUDE = ['**/*.md', '**/*.mdx', '**/*.txt'];

interface KnowledgeEntry {
    relativePath: string;
    title?: string;
}

function normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/');
}

function normalizeRootLabel(pathValue: string): string {
    const normalized = normalizePath(pathValue);
    if (normalized.startsWith('.')) {
        return normalized;
    }
    return `./${normalized}`;
}

async function isRegularFile(path: string): Promise<boolean> {
    try {
        const fileStat = await stat(path);
        return fileStat.isFile();
    } catch {
        return false;
    }
}

async function extractFirstHeading(filePath: string): Promise<string | undefined> {
    try {
        const content = await readFile(filePath, 'utf-8');
        const match = content.match(/^#{1,2}\s+(.+)$/m);
        return match?.[1]?.trim();
    } catch {
        return undefined;
    }
}

async function collectKnowledgeEntries(cwd: string, kb: KnowledgeBaseConfig): Promise<KnowledgeEntry[]> {
    const rootPath = join(cwd, kb.path);
    if (!existsSync(rootPath)) {
        return [];
    }

    const include = kb.include && kb.include.length > 0 ? kb.include : DEFAULT_INCLUDE;
    const exclude = kb.exclude || [];

    let fileList: string[] = [];
    const isSingleFile = await isRegularFile(rootPath);
    if (isSingleFile) {
        fileList = [basename(rootPath)];
    } else {
        for (const pattern of include) {
            const matches = await glob(pattern, {
                cwd: rootPath,
                nodir: true,
                ignore: exclude,
            });
            fileList.push(...matches);
        }
    }

    const uniqueSortedFiles = Array.from(new Set(fileList))
        .map((item) => normalizePath(item))
        .sort((a, b) => a.localeCompare(b));
    const entries = await Promise.all(uniqueSortedFiles.map(async (file) => {
        const fullPath = isSingleFile ? rootPath : join(rootPath, file);
        return {
            relativePath: isSingleFile ? normalizePath(relative(cwd, rootPath)) : file,
            title: await extractFirstHeading(fullPath),
        };
    }));

    return entries;
}

function buildKnowledgeBaseIndex(
    cwd: string,
    kb: KnowledgeBaseConfig,
    entries: KnowledgeEntry[]
): string {
    const rootLabel = normalizeRootLabel(normalizePath(relative(cwd, join(cwd, kb.path))));
    const lines = [
        `[${kb.name} Knowledge Base]|root: ${rootLabel}`,
        `|IMPORTANT: Treat this as project-specific source of truth for ${kb.name}.`,
    ];

    const byDir = new Map<string, string[]>();
    for (const entry of entries) {
        const dir = normalizePath(dirname(entry.relativePath));
        const key = dir === '.' ? '{root}' : dir;
        const list = byDir.get(key) || [];
        list.push(basename(entry.relativePath));
        byDir.set(key, list);
    }

    for (const [dir, files] of Array.from(byDir.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`|${dir}:{${files.join(',')}}`);
    }

    const headingEntries = entries
        .filter((entry) => !!entry.title)
        .slice(0, 8);
    for (const entry of headingEntries) {
        lines.push(`|${entry.relativePath}#${entry.title}`);
    }

    return lines.join('\n');
}

export const knowledgeBaseAdapter: KnowledgeAdapter = {
    id: 'knowledge-base',
    async collect(context): Promise<AdapterResult> {
        if (context.config.sources?.knowledgeBases === false) {
            return { items: [] };
        }

        const configured = context.config.knowledgeBases || [];
        if (configured.length === 0) {
            return { items: [] };
        }

        const items: KnowledgeItem[] = [];
        for (const kb of configured) {
            const entries = await collectKnowledgeEntries(context.cwd, kb);
            if (entries.length === 0) continue;

            const limitedEntries = entries.slice(0, kb.maxEntries || 80);
            const content = buildKnowledgeBaseIndex(context.cwd, kb, limitedEntries);
            items.push({
                id: `kb:${kb.name}`,
                kind: 'knowledge-base-index' as const,
                adapter: 'knowledge-base',
                name: kb.name,
                content,
                priority: kb.priority ?? 80,
                tags: ['knowledge-base', kb.name],
                metadata: {
                    path: kb.path,
                    entries: limitedEntries.length,
                },
            });
        }

        return { items };
    }
};
