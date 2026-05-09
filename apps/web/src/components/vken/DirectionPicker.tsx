import type { VkenDirection } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';
import { EvidenceChip } from './EvidenceChip';

export function DirectionPicker({
  runId,
  directions,
}: {
  runId: string | null;
  directions: VkenDirection[];
}) {
  async function pick(directionId: string) {
    if (!runId) return;
    await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/direction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directionId }),
    });
  }

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ margin: '0 0 10px' }}>Directions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {directions.map((direction) => (
          <article key={direction.id} style={{ border: '1px solid #d0d5dd', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{direction.name}</strong>
              <EvidenceChip ids={direction.evidenceKbIds} />
            </div>
            <p style={{ margin: '6px 0', color: '#475467' }}>{direction.mood}</p>
            <p>{direction.summary}</p>
            <ul style={{ paddingLeft: 18 }}>
              {direction.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
            <button type="button" onClick={() => pick(direction.id)} style={buttonStyle}>
              Pick direction
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

const buttonStyle = {
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: 0,
  background: '#111827',
  color: 'white',
  fontWeight: 700,
};
