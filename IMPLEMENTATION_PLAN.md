# AgentCompiler - Implementation Plan

> **Version:** 1.0  
> **Last Updated:** February 14, 2026

---

## Overview

This document outlines the implementation plan to make AgentCompiler a compelling project. It prioritizes features based on impact, feasibility, and user value.

---

## Phase 1: Foundation (Quick Wins)

### 1.1 Add More JavaScript Frameworks
**Priority:** High | **Effort:** Low

Add support for these popular frameworks that are currently missing:

```typescript
// src/registries/index.ts additions needed:
{
    name: 'express',
    displayName: 'Express.js',
    packageMatch: ['express'],
    configMatch: ['express.config.js'],
    docSource: { type: 'github', repo: 'expressjs/express', path: 'docs', branch: 'master' },
    includes: ['**/*.md'],
},
{
    name: 'nestjs',
    displayName: 'NestJS',
    packageMatch: ['@nestjs/core'],
    configMatch: ['nest-cli.json'],
    docSource: { type: 'github', repo: 'nestjs/docs', path: '.', branch: 'master' },
    includes: ['**/*.md'],
},
{
    name: 'fastify',
    displayName: 'Fastify',
    packageMatch: ['fastify'],
    configMatch: ['fastify.config.js'],
    docSource: { type: 'github', repo: 'fastify/fastify', path: 'docs', branch: 'main' },
    includes: ['**/*.md'],
},
{
    name: 'svelte',
    displayName: 'Svelte',
    packageMatch: ['svelte'],
    docSource: { type: 'github', repo: 'sveltejs/svelte', path: 'packages/svelte/src/docs', branch: 'main' },
    includes: ['**/*.md'],
},
{
    name: 'solid',
    displayName: 'Solid',
    packageMatch: ['solid-js'],
    docSource: { type: 'github', repo: 'solidjs/solid', path: 'packages/solid-docs', branch: 'main' },
    includes: ['**/*.mdx'],
},
```

### 1.2 Add Python Framework Support
**Priority:** High | **Effort:** Medium

This is a major expansion that opens the tool to Python developers.

#### Required Changes:
1. Modify scanner to detect Python package managers (`requirements.txt`, `pyproject.toml`, `Pipfile`)
2. Add Python-specific registries

```typescript
// New registries to add:
{
    name: 'django',
    displayName: 'Django',
    packageMatch: ['django'],
    configMatch: ['settings.py', 'manage.py'],
    docSource: { type: 'github', repo: 'django/django', path: 'docs', branch: 'main' },
    includes: ['**/*.txt'],
},
{
    name: 'fastapi',
    displayName: 'FastAPI',
    packageMatch: ['fastapi'],
    configMatch: ['app.py'],
    docSource: { type: 'github', repo: 'fastapi/fastapi', path: 'docs', branch: 'master' },
    includes: ['**/*.md'],
},
{
    name: 'flask',
    displayName: 'Flask',
    packageMatch: ['flask'],
    configMatch: ['app.py'],
    docSource: { type: 'github', repo: 'pallets/flask', path: 'docs', branch: 'main' },
    includes: ['**/*.rst', '**/*.md'],
},
```

### 1.3 Add Test Tasks for All Frameworks
**Priority:** High | **Effort:** Medium

Currently only Next.js and React have test tasks. Each framework should have evaluation tasks.

#### Current State (src/eval/index.ts):
- ✅ Next.js: 9 test tasks
- ✅ React: 9 test tasks
- ❌ All other frameworks: 0 test tasks

#### Required:
```typescript
// Add to src/eval/index.ts:
const EXPRESS_TEST_APIS = [
    { name: 'routing', description: 'Express routing', prompt: 'Create an Express route...', complexity: 'easy' },
    { name: 'middleware', description: 'Express middleware', prompt: 'Create Express middleware...', complexity: 'medium' },
    // ... more tasks
];

const DJANGO_TEST_APIS = [
    { name: 'models', description: 'Django models', prompt: 'Create a Django model...', complexity: 'medium' },
    { name: 'views', description: 'Django views', prompt: 'Create a Django view...', complexity: 'easy' },
    // ... more tasks
];

// ... similar for each framework
```

---

## Phase 2: Core Features

### 2.1 Local Documentation Support
**Priority:** High | **Effort:** Medium

Allow users to include local documentation.

