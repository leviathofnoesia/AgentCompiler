# JavaScript SDK Example

```js
const baseUrl = "https://agentcompilerapi.up.railway.app";

async function compile(packageJson, apiKey) {
  const response = await fetch(`${baseUrl}/api/v1/compile`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ packageJson }),
  });

  if (!response.ok) throw new Error(`Compile failed: ${response.status}`);
  return response.json();
}
```
