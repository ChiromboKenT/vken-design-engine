import { VkenLlmError } from '../errors.js';
import type { VkenProviderRequest, VkenProviderRawResult } from '../client.js';
import { chatOpenAiCompatible } from './openai-compatible.js';

export async function chatOpenAi(input: VkenProviderRequest): Promise<VkenProviderRawResult> {
  const apiKey = input.byok?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new VkenLlmError('VKEN_LLM_CONFIG', 'OPENAI_API_KEY is not set');
  return chatOpenAiCompatible({
    url: `${input.byok?.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    model: input.model,
    messages: input.messages,
    timeoutMs: input.timeoutMs,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
}
