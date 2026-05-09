import type { VkenProviderRequest, VkenProviderRawResult } from '../client.js';
import { chatOpenAiCompatible } from './openai-compatible.js';

export async function chatOllama(input: VkenProviderRequest): Promise<VkenProviderRawResult> {
  const baseUrl = input.byok?.baseUrl ?? process.env.VKEN_OLLAMA_URL ?? 'http://127.0.0.1:11434/v1';
  return chatOpenAiCompatible({
    url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: input.byok?.apiKey ? { Authorization: `Bearer ${input.byok.apiKey}` } : {},
    model: input.model,
    messages: input.messages,
    timeoutMs: input.timeoutMs,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
}
