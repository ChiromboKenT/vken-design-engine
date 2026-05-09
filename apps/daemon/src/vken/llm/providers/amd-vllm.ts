import { VkenLlmError } from '../errors.js';
import type { VkenProviderRequest, VkenProviderRawResult } from '../client.js';
import { chatOpenAiCompatible } from './openai-compatible.js';

export async function chatAmdVllm(input: VkenProviderRequest): Promise<VkenProviderRawResult> {
  const baseUrl =
    input.byok?.baseUrl ??
    (input.task === 'vl' ? process.env.VKEN_VLLM_VL_URL : process.env.VKEN_VLLM_CODER_URL);
  if (!baseUrl) throw new VkenLlmError('VKEN_LLM_CONFIG', 'VKEN_VLLM_*_URL is not set');
  const token = input.byok?.apiKey ?? process.env.VKEN_VLLM_TOKEN;
  return chatOpenAiCompatible({
    url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    model: input.model,
    messages: input.messages,
    timeoutMs: input.timeoutMs,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
}
