# AgentCompiler Skill Guide

> Proactively use AgentCompiler to evaluate AI models and frameworks with natural language commands. Master the CLI and integrate with skills.sh for seamless AI development workflows.

## Overview

AgentCompiler is a powerful tool that converts framework documentation into compressed `AGENTS.md` indexes, enabling AI coding agents to perform at their best. This skill enables you to run comprehensive evaluations across multiple AI models and frameworks.

## Quick Start

```bash
# Install AgentCompiler
npm install -g skill-compiler

# Initialize configuration
skill-compiler init

# Run evaluation (simulation mode)
skill-compiler eval --framework nextjs --simulate

# Run comprehensive evaluation
skill-compiler eval:comprehensive --simulate
```

## Core Commands

### Evaluation Suite
```bash
# Basic evaluation
skill-compiler eval --framework nextjs --simulate

# With specific model
skill-compiler eval --framework react --model gpt-4o --simulate

# With provider (Anthropic Claude)
skill-compiler eval --framework nextjs --provider anthropic --api-key sk-ant-... --simulate

# Comprehensive evaluation across all detected frameworks
skill-compiler eval:comprehensive --simulate
```

### Framework-Specific Tests
```bash
# Next.js App Router features
skill-compiler eval --framework nextjs --simulate

# React 18 Hooks and Concurrent Features
skill-compiler eval --framework react --simulate

# Custom framework (if detected)
skill-compiler eval --framework astro --simulate
```

### Configuration & Management
```bash
# Initialize with custom output path
skill-compiler init --out ./my-agents.md

# Add custom skill documentation
skill-compiler add ./my-skill-docs/

# List all available skills
skill-compiler list

# Search skills.sh registry
skill-compiler search nextjs
```

## LLM Provider Integration

### Supported Providers
| Provider | Models | API Key Requirement | Notes |
|----------|--------|-------------------|-------|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-4 | Yes (OPENAI_API_KEY) | Default |
| Anthropic | claude-3.5-sonnet, claude-3.5-haiku | Yes (ANTHROPIC_API_KEY) | Claude models |
| Google | gemini-1.5-pro, gemini-1.5-flash | Yes (GOOGLE_API_KEY) | Gemini models |
| Mistral | mistral-large, mistral-small, mistral-medium | Yes (MISTRAL_API_KEY) | Mistral AI |
| Ollama | llama3.1, mistral, codellama, gemma2 | No | Local models |
| Groq | llama-3.1-70b-versatile, mixtral-8x7b | Yes (GROQ_API_KEY) | Groq |
| Perplexity | llama-3.1-sonar-large-128k | Yes (PERPLEXITY_API_KEY) | Perplexity AI |

### Usage Examples
```bash
# OpenAI (default)
skill-compiler eval --framework nextjs --api-key sk-...

# Anthropic Claude
skill-compiler eval --framework nextjs --provider anthropic --api-key sk-ant-...

# Local Ollama (no API key needed)
skill-compiler eval --framework nextjs --provider ollama --model llama3

# Google Gemini
skill-compiler eval --framework nextjs --provider google --api-key sk-...

# Mistral AI
skill-compiler eval --framework nextjs --provider mistral --api-key sk-...
```

## Advanced Usage

### Custom Evaluation Configuration
```bash
# Run specific number of iterations
skill-compiler eval --framework nextjs --iterations 5 --simulate

# Set timeout for each task
skill-compiler eval --framework nextjs --timeout 120 --simulate

# Save results to file
skill-compiler eval --framework nextjs --output results.json --simulate
```

### Skills.sh Integration
```bash
# Search for skills
skill-compiler search "nextjs testing"

# Install a skill from skills.sh
skill-compiler install vercel/next.js --skill nextjs

# Sync installed skills to AGENTS.md
skill-compiler sync

# Get suggestions based on your project
skill-compiler suggest
```

## Proactive Evaluation Strategy

### 1. Setup Evaluation Environment
```bash
# Initialize AgentCompiler
skill-compiler init

# Install necessary dependencies
npm install -g skill-compiler

# Set up API keys (environment variables)
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Run Baseline Evaluation
```bash
# Test without AGENTS.md context (baseline)
skill-compiler eval --framework nextjs --compare baseline --simulate
```

### 3. Run AGENTS.md Evaluation
```bash
# Test with AGENTS.md context (proactive)
skill-compiler eval --framework nextjs --compare agents-md --simulate
```

### 4. Compare Results
```bash
# Run comprehensive comparison
skill-compiler eval:comprehensive --simulate
```

### 5. Analyze Results
```bash
# Check compression statistics
skill-compiler stats

