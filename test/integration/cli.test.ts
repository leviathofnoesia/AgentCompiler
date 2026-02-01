import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync, readFileSync } from 'fs';

describe('CLI Integration', () => {
  const testDir = join(__dirname, 'test-project-cli');
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

  it('should initialize config', async () => {
    const cliPath = join(__dirname, '../../dist/cli.js');
    const result = await new Promise((resolve) => {
      exec(`node ${cliPath} init`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(result.error).toBeNull();
    expect(existsSync(join(testDir, '.skill-compiler.json'))).toBe(true);
  });

  it('should compile and generate AGENTS.md', async () => {
    // Create package.json with Next.js
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const cliPath = join(__dirname, '../../dist/cli.js');
    const result = await new Promise((resolve) => {
      exec(`node ${cliPath} compile`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(result.error).toBeNull();
    expect(existsSync(agentsMdPath)).toBe(true);

    const content = readFileSync(agentsMdPath, 'utf-8');
    expect(content).toContain('[Next.js Docs Index]');
    expect(content).toContain('IMPORTANT: Prefer retrieval-led reasoning');
  });

  it('should handle dry run', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const cliPath = join(__dirname, '../../dist/cli.js');
    const result = await new Promise((resolve) => {
      exec(`node ${cliPath} compile --dry-run`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(result.error).toBeNull();
    expect(existsSync(agentsMdPath)).toBe(false); // Should not create file in dry run
  });

  it('should add a custom skill', async () => {
    const skillSource = join(testDir, 'skill-source');
    mkdirSync(skillSource, { recursive: true });
    await writeFile(join(skillSource, 'README.md'), '# My Custom Skill');

    const cliPath = join(__dirname, '../../dist/cli.js');
    const result = await new Promise((resolve) => {
      exec(`node ${cliPath} add skill-source --name my-skill`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(result.error).toBeNull();
    expect(result.stdout).toContain('Added skill "my-skill"');
  });

  it('should list skills', async () => {
    const cliPath = join(__dirname, '../../dist/cli.js');
    const result = await new Promise((resolve) => {
      exec(`node ${cliPath} list`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(result.error).toBeNull();
    expect(result.stdout).toContain('No skills configured.');
  });
});