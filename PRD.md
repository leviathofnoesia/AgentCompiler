# AgentCompiler - Product Requirements Document

> **Version:** 1.1  
> **Status:** Draft  
> **Last Updated:** February 18, 2026

---

## 1. Executive Summary

### 1.1 Problem Statement

AI coding agents (like Claude, Cursor, GitHub Copilot) require framework-specific documentation to generate accurate code. However:

- **Current approach is fragmented**: Skills, context files, and documentation are scattered across multiple formats
- **Inconsistent availability**: Agents must decide when to search documentation vs. rely on training data
- **Poor performance**: Vercel's research shows baseline agent performance at 53% pass rate
- **Manual maintenance**: Developers must manually update documentation indexes

### 1.2 Solution Overview

**AgentCompiler** is a universal CLI/API tool that compiles multiple knowledge sources into one deterministic AGENTS.md managed section.

Core pipeline:
1. **Adapters** collect source indexes (framework docs, installed skills.sh skills, local knowledge bases)
2. **Normalize** all source outputs into one internal knowledge-item model
3. **Compose** with deterministic ordering + dedupe (+ optional byte budget)
4. **Inject** rendered indexes into AGENTS.md while preserving user-authored content
5. **Evaluate** documentation effectiveness through automated testing

### 1.3 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Agent Pass Rate (baseline) | 53% | 95%+ |
| Documentation Coverage | 30+ frameworks | 50+ frameworks |
| Compression Ratio | 100:1 | 200:1 |
| Build Time | ~30s | <10s |
| Deterministic Output | No | Yes (CI-safe `--check`) |

---

## 2. Product Vision

**Vision:** Become the standard tool for AI agent documentation optimization, enabling any development team to effortlessly provide optimal context to AI coding assistants.

**Mission:** Automate the creation and maintenance of compressed documentation indexes that maximize AI agent performance across all major frameworks and languages.

---

## 3. User Personas

### 3.1 Primary Personas

#### Persona A: Full-Stack Developer
- **Name:** Sarah
- **Background:** Works at a startup, uses Next.js + Supabase + Tailwind
- **Pain Points:** 
  - Manually updating AGENTS.md is tedious
  - New team members don't know about AGENTS.md
  - Different AI tools need different formats
- **Goals:**
  - Automatic updates on dependency changes
  - Zero-config setup
  - Works with all AI tools

#### Persona B: Platform Engineer
- **Name:** Marcus
- **Background:** Maintains internal developer platform at enterprise
- **Pain Points:**
  - Need audit trails for compliance
  - Multiple teams need different configurations
  - Must support legacy frameworks
- **Goals:**
  - Team workspaces with permissions
  - Custom registry support
  - Enterprise SLAs

#### Persona C: AI/ML Engineer
- **Name:** Priya
- **Background:** Builds AI-powered developer tools
- **Pain Points:**
  - Need benchmarks to compare approaches
  - Hard to measure documentation effectiveness
  - Want to experiment with different compression strategies
- **Goals:**
  - Comprehensive evaluation suite
  - Integration with existing benchmarks
  - Custom test task support

### 3.2 Secondary Personas

- **Open Source Maintainers**: Want to provide best-practice documentation for their users
- **DevRel Engineers**: Need to ensure AI tools use their documentation correctly
- **AI Researchers**: Want to study the impact of documentation on agent performance

---

## 4. Functional Requirements

### 4.1 Core Features

#### F1: Universal Source Adapters
**Priority:** P0 (Must Have)

The system MUST support knowledge injection from:
- Framework documentation sources
- Installed skills.sh skills
- Local project knowledge bases (markdown/text trees)

**Requirements:**
- Adapter contract with normalized output shape
- Source toggles via config (`sources.frameworkDocs`, `sources.skillsSh`, `sources.knowledgeBases`)
- Support source-specific metadata (name, priority, path)

#### F2: Framework Detection + Fetch
**Priority:** P0 (Must Have)

The system MUST detect and fetch framework docs from official registries.

**Requirements:**
- Detect from package managers + config files + custom skills
- Version-aware fetching with branch/tag mapping
- Cache with configurable TTL
- Manual scope control (`--only`, `--exclude`, `--refresh`)

