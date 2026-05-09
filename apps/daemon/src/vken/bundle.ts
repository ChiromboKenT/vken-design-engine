import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import type { VkenPatch } from './types.js';

export async function writeVkenBundle(input: {
  materializedDir: string;
  outFile: string;
  scorecard: unknown;
  patches: VkenPatch[];
}): Promise<string> {
  const zip = new JSZip();
  for (const file of walk(input.materializedDir)) {
    const rel = path.relative(input.materializedDir, file).replaceAll(path.sep, '/');
    zip.file(`workspace/${rel}`, fs.readFileSync(file));
  }
  zip.file('scorecard.json', JSON.stringify(input.scorecard, null, 2));
  zip.file('patches.json', JSON.stringify(input.patches, null, 2));
  fs.mkdirSync(path.dirname(input.outFile), { recursive: true });
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(input.outFile, content);
  return input.outFile;
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
