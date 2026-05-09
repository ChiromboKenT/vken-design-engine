import type { VkenProviderInfoResponse } from '@open-design/contracts';

export interface VkenByokConfig {
  provider: string;
  apiKey: string;
  vlModel: string;
  coderModel: string;
  baseUrl: string;
  remember: boolean;
}

const STORAGE_KEY = 'vken.byok.v1';

export function emptyByokConfig(): VkenByokConfig {
  return { provider: 'cassette', apiKey: '', vlModel: '', coderModel: '', baseUrl: '', remember: false };
}

export function loadByokConfig(): VkenByokConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<VkenByokConfig> | null;
    return { ...emptyByokConfig(), ...(parsed ?? {}) };
  } catch {
    return emptyByokConfig();
  }
}

export function saveByokConfig(config: VkenByokConfig): void {
  if (!config.remember) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function byokHeader(config = loadByokConfig()): Record<string, string> {
  if (!config.provider || config.provider === 'env') return {};
  const payload = {
    provider: config.provider,
    apiKey: config.apiKey || undefined,
    vlModel: config.vlModel || undefined,
    coderModel: config.coderModel || undefined,
    baseUrl: config.baseUrl || undefined,
  };
  return { 'x-vken-byok': base64Url(JSON.stringify(payload)) };
}

export function providerLabel(info: VkenProviderInfoResponse | null): string {
  if (!info) return 'Provider pending';
  if (info.id === 'cassette') return 'Replaying recorded run';
  return `Running on ${info.coderModel || info.vlModel} via ${info.id}`;
}

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