#### F3: Deterministic Composition
**Priority:** P0 (Must Have)

The system MUST compose all source items deterministically.

**Requirements:**
- Stable ordering by priority and ID
- Content-hash dedupe
- Optional byte budget handling with transparent dropped-count reporting
- CI-safe reproducibility for `--check`

#### F4: Index Rendering + Injection
**Priority:** P0 (Must Have)

The system MUST render compact pipe-delimited indexes and inject into AGENTS.md managed section.

**Requirements:**
- Preserve user content outside managed markers
- Support creating AGENTS.md when missing
- Include framework, skills.sh, and KB index blocks in one section

#### F5: Knowledge Base Management UX
**Priority:** P1 (Should Have)

The system SHOULD provide first-class KB commands.

**Requirements:**
- `kb-add`, `kb-list`, `kb-remove`
- Configurable include/exclude globs, priority, max entries
- Works without framework detection (KB-only projects)

#### F6: Evaluation Suite
**Priority:** P1 (Should Have)

The system SHOULD measure effectiveness and guard regressions.

**Requirements:**
- Baseline vs AGENTS.md comparisons
- Multi-provider LLM support
- Build/lint/test/performance metrics
- Reproducible simulation mode

### 4.2 Future Features

#### F7: Adapter Extensibility
**Priority:** P2 (Nice to Have)

Add official adapter extension hooks for additional enterprise/private sources.

#### F8: Team Controls
**Priority:** P3 (Enterprise)

Shared workspaces, audit logging, and policy controls.

#### F9: API Server
**Priority:** P3 (Enterprise)

Remote compile/eval workflows and usage analytics.

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| Requirement | Target |
|------------|--------|
| Initial scan time | <2 seconds |
| Documentation fetch | <30 seconds per framework |
| Compression time | <5 seconds per framework |
| Total build time | <60 seconds |
| Memory usage | <200MB |
| Disk cache size | <500MB |

### 5.2 Scalability Requirements

- Support projects with 100+ dependencies
- Handle documentation repos up to 1GB
- Support concurrent builds (4+ workers)
- Scale to 1000+ team members (enterprise)

### 5.3 Reliability Requirements

- 99.9% uptime for API server
- Graceful degradation on network failures
- Automatic retry with exponential backoff
- Data integrity validation

### 5.4 Security Requirements

- No API key storage in plain text
- Support environment variable configuration
- Secure credential handling
- Input sanitization
- Audit logging for enterprise

### 5.5 Compatibility Requirements

- Node.js 18+
- macOS, Linux, Windows
- GitHub Actions, GitLab CI, Jenkins
- VS Code, JetBrains IDEs

---

## 6. Technical Architecture

### 6.1 System Components

```
CLI/API
  -> Universal Compiler
      -> Adapters
         - framework-docs
         - skills-sh
         - knowledge-base
      -> Normalize
      -> Compose (stable sort + dedupe + budget)
      -> Render (pipe-delimited indexes)
      -> Injector (AGENTS.md managed section)
```

### 6.2 Data Flow

```
Project Files + Config
  -> Adapters collect source indexes
  -> Normalized Knowledge Items
  -> Deterministic composition
  -> Combined index list
  -> AGENTS.md managed section update
```

### 6.3 Key Modules

| Module | Responsibility |
|--------|----------------|
| `universal/compile` | Universal orchestration across all source families |
| `universal/adapters/*` | Source collection adapters |
| `universal/compose` | Deterministic ordering, dedupe, budgeting |
| `scanner` | Framework detection from project files |
| `fetcher` | Framework doc acquisition + cache |
| `compressor` | Framework doc compression |
| `skills-sh` | skills.sh integration |
| `kb` | Local knowledge-base config management |
| `injector` | AGENTS.md managed section merge |
| `eval` + `llm` | Evaluation + model provider clients |

---

## 7. Supported Frameworks

The registry currently supports JavaScript/TypeScript, Python, and Go ecosystems with 30+ entries, including:
- JS/TS: Next.js, React, Vue, Astro, SvelteKit, Nuxt, Remix, Hono, Express, NestJS, Fastify, Svelte, Solid, Qwik, Supabase, Tailwind, Prisma, Drizzle, tRPC, Zod, TanStack Query, Bun, Effect
- Python: Django, FastAPI, Flask, SQLAlchemy, Pydantic
- Go: Gin, Echo, Fiber, Chi

