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
    // ========== v1.1 Additions - Additional JavaScript Frameworks ==========
    {
        name: 'express',
        displayName: 'Express.js',
        packageMatch: ['express'],
        docSource: {
            type: 'github',
            repo: 'expressjs/express',
            path: 'docs',
            branch: 'master',
        },
        includes: ['**/*.md'],
        priority: ['guide', 'api'],
    },
    {
        name: 'nestjs',
        displayName: 'NestJS',
        packageMatch: ['@nestjs/core'],
        configMatch: ['nest-cli.json'],
        docSource: {
            type: 'github',
            repo: 'nestjs/docs',
            path: '.',
            branch: 'master',
        },
        includes: ['**/*.md'],
    },
    {
        name: 'fastify',
        displayName: 'Fastify',
        packageMatch: ['fastify'],
        configMatch: ['fastify.config.js'],
        docSource: {
            type: 'github',
            repo: 'fastify/fastify',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
        priority: ['guide', 'reference'],
    },
    {
        name: 'svelte',
        displayName: 'Svelte',
        packageMatch: ['svelte'],
        configMatch: ['svelte.config.*'],
        docSource: {
            type: 'github',
            repo: 'sveltejs/svelte',
            path: 'packages/svelte/src/docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
    },
    {
        name: 'solid',
        displayName: 'Solid',
        packageMatch: ['solid-js'],
        docSource: {
            type: 'github',
            repo: 'solidjs/solid-docs',
            path: 'packages/solid-docs',
            branch: 'main',
        },
        includes: ['**/*.mdx'],
    },
    {
        name: 'qwik',
        displayName: 'Qwik',
        packageMatch: ['@builder.io/qwik'],
        docSource: {
            type: 'github',
            repo: 'BuilderIO/qwik',
            path: 'packages/qwik-city/docs',
            branch: 'main',
        },
        includes: ['**/*.mdx'],
    },
    // ========== v1.1 Additions - Python Frameworks ==========
    {
        name: 'django',
        displayName: 'Django',
        packageMatch: ['django'],
        configMatch: ['settings.py', 'manage.py', 'wsgi.py'],
        docSource: {
            type: 'github',
            repo: 'django/django',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.txt', '**/*.md'],
    },
    {
        name: 'fastapi',
        displayName: 'FastAPI',
        packageMatch: ['fastapi'],
        configMatch: ['app.py', 'main.py'],
        docSource: {
            type: 'github',
            repo: 'fastapi/fastapi',
            path: 'docs',
            branch: 'master',
        },
        includes: ['**/*.md'],
    },
    {
        name: 'flask',
        displayName: 'Flask',
        packageMatch: ['flask'],
        configMatch: ['app.py'],
        docSource: {
            type: 'github',
            repo: 'pallets/flask',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.rst', '**/*.md'],
    },
    // ========== v1.1 Additions - Go Frameworks ==========
    {
        name: 'gin',
        displayName: 'Gin',
        packageMatch: ['github.com/gin-gonic/gin'],
        docSource: {
            type: 'github',
            repo: 'gin-gonic/gin',
            path: 'docs',
            branch: 'master',
        },
        includes: ['**/*.md', '**/*.yaml'],
    },
    {
        name: 'echo',
        displayName: 'Echo',
        packageMatch: ['github.com/labstack/echo/v4'],
        docSource: {
            type: 'github',
            repo: 'labstack/echo',
            path: 'website/content/docs',
            branch: 'master',
        },
        includes: ['**/*.md'],
    },
    {
        name: 'fiber',
        displayName: 'Fiber',
        packageMatch: ['github.com/gofiber/fiber/v2'],
        docSource: {
            type: 'github',
            repo: 'gofiber/fiber',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md'],
    },
    // ========== v1.2 Additions - Additional Python Frameworks ==========
    {
        name: 'sqlalchemy',
        displayName: 'SQLAlchemy',
        packageMatch: ['sqlalchemy'],
        configMatch: ['alembic.ini'],
        docSource: {
            type: 'github',
            repo: 'sqlalchemy/sqlalchemy',
            path: 'doc/build',
            branch: 'main',
        },
        includes: ['**/*.rst', '**/*.md'],
    },
    {
        name: 'pydantic',
        displayName: 'Pydantic',
        packageMatch: ['pydantic', 'pydantic-settings'],
        docSource: {
            type: 'github',
            repo: 'pydantic/pydantic',
            path: 'docs',
            branch: 'main',
        },
        includes: ['**/*.md', '**/*.mdx'],
    },
    // ========== v1.2 Additions - Additional Go Frameworks ==========
    {
        name: 'chi',
        displayName: 'Chi',
        packageMatch: ['github.com/go-chi/chi/v5'],
        docSource: {
            type: 'github',
            repo: 'go-chi/chi',
            path: '_examples',
            branch: 'master',
        },
        includes: ['**/*.go'],
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
