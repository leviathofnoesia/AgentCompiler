import { describe, it, expect } from 'vitest';
import { testGeneratedCode } from '../../src/eval/utils.js';

describe('eval utils', () => {
  it('validates a React snippet with expected API usage', async () => {
    const result = await testGeneratedCode(
      'react',
      'useState',
      "import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(count + 1)}>{count}</button>;\n}\n"
    );

    expect(result.build).toBe(true);
    expect(result.lint).toBe(true);
    expect(result.test).toBe(true);
  });

  it('fails lint when placeholder markers are present', async () => {
    const result = await testGeneratedCode(
      'react',
      'useState',
      "import { useState } from 'react';\n\n// TODO: flesh this out\nexport default function App() {\n  const [count] = useState(0);\n  return <div>{count}</div>;\n}\n"
    );

    expect(result.build).toBe(true);
    expect(result.lint).toBe(false);
    expect(result.test).toBe(true);
  });

  it('fails test validation when expected API signal is missing', async () => {
    const result = await testGeneratedCode(
      'react',
      'useEffect',
      "export default function App() {\n  return <div>Hello</div>;\n}\n"
    );

    expect(result.build).toBe(true);
    expect(result.lint).toBe(true);
    expect(result.test).toBe(false);
  });
});
