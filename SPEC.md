# AgentCompiler - Technical Specification

> **Version:** 1.1  
> **Status:** Draft  
> **Last Updated:** February 18, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Module Specifications](#3-module-specifications)
4. [Data Formats](#4-data-formats)
5. [API Reference](#5-api-reference)
6. [CLI Commands](#6-cli-commands)
7. [Configuration](#7-configuration)
8. [Error Handling](#8-error-handling)
9. [Testing](#9-testing)

---

## 1. Overview

### 1.1 Purpose

This document provides detailed technical specifications for the AgentCompiler system, covering architecture, module interfaces, data formats, and API definitions.

### 1.2 Scope

- CLI tool for local development
- Programmatic API for integration
- Evaluation suite for benchmarking
- Universal source-adapter architecture for skills and knowledge bases

---

## 2. Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI / API Layer                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Universal Compile Pipeline               │  │
│  │                                                            │  │
│  │  Adapters → Normalize → Compose → Render → Inject         │  │
│  │                                                            │  │
│  │  Adapters:                                                 │  │
│  │  - Framework docs (scan/fetch/compress)                   │  │
│  │  - skills.sh installed skills                              │  │
│  │  - Local knowledge bases                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Supporting Services                      │  │
│  │  Registries | Cache | Config | LLM Eval | Watcher         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Design Principles

1. **Modularity**: Each module has a single responsibility
2. **Extensibility**: Source adapters for new knowledge inputs
3. **Determinism**: Stable ordering/deduplication for CI-safe output
4. **Performance**: Caching and incremental builds
5. **Reliability**: Graceful error handling and retries

---

## 3. Module Specifications

### 3.1 Scanner Module

**File:** `src/scanner/index.ts`

**Purpose:** Detect frameworks and skills from project files.

**Interface:**

```typescript
interface DetectedSkill {
    name: string;           // Framework identifier (e.g., "nextjs")
    version: string;        // Framework version (e.g., "14.0.0")
    source: 'package' | 'skill' | 'mcp' | 'config' | 'custom';
    docRegistry?: string;   // Registry name
    displayName?: string;  // Human-readable name
    path?: string;        // Path to custom docs
}

interface ScanOptions {
    only?: string[];       // Only scan these frameworks
    exclude?: string[];    // Exclude these frameworks
    customSkills?: CustomSkillConfig[];
    conflicts?: ConflictConfig;
}

function scanProject(cwd: string, options?: ScanOptions): Promise<DetectedSkill[]>
```

**Detection Priority:**
1. Custom skills (config)
2. package.json dependencies
3. .agent/skills/ directory
4. Config files

### 3.2 Fetcher Module

**File:** `src/fetcher/index.ts`

**Purpose:** Fetch documentation from remote sources.

**Interface:**

```typescript
interface FetchOptions {
    refresh?: boolean;      // Force refresh cache
    cwd?: string;          // Working directory
    cacheTtlHours?: number; // Cache TTL in hours
}

interface FetchedDoc {
    framework: string;
    version: string;
    content: string;
    fetchedAt: Date;
    source: string;
}

function fetchDocs(skill: DetectedSkill, options?: FetchOptions): Promise<void>
function getCachedDoc(framework: string, version: string): Promise<FetchedDoc | null>
```

**Supported Sources:**
- GitHub repositories
- npm packages
- Local file system
- HTTP endpoints

### 3.3 Compressor Module

**File:** `src/compressor/index.ts`

**Purpose:** Compress documentation to pipe-delimited format.

**Interface:**

```typescript
interface CompressionOptions {
    cwd?: string;
    format?: 'v1' | 'v2';
    targetSize?: number;   // Target size in bytes (default: 8192)
    conflicts?: ConflictConfig;
}

function compressIndex(skill: DetectedSkill, options?: CompressionOptions): Promise<string>
function estimateSize(content: string): number
function optimizeForTarget(content: string, targetSize: number): string
```

**Output Format:**

```
[Framework Name]|root: ./docs
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for {framework} tasks.
|{section}:{file1,file2,file3}
|{subsection}:{file1,file2}
```

### 3.4 Injector Module

**File:** `src/injector/index.ts`

**Purpose:** Merge compressed indexes into AGENTS.md.

**Interface:**

```typescript
interface InjectOptions {
    outputPath?: string;
    sectionMarker?: string;
    backup?: boolean;
}

function injectIntoAgentsMd(
    content: string,
    indexes: string[],
    options?: InjectOptions
): Promise<string>

function removeManagedSection(
    content: string,
    sectionMarker?: string
): string

function hasManagedSection(
    content: string,
    sectionMarker?: string
): boolean
```

### 3.5 Evaluator Module

**File:** `src/eval/index.ts`

**Purpose:** Evaluate documentation effectiveness.

**Interface:**

```typescript
interface EvalOptions {
    framework?: string;
    compare?: 'baseline' | 'skill-only' | 'agents-md';
    verbose?: boolean;
    simulate?: boolean;
    model?: string;
    apiKey?: string;
    provider?: string;
    iterations?: number;
    timeout?: number;
    refreshIndexes?: boolean;
}

interface EvalResult {
    framework: string;
    version: string;
    config: string;
    metrics: {
        build: number;
        lint: number;
        test: number;
        performance: number;
    };
    passRate: number;
    details: EvalTaskResult[];
    timestamp: string;
    compression: {
        size: number;
        targetSize: number;
        compressionRatio: number;
    };
}

function runEval(options?: EvalOptions): Promise<EvalResult>
function runComprehensiveEval(options?: EvalOptions): Promise<EvalResult[]>
```

### 3.6 Registries Module

**File:** `src/registries/index.ts`

**Purpose:** Define framework metadata and fetch configurations.

**Interface:**

```typescript
interface FrameworkRegistry {
    name: string;                    // Registry identifier
    displayName: string;           // Human-readable name
    packageMatch: string[];         // npm package names to match
    configMatch?: string[];         // Config file patterns
    docSource: {
        type: 'github' | 'npm' | 'url';
        repo?: string;              // GitHub repo (owner/repo)
        path?: string;              // Documentation path
        branch?: string;            // Branch/tag
        url?: string;               // Custom URL
    };
    versionMapping?: Record<string, string>;  // Version to branch/tag
    includes?: string[];            // File patterns to include
    excludes?: string[];            // File patterns to exclude
    priority?: string[];           // Priority sections
}

function getRegistry(name: string): FrameworkRegistry | undefined
function getRegistryNames(): string[]
```

### 3.7 LLM Client Module

**File:** `src/llm/client.ts`

**Purpose:** Integration with LLM providers.

**Interface:**

```typescript
type LLMProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'ollama' | 'groq' | 'perplexity';

interface LLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
}

interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
}

function createLLMClient(config: LLMConfig): LLMClient
function testLLMConnection(config: LLMConfig): Promise<boolean>
```

### 3.8 Config Module

**File:** `src/config/index.ts`

**Purpose:** Configuration management.

**Interface:**

```typescript
interface SkillCompilerConfig {
    out?: string;
    only?: string[];
    exclude?: string[];
    customSkills?: CustomSkillConfig[];
    knowledgeBases?: KnowledgeBaseConfig[];
    sources?: {
        frameworkDocs?: boolean;
        skillsSh?: boolean;
        knowledgeBases?: boolean;
    };
    conflicts?: ConflictConfig;
    compression?: {
        format?: 'v1' | 'v2';
        targetSize?: number;
    };
    cacheTtlHours?: number;
}

function loadConfig(cwd: string): Promise<SkillCompilerConfig>
function resolveConfigPath(cwd: string): string | null
function mergeConfig(base: SkillCompilerConfig, override: Partial<SkillCompilerConfig>): SkillCompilerConfig
```

### 3.9 Universal Compile Module

**Files:** `src/universal/compile.ts`, `src/universal/compose.ts`, `src/universal/types.ts`

**Purpose:** Provide a framework-agnostic, source-adapter based pipeline for building AGENTS.md indexes.

**Interface:**

```typescript
interface UniversalCompileOptions {
    cwd?: string;
    only?: string[];
    exclude?: string[];
    refresh?: boolean;
    includeSkillsSh?: boolean;
    maxBytes?: number;
}

interface UniversalCompileResult {
    config: SkillCompilerConfig;
    items: KnowledgeItem[];
    allIndexes: string[];
    detected: DetectedSkill[];
    indexes: string[];             // framework indexes
    knowledgeBaseIndexes: string[];
    skillsShIndexes: string[];
    dropped: number;               // deduped/over-budget entries
}

function compileKnowledge(options?: UniversalCompileOptions): Promise<UniversalCompileResult>
function composeKnowledge(items: KnowledgeItem[], policy?: { maxBytes?: number }): ComposeResult
```

### 3.10 Knowledge Base Module

**File:** `src/kb/index.ts`

**Purpose:** Register local knowledge bases in config for injection into AGENTS.md.

**Interface:**

```typescript
interface KnowledgeBaseConfig {
    name: string;
    path: string;
    include?: string[];
    exclude?: string[];
    priority?: number;
    maxEntries?: number;
}

function addKnowledgeBase(cwd: string, source: string, options?: AddKnowledgeBaseOptions): Promise<KnowledgeBaseConfig>
function listKnowledgeBases(cwd: string): Promise<KnowledgeBaseConfig[]>
function removeKnowledgeBase(cwd: string, name: string): Promise<boolean>
```

---

## 4. Data Formats

### 4.1 AGENTS.md Format

```markdown
# Project Guidelines

<!-- BEGIN SKILL-COMPILER MANAGED SECTION -->
<!-- DO NOT EDIT THIS SECTION MANUALLY - Generated by skill-compiler -->

## Framework Documentation Indexes

[Next.js Docs Index]|root: ./.agent-docs/nextjs
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for Next.js tasks.
|01-app:{installation.mdx,project-structure.mdx,layouts-and-pages.mdx}
|01-app\01-getting-started:{installation.mdx}

<!-- END SKILL-COMPILER MANAGED SECTION -->

<!-- Your custom content here -->
```

### 4.2 Configuration File (.skill-compiler.json)

```json
{
  "out": "./AGENTS.md",
  "only": ["nextjs", "react"],
  "exclude": [],
  "customSkills": [],
  "knowledgeBases": [
    {
      "name": "internal-docs",
      "path": "docs/internal",
      "include": ["**/*.md", "**/*.mdx"],
      "exclude": ["archive/**"],
      "priority": 85,
      "maxEntries": 100
    }
  ],
  "sources": {
    "frameworkDocs": true,
    "skillsSh": true,
    "knowledgeBases": true
  },
  "conflicts": {},
  "compression": {
    "format": "v1",
    "targetSize": 8192
  },
  "cacheTtlHours": 168
}
```

### 4.3 Skill Definition (.agent/skills/*/SKILL.md)

```markdown
---
name: my-framework
version: 1.0.0
displayName: My Framework
docSource: custom
---

# My Framework Skills

This skill provides guidance for using My Framework.
```

---

## 5. API Reference

### 5.1 Programmatic API

```typescript
import { compileProject, compileKnowledge } from 'skill-compiler';

const result = await compileProject({
    cwd: process.cwd(),
    only: ['nextjs', 'react'],
    exclude: ['tailwindcss'],
    refresh: false,
    includeSkillsSh: true,
});

console.log(result.detected);    // Detected frameworks
console.log(result.indexes);    // Compressed indexes
console.log(result.allIndexes);  // All indexes including skills.sh

const universal = await compileKnowledge({
    cwd: process.cwd(),
    maxBytes: 20000,
});
console.log(universal.knowledgeBaseIndexes); // KB indexes
console.log(universal.dropped);              // deduped/trimmed entries
```

### 5.2 Core Compile Function

```typescript
interface CompileOptions {
    cwd?: string;
    only?: string[];
    exclude?: string[];
    refresh?: boolean;
    includeSkillsSh?: boolean;
}

interface CompileResult {
    config: SkillCompilerConfig;
    detected: DetectedSkill[];
    indexes: string[];
    knowledgeBaseIndexes: string[];
    skillsShIndexes: string[];
    allIndexes: string[];
    dropped?: number;
}

function compileProject(options?: CompileOptions): Promise<CompileResult>
```

---

## 6. CLI Commands

### 6.1 Main Commands

```bash
# Generate AGENTS.md
skill-compiler

# Watch mode
skill-compiler watch

# Dry run (preview only)
skill-compiler --dry-run

# Specific frameworks only
skill-compiler --only nextjs,react

# Force refresh cache
skill-compiler --refresh

# Add custom skill
skill-compiler add ./my-docs/

# Add/list/remove local knowledge base
skill-compiler kb-add ./docs/internal --name internal-docs
skill-compiler kb-list
skill-compiler kb-remove internal-docs

# Run evaluation
skill-compiler eval

# Comprehensive evaluation
skill-compiler eval:comprehensive
```

### 6.2 Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help |
| `--version` | `-v` | Show version |
| `--cwd` | `-C` | Working directory |
| `--only` | | Only these frameworks |
| `--exclude` | `-e` | Exclude these frameworks |
| `--refresh` | `-r` | Force refresh cache |
| `--dry-run` | `-n` | Preview only |
| `--output` | | Output file |
| `--config` | `-c` | Config file path |
| `--silent` | `-s` | Silent mode |
| `--verbose` | | Verbose output |

---

## 7. Configuration

### 7.1 Config File Search Order

1. `.skill-compiler.json` in project root
2. `.skill-compiler.config.json` in project root
3. `skill-compiler` in `package.json`
4. Environment variables

### 7.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `SKILL_COMPILER_CONFIG` | Config file path |
| `SKILL_COMPILER_CACHE` | Cache directory |
| `SKILL_COMPILER_TOKEN` | GitHub token |
| `SKILL_COMPILER_OUT` | Output file path |

### 7.3 Framework Conflict Resolution

```json
{
  "conflicts": {
    "react-*": "prefer:nextjs",
    "vue-*": "prefer:nuxt"
  }
}
```

Resolution strategies:
- `prefer:{framework}` - Use specified framework
- `first` - Use first detected
- `last` - Use last detected

---

## 8. Error Handling

### 8.1 Error Types

```typescript
enum ErrorCode {
    CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
    FRAMEWORK_NOT_SUPPORTED = 'FRAMEWORK_NOT_SUPPORTED',
    FETCH_FAILED = 'FETCH_FAILED',
    COMPRESSION_FAILED = 'COMPRESSION_FAILED',
    INJECTION_FAILED = 'INJECTION_FAILED',
    EVAL_FAILED = 'EVAL_FAILED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    CACHE_ERROR = 'CACHE_ERROR',
}

class SkillCompilerError extends Error {
    code: ErrorCode;
    details?: any;
}
```

### 8.2 Error Recovery

| Error | Recovery Strategy |
|-------|-----------------|
| Network timeout | Retry 3 times with exponential backoff |
| Rate limit | Wait and retry |
| Invalid config | Show error with suggestion |
| Cache corruption | Clear and rebuild |
| Framework not found | Suggest alternative |

---

## 9. Testing

### 9.1 Test Structure

```
test/
├── unit/
│   ├── scanner.test.ts
│   ├── fetcher.test.ts
│   ├── compressor.test.ts
│   ├── injector.test.ts
│   ├── compose.test.ts
│   ├── kb.test.ts
│   ├── universal.test.ts
│   ├── eval.test.ts
│   └── config.test.ts
├── integration/
│   └── cli.test.ts
└── e2e/
    └── workflow.test.ts
```

### 9.2 Unit Tests

Each module should have:
- 80%+ code coverage
- Happy path tests
- Edge case tests
- Error handling tests

### 9.3 Integration Tests

- CLI command tests
- Config loading tests
- File system tests
- Network tests (mocked)

### 9.4 E2E Tests

- Full workflow tests
- Watch mode tests
- Evaluation tests

---

## Appendix A: Supported LLM Models

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-4 |
| Anthropic | claude-3.5-sonnet, claude-3.5-haiku |
| Google | gemini-1.5-pro, gemini-1.5-flash |
| Mistral | mistral-large, mistral-small |
| Ollama | llama3.1, mistral, codellama |
| Groq | llama-3.1-70b-versatile |
| Perplexity | llama-3.1-sonar-large-128k |

---

## Appendix B: Supported File Types

| Source | File Types |
|--------|------------|
| GitHub | .md, .mdx |
| npm | README.md, CHANGELOG.md |
| Local | .md, .mdx, .txt |

---

## Appendix C: Performance Targets

| Operation | Target |
|-----------|--------|
| Framework scan | <2s |
| Single doc fetch | <30s |
| Compression | <5s |
| Full build | <60s |
| Memory usage | <200MB |

---

**Document Status:** Draft for Review  
**Next Review:** TBD  
**Approver:** TBD
