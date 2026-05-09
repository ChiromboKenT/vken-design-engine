import type { VkenPatch } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';
import { PatchCard } from './PatchCard';

export function PatchList({ runId, patches }: { runId: string | null; patches: VkenPatch[] }) {
  const pending = patches.filter((patch) => patch.status === 'proposed');

  async function approveTop() {
    if (!runId || pending.length === 0) return;
    await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchIds: pending.slice(0, 3).map((patch) => patch.id) }),
    });
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ marginTop: 0 }}>Patches</h2>
        <button type="button" onClick={approveTop} disabled={!pending.length} style={{ minHeight: 32, borderRadius: 8 }}>
          Approve top
        </button>
      </div>
      {patches.length === 0 ? (
        <p style={{ color: '#64748b' }}>Pick a direction to generate patch proposals.</p>
      ) : (
        patches.map((patch) => <PatchCard key={patch.id} runId={runId} patch={patch} />)
      )}
    </section>
  );
}
