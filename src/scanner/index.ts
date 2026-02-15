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

    // 1. Scan package.json for dependencies (JavaScript/TypeScript)
    const packageJsonPath = join(cwd, 'package.json');
    if (existsSync(packageJsonPath)) {
        const packageSkills = await scanPackageJson(packageJsonPath);
        detected.push(...packageSkills);
    }

    // 1b. Scan Python package files
    const pythonSkills = await scanPythonPackages(cwd);
    detected.push(...pythonSkills);

    // 1c. Scan Go module files
    const goSkills = await scanGoModules(cwd);
    detected.push(...goSkills);

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

/**
 * Scan Python package files for framework detection
 * Supports: requirements.txt, pyproject.toml, Pipfile
 */
async function scanPythonPackages(cwd: string): Promise<DetectedSkill[]> {
    const detected: DetectedSkill[] = [];

    // Check for requirements.txt
    const requirementsPath = join(cwd, 'requirements.txt');
    if (existsSync(requirementsPath)) {
        try {
            const content = await readFile(requirementsPath, 'utf-8');
            const packages = parseRequirementsTxt(content);
            detectPythonFrameworks(packages, detected);
        } catch {
            // Ignore parse errors
        }
    }

    // Check for pyproject.toml
    const pyprojectPath = join(cwd, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
        try {
            const content = await readFile(pyprojectPath, 'utf-8');
            const packages = parsePyprojectToml(content);
            detectPythonFrameworks(packages, detected);
        } catch {
            // Ignore parse errors
        }
    }

    // Check for Pipfile
    const pipfilePath = join(cwd, 'Pipfile');
    if (existsSync(pipfilePath)) {
        try {
            const content = await readFile(pipfilePath, 'utf-8');
            const packages = parsePipfile(content);
            detectPythonFrameworks(packages, detected);
        } catch {
            // Ignore parse errors
        }
    }

    return detected;
}

/**
 * Parse requirements.txt content
 */
function parseRequirementsTxt(content: string): string[] {
    const packages: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (trimmed && !trimmed.startsWith('#')) {
            // Extract package name (before ==, >=, <=, etc.)
            const packageName = trimmed.split(/[==><!~]/)[0].trim().toLowerCase();
            if (packageName) {
                packages.push(packageName);
            }
        }
    }
    
    return packages;
}

/**
 * Parse pyproject.toml content - handles both PEP 621 and Poetry formats
 */
