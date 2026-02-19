import { describe, it, expect } from 'vitest';
import { composeKnowledge } from '../../src/universal/compose.js';

describe('Knowledge Composition', () => {
  it('should dedupe identical knowledge payloads deterministically', () => {
    const result = composeKnowledge([
      {
        id: 'a',
        adapter: 'framework-docs',
        kind: 'framework-index',
        name: 'A',
        content: '[A]\n|same',
        priority: 90,
      },
      {
        id: 'b',
        adapter: 'knowledge-base',
        kind: 'knowledge-base-index',
        name: 'B',
        content: '[A]\n|same',
        priority: 80,
      },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.dropped).toBe(1);
  });

  it('should enforce max byte budgets', () => {
    const result = composeKnowledge([
      {
        id: 'a',
        adapter: 'framework-docs',
        kind: 'framework-index',
        name: 'A',
        content: '1234567890',
        priority: 90,
      },
      {
        id: 'b',
        adapter: 'knowledge-base',
        kind: 'knowledge-base-index',
        name: 'B',
        content: 'abcdefghij',
        priority: 80,
      },
    ], { maxBytes: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.totalBytes).toBe(10);
    expect(result.dropped).toBe(1);
  });
});
