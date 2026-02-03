/**
 * Compile Orchestrator
 * Shared pipeline for scanning, fetching, and compressing docs
 */

import { loadConfig, type SkillCompilerConfig } from '../config/index.js';
import { scanProject, type DetectedSkill } from '../scanner/index.js';
import { fetchDocs } from '../fetcher/index.js';
import { compressIndex } from '../compressor/index.js';
import { syncSkillsToAgentsMd } from '../skills-sh/index.js';

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
    skillsShIndexes: string[];
    allIndexes: string[];
}

export async function compileProject(options: CompileOptions = {}): Promise<CompileResult> {
    const cwd = options.cwd || process.cwd();
    const config = await loadConfig(cwd);
    const only = options.only ?? config.only;
    const exclude = options.exclude ?? config.exclude;

    const detected = await scanProject(cwd, {
        only,
        exclude,
        customSkills: config.customSkills,
        conflicts: config.conflicts,
    });

    for (const skill of detected) {
        await fetchDocs(skill, {
            refresh: options.refresh,
            cwd,
            cacheTtlHours: config.cacheTtlHours,
        });
    }

    const indexes = await Promise.all(detected.map(skill => compressIndex(skill, {
        cwd,
        format: config.compression?.format,
        targetSize: config.compression?.targetSize,
        conflicts: config.conflicts,
    })));

    const skillsShIndexes = options.includeSkillsSh === false
        ? []
        : await syncSkillsToAgentsMd(cwd);

    return {
        config,
        detected,
        indexes,
        skillsShIndexes,
        allIndexes: [...indexes, ...skillsShIndexes],
    };
}
