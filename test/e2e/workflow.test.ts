import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync, readFileSync } from 'fs';

describe('E2E Workflow', () => {
  const testDir = join(__dirname, 'test-project-workflow');
  const agentsMdPath = join(testDir, 'AGENTS.md');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Windows EPERM: child process may still hold files briefly after kill
        setTimeout(() => {
          try { rmSync(testDir, { recursive: true, force: true }); } catch {}
        }, 500);
      }
    }
  });

  it('should complete full workflow: init -> compile -> verify', async () => {
    // 1. Initialize
    const cliPath = join(__dirname, '../../dist/cli.js');
    const initResult = await new Promise((resolve) => {
      exec(`node "${cliPath}" init`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(initResult.error).toBeNull();
    expect(existsSync(join(testDir, '.skill-compiler.json'))).toBe(true);

    // 2. Add Next.js dependency
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // 3. Compile
    const compileResult = await new Promise((resolve) => {
      exec(`node "${cliPath}" compile`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(compileResult.error).toBeNull();
    expect(existsSync(agentsMdPath)).toBe(true);

    // 4. Verify content
    const content = readFileSync(agentsMdPath, 'utf-8');
    expect(content).toContain('[Next.js Docs Index]');
    expect(content).toContain('IMPORTANT: Prefer retrieval-led reasoning');
    expect(content).toContain('<!-- BEGIN SKILL-COMPILER MANAGED SECTION -->');
    expect(content).toContain('<!-- END SKILL-COMPILER MANAGED SECTION -->');
  });

  it('should handle multiple frameworks', async () => {
    // Initialize
    const cliPath = join(__dirname, '../../dist/cli.js');
    await new Promise((resolve) => {
      exec(`node "${cliPath}" init`, { cwd: testDir }, () => resolve(null));
    });

    // Add multiple frameworks
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Compile
    const compileResult = await new Promise((resolve) => {
      exec(`node "${cliPath}" compile`, { cwd: testDir }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    expect(compileResult.error).toBeNull();
    expect(existsSync(agentsMdPath)).toBe(true);

    const content = readFileSync(agentsMdPath, 'utf-8');
    expect(content).toContain('[Next.js Docs Index]');
    expect(content).toContain('[React Docs Index]');
  });

  it('should support watch mode', async () => {
    // Initialize
    const cliPath = join(__dirname, '../../dist/cli.js');
    await new Promise((resolve) => {
      exec(`node "${cliPath}" init`, { cwd: testDir }, () => resolve(null));
    });

    // Add Next.js
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0'
      }
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Start watch (this would normally run in background)
    // For testing, we'll just verify it can be started
    const watchResult = await new Promise((resolve) => {
      const child = exec(`node "${cliPath}" watch`, { cwd: testDir });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => stdout += data);
      child.stderr?.on('data', (data) => stderr += data);

      setTimeout(() => {
        child.kill();
        child.on('exit', () => {
          resolve({ error: null, stdout, stderr });
        });
      }, 2000);
    });

    // Watch should start and detect changes
    expect(watchResult.error).toBeNull();
    expect(watchResult.stdout).toContain('Watching for changes');
  });
});