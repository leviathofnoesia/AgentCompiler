/**
 * Skill Scanner
 * Detects frameworks and skills from the project
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import { parse as parseYaml } from 'yaml';
import { registries } from '../registries/index.js';
import { loadConfig, type ConflictConfig, type CustomSkillConfig } from '../config/index.js';

export interface DetectedSkill {
    name: string;
    version: string;
    source: 'package' | 'skill' | 'mcp' | 'config' | 'custom';
    docRegistry?: string;
    displayName?: string;
    path?: string;
}

interface ScanOptions {
    only?: string[];
    exclude?: string[];
    customSkills?: CustomSkillConfig[];
    conflicts?: ConflictConfig;
}

/**
 * Scan a project directory for frameworks and skills
 */
export async function scanProject(cwd: string, options: ScanOptions = {}): Promise<DetectedSkill[]> {
    const config = await loadConfig(cwd);
    const only = options.only ?? config.only;
    const exclude = options.exclude ?? config.exclude;
    const customSkills = options.customSkills ?? config.customSkills ?? [];
    const conflicts = options.conflicts ?? config.conflicts;
    const detected: DetectedSkill[] = [];

    // 1. Scan package.json for dependencies
    const packageJsonPath = join(cwd, 'package.json');
    if (existsSync(packageJsonPath)) {
        const packageSkills = await scanPackageJson(packageJsonPath);
        detected.push(...packageSkills);
    }

    // 2. Scan .agent/skills/ for skill definitions
    const skillsDir = join(cwd, '.agent', 'skills');
    if (existsSync(skillsDir)) {
        const skillFiles = await scanSkillsDirectory(skillsDir);
        detected.push(...skillFiles);
    }

    // 3. Scan for framework-specific config files
    const configSkills = await scanConfigFiles(cwd);
    detected.push(...configSkills);

    // 4. Add custom skills from config
    for (const skill of customSkills) {
        detected.push({
            name: skill.name,
            version: 'custom',
            source: 'custom',
            displayName: skill.name,
            path: join(cwd, skill.path),
        });
    }

    let filtered = detected;
    // Filter by --only option if provided
    if (only && only.length > 0) {
        filtered = filtered.filter(skill => only.includes(skill.name));
    }

    // Filter by --exclude option if provided
    if (exclude && exclude.length > 0) {
        filtered = filtered.filter(skill => !exclude.includes(skill.name));
    }

    const preferredSkills = getPreferredSkills(conflicts);

    // Deduplicate by name (prefer package.json source)
    const unique = new Map<string, DetectedSkill>();
    for (const skill of filtered) {
        const existing = unique.get(skill.name);
        if (!existing || getSkillPriority(skill, preferredSkills) > getSkillPriority(existing, preferredSkills)) {
            unique.set(skill.name, skill);
        }
    }

    return Array.from(unique.values());
}

function getPreferredSkills(conflicts?: ConflictConfig): Set<string> {
    if (!conflicts) return new Set();
    const preferred = new Set<string>();
    for (const value of Object.values(conflicts)) {
        if (value.startsWith('prefer:')) {
            preferred.add(value.slice('prefer:'.length).trim());
        }
    }
    return preferred;
}

function getSkillPriority(skill: DetectedSkill, preferredSkills: Set<string>): number {
    const sourcePriority: Record<DetectedSkill['source'], number> = {
        custom: 3,
        package: 2,
        skill: 1,
        config: 0,
        mcp: 0,
    };
    const preferredBoost = preferredSkills.has(skill.name) ? 1 : 0;
    return (sourcePriority[skill.source] ?? 0) + preferredBoost;
}

/**
 * Scan package.json for framework dependencies
 */
async function scanPackageJson(packageJsonPath: string): Promise<DetectedSkill[]> {
    const detected: DetectedSkill[] = [];

    try {
        const content = await readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
        };

        for (const registry of registries) {
            for (const packageName of registry.packageMatch) {
                if (allDeps[packageName]) {
                    const version = allDeps[packageName].replace(/^[\^~]/, '');
                    detected.push({
                        name: registry.name,
                        version,
                        source: 'package',
                        displayName: registry.displayName,
                    });
                    break; // Only detect once per registry
                }
            }
        }
    } catch {
        // Ignore parse errors
    }

    return detected;
}

/**
 * Scan .agent/skills/ directory for SKILL.md files
 */
async function scanSkillsDirectory(skillsDir: string): Promise<DetectedSkill[]> {
    const detected: DetectedSkill[] = [];

    try {
        const skillFiles = await glob('*/SKILL.md', { cwd: skillsDir });

        for (const skillFile of skillFiles) {
            const fullPath = join(skillsDir, skillFile);
            const content = await readFile(fullPath, 'utf-8');

            // Parse YAML frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
                const frontmatter = parseYaml(frontmatterMatch[1]);
                if (frontmatter.name) {
                    detected.push({
                        name: frontmatter.name,
                        version: frontmatter.version || 'latest',
                        source: 'skill',
                        displayName: frontmatter.displayName || frontmatter.name,
                        docRegistry: frontmatter.docSource,
                    });
                }
            }
        }
    } catch {
        // Ignore errors
    }

    return detected;
}

/**
 * Scan for framework-specific config files
 */
async function scanConfigFiles(cwd: string): Promise<DetectedSkill[]> {
    const detected: DetectedSkill[] = [];

    for (const registry of registries) {
        if (registry.configMatch) {
            for (const pattern of registry.configMatch) {
                const matches = await glob(pattern, { cwd });
                if (matches.length > 0) {
                    // Don't add if already detected from package.json
                    detected.push({
                        name: registry.name,
                        version: 'latest', // Config files don't tell us version
                        source: 'config',
                        displayName: registry.displayName,
                    });
                    break;
                }
            }
        }
    }

    return detected;
}
