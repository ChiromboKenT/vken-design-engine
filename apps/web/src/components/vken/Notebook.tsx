import { useEffect, useMemo, useState } from 'react';
import type {
  VkenPatch,
  VkenProblemCategoryBreakdown,
  VkenProblemCategoryId,
  VkenValidatePayload,
} from '@open-design/contracts';
import { vkenFetch } from '../../providers/registry';
import { Icon } from '../Icon';
import { CategoryBars } from './CategoryBars';
import { StageCard, type VkenStageState } from './StageCard';
import { SteerForm } from './SteerForm';
import type { VkenRunState } from './useVkenSse';

const EMPTY_CATEGORIES: VkenProblemCategoryBreakdown[] = [
  emptyCategory('tokens', 'Color tokens missing'),
  emptyCategory('spacing', 'Spacing inconsistencies'),
  emptyCategory('contrast', 'Contrast issues'),
  emptyCategory('repetition', 'Component repetition'),
];

export function Notebook({ runId, state }: { runId: string | null; state: VkenRunState }) {
  const categories = state.categories.length > 0 ? state.categories : EMPTY_CATEGORIES;
  const [activeCategory, setActiveCategory] = useState<VkenProblemCategoryId | null>(null);
  const [expandedStage, setExpandedStage] = useState<string>('capture');
  const [steerPatchId, setSteerPatchId] = useState<string | null>(null);
  const [discussPatchId, setDiscussPatchId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalLink, setFinalLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auditOnly = state.summary.framework === 'website-capture';

  const pendingPatches = useMemo(
    () => state.patches.filter((patch) => patch.status === 'proposed'),
    [state.patches],
  );
  const filteredPatches = useMemo(
    () =>
      activeCategory
        ? state.patches.filter((patch) => patchCategories(patch).includes(activeCategory))
        : state.patches,
    [activeCategory, state.patches],
  );
  const topPatch = filteredPatches.find((patch) => patch.status === 'proposed') ?? pendingPatches[0] ?? null;
  const activeStageId = computeActiveStageId(runId, state, pendingPatches, auditOnly);

  useEffect(() => {
    setExpandedStage(activeStageId);
  }, [activeStageId]);

  async function approvePatch(patchIds: string[]) {
    if (!runId || patchIds.length === 0 || busy) return;
    setBusy(true);
    try {
      await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchIds }),
      });
    } finally {
      setBusy(false);
    }
  }

  async function rejectPatch(patchIds: string[]) {
    if (!runId || patchIds.length === 0 || busy) return;
    setBusy(true);
    try {
      await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchIds }),
      });
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    if (!runId) return;
    setFinalizing(true);
    try {
      const resp = await vkenFetch(`/api/vken/runs/${encodeURIComponent(runId)}/finalize`, { method: 'POST' });
      const body = (await resp.json()) as { prUrl?: string; bundleUrl?: string };
      setFinalLink(body.prUrl ?? body.bundleUrl ?? null);
    } finally {
      setFinalizing(false);
    }
  }

  const totalProblems = categories.reduce((sum, category) => sum + category.total, 0);
  const remainingProblems = categories.reduce((sum, category) => sum + category.remaining, 0);
  const fixedProblems = categories.reduce((sum, category) => sum + category.fixed, 0);
  const appliedCount = state.patches.filter((patch) => patch.status === 'applied').length;

  return (
    <aside className="vken-notebook" aria-label="Repair notebook">
      <CategoryBars categories={categories} activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

      <div className="vken-stage-scroll">
        <section className="vken-design-command" aria-label="Design brief">
          <div className="vken-design-command-head">
            <div>
              <span className="vken-region-kicker">Design brief</span>
              <h2>Guide the next visual pass before approving code.</h2>
            </div>
            <StatusPill tone="info" label="Instructions" count={state.steers.length} />
          </div>
          <SteerForm runId={runId} variant="design" />
          {state.steers.length > 0 ? (
            <div className="vken-steer-log">
              {state.steers.slice(-2).map((steer, index) => (
                <p key={`${steer.patchId ?? 'run'}-${index}`}>
                  <strong>{steer.kind === 'discuss' ? 'Discussed' : 'Steered'}:</strong> {steer.text}
                </p>
              ))}
            </div>
          ) : null}
        </section>

        <StageCard
          id="capture"
          eyebrow="01"
          title="Capture"
          summary={state.captures.length ? `${state.captures.length} screenshots captured` : 'waiting for patient'}
          state={stageState(activeStageId, 'capture', state.captures.length > 0)}
          expanded={expandedStage === 'capture'}
          onToggle={setExpandedStage}
        >
          <div className="vken-capture-grid">
            {state.captures.length > 0 ? (
              state.captures.map((capture) => (
                <figure key={`${capture.routePath}-${capture.viewport}`}>
                  <img src={capture.screenshotUrl} alt={`${capture.routePath} ${capture.viewport}`} />
                  <figcaption>
                    {capture.routePath} | {capture.viewport}
                  </figcaption>
                </figure>
              ))
            ) : (
              <p className="vken-muted-line">Start a sample or URL run to capture the first route.</p>
            )}
          </div>
        </StageCard>

        <StageCard
          id="findings"
          eyebrow="02"
          title="Findings"
          summary={
            totalProblems > 0
              ? `${remainingProblems} of ${totalProblems} problems still open`
              : 'waiting for named problem buckets'
          }
          state={stageState(activeStageId, 'findings', totalProblems > 0)}
          expanded={expandedStage === 'findings'}
          onToggle={setExpandedStage}
        >
          <div className="vken-finding-summary">
            <StatusPill tone="success" label="Fixed" count={fixedProblems} />
            <StatusPill tone="warning" label="Needs repair" count={remainingProblems} />
            <StatusPill tone="info" label="Categories" count={categories.filter((item) => item.total > 0).length} />
          </div>
          <ul className="vken-evidence-list">
            {categories.flatMap((category) =>
              category.evidence.slice(0, 3).map((item) => (
                <li key={`${category.category}-${item.file}-${item.line ?? item.label}`}>
                  <span>{item.label}</span>
                  <code>
                    {category.label} | {item.file}
                    {item.line ? `:${item.line}` : ''}
                  </code>
                </li>
              )),
            )}
          </ul>
        </StageCard>

        <StageCard
          id="direction"
          eyebrow="03"
          title="Direction"
          summary={
            auditOnly
              ? 'source repo required'
              : state.directionPicked
                ? `Picked ${state.directionPicked}`
                : `${state.directions.length} choices ready`
          }
          state={stageState(activeStageId, 'direction', !auditOnly && Boolean(state.directionPicked))}
          expanded={expandedStage === 'direction'}
          onToggle={setExpandedStage}
        >
          {auditOnly ? (
            <p className="vken-muted-line">
              Public website captures are audit-only because VKEN cannot edit remote source code. Use a public Vite + React + Tailwind repo URL or a sample to run repair.
            </p>
          ) : state.directions.length > 0 && !state.directionPicked ? (
            <SteerForm runId={runId} variant="direction" directions={state.directions} />
          ) : (
            <p className="vken-muted-line">
              {state.directionPicked ? `Direction ${state.directionPicked} is driving proposals.` : 'Directions appear after findings.'}
            </p>
          )}
        </StageCard>

        <StageCard
          id="proposing"
          eyebrow="04"
          title="Proposing"
          summary={
            auditOnly
              ? 'not available for public site'
              : pendingPatches.length > 0
              ? `${pendingPatches.length} patches need review`
              : appliedCount > 0
                ? `${appliedCount} patches landed`
                : 'waiting for direction'
          }
          state={stageState(activeStageId, 'proposing', !auditOnly && (appliedCount > 0 || pendingPatches.length > 0))}
          expanded={expandedStage === 'proposing'}
          onToggle={setExpandedStage}
        >
          <div className="vken-patch-stack">
            {auditOnly ? (
              <p className="vken-muted-line">Patch proposals require a writable source workspace.</p>
            ) : filteredPatches.length > 0 ? (
              filteredPatches.map((patch) => (
                <PatchRow
                  key={patch.id}
                  patch={patch}
                  steerOpen={steerPatchId === patch.id}
                  discussOpen={discussPatchId === patch.id}
                  disabled={busy}
                  onApprove={() => void approvePatch([patch.id])}
                  onReject={() => void rejectPatch([patch.id])}
                  onSteer={() => {
                    setSteerPatchId((current) => (current === patch.id ? null : patch.id));
                    setDiscussPatchId(null);
                  }}
                  onDiscuss={() => {
                    setDiscussPatchId((current) => (current === patch.id ? null : patch.id));
                    setSteerPatchId(null);
                  }}
                  runId={runId}
                />
              ))
            ) : (
              <p className="vken-muted-line">No patches match this category yet.</p>
            )}
          </div>
        </StageCard>

        <StageCard
          id="validating"
          eyebrow="05"
          title="Validating"
          summary={auditOnly ? 'not run for audit-only capture' : validationSummary(state.validations)}
          state={stageState(activeStageId, 'validating', !auditOnly && state.validations.length > 0)}
          expanded={expandedStage === 'validating'}
          onToggle={setExpandedStage}
        >
          <div className="vken-validation-grid">
            {auditOnly ? (
              <p className="vken-muted-line">Validation starts after VKEN applies repair patches to a source workspace.</p>
            ) : state.validations.length > 0 ? (
              state.validations.map((validation) => (
                <StatusPill
                  key={validation.stage}
                  tone={validation.ok ? 'success' : 'error'}
                  label={`${validation.stage} ${validation.ok ? 'passed' : 'needs review'}`}
                />
              ))
            ) : (
              <p className="vken-muted-line">Validation starts after patches are applied and finalization is requested.</p>
            )}
          </div>
        </StageCard>

        <StageCard
          id="finalize"
          eyebrow="06"
          title="Finalize"
          summary={auditOnly ? 'audit complete' : state.prUrl || finalLink ? 'reviewable output ready' : 'waiting for validation'}
          state={
            auditOnly && state.status === 'succeeded'
              ? 'done'
              : state.prUrl || finalLink
                ? 'done'
                : activeStageId === 'finalize'
                  ? 'active'
                  : 'queued'
          }
          expanded={expandedStage === 'finalize'}
          onToggle={setExpandedStage}
        >
          <div className="vken-finalize-box">
            {auditOnly ? (
              <p className="vken-muted-line">The public site audit is complete. Start from a repo URL or sample when you want VKEN to produce repair output.</p>
            ) : (
              <>
                <button type="button" className="vken-button primary" onClick={finalize} disabled={!runId || finalizing}>
                  <Icon name={finalizing ? 'spinner' : 'share'} size={14} />
                  <span>{finalizing ? 'Finalizing' : 'Finalize repair'}</span>
                </button>
                {state.prUrl || finalLink ? (
                  <a href={state.prUrl ?? finalLink ?? undefined} target="_blank" rel="noreferrer">
                    Open final output
                  </a>
                ) : null}
              </>
            )}
          </div>
        </StageCard>
      </div>

      <div className="vken-approve-bar">
        {auditOnly ? (
          <span className="vken-approve-note">Public site captures are audit-only. Repo URLs and samples enable code repair.</span>
        ) : null}
        <button
          type="button"
          className="vken-button primary"
          disabled={!topPatch || busy}
          onClick={() => {
            if (topPatch) void approvePatch([topPatch.id]);
          }}
        >
          <Icon name={busy ? 'spinner' : 'check'} size={14} />
          <span>{busy ? 'Applying…' : 'Approve top patch'}</span>
        </button>
        <button
          type="button"
          className="vken-button secondary destructive"
          disabled={!topPatch || busy}
          onClick={() => {
            if (topPatch) void rejectPatch([topPatch.id]);
          }}
        >
          <Icon name="close" size={14} />
          <span>Reject</span>
        </button>
        <button
          type="button"
          className="vken-button secondary"
          disabled={!topPatch || busy}
          onClick={() => {
            if (!topPatch) return;
            setDiscussPatchId(topPatch.id);
            setExpandedStage('proposing');
          }}
        >
          <Icon name="comment" size={14} />
          <span>Discuss in chat</span>
        </button>
      </div>
    </aside>
  );
}

