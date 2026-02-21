# AgentCompiler

## Project Structure Update (Important)

AgentCompiler is moving to a clearer open/public + hosted/private model.

### Repositories
- **AgentCompiler (this repo):** public docs, SDK examples, and integration guides
- **AgentCompiler API:** managed hosted product and production operations
- **AgentCompiler Skill:** installable skill package for skills.sh and ClawHub

### What this means
- This repo remains public and useful for integration.
- Production-grade API internals, billing, and platform reliability features are now maintained in the hosted product codebase.
- Public users still get full API documentation and SDK examples; hosted usage remains the recommended path for production workloads.

If you’re integrating today, start here:
- Docs: `/docs`
- API reference: `/openapi/openapi.yaml`
- Skill install: see `agentcompiler-api-skill` repo

## Hosted API Required

The managed AgentCompiler API is the supported production path.

- Production base URL: `https://agentcompilerapi.up.railway.app`
- Dashboard: `https://agentcompilerapi.up.railway.app/dashboard/`
- Agent view: `https://agentcompilerapi.up.railway.app/agent.html`

## Quick Links

- Integration docs: [`docs/INTEGRATION.md`](docs/INTEGRATION.md)
- SDK examples: [`sdk/examples`](sdk/examples)
- API schema: [`openapi/openapi.yaml`](openapi/openapi.yaml)
- Skill repo: `https://github.com/leviathofnoesia/agentcompiler-api-skill`

## OSS Baseline

Historical open-source backbone snapshot is tagged at:

- `v1-oss-freeze`
