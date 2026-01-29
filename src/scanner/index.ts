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

export interface DetectedSkill {
    name: string;
    version: string;
    source: 'package' | 'skill' | 'mcp' | 'config';
    docRegistry?: string;
    displayName?: string;
}

interface ScanOptions {
    only?: string[];
}

/**
 * Scan a project directory for frameworks and skills
 */
export async function scanProject(cwd: string, options: ScanOptions = {}): Promise<DetectedSkill[]> {
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

    // Filter by --only option if provided
    if (options.only && options.only.length > 0) {
        return detected.filter(skill => options.only!.includes(skill.name));
    }

    // Deduplicate by name (prefer package.json source)
    const unique = new Map<string, DetectedSkill>();
    for (const skill of detected) {
        const existing = unique.get(skill.name);
        if (!existing || skill.source === 'package') {
            unique.set(skill.name, skill);
        }
    }

    return Array.from(unique.values());
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
