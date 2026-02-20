import { createHash } from 'crypto';
import type { ComposePolicy, ComposeResult, KnowledgeItem } from './types.js';

function stableSort(items: KnowledgeItem[]): KnowledgeItem[] {
    return [...items].sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        if (a.adapter !== b.adapter) return a.adapter.localeCompare(b.adapter);
        return a.id.localeCompare(b.id);
    });
}

function contentFingerprint(content: string): string {
    const normalized = content
        .replace(/\r\n/g, '\n')
        .trim()
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/g, ''))
        .join('\n');

    return createHash('sha256')
        .update(normalized, 'utf-8')
        .digest('hex');
}

/**
 * Deterministically dedupe/sort source items and apply optional byte budget.
 */
export function composeKnowledge(
    items: KnowledgeItem[],
    policy: ComposePolicy = {}
): ComposeResult {
    const deduped = new Map<string, KnowledgeItem>();
    for (const item of stableSort(items)) {
        const key = contentFingerprint(item.content);
        if (!deduped.has(key)) {
            deduped.set(key, item);
        }
    }

    const ordered = Array.from(deduped.values());
    const maxBytes = policy.maxBytes;
    if (maxBytes == null) {
        const totalBytes = ordered.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf-8'), 0);
        return {
            items: ordered,
            dropped: items.length - ordered.length,
            totalBytes,
        };
    }

    const selected: KnowledgeItem[] = [];
    let totalBytes = 0;
    let dropped = items.length - ordered.length;

    for (const item of ordered) {
        const itemBytes = Buffer.byteLength(item.content, 'utf-8');
        if (totalBytes + itemBytes > maxBytes) {
            dropped++;
            continue;
        }
        selected.push(item);
        totalBytes += itemBytes;
    }

    return {
        items: selected,
        dropped,
        totalBytes,
    };
}
