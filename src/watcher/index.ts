/**
 * File Watcher
 * Watches for dependency changes and auto-updates AGENTS.md
 */

import { watch } from 'chokidar';
import chalk from 'chalk';
import { injectAgentsMd } from '../injector/index.js';
import { compileProject } from '../core/compile.js';

const DEBOUNCE_MS = 1000;

/**
 * Watch a project for dependency changes and auto-update AGENTS.md
 */
export async function watchProject(cwd: string, outPath: string): Promise<void> {
    let debounceTimer: NodeJS.Timeout | null = null;

    const runUpdate = async () => {
        try {
            console.log(chalk.blue('\n🔄 Detected changes, updating...'));

            const compileResult = await compileProject({ cwd });
            if (compileResult.detected.length === 0) {
                console.log(chalk.yellow('No frameworks detected.'));
            }

            await injectAgentsMd(outPath, compileResult.allIndexes);

            console.log(chalk.green(`✓ Updated ${outPath}`));
        } catch (error) {
            console.error(chalk.red('Update failed:'), error instanceof Error ? error.message : error);
        }
    };

    const debouncedUpdate = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(runUpdate, DEBOUNCE_MS);
    };

    // Watch package.json and lockfiles
    const watcher = watch([
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'bun.lockb',
        '.agent/skills/**/*.md',
    ], {
        cwd,
        ignoreInitial: true,
        persistent: true,
    });

    watcher.on('change', (path) => {
        console.log(chalk.dim(`Changed: ${path}`));
        debouncedUpdate();
    });

    watcher.on('add', (path) => {
        console.log(chalk.dim(`Added: ${path}`));
        debouncedUpdate();
    });

    watcher.on('unlink', (path) => {
        console.log(chalk.dim(`Removed: ${path}`));
        debouncedUpdate();
    });

    // Run initial update
    await runUpdate();

    console.log(chalk.blue('\n👀 Watching for changes... (Ctrl+C to stop)'));

    // Keep process alive
    await new Promise(() => { });
}
