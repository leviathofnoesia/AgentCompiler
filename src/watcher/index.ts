/**
 * File Watcher
 * Watches for dependency changes and auto-updates AGENTS.md
 */

import { watch } from 'chokidar';
import chalk from 'chalk';
import { scanProject } from '../scanner/index.js';
import { fetchDocs } from '../fetcher/index.js';
import { compressIndex } from '../compressor/index.js';
import { injectAgentsMd } from '../injector/index.js';

const DEBOUNCE_MS = 1000;

/**
 * Watch a project for dependency changes and auto-update AGENTS.md
 */
export async function watchProject(cwd: string, outPath: string): Promise<void> {
    let debounceTimer: NodeJS.Timeout | null = null;

    const runUpdate = async () => {
        try {
            console.log(chalk.blue('\n🔄 Detected changes, updating...'));

            const detected = await scanProject(cwd);
            if (detected.length === 0) {
                console.log(chalk.yellow('No frameworks detected.'));
                return;
            }

            for (const skill of detected) {
                await fetchDocs(skill);
            }

            const indexes = await Promise.all(detected.map(skill => compressIndex(skill)));
            await injectAgentsMd(outPath, indexes);

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
