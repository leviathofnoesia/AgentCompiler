# Changelog

All notable changes to this project will be documented in this file.

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
