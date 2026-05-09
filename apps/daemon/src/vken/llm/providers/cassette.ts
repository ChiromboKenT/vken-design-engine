import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { VkenProviderRequest, VkenProviderRawResult } from '../client.js';

interface CassetteCall {
  task: 'vl' | 'coder';
  phase?: string;
  promptHash?: string;
  response: unknown;
  usage?: { inputTokens?: number; outputTokens?: number };
}

interface CassetteFile {
  schemaVersion: 1;
  sampleId: string;
  calls: CassetteCall[];
}

export async function chatCassette(input: VkenProviderRequest): Promise<VkenProviderRawResult> {
  const startedAt = Date.now();
  const promptHash = `sha256:${createHash('sha256')
    .update(JSON.stringify(input.messages))
    .digest('hex')}`;
  const cassette = readCassette(input.sampleId ?? 'landing-generic');
  const call =
    cassette?.calls.find(
      (item) =>
        item.task === input.task &&
        item.phase === input.phase &&
        (!item.promptHash || item.promptHash === promptHash),
    ) ??
    cassette?.calls.find((item) => item.task === input.task && item.phase === input.phase) ??
    cassette?.calls.find((item) => item.task === input.task) ??
    defaultCall(input);
  return {
    raw: JSON.stringify(call.response),
    modelId: `cassette:${input.sampleId ?? 'generic'}:${input.phase ?? input.task}`,
    usage: {
      inputTokens: call.usage?.inputTokens ?? 0,
      outputTokens: call.usage?.outputTokens ?? 0,
      latencyMs: Date.now() - startedAt,
    },
  };
}

function readCassette(sampleId: string): CassetteFile | null {
  const file = path.join(repoRoot(), 'infra', 'space', 'cassettes', `${sampleId}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as CassetteFile;
  } catch (error) {
    console.warn(`[vken:cassette] invalid cassette ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function repoRoot(): string {
  return path.resolve(import.meta.dirname, '..', '..', '..', '..', '..', '..');
}

function defaultCall(input: VkenProviderRequest): CassetteCall {
  if (input.task === 'vl') {
    return {
      task: 'vl',
      response: {
        designQuality: input.sampleId === 'dashboard-cluttered' ? 0.37 : input.sampleId === 'ecommerce-basic' ? 0.42 : 0.46,
        findings: [
          {
            dimension: 'hierarchy',
            severity: 'P1',
            description: 'Clarify the primary action and reduce competing surfaces.',
            regionBox: { x: 24, y: 80, w: 680, h: 360 },
          },
          {
            dimension: 'color',
            severity: 'P2',
            description: 'Replace hardcoded colors with a smaller token palette.',
            regionBox: { x: 0, y: 0, w: 1440, h: 900 },
          },
          {
            dimension: 'spacing',
            severity: 'P2',
            description: 'Normalize card padding and border radius across repeated elements.',
            regionBox: { x: 80, y: 420, w: 1000, h: 320 },
          },
          {
            dimension: 'neuroinclusive',
            severity: 'P2',
            description: 'Reduce competing calls to action so the primary task is predictable at a glance.',
            regionBox: { x: 40, y: 120, w: 900, h: 460 },
          },
        ],
      },
      usage: { inputTokens: 1200, outputTokens: 260 },
    };
  }
  if (input.phase === 'patches') {
    return {
      task: 'coder',
      phase: 'patches',
      response: { patches: [] },
      usage: { inputTokens: 1600, outputTokens: 500 },
    };
  }
  return {
    task: 'coder',
    phase: 'directions',
    response: {
      directions: [
        {
          id: 'token-consolidation',
          name: 'Token consolidation',
          mood: 'Calmer system',
          summary: 'Replace scattered hardcoded surfaces with a tighter palette and consistent radii.',
          changes: ['Introduce reusable color variables', 'Normalize button hierarchy', 'Align repeated card surfaces'],
          effort: 'medium',
          risk: 'low',
          evidenceKbIds: ['seed-token-rhythm'],
        },
        {
          id: 'conversion-focus',
          name: 'Conversion focus',
          mood: 'Clearer action',
          summary: 'Make the primary route through the page more obvious without changing product copy.',
          changes: ['Increase CTA contrast', 'Reduce secondary button weight', 'Tighten hero spacing'],
          effort: 'low',
          risk: 'low',
          evidenceKbIds: ['seed-action-contrast'],
        },
      ],
    },
    usage: { inputTokens: 900, outputTokens: 240 },
  };
}
