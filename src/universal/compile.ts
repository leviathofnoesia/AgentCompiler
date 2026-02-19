import { loadConfig, type SkillCompilerConfig } from '../config/index.js';
import type { DetectedSkill } from '../scanner/index.js';
import { composeKnowledge } from './compose.js';
import type { AdapterContext, KnowledgeItem } from './types.js';
import { frameworkDocsAdapter } from './adapters/framework.js';
import { knowledgeBaseAdapter } from './adapters/knowledge-base.js';
import { skillsShAdapter } from './adapters/skills-sh.js';

export interface UniversalCompileOptions {
    cwd?: string;
    config?: SkillCompilerConfig;
    only?: string[];
    exclude?: string[];
    refresh?: boolean;
    includeSkillsSh?: boolean;
    maxBytes?: number;
}

export interface UniversalCompileResult {
    config: SkillCompilerConfig;
    items: KnowledgeItem[];
    allIndexes: string[];
    detected: DetectedSkill[];
    indexes: string[];
    knowledgeBaseIndexes: string[];
    skillsShIndexes: string[];
    dropped: number;
}

/**
 * Universal compile pipeline:
 * adapters -> compose -> render
 */
export async function compileKnowledge(options: UniversalCompileOptions = {}): Promise<UniversalCompileResult> {
    const cwd = options.cwd || process.cwd();
    const config = options.config || await loadConfig(cwd);
    const context: AdapterContext = {
        cwd,
        config,
        options: {
            only: options.only ?? config.only,
            exclude: options.exclude ?? config.exclude,
            refresh: options.refresh,
            includeSkillsSh: options.includeSkillsSh,
        },
    };

    const frameworkResult = await frameworkDocsAdapter.collect(context);
    const knowledgeBaseResult = await knowledgeBaseAdapter.collect(context);
    const skillsShResult = await skillsShAdapter.collect(context);

    const allItems = [
        ...frameworkResult.items,
        ...knowledgeBaseResult.items,
        ...skillsShResult.items,
    ];

    const composed = composeKnowledge(allItems, {
        maxBytes: options.maxBytes,
    });

    const allIndexes = composed.items.map((item) => item.content);

    return {
        config,
        items: composed.items,
        allIndexes,
        detected: frameworkResult.detected || [],
        indexes: composed.items
            .filter((item) => item.kind === 'framework-index')
            .map((item) => item.content),
        knowledgeBaseIndexes: composed.items
            .filter((item) => item.kind === 'knowledge-base-index')
            .map((item) => item.content),
        skillsShIndexes: composed.items
            .filter((item) => item.kind === 'skills-sh-index')
            .map((item) => item.content),
        dropped: composed.dropped,
    };
}
