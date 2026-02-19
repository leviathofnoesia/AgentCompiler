#!/usr/bin/env node
/**
 * skill-compiler CLI
 * Converts skill/framework documentation into compressed AGENTS.md indexes
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { injectAgentsMd } from './injector/index.js';
import { watchProject } from './watcher/index.js';
import { loadConfig, saveConfig, configExists, createInitialConfig } from './config/index.js';
import { addCustomSkill, listCustomSkills, removeCustomSkill } from './custom/index.js';
import { addKnowledgeBase, listKnowledgeBases, removeKnowledgeBase } from './kb/index.js';
import { compileProject } from './core/compile.js';
import { scanProject } from './scanner/index.js';
import {
    searchSkills,
    installSkill,
    uninstallSkill,
    scanLocalSkills,
    getSuggestedSkills,
    syncSkillsToAgentsMd
} from './skills-sh/index.js';
import { runEval, runComprehensiveEval, getCompressionStats, printDetailedResults, generateEvalReport, type EvalOptions } from './eval/index.js';

const program = new Command();

program
    .name('skill-compiler')
    .description('Converts skill/framework documentation into compressed AGENTS.md indexes')
    .version('0.3.0');

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
        try {
            const cwd = process.cwd();

            if (configExists(cwd) && !options.force) {
                console.log(chalk.yellow('⚠️  Config file already exists.'));
                console.log(chalk.dim('Use --force to overwrite: skill-compiler init --force'));
                return;
            }

            const config = createInitialConfig({
                out: options.out,
                frameworks: options.only?.split(','),
            });

            await saveConfig(cwd, config);
            console.log(chalk.green('✓ Created .skill-compiler.json'));
            console.log(chalk.dim('\nRun `skill-compiler` to generate AGENTS.md'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to initialize configuration:'));
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
        }
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
            const exclude = config.exclude;

            if (!options.silent) {
                console.log(chalk.blue('🔍 Scanning project for frameworks...'));
            }

            // 1. Scan for frameworks/skills
            const compileResult = await compileProject({
                cwd,
                only,
                exclude,
                refresh: options.refresh,
            });
            const detected = compileResult.detected;

            if (detected.length === 0 && compileResult.allIndexes.length === 0) {
                console.log(chalk.yellow('No frameworks or knowledge sources detected. Nothing to do.'));
                return;
            }

            if (!options.silent) {
                if (detected.length > 0) {
                    console.log(chalk.green(`✓ Found ${detected.length} framework(s): ${detected.map(d => d.name).join(', ')}`));
                } else {
                    console.log(chalk.green('✓ No framework docs detected; compiling configured knowledge sources.'));
                }
            }

            if (!options.silent) {
                console.log(chalk.blue('📥 Fetching docs for detected frameworks...'));
                console.log(chalk.blue('📦 Compressing documentation indexes...'));
            }
            const allIndexes = compileResult.allIndexes;
            if (compileResult.skillsShIndexes.length > 0 && !options.silent) {
                console.log(chalk.blue(`📦 Including ${compileResult.skillsShIndexes.length} skills.sh skill(s)...`));
            }
            if (compileResult.knowledgeBaseIndexes.length > 0 && !options.silent) {
                console.log(chalk.blue(`🧠 Including ${compileResult.knowledgeBaseIndexes.length} knowledge base(s)...`));
            }
            if ((compileResult.dropped || 0) > 0 && !options.silent) {
                console.log(chalk.yellow(`⚠️  Dropped ${compileResult.dropped} duplicate/over-budget item(s) during composition.`));
            }

            // 2. Inject into AGENTS.md
            if (options.dryRun) {
                console.log(chalk.yellow('\n--- DRY RUN ---'));
                console.log('Would write to:', outPath);
                console.log('\nGenerated indexes:');
                allIndexes.forEach(idx => console.log(idx.slice(0, 200) + '...\n'));
            } else if (options.check) {
                // Check mode: verify AGENTS.md is up-to-date
                const { readFile } = await import('fs/promises');
                const { existsSync } = await import('fs');

                if (!existsSync(outPath)) {
                    console.log(chalk.red('✗ AGENTS.md does not exist'));
                    process.exit(1);
                }

                const current = await readFile(outPath, 'utf-8');
                const expected = allIndexes.join('\n\n');

                if (!current.includes(expected.slice(0, 100))) {
                    console.log(chalk.red('✗ AGENTS.md is out of date'));
                    console.log(chalk.dim('Run `skill-compiler` to update'));
                    process.exit(1);
                }

                console.log(chalk.green('✓ AGENTS.md is up to date'));
            } else {
                await injectAgentsMd(outPath, allIndexes);
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
// ADD COMMAND (local skills)
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
    .description('List all custom and installed skills')
    .action(async () => {
        const cwd = process.cwd();

        // List custom skills
        const customSkills = await listCustomSkills(cwd);

        // List skills.sh skills
        const skillsShSkills = await scanLocalSkills(cwd);
        const knowledgeBases = await listKnowledgeBases(cwd);

        if (customSkills.length === 0 && skillsShSkills.length === 0 && knowledgeBases.length === 0) {
            console.log(chalk.dim('No skills configured.'));
            console.log(chalk.dim('Use `skill-compiler install <repo>` to add from skills.sh'));
            console.log(chalk.dim('Use `skill-compiler add <path>` to add local skills'));
            console.log(chalk.dim('Use `skill-compiler kb-add <path>` to add a local knowledge base'));
            return;
        }

        if (customSkills.length > 0) {
            console.log(chalk.bold('Custom Skills:\n'));
            for (const skill of customSkills) {
                console.log(`  ${chalk.green('•')} ${skill.name}`);
                console.log(chalk.dim(`    Path: ${skill.path}`));
                if (skill.priority) {
                    console.log(chalk.dim(`    Priority: ${skill.priority.join(', ')}`));
                }
            }
        }

        if (skillsShSkills.length > 0) {
            console.log(chalk.bold('\nskills.sh Skills:\n'));
            for (const skill of skillsShSkills) {
                console.log(`  ${chalk.blue('•')} ${skill.name}`);
                if (skill.description) {
                    console.log(chalk.dim(`    ${skill.description}`));
                }
                console.log(chalk.dim(`    Path: ${skill.path}`));
            }
        }

        if (knowledgeBases.length > 0) {
            console.log(chalk.bold('\nKnowledge Bases:\n'));
            for (const kb of knowledgeBases) {
                console.log(`  ${chalk.magenta('•')} ${kb.name}`);
                console.log(chalk.dim(`    Path: ${kb.path}`));
                if (kb.priority !== undefined) {
                    console.log(chalk.dim(`    Priority: ${kb.priority}`));
                }
                if (kb.maxEntries !== undefined) {
                    console.log(chalk.dim(`    Max Entries: ${kb.maxEntries}`));
                }
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
// KNOWLEDGE BASE COMMANDS
// ============================================================================
program
    .command('kb-add <path>')
    .description('Add a local knowledge base (markdown/text docs) to be injected into AGENTS.md')
    .option('-n, --name <name>', 'Knowledge base name')
    .option('--include <patterns>', 'Include globs (comma-separated)')
    .option('--exclude <patterns>', 'Exclude globs (comma-separated)')
    .option('--priority <number>', 'Sort priority (higher appears earlier)')
    .option('--max-entries <number>', 'Max files to index for this knowledge base')
    .action(async (path, options) => {
        try {
            const kb = await addKnowledgeBase(process.cwd(), path, {
                name: options.name,
                include: options.include?.split(',').map((s: string) => s.trim()).filter(Boolean),
                exclude: options.exclude?.split(',').map((s: string) => s.trim()).filter(Boolean),
                priority: options.priority ? parseInt(options.priority, 10) : undefined,
                maxEntries: options.maxEntries ? parseInt(options.maxEntries, 10) : undefined,
            });

            console.log(chalk.green(`✓ Added knowledge base "${kb.name}"`));
            console.log(chalk.dim(`  Path: ${kb.path}`));
            console.log(chalk.dim('Run `skill-compiler` to include it in AGENTS.md.'));
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

program
    .command('kb-list')
    .description('List configured knowledge bases')
    .action(async () => {
        const knowledgeBases = await listKnowledgeBases(process.cwd());
        if (knowledgeBases.length === 0) {
            console.log(chalk.dim('No knowledge bases configured.'));
            console.log(chalk.dim('Use `skill-compiler kb-add <path>` to add one.'));
            return;
        }

        console.log(chalk.bold('Knowledge Bases:\n'));
        for (const kb of knowledgeBases) {
            console.log(`  ${chalk.magenta('•')} ${kb.name}`);
            console.log(chalk.dim(`    Path: ${kb.path}`));
            if (kb.priority !== undefined) {
                console.log(chalk.dim(`    Priority: ${kb.priority}`));
            }
            if (kb.maxEntries !== undefined) {
                console.log(chalk.dim(`    Max Entries: ${kb.maxEntries}`));
            }
        }
    });

program
    .command('kb-remove <name>')
    .description('Remove a configured knowledge base')
    .action(async (name) => {
        const removed = await removeKnowledgeBase(process.cwd(), name);
        if (!removed) {
            console.log(chalk.yellow(`Knowledge base "${name}" not found.`));
            return;
        }
        console.log(chalk.green(`✓ Removed knowledge base "${name}"`));
    });

// ============================================================================
// SEARCH COMMAND (skills.sh)
// ============================================================================
program
    .command('search <query>')
    .description('Search skills.sh registry')
    .action(async (query) => {
        console.log(chalk.blue(`🔍 Searching skills.sh for "${query}"...\n`));

        const results = await searchSkills(query);

        if (results.length === 0) {
            console.log(chalk.yellow('No skills found.'));
            console.log(chalk.dim('Try a broader search term or browse https://skills.sh'));
            return;
        }

        console.log(chalk.bold('Results:\n'));
        for (const skill of results) {
            console.log(`  ${chalk.green('•')} ${chalk.bold(skill.name)}`);
            if (skill.description) {
                console.log(chalk.dim(`    ${skill.description}`));
            }
            console.log(chalk.dim(`    Repo: ${skill.repo}`));
            if (skill.downloads) {
                console.log(chalk.dim(`    Downloads: ${skill.downloads.toLocaleString()}`));
            }
            console.log();
        }

        console.log(chalk.dim(`Install with: skill-compiler install ${results[0].repo} --skill ${results[0].name}`));
    });

// ============================================================================
// INSTALL COMMAND (skills.sh)
// ============================================================================
program
    .command('install <repo>')
    .description('Install a skill from skills.sh registry')
    .option('-s, --skill <name>', 'Specific skill name to install')
    .option('--global', 'Install globally instead of project-local')
    .action(async (repo, options) => {
        console.log(chalk.blue(`📥 Installing skill from ${repo}...`));

        if (options.skill) {
            console.log(chalk.dim(`  Skill: ${options.skill}`));
        }

        const result = await installSkill(repo, {
            skillName: options.skill,
            scope: options.global ? 'global' : 'project',
        });

        if (result.success) {
            console.log(chalk.green(`✓ Installed skill`));
            if (result.skill) {
                console.log(chalk.dim(`  Name: ${result.skill.name}`));
                console.log(chalk.dim(`  Path: ${result.skill.path}`));
            }
            console.log(chalk.dim('\nRun `skill-compiler` to include in AGENTS.md'));
        } else {
            console.error(chalk.red('Installation failed:'), result.error);
            process.exit(1);
        }
    });

// ============================================================================
// UNINSTALL COMMAND
// ============================================================================
program
    .command('uninstall <name>')
    .description('Uninstall a skill (remove from .agent/skills)')
    .option('--dry-run', 'Show what would be removed without executing')
    .action(async (name, options) => {
        if (options.dryRun) {
            console.log(chalk.yellow('⚠️  Dry run: No files will be deleted.'));
        }
        console.log(chalk.blue(`🗑️  Uninstalling skill "${name}"...`));

        const result = await uninstallSkill(name, { dryRun: options.dryRun });

        if (result.success) {
            if (options.dryRun) {
                console.log(chalk.green(`✓ Would remove: ${result.deleted?.join(', ')}`));
            } else {
                console.log(chalk.green(`✓ Uninstalled skill "${name}"`));
                console.log(chalk.dim('Run `skill-compiler` to update AGENTS.md'));
            }
        } else {
            console.error(chalk.red('Uninstall failed:'), result.error);
            process.exit(1);
        }
    });

// ============================================================================
// SYNC COMMAND (skills.sh)
// ============================================================================
program
    .command('sync')
    .description('Sync installed skills.sh skills to AGENTS.md')
    .action(async () => {
        const cwd = process.cwd();

        console.log(chalk.blue('🔄 Syncing skills.sh skills...'));

        const skills = await scanLocalSkills(cwd);

        if (skills.length === 0) {
            console.log(chalk.yellow('No skills.sh skills found.'));
            console.log(chalk.dim('Install with: skill-compiler install <repo>'));
            return;
        }

        console.log(chalk.green(`✓ Found ${skills.length} skill(s)`));
        for (const skill of skills) {
            console.log(chalk.dim(`  • ${skill.name}`));
        }

        const indexes = await syncSkillsToAgentsMd(cwd);
        console.log(chalk.green(`✓ Generated ${indexes.length} index(es)`));
        console.log(chalk.dim('\nRun `skill-compiler` to update AGENTS.md'));
    });

// ============================================================================
// SUGGEST COMMAND (skills.sh)
// ============================================================================
program
    .command('suggest')
    .description('Suggest skills.sh skills based on your project')
    .action(async () => {
        const cwd = process.cwd();

        console.log(chalk.blue('🔍 Analyzing project for skill suggestions...\n'));

        const detected = await scanProject(cwd);
        const frameworks = detected.map(d => d.name);

        if (frameworks.length === 0) {
            console.log(chalk.yellow('No frameworks detected.'));
            return;
        }

        console.log(chalk.dim(`Detected: ${frameworks.join(', ')}\n`));

        const suggestions = getSuggestedSkills(frameworks);

        if (suggestions.length === 0) {
            console.log(chalk.yellow('No skill suggestions available for your stack.'));
            console.log(chalk.dim('Browse https://skills.sh for more options.'));
            return;
        }

        console.log(chalk.bold('Suggested Skills:\n'));
        for (const skill of suggestions) {
            console.log(`  ${chalk.green('•')} ${chalk.bold(skill.name)}`);
            if (skill.description) {
                console.log(chalk.dim(`    ${skill.description}`));
            }
            console.log(chalk.dim(`    Install: skill-compiler install ${skill.repo} --skill ${skill.name}`));
            console.log();
        }
    });

// ============================================================================
// EVAL COMMAND
// ============================================================================
program
    .command('eval')
    .description('Run Vercel-methodology evaluation suite')
    .option('-f, --framework <framework>', 'Specific framework to evaluate (nextjs, react, etc.)')
    .option('-c, --compare <config>', 'Configuration to compare (baseline, skill-only, agents-md)', 'agents-md')
    .option('-m, --model <model>', 'LLM model to use (gpt-4o, gpt-4, etc.)', 'gpt-4o')
    .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, google, etc.)', 'openai')
    .option('--api-key <key>', 'OpenAI API key')
    .option('--simulate', 'Use simulated results (no API key needed)')
    .option('--iterations <count>', 'Number of iterations per test', '3')
    .option('--timeout <seconds>', 'Timeout in seconds', '60')
    .option('--output <path>', 'Output file path for results')
    .option('--refresh-indexes', 'Refresh cached docs/indexes before eval')
    .option('--verbose', 'Show detailed progress')
    .action(async (options) => {
        const cwd = process.cwd();

        if (!options.simulate && !options.apiKey && !process.env.OPENAI_API_KEY) {
            console.log(chalk.yellow('⚠️  No API key provided. Running in simulation mode.'));
            console.log(chalk.dim('Set OPENAI_API_KEY or use --api-key for real evals.'));
        }

        const evalOptions: EvalOptions = {
            framework: options.framework,
            compare: options.compare as 'baseline' | 'skill-only' | 'agents-md',
            model: options.model,
            provider: options.provider,
            apiKey: options.apiKey || process.env.OPENAI_API_KEY,
            simulate: options.simulate,
            iterations: parseInt(options.iterations),
            timeout: parseInt(options.timeout),
            output: options.output,
            verbose: options.verbose,
            refreshIndexes: options.refreshIndexes,
        };

        try {
            const result = await runEval(evalOptions);
            
            if (options.output) {
                console.log(chalk.green(`✓ Results saved to: ${options.output}`));
            }

            // Print detailed results
            printDetailedResults([result]);
        } catch (error) {
            console.error(chalk.red('Evaluation failed:'), error);
            process.exit(1);
        }
    });

// ============================================================================
// COMPREHENSIVE EVAL COMMAND
// ============================================================================
program
    .command('eval:comprehensive')
    .description('Run comprehensive evaluation suite for all detected frameworks')
    .option('-m, --model <model>', 'LLM model to use (gpt-4o, gpt-4, etc.)', 'gpt-4o')
    .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, google, etc.)', 'openai')
    .option('--api-key <key>', 'OpenAI API key')
    .option('--simulate', 'Use simulated results (no API key needed)')
    .option('--iterations <count>', 'Number of iterations per test', '3')
    .option('--timeout <seconds>', 'Timeout in seconds', '60')
    .option('--output <path>', 'Output file path for results')
    .option('--refresh-indexes', 'Refresh cached docs/indexes before eval')
    .option('--verbose', 'Show detailed progress')
    .action(async (options) => {
        const cwd = process.cwd();

        if (!options.simulate && !options.apiKey && !process.env.OPENAI_API_KEY) {
            console.log(chalk.yellow('⚠️  No API key provided. Running in simulation mode.'));
            console.log(chalk.dim('Set OPENAI_API_KEY or use --api-key for real evals.'));
        }

        const evalOptions: EvalOptions = {
            model: options.model,
            provider: options.provider,
            apiKey: options.apiKey || process.env.OPENAI_API_KEY,
            simulate: options.simulate,
            iterations: parseInt(options.iterations),
            timeout: parseInt(options.timeout),
            output: options.output,
            verbose: options.verbose,
            refreshIndexes: options.refreshIndexes,
        };

        try {
            const results = await runComprehensiveEval(evalOptions);
            
            if (options.output) {
                console.log(chalk.green(`✓ Results saved to: ${options.output}`));
            }

            // Print detailed results
            printDetailedResults(results);

            // Generate report
            const reportPath = options.output ? options.output.replace('.json', '-report.json') : undefined;
            if (reportPath) {
                await generateEvalReport(results, reportPath);
            }
        } catch (error) {
            console.error(chalk.red('Comprehensive evaluation failed:'), error);
            process.exit(1);
        }
    });

// ============================================================================
// COMPRESSION STATS COMMAND
// ============================================================================
program
    .command('stats')
    .description('Show compression statistics for detected frameworks')
    .action(async () => {
        try {
            await getCompressionStats(process.cwd());
        } catch (error) {
            console.error(chalk.red('Failed to get compression stats:'), error);
            process.exit(1);
        }
    });

program.parse();
