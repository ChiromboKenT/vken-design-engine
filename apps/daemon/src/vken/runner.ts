import fs from 'node:fs';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams, type SpawnSyncReturns } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

export interface VkenDevServer {
  pid: number | null;
  url: string;
  output: () => string;
  kill: () => Promise<void>;
}

export async function startViteDevServer(input: {
  workspacePath: string;
  timeoutMs?: number;
}): Promise<VkenDevServer> {
  return startViteServer({
    workspacePath: input.workspacePath,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    args: (port) => ['--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  });
}

export async function spawnVitePreview(input: {
  workspacePath: string;
  timeoutMs?: number;
}): Promise<VkenDevServer> {
  return startViteServer({
    workspacePath: input.workspacePath,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    args: (port) => ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  });
}

async function startViteServer(input: {
  workspacePath: string;
  timeoutMs?: number;
  args: (port: number) => string[];
}): Promise<VkenDevServer> {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const viteBin = path.join(input.workspacePath, 'node_modules', 'vite', 'bin', 'vite.js');
  ensureWorkspaceDependencies(input.workspacePath, viteBin);
  const child = spawn(
    process.execPath,
    [viteBin, ...input.args(port)],
    {
      cwd: input.workspacePath,
      env: { ...process.env, BROWSER: 'none' },
      windowsHide: true,
    },
  );
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output += String(chunk);
  });
  child.on('error', (error) => {
    output += `\n${error.message}`;
  });

  try {
    await waitForHttp(url, input.timeoutMs ?? 20_000, () => output);
  } catch (error) {
    await killChild(child);
    throw error;
  }

  return {
    pid: child.pid ?? null,
    url,
    output: () => output,
    kill: () => killChild(child),
  };
}

export function ensureWorkspaceDependencies(workspacePath: string, viteBin = path.join(workspacePath, 'node_modules', 'vite', 'bin', 'vite.js')): void {
  if (fs.existsSync(viteBin)) return;
  if (!fs.existsSync(path.join(workspacePath, 'package.json'))) {
    throw new Error(`VKEN workspace is missing package.json at ${workspacePath}`);
  }
  const install = resolveInstallCommand(workspacePath);
  const result = spawnSync(install.command, install.args, {
    cwd: workspacePath,
    shell: false,
    encoding: 'utf8',
    timeout: installTimeoutMs(),
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      NPM_CONFIG_AUDIT: 'false',
      NPM_CONFIG_FUND: 'false',
    },
  });
  if (result.status !== 0 || result.error) {
    const detail = formatInstallFailure(result);
    throw new Error(`VKEN dependency install failed (${install.command} ${install.args.join(' ')}): ${detail}`);
  }
  if (!fs.existsSync(viteBin)) {
    throw new Error(`VKEN dependency install completed but Vite was not found at ${viteBin}`);
  }
}

export function resolveInstallCommand(workspacePath: string): { command: string; args: string[] } {
  if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
    return { command: 'pnpm', args: ['install', '--no-frozen-lockfile'] };
  }
  if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
    return { command: 'yarn', args: ['install'] };
  }
  if (fs.existsSync(path.join(workspacePath, 'bun.lockb')) || fs.existsSync(path.join(workspacePath, 'bun.lock'))) {
    return { command: 'bun', args: ['install'] };
  }
  if (fs.existsSync(path.join(workspacePath, 'package-lock.json'))) {
    return { command: 'npm', args: ['ci', '--no-audit', '--no-fund'] };
  }
  return { command: 'npm', args: ['install', '--no-audit', '--no-fund'] };
}

function installTimeoutMs(): number {
  const configured = Number(process.env.VKEN_REPO_INSTALL_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 180_000;
}

function formatInstallFailure(result: SpawnSyncReturns<string>): string {
  const spawnError = result.error as NodeJS.ErrnoException | undefined;
  if (spawnError?.code === 'ENOENT') return 'package manager executable not found in the runtime image';
  if (spawnError?.code === 'ETIMEDOUT') return 'dependency install timed out';
  const output = result.stderr || result.stdout || spawnError?.message || 'unknown error';
  return output.slice(-2_000).trim();
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to allocate TCP port')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url: string, timeoutMs: number, getOutput: () => string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`VKEN dev server timeout at ${url}\n${getOutput().slice(-2_000)}`);
}

function killChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 2_000);
    timer.unref?.();
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}
