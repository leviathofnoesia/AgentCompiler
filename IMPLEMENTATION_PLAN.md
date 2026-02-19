# AgentCompiler - Implementation Plan

> **Version:** 1.1  
> **Last Updated:** February 18, 2026

---

## Overview

This plan tracks the universal-tool architecture now in place and defines the next practical execution path.

Current shipped core:
- Universal compile pipeline: `adapters -> normalize -> compose -> render -> inject`
- Adapter families: framework docs, skills.sh, local knowledge bases
- Deterministic composition: stable ordering + content-hash dedupe + optional byte budget
- KB management commands: `kb-add`, `kb-list`, `kb-remove`

---

## Current State (Implemented)

### Universal Pipeline
- `src/universal/compile.ts`
- `src/universal/adapters/framework.ts`
- `src/universal/adapters/skills-sh.ts`
- `src/universal/adapters/knowledge-base.ts`
- `src/universal/compose.ts`

### Tooling Surface
- `compileProject(...)` now runs through universal compiler (backward compatible result shape)
- CLI includes KB commands and source-aware output messages
- Config supports:
  - `sources.frameworkDocs|skillsSh|knowledgeBases`
  - `knowledgeBases[]` entries

### Tests Added
- `test/unit/compose.test.ts`
- `test/unit/kb.test.ts`
- `test/unit/universal.test.ts`
- `test/integration/cli.test.ts` includes KB flow coverage

---

## Phase 1: Hardening (Next)

### 1.1 Composition Policy Controls
**Priority:** High | **Effort:** Medium

Add explicit per-source and global policy knobs:
- Per-source byte budgets
- Min/max retained items per source family
- Conflict preference at source-family level

Deliverables:
- `compose` policy schema in config
- Policy-aware compose tests

### 1.2 Provenance and Explainability
**Priority:** High | **Effort:** Medium

Expose why each block was included:
- Source adapter ID
- Original path/repo reference
- Priority and dedupe decisions

Deliverables:
- Optional provenance metadata export
- `--explain` mode for compile

### 1.3 Output Stability Guarantees
**Priority:** High | **Effort:** Low

Improve CI reliability:
- Golden snapshots for composed output ordering
- Strict normalization for path separators and line endings

Deliverables:
- Snapshot tests for universal output
- Determinism guard in CI workflow

---

## Phase 2: Coverage + Quality

### 2.1 Framework Registry Expansion
**Priority:** High | **Effort:** Medium

Grow to 50+ frameworks with quality gates:
- Registry correctness checks
- Doc source health checks
- Coverage tracking by ecosystem

### 2.2 Compression Quality Improvements
**Priority:** High | **Effort:** Medium

Improve information density while respecting size constraints:
- Better section salience scoring
- Smarter truncation strategy under budget
- Optional framework-specific summarizers

### 2.3 Evaluation Expansion
**Priority:** Medium | **Effort:** Medium

Increase eval representativeness:
- Framework-specific task suites beyond baseline
- Cross-source eval runs (framework-only vs framework+KB vs all)

---

## Phase 3: Enterprise Controls

### 3.1 Source Policy Enforcement
**Priority:** Medium | **Effort:** Medium

- Allowlist/denylist by source family and path
- Policy templates for teams

### 3.2 Audit and Traceability
**Priority:** Medium | **Effort:** Medium

- Compile event logs with input/output hashes
- Provenance manifest artifact generation

### 3.3 API Surface Maturity
**Priority:** Medium | **Effort:** Medium

- Remote compile and eval endpoints
- Policy-safe server mode for CI platforms

---

## Implementation Checklist

### Immediate
- [ ] Add `compose` policy block to config
- [ ] Implement per-source budget allocation
- [ ] Add provenance payload support (`--explain`)
- [ ] Add universal output snapshot tests

### Near-Term
- [ ] Registry health checker
- [ ] Compression scoring improvements
- [ ] Cross-source eval presets

### Later
- [ ] Team policy profiles
- [ ] Audit manifest generation
- [ ] API endpoint parity with CLI

---

## Dependencies & Prerequisites

1. Node.js 18+
2. TypeScript 5.x
3. Vitest
4. Existing universal pipeline modules in `src/universal/*`

---

## Working Rules

1. Keep `compileProject` backward compatible unless a major version bump is planned.
2. Preserve deterministic output ordering for all new features.
3. Add tests for every adapter/policy extension.
4. Update `README.md`, `SPEC.md`, and `CHANGELOG.md` with any user-facing behavior change.

---

**Document Status:** Active  
**Next Review:** March 2026
