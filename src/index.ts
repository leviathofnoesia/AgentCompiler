/**
 * skill-compiler main exports
 */

export { scanProject, type DetectedSkill } from './scanner/index.js';
export { fetchDocs } from './fetcher/index.js';
export { compressIndex } from './compressor/index.js';
export { injectAgentsMd } from './injector/index.js';
export { watchProject } from './watcher/index.js';
export { compileProject } from './core/compile.js';
export { compileKnowledge, type UniversalCompileOptions, type UniversalCompileResult } from './universal/compile.js';
export { addKnowledgeBase, listKnowledgeBases, removeKnowledgeBase, type AddKnowledgeBaseOptions } from './kb/index.js';
export type { KnowledgeBaseConfig } from './config/index.js';
