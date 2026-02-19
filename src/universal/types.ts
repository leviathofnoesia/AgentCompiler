import type { SkillCompilerConfig } from '../config/index.js';
import type { DetectedSkill } from '../scanner/index.js';

export type KnowledgeKind =
    | 'framework-index'
    | 'skills-sh-index'
    | 'knowledge-base-index';

export interface KnowledgeItem {
    id: string;
    kind: KnowledgeKind;
    adapter: string;
    name: string;
    content: string;
    priority: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
}

export interface AdapterContext {
    cwd: string;
    config: SkillCompilerConfig;
    options: {
        only?: string[];
        exclude?: string[];
        refresh?: boolean;
        includeSkillsSh?: boolean;
    };
}

export interface AdapterResult {
    items: KnowledgeItem[];
    detected?: DetectedSkill[];
}

export interface KnowledgeAdapter {
    id: string;
    collect(context: AdapterContext): Promise<AdapterResult>;
}

export interface ComposePolicy {
    maxBytes?: number;
}

export interface ComposeResult {
    items: KnowledgeItem[];
    dropped: number;
    totalBytes: number;
}
