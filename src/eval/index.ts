/**
 * Evaluation Suite
 * Vercel-methodology evals for measuring AGENTS.md effectiveness
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { scanProject } from '../scanner/index.js';
import { compressIndex } from '../compressor/index.js';
import { fetchDocs } from '../fetcher/index.js';
import type { DetectedSkill } from '../scanner/index.js';
import { loadConfig } from '../config/index.js';
import { compileProject } from '../core/compile.js';
import { getRegistry } from '../registries/index.js';
import { createLLMClient, testLLMConnection } from '../llm/client.js';
import { type LLMConfig } from '../llm/index.js';
import { testGeneratedCode } from './utils.js';

export interface EvalResult {
    framework: string;
    version: string;
    config: 'baseline' | 'skill-only' | 'agents-md';
    metrics: {
        build: number;  // Pass rate 0-100
        lint: number;   // Pass rate 0-100
        test: number;   // Pass rate 0-100
        performance: number; // Performance score
    };
    passRate: number; // Overall pass rate
    details: EvalTaskResult[];
    timestamp: string;
    compression: {
        size: number; // bytes
        targetSize: number; // target size in bytes
        compressionRatio: number;
    };
}

export interface EvalTaskResult {
    name: string;
    api: string;
    description: string;
    build: boolean;
    lint: boolean;
    test: boolean;
    performance: number; // 0-100
    passed: boolean;
    error?: string;
    generatedCode?: string;
    duration?: number;
    memoryUsage?: number;
    tokensUsed?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

export interface EvalOptions {
    framework?: string;
    compare?: 'baseline' | 'skill-only' | 'agents-md';
    verbose?: boolean;
    simulate?: boolean;  // Use simulated results (no API key needed)
    model?: string;      // LLM model to use
    apiKey?: string;     // OpenAI API key
    output?: string;     // Output file path
    iterations?: number; // Number of iterations per test
    timeout?: number;    // Timeout in seconds
    provider?: string;   // LLM provider
    refreshIndexes?: boolean; // Refresh cached docs/indexes before eval
}

/**
 * Next.js 16 APIs not in model training data (from Vercel's research)
 */
const NEXTJS_16_TEST_APIS = [
    {
        name: 'connection',
        description: 'Dynamic rendering with connection()',
        prompt: 'Create a Next.js page that uses the connection() function to opt into dynamic rendering.',
        complexity: 'medium',
        expectedLines: 20
    },
    {
        name: 'use-cache',
        description: "'use cache' directive",
        prompt: "Create a Next.js server component that uses the 'use cache' directive for caching.",
        complexity: 'medium',
        expectedLines: 25
    },
    {
        name: 'cacheLife',
        description: 'cacheLife() function',
        prompt: 'Create a Next.js page that uses cacheLife() to set custom cache expiration.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'cacheTag',
        description: 'cacheTag() function',
        prompt: 'Create a Next.js page that uses cacheTag() for cache invalidation.',
        complexity: 'medium',
        expectedLines: 28
    },
    {
        name: 'forbidden',
        description: 'forbidden() response',
        prompt: 'Create a Next.js API route that returns a forbidden() response for unauthorized access.',
        complexity: 'easy',
        expectedLines: 15
    },
    {
        name: 'unauthorized',
        description: 'unauthorized() response',
        prompt: 'Create a Next.js API route that returns an unauthorized() response.',
        complexity: 'easy',
        expectedLines: 15
    },
    {
        name: 'async-cookies',
        description: 'Async cookies()',
        prompt: 'Create a Next.js server component that uses the async cookies() API to read cookies.',
        complexity: 'medium',
        expectedLines: 22
    },
    {
        name: 'async-headers',
        description: 'Async headers()',
        prompt: 'Create a Next.js server component that uses the async headers() API.',
        complexity: 'medium',
        expectedLines: 20
    },
    {
        name: 'after',
        description: 'after() function',
        prompt: 'Create a Next.js page that uses the after() function to run code after the response.',
        complexity: 'hard',
        expectedLines: 35
    }
];

