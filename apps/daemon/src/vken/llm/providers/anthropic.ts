import { VkenLlmError, VkenTimeoutError } from '../errors.js';
import type { VkenChatMessage, VkenProviderRequest, VkenProviderRawResult } from '../client.js';

export async function chatAnthropic(input: VkenProviderRequest): Promise<VkenProviderRawResult> {
  const apiKey = input.byok?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new VkenLlmError('VKEN_LLM_CONFIG', 'ANTHROPIC_API_KEY is not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const startedAt = Date.now();
  const system = input.messages
    .filter((message) => message.role === 'system')
    .map((message) => flattenMessageContent(message))
    .join('\n\n');
  try {
    const response = await fetch(`${input.byok?.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? 1600,
        temperature: input.temperature ?? 0.2,
        system,
        messages: input.messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: flattenMessageContent(message),
          })),
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new VkenLlmError(
        response.status === 429 ? 'VKEN_LLM_RATE_LIMIT' : 'VKEN_LLM_HTTP',
        `Anthropic HTTP ${response.status}`,
        { status: response.status, body: text.slice(0, 1200) },
      );
    }
    const data = JSON.parse(text) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const raw = data.content?.map((part) => part.text ?? '').join('') ?? '';
    if (!raw.trim()) throw new VkenLlmError('VKEN_LLM_EMPTY', 'empty Anthropic response');
    return {
      raw,
      modelId: input.model,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new VkenTimeoutError(`Anthropic timeout after ${input.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function flattenMessageContent(message: VkenChatMessage): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .map((part) => (part.type === 'text' ? part.text : `[image: ${part.image_url.url.slice(0, 64)}]`))
    .join('\n');
}
