# Contributing to AgentCompiler

Thank you for your interest in contributing! This project is based on [Vercel's research](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) demonstrating that AGENTS.md achieves superior results for AI coding agents.

## Ways to Contribute

### 1. Add Framework Registries

Want to add support for a new framework? Edit `src/registries/index.ts`:

```typescript
{
  name: 'your-framework',
  displayName: 'Your Framework',
  packageMatch: ['your-package'],
  configMatch: ['your-config.*'],
  docSource: {
    type: 'github',
    repo: 'org/repo',
    path: 'docs',
    branch: 'main',
  },
  includes: ['**/*.md', '**/*.mdx'],
  priority: ['guides', 'api'],
}
```

### 2. Improve Compression

The compressor in `src/compressor/index.ts` targets <8KB indexes. Ideas:
- Better path abbreviation algorithms
- Smarter section prioritization
- Alternative compression formats

### 3. Enhance Eval Suite

The eval suite in `src/eval/index.ts` uses Vercel's methodology. Help by:
- Adding more framework-specific test cases
- Implementing actual LLM-based evals (currently simulated)
- Improving metrics and reporting

### 4. Bug Reports & Feature Requests

Open an issue with:
- Clear description of the problem/feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior

## Development Setup

```bash
# Clone the repo
git clone https://github.com/leviathofnoesia/AgentCompiler.git
cd AgentCompiler

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.js --help
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `npm run build` to ensure it compiles
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Code Style

- Use TypeScript
- Follow existing patterns in the codebase
- Add JSDoc comments for exported functions
- Keep files focused and modular

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
