import { useEffect, useState } from 'react';
import type { VkenKbBenchResponse } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';

export function LearningBench() {
  const [seed, setSeed] = useState<VkenKbBenchResponse | null>(null);
  const [learned, setLearned] = useState<VkenKbBenchResponse | null>(null);

  useEffect(() => {
    void (async () => {
      const [seedResp, learnedResp] = await Promise.all([
        vkenFetch('/api/vken/kb/bench?variant=seed-only'),
        vkenFetch('/api/vken/kb/bench?variant=seed+learned'),
      ]);
      if (seedResp.ok) setSeed((await seedResp.json()) as VkenKbBenchResponse);
      if (learnedResp.ok) setLearned((await learnedResp.json()) as VkenKbBenchResponse);
    })();
  }, []);

  if (!seed || !learned) {
    return (
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Learning Bench</h2>
        <p style={{ color: '#64748b' }}>Measuring KB deltas across the sample suite...</p>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Learning Bench</h2>
        <strong>Aggregate {formatDelta(learned.aggregate - seed.aggregate)}</strong>
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <BenchRow label="Without learned rules" result={seed} />
        <BenchRow label="With learned rules" result={learned} highlight />
      </div>
      <footer style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
        Generated {new Date(learned.generatedAt).toLocaleString()} - KB rules {learned.ruleCounts.seed + learned.ruleCounts.learned} total, {learned.ruleCounts.signed} signed
      </footer>
    </section>
  );
}

function BenchRow({ label, result, highlight }: { label: string; result: VkenKbBenchResponse; highlight?: boolean }) {
  return (
    <article style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: highlight ? '#f0fdf4' : '#ffffff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>{label}</strong>
        <span>{formatDelta(result.aggregate)}</span>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {result.deltas.map((delta) => (
          <div key={delta.sample} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 72px', gap: 10, alignItems: 'center' }}>
            <span>{delta.sample}</span>
            <div style={{ height: 10, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(4, Math.min(100, (delta.scoreFinal / 10) * 100))}%`,
                  height: '100%',
                  background: highlight ? '#16a34a' : '#64748b',
                }}
              />
            </div>
            <span style={{ textAlign: 'right' }}>{formatDelta(delta.delta)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function formatDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

const panelStyle = {
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 16,
};
