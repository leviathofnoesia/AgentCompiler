# Skill Creation Guide

This guide explains how to create custom skills for AgentCompiler.

## Overview

Skills are documentation packages that AgentCompiler compresses into optimized `AGENTS.md` indexes.
They can be:
1. **Local Custom Skills** (in your project)
2. **Shared Skills** (published to a registry)

## 1. Local Custom Skills

Create a folder in your project (e.g., `my-skill/`) with a `README.md` or `SKILL.md`.

### Structure

```
my-skill/
├── SKILL.md       # Main documentation
└── examples/      # Optional examples
    └── demo.ts
```

### SKILL.md Format

Use standard Markdown. The compiler will extract headings and content.

```markdown
---
name: my-custom-skill
description: Helper functions for my project
---

# My Custom Skill

## Usage

Description of how to use the skill.

## API Reference

### myFunction()

Details about the function.
```

### Adding to Project

Use the CLI to add your local skill:

```bash
npx skill-compiler add ./my-skill/
```

This copies it to `.agent-docs/custom/` and adds it to configuration.

## 2. Creating a Shareable Skill

To share a skill, host it in a Git repository.

### Repository Structure

```
repo/
├── SKILL.md       # Required
├── README.md      # Optional (for humans)
└── package.json   # Optional (if it's an npm package)
```

### Installing

Users can install it via:

```bash
npx skill-compiler install github-user/repo
```

## Best Practices for AI Context

1. **Be Concise**: Agents prefer dense information.
2. **Use Types**: TypeScript interfaces are high-value context.
3. **Show, Don't Just Tell**: Include brief code examples.
4. **Prioritize**: Put the most important APIs first.

## Template

```markdown
---
name: skill-name
description: Brief description
---

# Skill Name

## Overview
High-level purpose.

## Core Concepts
- **Concept A**: Description
- **Concept B**: Description

## API
### `function(arg: Type): ReturnType`
Description.

## Examples
```ts
// Example code
```
```