/**
 * React 18 APIs not in model training data
 */
const REACT_18_TEST_APIS = [
    {
        name: 'useState',
        description: 'useState hook with complex state management',
        prompt: 'Create a React component that uses useState with complex state management including multiple state variables and derived state.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'useEffect',
        description: 'useEffect with cleanup and dependencies',
        prompt: 'Create a React component that uses useEffect with proper cleanup and dependency array.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'useContext',
        description: 'useContext for theme management',
        prompt: 'Create a React app that uses useContext for theme management with dark/light mode toggle.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'useReducer',
        description: 'useReducer for complex state logic',
        prompt: 'Create a React component that uses useReducer for complex state logic like a shopping cart.',
        complexity: 'hard',
        expectedLines: 45
    },
    {
        name: 'useCallback',
        description: 'useCallback optimization',
        prompt: 'Create a React component that uses useCallback to optimize expensive calculations and prevent unnecessary re-renders.',
        complexity: 'medium',
        expectedLines: 28
    },
    {
        name: 'useMemo',
        description: 'useMemo for memoization',
        prompt: 'Create a React component that uses useMemo to memoize expensive calculations.',
        complexity: 'medium',
        expectedLines: 26
    },
    {
        name: 'useRef',
        description: 'useRef for DOM manipulation',
        prompt: 'Create a React component that uses useRef to manipulate DOM elements directly.',
        complexity: 'medium',
        expectedLines: 22
    },
    {
        name: 'useTransition',
        description: 'useTransition for concurrent features',
        prompt: 'Create a React component that uses useTransition for concurrent rendering features.',
        complexity: 'hard',
        expectedLines: 40
    },
    {
        name: 'useDeferredValue',
        description: 'useDeferredValue for deferred updates',
        prompt: 'Create a React component that uses useDeferredValue for deferred updates.',
        complexity: 'hard',
        expectedLines: 38
    }
];

/**
 * Express.js test tasks
 */
const EXPRESS_TEST_APIS = [
    {
        name: 'basic-routing',
        description: 'Express basic routing',
        prompt: 'Create an Express.js server with basic GET, POST, PUT, DELETE routes.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'middleware',
        description: 'Express middleware',
        prompt: 'Create an Express.js server with custom middleware for logging and authentication.',
        complexity: 'medium',
        expectedLines: 40
    },
    {
        name: 'error-handling',
        description: 'Express error handling',
        prompt: 'Create an Express.js server with proper error handling middleware.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'params-validation',
        description: 'Route parameters and validation',
        prompt: 'Create an Express.js server with route parameters and query string validation.',
        complexity: 'easy',
        expectedLines: 25
    }
];

/**
 * Django test tasks
 */
const DJANGO_TEST_APIS = [
    {
        name: 'models',
        description: 'Django models',
        prompt: 'Create a Django model with fields for a blog post including title, content, author, and timestamp.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'views',
        description: 'Django views',
        prompt: 'Create a Django view function that returns a JSON response with blog posts.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'urls',
        description: 'Django URL routing',
        prompt: 'Create Django URL patterns for a blog application.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'serializers',
        description: 'Django REST framework serializers',
        prompt: 'Create Django REST framework serializers for a user model.',
        complexity: 'medium',
        expectedLines: 35
    }
];

/**
 * FastAPI test tasks
 */
const FASTAPI_TEST_APIS = [
    {
        name: 'basic-routing',
        description: 'FastAPI basic routing',
        prompt: 'Create a FastAPI application with GET, POST, PUT, DELETE endpoints.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'pydantic-models',
        description: 'FastAPI Pydantic models',
        prompt: 'Create FastAPI endpoints using Pydantic models for request/response validation.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'dependency-injection',
        description: 'FastAPI dependency injection',
        prompt: 'Create FastAPI endpoints with dependency injection for authentication.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'async-endpoints',
        description: 'FastAPI async endpoints',
        prompt: 'Create FastAPI async endpoints for database operations.',
        complexity: 'medium',
        expectedLines: 40
    }
];

