import { VkenLlmError, VkenTimeoutError } from '../errors.js';
import type { VkenChatMessage, VkenProviderRawResult } from '../client.js';

export async function chatOpenAiCompatible(input: {
  url: string;
  headers: Record<string, string>;
  model: string;
  messages: VkenChatMessage[];
  timeoutMs: number;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
}): Promise<VkenProviderRawResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(input.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...input.headers,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1600,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new VkenLlmError(
        response.status === 429 ? 'VKEN_LLM_RATE_LIMIT' : 'VKEN_LLM_HTTP',
        `LLM HTTP ${response.status}`,
        { status: response.status, body: text.slice(0, 1200) },
      );
    }
    const data = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number };
    };
    const raw = data.choices?.[0]?.message?.content ?? '';
    if (!raw.trim()) throw new VkenLlmError('VKEN_LLM_EMPTY', 'empty chat completion');
    return {
      raw,
      modelId: input.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? data.usage?.output_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new VkenTimeoutError(`LLM timeout after ${input.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
