import { useState } from 'react';
import { vkenFetch } from '../../providers/registry';
import { emptyByokConfig, loadByokConfig, saveByokConfig, type VkenByokConfig } from '../../state/byok';

export function ByokPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<VkenByokConfig>(() => loadByokConfig());
  const [status, setStatus] = useState<string>('');

  if (!open) return null;

  function update(patch: Partial<VkenByokConfig>) {
    const next = { ...config, ...patch };
    setConfig(next);
    saveByokConfig(next);
  }

  async function test() {
    setStatus('Testing...');
    const resp = await vkenFetch('/api/vken/llm/test', { method: 'POST' });
    const body = (await resp.json()) as { ok?: boolean; provider?: string; model?: string; error?: string; latencyMs?: number };
    setStatus(body.ok ? `OK ${body.provider} ${body.model} ${body.latencyMs}ms` : body.error || 'Connection failed');
  }

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true" aria-label="Bring your own key">
      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ marginTop: 0 }}>Provider</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <label style={labelStyle}>
          Provider
          <select value={config.provider} onChange={(event) => update({ provider: event.target.value })}>
            {['cassette', 'openrouter', 'gemini', 'openai', 'anthropic', 'ollama', 'amd-vllm'].map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          API key
          <input value={config.apiKey} onChange={(event) => update({ apiKey: event.target.value })} type="password" />
        </label>
        <label style={labelStyle}>
          VL model
          <input value={config.vlModel} onChange={(event) => update({ vlModel: event.target.value })} />
        </label>
        <label style={labelStyle}>
          Coder model
          <input value={config.coderModel} onChange={(event) => update({ coderModel: event.target.value })} />
        </label>
        <label style={labelStyle}>
          Base URL
          <input value={config.baseUrl} onChange={(event) => update({ baseUrl: event.target.value })} />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={config.remember}
            onChange={(event) => update({ remember: event.target.checked })}
          />
          Remember in this browser
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={test} style={buttonStyle}>
            Test connection
          </button>
          <button type="button" onClick={() => update(emptyByokConfig())}>
            Reset
          </button>
        </div>
        {status ? <p>{status}</p> : null}
      </section>
    </div>
  );
}

const backdropStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(15, 23, 42, 0.32)',
  display: 'flex',
  justifyContent: 'flex-end',
  zIndex: 30,
};

const panelStyle = {
  width: 'min(420px, 100vw)',
  background: 'white',
  minHeight: '100%',
  padding: 20,
  boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.18)',
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  marginBottom: 12,
};

const buttonStyle = {
  minHeight: 36,
  borderRadius: 8,
  border: 0,
  background: '#111827',
  color: 'white',
  padding: '0 12px',
};
