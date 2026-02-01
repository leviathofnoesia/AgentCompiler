import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchDocs, isCacheValid } from '../../src/fetcher/index.js';
import { scanProject } from '../../src/scanner/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';

describe('Fetcher', () => {
  const testDir = join(__dirname, 'test-project-fetcher');
  const cacheDir = join(testDir, '.agent-docs', 'nextjs');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should fetch and cache Next.js docs', async () => {
    // Create a package.json with Next.js
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const detected = await scanProject(testDir);
    expect(detected).toHaveLength(1);

    const result = await fetchDocs(detected[0], { cwd: testDir });
    expect(result).toBe(cacheDir);
    expect(existsSync(cacheDir)).toBe(true);
  });

  it('should use cache when available', async () => {
    // First fetch
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    const detected = await scanProject(testDir);
    await fetchDocs(detected[0], { cwd: testDir });

    // Second fetch should use cache
    const result = await fetchDocs(detected[0], { cwd: testDir });
    expect(result).toBe(cacheDir);
  });

  it('should refresh cache when refresh option is true', async () => {
    // First fetch
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    const detected = await scanProject(testDir);
    await fetchDocs(detected[0], { cwd: testDir });

    // Refresh should refetch
    const result = await fetchDocs(detected[0], { refresh: true, cwd: testDir });
    expect(result).toBe(cacheDir);
  });

  it('should check cache validity', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    const detected = await scanProject(testDir);
    await fetchDocs(detected[0], { cwd: testDir });

    const isValid = await isCacheValid(detected[0], { cwd: testDir });
    expect(isValid).toBe(true);
  });
});