#### Implementation:
```typescript
// src/fetcher/local.ts (new file)
interface LocalDocSource {
    type: 'local';
    path: string;
}

// Update scanner to detect local docs
function scanLocalDocs(cwd: string): Promise<DetectedSkill[]> {
    // Scan for .md, .mdx, .txt in local directories
    // Support config option "customSkills"
}
```

### 2.2 Plugin System (Alpha)
**Priority:** Medium | **Effort:** High

Allow community to create custom registries and compression algorithms.

#### Architecture:
```
src/
├── plugins/
│   ├── index.ts          # Plugin loader
│   ├── registry/         # Custom registry plugins
│   ├── compressor/      # Custom compression plugins
│   └── evaluator/       # Custom evaluation plugins
```

#### Plugin Interface:
```typescript
interface Plugin {
    name: string;
    version: string;
    
    // Optional hooks
    onScan?: (context: ScanContext) => Promise<ScanContext>;
    onFetch?: (context: FetchContext) => Promise<FetchContext>;
    onCompress?: (context: CompressContext) => Promise<CompressContext>;
    onInject?: (context: InjectContext) => Promise<InjectContext>;
}
```

### 2.3 Incremental Builds
**Priority:** Medium | **Effort:** Medium

Currently, every run regenerates everything. Add incremental builds.

#### Implementation:
```typescript
// src/core/incremental.ts (new file)
interface CacheEntry {
    framework: string;
    version: string;
    hash: string;
    lastBuild: Date;
    index: string;
}

async function buildIncremental(options: CompileOptions): Promise<CompileResult> {
    // 1. Scan project
    const detected = await scanProject(cwd, options);
    
    // 2. Check cache for each framework
    const changed = detected.filter(f => isCacheStale(f));
    
    // 3. Only rebuild changed frameworks
    for (const skill of changed) {
        await fetchDocs(skill, { refresh: true });
        const index = await compressIndex(skill);
        await updateCache(skill, index);
    }
    
    // 4. Return combined result
    return { ... };
}
```

---

## Phase 3: Enterprise Features

### 3.1 Team Workspaces
**Priority:** Medium | **Effort:** High

- Shared configurations
- Team-specific registries
- Role-based access control

### 3.2 Audit Logging
**Priority:** Medium | **Effort:** Low

```typescript
// src/audit/index.ts (new file)
interface AuditEntry {
    timestamp: Date;
    userId: string;
    action: 'scan' | 'fetch' | 'compress' | 'inject';
    framework?: string;
    status: 'success' | 'failure';
    duration: number;
    metadata?: Record<string, any>;
}

function logAudit(entry: AuditEntry): void {
    // Write to audit log (file or external service)
}
```

### 3.3 API Server
**Priority:** Low | **Effort:** High

- REST API for CI/CD integration
- Usage analytics
- Rate limiting

---

## Phase 4: Performance & Quality

### 4.1 Compression Algorithm Improvements
**Priority:** High | **Effort:** Medium

Current compression is basic. Improve with:
1. Better file prioritization
2. Content-aware compression
3. Token estimation

### 4.2 Benchmark Integration
**Priority:** Medium | **Effort:** High

Integrate with:
- SWE-bench
- BigCode benchmark
- HumanEval

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Add Express.js registry
- [ ] Add NestJS registry
- [ ] Add Fastify registry
- [ ] Add Svelte registry
- [ ] Add Solid registry
- [ ] Add Python package detection (requirements.txt, pyproject.toml, Pipfile)
- [ ] Add Django registry
- [ ] Add FastAPI registry
- [ ] Add Flask registry
- [ ] Add Express test tasks
- [ ] Add Django test tasks
- [ ] Add FastAPI test tasks

### Phase 2: Core Features
- [ ] Local documentation support
- [ ] Plugin system (alpha)
- [ ] Incremental builds
- [ ] Better error messages

### Phase 3: Enterprise
- [ ] Team workspaces
- [ ] Audit logging
- [ ] API server

### Phase 4: Performance
- [ ] Improved compression algorithm
- [ ] SWE-bench integration
- [ ] Performance analytics

---

## Dependencies & Prerequisites

Before implementing, ensure:

1. ✅ Node.js 18+
2. ✅ TypeScript 5.x
3. ✅ Vitest for testing
4. ✅ ESLint for code quality

---

## Getting Started

To start implementing any phase:

1. Check the SPEC.md for interface definitions
2. Check the PRD.md for requirements
3. Run `npm test` to ensure tests pass
4. Implement the feature
5. Add tests
6. Update documentation

---

**Document Status:** Draft  
**Next Review:** TBD
