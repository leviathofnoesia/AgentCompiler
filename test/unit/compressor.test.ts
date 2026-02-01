import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compressIndex } from '../../src/compressor/index.js';
import { fetchDocs } from '../../src/fetcher/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { scanProject } from '../../src/scanner/index.js';

describe('Compressor', () => {
  const testDir = join(__dirname, 'test-project-compressor');
  const cacheDir = join(testDir, '.agent-docs');

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

  it('should compress Next.js docs to index format', async () => {
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
    await fetchDocs(detected[0], { cwd: testDir });

    const index = await compressIndex(detected[0], { cwd: testDir });
    expect(index).toContain('[Next.js Docs Index]');
    expect(index).toContain('root: ./.agent-docs/nextjs');
    expect(index).toContain('IMPORTANT: Prefer retrieval-led reasoning');
  });

  it('should compress React docs to index format', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const detected = await scanProject(testDir);
    await fetchDocs(detected[0], { cwd: testDir });

    const index = await compressIndex(detected[0], { cwd: testDir });
    expect(index).toContain('[React Docs Index]');
    expect(index).toContain('root: ./.agent-docs/react');
    expect(index).toContain('IMPORTANT: Prefer retrieval-led reasoning');
  });

  it('should handle compression format options', async () => {
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

    const indexV1 = await compressIndex(detected[0], { format: 'v1', cwd: testDir });
    expect(indexV1).toContain('[Next.js Docs Index]');

    const indexV2 = await compressIndex(detected[0], { format: 'v2', cwd: testDir });
    expect(indexV2).toContain('[Next.js Docs Index]');
    expect(indexV2).toContain('v14');
  });

  it('should compress to target size', async () => {
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

    const index = await compressIndex(detected[0], { targetSize: 1024, cwd: testDir });
    expect(Buffer.byteLength(index, 'utf-8')).toBeLessThanOrEqual(1024);
  });
});