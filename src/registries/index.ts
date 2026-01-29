/**
 * Framework Registries
 * Defines how to fetch and process documentation for each framework
 */

export interface FrameworkRegistry {
    name: string;
    displayName: string;
    packageMatch: string[];
    configMatch?: string[];
    docSource: {
        type: 'github' | 'npm' | 'url';
        repo?: string;
        path?: string;
        branch?: string;
        url?: string;
    };
    versionMapping?: Record<string, string>;
    includes?: string[];
    excludes?: string[];
    priority?: string[];
}

export const registries: FrameworkRegistry[] = [
    {
        name: 'nextjs',
        displayName: 'Next.js',
        packageMatch: ['next'],
        configMatch: ['next.config.*'],
        docSource: {
            type: 'github',
            repo: 'vercel/next.js',
            path: 'docs',
            branch: 'canary',
        },
        versionMapping: {
            '16': 'canary',
            '15': 'v15.0.0',
            '14': 'v14.0.0',
            '13': 'v13.0.0',
        },
        includes: ['**/*.mdx'],
        excludes: ['**/examples/**'],
        priority: ['app', 'api-reference', 'routing'],
    },
    {
        name: 'react',
        displayName: 'React',
        packageMatch: ['react'],
        docSource: {
            type: 'github',
            repo: 'reactjs/react.dev',
            path: 'src/content',
            branch: 'main',
        },
        includes: ['**/*.md', '**/*.mdx'],
        priority: ['reference', 'learn'],
    },
    {
        name: 'supabase',
        displayName: 'Supabase',
        packageMatch: ['@supabase/supabase-js'],
        docSource: {
            type: 'github',
            repo: 'supabase/supabase',
            path: 'apps/docs/content',
            branch: 'master',
        },
        includes: ['**/*.mdx'],
        priority: ['guides', 'reference'],
    },
    {
        name: 'tailwindcss',
        displayName: 'Tailwind CSS',
        packageMatch: ['tailwindcss'],
        configMatch: ['tailwind.config.*'],
        docSource: {
            type: 'github',
            repo: 'tailwindlabs/tailwindcss.com',
            path: 'src/pages/docs',
            branch: 'master',
        },
        includes: ['**/*.mdx'],
    },
    {
        name: 'prisma',
        displayName: 'Prisma',
        packageMatch: ['prisma', '@prisma/client'],
        configMatch: ['prisma/schema.prisma'],
        docSource: {
            type: 'github',
            repo: 'prisma/docs',
            path: 'content',
            branch: 'main',
        },
        includes: ['**/*.mdx'],
        priority: ['orm', 'reference'],
    },
    {
        name: 'vue',
        displayName: 'Vue.js',
        packageMatch: ['vue'],
        configMatch: ['vue.config.*', 'vite.config.*'],
        docSource: {
            type: 'github',
            repo: 'vuejs/docs',
            path: 'src',
            branch: 'main',
        },
        includes: ['**/*.md'],
        priority: ['guide', 'api'],
    },
    {
        name: 'astro',
        displayName: 'Astro',
        packageMatch: ['astro'],
        configMatch: ['astro.config.*'],
        docSource: {
            type: 'github',
            repo: 'withastro/docs',
            path: 'src/content/docs',
            branch: 'main',
        },
        includes: ['**/*.mdx'],
        priority: ['guides', 'reference'],
    },
    {
        name: 'sveltekit',
        displayName: 'SvelteKit',
        packageMatch: ['@sveltejs/kit'],
        configMatch: ['svelte.config.*'],
        docSource: {
            type: 'github',
            repo: 'sveltejs/kit',
            path: 'documentation/docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
    },
    {
        name: 'drizzle',
        displayName: 'Drizzle ORM',
        packageMatch: ['drizzle-orm'],
        configMatch: ['drizzle.config.*'],
        docSource: {
            type: 'github',
            repo: 'drizzle-team/drizzle-orm',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md', '**/*.mdx'],
    },
    {
        name: 'trpc',
        displayName: 'tRPC',
        packageMatch: ['@trpc/server', '@trpc/client'],
        docSource: {
            type: 'github',
            repo: 'trpc/trpc',
            path: 'www/docs',
            branch: 'main',
        },
        includes: ['**/*.md', '**/*.mdx'],
    },
    {
        name: 'zod',
        displayName: 'Zod',
        packageMatch: ['zod'],
        docSource: {
            type: 'github',
            repo: 'colinhacks/zod',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
    },
    {
        name: 'tanstack-query',
        displayName: 'TanStack Query',
        packageMatch: ['@tanstack/react-query', '@tanstack/vue-query'],
        docSource: {
            type: 'github',
            repo: 'TanStack/query',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
        priority: ['framework/react', 'guides'],
    },
    // ========== v0.2.0 Additions ==========
    {
        name: 'nuxt',
        displayName: 'Nuxt',
        packageMatch: ['nuxt'],
        configMatch: ['nuxt.config.*'],
        docSource: {
            type: 'github',
            repo: 'nuxt/nuxt',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
        priority: ['guide', 'api'],
    },
    {
        name: 'remix',
        displayName: 'Remix',
        packageMatch: ['@remix-run/react', '@remix-run/node'],
        docSource: {
            type: 'github',
            repo: 'remix-run/remix',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
        priority: ['guides', 'api'],
    },
    {
        name: 'hono',
        displayName: 'Hono',
        packageMatch: ['hono'],
        docSource: {
            type: 'github',
            repo: 'honojs/hono',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
    },
    {
        name: 'effect',
        displayName: 'Effect',
        packageMatch: ['effect', '@effect/platform'],
        docSource: {
            type: 'github',
            repo: 'Effect-TS/effect',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md', '**/*.mdx'],
    },
    {
        name: 'bun',
        displayName: 'Bun',
        packageMatch: ['bun'],
        configMatch: ['bunfig.toml'],
        docSource: {
            type: 'github',
            repo: 'oven-sh/bun',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
        priority: ['api', 'runtime'],
    },
];

/**
 * Get registry by name
 */
export function getRegistry(name: string): FrameworkRegistry | undefined {
    return registries.find(r => r.name === name);
}

/**
 * Get all registry names
 */
export function getRegistryNames(): string[] {
    return registries.map(r => r.name);
}
