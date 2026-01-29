/**
 * Custom Skill Management
 * Handles adding, listing, and removing custom skills
 */

import { readFile, writeFile, mkdir, cp, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { glob } from 'glob';
import { loadConfig, saveConfig, type CustomSkillConfig } from '../config/index.js';

const CUSTOM_SKILLS_DIR = '.agent-docs/custom';

export interface AddSkillOptions {
    name?: string;
    priority?: string[];
}

export interface AddSkillResult {
    name: string;
    path: string;
    fileCount: number;
}

/**
 * Add a custom skill from a local path
 */
export async function addCustomSkill(
    cwd: string,
    source: string,
    options: AddSkillOptions = {}
): Promise<AddSkillResult> {
    // Determine skill name
    const name = options.name || basename(source).replace(/[^a-z0-9-]/gi, '-').toLowerCase();

    // Validate source exists
    const sourcePath = join(cwd, source);
    if (!existsSync(sourcePath)) {
        throw new Error(`Source path not found: ${source}`);
    }

    // Check for markdown files
    const mdFiles = await glob('**/*.{md,mdx}', { cwd: sourcePath });
    if (mdFiles.length === 0) {
        console.warn(`Warning: No markdown files found in ${source}`);
    }

    // Create custom skills directory
    const destPath = join(cwd, CUSTOM_SKILLS_DIR, name);
    await mkdir(destPath, { recursive: true });

    // Copy files
    await cp(sourcePath, destPath, { recursive: true });

    // Update config
    const config = await loadConfig(cwd);
    const customSkills = config.customSkills || [];

    // Remove existing entry with same name
    const filtered = customSkills.filter(s => s.name !== name);

    // Add new entry
    const skillConfig: CustomSkillConfig = {
        name,
        path: join(CUSTOM_SKILLS_DIR, name),
    };

    if (options.priority) {
        skillConfig.priority = options.priority;
    }

    config.customSkills = [...filtered, skillConfig];
    await saveConfig(cwd, config);

    return {
        name,
        path: destPath,
        fileCount: mdFiles.length,
    };
}

/**
 * List all custom skills
 */
export async function listCustomSkills(cwd: string): Promise<CustomSkillConfig[]> {
    const config = await loadConfig(cwd);
    return config.customSkills || [];
}

/**
 * Remove a custom skill
 */
export async function removeCustomSkill(cwd: string, name: string): Promise<boolean> {
    const config = await loadConfig(cwd);
    const customSkills = config.customSkills || [];

    const skill = customSkills.find(s => s.name === name);
    if (!skill) {
        return false;
    }

    // Remove from config
    config.customSkills = customSkills.filter(s => s.name !== name);
    await saveConfig(cwd, config);

    // Remove files
    const skillPath = join(cwd, skill.path);
    if (existsSync(skillPath)) {
        await rm(skillPath, { recursive: true });
    }

    return true;
}

/**
 * Get custom skill by name
 */
export async function getCustomSkill(cwd: string, name: string): Promise<CustomSkillConfig | undefined> {
    const skills = await listCustomSkills(cwd);
    return skills.find(s => s.name === name);
}
