export type VkenProviderId =
  | 'openrouter'
  | 'gemini'
  | 'amd-vllm'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'cassette';

export interface VkenByokConfig {
  provider: VkenProviderId;
  apiKey?: string | undefined;
  vlModel?: string | undefined;
  coderModel?: string | undefined;
  baseUrl?: string | undefined;
}

export interface VkenProviderSelection {
  id: VkenProviderId;
  source: 'env' | 'header';
  byok?: VkenByokConfig | undefined;
}

const PROVIDERS = new Set<VkenProviderId>([
  'openrouter',
  'gemini',
  'amd-vllm',
  'openai',
  'anthropic',
  'ollama',
  'cassette',
]);

export function normalizeProviderId(value: unknown, fallback: VkenProviderId): VkenProviderId {
  return typeof value === 'string' && PROVIDERS.has(value as VkenProviderId)
    ? (value as VkenProviderId)
    : fallback;
}

export function selectProviderChain(opts: { byok?: VkenByokConfig | undefined } = {}): VkenProviderSelection[] {
  if (opts.byok) {
    return [
      {
        id: normalizeProviderId(opts.byok.provider, 'cassette'),
        source: 'header',
        byok: opts.byok,
      },
    ];
  }

  const primary = normalizeProviderId(process.env.VKEN_LLM_PROVIDER, 'openrouter');
  const fallback1 = normalizeProviderId(
    process.env.VKEN_LLM_FALLBACK1,
    process.env.GOOGLE_API_KEY ? 'gemini' : 'cassette',
  );
  const chain: VkenProviderSelection[] = [
    { id: primary, source: 'env' },
    { id: fallback1, source: 'env' },
    { id: 'cassette', source: 'env' },
  ];
  const seen = new Set<VkenProviderId>();
  return chain.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

export function modelForProvider(id: VkenProviderId, task: 'vl' | 'coder', byok?: VkenByokConfig): string {
  if (byok) {
    const override = task === 'vl' ? byok.vlModel : byok.coderModel;
    if (override) return override;
  }
  if (id === 'openrouter') {
    return task === 'vl'
      ? (process.env.VKEN_OR_VL_MODEL ?? 'qwen/qwen2.5-vl-72b-instruct:free')
      : (process.env.VKEN_OR_CODER_MODEL ?? 'qwen/qwen-2.5-coder-32b-instruct:free');
  }
  if (id === 'gemini') return process.env.VKEN_GEMINI_MODEL ?? 'gemini-2.5-flash';
  if (id === 'amd-vllm') {
    return task === 'vl'
      ? (process.env.VKEN_VLLM_VL_MODEL ?? 'Qwen/Qwen2.5-VL-72B-Instruct')
      : (process.env.VKEN_VLLM_CODER_MODEL ?? 'Qwen/Qwen3-Coder-30B-A3B-Instruct');
  }
  if (id === 'openai') return task === 'vl' ? 'gpt-4o-mini' : 'gpt-4o-mini';
  if (id === 'anthropic') return 'claude-3-5-haiku-latest';
  if (id === 'ollama') return task === 'vl' ? 'llava' : 'qwen2.5-coder';
  return `cassette-${task}`;
}
