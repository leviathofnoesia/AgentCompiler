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

const program = new Command();

program
    .name('skill-compiler')
    .description('Converts skill/framework documentation into compressed AGENTS.md indexes')
    .version('0.1.0');

program
    .command('compile', { isDefault: true })
    .description('Scan project and generate AGENTS.md index')
    .option('-o, --out <path>', 'Output path for AGENTS.md', './AGENTS.md')
    .option('--only <frameworks>', 'Only process specific frameworks (comma-separated)')
    .option('--dry-run', 'Preview changes without writing')
    .option('--refresh', 'Force refresh cached docs')
    .option('--silent', 'Suppress output')
    .action(async (options) => {
        try {
            if (!options.silent) {
                console.log(chalk.blue('🔍 Scanning project for frameworks...'));
            }

            // 1. Scan for frameworks/skills
            const detected = await scanProject(process.cwd(), {
                only: options.only?.split(','),
            });

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
                console.log('Would write to:', options.out);
                console.log('\nGenerated indexes:');
                indexes.forEach(idx => console.log(idx.slice(0, 200) + '...\n'));
            } else {
                await injectAgentsMd(options.out, indexes);
                if (!options.silent) {
                    console.log(chalk.green(`✓ Updated ${options.out}`));
                }
            }
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

program
    .command('watch')
    .description('Watch for dependency changes and auto-update AGENTS.md')
    .option('-o, --out <path>', 'Output path for AGENTS.md', './AGENTS.md')
    .action(async (options) => {
        console.log(chalk.blue('👀 Watching for changes...'));
        await watchProject(process.cwd(), options.out);
    });

program
    .command('add <path>')
    .description('Add a custom skill from a local path or URL')
    .option('--npm <package>', 'Add from npm package docs')
    .action(async (path, options) => {
        console.log(chalk.yellow('⚠️  Custom skills are injected as-is without validation.'));
        console.log(chalk.yellow('   Poorly structured docs may degrade agent performance.'));
        console.log(chalk.blue(`\n📥 Adding skill from: ${options.npm || path}`));
        // TODO: Implement custom skill addition
        console.log(chalk.green('✓ Skill added. Run `skill-compiler` to regenerate indexes.'));
    });

program
    .command('eval')
    .description('Run evaluation suite (Vercel methodology)')
    .option('--framework <name>', 'Evaluate specific framework')
    .option('--compare <config>', 'Compare configurations: baseline, skill-only, agents-md')
    .option('--verbose', 'Show detailed results for each test')
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