The roadmap target remains 50+ frameworks with expanded language coverage and enterprise/private adapters.

---

## 8. Evaluation Framework

### 8.1 Test Tasks

For each framework, evaluation should include test tasks covering:

1. **Basic API Usage** - Common patterns and syntax
2. **Advanced Features** - Performance optimization, SSR, etc.
3. **Edge Cases** - Error handling, TypeScript strict mode
4. **Integration** - Connecting multiple services

### 8.2 Metrics

| Metric | Description |
|--------|-------------|
| Build Pass Rate | % of tasks that build successfully |
| Lint Pass Rate | % of tasks with no lint errors |
| Test Pass Rate | % of tasks with passing tests |
| Code Quality | LLM-generated code quality score |
| Compression Ratio | Original docs / compressed index |
| Token Efficiency | Tokens used vs. accuracy |

### 8.3 Benchmark Integration

Future versions should integrate with:

- SWE-bench (Software Engineering Benchmark)
- BigCode benchmark
- HumanEval
- MBPP (Mostly Basic Python Problems)

---

## 9. Configuration

### 9.1 Project Configuration (.skill-compiler.json)

```json
{
  "out": "./AGENTS.md",
  "only": ["nextjs", "react"],
  "exclude": ["tailwindcss"],
  "customSkills": [
    {
      "name": "internal-lib",
      "path": "./docs"
    }
  ],
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
  "conflicts": {
    "react-*": "prefer:nextjs"
  },
  "compression": {
    "format": "v1",
    "targetSize": 8192
  },
  "cacheTtlHours": 168
}
```

### 9.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `SKILL_COMPILER_CONFIG` | Path to config file |
| `SKILL_COMPILER_CACHE` | Path to cache directory |
| `SKILL_COMPILER_TOKEN` | GitHub personal access token |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google AI API key |

---

## 10. Roadmap

### Phase 1: Universal Tooling (Complete)
- [x] Universal source-adapter compile pipeline
- [x] Deterministic composition (stable order + dedupe)
- [x] skills.sh integration in compile flow
- [x] Local knowledge-base support + KB CLI commands

### Phase 2: Quality + Coverage (In Progress)
- [ ] Expand and harden framework registries to 50+
- [ ] Improve compression effectiveness under strict size budgets
- [ ] Add richer eval tasks across all supported stacks
- [ ] Add CI guardrails for reproducibility and diff quality

### Phase 3: Enterprise Controls
- [ ] Team-scoped policies for allowed sources and output rules
- [ ] Audit trails and provenance reporting
- [ ] API server enhancements for remote compile/eval operations

### Phase 4: Intelligence
- [ ] Adaptive ranking/composition based on eval outcomes
- [ ] Benchmark integrations (SWE-bench, others)
- [ ] Performance analytics dashboard

---

## 11. Open Questions

1. **Source Policies**: What default trust/policy model should apply to each source family?
2. **Byte Budget Strategy**: Should budget trimming happen globally or per source family?
3. **Adapter Extensibility**: When to formalize third-party adapter API guarantees?
4. **Benchmark Scope**: Which benchmarks best reflect agent productivity for this product?

---

## 12. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| AGENTS.md | Agent context file format |
| Compression | Process of reducing documentation to <8KB |
| Index | Compressed documentation reference file |
| Registry | Framework metadata and fetch configuration |
| Skill | AI agent skill definition |

### B. References

- [Vercel AGENTS.md Research](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- [AGENTS.md Standard](https://agents.md/)
- [Agent Skills](https://agentskills.io/)

### C. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-Q1 | Initial release |
| 0.2.0 | 2024-Q2 | Added 8 frameworks |
| 0.3.0 | 2026-01-29 | skills.sh + eval improvements |
| 0.4.0 | 2026-02-18 | universal compile pipeline + knowledge bases |

---

**Document Status:** Draft for Review  
**Next Review:** TBD  
**Approver:** TBD
