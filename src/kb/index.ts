/**
 * Knowledge Base Management
 * Registers local knowledge sources in .skill-compiler.json
 */

import { existsSync } from 'fs';
import { basename, join } from 'path';
import { loadConfig, saveConfig, type KnowledgeBaseConfig } from '../config/index.js';

export interface AddKnowledgeBaseOptions {
    name?: string;
    include?: string[];
    exclude?: string[];
    priority?: number;
    maxEntries?: number;
}

function toKnowledgeBaseName(source: string): string {
    return basename(source).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

/**
 * Add or replace a knowledge base source.
 */
export async function addKnowledgeBase(
    cwd: string,
    source: string,
    options: AddKnowledgeBaseOptions = {}
): Promise<KnowledgeBaseConfig> {
    const sourcePath = join(cwd, source);
    if (!existsSync(sourcePath)) {
        throw new Error(`Knowledge base path not found: ${source}`);
    }

    const name = options.name || toKnowledgeBaseName(source);
    const config = await loadConfig(cwd);
    const knowledgeBases = config.knowledgeBases || [];

    const nextEntry: KnowledgeBaseConfig = {
        name,
        path: source,
        include: options.include,
        exclude: options.exclude,
        priority: options.priority,
        maxEntries: options.maxEntries,
    };

    config.knowledgeBases = [
        ...knowledgeBases.filter((kb) => kb.name !== name),
        nextEntry,
    ];

    await saveConfig(cwd, config);
    return nextEntry;
}

/**
 * List configured knowledge bases.
 */
export async function listKnowledgeBases(cwd: string): Promise<KnowledgeBaseConfig[]> {
    const config = await loadConfig(cwd);
    return config.knowledgeBases || [];
}

/**
 * Remove a configured knowledge base by name.
 */
export async function removeKnowledgeBase(cwd: string, name: string): Promise<boolean> {
    const config = await loadConfig(cwd);
    const existing = config.knowledgeBases || [];
    const filtered = existing.filter((kb) => kb.name !== name);
    if (filtered.length === existing.length) {
        return false;
    }

    config.knowledgeBases = filtered;
    await saveConfig(cwd, config);
    return true;
}
