# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-02-18

### Added
- **Universal compile pipeline**: `adapters -> normalize -> compose -> render -> inject`
- **Knowledge base support**: local KB ingestion via config and CLI
- **New KB commands**:
  - `skill-compiler kb-add <path>`
  - `skill-compiler kb-list`
  - `skill-compiler kb-remove <name>`
- **Programmatic universal API**: `compileKnowledge(...)`
- **Deterministic composition**: content-hash dedupe + stable ordering + optional byte budgeting
- **Unit coverage for universal components**: `compose.test.ts`, `kb.test.ts`, `universal.test.ts`

### Changed
- `compileProject(...)` now runs through the universal pipeline while preserving compatibility
- Compile results now expose `knowledgeBaseIndexes` and `dropped` counts
- `list` command now includes configured knowledge bases

---

## [0.3.0] - 2026-01-29

### Added
- **skills.sh integration**: Connect to Vercel's Agent Skills registry
- **`search` command**: Search skills.sh for skills (`skill-compiler search react`)
- **`install` command**: Install skills from skills.sh (`skill-compiler install vercel-labs/agent-skills --skill frontend-design`)
- **`sync` command**: Sync installed skills.sh skills to AGENTS.md
- **`suggest` command**: Get skill suggestions based on your project
- Auto-include skills.sh skills in `compile` output

### Changed
- `list` command now shows both custom and skills.sh skills
- Added `yaml` dependency for parsing SKILL.md frontmatter

---

## [0.2.1] - 2026-01-29

### Added
- **Real LLM evals**: OpenAI integration for running actual agent tasks
- **GitHub Action**: `action.yml` for CI/CD workflows
- **Semantic compression v2**: Includes breaking changes and new API highlights
- **`--simulate` flag**: Run evals with simulated results (no API key needed)

### Changed
- Improved compression format with framework-specific knowledge
- Added ora spinner dependency for better UX

---

## [0.2.0] - 2026-01-29

### Added
- **Config file support**: `.skill-compiler.json` for persistent settings
- **`init` command**: Initialize config with `skill-compiler init`
- **`list` command**: List all custom skills
- **`remove` command**: Remove custom skills
- **`--check` flag**: Verify AGENTS.md is up-to-date (for CI)
- **Custom skill implementation**: Full support for `skill-compiler add <path>`
- **5 new framework registries**: Nuxt, Remix, Hono, Effect, Bun

### Changed
- CLI now respects config file settings (can override with flags)
- Version bumped to 0.2.0

### Framework Support (17 total)
- Next.js, React, Vue.js, Astro, SvelteKit
- Supabase, Tailwind CSS, Prisma, Drizzle ORM
- tRPC, Zod, TanStack Query
- Nuxt, Remix, Hono, Effect, Bun

---

## [0.1.0] - 2026-01-29

### Added
- Initial release
- CLI with `compile`, `watch`, `add`, and `eval` commands
- Framework detection from package.json
- Documentation fetching from GitHub
- Pipe-delimited compression format (Vercel style)
- AGENTS.md injection with user content preservation
- File watcher for auto-updates
- Eval suite with Vercel methodology (Build/Lint/Test metrics)

### Supported Frameworks (12)
- Next.js, React, Vue.js, Astro, SvelteKit
- Supabase, Tailwind CSS, Prisma, Drizzle ORM
- tRPC, Zod, TanStack Query
