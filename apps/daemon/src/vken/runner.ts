import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
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
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const viteBin = path.join(input.workspacePath, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
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
