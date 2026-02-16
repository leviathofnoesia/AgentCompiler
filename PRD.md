# AgentCompiler - Product Requirements Document

> **Version:** 1.0  
> **Status:** Draft  
> **Last Updated:** February 14, 2026

---

## 1. Executive Summary

### 1.1 Problem Statement

AI coding agents (like Claude, Cursor, GitHub Copilot) require framework-specific documentation to generate accurate code. However:

- **Current approach is fragmented**: Skills, context files, and documentation are scattered across multiple formats
- **Inconsistent availability**: Agents must decide when to search documentation vs. rely on training data
- **Poor performance**: Vercel's research shows baseline agent performance at 53% pass rate
- **Manual maintenance**: Developers must manually update documentation indexes

### 1.2 Solution Overview

**AgentCompiler** is a CLI tool and API that automatically:

1. **Scans** projects for framework dependencies
2. **Fetches** version-matched documentation from official sources
3. **Compresses** documentation into <8KB AGENTS.md indexes
4. **Injects** compressed indexes into project AGENTS.md
5. **Evaluates** documentation effectiveness through automated testing

### 1.3 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Agent Pass Rate (baseline) | 53% | 95%+ |
| Documentation Coverage | 17 frameworks | 50+ frameworks |
| Compression Ratio | 100:1 | 200:1 |
| Build Time | ~30s | <10s |

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

#### F1: Framework Detection
**Priority:** P0 (Must Have)

The system MUST automatically detect frameworks from:

- `package.json` dependencies
- `package.json` devDependencies
- Config files (e.g., `next.config.js`, `tailwind.config.js`)
- `.agent/skills/` directory
- Custom skill definitions in config

**Requirements:**
- Support at least 50 frameworks by v2.0
- Detect framework version when possible
- Support manual override via `--only` and `--exclude` flags
- Handle conflicting frameworks (e.g., Next.js vs. Remix)

#### F2: Documentation Fetching
**Priority:** P0 (Must Have)

The system MUST fetch documentation from:

- GitHub repositories (official framework docs)
- npm packages (for libraries)
- Local file system (for private/custom docs)
- HTTP endpoints (for web-based docs)

**Requirements:**
- Cache documentation for configurable duration (default: 7 days)
- Support version-specific documentation branches/tags
- Handle rate limiting gracefully
- Support authentication for private repos
- Fallback to latest version if specific version not found

#### F3: Documentation Compression
**Priority:** P0 (Must Have)

The system MUST compress documentation into <8KB indexes using the pipe-delimited format:

```
[Framework Name]|root: ./docs
|IMPORTANT: {key guidance}
|{section}:{files}
```

**Requirements:**
- Target size: <8KB (configurable)
- Preserve critical API signatures
- Include "IMPORTANT" directives for key guidance
- Support custom compression strategies
- Maintain hierarchical structure

#### F4: AGENTS.md Injection
**Priority:** P0 (Must Have)

The system MUST inject compressed indexes into AGENTS.md while preserving user content.

**Requirements:**
- Preserve content outside managed section
- Support custom section markers
- Handle missing AGENTS.md (create new)
- Support backup before modification
- Validate output format

#### F5: Watch Mode
**Priority:** P1 (Should Have)

The system SHOULD automatically rebuild indexes when dependencies change.

**Requirements:**
- Watch `package.json` for changes
- Watch `.agent/skills/` directory
- Debounce rapid changes (500ms)
- Support file system events (chokidar)
- Graceful shutdown on SIGTERM

#### F6: Evaluation Suite
**Priority:** P1 (Should Have)

The system SHOULD provide evaluation capabilities to measure documentation effectiveness.

**Requirements:**
- Compare baseline vs. AGENTS.md performance
- Support multiple LLM providers (OpenAI, Anthropic, Google, etc.)
- Built-in test tasks for supported frameworks
- Custom test task support
- Generate detailed reports

### 4.2 Extended Features

#### F7: Local Documentation Support
**Priority:** P2 (Nice to Have)

The system SHOULD support local documentation sources.

**Requirements:**
- Scan local directories for `.md`, `.mdx`, `.txt` files
- Support relative and absolute paths
- Handle nested directory structures
- Respect `.gitignore` patterns

#### F8: Plugin System
**Priority:** P2 (Nice to Have)

The system SHOULD support custom plugins for:

- Custom registries
- Custom compression algorithms
- Custom output formats
- Custom evaluation metrics

#### F9: Team Workspaces
**Priority:** P3 (Enterprise)

The system SHOULD support team workspaces with:

- Shared configurations
- Role-based access control
- Audit logging
- Team-specific registries

#### F10: API Server
**Priority:** P3 (Enterprise)

The system SHOULD provide a REST API for:

- CI/CD integration
- Remote compilation
- Team management
- Usage analytics

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
┌─────────────────────────────────────────────────────────────────┐
│                        AgentCompiler                             │
├─────────────────────────────────────────────────────────────────┤
│  CLI / API Server                                              │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Scanner  │ Fetcher  │Compressor │ Injector  │ Evaluator        │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Registries  │  │   Cache     │  │    LLM Client       │  │
│  │ (Frameworks)│  │  (Files)    │  │ (OpenAI, Anthropic) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow

