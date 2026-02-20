/**
 * Compile Orchestrator
 * Thin wrapper around universal compile orchestration via compileKnowledge().
 */

import { type SkillCompilerConfig } from '../config/index.js';
import { type DetectedSkill } from '../scanner/index.js';
import { compileKnowledge } from '../universal/compile.js';

export interface CompileOptions {
    cwd?: string;
    only?: string[];
    exclude?: string[];
    refresh?: boolean;
    includeSkillsSh?: boolean;
}

export interface CompileResult {
    config: SkillCompilerConfig;
    detected: DetectedSkill[];
    indexes: string[];
    knowledgeBaseIndexes: string[];
    skillsShIndexes: string[];
    allIndexes: string[];
    dropped: number;
}

export async function compileProject(options: CompileOptions = {}): Promise<CompileResult> {
    const cwd = options.cwd || process.cwd();
    const compiled = await compileKnowledge({
        cwd,
        only: options.only,
        exclude: options.exclude,
        refresh: options.refresh,
        includeSkillsSh: options.includeSkillsSh,
    });

    return {
        config: compiled.config,
        detected: compiled.detected,
        indexes: compiled.indexes,
        knowledgeBaseIndexes: compiled.knowledgeBaseIndexes,
        skillsShIndexes: compiled.skillsShIndexes,
        allIndexes: compiled.allIndexes,
        dropped: compiled.dropped,
    };
}
