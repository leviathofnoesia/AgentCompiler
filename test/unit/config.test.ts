import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, createInitialConfig, configExists, getConfigPath } from '../../src/config/index.js';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync, readFileSync } from 'fs';

describe('Config', () => {
  const testDir = join(__dirname, 'test-project-config');
  const configPath = join(testDir, '.skill-compiler.json');

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

  it('should create default config', () => {
    const config = createInitialConfig({});
    expect(config.out).toBe('./AGENTS.md');
    expect(config.compression.targetSize).toBe(8192);
    expect(config.compression.format).toBe('v1');
    expect(config.cacheTtlHours).toBe(168);
  });

  it('should load default config when file doesn\'t exist', async () => {
    const config = await loadConfig(testDir);
    expect(config.out).toBe('./AGENTS.md');
    expect(config.compression.targetSize).toBe(8192);
    expect(config.compression.format).toBe('v1');
  });

  it('should load existing config file', async () => {
    const userConfig = {
      out: './custom-AGENTS.md',
      only: ['nextjs'],
      compression: {
        targetSize: 4096,
        format: 'v2'
      }
    };

    await writeFile(configPath, JSON.stringify(userConfig, null, 2));

    const config = await loadConfig(testDir);
    expect(config.out).toBe('./custom-AGENTS.md');
    expect(config.only).toEqual(['nextjs']);
    expect(config.compression.targetSize).toBe(4096);
    expect(config.compression.format).toBe('v2');
  });

  it('should merge user config with defaults', async () => {
    const userConfig = {
      only: ['nextjs'],
      compression: {
        format: 'v2'
      }
    };

    await writeFile(configPath, JSON.stringify(userConfig, null, 2));

    const config = await loadConfig(testDir);
    expect(config.out).toBe('./AGENTS.md'); // Default value
    expect(config.only).toEqual(['nextjs']);
    expect(config.compression.targetSize).toBe(8192); // Default value
    expect(config.compression.format).toBe('v2'); // User value
  });

  it('should save config', async () => {
    const config = createInitialConfig({});
    await saveConfig(testDir, config);

    // saveConfig uses writeFile which is async, but we await it so file should exist
    // However, if testDir is mocked or virtual, existsSync might fail
    // But we are using real fs in test setup
    expect(existsSync(configPath)).toBe(true);
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('"out": "./AGENTS.md"');
  });

  it('should check if config exists', async () => {
    expect(configExists(testDir)).toBe(false);

    // Create config file
    await writeFile(configPath, '{}');
    expect(configExists(testDir)).toBe(true);
  });

  it('should get config path', () => {
    const path = getConfigPath(testDir);
    expect(path).toBe(configPath);
  });
});