/**
 * Vue.js test tasks
 */
const VUE_TEST_APIS = [
    {
        name: 'composition-api',
        description: 'Vue Composition API',
        prompt: 'Create a Vue 3 component using the Composition API with reactive state.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'pinia-store',
        description: 'Pinia state management',
        prompt: 'Create a Pinia store for managing user authentication state.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'router',
        description: 'Vue Router',
        prompt: 'Create Vue Router configuration with navigation guards.',
        complexity: 'medium',
        expectedLines: 30
    }
];

/**
 * Astro test tasks
 */
const ASTRO_TEST_APIS = [
    {
        name: 'static-pages',
        description: 'Astro static pages',
        prompt: 'Create an Astro page with dynamic routing for blog posts.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'components',
        description: 'Astro components',
        prompt: 'Create an Astro component with props and slots.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'islands',
        description: 'Astro islands',
        prompt: 'Create an Astro page with a React island component.',
        complexity: 'medium',
        expectedLines: 30
    }
];

/**
 * Nuxt test tasks
 */
const NUXT_TEST_APIS = [
    {
        name: 'auto-imports',
        description: 'Nuxt auto-imports',
        prompt: 'Create a Nuxt 3 page that uses composables with auto-import.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'server-routes',
        description: 'Nuxt server routes',
        prompt: 'Create a Nuxt 3 server API route that returns JSON data.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'layouts',
        description: 'Nuxt layouts',
        prompt: 'Create a Nuxt 3 layout with a navigation component.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'middleware',
        description: 'Nuxt middleware',
        prompt: 'Create a Nuxt 3 route middleware for authentication.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'useAsyncData',
        description: 'Nuxt useAsyncData',
        prompt: 'Create a Nuxt 3 page that uses useAsyncData for data fetching.',
        complexity: 'medium',
        expectedLines: 30
    }
];

/**
 * Remix test tasks
 */
const REMIX_TEST_APIS = [
    {
        name: 'loader',
        description: 'Remix loader',
        prompt: 'Create a Remix route with a loader function that fetches data.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'action',
        description: 'Remix action',
        prompt: 'Create a Remix route with an action that handles form submissions.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'useLoaderData',
        description: 'Remix useLoaderData',
        prompt: 'Create a Remix page that uses useLoaderData to display data.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'nested-routes',
        description: 'Remix nested routes',
        prompt: 'Create a Remix app with nested routing structure.',
        complexity: 'medium',
        expectedLines: 40
    },
    {
        name: 'error-boundary',
        description: 'Remix error boundary',
        prompt: 'Create a Remix route with an error boundary for error handling.',
        complexity: 'medium',
        expectedLines: 35
    }
];

/**
 * Hono test tasks
 */
const HONO_TEST_APIS = [
    {
        name: 'basic-routing',
        description: 'Hono basic routing',
        prompt: 'Create a Hono application with basic GET, POST routes.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'middleware',
        description: 'Hono middleware',
        prompt: 'Create a Hono app with custom middleware for logging.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'validation',
        description: 'Hono validation',
        prompt: 'Create a Hono endpoint with request validation using zod.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'jwt-auth',
        description: 'Hono JWT auth',
        prompt: 'Create a Hono API with JWT authentication middleware.',
        complexity: 'medium',
        expectedLines: 35
    }
];

/**
 * Effect test tasks
 */
const EFFECT_TEST_APIS = [
    {
        name: 'layer',
        description: 'Effect Layer',
        prompt: 'Create an Effect Layer that provides a database service.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'stream',
        description: 'Effect Stream',
        prompt: 'Create an Effect program that uses Stream for processing data.',
        complexity: 'hard',
        expectedLines: 40
    },
    {
        name: 'context',
        description: 'Effect Context',
        prompt: 'Create an Effect program that uses Context for dependency injection.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'schedule',
        description: 'Effect Schedule',
        prompt: 'Create an Effect program that uses Schedule for recurring tasks.',
        complexity: 'medium',
        expectedLines: 30
    }
];

