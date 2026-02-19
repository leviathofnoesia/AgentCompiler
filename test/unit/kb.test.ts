import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { addKnowledgeBase, listKnowledgeBases, removeKnowledgeBase } from '../../src/kb/index.js';

describe('Knowledge Base Management', () => {
  const testDir = join(__dirname, 'test-project-kb');
  const kbSourceDir = join(testDir, 'kb-source');

  beforeEach(async () => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    mkdirSync(kbSourceDir, { recursive: true });
    await writeFile(join(kbSourceDir, 'README.md'), '# Team Playbook\n\nUse this first.');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should add and list a knowledge base', async () => {
    const added = await addKnowledgeBase(testDir, 'kb-source', {
      name: 'team-playbook',
      priority: 85,
      maxEntries: 25,
    });

    expect(added.name).toBe('team-playbook');
    expect(added.path).toBe('kb-source');

    const listed = await listKnowledgeBases(testDir);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('team-playbook');
    expect(listed[0].priority).toBe(85);
    expect(listed[0].maxEntries).toBe(25);
  });

  it('should remove an existing knowledge base', async () => {
    await addKnowledgeBase(testDir, 'kb-source', { name: 'team-playbook' });
    const removed = await removeKnowledgeBase(testDir, 'team-playbook');
    expect(removed).toBe(true);

    const listed = await listKnowledgeBases(testDir);
    expect(listed).toHaveLength(0);
  });
});
