import { useEffect, useState } from 'react';
import type { VkenLeaderboardResponse } from '@open-design/contracts';
import { navigate } from '../../router';
import { vkenFetch } from '../../providers/registry';

export function Leaderboard() {
  const [rows, setRows] = useState<VkenLeaderboardResponse['rows']>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const resp = await vkenFetch('/api/vken/leaderboard');
      if (!resp.ok) return;
      const body = (await resp.json()) as VkenLeaderboardResponse;
      if (!cancelled) setRows(body.rows ?? []);
    }
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: '#f8fafc' }}>
      <h1>VKEN Leaderboard</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
        <thead>
          <tr>
            <th style={cell}>Sample</th>
            <th style={cell}>Best delta</th>
            <th style={cell}>Attempts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sampleId} onClick={() => navigate({ kind: 'vken', runId: row.bestRunId, page: 'home' })} style={{ cursor: 'pointer' }}>
              <td style={cell}>{row.sampleId}</td>
              <td style={cell}>{Number(row.bestScoreDelta).toFixed(1)}</td>
              <td style={cell}>{row.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const cell = { borderBottom: '1px solid #e5e7eb', padding: 12, textAlign: 'left' as const };