/**
 * Bun test tasks
 */
const BUN_TEST_APIS = [
    {
        name: 'http-server',
        description: 'Bun HTTP server',
        prompt: 'Create a Bun HTTP server with basic routing.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'file-operations',
        description: 'Bun file operations',
        prompt: 'Create a Bun script that reads and writes files asynchronously.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'sqlite',
        description: 'Bun SQLite',
        prompt: 'Create a Bun script that connects to SQLite using bun:sqlite.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'spawn',
        description: 'Bun spawn',
        prompt: 'Create a Bun script that spawns and manages child processes.',
        complexity: 'medium',
        expectedLines: 25
    }
];

/**
 * Svelte test tasks
 */
const SVELTE_TEST_APIS = [
    {
        name: 'reactive',
        description: 'Svelte reactivity',
        prompt: 'Create a Svelte component using $: reactive statements.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'stores',
        description: 'Svelte stores',
        prompt: 'Create a Svelte store for managing application state.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'transitions',
        description: 'Svelte transitions',
        prompt: 'Create a Svelte component with built-in transitions.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'slots',
        description: 'Svelte slots',
        prompt: 'Create a Svelte component using slots for composition.',
        complexity: 'easy',
        expectedLines: 20
    }
];

/**
 * Solid test tasks
 */
const SOLID_TEST_APIS = [
    {
        name: 'signals',
        description: 'Solid signals',
        prompt: 'Create a Solid component using createSignal for reactive state.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'effects',
        description: 'Solid effects',
        prompt: 'Create a Solid component using createEffect for side effects.',
        complexity: 'medium',
        expectedLines: 25
    },
    {
        name: 'resources',
        description: 'Solid resources',
        prompt: 'Create a Solid component using createResource for async data.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'stores',
        description: 'Solid stores',
        prompt: 'Create a Solid store using createStore for nested state.',
        complexity: 'medium',
        expectedLines: 25
    }
];

/**
 * Qwik test tasks
 */
const QWIK_TEST_APIS = [
    {
        name: 'component',
        description: 'Qwik component',
        prompt: 'Create a Qwik component using component$ and useSignal.',
        complexity: 'easy',
        expectedLines: 20
    },
    {
        name: 'useTask',
        description: 'Qwik useTask',
        prompt: 'Create a Qwik component using useTask$ for side effects.',
        complexity: 'medium',
        expectedLines: 25
    },
    {
        name: 'routeLoader',
        description: 'Qwik routeLoader',
        prompt: 'Create a Qwik City route using routeLoader$ for data loading.',
        complexity: 'medium',
        expectedLines: 30
    },
    {
        name: 'server$',
        description: 'Qwik server$',
        prompt: 'Create a Qwik component using server$ for server functions.',
        complexity: 'medium',
        expectedLines: 25
    }
];

/**
 * Flask test tasks
 */
const FLASK_TEST_APIS = [
    {
        name: 'basic-routing',
        description: 'Flask basic routing',
        prompt: 'Create a Flask application with basic GET, POST routes.',
        complexity: 'easy',
        expectedLines: 25
    },
    {
        name: 'templates',
        description: 'Flask templates',
        prompt: 'Create a Flask application using Jinja2 templates.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'blueprints',
        description: 'Flask blueprints',
        prompt: 'Create a Flask application using blueprints for modular routing.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'sqlalchemy',
        description: 'Flask SQLAlchemy',
        prompt: 'Create a Flask application with SQLAlchemy for database operations.',
        complexity: 'medium',
        expectedLines: 40
    }
];

/**
 * Gin (Go) test tasks
 */
