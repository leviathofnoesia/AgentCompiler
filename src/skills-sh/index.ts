/**
 * skills.sh Integration
 * Wrapper for the skills.sh registry (Vercel's Agent Skills)
 */

import { spawn } from 'child_process';
import { readdir, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import chalk from 'chalk';

const SKILLS_DIR = '.agent/skills';

export interface SkillMetadata {
    name: string;
    description?: string;
    path: string;
    source?: string;  // e.g., "vercel-labs/agent-skills"
}

export interface SearchResult {
    name: string;
    repo: string;
    downloads?: number;
    description?: string;
}

/**
 * Search skills.sh registry
 */
export async function searchSkills(query: string): Promise<SearchResult[]> {
    // For now, we'll use a curated list of popular skills
    // In a full implementation, this would query skills.sh API or scrape the site
    const popularSkills: SearchResult[] = [
        { name: 'vercel-react-best-practices', repo: 'vercel-labs/agent-skills', downloads: 86600, description: 'React best practices from Vercel' },
        { name: 'web-design-guidelines', repo: 'vercel-labs/agent-skills', downloads: 45000, description: 'Modern web design guidelines' },
        { name: 'frontend-design', repo: 'vercel-labs/agent-skills', downloads: 38000, description: 'Frontend design patterns' },
        { name: 'supabase-postgres-best-practices', repo: 'vercel-labs/agent-skills', downloads: 25000, description: 'Supabase and PostgreSQL best practices' },
        { name: 'next-best-practices', repo: 'vercel-labs/agent-skills', downloads: 20000, description: 'Next.js best practices' },
        { name: 'vue-best-practices', repo: 'vercel-labs/agent-skills', downloads: 18000, description: 'Vue.js best practices' },
        { name: 'react-native-best-practices', repo: 'vercel-labs/agent-skills', downloads: 15000, description: 'React Native best practices' },
        { name: 'tailwind-design-system', repo: 'skills-sh/skills', downloads: 12000, description: 'Tailwind CSS design system patterns' },
        { name: 'typescript-advanced-types', repo: 'skills-sh/skills', downloads: 10000, description: 'Advanced TypeScript type patterns' },
        { name: 'test-driven-development', repo: 'vercel-labs/agent-skills', downloads: 9000, description: 'TDD methodology for agents' },
    ];

    const lowerQuery = query.toLowerCase();
    return popularSkills.filter(skill =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description?.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Install a skill from skills.sh registry
 */
export async function installSkill(
    skillRef: string,
    options: { skillName?: string; scope?: 'project' | 'global' } = {}
): Promise<{ success: boolean; skill?: SkillMetadata; error?: string }> {
    try {
        // Build npx skills command
        const args = ['skills', 'add', skillRef];

        if (options.skillName) {
            args.push('--skill', options.skillName);
        }

        if (options.scope === 'global') {
            args.push('--global');
        }

        console.log(chalk.dim(`Running: npx ${args.join(' ')}`));

        // Run npx skills add
        const result = await runNpxCommand(args);

        if (!result.success) {
            return { success: false, error: result.output };
        }

        // Find the installed skill
        const installedSkills = await scanLocalSkills(process.cwd());
        const newSkill = installedSkills.find(s =>
            options.skillName
                ? s.name === options.skillName
                : s.source === skillRef
        );

        return { success: true, skill: newSkill };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Scan local .agent/skills directory for installed skills
 */
export async function scanLocalSkills(cwd: string): Promise<SkillMetadata[]> {
    const skillsDir = join(cwd, SKILLS_DIR);
    const skills: SkillMetadata[] = [];

    if (!existsSync(skillsDir)) {
        return skills;
    }

    try {
        const entries = await readdir(skillsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillPath = join(skillsDir, entry.name);
                const skillMdPath = join(skillPath, 'SKILL.md');

                if (existsSync(skillMdPath)) {
                    const metadata = await parseSkillMd(skillMdPath);
                    skills.push({
                        name: metadata.name || entry.name,
                        description: metadata.description,
                        path: skillPath,
                    });
                }
            } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
                // Single-file skill
                const skillPath = join(skillsDir, entry.name);
                const metadata = await parseSkillMd(skillPath);
                skills.push({
                    name: metadata.name || basename(entry.name, '.md'),
                    description: metadata.description,
                    path: skillPath,
                });
            }
        }
    } catch (error) {
        // Directory doesn't exist or other error
    }

    return skills;
}

/**
 * Parse SKILL.md frontmatter
 */
async function parseSkillMd(path: string): Promise<{ name?: string; description?: string; content?: string }> {
    try {
        const content = await readFile(path, 'utf-8');

        // Check for YAML frontmatter
        if (content.startsWith('---')) {
            const endIndex = content.indexOf('---', 3);
            if (endIndex !== -1) {
                const frontmatter = content.slice(3, endIndex).trim();
                const parsed = parseYaml(frontmatter);
                return {
                    name: parsed.name,
                    description: parsed.description,
                    content: content.slice(endIndex + 3).trim(),
                };
            }
        }

        // Extract title from first H1
        const h1Match = content.match(/^#\s+(.+)$/m);
        return {
            name: h1Match?.[1],
            content,
        };
    } catch {
        return {};
    }
}

/**
 * Sync installed skills to AGENTS.md
 * Converts SKILL.md files to compressed index format
 */
export async function syncSkillsToAgentsMd(cwd: string): Promise<string[]> {
    const skills = await scanLocalSkills(cwd);
    const indexes: string[] = [];

    for (const skill of skills) {
        const index = await compressSkillToIndex(skill);
        if (index) {
            indexes.push(index);
        }
    }

    return indexes;
}

/**
 * Compress a skill to AGENTS.md index format
 */
async function compressSkillToIndex(skill: SkillMetadata): Promise<string | null> {
    try {
        const content = await readFile(skill.path, 'utf-8');

        // Extract key sections from the skill
        const sections = extractSkillSections(content);

        // Format as compact index
        const lines: string[] = [
            `[${skill.name} Skill]|source:skills.sh`,
        ];

        if (skill.description) {
            lines.push(`|${skill.description}`);
        }

        // Add key instructions (truncated to fit in AGENTS.md)
        for (const section of sections.slice(0, 5)) {
            const truncated = section.length > 100
                ? section.slice(0, 97) + '...'
                : section;
            lines.push(`|${truncated}`);
        }

        // Add reference to full skill
        lines.push(`|FULL: ${skill.path}`);

        return lines.join('\n');
    } catch {
        return null;
    }
}

/**
 * Extract key sections from skill content
 */
function extractSkillSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split('\n');

    let currentSection = '';

    for (const line of lines) {
        // Skip frontmatter
        if (line.startsWith('---')) continue;

        // Capture H2/H3 headings and their first paragraph
        if (line.startsWith('## ') || line.startsWith('### ')) {
            if (currentSection) {
                sections.push(currentSection.trim());
            }
            currentSection = line.replace(/^#+\s*/, '');
        } else if (line.trim() && currentSection && !line.startsWith('#')) {
            // Add first line of content after heading
            if (!currentSection.includes(':')) {
                currentSection += ': ' + line.trim();
            }
        }
    }

    if (currentSection) {
        sections.push(currentSection.trim());
    }

    return sections;
}

/**
 * Run npx command and return result
 */
function runNpxCommand(args: string[]): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
        const child = spawn('npx', ['-y', ...args], {
            shell: true,
            stdio: 'pipe',
        });

        let output = '';

        child.stdout?.on('data', (data) => {
            output += data.toString();
        });

        child.stderr?.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            resolve({ success: code === 0, output });
        });

        child.on('error', (error) => {
            resolve({ success: false, output: error.message });
        });

        // Timeout after 60 seconds
        setTimeout(() => {
            child.kill();
            resolve({ success: false, output: 'Timeout' });
        }, 60000);
    });
}