```
package.json → Scanner → Detected Frameworks
                                  ↓
                         Fetcher (GitHub/npm)
                                  ↓
                         Raw Documentation
                                  ↓
                         Compressor
                                  ↓
                         Compressed Index
                                  ↓
                         Injector
                                  ↓
                         AGENTS.md (output)
```

### 6.3 Key Modules

| Module | Responsibility |
|--------|----------------|
| `scanner` | Detect frameworks from project files |
| `fetcher` | Fetch documentation from remote sources |
| `compressor` | Compress docs to pipe-delimited format |
| `injector` | Merge into AGENTS.md |
| `evaluator` | Test and measure effectiveness |
| `registries` | Framework definitions and metadata |
| `llm` | LLM provider integration |
| `watcher` | File system monitoring |
| `config` | Configuration management |

---

## 7. Supported Frameworks

### 7.1 Priority 1 (v1.0) - JavaScript/TypeScript

| Framework | Package Match | Status |
|-----------|---------------|--------|
| Next.js | `next` | ✅ Implemented |
| React | `react` | ✅ Implemented |
| Vue.js | `vue` | ✅ Implemented |
| Astro | `astro` | ✅ Implemented |
| SvelteKit | `@sveltejs/kit` | ✅ Implemented |
| Supabase | `@supabase/supabase-js` | ✅ Implemented |
| Tailwind CSS | `tailwindcss` | ✅ Implemented |
| Prisma | `prisma`, `@prisma/client` | ✅ Implemented |
| Drizzle ORM | `drizzle-orm` | ✅ Implemented |
| tRPC | `@trpc/server`, `@trpc/client` | ✅ Implemented |
| Zod | `zod` | ✅ Implemented |
| TanStack Query | `@tanstack/react-query` | ✅ Implemented |
| Nuxt | `nuxt` | ✅ Implemented |
| Remix | `@remix-run/react` | ✅ Implemented |
| Hono | `hono` | ✅ Implemented |
| Effect | `effect` | ✅ Implemented |
| Bun | `bun` | ✅ Implemented |

### 7.2 Priority 2 (v1.1) - Additional JS Frameworks

| Framework | Package Match | Status |
|-----------|---------------|--------|
| Express | `express` | ❌ Missing |
| NestJS | `@nestjs/core` | ❌ Missing |
| Fastify | `fastify` | ❌ Missing |
| Svelte | `svelte` | ❌ Missing |
| Solid | `solid-js` | ❌ Missing |
| Qwik | `@builder.io/qwik` | ❌ Missing |

### 7.3 Priority 3 (v2.0) - Python

| Framework | Package Match | Status |
|-----------|---------------|--------|
| Django | `django` | ❌ Missing |
| FastAPI | `fastapi` | ❌ Missing |
| Flask | `flask` | ❌ Missing |
| SQLAlchemy | `sqlalchemy` | ❌ Missing |
| Pydantic | `pydantic` | ❌ Missing |

### 7.4 Priority 4 (v2.0) - Go

| Framework | Package Match | Status |
|-----------|---------------|--------|
| Gin | `gin-gonic/gin` | ❌ Missing |
| Echo | `labstack/echo` | ❌ Missing |
| Fiber | `gofiber/fiber` | ❌ Missing |
| Chi | `go-chi/chi` | ❌ Missing |

### 7.5 Priority 5 (v2.0) - Other Languages

| Framework | Language | Status |
|-----------|----------|--------|
| Laravel | PHP | ❌ Missing |
| Ruby on Rails | Ruby | ❌ Missing |
| Spring Boot | Java | ❌ Missing |
| Actix | Rust | ❌ Missing |
| Phoenix | Elixir | ❌ Missing |

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
  "conflicts": {
    "react-*": "prefer:nextjs"
  },
  "compression": {
    "format": "pipe-delimited",
    "targetSize": 8192
  },
  "cache": {
    "ttlHours": 168
  },
  "eval": {
    "enabled": true,
    "iterations": 3
  }
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

### Phase 1: Foundation (v1.0)
- [ ] Complete framework coverage (20+ frameworks)
- [ ] Improve compression algorithm
- [ ] Add watch mode
- [ ] Basic evaluation suite

### Phase 2: Expansion (v1.1)
- [ ] Add Python framework support
- [ ] Add Go framework support
- [ ] Local documentation support
- [ ] Plugin system alpha

### Phase 3: Enterprise (v2.0)
- [ ] 50+ framework support
- [ ] Team workspaces
- [ ] API server with auth
- [ ] Audit logging

### Phase 4: Intelligence (v2.1)
- [ ] AI-powered compression optimization
- [ ] Integration with existing benchmarks
- [ ] Custom test task marketplace
- [ ] Performance analytics dashboard

---

## 11. Open Questions

1. **Pricing Model**: Should there be a free tier for the API? What features require payment?
2. **Plugin Ecosystem**: Should we create a marketplace for community plugins?
3. **Framework Prioritization**: Which frameworks should we add next based on user demand?
4. **Benchmark Partnership**: Should we partner with SWE-bench or build our own?

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
| 0.3.0 | 2024-Q4 | Evaluation suite, LLM integration |

---

**Document Status:** Draft for Review  
**Next Review:** TBD  
**Approver:** TBD