function PatchRow({
  patch,
  runId,
  steerOpen,
  discussOpen,
  disabled,
  onApprove,
  onReject,
  onSteer,
  onDiscuss,
}: {
  patch: VkenPatch;
  runId: string | null;
  steerOpen: boolean;
  discussOpen: boolean;
  disabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSteer: () => void;
  onDiscuss: () => void;
}) {
  const firstHunk = patch.hunks[0];
  const isProposed = patch.status === 'proposed';
  return (
    <article className={`vken-patch-row ${patch.status}`}>
      <div className="vken-patch-head">
        <StatusPill tone={patch.status === 'applied' ? 'success' : 'info'} label={`${patch.severity} ${patch.status}`} />
        <span className="vken-patch-file">{patch.filePath}</span>
      </div>
      <p>{patch.rationale}</p>
      {firstHunk ? (
        <pre className="vken-diff-preview">{`- ${firstHunk.search.trim()}
+ ${firstHunk.replace.trim()}`}</pre>
      ) : null}
      <div className="vken-patch-actions">
        <button type="button" className="vken-button primary" onClick={onApprove} disabled={!isProposed || disabled}>
          <Icon name={disabled && isProposed ? 'spinner' : 'check'} size={13} />
          <span>Approve</span>
        </button>
        <button type="button" className="vken-button secondary" onClick={onDiscuss} disabled={disabled}>
          <Icon name="comment" size={13} />
          <span>Discuss</span>
        </button>
        <button type="button" className="vken-button secondary destructive" onClick={onReject} disabled={!isProposed || disabled}>
          <Icon name="close" size={13} />
          <span>Reject</span>
        </button>
        <button type="button" className="vken-button secondary" onClick={onSteer} disabled={disabled}>
          <Icon name="sliders" size={13} />
          <span>Steer</span>
        </button>
      </div>
      {steerOpen ? <SteerForm runId={runId} variant="steer" patch={patch} /> : null}
      {discussOpen ? <SteerForm runId={runId} variant="discuss" patch={patch} /> : null}
    </article>
  );
}

