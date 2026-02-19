import { syncSkillsToAgentsMd } from '../../skills-sh/index.js';
import type { AdapterResult, KnowledgeAdapter } from '../types.js';

export const skillsShAdapter: KnowledgeAdapter = {
    id: 'skills-sh',
    async collect(context): Promise<AdapterResult> {
        if (context.options.includeSkillsSh === false) {
            return { items: [] };
        }
        if (context.config.sources?.skillsSh === false) {
            return { items: [] };
        }

        const indexes = await syncSkillsToAgentsMd(context.cwd);
        const items = indexes.map((content, index) => ({
            id: `skills-sh:${index + 1}`,
            kind: 'skills-sh-index' as const,
            adapter: 'skills-sh',
            name: `skills.sh-${index + 1}`,
            content,
            priority: 70,
            tags: ['skills.sh'],
        }));

        return { items };
    }
};
