import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanProject } from '../../src/scanner/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';

describe('Scanner', () => {
  const testDir = join(__dirname, 'test-project-scanner');

  beforeEach(() => {
    // Create test project directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should detect Next.js framework from package.json', async () => {
    // Create a package.json with Next.js dependency
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
    expect(detected[0].name).toBe('nextjs');
    expect(detected[0].version).toBe('14.0.0');
  });

  it('should detect React framework from package.json', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const detected = await scanProject(testDir);
    expect(detected).toHaveLength(1);
    expect(detected[0].name).toBe('react');
    expect(detected[0].version).toBe('18.0.0');
  });

  it('should detect multiple frameworks', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const detected = await scanProject(testDir);
    expect(detected).toHaveLength(2);
    const frameworkNames = detected.map(d => d.name).sort();
    expect(frameworkNames).toEqual(['nextjs', 'react']);
  });

  it('should return empty array when no frameworks detected', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const detected = await scanProject(testDir);
    expect(detected).toHaveLength(0);
  });

  it('should detect framework from config files', async () => {
    // Create a Next.js config file
    await writeFile(join(testDir, 'next.config.js'), 'module.exports = {}');

    const detected = await scanProject(testDir);
    expect(detected).toHaveLength(1);
    expect(detected[0].name).toBe('nextjs');
  });
});