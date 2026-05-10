import type { VkenSampleId } from '@open-design/contracts';
import { useState } from 'react';
import { Icon } from '../Icon';
import { LearnedToast } from './LearnedToast';
import { Notebook } from './Notebook';
import { PatientPane } from './PatientPane';
import type { VkenRunState } from './useVkenSse';

export function Workshop({
  runId,
  state,
  starting,
  startError,
  onStartSample,
  onStartUrl,
}: {
  runId: string | null;
  state: VkenRunState;
  starting: boolean;
  startError?: string;
  onStartSample: (sampleId: VkenSampleId) => void;
  onStartUrl: (url: string) => Promise<void>;
}) {
  const [mobilePane, setMobilePane] = useState<'patient' | 'notebook'>('patient');
  const total = state.categories.reduce((sum, category) => sum + category.total, 0);
  const remaining = state.categories.reduce((sum, category) => sum + category.remaining, 0);
  const fixed = state.categories.reduce((sum, category) => sum + category.fixed, 0);
  const progress = total === 0 ? 0 : Math.round(((total - remaining) / total) * 100);

  return (
    <section className="vken-workshop" aria-label="VKEN repair cockpit">
      <div className="vken-pane-tabs" role="tablist" aria-label="Workshop panes">
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'patient'}
          className={mobilePane === 'patient' ? 'active' : ''}
          onClick={() => setMobilePane('patient')}
        >
          Patient
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'notebook'}
          className={mobilePane === 'notebook' ? 'active' : ''}
          onClick={() => setMobilePane('notebook')}
        >
          Notebook
        </button>
      </div>
      <div className="vken-workshop-grid">
        <div className={mobilePane === 'patient' ? 'vken-pane-active' : 'vken-pane-inactive'}>
          <PatientPane
            runId={runId}
            state={state}
            starting={starting}
            startError={startError}
            onStartSample={onStartSample}
            onStartUrl={onStartUrl}
          />
        </div>
        <div className={mobilePane === 'notebook' ? 'vken-pane-active' : 'vken-pane-inactive'}>
          <Notebook runId={runId} state={state} />
        </div>
      </div>
      <footer className="vken-status-rail">
        <div className="vken-pipeline-progress" aria-label={`Pipeline progress ${progress}%`}>
          <span className="vken-progress-track">
            <span className="vken-progress-fill" style={{ width: `${progress}%` }} />
          </span>
          <span>{total > 0 ? `${fixed} fixed | ${remaining} need review` : 'Waiting for first capture'}</span>
        </div>
        <div className="vken-status-copy">
          <Icon name={state.status === 'failed' ? 'bell' : state.status === 'succeeded' ? 'check' : 'sparkles'} size={14} />
          <span>{statusCopy(state)}</span>
        </div>
      </footer>
      <LearnedToast learns={state.learns} />
    </section>
  );
}

function statusCopy(state: VkenRunState): string {
  if (state.error) return state.error;
  if (state.status === 'idle') return 'Choose a patient to begin repair.';
  if (state.status === 'queued') return 'Run queued.';
  if (state.status === 'running') return 'Repair pipeline is moving.';
  if (state.summary.framework === 'website-capture' && state.status === 'succeeded') return 'Audit capture is ready.';
  if (state.status === 'succeeded') return 'Repair output is ready.';
  if (state.status === 'canceled') return 'Run canceled.';
  return 'Run needs review.';
}
