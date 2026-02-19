/**
 * skill-compiler main exports
 */

export { scanProject, type DetectedSkill } from './scanner/index.js';
export { fetchDocs } from './fetcher/index.js';
export { compressIndex } from './compressor/index.js';
export { injectAgentsMd } from './injector/index.js';
export { watchProject } from './watcher/index.js';
export { compileProject } from './core/compile.js';
export { compileKnowledge } from './universal/compile.js';
export { addKnowledgeBase, listKnowledgeBases, removeKnowledgeBase } from './kb/index.js';
