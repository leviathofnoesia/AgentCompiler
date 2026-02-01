import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { addCustomSkill, listCustomSkills, removeCustomSkill, getCustomSkill } from '../../src/custom/index.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';

describe('Custom Skills', () => {
  const testDir = join(__dirname, 'test-project-custom');
  const customSkillsDir = join(testDir, '.agent-docs', 'custom');

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

  it('should add a custom skill', async () => {
    const skillSource = join(testDir, 'skill-source');
    mkdirSync(skillSource, { recursive: true });

    // Create a simple skill document
    await writeFile(join(skillSource, 'README.md'), '# My Custom Skill\n\nSome content.');

    const result = await addCustomSkill(testDir, 'skill-source', { name: 'my-skill' });
    expect(result.name).toBe('my-skill');
    expect(result.path).toBe(join(customSkillsDir, 'my-skill'));
    expect(result.fileCount).toBe(1);

    // Verify files were copied
    expect(existsSync(join(customSkillsDir, 'my-skill', 'README.md'))).toBe(true);
  });

  it('should list custom skills', async () => {
    // Add a skill first
    const skillSource = join(testDir, 'skill-source');
    mkdirSync(skillSource, { recursive: true });
    await writeFile(join(skillSource, 'README.md'), '# My Custom Skill');

    await addCustomSkill(testDir, 'skill-source', { name: 'my-skill' });

    const skills = await listCustomSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('my-skill');
    expect(skills[0].path).toBe(join('.agent-docs', 'custom', 'my-skill'));
  });

  it('should remove a custom skill', async () => {
    const skillSource = join(testDir, 'skill-source');
    mkdirSync(skillSource, { recursive: true });
    await writeFile(join(skillSource, 'README.md'), '# My Custom Skill');

    await addCustomSkill(testDir, 'skill-source', { name: 'my-skill' });

    const removed = await removeCustomSkill(testDir, 'my-skill');
    expect(removed).toBe(true);

    // Verify files were removed
    expect(existsSync(join(customSkillsDir, 'my-skill'))).toBe(false);

    const skills = await listCustomSkills(testDir);
    expect(skills).toHaveLength(0);
  });

  it('should handle skill name conflicts', async () => {
    const skillSource = join(testDir, 'skill-source');
    mkdirSync(skillSource, { recursive: true });
    await writeFile(join(skillSource, 'README.md'), '# My Custom Skill');

    await addCustomSkill(testDir, 'skill-source', { name: 'my-skill' });

    const skillSource2 = join(testDir, 'skill-source-2');
    mkdirSync(skillSource2, { recursive: true });
    await writeFile(join(skillSource2, 'README.md'), '# My Custom Skill 2');

    // Add another skill with same name should replace it
    await addCustomSkill(testDir, 'skill-source-2', { name: 'my-skill' });

    const skills = await listCustomSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].path).toBe(join('.agent-docs', 'custom', 'my-skill'));
  });

  it('should get custom skill by name', async () => {
    const skillSource = join(testDir, 'skill-source');
    mkdirSync(skillSource, { recursive: true });
    await writeFile(join(skillSource, 'README.md'), '# My Custom Skill');

    await addCustomSkill(testDir, 'skill-source', { name: 'my-skill' });

    const skill = await getCustomSkill(testDir, 'my-skill');
    expect(skill).toBeDefined();
    expect(skill?.name).toBe('my-skill');
  });
});