import fs from 'node:fs';
import path from 'node:path';
import type { VkenPatch } from './types.js';

export interface VkenVirtualFsSession {
  workspacePath: string;
  files: Map<string, string>;
  originalFiles: Map<string, string>;
  snapshots: Map<string, Map<string, string>>;
  appliedPatchIds: string[];
}

const TEXT_FILE_RE = /\.(?:tsx|ts|jsx|js|css|html|json|md|config\.ts)$/;

export function initVirtualFs(workspacePath: string): VkenVirtualFsSession {
  const files = new Map<string, string>();
  for (const file of walk(workspacePath)) {
    const rel = relative(workspacePath, file);
    if (!TEXT_FILE_RE.test(rel) && !['package.json', 'index.html'].includes(path.basename(rel))) continue;
    files.set(rel, fs.readFileSync(file, 'utf8'));
  }
  return {
    workspacePath,
    files,
    originalFiles: cloneFiles(files),
    snapshots: new Map([['initial', cloneFiles(files)]]),
    appliedPatchIds: [],
  };
}

export function patchSearchMatches(session: VkenVirtualFsSession, patch: Pick<VkenPatch, 'filePath' | 'hunks'>): boolean {
  const content = session.files.get(patch.filePath);
  if (content == null) return false;
  return patch.hunks.every((hunk) => norm(content).includes(norm(hunk.search)));
}

export function applyPatchVirtual(
  session: VkenVirtualFsSession,
  patch: Pick<VkenPatch, 'id' | 'filePath' | 'hunks'>,
): { ok: true } | { ok: false; reason: string } {
  const original = session.files.get(patch.filePath);
  if (original == null) return { ok: false, reason: `file not found: ${patch.filePath}` };
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  let current = norm(original);
  for (const hunk of patch.hunks) {
    const search = norm(hunk.search);
    if (!current.includes(search)) {
      return { ok: false, reason: `search text not found in ${patch.filePath}` };
    }
    current = current.replace(search, norm(hunk.replace));
  }
  session.files.set(patch.filePath, restoreNewline(current, newline));
  session.appliedPatchIds.push(patch.id);
  session.snapshots.set(patch.id, cloneFiles(session.files));
  return { ok: true };
}

export function revertPatchVirtual(session: VkenVirtualFsSession, patchId: string): boolean {
  const index = session.appliedPatchIds.indexOf(patchId);
  if (index === -1) return false;
  const previousCheckpoint = index === 0 ? 'initial' : session.appliedPatchIds[index - 1]!;
  const snapshot = session.snapshots.get(previousCheckpoint);
  if (!snapshot) return false;
  session.files = cloneFiles(snapshot);
  session.appliedPatchIds = session.appliedPatchIds.slice(0, index);
  return true;
}

export function scrubTo(session: VkenVirtualFsSession, checkpoint: 'initial' | { patchId: string }): boolean {
  const key = checkpoint === 'initial' ? 'initial' : checkpoint.patchId;
  const snapshot = session.snapshots.get(key);
  if (!snapshot) return false;
  session.files = cloneFiles(snapshot);
  session.appliedPatchIds =
    key === 'initial'
      ? []
      : session.appliedPatchIds.slice(0, session.appliedPatchIds.indexOf(key) + 1);
  return true;
}

export function materializeTo(
  session: VkenVirtualFsSession,
  dir: string,
  opts: { linkNodeModules?: boolean } = {},
): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, content] of session.files) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  if (opts.linkNodeModules) {
    linkIfPresent(path.join(session.workspacePath, 'node_modules'), path.join(dir, 'node_modules'));
  }
}

export function readVirtualFile(session: VkenVirtualFsSession, filePath: string): string | null {
  return session.files.get(filePath) ?? null;
}

export function norm(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function restoreNewline(value: string, newline: string): string {
  return newline === '\n' ? value : value.replace(/\n/g, newline);
}

function cloneFiles(files: Map<string, string>): Map<string, string> {
  return new Map(files);
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

function relative(root: string, file: string): string {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function linkIfPresent(source: string, target: string): void {
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  try {
    fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
  } catch {
    // Preview still has a bundle path; validation can run npm install if needed.
  }
}
