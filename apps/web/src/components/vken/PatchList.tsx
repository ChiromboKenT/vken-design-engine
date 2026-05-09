import { useMemo, useState } from 'react';
import type { VkenPatch } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';
import { PatchCard } from './PatchCard';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export function PatchList({ runId, patches }: { runId: string | null; patches: VkenPatch[] }) {
  const pending = useMemo(() => patches.filter((patch) => patch.status === 'proposed'), [patches]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const focusedPatch = pending[Math.min(focusedIndex, Math.max(0, pending.length - 1))];

  async function approvePatch(patchIds: string[]) {
    if (!runId || patchIds.length === 0) return;
    await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchIds }),
    });
  }

  async function skipPatch(patchIds: string[]) {
    if (!runId || patchIds.length === 0) return;
    await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchIds }),
    });
  }

  useKeyboardShortcuts({
    enabled: pending.length > 0,
    onNext: () => setFocusedIndex((index) => Math.min(pending.length - 1, index + 1)),
    onPrevious: () => setFocusedIndex((index) => Math.max(0, index - 1)),
    onApprove: () => {
      if (focusedPatch) void approvePatch([focusedPatch.id]);
    },
    onSkip: () => {
      if (focusedPatch) void skipPatch([focusedPatch.id]);
    },
    onHelp: () => setHelpOpen((open) => !open),
  });

  return (
    <section className="vken-patch-list">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ marginTop: 0 }}>Patches</h2>
        <button
          type="button"
          onClick={() => approvePatch(pending.slice(0, 3).map((patch) => patch.id))}
          disabled={!pending.length}
          style={{ minHeight: 32, borderRadius: 8 }}
        >
          Approve top
        </button>
      </div>
      {helpOpen ? (
        <div style={helpStyle}>j/k focus patch - a approve - s skip - ? help</div>
      ) : null}
      {patches.length === 0 ? (
        <p style={{ color: '#64748b' }}>Pick a direction to generate patch proposals.</p>
      ) : (
        patches.map((patch) => (
          <PatchCard
            key={patch.id}
            runId={runId}
            patch={patch}
            focused={focusedPatch?.id === patch.id}
            onFocus={() => setFocusedIndex(Math.max(0, pending.findIndex((candidate) => candidate.id === patch.id)))}
          />
        ))
      )}
    </section>
  );
}

const helpStyle = {
  border: '1px solid #c7d2fe',
  background: '#eef2ff',
  color: '#3730a3',
  borderRadius: 8,
  padding: 8,
  marginBottom: 10,
  fontSize: 13,
};
