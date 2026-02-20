import { fetchDocs } from '../../fetcher/index.js';
import { scanProject } from '../../scanner/index.js';
import { compressIndex } from '../../compressor/index.js';
import type { AdapterResult, KnowledgeAdapter, KnowledgeItem } from '../types.js';

export const frameworkDocsAdapter: KnowledgeAdapter = {
    id: 'framework-docs',
    async collect(context): Promise<AdapterResult> {
        if (context.config.sources?.frameworkDocs === false) {
            return { items: [], detected: [] };
        }

        const detected = await scanProject(context.cwd, {
            only: context.options.only ?? context.config.only,
            exclude: context.options.exclude ?? context.config.exclude,
            customSkills: context.config.customSkills,
            conflicts: context.config.conflicts,
        });

        const items: KnowledgeItem[] = [];
        for (const skill of detected) {
            try {
                await fetchDocs(skill, {
                    refresh: context.options.refresh,
                    cwd: context.cwd,
                    cacheTtlHours: context.config.cacheTtlHours,
                });

                const content = await compressIndex(skill, {
                    cwd: context.cwd,
                    format: context.config.compression?.format,
                    targetSize: context.config.compression?.targetSize,
                    conflicts: context.config.conflicts,
                });

                items.push({
                    id: `framework:${skill.name}@${skill.version}`,
                    kind: 'framework-index' as const,
                    adapter: 'framework-docs',
                    name: skill.displayName || skill.name,
                    content,
                    priority: skill.source === 'custom' ? 95 : 90,
                    tags: [skill.name, skill.version, skill.source],
                    metadata: {
                        source: skill.source,
                        name: skill.name,
                        version: skill.version,
                    },
                });
            } catch (error) {
                console.error(
                    `Failed to process framework skill ${skill.name}@${skill.version}:`,
                    error
                );
                continue;
            }
        }

        return {
            items,
            detected,
        };
    }
};
