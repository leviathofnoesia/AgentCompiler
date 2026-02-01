import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runEval } from '../../src/eval/index.js';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { writeFile } from 'fs/promises';

describe('Evaluation Suite', () => {
  const testDir = join(__dirname, 'eval-test-project');
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should run evaluation with simulation', async () => {
    const result = await runEval({
      simulate: true,
      verbose: false
    });

    expect(result).toBeDefined();
    expect(result.framework).toBe('nextjs'); // Default
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('should handle framework-specific evaluation', async () => {
    // Setup Next.js project - though runEval doesn't strictly require it for simulation
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { next: '14.0.0' }
    }));

    const result = await runEval({
      framework: 'nextjs',
      simulate: true,
      verbose: false
    });

    expect(result).toBeDefined();
    expect(result.framework).toBe('nextjs');
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('should compare different configurations', async () => {
    const result = await runEval({
      compare: 'agents-md',
      simulate: true,
      verbose: false
    });

    expect(result).toBeDefined();
    expect(result.config).toBe('agents-md');
  });
});
