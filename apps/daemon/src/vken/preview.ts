import fs from 'node:fs';
import path from 'node:path';
import { materializeTo, type VkenVirtualFsSession } from './apply.js';
import { startViteDevServer, type VkenDevServer } from './runner.js';

export async function startVkenPreview(input: {
  session: VkenVirtualFsSession;
  runDir: string;
  checkpoint: string;
}): Promise<VkenDevServer & { materializedDir: string }> {
  const materializedDir = path.join(input.runDir, 'preview', safeSegment(input.checkpoint));
  materializeTo(input.session, materializedDir, { linkNodeModules: true });
  const server = await startViteDevServer({ workspacePath: materializedDir, timeoutMs: 20_000 });
  return { ...server, materializedDir };
}

export function ensurePreviewWorkspace(input: {
  session: VkenVirtualFsSession;
  runDir: string;
  checkpoint: string;
}): string {
  const materializedDir = path.join(input.runDir, 'preview', safeSegment(input.checkpoint));
  materializeTo(input.session, materializedDir, { linkNodeModules: true });
  return materializedDir;
}

function safeSegment(value: string): string {
  return value.replace(/[^\w.-]+/g, '-').slice(0, 80);
}
