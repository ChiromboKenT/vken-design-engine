import { useEffect, useState } from 'react';
import type { VkenKbListResponse } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';

export function KBPanel() {
  const [rules, setRules] = useState<VkenKbListResponse['rules']>([]);

  useEffect(() => {
    void (async () => {
      const resp = await vkenFetch('/api/vken/kb');
      if (!resp.ok) return;
      const body = (await resp.json()) as VkenKbListResponse;
      setRules(body.rules ?? []);
    })();
  }, []);

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#f8fafc' }}>
      <h1>VKEN KB</h1>
      <section style={{ display: 'grid', gap: 12 }}>
        {rules.length === 0 ? <p>No committed rules yet. Finalize a run to promote learned rules.</p> : null}
        {rules.map((rule) => (
          <article key={rule.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <strong>{rule.id}</strong>
            <p>{rule.ruleText}</p>
            <small>
              accepts {rule.acceptCount} / rejects {rule.rejectCount} / delta {Number(rule.avgScoreDelta).toFixed(2)}
            </small>
          </article>
        ))}
      </section>
    </main>
  );
}
