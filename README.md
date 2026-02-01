# AgentCompiler (skill-compiler)

> Converts skill/framework documentation into compressed AGENTS.md indexes for AI coding agents

[![npm version](https://badge.fury.io/js/skill-compiler.svg)](https://www.npmjs.com/package/skill-compiler)
[![GitHub](https://img.shields.io/github/license/leviathofnoesia/AgentCompiler)](https://github.com/leviathofnoesia/AgentCompiler)

## 📖 Background

This project is inspired by and based on **Vercel's groundbreaking research**: [AGENTS.md outperforms skills in our agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals).

### Key Findings from Vercel's Study

| Configuration | Pass Rate |
|--------------|-----------|
| Baseline (no docs) | 53% |
| Skills (default) | 53% |
| Skills with instructions | 79% |
| **AGENTS.md docs index** | **100%** |

**Why passive context wins:**
1. **No decision point** - Agents don't need to decide "should I look this up?"
2. **Consistent availability** - Content is in system prompt for every turn
3. **No ordering issues** - Avoids sequencing decisions (read docs first vs explore first)

This tool automates the process of generating these compressed doc indexes for any project.

## 🚀 Quick Start

```bash
# In your project directory
npx skill-compiler
```

This will:
1. 🔍 Detect frameworks from your `package.json`
2. 📥 Download version-matched documentation
3. 📦 Compress into <8KB indexes
4. ✅ Generate/update your `AGENTS.md`

## Usage

```bash
# One-time generation
npx skill-compiler

# Watch mode (auto-update on dependency changes)
npx skill-compiler watch

# Preview without writing
npx skill-compiler --dry-run

# Only specific frameworks
npx skill-compiler --only nextjs,react

# Force refresh cached docs
npx skill-compiler --refresh

# Add custom skill
npx skill-compiler add ./my-skill-docs/

# Run evaluation suite
npx skill-compiler eval

# Run comprehensive evaluation with LLM integration
npx skill-compiler eval:comprehensive

# Run evaluation with specific provider
npx skill-compiler eval --provider anthropic --api-key sk-ant-...
```

## LLM Integration

AgentCompiler now supports real LLM integration for comprehensive evaluation:

### Supported Providers
| Provider | Models | API Key Requirement |
|----------|--------|-------------------|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-4 | Yes (OPENAI_API_KEY) |
| Anthropic | claude-3.5-sonnet, claude-3.5-haiku | Yes (ANTHROPIC_API_KEY) |
| Google | gemini-1.5-pro, gemini-1.5-flash | Yes (GOOGLE_API_KEY) |
| Mistral | mistral-large, mistral-small, mistral-medium | Yes (MISTRAL_API_KEY) |
| Ollama | llama3.1, mistral, codellama, gemma2 | No |
| Groq | llama-3.1-70b-versatile, mixtral-8x7b | Yes (GROQ_API_KEY) |
| Perplexity | llama-3.1-sonar-large-128k | Yes (PERPLEXITY_API_KEY) |

### Usage Examples
```bash
# OpenAI (default)
npx skill-compiler eval --framework nextjs --api-key sk-...

# Anthropic Claude
npx skill-compiler eval --framework nextjs --provider anthropic --api-key sk-ant-...

# Local Ollama (no API key needed)
npx skill-compiler eval --framework nextjs --provider ollama --model llama3

# Google Gemini
npx skill-compiler eval --framework nextjs --provider google --api-key sk-...

# Mistral AI
npx skill-compiler eval --framework nextjs --provider mistral --api-key sk-...
```

## Supported Frameworks

| Framework | Package Match |
|-----------|--------------|
| Next.js | `next` |
| React | `react` |
| Vue.js | `vue` |
| Astro | `astro` |
| SvelteKit | `@sveltejs/kit` |
| Supabase | `@supabase/supabase-js` |
| Tailwind CSS | `tailwindcss` |
| Prisma | `prisma`, `@prisma/client` |
| Drizzle ORM | `drizzle-orm` |
| tRPC | `@trpc/server`, `@trpc/client` |
| Zod | `zod` |
| TanStack Query | `@tanstack/react-query` |

## Generated Output

The tool generates a managed section in your `AGENTS.md`:

```markdown
<!-- BEGIN SKILL-COMPILER MANAGED SECTION -->

## Framework Documentation Indexes

[Next.js Docs Index]|root: ./.agent-docs/nextjs
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for Next.js tasks.
|01-app\01-getting-started:{01-installation.mdx,02-project-structure.mdx,...}
|...

<!-- END SKILL-COMPILER MANAGED SECTION -->
```

Your existing AGENTS.md content is preserved—only the managed section is updated.

## Evaluation Suite

Run Vercel-methodology evals to verify improvements:

```bash
npx skill-compiler eval
```

Outputs Build, Lint, Test, and Pass Rate metrics comparing baseline vs AGENTS.md configurations.

## How It Works

1. **Scanner** - Detects frameworks from `package.json`, `.agent/skills/`, and config files
2. **Fetcher** - Downloads version-matched docs from GitHub (cached for 7 days)
3. **Compressor** - Compresses to <8KB using pipe-delimited format
4. **Injector** - Merges into AGENTS.md while preserving user content

## Configuration

Create `.skill-compiler.json` to customize behavior:

```json
{
  "out": "./AGENTS.md",
  "only": ["nextjs", "react"],
  "conflicts": {
    "hooks/*": "prefer:react"
  }
}
```

## Background Automation

### npm postinstall
```json
{
  "scripts": {
    "postinstall": "skill-compiler --silent"
  }
}
```

### Watch mode with dev server
```json
{
  "scripts": {
    "dev": "concurrently 'next dev' 'skill-compiler watch'"
  }
}
```

### Git pre-commit hook
```bash
# .husky/pre-commit
npx skill-compiler --check || exit 1
```

## 🙏 Acknowledgments

This project would not exist without the research and insights from:

- **[Vercel](https://vercel.com)** - For their comprehensive research on AGENTS.md vs skills, published in [this blog post](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- **[Jude Gao](https://twitter.com/gao_jude)** - Research and evals at Vercel
- **[Next.js Team](https://nextjs.org)** - For the `@next/codemod agents-md` implementation that inspired the compression format
- **[AGENTS.md Standard](https://agents.md/)** - For establishing the convention for agent context files
- **[Agent Skills](https://agentskills.io/)** - For the skills standard that drove the comparative research

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to contribute:
- Add new framework registries
- Improve compression algorithms
- Enhance the eval suite with LLM integration
- Report bugs and suggest features
- Improve documentation

## 📄 License

MIT
