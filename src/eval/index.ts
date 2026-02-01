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
import type { DetectedSkill } from '../scanner/index.js';
import { loadConfig } from '../config/index.js';
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
 * Test tasks for evaluation
 */
const TEST_TASKS = {
    nextjs: NEXTJS_16_TEST_APIS,
    react: REACT_18_TEST_APIS
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

    console.log(chalk.blue(`\nRunning ${framework} evaluation...`));
    console.log(chalk.gray(`Config: ${config}`));
    console.log(chalk.gray(`Model: ${model}`));
    console.log(chalk.gray(`Iterations: ${iterations}`));
    console.log(chalk.gray(`Timeout: ${timeout}s`));

    const startTime = Date.now();
    const results: EvalTaskResult[] = [];
    let passed = 0;
    let total = 0;

    const tasks = TEST_TASKS[framework as keyof typeof TEST_TASKS] || [];

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
                const result = await runTask(task, framework, config, llmConfig, simulate, timeout);
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
    const configData = loadConfig(process.cwd());
    const compressionTarget = 8192; // 8KB target
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
    timeout: number = 60
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
    const systemPrompt = config === 'agents-md' 
        ? `You are an expert developer. Use the following documentation index to help you:\n\n${await compressIndex({ name: framework } as any)}\n\nGenerate only code, no explanations.`
        : 'You are an expert developer. Generate only code, no explanations.';

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