const GIN_TEST_APIS = [
    {
        name: 'basic-routing',
        description: 'Gin basic routing',
        prompt: 'Create a Gin web server with basic GET, POST routes.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'binding',
        description: 'Gin request binding',
        prompt: 'Create a Gin handler with JSON request binding and validation.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'middleware',
        description: 'Gin middleware',
        prompt: 'Create a Gin application with custom middleware for logging.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'grouping',
        description: 'Gin route grouping',
        prompt: 'Create a Gin application with grouped routes for API versioning.',
        complexity: 'medium',
        expectedLines: 40
    }
];

/**
 * Echo (Go) test tasks
 */
const ECHO_TEST_APIS = [
    {
        name: 'basic-routing',
        description: 'Echo basic routing',
        prompt: 'Create an Echo web server with basic GET, POST routes.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'middleware',
        description: 'Echo middleware',
        prompt: 'Create an Echo application with middleware for authentication.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'validation',
        description: 'Echo validation',
        prompt: 'Create an Echo handler with request validation using validators.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'context',
        description: 'Echo context',
        prompt: 'Create an Echo handler that uses Context for request data.',
        complexity: 'easy',
        expectedLines: 25
    }
];

/**
 * Fiber (Go) test tasks
 */
const FIBER_TEST_APIS = [
    {
        name: 'basic-routing',
        description: 'Fiber basic routing',
        prompt: 'Create a Fiber web server with basic GET, POST routes.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'middleware',
        description: 'Fiber middleware',
        prompt: 'Create a Fiber application with custom middleware.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'grouping',
        description: 'Fiber route grouping',
        prompt: 'Create a Fiber application with grouped routes.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'websocket',
        description: 'Fiber WebSocket',
        prompt: 'Create a Fiber application with WebSocket support.',
        complexity: 'hard',
        expectedLines: 45
    }
];

/**
 * SQLAlchemy test tasks
 */
const SQLALCHEMY_TEST_APIS = [
    {
        name: 'models',
        description: 'SQLAlchemy models',
        prompt: 'Create SQLAlchemy models for a blog post with relationships.',
        complexity: 'medium',
        expectedLines: 40
    },
    {
        name: 'queries',
        description: 'SQLAlchemy queries',
        prompt: 'Create SQLAlchemy queries for filtering and joining tables.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'migrations',
        description: 'SQLAlchemy migrations',
        prompt: 'Create SQLAlchemy alembic migration script.',
        complexity: 'medium',
        expectedLines: 30
    }
];

/**
 * Pydantic test tasks
 */
const PYDANTIC_TEST_APIS = [
    {
        name: 'models',
        description: 'Pydantic models',
        prompt: 'Create Pydantic models for user validation with nested types.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'field-validation',
        description: 'Pydantic field validation',
        prompt: 'Create Pydantic models with custom field validators.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'settings',
        description: 'Pydantic settings',
        prompt: 'Create Pydantic settings for application configuration.',
        complexity: 'easy',
        expectedLines: 25
    }
];

/**
 * Chi (Go) test tasks
 */
const CHI_TEST_APIS = [
    {
        name: 'routing',
        description: 'Chi routing',
        prompt: 'Create a Chi router with basic GET, POST routes.',
        complexity: 'easy',
        expectedLines: 30
    },
    {
        name: 'middleware',
        description: 'Chi middleware',
        prompt: 'Create a Chi application with middleware for logging.',
        complexity: 'medium',
        expectedLines: 35
    },
    {
        name: 'url-groups',
        description: 'Chi URL groups',
        prompt: 'Create Chi routes with URL grouping for API versioning.',
        complexity: 'medium',
        expectedLines: 40
    }
];

/**
 * Test tasks for evaluation
 */
