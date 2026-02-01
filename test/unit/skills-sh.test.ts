import { describe, it, expect } from 'vitest';
import { searchSkills, getSuggestedSkills } from '../../src/skills-sh/index.js';

describe('skills.sh Integration', () => {
  it('should search for skills', async () => {
    const results = await searchSkills('react');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('vercel-react-best-practices');
    expect(results[0].repo).toBe('vercel-labs/agent-skills');
    expect(results[0].downloads).toBe(86600);
  });

  it('should get skill suggestions based on frameworks', () => {
    const suggestions = getSuggestedSkills(['nextjs', 'react']);
    expect(suggestions).toHaveLength(3); // Should return combined suggestions
    const suggestionNames = suggestions.map(s => s.name);
    expect(suggestionNames).toContain('next-best-practices');
    expect(suggestionNames).toContain('vercel-react-best-practices');
    expect(suggestionNames).toContain('frontend-design');
  });

  it('should handle empty search query', async () => {
    const results = await searchSkills('');
    expect(results).toHaveLength(10); // Should return all popular skills
  });

  it('should handle framework-specific suggestions', () => {
    const suggestions = getSuggestedSkills(['supabase']);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].name).toBe('supabase-postgres-best-practices');
  });
});