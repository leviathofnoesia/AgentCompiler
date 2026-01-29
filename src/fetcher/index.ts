/**
 * Doc Fetcher
 * Downloads version-matched documentation for frameworks
 */

import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getRegistry } from '../registries/index.js';
import type { DetectedSkill } from '../scanner/index.js';

const CACHE_DIR = '.agent-docs';
const CACHE_TTL_STABLE = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_TTL_CANARY = 24 * 60 * 60 * 1000; // 1 day

interface FetchOptions {
    refresh?: boolean;
}

/**
 * Fetch documentation for a detected skill
 */
export async function fetchDocs(skill: DetectedSkill, options: FetchOptions = {}): Promise<string> {
    const cacheDir = join(process.cwd(), CACHE_DIR, skill.name);
    const cacheMetaPath = join(cacheDir, '.cache-meta.json');

    // Check cache validity
    if (!options.refresh && existsSync(cacheMetaPath)) {
        try {
            const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
            const cacheAge = Date.now() - meta.fetchedAt;
            const ttl = skill.version.includes('canary') || skill.version.includes('beta')
                ? CACHE_TTL_CANARY
                : CACHE_TTL_STABLE;

            if (cacheAge < ttl) {
                return cacheDir; // Cache is still valid
            }
        } catch {
            // Cache meta corrupted, refetch
        }
    }

    // Get registry for this skill
    const registry = getRegistry(skill.name);
    if (!registry) {
        // For custom skills, just return the cache dir (docs should already be there)
        return cacheDir;
    }

    // Determine branch based on version
    const branch = getVersionBranch(skill.version, registry.versionMapping);

    // Fetch based on doc source type
    switch (registry.docSource.type) {
        case 'github':
            await fetchFromGitHub(registry, branch, cacheDir);
            break;
        case 'url':
            await fetchFromUrl(registry.docSource.url!, cacheDir);
            break;
        default:
            throw new Error(`Unsupported doc source type: ${registry.docSource.type}`);
    }

    // Write cache metadata
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheMetaPath, JSON.stringify({
        skill: skill.name,
        version: skill.version,
        branch,
        fetchedAt: Date.now(),
    }));

    return cacheDir;
}

/**
 * Determine which git branch to use based on version
 */
function getVersionBranch(version: string, versionMapping?: Record<string, string>): string {
    if (!versionMapping) return 'main';

    // Try exact match first
    if (versionMapping[version]) {
        return versionMapping[version];
    }

    // Try major version match
    const major = version.split('.')[0];
    if (versionMapping[major]) {
        return versionMapping[major];
    }

    // Fall back to first mapping or 'main'
    return Object.values(versionMapping)[0] || 'main';
}

/**
 * Fetch docs from GitHub repository
 */
async function fetchFromGitHub(
    registry: { docSource: { repo?: string; path?: string; branch?: string }; includes?: string[] },
    branch: string,
    cacheDir: string
): Promise<void> {
    const { repo, path = 'docs' } = registry.docSource;
    if (!repo) throw new Error('GitHub repo not specified');

    // Use GitHub API to get directory tree
    const apiUrl = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;

    const response = await fetch(apiUrl, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'skill-compiler',
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { tree: Array<{ path: string; type: string; url?: string }> };

    // Filter to docs path and markdown files
    const docFiles = data.tree.filter(item =>
        item.type === 'blob' &&
        item.path.startsWith(path) &&
        (item.path.endsWith('.md') || item.path.endsWith('.mdx'))
    );

    // Create cache directory
    await mkdir(cacheDir, { recursive: true });

    // Fetch each file (in batches to avoid rate limiting)
    const batchSize = 10;
    for (let i = 0; i < docFiles.length; i += batchSize) {
        const batch = docFiles.slice(i, i + batchSize);
        await Promise.all(batch.map(async (file) => {
            const relativePath = file.path.replace(path + '/', '');
            const localPath = join(cacheDir, relativePath);

            // Create directory structure
            const dir = join(cacheDir, relativePath.split('/').slice(0, -1).join('/'));
            await mkdir(dir, { recursive: true });

            // Fetch raw content
            const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${file.path}`;
            const contentResponse = await fetch(rawUrl);
            if (contentResponse.ok) {
                const content = await contentResponse.text();
                await writeFile(localPath, content);
            }
        }));
    }
}

/**
 * Fetch docs from a direct URL
 */
async function fetchFromUrl(url: string, cacheDir: string): Promise<void> {
    // Simple URL fetch - assumes it's a zip or tar.gz
    // TODO: Implement URL-based fetching
    await mkdir(cacheDir, { recursive: true });
}

/**
 * Check if cache is valid for a skill
 */
export async function isCacheValid(skill: DetectedSkill): Promise<boolean> {
    const cacheMetaPath = join(process.cwd(), CACHE_DIR, skill.name, '.cache-meta.json');

    if (!existsSync(cacheMetaPath)) return false;

    try {
        const meta = JSON.parse(await readFile(cacheMetaPath, 'utf-8'));
        const cacheAge = Date.now() - meta.fetchedAt;
        const ttl = skill.version.includes('canary') ? CACHE_TTL_CANARY : CACHE_TTL_STABLE;
        return cacheAge < ttl;
    } catch {
        return false;
    }
}
