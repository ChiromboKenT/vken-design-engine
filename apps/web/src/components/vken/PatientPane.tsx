import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { VkenPatch, VkenSampleId, VkenViewport } from '@open-design/contracts';
import { Icon } from '../Icon';
import type { VkenCaptureSummary, VkenRunState } from './useVkenSse';

const SAMPLES: VkenSampleId[] = ['landing-generic', 'dashboard-cluttered', 'ecommerce-basic'];
const VIEWPORTS: VkenViewport[] = ['desktop', 'tablet', 'mobile'];
type PreviewMode = 'before' | 'current' | 'compare';

export function PatientPane({
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
  const [mode, setMode] = useState<PreviewMode>('compare');
  const [routePath, setRoutePath] = useState('/');
  const [viewport, setViewport] = useState<VkenViewport>('desktop');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('initial');
  const [userPinned, setUserPinned] = useState(false);
  const [url, setUrl] = useState('');

  const routeOptions = useMemo(() => unique(state.captures.map((capture) => capture.routePath)), [state.captures]);

  useEffect(() => {
    if (routeOptions.length > 0 && !routeOptions.includes(routePath)) {
      setRoutePath(routeOptions[0] ?? '/');
    }
  }, [routeOptions, routePath]);

  const viewportButtons = VIEWPORTS.filter((item) =>
    state.captures.some((capture) => capture.viewport === item),
  );
  const matchingCaptures = useMemo(
    () => state.captures.filter((capture) => capture.routePath === routePath && capture.viewport === viewport),
    [routePath, state.captures, viewport],
  );
  const checkpoints = useMemo(() => uniqueCheckpoints(matchingCaptures), [matchingCaptures]);
  const beforeCapture = checkpoints.find((capture) => capture.checkpoint === 'initial') ?? checkpoints[0] ?? null;
  const latestCapture =
    [...checkpoints].reverse().find((capture) => capture.checkpoint !== 'initial') ?? beforeCapture;

  useEffect(() => {
    setUserPinned(false);
    setSelectedCheckpoint('initial');
  }, [runId]);

  useEffect(() => {
    if (state.activeCheckpoint && !userPinned) {
      setSelectedCheckpoint(state.activeCheckpoint);
    }
  }, [state.activeCheckpoint, userPinned]);

  const currentCapture = useMemo(
    () =>
      matchingCaptures.find((capture) => capture.checkpoint === selectedCheckpoint) ??
      latestCapture ??
      beforeCapture,
    [beforeCapture, latestCapture, matchingCaptures, selectedCheckpoint],
  );
  const activeCapture = mode === 'before' ? beforeCapture : currentCapture;
  const activePatch = activeCapture ? state.patches.find((patch) => patch.id === activeCapture.checkpoint) : undefined;
  const activeApply = activeCapture ? state.applies.find((apply) => apply.patchId === activeCapture.checkpoint) : undefined;
  const canCompare = Boolean(beforeCapture && currentCapture && currentCapture.checkpoint !== 'initial');
  const selectedLabel = activeCapture
    ? checkpointLabel(activeCapture.checkpoint, checkpoints, activePatch)
    : 'Waiting for screenshot';

  useEffect(() => {
    if (!canCompare && mode === 'compare') setMode('current');
  }, [canCompare, mode]);

  async function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    await onStartUrl(trimmed);
  }

  return (
    <section className="vken-patient-pane" aria-label="Patient preview">
      <div className="vken-patient-toolbar">
        <div className="vken-patient-title">
          <span className="vken-region-kicker">Patient</span>
          <h1>{runId ? state.summary.repoName ?? 'Repairing workspace' : 'Visual repair workshop'}</h1>
        </div>
        <div className="vken-patient-controls">
          {routeOptions.length > 1 ? (
            <select
              value={routePath}
              onChange={(event) => setRoutePath(event.target.value)}
              aria-label="Captured route"
            >
              {routeOptions.map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>
          ) : null}
          {viewportButtons.length > 1 ? (
            <div className="vken-preview-switch compact" role="group" aria-label="Viewport">
              {viewportButtons.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={viewport === item ? 'active' : ''}
                  onClick={() => setViewport(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <div className="vken-preview-switch" role="group" aria-label="Screenshot mode">
            <button type="button" className={mode === 'before' ? 'active' : ''} onClick={() => setMode('before')}>
              Before
            </button>
            <button
              type="button"
              className={mode === 'current' ? 'active' : ''}
              onClick={() => setMode('current')}
              disabled={!currentCapture}
            >
              Current
            </button>
            <button
              type="button"
              className={mode === 'compare' ? 'active' : ''}
              onClick={() => setMode('compare')}
              disabled={!canCompare}
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      <div className="vken-preview-stage">
        {runId ? (
          mode === 'compare' && beforeCapture && currentCapture ? (
            <div className="vken-compare-grid">
              <ScreenshotPanel
                capture={beforeCapture}
                label="Before"
                caption={checkpointLabel(beforeCapture.checkpoint, checkpoints)}
              />
              <ScreenshotPanel
                capture={currentCapture}
                label="Current"
                caption={checkpointLabel(currentCapture.checkpoint, checkpoints, activePatch)}
                scoreDelta={activeApply?.scoreDelta}
              />
            </div>
          ) : activeCapture ? (
            <ScreenshotPanel
              capture={activeCapture}
              label={mode === 'before' ? 'Before' : 'Current'}
              caption={selectedLabel}
              scoreDelta={activeApply?.scoreDelta}
            />
          ) : (
            <div className="vken-preview-empty">
              <Icon name="image" size={24} />
              <span>Capturing fixed-viewport screenshots.</span>
            </div>
          )
        ) : (
          <div className="vken-start-panel">
            <div>
              <span className="vken-region-kicker">VKEN</span>
              <h2>Paste a URL, capture the site, then drive a visual repair pass.</h2>
              <p>
                VKEN keeps the evidence visual: before, every applied checkpoint, and the current repair are shown as screenshots.
              </p>
            </div>
            <div className="vken-sample-grid">
              {SAMPLES.map((sampleId) => (
                <button key={sampleId} type="button" onClick={() => onStartSample(sampleId)} disabled={starting}>
                  <Icon name="play" size={14} />
                  <span>{starting ? 'Starting' : `Try ${sampleId}`}</span>
                </button>
              ))}
            </div>
            <form className="vken-url-form" onSubmit={submitUrl}>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com or https://github.com/user/vite-react-tailwind-repo"
                aria-label="Public website or Vite React Tailwind repository URL"
              />
              <button type="submit" disabled={starting || !url.trim()}>
                Run design pass
              </button>
            </form>
            <p className={startError ? 'vken-start-error' : 'vken-start-note'}>
              {startError ?? 'Public site URLs capture screenshots; supported Vite + React + Tailwind repos can be repaired live.'}
            </p>
          </div>
        )}
      </div>

      {runId && checkpoints.length > 0 ? (
        <div className="vken-checkpoint-strip" aria-label="Linear screenshot checkpoints">
          {checkpoints.map((checkpoint, index) => {
            const patch = state.patches.find((item) => item.id === checkpoint.checkpoint);
            const apply = state.applies.find((item) => item.patchId === checkpoint.checkpoint);
            const label = checkpointLabel(checkpoint.checkpoint, checkpoints, patch);
            return (
              <button
                key={checkpoint.checkpoint}
                type="button"
                className={checkpoint.checkpoint === activeCapture?.checkpoint ? 'active' : ''}
                onClick={() => {
                  setSelectedCheckpoint(checkpoint.checkpoint);
                  setUserPinned(true);
                  setMode(checkpoint.checkpoint === 'initial' ? 'before' : 'current');
                }}
              >
                <img src={checkpoint.screenshotUrl} alt={`${label} screenshot`} />
                <span>
                  {String(index).padStart(2, '0')} {label}
                </span>
                {typeof apply?.scoreDelta === 'number' ? (
                  <strong className={apply.scoreDelta >= 0 ? 'positive' : 'negative'}>
                    {apply.scoreDelta >= 0 ? '+' : ''}
                    {apply.scoreDelta.toFixed(2)}
                  </strong>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="vken-caption-strip">
        <span>
          {runId
            ? `${state.status} | ${state.summary.routes ?? 0} routes | ${state.summary.components ?? 0} components`
            : 'No active run'}
        </span>
        <span>
          {activeCapture
            ? `${selectedLabel} | ${activeCapture.routePath} | ${activeCapture.viewport}`
            : 'Preview waits for capture'}
        </span>
      </div>
    </section>
  );
}

function ScreenshotPanel({
  capture,
  label,
  caption,
  scoreDelta,
}: {
  capture: VkenCaptureSummary;
  label: string;
  caption: string;
  scoreDelta?: number;
}) {
  return (
    <figure className="vken-screenshot-panel">
      <div className="vken-screenshot-meta">
        <span>{label}</span>
        <strong>{caption}</strong>
        {typeof scoreDelta === 'number' ? (
          <em className={scoreDelta >= 0 ? 'positive' : 'negative'}>
            {scoreDelta >= 0 ? '+' : ''}
            {scoreDelta.toFixed(2)}
          </em>
        ) : null}
      </div>
      <img src={capture.screenshotUrl} alt={`${caption} ${capture.routePath} ${capture.viewport}`} />
    </figure>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function uniqueCheckpoints(captures: VkenCaptureSummary[]): VkenCaptureSummary[] {
  const byCheckpoint = new Map<string, VkenCaptureSummary>();
  for (const capture of captures) {
    if (!byCheckpoint.has(capture.checkpoint)) byCheckpoint.set(capture.checkpoint, capture);
  }
  return [...byCheckpoint.values()].sort((a, b) => checkpointRank(a.checkpoint) - checkpointRank(b.checkpoint));
}

function checkpointRank(checkpoint: string): number {
  if (checkpoint === 'initial') return 0;
  return 1;
}

function checkpointLabel(
  checkpoint: string,
  checkpoints: VkenCaptureSummary[],
  patch?: VkenPatch,
): string {
  if (checkpoint === 'initial') return 'Before';
  const ordinal = checkpoints.findIndex((item) => item.checkpoint === checkpoint);
  const prefix = ordinal > 0 ? `Step ${ordinal}` : 'Current';
  return patch ? `${prefix} ${patch.severity}` : prefix;
}
