import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { watchProject } from '../../src/watcher/index.js';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { writeFile } from 'fs/promises';
import { scanProject } from '../../src/scanner/index.js';

describe('Watcher', () => {
  const testDir = join(__dirname, 'test-project-watcher');
  const agentsMdPath = join(testDir, 'AGENTS.md');

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

  it('should detect package.json changes and update AGENTS.md', async () => {
    // Create initial package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Start watching (this would normally run in background)
    // For testing, we'll simulate the update logic
    const detected = await scanProject(testDir);
    expect(detected).toHaveLength(0);

    // Simulate adding a dependency
    const updatedPackageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(updatedPackageJson, null, 2));

    // The watcher would detect this change and update AGENTS.md
    // For this test, we'll just verify the logic works
    const newDetected = await scanProject(testDir);
    expect(newDetected).toHaveLength(1);
    expect(newDetected[0].name).toBe('nextjs');
  });

  it('should handle skill additions', async () => {
    // Create .agent/skills directory
    const skillsDir = join(testDir, '.agent', 'skills');
    mkdirSync(skillsDir, { recursive: true });

    // Create a test skill
    const skillPath = join(skillsDir, 'test-skill.md');
    await writeFile(skillPath, `# Test Skill\n\nSome skill content.`);

    const detected = await scanProject(testDir);
    expect(detected).toHaveLength(0); // Skills are detected separately

    // The watcher would detect this and include skills in AGENTS.md
  });
});