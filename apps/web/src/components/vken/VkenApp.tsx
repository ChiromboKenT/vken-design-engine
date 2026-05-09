import { useState } from 'react';
import { navigate } from '../../router';
import { vkenFetch } from '../../providers/registry';
import { Cockpit } from './Cockpit';
import { Hook } from './Hook';
import { KBPanel } from './KBPanel';
import { Leaderboard } from './Leaderboard';
import { useVkenSse } from './useVkenSse';

export function VkenApp({ runId, page }: { runId: string | null; page: 'home' | 'leaderboard' | 'kb' }) {
  const [starting, setStarting] = useState(false);
  const state = useVkenSse(runId);

  async function startSample() {
    setStarting(true);
    try {
      const resp = await vkenFetch('/api/vken/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake: { kind: 'sample', sampleId: 'landing-generic' } }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const body = (await resp.json()) as { runId: string };
      navigate({ kind: 'vken', runId: body.runId, page: 'home' });
    } finally {
      setStarting(false);
    }
  }

  if (page === 'leaderboard') return <Leaderboard />;
  if (page === 'kb') return <KBPanel />;

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', color: '#111827' }}>
      <Hook starting={starting} onStartSample={startSample} />
      <Cockpit runId={runId} state={state} />
    </main>
  );
}
