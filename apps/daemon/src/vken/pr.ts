import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { VkenPatch } from './types.js';

interface GitHubRepo {
  owner: string;
  repo: string;
}

export async function createVkenPullRequest(input: {
  runId: string;
  sampleId: string;
  materializedDir: string;
  scoreBefore: number;
  scoreAfter: number;
  directionName: string;
  patches: VkenPatch[];
  bundleUrl: string;
  replayUrl: string;
}): Promise<string> {
  const token = process.env.VKEN_GITHUB_BOT_TOKEN;
  if (!token) throw new Error('VKEN_GITHUB_BOT_TOKEN is not set');
  const repo = resolveGitHubRepo();
  if (!repo) throw new Error('VKEN_GITHUB_REPO or GitHub origin remote is required');
  const base = process.env.VKEN_GITHUB_BASE_BRANCH ?? 'main';
  const branch = `vken/run-${input.runId}`;
  const baseRef = await github(token, `repos/${repo.owner}/${repo.repo}/git/ref/heads/${base}`);
  const existing = await github(token, `repos/${repo.owner}/${repo.repo}/pulls?head=${repo.owner}:${encodeURIComponent(branch)}&state=open`);
  if (Array.isArray(existing) && existing[0]?.html_url) return String(existing[0].html_url);

  const tree = await createTree(token, repo, input.materializedDir, baseRef.object.sha);
  const commit = await github(token, `repos/${repo.owner}/${repo.repo}/git/commits`, {
    method: 'POST',
    body: {
      message: `feat(vken): apply run ${input.runId}`,
      tree: tree.sha,
      parents: [baseRef.object.sha],
    },
  });

  await upsertRef(token, repo, branch, commit.sha);
  const pr = await github(token, `repos/${repo.owner}/${repo.repo}/pulls`, {
    method: 'POST',
    body: {
      title: `VKEN run ${input.runId} (${input.sampleId})`,
      head: branch,
      base,
      body: prBody(input),
    },
  });
  return String(pr.html_url);
}

function resolveGitHubRepo(): GitHubRepo | null {
  const configured = process.env.VKEN_GITHUB_REPO;
  const raw = configured || gitRemoteOrigin();
  if (!raw) return null;
  const match =
    raw.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/) ??
    raw.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]! };
}

function gitRemoteOrigin(): string | null {
  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function createTree(token: string, repo: GitHubRepo, dir: string, baseTree: string) {
  const tree = [];
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file).replaceAll(path.sep, '/');
    const blob = await github(token, `repos/${repo.owner}/${repo.repo}/git/blobs`, {
      method: 'POST',
      body: {
        content: fs.readFileSync(file, 'utf8'),
        encoding: 'utf-8',
      },
    });
    tree.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
  }
  return github(token, `repos/${repo.owner}/${repo.repo}/git/trees`, {
    method: 'POST',
    body: { base_tree: baseTree, tree },
  });
}

async function upsertRef(token: string, repo: GitHubRepo, branch: string, sha: string): Promise<void> {
  const refPath = `repos/${repo.owner}/${repo.repo}/git/refs/heads/${encodeURIComponent(branch)}`;
  const existing = await github(token, refPath, { allow404: true });
  if (existing) {
    await github(token, refPath, {
      method: 'PATCH',
      body: { sha, force: true },
    });
    return;
  }
  await github(token, `repos/${repo.owner}/${repo.repo}/git/refs`, {
    method: 'POST',
    body: { ref: `refs/heads/${branch}`, sha },
  });
}

async function github(
  token: string,
  pathName: string,
  options: { method?: string; body?: unknown; allow404?: boolean } = {},
) {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (options.body) init.body = JSON.stringify(options.body);
  const response = await fetch(`https://api.github.com/${pathName}`, init);
  if (options.allow404 && response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

function prBody(input: {
  runId: string;
  sampleId: string;
  scoreBefore: number;
  scoreAfter: number;
  directionName: string;
  patches: VkenPatch[];
  bundleUrl: string;
  replayUrl: string;
}): string {
  const delta = input.scoreAfter - input.scoreBefore;
  const patchLines = input.patches.length
    ? input.patches.map((patch) => `- [${patch.severity}] ${patch.rationale} (\`${patch.filePath}\`)`).join('\n')
    : '- No patches applied';
  return `## VKEN Run ${input.runId}

**Sample:** ${input.sampleId}
**Score:** ${input.scoreBefore.toFixed(1)} -> ${input.scoreAfter.toFixed(1)} (delta ${delta.toFixed(1)})
**Direction picked:** ${input.directionName}

### Patches applied
${patchLines}

### Validation
- tsc --noEmit
- npm run build
- a11y scan
- pixel diff
- console scan

### Provider
Inference served by the configured VKEN provider chain.

### Reproducibility
Run transcript and bundle: ${input.bundleUrl}
Cockpit replay: ${input.replayUrl}

Generated by VKEN Design Engine.`;
}

function walk(root: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(root)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === '.vite') continue;
    const full = path.join(root, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
