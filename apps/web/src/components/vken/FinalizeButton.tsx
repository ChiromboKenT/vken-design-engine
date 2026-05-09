import { useState } from 'react';
import type { VkenValidatePayload } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';

export function FinalizeButton({
  runId,
  validations,
  prUrl,
}: {
  runId: string | null;
  validations: VkenValidatePayload[];
  prUrl: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(prUrl);

  async function finalize() {
    if (!runId) return;
    setBusy(true);
    try {
      const resp = await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/finalize`, { method: 'POST' });
      const body = (await resp.json()) as { prUrl?: string; bundleUrl?: string };
      setLink(body.prUrl ?? body.bundleUrl ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 16 }}>
      <button type="button" onClick={finalize} disabled={!runId || busy} style={buttonStyle}>
        {busy ? 'Finalizing...' : 'Finalize'}
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {validations.map((stage) => (
          <span key={stage.stage} style={{ ...chipStyle, background: stage.ok ? '#ecfdf3' : '#fef3f2' }}>
            {stage.stage}: {stage.ok ? 'ok' : 'check'}
          </span>
        ))}
      </div>
      {link ? (
        <p>
          <a href={link} target="_blank" rel="noreferrer">
            Open final output
          </a>
        </p>
      ) : null}
    </section>
  );
}

const buttonStyle = {
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 8,
  border: 0,
  background: '#111827',
  color: 'white',
  fontWeight: 700,
};

const chipStyle = {
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 12,
  color: '#344054',
};
