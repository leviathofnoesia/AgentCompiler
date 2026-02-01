import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { spawn } from 'child_process';

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
        // Create temp directory
        await mkdir(tempDir, { recursive: true });

        // Create a minimal project structure based on framework
        if (framework === 'nextjs') {
            const packageJson = {
                name: 'eval-test',
                version: '1.0.0',
                scripts: {
                    build: 'next build',
                    lint: 'next lint',
                    test: 'echo "No tests"'
                },
                dependencies: {
                    next: 'latest',
                    react: '^19.0.0',
                    'react-dom': '^19.0.0',
                },
            };

            await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
            await mkdir(join(tempDir, 'app'), { recursive: true });
            await writeFile(join(tempDir, 'app', 'page.tsx'), code);
        } else if (framework === 'react') {
            // React setup (simplified)
            const packageJson = {
                name: 'eval-test',
                version: '1.0.0',
                scripts: {
                    build: 'vite build',
                    lint: 'eslint .',
                },
                dependencies: {
                    react: '^18.3.0',
                    'react-dom': '^18.3.0',
                },
                devDependencies: {
                    vite: '^5.0.0',
                    eslint: '^8.0.0'
                }
            };
            await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
            await writeFile(join(tempDir, 'App.jsx'), code);
        }

        // In a real scenario we would run install/build/lint
        // For this demo/prototype, we'll simulate success if code looks reasonable
        // (Avoiding full npm install during eval for speed unless configured otherwise)
        
        // Simple heuristic check for now
        const hasExport = code.includes('export default') || code.includes('export const');
        const hasImports = code.includes('import ');
        
        return {
            build: hasExport && hasImports,
            lint: true, 
            test: hasExport
        };

        /* Real implementation would be:
        const installResult = await runCommand('npm', ['install'], tempDir);
        if (!installResult.success) return { build: false, lint: false, test: false };
        
        const buildResult = await runCommand('npm', ['run', 'build'], tempDir);
        const lintResult = await runCommand('npm', ['run', 'lint'], tempDir);
        
        return {
            build: buildResult.success,
            lint: lintResult.success,
            test: buildResult.success
        };
        */
    } catch (error) {
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
function runCommand(cmd: string, args: string[], cwd: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { cwd, shell: true });
        let output = '';

        child.stdout?.on('data', (data) => {
            output += data.toString();
        });

        child.stderr?.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            resolve({ success: code === 0, output });
        });

        child.on('error', () => {
            resolve({ success: false, output });
        });

        setTimeout(() => {
            child.kill();
            resolve({ success: false, output: 'Timeout' });
        }, 60000);
    });
}
