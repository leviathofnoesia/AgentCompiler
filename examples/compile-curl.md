# cURL Example

```bash
curl -X POST https://agentcompilerapi.up.railway.app/api/v1/compile \
  -H "Content-Type: application/json" \
  -H "x-api-key: moltbook_..." \
  -d '{"packageJson":"{\"dependencies\":{\"next\":\"latest\"}}"}'
```
