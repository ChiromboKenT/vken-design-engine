import { useEffect, useState } from 'react';
import type { VkenProviderInfoResponse } from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';
import { providerLabel } from '../../state/byok';
import { BeforeAfter } from './BeforeAfter';
import { ByokPanel } from './ByokPanel';
import { DirectionPicker } from './DirectionPicker';
import { FinalizeButton } from './FinalizeButton';
import { LearnedToast } from './LearnedToast';
import { PatchList } from './PatchList';
import { ScoreGauge } from './ScoreGauge';
import { Timeline } from './Timeline';
import type { VkenRunState } from './useVkenSse';

export function Cockpit({ runId, state }: { runId: string | null; state: VkenRunState }) {
  const [byokOpen, setByokOpen] = useState(false);
  const [provider, setProvider] = useState<VkenProviderInfoResponse | null>(null);

  useEffect(() => {
    void (async () => {
      const resp = await vkenFetch('/api/vken/provider/info');
      if (!resp.ok) return;
      setProvider((await resp.json()) as VkenProviderInfoResponse);
    })();
  }, [byokOpen]);

  return (
    <section style={gridStyle}>
      <aside style={panelStyle}>
        <ScoreGauge value={state.score} />
        <p style={{ marginTop: 16, fontWeight: 700 }}>Status: {state.status}</p>
        <p style={{ color: provider?.id === 'cassette' ? '#b54708' : '#475467' }}>{providerLabel(provider)}</p>
        <button type="button" onClick={() => setByokOpen(true)} style={secondaryButton}>
          Provider settings
        </button>
        {state.error ? <p style={{ color: '#b91c1c' }}>{state.error}</p> : null}
      </aside>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Workspace Index</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
          <dt>Repo</dt>
          <dd>{state.summary.repoName ?? 'Waiting'}</dd>
          <dt>Framework</dt>
          <dd>{state.summary.framework ?? 'Waiting'}</dd>
          <dt>Routes</dt>
          <dd>{state.summary.routes ?? '--'}</dd>
          <dt>Components</dt>
          <dd>{state.summary.components ?? '--'}</dd>
          <dt>Hardcoded values</dt>
          <dd>{state.summary.hardcodedValues ?? '--'}</dd>
          <dt>Token coverage</dt>
          <dd>{state.summary.tokenCoverage == null ? '--' : `${Math.round(state.summary.tokenCoverage * 100)}%`}</dd>
        </dl>

        {state.directions.length > 0 && state.directionPicked == null ? (
          <DirectionPicker runId={runId} directions={state.directions} />
        ) : null}
        <BeforeAfter captures={state.captures} previewUrl={state.previewUrl} />
      </section>

      <aside style={panelStyle}>
        <Timeline runId={runId} events={state.events} activeCheckpoint={state.activeCheckpoint} />
        <PatchList runId={runId} patches={state.patches} />
        <FinalizeButton runId={runId} validations={state.validations} prUrl={state.prUrl} />
      </aside>
      <ByokPanel open={byokOpen} onClose={() => setByokOpen(false)} />
      <LearnedToast learns={state.learns} />
    </section>
  );
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 20,
  marginTop: 28,
};

const panelStyle = {
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 20,
  minWidth: 0,
};

const secondaryButton = {
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #d0d5dd',
  background: 'white',
  color: '#344054',
};
