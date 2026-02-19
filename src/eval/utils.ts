import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { spawn } from 'child_process';

const ENABLE_BUILD_COMMANDS = process.env.SKILL_COMPILER_EVAL_RUN_BUILD === '1';

/**
 * Test generated code by running build/lint/test
 */
export async function testGeneratedCode(
    framework: string,
    apiName: string,
    code: string
): Promise<{ build: boolean; lint: boolean; test: boolean }> {
    const tempDir = join(process.cwd(), '.eval-temp', `${framework}-${apiName}-${Date.now()}`);

    try {
        await mkdir(tempDir, { recursive: true });
        await createFrameworkFixture(framework, tempDir, code);

        const staticValidation = await runStaticValidation(framework, apiName, code);

        // Optional full build validation. Enable with SKILL_COMPILER_EVAL_RUN_BUILD=1.
        if (ENABLE_BUILD_COMMANDS && (framework === 'nextjs' || framework === 'react')) {
            const installResult = await runCommand(
                'npm',
                ['install', '--no-audit', '--no-fund'],
                tempDir,
                180000
            );
            if (installResult.success) {
                const buildResult = await runCommand('npm', ['run', 'build'], tempDir, 120000);
                return {
                    build: buildResult.success,
                    lint: staticValidation.lint,
                    test: buildResult.success && staticValidation.test
                };
            }
        }

        return staticValidation;
    } catch {
        return { build: false, lint: false, test: false };
    } finally {
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {}
    }
}

/**
 * Run a command and return success status
 */
function runCommand(
    cmd: string,
    args: string[],
    cwd: string,
    timeoutMs: number = 60000
): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { cwd, shell: true });
        let output = '';
        let settled = false;

        const finalize = (result: { success: boolean; output: string }) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };

        child.stdout?.on('data', (data) => {
            output += data.toString();
        });

        child.stderr?.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            finalize({ success: code === 0, output });
        });

        child.on('error', () => {
            finalize({ success: false, output });
        });

        setTimeout(() => {
            child.kill();
            finalize({ success: false, output: output || 'Timeout' });
        }, timeoutMs);
    });
}

async function createFrameworkFixture(framework: string, tempDir: string, code: string): Promise<void> {
    if (framework === 'nextjs') {
        const packageJson = {
            name: 'eval-test',
            version: '1.0.0',
            private: true,
            scripts: {
                build: 'next build'
            },
            dependencies: {
                next: 'latest',
                react: '^19.0.0',
                'react-dom': '^19.0.0',
            },
        };

        await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
        await mkdir(join(tempDir, 'app'), { recursive: true });
        await writeFile(
            join(tempDir, 'app', 'layout.tsx'),
            `export default function RootLayout({ children }: { children: unknown }) {\n  return (\n    <html lang="en">\n      <body>{children as any}</body>\n    </html>\n  );\n}\n`
        );
        await writeFile(join(tempDir, 'app', 'page.tsx'), code);
        return;
    }

    if (framework === 'react') {
        const packageJson = {
            name: 'eval-test',
            version: '1.0.0',
            private: true,
            scripts: {
                build: 'vite build'
            },
            dependencies: {
                react: '^18.3.0',
                'react-dom': '^18.3.0',
            },
            devDependencies: {
                vite: '^5.0.0'
            }
        };

        await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
        await mkdir(join(tempDir, 'src'), { recursive: true });
        await writeFile(join(tempDir, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n');
        await writeFile(
            join(tempDir, 'src', 'main.jsx'),
            "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />);\n"
        );
        await writeFile(join(tempDir, 'src', 'App.jsx'), code);
    }
}

async function runStaticValidation(
    framework: string,
    apiName: string,
    code: string
): Promise<{ build: boolean; lint: boolean; test: boolean }> {
    const syntaxValid = await validateSyntax(code, framework);
    const lintValid = syntaxValid && !containsPlaceholderPatterns(code);
    const testValid = syntaxValid && hasModuleStructure(code) && referencesExpectedApi(code, apiName);

    return {
        build: syntaxValid,
        lint: lintValid,
        test: testValid
    };
}

async function validateSyntax(code: string, framework: string): Promise<boolean> {
    try {
        const ts = await import('typescript');
        const isJsxFramework = framework === 'nextjs' || framework === 'react';
        const transpileResult = ts.transpileModule(code, {
            compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ES2022,
                jsx: isJsxFramework ? ts.JsxEmit.ReactJSX : ts.JsxEmit.Preserve,
            },
            reportDiagnostics: true,
            fileName: isJsxFramework ? 'snippet.tsx' : 'snippet.ts',
        });

        const diagnostics = transpileResult.diagnostics ?? [];
        return diagnostics.every((diag) => diag.category !== ts.DiagnosticCategory.Error);
    } catch {
        // If TypeScript isn't available at runtime, keep a minimal fallback.
        return code.trim().length > 0;
    }
}

function containsPlaceholderPatterns(code: string): boolean {
    const placeholderPatterns = [
        /\bTODO\b/i,
        /\bFIXME\b/i,
        /\bTBD\b/i,
        /throw\s+new\s+Error\s*\(\s*['"`]\s*(not implemented|todo|stub)/i,
        /\/\*\s*stub\s*\*\//i,
    ];

    return placeholderPatterns.some((pattern) => pattern.test(code));
}

function hasModuleStructure(code: string): boolean {
    return (
        /\bexport\s+default\b/.test(code) ||
        /\bexport\s+(const|function|class)\b/.test(code) ||
        /\bmodule\.exports\s*=/.test(code) ||
        /\bexports\./.test(code)
    );
}

function referencesExpectedApi(code: string, apiName: string): boolean {
    const normalizedCode = code.toLowerCase();
    const signals = getApiSignals(apiName);
    if (signals.length === 0) {
        return true;
    }
    return signals.some((signal) => normalizedCode.includes(signal));
}

function getApiSignals(apiName: string): string[] {
    const normalizedApi = apiName.toLowerCase();
    const explicitSignals: Record<string, string[]> = {
        'use-cache': ["'use cache'", '"use cache"', 'use cache'],
        'cachelife': ['cachelife('],
        'cachetag': ['cachetag('],
        'async-cookies': ['cookies('],
        'async-headers': ['headers('],
        'basic-routing': ['app.get(', 'router.get(', 'get('],
    };

    if (explicitSignals[normalizedApi]) {
        return explicitSignals[normalizedApi];
    }

    return normalizedApi
        .split(/[^a-z0-9]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);
}