const TEST_TASKS: Record<string, typeof NEXTJS_16_TEST_APIS> = {
    nextjs: NEXTJS_16_TEST_APIS,
    react: REACT_18_TEST_APIS,
    express: EXPRESS_TEST_APIS,
    django: DJANGO_TEST_APIS,
    fastapi: FASTAPI_TEST_APIS,
    vue: VUE_TEST_APIS,
    astro: ASTRO_TEST_APIS,
    nuxt: NUXT_TEST_APIS,
    remix: REMIX_TEST_APIS,
    hono: HONO_TEST_APIS,
    effect: EFFECT_TEST_APIS,
    bun: BUN_TEST_APIS,
    svelte: SVELTE_TEST_APIS,
    solid: SOLID_TEST_APIS,
    qwik: QWIK_TEST_APIS,
    flask: FLASK_TEST_APIS,
    gin: GIN_TEST_APIS,
    echo: ECHO_TEST_APIS,
    fiber: FIBER_TEST_APIS,
    sqlalchemy: SQLALCHEMY_TEST_APIS,
    pydantic: PYDANTIC_TEST_APIS,
    chi: CHI_TEST_APIS
};

/**
 * Run evaluation for a specific framework
 */
export async function runEval(options: EvalOptions = {}): Promise<EvalResult> {
    const framework = options.framework || 'nextjs';
    const config = options.compare || 'agents-md';
    const verbose = options.verbose || false;
    const simulate = options.simulate || false;
    const model = options.model || 'gpt-4o';
    const apiKey = options.apiKey;
    const output = options.output;
    const iterations = options.iterations || 3;
    const timeout = options.timeout || 60;
    const provider = options.provider || 'openai';
    const refreshIndexes = options.refreshIndexes || false;
    const cwd = process.cwd();

    console.log(chalk.blue(`\nRunning ${framework} evaluation...`));
    console.log(chalk.gray(`Config: ${config}`));
    console.log(chalk.gray(`Model: ${model}`));
    console.log(chalk.gray(`Iterations: ${iterations}`));
    console.log(chalk.gray(`Timeout: ${timeout}s`));

    if (config === 'agents-md' && refreshIndexes) {
        await compileProject({
            cwd,
            only: framework ? [framework] : undefined,
            refresh: true,
        });
    }

    const startTime = Date.now();
    const results: EvalTaskResult[] = [];
    let passed = 0;
    let total = 0;

    const tasks = TEST_TASKS[framework as keyof typeof TEST_TASKS] || [];
    const detectedSkill = config === 'agents-md' ? await resolveEvalSkill(framework, cwd) : undefined;

    if (detectedSkill && config === 'agents-md') {
        try {
            await fetchDocs(detectedSkill, { cwd });
        } catch (error) {
            console.log(chalk.yellow('⚠️  Failed to fetch docs; eval will continue without fresh cache.'));
            console.log(chalk.dim(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    }

    // Create LLM config
    const llmConfig: LLMConfig = {
        provider,
        model,
        apiKey,
    };

    try {
        await testLLMConnection(llmConfig);
        console.log(chalk.green('✓ LLM connection successful'));
    } catch (error) {
        console.log(chalk.yellow('⚠️  LLM connection test failed. Using simulation mode.'));
        console.log(chalk.dim(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }

    for (const task of tasks) {
        for (let i = 0; i < iterations; i++) {
            total++;
            const taskStartTime = Date.now();
            
            console.log(chalk.gray(`\nTask: ${task.name} (iteration ${i + 1}/${iterations}) - ${task.description}`));
            
            try {
                const result = await runTask(task, framework, config, llmConfig, simulate, timeout, detectedSkill);
                results.push(result);
                
                if (result.passed) {
                    passed++;
                    console.log(chalk.green(`✓ Passed (${result.duration}ms)`));
                } else {
                    console.log(chalk.red(`✗ Failed: ${result.error}`));
                }
            } catch (error) {
                const err = error as Error;
                results.push({
                    name: task.name,
                    api: task.name,
                    description: task.description,
                    build: false,
                    lint: false,
                    test: false,
                    performance: 0,
                    passed: false,
                    error: err.message,
                    duration: Date.now() - taskStartTime
                });
                console.log(chalk.red(`✗ Error: ${err.message}`));
            }
        }
    }

    const passRate = total > 0 ? (passed / total) * 100 : 0;
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Calculate compression stats
    const configData = await loadConfig(cwd);
    const compressionTarget = configData.compression?.targetSize || 8192; // 8KB target
    const compressionSize = Buffer.byteLength(JSON.stringify(results), 'utf-8');
    const compressionRatio = compressionSize / compressionTarget;

    const result: EvalResult = {
        framework,
        version: 'latest',
        config,
        metrics: {
            build: calculateMetric(results, 'build'),
            lint: calculateMetric(results, 'lint'),
            test: calculateMetric(results, 'test'),
            performance: calculateMetric(results, 'performance')
        },
        passRate,
        details: results,
        timestamp: new Date().toISOString(),
        compression: {
            size: compressionSize,
            targetSize: compressionTarget,
            compressionRatio
        }
    };

    console.log(chalk.blue(`\nEvaluation Results:`));
    console.log(chalk.gray(`Framework: ${result.framework}`));
    console.log(chalk.gray(`Config: ${result.config}`));
    console.log(chalk.gray(`Duration: ${duration}ms`));
    console.log(chalk.gray(`Build Pass Rate: ${result.metrics.build}%`));
    console.log(chalk.gray(`Lint Pass Rate: ${result.metrics.lint}%`));
    console.log(chalk.gray(`Test Pass Rate: ${result.metrics.test}%`));
    console.log(chalk.gray(`Performance Score: ${result.metrics.performance}%`));
    console.log(chalk.green(`Overall Pass Rate: ${result.passRate.toFixed(1)}%`));
    console.log(chalk.gray(`Compression Size: ${(compressionSize / 1024).toFixed(2)}KB (target: ${(compressionTarget / 1024).toFixed(2)}KB)`));
    console.log(chalk.gray(`Compression Ratio: ${compressionRatio.toFixed(2)}x`));

    if (output) {
        await writeFile(output, JSON.stringify(result, null, 2));
        console.log(chalk.gray(`Results saved to: ${output}`));
    }

    return result;
}

/**
 * Run comprehensive evaluation suite
 */
export async function runComprehensiveEval(options: EvalOptions = {}): Promise<EvalResult[]> {
    const frameworks = options.framework ? [options.framework] : ['nextjs', 'react'];
    const results: EvalResult[] = [];
    
    for (const framework of frameworks) {
        const result = await runEval({ ...options, framework });
        results.push(result);
    }
    
    return results;
}

/**
 * Generate evaluation report
 */
export async function generateEvalReport(results: EvalResult[], outputPath?: string): Promise<void> {
    const report = {
        summary: {
            totalFrameworks: results.length,
            averagePassRate: results.reduce((sum, r) => sum + r.passRate, 0) / results.length,
            configs: results.map(r => ({ 
                framework: r.framework, 
                config: r.config, 
                passRate: r.passRate,
                compressionRatio: r.compression.compressionRatio
            }))
        },
        details: results,
        timestamp: new Date().toISOString()
    };

    if (outputPath) {
        await writeFile(outputPath, JSON.stringify(report, null, 2));
        console.log(chalk.green(`Evaluation report saved to: ${outputPath}`));
    }
}

/**
 * Run a single test task
 */
async function runTask(
    task: typeof NEXTJS_16_TEST_APIS[0],
    framework: string,
    config: string,
    llmConfig: LLMConfig,
    simulate: boolean = false,
    timeout: number = 60,
    detectedSkill?: DetectedSkill
): Promise<EvalTaskResult> {
    const taskStartTime = Date.now();
    
    // Simulate results for testing
    if (simulate) {
        const performance = Math.random() * 100;
        const passed = Math.random() > 0.3; // 70% chance of passing
        
        return {
            name: task.name,
            api: task.name,
            description: task.description,
            build: passed,
            lint: passed,
            test: passed,
            performance,
            passed,
            error: passed ? undefined : 'Simulated failure',
            duration: Date.now() - taskStartTime
        };
    }

    // Create LLM client
    const client = await createLLMClient(llmConfig);

    // Build the prompt
    let systemPrompt = 'You are an expert developer. Generate only code, no explanations.';
    if (config === 'agents-md') {
        const skill = detectedSkill || await resolveEvalSkill(framework, process.cwd());
        await fetchDocs(skill);
        const index = await compressIndex(skill);
        systemPrompt = `You are an expert developer. Use the following documentation index to help you:\n\n${index}\n\nGenerate only code, no explanations.`;
    }

    const userPrompt = task.prompt || task.description;

    try {
        // Call LLM
        const response = await client.generateCode(userPrompt, systemPrompt);
        const generatedCode = response.content;

        // Create temp project and test the code
        const testResult = await testGeneratedCode(framework, task.name, generatedCode);

        const performance = (testResult.build ? 30 : 0) + (testResult.lint ? 30 : 0) + (testResult.test ? 40 : 0);

        return {
            name: task.name,
            api: task.name,
            description: task.description,
            ...testResult,
            passed: testResult.build && testResult.lint && testResult.test,
            performance,
            generatedCode,
            duration: Date.now() - taskStartTime,
            tokensUsed: {
                prompt: response.usage?.promptTokens || 0,
                completion: response.usage?.completionTokens || 0,
                total: response.usage?.totalTokens || 0
            }
        };
    } catch (error) {
        return {
            name: task.name,
            api: task.name,
            description: task.description,
            build: false,
            lint: false,
            test: false,
            performance: 0,
            passed: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - taskStartTime
        };
    }
}

async function resolveEvalSkill(framework: string, cwd: string): Promise<DetectedSkill> {
    const detected = await scanProject(cwd, { only: [framework] });
    const match = detected.find(skill => skill.name === framework);
    if (match) {
        return match;
    }

    const registry = getRegistry(framework);
    return {
        name: framework,
        version: 'latest',
        source: 'config',
        displayName: registry?.displayName || framework,
    };
}

/**
 * Calculate metric from results
 */
function calculateMetric(results: EvalTaskResult[], metric: 'build' | 'lint' | 'test' | 'performance'): number {
    const relevantResults = results.filter(r => r[metric] !== undefined);
    if (relevantResults.length === 0) return 0;
    
    const passed = relevantResults.filter(r => r[metric]).length;
    return (passed / relevantResults.length) * 100;
}

/**
 * Get compression stats for display
 */
export async function getCompressionStats(cwd: string): Promise<void> {
    const detected = await scanProject(cwd);

    console.log(chalk.bold('\n📊 Compression Statistics\n'));

    for (const skill of detected) {
        const index = await compressIndex(skill);
        const sizeBytes = Buffer.byteLength(index, 'utf-8');
        const sizeKb = (sizeBytes / 1024).toFixed(2);
        const status = sizeBytes <= 8192 ? chalk.green('✓') : chalk.yellow('⚠');

        console.log(`${status} ${skill.displayName || skill.name}: ${sizeKb}KB (target: <8KB)`);
    }
}

/**
 * Print detailed eval results
 */
export function printDetailedResults(results: EvalResult[]): void {
    console.log(chalk.bold('\n📊 Detailed Evaluation Results\n'));
    console.log(chalk.bold('┌───────────────────────────────────────────────────────────┐'));
    console.log(chalk.bold('│ Framework      │ Config       │ Pass Rate │ Compression │'));
    console.log(chalk.bold('├────────────────┼──────────────┼───────────┼─────────────┤'));

    for (const result of results) {
        const passColor = result.passRate >= 90 ? chalk.green : result.passRate >= 70 ? chalk.yellow : chalk.red;
        const compressionColor = result.compression.compressionRatio <= 1 ? chalk.green : chalk.yellow;

        console.log(
            `│ ${result.framework.padEnd(14)} │ ${result.config.padEnd(12)} │ ${passColor(String(result.passRate).padStart(6))}% │ ${compressionColor(String(result.compression.compressionRatio.toFixed(2)).padStart(10))}x │`
        );
    }

    console.log(chalk.bold('└───────────────────────────────────────────────────────────┘'));
}
