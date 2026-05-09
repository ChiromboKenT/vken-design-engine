import { VkenLlmError, VkenTimeoutError } from '../errors.js';
import type { VkenChatMessage, VkenProviderRequest, VkenProviderRawResult } from '../client.js';

export async function chatGemini(input: VkenProviderRequest): Promise<VkenProviderRawResult> {
  const apiKey = input.byok?.apiKey ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new VkenLlmError('VKEN_LLM_CONFIG', 'GOOGLE_API_KEY is not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const startedAt = Date.now();
  try {
    const url = `${input.byok?.baseUrl ?? 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(input.model)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: geminiContents(input.messages),
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          maxOutputTokens: input.maxTokens ?? 1600,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new VkenLlmError(
        response.status === 429 ? 'VKEN_LLM_RATE_LIMIT' : 'VKEN_LLM_HTTP',
        `Gemini HTTP ${response.status}`,
        { status: response.status, body: text.slice(0, 1200) },
      );
    }
    const data = JSON.parse(text) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const raw =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('') ?? '';
    if (!raw.trim()) throw new VkenLlmError('VKEN_LLM_EMPTY', 'empty Gemini response');
    return {
      raw,
      modelId: input.model,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new VkenTimeoutError(`Gemini timeout after ${input.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function geminiContents(messages: VkenChatMessage[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: flattenMessageContent(message) }],
    }));
}

function flattenMessageContent(message: VkenChatMessage): string {
  if (typeof message.content === 'string') return message.content;
  return message.content
    .map((part) => {
      if (part.type === 'text') return part.text;
      if (part.type === 'image_url') return `[image: ${part.image_url.url.slice(0, 64)}]`;
      return '';
    })
    .join('\n');
}
