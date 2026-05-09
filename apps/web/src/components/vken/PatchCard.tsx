import type { VkenPatch } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';
import { EvidenceChip } from './EvidenceChip';

export function PatchCard({ runId, patch }: { runId: string | null; patch: VkenPatch }) {
  async function approve() {
    if (!runId) return;
    await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchIds: [patch.id] }),
    });
  }

  async function skip() {
    if (!runId) return;
    await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchIds: [patch.id] }),
    });
  }

  const first = patch.hunks[0];
  return (
    <article style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <strong>{patch.severity}</strong>
        <EvidenceChip ids={patch.evidenceKbIds} />
      </div>
      <p style={{ color: '#475467' }}>{patch.rationale}</p>
      <p style={{ fontSize: 12, color: '#667085' }}>{patch.filePath}</p>
      {first ? (
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 10, borderRadius: 6, maxHeight: 160, overflow: 'auto' }}>
{`- ${first.search.trim()}
+ ${first.replace.trim()}`}
        </pre>
      ) : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={approve} style={primaryButton}>
          Approve
        </button>
        <button type="button" onClick={skip} style={secondaryButton}>
          Skip
        </button>
      </div>
    </article>
  );
}

const primaryButton = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: 0,
  background: '#111827',
  color: 'white',
};

const secondaryButton = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #d0d5dd',
  background: 'white',
  color: '#344054',
};