# View detailed results
cat results.json
```

## Best Practices

### Performance Optimization
```bash
# Use simulation mode for development
skill-compiler eval --simulate

# Limit iterations for quick testing
skill-compiler eval --iterations 3

# Use appropriate timeout
skill-compiler eval --timeout 60
```

### Cost Management
```bash
# Track token usage
skill-compiler eval --output results.json

# Analyze token consumption in results
cat results.json | grep "tokensUsed"
```

### Framework Selection
```bash
# Choose frameworks based on project needs
skill-compiler eval --framework nextjs  # Next.js apps
skill-compiler eval --framework react   # React apps
skill-compiler eval --framework vue    # Vue.js apps
```

## Troubleshooting

### Common Issues
```bash
# Connection errors
skill-compiler eval --provider openai --api-key invalid-key
# Error: API key validation failed

# Model not available
skill-compiler eval --provider openai --model invalid-model
# Error: Model not available for provider

# Network issues
skill-compiler eval --provider openai --api-key sk-... --simulate
# Error: Network connection failed
```

### Solutions
```bash
# Verify API key
echo $OPENAI_API_KEY

# Check model availability
skill-compiler eval --provider openai --model gpt-4o

# Use simulation mode for testing
skill-compiler eval --simulate
```

# AgentCompiler Skill Guide

> Proactively use AgentCompiler to evaluate AI models and frameworks with natural language commands. Master the CLI and integrate with skills.sh for seamless AI development workflows.

## Overview

AgentCompiler is a powerful tool that converts framework documentation into compressed `AGENTS.md` indexes, enabling AI coding agents to perform at their best. This skill enables you to run comprehensive evaluations across multiple AI models and frameworks.

## Quick Start

```bash
# Install AgentCompiler
npm install -g skill-compiler

# Initialize configuration
skill-compiler init

# Run evaluation (simulation mode)
skill-compiler eval --framework nextjs --simulate

# Run comprehensive evaluation
skill-compiler eval:comprehensive --simulate
```

## Core Commands

### Evaluation Suite
```bash
# Basic evaluation
skill-compiler eval --framework nextjs --simulate

# With specific model
skill-compiler eval --framework react --model gpt-4o --simulate

# With provider (Anthropic Claude)
skill-compiler eval --framework nextjs --provider anthropic --api-key sk-ant-... --simulate

# Comprehensive evaluation across all detected frameworks
skill-compiler eval:comprehensive --simulate
```

### Framework-Specific Tests
```bash
# Next.js App Router features
skill-compiler eval --framework nextjs --simulate

# React 18 Hooks and Concurrent Features
skill-compiler eval --framework react --simulate

# Custom framework (if detected)
skill-compiler eval --framework astro --simulate
```

### Configuration & Management
```bash
# Initialize with custom output path
skill-compiler init --out ./my-agents.md

# Add custom skill documentation
skill-compiler add ./my-skill-docs/

# List all available skills
skill-compiler list

# Search skills.sh registry
skill-compiler search nextjs
```

## LLM Provider Integration

### Supported Providers
| Provider | Models | API Key Requirement | Notes |
|----------|--------|-------------------|-------|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-4 | Yes (OPENAI_API_KEY) | Default |
| Anthropic | claude-3.5-sonnet, claude-3.5-haiku | Yes (ANTHROPIC_API_KEY) | Claude models |
| Google | gemini-1.5-pro, gemini-1.5-flash | Yes (GOOGLE_API_KEY) | Gemini models |
| Mistral | mistral-large, mistral-small, mistral-medium | Yes (MISTRAL_API_KEY) | Mistral AI |
| Ollama | llama3.1, mistral, codellama, gemma2 | No | Local models |
| Groq | llama-3.1-70b-versatile, mixtral-8x7b | Yes (GROQ_API_KEY) | Groq |
| Perplexity | llama-3.1-sonar-large-128k | Yes (PERPLEXITY_API_KEY) | Perplexity AI |

### Usage Examples
```bash
# OpenAI (default)
skill-compiler eval --framework nextjs --api-key sk-...

# Anthropic Claude
skill-compiler eval --framework nextjs --provider anthropic --api-key sk-ant-...

# Local Ollama (no API key needed)
skill-compiler eval --framework nextjs --provider ollama --model llama3

# Google Gemini
skill-compiler eval --framework nextjs --provider google --api-key sk-...

