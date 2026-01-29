/**
 * Configuration Management
 * Handles .skill-compiler.json config file
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const CONFIG_FILENAME = '.skill-compiler.json';

export interface CustomSkillConfig {
    name: string;
    path: string;
    priority?: string[];
}

export interface CompressionConfig {
    targetSize?: number;
    format?: 'v1' | 'v2';
}

export interface ConflictConfig {
    [pattern: string]: string;  // e.g., "hooks/*": "prefer:react"
}

export interface SkillCompilerConfig {
    /** Output path for AGENTS.md (default: ./AGENTS.md) */
    out?: string;

    /** Only process these frameworks */
    only?: string[];

    /** Skip these frameworks */
    exclude?: string[];

    /** Custom skill definitions */
    customSkills?: CustomSkillConfig[];

    /** Compression settings */
    compression?: CompressionConfig;

    /** Conflict resolution rules */
    conflicts?: ConflictConfig;

    /** Cache TTL in hours (default: 168 = 7 days) */
    cacheTtlHours?: number;
}

const DEFAULT_CONFIG: SkillCompilerConfig = {
    out: './AGENTS.md',
    compression: {
        targetSize: 8192,
        format: 'v1',
    },
    cacheTtlHours: 168,
};

/**
 * Load config from .skill-compiler.json
 */
export async function loadConfig(cwd: string): Promise<SkillCompilerConfig> {
    const configPath = join(cwd, CONFIG_FILENAME);

    if (!existsSync(configPath)) {
        return { ...DEFAULT_CONFIG };
    }

    try {
        const content = await readFile(configPath, 'utf-8');
        const userConfig = JSON.parse(content) as SkillCompilerConfig;

        // Merge with defaults
        return {
            ...DEFAULT_CONFIG,
            ...userConfig,
            compression: {
                ...DEFAULT_CONFIG.compression,
                ...userConfig.compression,
            },
        };
    } catch (error) {
        console.warn(`Warning: Could not parse ${CONFIG_FILENAME}, using defaults`);
        return { ...DEFAULT_CONFIG };
    }
}

/**
 * Save config to .skill-compiler.json
 */
export async function saveConfig(cwd: string, config: SkillCompilerConfig): Promise<void> {
    const configPath = join(cwd, CONFIG_FILENAME);
    const content = JSON.stringify(config, null, 2);
    await writeFile(configPath, content, 'utf-8');
}

/**
 * Check if config file exists
 */
export function configExists(cwd: string): boolean {
    return existsSync(join(cwd, CONFIG_FILENAME));
}

/**
 * Get config file path
 */
export function getConfigPath(cwd: string): string {
    return join(cwd, CONFIG_FILENAME);
}

/**
 * Create initial config with sensible defaults
 */
export function createInitialConfig(options: {
    out?: string;
    frameworks?: string[];
}): SkillCompilerConfig {
    const config: SkillCompilerConfig = {
        ...DEFAULT_CONFIG,
    };

    if (options.out) {
        config.out = options.out;
    }

    if (options.frameworks && options.frameworks.length > 0) {
        config.only = options.frameworks;
    }

    return config;
}