function StatusPill({
  tone,
  label,
  count,
}: {
  tone: 'success' | 'warning' | 'error' | 'info';
  label: string;
  count?: number;
}) {
  const icon = tone === 'success' ? 'check' : tone === 'error' ? 'bell' : tone === 'warning' ? 'eye' : 'file-code';
  return (
    <span className={`vken-status-pill ${tone}`}>
      <Icon name={icon} size={12} />
      <span>{label}</span>
      {count != null ? <strong>{count}</strong> : null}
    </span>
  );
}

function computeActiveStageId(
  runId: string | null,
  state: VkenRunState,
  pendingPatches: VkenPatch[],
  auditOnly: boolean,
): string {
  if (!runId || state.captures.length === 0) return 'capture';
  if (state.categories.length === 0 && state.score == null) return 'findings';
  if (auditOnly) return 'findings';
  if (state.directions.length > 0 && !state.directionPicked) return 'direction';
  if (pendingPatches.length > 0) return 'proposing';
  if (state.patches.length > 0) {
    if (state.validations.length > 0) return 'validating';
    return 'finalize';
  }
  return state.prUrl ? 'finalize' : 'findings';
}

function stageState(activeStageId: string, stageId: string, done: boolean): VkenStageState {
  if (done && activeStageId !== stageId) return 'done';
  if (activeStageId === stageId) return 'active';
  return 'queued';
}

