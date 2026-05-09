import { VkenLlmError } from '../errors.js';
import type { VkenProviderRequest, VkenProviderRawResult } from '../client.js';
import { chatOpenAiCompatible } from './openai-compatible.js';

export async function chatOpenRouter(input: VkenProviderRequest): Promise<VkenProviderRawResult> {
  const apiKey = input.byok?.apiKey ?? process.env.VKEN_OPENROUTER_KEY;
  if (!apiKey) throw new VkenLlmError('VKEN_LLM_CONFIG', 'VKEN_OPENROUTER_KEY is not set');
  const referer = process.env.HF_SPACE_ID
    ? `https://huggingface.co/spaces/${process.env.HF_SPACE_ID}`
    : process.env.VKEN_PUBLIC_URL ?? 'https://vken.design';
  return chatOpenAiCompatible({
    url: `${input.byok?.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': referer,
      'X-Title': 'VKEN Design Engine',
    },
    model: input.model,
    messages: input.messages,
    timeoutMs: input.timeoutMs,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
}