function parsePyprojectToml(content: string): string[] {
    const packages: string[] = [];
    const knownKeys = new Set([
        'package', 'version', 'description', 'authors', 'requires', 'dependencies',
        'readme', 'license', 'keywords', 'classifiers', 'urls', 'optional-dependencies'
    ]);
    
    try {
        // Handle project.dependencies section (PEP 621 - array of strings)
        // Format: dependencies = ["package1", "package2>=1.0"]
        const projectDepsMatch = content.match(/\[project\.dependencies\]([\s\S]*?)(?=\n\[|$)/i);
        if (projectDepsMatch) {
            const depsSection = projectDepsMatch[1];
            // Match strings like "package>=1.0" or 'package>=1.0'
            const stringDeps = depsSection.match(/(?:^|\n)\s*["']([^"']+)["']/g);
            if (stringDeps) {
                for (const dep of stringDeps) {
                    // Extract package name from "package>=1.0" format
                    const pkgName = dep.replace(/["'\s]/g, '').split(/[=<>!~]/)[0].toLowerCase();
                    if (pkgName && !packages.includes(pkgName) && !knownKeys.has(pkgName)) {
                        packages.push(pkgName);
                    }
                }
            }
        }
        
        // Handle tool.poetry.dependencies section (table format)
        // Format: package = "^1.0"
        const poetryDepsMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/i);
        if (poetryDepsMatch) {
            const depsSection = poetryDepsMatch[1];
            // Match keys on left side of = (package names)
            const pkgRegex = /^([a-zA-Z0-9][-a-zA-Z0-9_.]*)\s*=/m;
            let match;
            while ((match = pkgRegex.exec(depsSection)) !== null) {
                const pkg = match[1].toLowerCase();
                if (pkg && !packages.includes(pkg) && !knownKeys.has(pkg)) {
                    packages.push(pkg);
                }
            }
        }
        
        // Handle tool.poetry.group.dev.dependencies
        const poetryDevDepsMatch = content.match(/\[tool\.poetry\.group\.dev\.dependencies\]([\s\S]*?)(?=\n\[|$)/i);
        if (poetryDevDepsMatch) {
            const depsSection = poetryDevDepsMatch[1];
            const pkgRegex = /^([a-zA-Z0-9][-a-zA-Z0-9_.]*)\s*=/m;
            let match;
            while ((match = pkgRegex.exec(depsSection)) !== null) {
                const pkg = match[1].toLowerCase();
                if (pkg && !packages.includes(pkg) && !knownKeys.has(pkg)) {
                    packages.push(pkg);
                }
            }
        }
        
    } catch {
        // Fallback to empty array if parsing fails
    }
    
    return packages;
}

/**
 * Parse Pipfile content - tracks TOML sections to only match packages in [packages] and [dev-packages]
 */
function parsePipfile(content: string): string[] {
    const packages: string[] = [];
    const lines = content.split('\n');
    
    let inPackagesSection = false;
    let inDevPackagesSection = false;
    
    // Regex to match section headers like [packages] or [dev-packages]
    const sectionHeaderRegex = /^\s*\[([^\]]+)\]\s*$/;
    // Regex to match package key = value (including quoted values)
    const packageRegex = /^([a-zA-Z0-9][-a-zA-Z0-9]*)\s*=/;
    
    for (const line of lines) {
        // Check for section header
        const sectionMatch = line.match(sectionHeaderRegex);
        if (sectionMatch) {
            const sectionName = sectionMatch[1].trim().toLowerCase();
            inPackagesSection = sectionName === 'packages';
            inDevPackagesSection = sectionName === 'dev-packages';
            continue;
        }
        
        // Only collect packages when inside [packages] or [dev-packages] sections
        if (inPackagesSection || inDevPackagesSection) {
            const packageMatch = line.match(packageRegex);
            if (packageMatch) {
                packages.push(packageMatch[1].toLowerCase());
            }
        }
        
        // If we hit another section (not packages/dev-packages), stop collecting
        if (sectionHeaderRegex.test(line)) {
            const sectionName = line.match(sectionHeaderRegex)?.[1].trim().toLowerCase();
            if (sectionName !== 'packages' && sectionName !== 'dev-packages') {
                inPackagesSection = false;
                inDevPackagesSection = false;
            }
        }
    }
    
    return packages;
}

/**
 * Detect Python frameworks from package list
 */
function detectPythonFrameworks(packages: string[], detected: DetectedSkill[]): void {
    const packageToRegistry: Record<string, string> = {
        'django': 'django',
        'fastapi': 'fastapi',
        'flask': 'flask',
        'sqlalchemy': 'sqlalchemy',
        'pydantic': 'pydantic',
    };

    for (const pkg of packages) {
        const registryName = packageToRegistry[pkg];
        if (registryName) {
            const registry = registries.find(r => r.name === registryName);
            if (registry) {
                detected.push({
                    name: registry.name,
                    version: 'latest',
                    source: 'package',
                    displayName: registry.displayName,
                });
            }
        }
    }
}

/**
 * Scan Go module files for framework detection
 */
async function scanGoModules(cwd: string): Promise<DetectedSkill[]> {
    const detected: DetectedSkill[] = [];

    const goModPath = join(cwd, 'go.mod');
    if (!existsSync(goModPath)) {
        return detected;
    }

    try {
        const content = await readFile(goModPath, 'utf-8');
        const packages = parseGoMod(content);
        detectGoFrameworks(packages, detected);
    } catch {
        // Ignore parse errors
    }

    return detected;
}

/**
 * Parse go.mod content - handles both single-line and block require forms
 */
function parseGoMod(content: string): string[] {
    const packages: string[] = [];
    const lines = content.split('\n');
    
    let inRequireBlock = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//')) {
            continue;
        }
        
        // Detect start of require block
        if (trimmed === 'require (') {
            inRequireBlock = true;
            continue;
        }
        
        // Detect end of require block
        if (trimmed === ')') {
            inRequireBlock = false;
            continue;
        }
        
        // Handle single-line require statements (outside block)
        if (trimmed.startsWith('require ') && !inRequireBlock) {
            // Single line: "require github.com/gin-gonic/gin v1.9.1"
            const pkg = trimmed.replace('require ', '').split(/\s+/)[0].trim();
            if (pkg) packages.push(pkg);
            continue;
        }
        
        // Handle require block entries
        if (inRequireBlock) {
            // Each line inside require block is a module path (possibly with version)
            // Format: "github.com/gin-gonic/gin v1.9.1"
            const pkg = trimmed.split(/\s+/)[0].trim();
            if (pkg) packages.push(pkg);
        }
    }
    
    return packages;
}

/**
 * Detect Go frameworks from package list
 */
function detectGoFrameworks(packages: string[], detected: DetectedSkill[]): void {
    const packageToRegistry: Record<string, string> = {
        'github.com/gin-gonic/gin': 'gin',
        'github.com/labstack/echo/v4': 'echo',
        'github.com/gofiber/fiber/v2': 'fiber',
        'github.com/go-chi/chi/v5': 'chi',
    };

    for (const pkg of packages) {
        const registryName = packageToRegistry[pkg];
        if (registryName) {
            const registry = registries.find(r => r.name === registryName);
            if (registry) {
                detected.push({
                    name: registry.name,
                    version: 'latest',
                    source: 'package',
                    displayName: registry.displayName,
                });
            }
        }
    }
}