function validationSummary(validations: VkenValidatePayload[]): string {
  if (validations.length === 0) return 'waiting';
  const failed = validations.filter((validation) => !validation.ok).length;
  return failed === 0 ? `${validations.length} checks passed` : `${failed} checks need review`;
}

function emptyCategory(category: VkenProblemCategoryId, label: string): VkenProblemCategoryBreakdown {
  return { category, label, total: 0, remaining: 0, fixed: 0, queued: 0, evidence: [] };
}

function patchCategories(patch: VkenPatch): VkenProblemCategoryId[] {
  if (patch.categories && patch.categories.length > 0) return patch.categories;
  const text = `${patch.filePath}\n${patch.rationale}\n${patch.hunks
    .map((hunk) => `${hunk.search}\n${hunk.replace}`)
    .join('\n')}`.toLowerCase();
  const categories = new Set<VkenProblemCategoryId>();
  if (/token|palette|color|surface|#[0-9a-f]{3,8}|var\(--/.test(text)) categories.add('tokens');
  if (/spacing|padding|margin|gap|radius|border-radius|rounded|rem|px/.test(text)) categories.add('spacing');
  if (/contrast|opacity|legibility|cta|primary action|secondary text/.test(text)) categories.add('contrast');
  if (/repeat|duplicate|shared|component|reuse|normalize/.test(text)) categories.add('repetition');
  return categories.size > 0 ? [...categories] : ['tokens'];
}
