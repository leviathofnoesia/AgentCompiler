#!/usr/bin/env node
/**
 * skill-compiler CLI
 * Converts skill/framework documentation into compressed AGENTS.md indexes
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { scanProject } from './scanner/index.js';
import { fetchDocs } from './fetcher/index.js';
import { compressIndex } from './compressor/index.js';
import { injectAgentsMd } from './injector/index.js';
import { watchProject } from './watcher/index.js';
import { loadConfig, saveConfig, configExists, createInitialConfig } from './config/index.js';
import { addCustomSkill, listCustomSkills, removeCustomSkill } from './custom/index.js';

const program = new Command();

program
    .name('skill-compiler')
    .description('Converts skill/framework documentation into compressed AGENTS.md indexes')
    .version('0.2.0');

// ============================================================================
// INIT COMMAND
// ============================================================================
program
    .command('init')
    .description('Initialize skill-compiler configuration')
    .option('-o, --out <path>', 'Output path for AGENTS.md', './AGENTS.md')
    .option('--only <frameworks>', 'Only process specific frameworks (comma-separated)')
    .option('--force', 'Overwrite existing config')
    .action(async (options) => {
        const cwd = process.cwd();

        if (configExists(cwd) && !options.force) {
            console.log(chalk.yellow('Config file already exists. Use --force to overwrite.'));
            return;
        }

        const config = createInitialConfig({
            out: options.out,
            frameworks: options.only?.split(','),
        });

        await saveConfig(cwd, config);
        console.log(chalk.green('✓ Created .skill-compiler.json'));
        console.log(chalk.dim('\nRun `skill-compiler` to generate AGENTS.md'));
    });

// ============================================================================
// COMPILE COMMAND (default)
// ============================================================================
program
    .command('compile', { isDefault: true })
    .description('Scan project and generate AGENTS.md index')
    .option('-o, --out <path>', 'Output path for AGENTS.md')
    .option('--only <frameworks>', 'Only process specific frameworks (comma-separated)')
    .option('--dry-run', 'Preview changes without writing')
    .option('--refresh', 'Force refresh cached docs')
    .option('--silent', 'Suppress output')
    .option('--check', 'Check if AGENTS.md is up-to-date (for CI)')
    .action(async (options) => {
        try {
            const cwd = process.cwd();

            // Load config (CLI options override config)
            const config = await loadConfig(cwd);
            const outPath = options.out || config.out || './AGENTS.md';
            const only = options.only?.split(',') || config.only;

            if (!options.silent) {
                console.log(chalk.blue('🔍 Scanning project for frameworks...'));
            }

            // 1. Scan for frameworks/skills
            const detected = await scanProject(cwd, { only });

            if (detected.length === 0) {
                console.log(chalk.yellow('No frameworks detected. Nothing to do.'));
                return;
            }

            if (!options.silent) {
                console.log(chalk.green(`✓ Found ${detected.length} framework(s): ${detected.map(d => d.name).join(', ')}`));
            }

            // 2. Fetch docs for each framework
            for (const skill of detected) {
                if (!options.silent) {
                    console.log(chalk.blue(`📥 Fetching docs for ${skill.name}@${skill.version}...`));
                }
                await fetchDocs(skill, { refresh: options.refresh });
            }

            // 3. Compress into indexes
            if (!options.silent) {
                console.log(chalk.blue('📦 Compressing documentation indexes...'));
            }
            const indexes = await Promise.all(detected.map(compressIndex));

            // 4. Inject into AGENTS.md
            if (options.dryRun) {
                console.log(chalk.yellow('\n--- DRY RUN ---'));
                console.log('Would write to:', outPath);
                console.log('\nGenerated indexes:');
                indexes.forEach(idx => console.log(idx.slice(0, 200) + '...\n'));
            } else if (options.check) {
                // Check mode: verify AGENTS.md is up-to-date
                const { readFile } = await import('fs/promises');
                const { existsSync } = await import('fs');

                if (!existsSync(outPath)) {
                    console.log(chalk.red('✗ AGENTS.md does not exist'));
                    process.exit(1);
                }

                const current = await readFile(outPath, 'utf-8');
                const expected = indexes.join('\n\n');

                if (!current.includes(expected.slice(0, 100))) {
                    console.log(chalk.red('✗ AGENTS.md is out of date'));
                    console.log(chalk.dim('Run `skill-compiler` to update'));
                    process.exit(1);
                }

                console.log(chalk.green('✓ AGENTS.md is up to date'));
            } else {
                await injectAgentsMd(outPath, indexes);
                if (!options.silent) {
                    console.log(chalk.green(`✓ Updated ${outPath}`));
                }
            }
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// WATCH COMMAND
// ============================================================================
program
    .command('watch')
    .description('Watch for dependency changes and auto-update AGENTS.md')
    .option('-o, --out <path>', 'Output path for AGENTS.md')
    .action(async (options) => {
        const cwd = process.cwd();
        const config = await loadConfig(cwd);
        const outPath = options.out || config.out || './AGENTS.md';

        console.log(chalk.blue('👀 Watching for changes...'));
        await watchProject(cwd, outPath);
    });

// ============================================================================
// ADD COMMAND
// ============================================================================
program
    .command('add <path>')
    .description('Add a custom skill from a local path')
    .option('-n, --name <name>', 'Name for the custom skill')
    .option('--priority <sections>', 'Priority sections (comma-separated)')
    .action(async (path, options) => {
        console.log(chalk.yellow('⚠️  Custom skills are injected as-is without validation.'));
        console.log(chalk.yellow('   Poorly structured docs may degrade agent performance.'));
        console.log(chalk.blue(`\n📥 Adding skill from: ${path}`));

        try {
            const result = await addCustomSkill(process.cwd(), path, {
                name: options.name,
                priority: options.priority?.split(','),
            });

            console.log(chalk.green(`✓ Added skill "${result.name}" (${result.fileCount} files)`));
            console.log(chalk.dim('Run `skill-compiler` to regenerate indexes.'));
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

// ============================================================================
// LIST COMMAND
// ============================================================================
program
    .command('list')
    .description('List all custom skills')
    .action(async () => {
        const skills = await listCustomSkills(process.cwd());

        if (skills.length === 0) {
            console.log(chalk.dim('No custom skills configured.'));
            console.log(chalk.dim('Use `skill-compiler add <path>` to add one.'));
            return;
        }

        console.log(chalk.bold('Custom Skills:\n'));
        for (const skill of skills) {
            console.log(`  ${chalk.green('•')} ${skill.name}`);
            console.log(chalk.dim(`    Path: ${skill.path}`));
            if (skill.priority) {
                console.log(chalk.dim(`    Priority: ${skill.priority.join(', ')}`));
            }
        }
    });

// ============================================================================
// REMOVE COMMAND
// ============================================================================
program
    .command('remove <name>')
    .description('Remove a custom skill')
    .action(async (name) => {
        const removed = await removeCustomSkill(process.cwd(), name);

        if (removed) {
            console.log(chalk.green(`✓ Removed skill "${name}"`));
            console.log(chalk.dim('Run `skill-compiler` to regenerate indexes.'));
        } else {
            console.log(chalk.yellow(`Skill "${name}" not found.`));
        }
    });

// ============================================================================
// EVAL COMMAND
// ============================================================================
program
    .command('eval')
    .description('Run evaluation suite (Vercel methodology)')
    .option('--framework <name>', 'Evaluate specific framework')
    .option('--compare <config>', 'Compare configurations: baseline, skill-only, agents-md')
    .option('--verbose', 'Show detailed results for each test')
    .option('--simulate', 'Use simulated results (no API key required)')
    .action(async (options) => {
        const { runEval } = await import('./eval/index.js');

        console.log(chalk.blue('🧪 Running evaluation suite (Vercel methodology)...'));
        console.log(chalk.dim('Using Build/Lint/Test metrics to measure agent effectiveness\n'));

        try {
            await runEval(process.cwd(), {
                framework: options.framework,
                compare: options.compare,
                verbose: options.verbose,
            });
        } catch (error) {
            console.error(chalk.red('Eval error:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

program.parse();
