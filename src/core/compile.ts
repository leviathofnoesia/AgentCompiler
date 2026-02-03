/**
 * Core compile pipeline
 * Orchestrates scanning, fetching, compressing, syncing, and injecting indexes.
 */

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { scanProject, type DetectedSkill } from '../scanner/index.js';
import { fetchDocs } from '../fetcher/index.js';
import { compressIndex } from '../compressor/index.js';
import { injectAgentsMd } from '../injector/index.js';
import { syncSkillsToAgentsMd } from '../skills-sh/index.js';

export interface CompileOptions {
    cwd: string;
    outPath: string;
    only?: string[];
    exclude?: string[];
    refresh?: boolean;
    dryRun?: boolean;
    check?: boolean;
    includeSkillsSh?: boolean;
    silent?: boolean;
}

export interface CompileResult {
    detected: DetectedSkill[];
    indexes: string[];
    skillsShIndexes: string[];
    allIndexes: string[];
    outPath: string;
    status: 'no-skills' | 'dry-run' | 'checked' | 'written';
    checkStatus?: 'up-to-date' | 'missing' | 'out-of-date';
}

export async function compileProject(options: CompileOptions): Promise<CompileResult> {
    const {
        cwd,
        outPath,
        only,
        exclude,
        refresh,
        dryRun,
        check,
        includeSkillsSh = true,
        silent,
    } = options;

    const log = (message: string) => {
        if (!silent) {
            console.log(message);
        }
    };

    log(chalk.blue('🔍 Scanning project for frameworks...'));

    const detectedRaw = await scanProject(cwd, { only });
    const detected = exclude && exclude.length > 0
        ? detectedRaw.filter(skill => !exclude.includes(skill.name))
        : detectedRaw;

    if (detected.length === 0) {
        log(chalk.yellow('No frameworks detected. Nothing to do.'));
        return {
            detected,
            indexes: [],
            skillsShIndexes: [],
            allIndexes: [],
            outPath,
            status: 'no-skills',
        };
    }

    log(chalk.green(`✓ Found ${detected.length} framework(s): ${detected.map(skill => skill.name).join(', ')}`));

    for (const skill of detected) {
        log(chalk.blue(`📥 Fetching docs for ${skill.name}@${skill.version}...`));
        await fetchDocs(skill, { refresh, cwd });
    }

    log(chalk.blue('📦 Compressing documentation indexes...'));
    const indexes = await Promise.all(detected.map(skill => compressIndex(skill, { cwd })));

    const skillsShIndexes = includeSkillsSh ? await syncSkillsToAgentsMd(cwd) : [];
    if (includeSkillsSh && skillsShIndexes.length > 0) {
        log(chalk.blue(`📦 Including ${skillsShIndexes.length} skills.sh skill(s)...`));
    }

    const allIndexes = [...indexes, ...skillsShIndexes];

    if (dryRun) {
        log(chalk.yellow('\n--- DRY RUN ---'));
        log(`Would write to: ${outPath}`);
        log('\nGenerated indexes:');
        allIndexes.forEach(idx => log(`${idx.slice(0, 200)}...\n`));
        return {
            detected,
            indexes,
            skillsShIndexes,
            allIndexes,
            outPath,
            status: 'dry-run',
        };
    }

    if (check) {
        if (!existsSync(outPath)) {
            log(chalk.red('✗ AGENTS.md does not exist'));
            return {
                detected,
                indexes,
                skillsShIndexes,
                allIndexes,
                outPath,
                status: 'checked',
                checkStatus: 'missing',
            };
        }

        const current = await readFile(outPath, 'utf-8');
        const expected = allIndexes.join('\n\n');

        if (!current.includes(expected.slice(0, 100))) {
            log(chalk.red('✗ AGENTS.md is out of date'));
            log(chalk.dim('Run `skill-compiler` to update'));
            return {
                detected,
                indexes,
                skillsShIndexes,
                allIndexes,
                outPath,
                status: 'checked',
                checkStatus: 'out-of-date',
            };
        }

        log(chalk.green('✓ AGENTS.md is up to date'));
        return {
            detected,
            indexes,
            skillsShIndexes,
            allIndexes,
            outPath,
            status: 'checked',
            checkStatus: 'up-to-date',
        };
    }

    await injectAgentsMd(outPath, allIndexes);
    log(chalk.green(`✓ Updated ${outPath}`));

    return {
        detected,
        indexes,
        skillsShIndexes,
        allIndexes,
        outPath,
        status: 'written',
    };
}
