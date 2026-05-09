import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { VkenCreateRunRequest, VkenSampleId } from './types.js';

export interface VkenIntakeResult {
  source: 'sample' | 'url' | 'website';
  sourceRef: string;
  repoName: string;
  workspacePath: string;
  framework: 'vite-react-tailwind' | 'website-capture';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  tailwindVersion: 3 | 4;
}

export class VkenIntakeError extends Error {
  constructor(
    public readonly code: 'VKEN_INTAKE_FAILED' | 'VKEN_FRAMEWORK_UNSUPPORTED' | 'VKEN_REPO_TOO_LARGE',
    message: string,
  ) {
    super(message);
  }
}

export function intakeFromSample(projectRoot: string, sampleId: VkenSampleId): VkenIntakeResult {
  const workspacePath = path.join(projectRoot, 'samples', sampleId);
  if (!fs.existsSync(workspacePath)) {
    throw new VkenIntakeError('VKEN_INTAKE_FAILED', `sample not found: ${sampleId}`);
  }
  return detectSupportedWorkspace({
    source: 'sample',
    sourceRef: sampleId,
    workspacePath,
  });
}

export function intakeFromUrl(
  url: string,
  opts: { dataDir: string; runId: string },
): VkenIntakeResult {
  const cleanUrl = url.trim();
  if (!/^https:\/\/(github\.com|gitlab\.com|codeberg\.org)\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(cleanUrl)) {
    throw new VkenIntakeError(
      'VKEN_INTAKE_FAILED',
      'Only public GitHub, GitLab, and Codeberg repository HTTPS URLs are supported.',
    );
  }
  const cloneRoot = path.join(opts.dataDir, 'vken', 'clones');
  const clonePath = path.join(cloneRoot, opts.runId);
  const resolvedRoot = path.resolve(cloneRoot);
  const resolvedClone = path.resolve(clonePath);
  if (!resolvedClone.startsWith(resolvedRoot + path.sep)) {
    throw new VkenIntakeError('VKEN_INTAKE_FAILED', 'clone path escaped the VKEN data directory');
  }
  fs.rmSync(resolvedClone, { recursive: true, force: true });
  fs.mkdirSync(resolvedRoot, { recursive: true });
  const result = spawnSync('git', ['clone', '--depth', '1', '--single-branch', cleanUrl, resolvedClone], {
    shell: false,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: process.platform === 'win32' ? 'echo' : '/bin/false',
    },
  });
  if (result.status !== 0) {
    throw new VkenIntakeError(
      'VKEN_INTAKE_FAILED',
      `git clone failed: ${(result.stderr || result.stdout || '').slice(-1000)}`,
    );
  }
  const sizeMb = directorySize(resolvedClone) / 1024 / 1024;
  if (sizeMb > 50) {
    fs.rmSync(resolvedClone, { recursive: true, force: true });
    throw new VkenIntakeError('VKEN_REPO_TOO_LARGE', `Repository is ${sizeMb.toFixed(1)} MB; limit is 50 MB.`);
  }
  return detectSupportedWorkspace({
    source: 'url',
    sourceRef: cleanUrl,
    workspacePath: resolvedClone,
  });
}

export function intakeFromWebsite(
  url: string,
  opts: { dataDir: string; runId: string },
): VkenIntakeResult {
  const cleanUrl = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    throw new VkenIntakeError('VKEN_INTAKE_FAILED', 'Enter a valid public http or https URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new VkenIntakeError('VKEN_INTAKE_FAILED', 'Only public http and https URLs are supported.');
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new VkenIntakeError('VKEN_INTAKE_FAILED', 'Private and local network URLs are not supported.');
  }
  const workspacePath = path.join(opts.dataDir, 'vken', 'website-targets', opts.runId);
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.writeFileSync(path.join(workspacePath, 'target-url.txt'), cleanUrl);
  return {
    source: 'website',
    sourceRef: cleanUrl,
    repoName: parsed.hostname.replace(/^www\./, ''),
    workspacePath,
    framework: 'website-capture',
    packageManager: 'npm',
    tailwindVersion: 4,
  };
}

export function resolveVkenIntake(
  projectRoot: string,
  request: VkenCreateRunRequest,
  opts?: { dataDir: string; runId: string },
): VkenIntakeResult {
  if (request.intake.kind === 'sample') return intakeFromSample(projectRoot, request.intake.sampleId);
  if (!opts) {
    throw new VkenIntakeError('VKEN_INTAKE_FAILED', 'URL intake requires a run-scoped clone directory');
  }
  if (request.intake.kind === 'website') return intakeFromWebsite(request.intake.url, opts);
  return intakeFromUrl(request.intake.url, opts);
}

function detectSupportedWorkspace(input: {
  source: 'sample' | 'url';
  sourceRef: string;
  workspacePath: string;
}): VkenIntakeResult {
  const packageJsonPath = path.join(input.workspacePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new VkenIntakeError('VKEN_FRAMEWORK_UNSUPPORTED', 'package.json not found');
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  const hasViteReact = Boolean(deps.vite && deps.react && deps['react-dom']);
  const hasTailwind =
    Boolean(deps.tailwindcss) ||
    fs.existsSync(path.join(input.workspacePath, 'tailwind.config.js')) ||
    fs.existsSync(path.join(input.workspacePath, 'tailwind.config.ts'));
  if (!hasViteReact || !hasTailwind) {
    throw new VkenIntakeError(
      'VKEN_FRAMEWORK_UNSUPPORTED',
      'V1 supports Vite + React + Tailwind workspaces only',
    );
  }
  return {
    source: input.source,
    sourceRef: input.sourceRef,
    repoName: packageJson.name ?? path.basename(input.workspacePath),
    workspacePath: input.workspacePath,
    framework: 'vite-react-tailwind',
    packageManager: detectPackageManager(input.workspacePath),
    tailwindVersion: detectTailwindVersion(input.workspacePath),
  };
}

function detectPackageManager(root: string): 'npm' | 'pnpm' | 'yarn' | 'bun' {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb'))) return 'bun';
  return 'npm';
}

function detectTailwindVersion(root: string): 3 | 4 {
  const cssFiles = walk(root).filter((file) => file.endsWith('.css'));
  for (const file of cssFiles) {
    const css = fs.readFileSync(file, 'utf8');
    if (css.includes("@import 'tailwindcss'") || css.includes('@theme')) return 4;
  }
  return 3;
}

function walk(root: string): string[] {
  const entries: string[] = [];
  for (const name of fs.readdirSync(root)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = path.join(root, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) entries.push(...walk(full));
    else entries.push(full);
  }
  return entries;
}

function directorySize(root: string): number {
  let total = 0;
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) total += directorySize(full);
    else total += stat.size;
  }
  return total;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a = 0, b = 0] = host.split('.').map((part) => Number(part));
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return false;
}
