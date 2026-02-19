import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { compileKnowledge } from '../../src/universal/compile.js';

describe('Universal Compile', () => {
  const testDir = join(__dirname, 'test-project-universal');
  const kbDir = join(testDir, 'knowledge');

  beforeEach(async () => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    mkdirSync(kbDir, { recursive: true });

    await writeFile(join(kbDir, 'api.md'), '# API Rules\n\nAlways validate input.');
    await writeFile(join(kbDir, 'style.md'), '# Style Guide\n\nPrefer small functions.');

    await writeFile(join(testDir, '.skill-compiler.json'), JSON.stringify({
      sources: {
        frameworkDocs: false,
        skillsSh: false,
        knowledgeBases: true
      },
      knowledgeBases: [
        {
          name: 'team-kb',
          path: 'knowledge',
          maxEntries: 20
        }
      ]
    }, null, 2));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should compile knowledge base sources when framework/skills sources are disabled', async () => {
    const result = await compileKnowledge({ cwd: testDir });

    expect(result.detected).toHaveLength(0);
    expect(result.indexes).toHaveLength(0);
    expect(result.skillsShIndexes).toHaveLength(0);
    expect(result.knowledgeBaseIndexes).toHaveLength(1);
    expect(result.allIndexes[0]).toContain('[team-kb Knowledge Base]');
    expect(result.allIndexes[0]).toContain('IMPORTANT: Treat this as project-specific source of truth');
  });
});