# Mistral AI
skill-compiler eval --framework nextjs --provider mistral --api-key sk-...
```

## Advanced Usage

### Custom Evaluation Configuration
```bash
# Run specific number of iterations
skill-compiler eval --framework nextjs --iterations 5 --simulate

# Set timeout for each task
skill-compiler eval --framework nextjs --timeout 120 --simulate

# Save results to file
skill-compiler eval --framework nextjs --output results.json --simulate
```

### Skills.sh Integration
```bash
# Search for skills
skill-compiler search "nextjs testing"

# Install a skill
skill-compiler install vercel/next.js --skill nextjs

# Sync installed skills to AGENTS.md
skill-compiler sync

# Get suggestions based on your project
skill-compiler suggest
```

## Proactive Evaluation Strategy

### 1. Setup Evaluation Environment
```bash
# Initialize AgentCompiler
skill-compiler init

# Install necessary dependencies
npm install -g skill-compiler

# Set up API keys (environment variables)
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Run Baseline Evaluation
```bash
# Test without AGENTS.md context (baseline)
skill-compiler eval --framework nextjs --compare baseline --simulate
```

### 3. Run AGENTS.md Evaluation
```bash
# Test with AGENTS.md context (proactive)
skill-compiler eval --framework nextjs --compare agents-md --simulate
```

### 4. Compare Results
```bash
# Run comprehensive comparison
skill-compiler eval:comprehensive --simulate
```

### 5. Analyze Results
```bash
# Check compression statistics
skill-compiler stats

# View detailed results
cat results.json
```

## Best Practices

### Performance Optimization
```bash
# Use simulation mode for development
skill-compiler eval --simulate

# Limit iterations for quick testing
skill-compiler eval --iterations 3

# Use appropriate timeout
skill-compiler eval --timeout 60
```

### Cost Management
```bash
# Track token usage
skill-compiler eval --output results.json

# Analyze token consumption in results
cat results.json | grep "tokensUsed"
```

### Framework Selection
```bash
# Choose frameworks based on project needs
skill-compiler eval --framework nextjs  # Next.js apps
skill-compiler eval --framework react   # React apps
skill-compiler eval --framework vue    # Vue.js apps
```

## Troubleshooting

### Common Issues
```bash
# Connection errors
skill-compiler eval --provider openai --api-key invalid-key
# Error: API key validation failed

# Model not available
skill-compiler eval --provider openai --model invalid-model
# Error: Model not available for provider

# Network issues
skill-compiler eval --provider openai --api-key sk-... --simulate
# Error: Network connection failed
```

### Solutions
```bash
# Verify API key
echo $OPENAI_API_KEY

# Check model availability
skill-compiler eval --provider openai --model gpt-4o

# Use simulation mode for testing
skill-compiler eval --simulate
```

## Self-Evaluation: AgentCompiler on Itself

### Step 1: First Integration - Use AgentCompiler on Its Own Skill.md
Before using AgentCompiler on other projects, the agent should first integrate its own knowledge by running AgentCompiler on the `skill.md` file:

```bash
# Run AgentCompiler on its own skill.md to create compressed AGENTS.md
skill-compiler add ./skill.md --out ./AGENTS.md
skill-compiler sync
```

This creates a compressed `AGENTS.md` index from the skill documentation, enabling the agent to understand and use AgentCompiler more effectively. The output file location can be customized using the `--out` flag.

### Step 2: Evaluate AgentCompiler's Effectiveness
Run AgentCompiler to evaluate its own effectiveness by testing it on different AI models:

```bash
# Evaluate AgentCompiler using OpenAI
skill-compiler eval --framework nextjs --api-key sk-...

# Evaluate using Anthropic Claude
skill-compiler eval --framework nextjs --provider anthropic --api-key sk-ant-...

# Compare performance across providers
skill-compiler eval:comprehensive
```

This creates a feedback loop where you can measure how well different AI models perform with the AgentCompiler-generated documentation, helping you choose the best model for your specific needs.

### Step 3: Continuous Improvement
```bash
# Update the skill.md and regenerate AGENTS.md
skill-compiler add ./skill.md
skill-compiler sync

# Re-evaluate with the updated knowledge
skill-compiler eval:comprehensive
```

## Skills.sh Integration

AgentCompiler automatically supports skills.sh for discovering and installing additional skills:

```bash
# Search for relevant skills
skill-compiler search "react testing"

# Install a skill
skill-compiler install user/repo --skill skill-name

# Sync skills to AGENTS.md
skill-compiler sync

# Get personalized suggestions
skill-compiler suggest
```

This integration ensures you always have access to the latest and most relevant AI development tools for your projects.