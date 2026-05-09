import type { VkenProviderId } from './select-provider.js';
import type { VkenChatUsage } from './client.js';

export function recordUsage(
  db: { prepare: (sql: string) => { run: (...args: unknown[]) => unknown } } | null | undefined,
  runId: string | null | undefined,
  _providerId: VkenProviderId,
  _modelId: string,
  usage: VkenChatUsage,
  _task: 'vl' | 'coder',
): void {
  if (!db || !runId) return;
  db.prepare(
    `UPDATE vken_runs
        SET vllm_input_tokens = COALESCE(vllm_input_tokens, 0) + ?,
            vllm_output_tokens = COALESCE(vllm_output_tokens, 0) + ?
      WHERE id = ?`,
  ).run(usage.inputTokens, usage.outputTokens, runId);
}