/**
 * Get skill suggestions based on detected frameworks
 */
export function getSuggestedSkills(frameworks: string[]): SearchResult[] {
    const suggestions: Record<string, SearchResult[]> = {
        'nextjs': [
            { name: 'next-best-practices', repo: 'vercel-labs/agent-skills', description: 'Next.js best practices' },
            { name: 'vercel-react-best-practices', repo: 'vercel-labs/agent-skills', description: 'React best practices from Vercel' },
        ],
        'react': [
            { name: 'vercel-react-best-practices', repo: 'vercel-labs/agent-skills', description: 'React best practices from Vercel' },
            { name: 'frontend-design', repo: 'vercel-labs/agent-skills', description: 'Frontend design patterns' },
        ],
        'vue': [
            { name: 'vue-best-practices', repo: 'vercel-labs/agent-skills', description: 'Vue.js best practices' },
        ],
        'supabase': [
            { name: 'supabase-postgres-best-practices', repo: 'vercel-labs/agent-skills', description: 'Supabase and PostgreSQL best practices' },
        ],
        'tailwindcss': [
            { name: 'tailwind-design-system', repo: 'skills-sh/skills', description: 'Tailwind CSS design system patterns' },
            { name: 'web-design-guidelines', repo: 'vercel-labs/agent-skills', description: 'Modern web design guidelines' },
        ],
    };

    const allSuggestions: SearchResult[] = [];
    const seen = new Set<string>();

    for (const framework of frameworks) {
        const frameworkSuggestions = suggestions[framework] || [];
        for (const skill of frameworkSuggestions) {
            if (!seen.has(skill.name)) {
                seen.add(skill.name);
                allSuggestions.push(skill);
            }
        }
    }

    return allSuggestions;
}
