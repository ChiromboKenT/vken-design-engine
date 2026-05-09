# VKEN Day 3 — AMD Integration + Truth Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert VKEN from a structurally-real, surface-fragile demo into a hackathon submission whose self-learning loop, validation pipeline, and AMD MI300X story are auditable end-to-end — by spending the $100 AMD credit to harvest a real KB seed and real cassettes, and by killing every fabricated metric the audit found.

**Architecture:**
- *Truth before AMD:* fix the 4 WOW-blockers + 5 credibility holes from the audit so the engine's own outputs are honest, then point real Qwen2.5-VL + Qwen3-Coder on MI300X at it to harvest a real KB and real recorded transcripts.
- *Cassette-default at the edge:* the public HF Space stays free (cassette + OpenRouter); MI300X is on-demand via the BYOK panel pointed at our vLLM URL. A "Run on AMD MI300X" preset in the BYOK panel makes the live-AMD path one click for any judge.
- *Learning loop becomes a measurable artifact:* real harvest → real seed → real promotion gate → real bench → bench-panel in cockpit. The KB shipped in the repo is provably the output of running the engine on MI300X, not a hand-authored stub.

**Tech Stack:** TypeScript (Node 24, pnpm 10), better-sqlite3, Playwright, Vite, React 18, vLLM on ROCm, Qwen2.5-VL-72B + Qwen3-Coder-30B-A3B, OpenRouter (free Qwen) as fallback, JSZip + Octokit-less GitHub REST for PR flow, HMAC-SHA256 for KB signatures.

**Source plans referenced:**
- [docs/plans/2026-05-08-vken-day2-source-of-truth.md](2026-05-08-vken-day2-source-of-truth.md) — Day 2 build plan (Blocks 0–8)
- [docs/plans/2026-05-08-vken-self-learning-loop.md](2026-05-08-vken-self-learning-loop.md) — KB tier semantics, promotion gate spec
- [docs/plans/2026-05-08-vken-day2-zero-cost-pivot.md](2026-05-08-vken-day2-zero-cost-pivot.md) — provider matrix, BYOK transport rules

**Decisions already locked:**
1. Cassette-default with on-demand MI300X via BYOK panel (not always-on during judging).
2. Truth over polish — Phase 4 is cuttable; Phases 1–3 are not.
3. MI300X bring-up within 24h of plan start.

---

## 1. Problem statement (the hackathon answer)

VKEN is a **self-improving design engine for Vite + React + Tailwind apps**. Generative AI is good at making new UI; VKEN evaluates and lifts existing UI. It scores a real running app (deterministic lint + Qwen2.5-VL critique), proposes ranked patches grounded in a retrievable signed KB, applies them through a virtual filesystem with a scrubbable timeline, validates the result (tsc, build, axe-core, recapture, pixel diff), and opens a real GitHub PR.

**What makes it learn:** every approved patch that survives validation promotes through three tiers (run → repo → global) gated by multi-repo evidence, bench non-regression on the 3 sample apps, and HMAC signatures. The KB shipped in the repo wasn't hand-written — it was harvested by running the engine 30+ times on AMD MI300X + vLLM serving Qwen2.5-VL-72B and Qwen3-Coder-30B. Each rule carries its evidence run IDs and HMAC signature; an unsigned line is rejected at load.

**What makes it AMD's:** the production target is MI300X + vLLM. The whole engine is provider-agnostic by construction (7 backends today, BYOK in the UI), so a judge can swap to their own key — but the performance ceiling, the corpus the KB was learned on, *and* every cassette the public Space replays were all produced on MI300X. Flipping the live demo to MI300X is one click in the BYOK panel.

**Honest scope:** V1 supports Vite + React + Tailwind only. URL intake clones public repos in that stack; non-matching workspaces fail with a friendly error. The KB is signed and auditable in `kb/learned.jsonl`. The PR's body claims only what `validate.ts` actually measured — no fabrication.

---

## 2. Reading order before executing

1. This plan, end to end.
2. Skim [docs/plans/2026-05-08-vken-day2-source-of-truth.md §15 Appendix A](2026-05-08-vken-day2-source-of-truth.md) for env-var reference; every var below is already defined there.
3. Skim [docs/plans/2026-05-08-vken-self-learning-loop.md §5 (the feedback loop) and §5.3 (the promotion gate)](2026-05-08-vken-self-learning-loop.md) — Phase 3 below implements §5.3 verbatim.
4. Open the audit report from the prior session if available; the file:line citations below come from it.

---

## 3. AMD MI300X budget allocation ($100, expires 2026-06-07)

Assume MI300X droplet bills at $2–4/hr (verify on first spin-up; revise if higher).

| Window | Purpose | GPU hours | Spend cap |
|---|---|---|---|
| W1: Bring-up & smoke | Verify vLLM serves both Qwen models, capture latency baseline | 1–2 | $8 |
| W2: KB harvest + cassette record | Run engine ×30+ across 3 samples, record transcripts | 8–12 | $48 |
| W3: Bench validation | Replay seed-only vs seed+learned across samples | 2–3 | $12 |
| W4: Live judging window | Warm MI300X during the public demo session | 4–6 | $24 |
| Buffer | Debug / retry / rate-limit recovery | 4 | $16 |
| **Total** | | **19–27 GPU hours** | **~$100** |

**Hard rule:** every AMD block ends with `bash infra/amd-cloud/stop-vllm.sh` and a manual destroy of the droplet. Spend telemetry: log GPU-hour-on time at the start of every AMD block in `docs/amd-spend.md`.

---

## 4. Phase ordering (truth-first cut order)

```
Phase 1 (Truth fixes, ~5h, no AMD)
   ↓
Phase 2 (AMD harvest, ~6h human + ~12h GPU)
   ↓
Phase 3 (Real learning loop, ~4h, depends on Phase 2 output)
   ↓
Phase 4 (Polish, ~3h, CUTTABLE if time short)
   ↓
Phase 5 (Space + judging, ~3h human + ~5h GPU)
```

If time pressure forces a cut, cut **Phase 4** entirely before cutting any Block in Phase 1, 2, or 3. The judging-day risk is "judge opens `validate.ts` and sees `pixel = { ok: true, details: { visualGap: 0.04 } }`" — not "judge wishes the cockpit had keyboard shortcuts."

---

# Phase 1 — Truth fixes (≈5 hours, no AMD)

## Block 1.1 — Honest `validate.ts` (real axe-core + recapture + pixel diff)

**Why:** `apps/daemon/src/vken/validate.ts:33` hardcodes `pixel = { ok: true, details: { visualGap: 0.04, threshold: 0.2 } }`. `:36` hardcodes `consoleScan = { ok: true, details: { errors: [] } }`. `:30,81-94` substitutes a 3-hex-code regex for axe-core. The PR body at `apps/daemon/src/vken/pr.ts:153-158` then claims "✅ axe-core (0 violations)" — **that's the single biggest credibility cliff in the submission**.

**Files:**
- Modify: `apps/daemon/package.json` (add dep)
- Modify: `apps/daemon/src/vken/validate.ts` (full rewrite of the stubbed stages)
- Create: `apps/daemon/tests/vken-validate.test.ts`

**Step 1: Add `@axe-core/playwright` to daemon deps**

```bash
pnpm --filter @open-design/daemon add @axe-core/playwright
```

Verify it appears in [apps/daemon/package.json](../../apps/daemon/package.json) `dependencies`.

**Step 2: Write the failing test**

Create [apps/daemon/tests/vken-validate.test.ts](../../apps/daemon/tests/vken-validate.test.ts):

```ts
import { describe, expect, it, vi } from 'vitest';
import { validateMaterializedWorkspace } from '../src/vken/validate.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('vken/validate', () => {
  it('reports real measurements (no hardcoded ok=true)', async () => {
    // Materialize a tiny workspace with one obvious axe violation:
    // <button> with no accessible name, on a page that boots with Vite.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vken-validate-'));
    // Use the landing-generic sample as the bench fixture.
    const fixture = path.resolve(__dirname, '..', '..', '..', 'samples', 'landing-generic');
    fs.cpSync(fixture, dir, { recursive: true });
    const db = makeMemoryDb();
    const events: Array<{ stage: string; ok: boolean }> = [];
    const result = await validateMaterializedWorkspace({
      runId: 'r_test',
      workspaceDir: dir,
      db,
      service: { emit: (_run, _evt, data: any) => events.push({ stage: data.stage, ok: data.ok }) },
    });
    // Real signal: pixel stage carries a measured visualGap, not the constant 0.04.
    expect((result.byStage.pixel.details as any).visualGap).not.toBe(0.04);
    // Real signal: a11y stage details carry an axe-core results object, not a regex hits array.
    expect((result.byStage.a11y.details as any)).toHaveProperty('axeRuns');
    // All 5 stages must have emitted.
    expect(new Set(events.map((e) => e.stage))).toEqual(new Set(['tsc', 'build', 'a11y', 'pixel', 'console']));
  }, 120_000);
});

function makeMemoryDb() {
  const rows: any[] = [];
  return {
    prepare: () => ({ run: (...args: any[]) => rows.push(args) }),
    rows,
  };
}
```

**Step 3: Run the test to verify it fails**

```bash
pnpm --filter @open-design/daemon test -- --run vken-validate
```

Expected: FAIL — current `validate.ts:33` returns the hardcoded `0.04`, so the `not.toBe(0.04)` assertion fails. The `axeRuns` property does not exist.

**Step 4: Rewrite `validate.ts` to actually measure**

Replace [apps/daemon/src/vken/validate.ts](../../apps/daemon/src/vken/validate.ts) with a version that:

- Spawns `vite preview --port <free>` against the materialized workspace (reuse the helper from [apps/daemon/src/vken/runner.ts](../../apps/daemon/src/vken/runner.ts) — extract the port-finding + spawn logic into a shared `spawnVite` function if it isn't already).
- Launches Playwright Chromium, navigates to `/`, runs `@axe-core/playwright` and captures `violations`.
- Captures a fresh PNG at desktop viewport (1440×900); compares against the run's initial desktop capture (look up via `db.prepare('SELECT screenshot_path FROM vken_captures WHERE run_id=? AND viewport=? AND when_phase=?').get(runId, 'desktop', 'initial')`) using `apps/daemon/src/vken/algorithms/pixel-diff.ts` and the visual-gap algorithm from `algorithms/visual-gap.ts`.
- Listens for browser console errors during the navigation; collects them into `consoleScan.details.errors`.
- Tears down Playwright + the Vite preview deterministically (try/finally).

Stage gates:
- `tsc.ok = true if skipped (no tsconfig) else process exit 0`. Document the "skipped" branch explicitly in `details.skipped`.
- `build.ok = npm run build exit 0`.
- `a11y.ok = violations.filter(v => v.impact === 'serious' || v.impact === 'critical').length === 0`.
- `pixel.ok = visualGap < 0.2` (real threshold). `details = { visualGap, threshold: 0.2, beforeCaptureId, afterCaptureId }`.
- `console.ok = errors.length === 0`. Errors include `pageerror` and `console.error` events.

Code skeleton:

```ts
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { spawnVitePreview } from './runner.js';
import { computeVisualGap } from './algorithms/visual-gap.js';
import { pixelDiff } from './algorithms/pixel-diff.js';
// ... existing imports

export async function validateMaterializedWorkspace(input: {
  runId: string;
  workspaceDir: string;
  db: any;
  service?: { emit: (run: unknown, event: string, data: unknown) => unknown };
  run?: unknown;
}): Promise<VkenValidationResult> {
  const byStage = {} as VkenValidationResult['byStage'];

  // Stages 1-2: tsc + build (existing logic, unchanged).
  const tsc = fs.existsSync(path.join(input.workspaceDir, 'tsconfig.json'))
    ? runCommand(input.workspaceDir, 'npm', ['exec', 'tsc', '--', '--noEmit', '-p', '.'])
    : { ok: true, details: { skipped: 'no tsconfig.json' } };
  record(input, byStage, 'tsc', tsc.ok, tsc.details);

  const build = runCommand(input.workspaceDir, 'npm', ['run', 'build']);
  record(input, byStage, 'build', build.ok, build.details);

  // Stages 3-5: real measurements via Playwright.
  if (!build.ok) {
    // If build failed, recapture is impossible; emit failures honestly.
    record(input, byStage, 'a11y', false, { skipped: 'build failed' });
    record(input, byStage, 'pixel', false, { skipped: 'build failed' });
    record(input, byStage, 'console', false, { skipped: 'build failed' });
    return { ok: false, byStage };
  }

  const preview = await spawnVitePreview(input.workspaceDir);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await page.goto(preview.url, { waitUntil: 'networkidle' });

    const axe = await new AxeBuilder({ page }).analyze();
    const seriousViolations = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    record(input, byStage, 'a11y', seriousViolations.length === 0, {
      axeRuns: 1,
      violationCount: axe.violations.length,
      seriousCount: seriousViolations.length,
      topViolations: seriousViolations.slice(0, 5).map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
    });

    const afterPng = await page.screenshot({ fullPage: false });
    const before = input.db
      .prepare('SELECT screenshot_path FROM vken_captures WHERE run_id=? AND viewport=? AND when_phase=? LIMIT 1')
      .get(input.runId, 'desktop', 'initial') as { screenshot_path: string } | undefined;
    if (before?.screenshot_path && fs.existsSync(before.screenshot_path)) {
      const beforePng = fs.readFileSync(before.screenshot_path);
      const visualGap = computeVisualGap(beforePng, afterPng);
      record(input, byStage, 'pixel', visualGap < 0.2, { visualGap, threshold: 0.2 });
    } else {
      record(input, byStage, 'pixel', true, { skipped: 'no initial capture' });
    }

    record(input, byStage, 'console', consoleErrors.length === 0, { errors: consoleErrors.slice(0, 20) });
  } finally {
    await browser.close();
    await preview.kill();
  }

  return { ok: Object.values(byStage).every((stage) => stage.ok), byStage };
}
```

If `spawnVitePreview` doesn't exist yet, extract it from `runner.ts` into a sibling export. Don't duplicate the port-finding logic.

**Step 5: Run the test to verify it passes**

```bash
pnpm --filter @open-design/daemon test -- --run vken-validate
```

Expected: PASS (may take ≤90s due to real Playwright + build).

**Step 6: Run typecheck**

```bash
pnpm typecheck
```

Expected: green.

**Step 7: Commit**

```bash
git add apps/daemon/package.json apps/daemon/src/vken/validate.ts apps/daemon/src/vken/runner.ts apps/daemon/tests/vken-validate.test.ts pnpm-lock.yaml
git commit -m "fix(vken): replace fabricated validate stages with real axe + recapture + pixel diff"
```

**Gate:** `pnpm --filter @open-design/daemon test -- --run vken-validate` is green and the test asserts `visualGap` is not the constant `0.04`.

---

## Block 1.2 — Honest score-after (recompute on materialized FS)

**Why:** [apps/daemon/src/server.ts:3250](../../apps/daemon/src/server.ts) sets `scoreAfter = Math.max(scoreBefore, scoreBefore + patches.length * 0.4)` — a linear fabrication from patch count. The cockpit's score-climb is the demo's hero moment; if it's a lie, the whole submission is a lie.

**Files:**
- Modify: `apps/daemon/src/server.ts` (the `/finalize` and `/approve` handlers)
- Modify: `apps/daemon/src/vken/run-pipeline.ts` (expose a recompute helper if needed)

**Step 1: Locate the lie**

Find `Math.max(scoreBefore, scoreBefore + patches.length * 0.4)` in `server.ts`. Find every other place where score is bumped by a hardcoded constant (`+0.04` in `/scrub`, the `scoreBoost = patchesApproved * 0.25` pattern in `/approve`).

**Step 2: Write a helper `recomputeScore`**

Add to [apps/daemon/src/vken/run-pipeline.ts](../../apps/daemon/src/vken/run-pipeline.ts) (or a new `score-runtime.ts` if it cleanly fits there):

```ts
export async function recomputeScoreFromMaterialized(input: {
  runId: string;
  db: any;
  workspaceDir: string;
  designQualityOverride?: number; // optional — pass when we already have a fresh critique
}): Promise<VkenScorePayload> {
  // Re-run the lint/index pass on the materialized FS, NOT the in-memory state.
  const index = buildVkenWorkspaceIndex(input.workspaceDir);
  // designQuality: prefer the most recent critique stored for this run; fallback to undefined (lets score.ts use the deterministic blend).
  const lastCritique = input.db
    .prepare('SELECT design_quality FROM vken_findings WHERE run_id=? ORDER BY created_at DESC LIMIT 1')
    .get(input.runId) as { design_quality: number } | undefined;
  return scoreVkenIndex(index, {
    designQuality: input.designQualityOverride ?? lastCritique?.design_quality,
    when: 'final',
  });
}
```

**Step 3: Replace fabricated bumps**

In `server.ts /finalize`, replace the `Math.max(...)` line with:

```ts
const scoreAfter = await recomputeScoreFromMaterialized({
  runId,
  db,
  workspaceDir: materializedDir,
});
```

In `/approve`, replace the `scoreBoost = patchesApproved * 0.25` pattern with the same recompute against the post-apply virtual FS materialized to a temp dir (reuse `materializeTo` from `apply.ts`). In `/scrub`, recompute after the scrub is applied.

**Step 4: Add a smoke assertion**

Update [infra/space/smoke.mjs](../../infra/space/smoke.mjs) (or its equivalent) to assert that `scoreAfter !== scoreBefore + patches.length * 0.4` after a finalize. If the smoke harness doesn't reach finalize, add an integration test in `apps/daemon/tests/vken-pipeline.test.ts` that runs intake→capture→approve→finalize against a sample and asserts the final score has at least one decimal that's not `.0` or `.4` (a deterministic real recomputation will produce non-trivial values; the linear fabrication produced exactly `+0.4N`).

**Step 5: Verify**

```bash
pnpm --filter @open-design/daemon test
pnpm typecheck
```

**Step 6: Commit**

```bash
git add apps/daemon/src/server.ts apps/daemon/src/vken/run-pipeline.ts apps/daemon/tests/vken-pipeline.test.ts
git commit -m "fix(vken): recompute score from materialized FS instead of fabricating from patch count"
```

**Gate:** No occurrence of `patches.length * 0.4` or `+0.04` constants remains in `server.ts` for score math. `git grep -n "patches\.length \* 0\.4" apps/daemon/src` returns no results.

---

## Block 1.3 — PR body language gated on actual measurements

**Why:** [apps/daemon/src/vken/pr.ts:153-158](../../apps/daemon/src/vken/pr.ts) prints "✅ axe-core (0 violations)" regardless of what `validate.ts` actually returned. After Block 1.1 the validate output is real; the PR body must reflect it.

**Files:**
- Modify: `apps/daemon/src/vken/pr.ts`

**Step 1: Replace static checklist with real `byStage`**

In `pr.ts`, the function that builds the markdown body should accept the `VkenValidationResult` and emit lines like:

```ts
function renderValidationChecklist(byStage: VkenValidationResult['byStage']): string {
  const line = (label: string, stage: keyof VkenValidationResult['byStage']) => {
    const s = byStage[stage];
    if (!s) return `- ⚠️ ${label} (not run)`;
    const tick = s.ok ? '✅' : '❌';
    return `- ${tick} ${label}${renderStageDetail(stage, s)}`;
  };
  return [
    line('tsc --noEmit', 'tsc'),
    line('npm run build', 'build'),
    line('axe-core', 'a11y'),
    line('pixel diff vs initial capture', 'pixel'),
    line('browser console scan', 'console'),
  ].join('\n');
}

function renderStageDetail(stage: string, s: { ok: boolean; details: any }): string {
  if (stage === 'a11y' && s.details?.violationCount != null) return ` (${s.details.violationCount} violations, ${s.details.seriousCount} serious)`;
  if (stage === 'pixel' && s.details?.visualGap != null) return ` (gap ${s.details.visualGap.toFixed(3)} / ${s.details.threshold})`;
  if (stage === 'console' && Array.isArray(s.details?.errors)) return ` (${s.details.errors.length} errors)`;
  if (s.details?.skipped) return ` (skipped: ${s.details.skipped})`;
  return '';
}
```

Then thread `byStage` into the existing PR-body template at `pr.ts:144-167` and replace the static checklist block with `renderValidationChecklist(byStage)`.

**Step 2: Update the test**

If `pr.ts` has tests, update the snapshot or assertion. If it doesn't, add a tiny `apps/daemon/tests/vken-pr.test.ts`:

```ts
import { renderValidationChecklist } from '../src/vken/pr.js'; // export it from pr.ts
// ... assert:
expect(renderValidationChecklist({
  tsc: { ok: true, details: { skipped: 'no tsconfig.json' } },
  build: { ok: true, details: {} },
  a11y: { ok: false, details: { violationCount: 3, seriousCount: 1 } },
  pixel: { ok: true, details: { visualGap: 0.07, threshold: 0.2 } },
  console: { ok: true, details: { errors: [] } },
})).toContain('❌ axe-core (3 violations, 1 serious)');
```

**Step 3: Verify**

```bash
pnpm --filter @open-design/daemon test
```

**Step 4: Commit**

```bash
git add apps/daemon/src/vken/pr.ts apps/daemon/tests/vken-pr.test.ts
git commit -m "fix(vken): PR body checklist reflects real validate.ts measurements"
```

**Gate:** PR body for a run with a known a11y violation includes the violation count; PR body for a skipped tsc stage shows `(skipped: no tsconfig.json)` rather than `✅`.

---

## Block 1.4 — URL-intake UI in the cockpit

**Why:** Audit found `intake.ts:37-83` already implements `git clone --depth 1` URL intake, but `apps/web/src/components/vken/Hook.tsx` only offers "Try landing-generic". Plan §6.2 demo step #1 was paste-a-Vite-repo-URL.

**Files:**
- Modify: `apps/web/src/components/vken/Hook.tsx`
- Modify: `apps/web/src/components/vken/VkenApp.tsx` (route the URL POST through the existing `/api/vken/runs` flow)

**Step 1: Add the input + CTA**

In `Hook.tsx`, replace the current "Try landing-generic" button with a small form:

```tsx
const [url, setUrl] = useState('');
const [busy, setBusy] = useState(false);
async function startUrlRun() {
  if (!url.trim()) return;
  setBusy(true);
  const res = await fetch('/api/vken/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intake: { kind: 'url', url } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setBusy(false);
    alert(`Intake failed: ${err.message ?? res.statusText}`);
    return;
  }
  const { runId } = await res.json();
  navigate(`/vken/run/${runId}`); // wire from useNavigate
}
```

Mark the input clearly: placeholder `"https://github.com/<user>/<vite-react-tailwind-repo>"`, helper text *"Public repos only. Vite + React + Tailwind."*, and keep the "Try landing-generic" sample buttons next to it.

**Step 2: Surface the friendly error path from `intake.ts`**

The friendly errors (non-Vite stack, oversized clone, non-allowlisted host) should map to user-readable strings. If they don't already, add an error-code-to-message mapping in the catch branch.

**Step 3: Manual verification**

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

Visit `http://localhost:17573/vken`. Paste `https://github.com/sveltejs/svelte` (deliberately wrong stack) → see friendly error. Paste a known-good Vite+React+Tailwind repo → run starts.

**Step 4: Commit**

```bash
git add apps/web/src/components/vken/Hook.tsx apps/web/src/components/vken/VkenApp.tsx
git commit -m "feat(vken): URL intake input in cockpit hook"
```

**Gate:** A user can start a run by pasting a public Vite+React+Tailwind repo URL.

---

## Block 1.5 — KB examples writes + sample tsconfigs + KBPanel filters

**Why:**
1. Audit: `vken_kb_examples` is read at `server.ts:3395` but never written. KB rule detail page renders empty examples forever.
2. Audit: TSC stage always reports `skipped` because samples have no `tsconfig.json`. Plan §3.3 requires samples to typecheck.
3. KBPanel is currently 3 fields per rule with no filters/sorts. Plan §8.2 promised filters + drill-down.

**Files:**
- Modify: `apps/daemon/src/vken/kb.ts` (insert into `vken_kb_examples` on `commit`)
- Create: `samples/landing-generic/tsconfig.json`, `samples/dashboard-cluttered/tsconfig.json`, `samples/ecommerce-basic/tsconfig.json`
- Modify: `apps/web/src/components/vken/KBPanel.tsx`

**Step 1: Write `vken_kb_examples` on KB commit**

In [apps/daemon/src/vken/kb.ts](../../apps/daemon/src/vken/kb.ts), inside `commit({db, runId})`, after the rule update, INSERT one example row per approved patch tied to that rule:

```ts
const examples = db.prepare(
  `SELECT p.id AS patch_id, p.search, p.replace, p.file_path
   FROM vken_patches p
   JOIN vken_run_memory m ON m.run_id=p.run_id
   WHERE p.run_id=? AND p.status='applied' AND p.rule_id=?`
).all(runId, ruleId);
const insertExample = db.prepare(
  `INSERT OR IGNORE INTO vken_kb_examples (id, rule_id, search, replace, file_path, run_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
for (const ex of examples) {
  insertExample.run(`ex_${randomUUID()}`, ruleId, ex.search, ex.replace, ex.file_path, runId, Date.now());
}
```

Cap at 3 examples per rule (drop oldest first via a separate sweep). Plan: learning-loop §10 cap.

**Step 2: Add minimal `tsconfig.json` to each sample**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Verify: `cd samples/landing-generic && npx tsc --noEmit -p .` exits 0.

**Step 3: KBPanel filters + sorts**

Update `apps/web/src/components/vken/KBPanel.tsx`:
- Filter dropdown: `findingType`, `severity`, `status` (active/quarantined/retired).
- Sort buttons: `avg_score_delta`, `accept_count`, `updated_at`.
- Click a row → expand evidence-runs list (link out to `/vken/run/<id>`) and example patches (collapsed by default).
- Add a "signature verified" badge (use the existing HMAC verify helper from `kb-signature.ts`).

Keep it inline-styled to match the rest of the cockpit.

**Step 4: Verify**

```bash
pnpm typecheck
pnpm test
cd samples/landing-generic && npx tsc --noEmit -p . && cd -
```

**Step 5: Commit**

```bash
git add apps/daemon/src/vken/kb.ts samples/*/tsconfig.json apps/web/src/components/vken/KBPanel.tsx
git commit -m "fix(vken): write kb_examples on commit, add sample tsconfigs, KBPanel filters"
```

**Gate:** After a finalized run with approved patches, `SELECT count(*) FROM vken_kb_examples` > 0. `cd samples/<each> && npx tsc --noEmit -p .` exits 0 for all 3.

---

## Phase 1 acceptance gate

Run, all must be green:

```bash
pnpm typecheck
pnpm test
pnpm --filter @open-design/daemon test -- --run vken-validate
node infra/space/smoke.mjs sample landing-generic
git grep -n "patches\.length \* 0\.4" apps/daemon/src   # expect: no matches
git grep -n "visualGap: 0\.04" apps/daemon/src           # expect: no matches
echo "PHASE_1_OK"
```

If `PHASE_1_OK` does not print, do **not** start Phase 2.

---

# Phase 2 — AMD MI300X bring-up + harvest (≈6h human + ≈12 GPU hours)

## Block 2.1 — Spin up MI300X and verify vLLM serves both Qwen models

**Why:** Need to confirm the droplet, ROCm, and `infra/amd-cloud/start-vllm.sh` actually work before burning time on harvest.

**Files:**
- Modify: `infra/amd-cloud/start-vllm.sh` (add latency/health-check helper at end)
- Create: `docs/amd-spend.md` (running spend log)

**Step 1: Provision the droplet**

On AMD Developer Cloud, create the smallest MI300X droplet that exposes Docker + ROCm. Note the droplet hostname/IP and SSH key.

**Step 2: Smoke the start script**

SSH in and run:

```bash
git clone https://github.com/<your-org>/open-design.git
cd open-design
export VKEN_VLLM_TOKEN=$(openssl rand -hex 32)
export HF_TOKEN=<hf-token-with-qwen-access>
bash infra/amd-cloud/start-vllm.sh
```

Wait for both containers to report ready. Then:

```bash
curl -sf -H "Authorization: Bearer $VKEN_VLLM_TOKEN" http://127.0.0.1:8000/v1/models | jq -r '.data[].id'
curl -sf -H "Authorization: Bearer $VKEN_VLLM_TOKEN" http://127.0.0.1:8001/v1/models | jq -r '.data[].id'
```

Expected: VL endpoint returns `Qwen/Qwen2.5-VL-72B-Instruct`; coder endpoint returns the coder model.

**Step 3: Capture latency baseline**

```bash
time curl -sf -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer $VKEN_VLLM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"Qwen/Qwen2.5-VL-72B-Instruct","messages":[{"role":"user","content":"Say JSON: {\"ok\":true}"}],"max_tokens":20}'
```

Record p50/p95 in `docs/amd-spend.md` along with current GPU-hour count.

**Step 4: Configure local daemon to point at MI300X**

On your dev machine, set:

```bash
export VKEN_LLM_PROVIDER=amd-vllm
export VKEN_VLLM_VL_URL=http://<droplet>:8000/v1
export VKEN_VLLM_CODER_URL=http://<droplet>:8001/v1
export VKEN_VLLM_TOKEN=<token>
```

Run `node infra/space/smoke-vl.mjs landing-generic` and `node infra/space/smoke-coder.mjs landing-generic`. Both should print `VL_SMOKE_OK` / `CODER_SMOKE_OK`.

**Step 5: Commit**

```bash
git add docs/amd-spend.md infra/amd-cloud/start-vllm.sh
git commit -m "chore(vken): AMD MI300X bring-up smoke + spend log baseline"
```

**Gate:** Both vLLM endpoints return `200 OK` with valid JSON. Smoke scripts pass against MI300X. GPU-hour spend logged.

---

## Block 2.2 — Cassette recorder script

**Why:** The current cassettes (`infra/space/cassettes/*.json`) are hand-authored stubs with empty `patches[]`. We need a script that runs the real engine and serializes the LLM transcript into the cassette format.

**Files:**
- Create: `scripts/vken-record-cassette.ts`
- Modify: `apps/daemon/src/vken/llm/client.ts` (add an opt-in transcript-recording side channel)

**Step 1: Add a recording hook to `client.ts`**

Add an optional global recorder:

```ts
// apps/daemon/src/vken/llm/client.ts
let activeRecorder: VkenTranscriptRecorder | null = null;
export function setTranscriptRecorder(r: VkenTranscriptRecorder | null) { activeRecorder = r; }
export interface VkenTranscriptRecorder {
  record(call: { task: 'vl' | 'coder'; phase: string; messages: VkenChatMessage[]; response: unknown; usage: { inputTokens: number; outputTokens: number } }): void;
}
```

Inside `chatVL` / `chatCoder`, after a successful (parsed) response:

```ts
activeRecorder?.record({ task, phase: options?.phase ?? 'unknown', messages, response: result.parsed, usage: result.usage });
```

Have `critique.ts`, `directions.ts`, `propose.ts` pass a `phase` option (`'critique' | 'directions' | 'patches'`) so the cassette tags calls.

**Step 2: Write the recorder script**

Create [scripts/vken-record-cassette.ts](../../scripts/vken-record-cassette.ts):

```ts
import fs from 'node:fs';
import path from 'node:path';
import { setTranscriptRecorder } from '@open-design/daemon/dist/vken/llm/client.js';
import { executeDeterministicVkenRun } from '@open-design/daemon/dist/vken/run-pipeline.js';
// ... usual imports for db, app context

const sampleId = process.argv[2];
if (!sampleId) { console.error('usage: vken-record-cassette.ts <sampleId>'); process.exit(1); }

const calls: any[] = [];
setTranscriptRecorder({
  record: (c) => calls.push({ task: c.task, phase: c.phase, response: c.response, usage: c.usage }),
});

const runId = await executeDeterministicVkenRun({ intake: { kind: 'sample', sampleId } /* ... */ });

const out = { schemaVersion: 1, sampleId, runId, recordedAt: Date.now(), provider: process.env.VKEN_LLM_PROVIDER, calls };
const file = path.resolve(`infra/space/cassettes/${sampleId}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`VKEN_CASSETTE_RECORDED file=${file} calls=${calls.length}`);
```

**Step 3: Update cassette provider to read the new shape**

[apps/daemon/src/vken/llm/providers/cassette.ts](../../apps/daemon/src/vken/llm/providers/cassette.ts) should match calls by `(task, phase)` (in that order) instead of by promptHash. Phase + task is enough for our pipeline; promptHash is V2.

**Step 4: Test on the live MI300X**

```bash
export VKEN_LLM_PROVIDER=amd-vllm
# (vLLM env from Block 2.1)
pnpm --filter @open-design/daemon build
node scripts/vken-record-cassette.ts landing-generic
node scripts/vken-record-cassette.ts dashboard-cluttered
node scripts/vken-record-cassette.ts ecommerce-basic
```

Verify each cassette is now ≥ 4 calls (critique + directions + patches + maybe a re-prompt) with non-empty `patches`.

**Step 5: Commit**

```bash
git add apps/daemon/src/vken/llm/client.ts apps/daemon/src/vken/llm/providers/cassette.ts apps/daemon/src/vken/critique.ts apps/daemon/src/vken/directions.ts apps/daemon/src/vken/propose.ts scripts/vken-record-cassette.ts infra/space/cassettes/*.json
git commit -m "feat(vken): cassette recorder + record real MI300X transcripts for 3 samples"
```

**Gate:** Each cassette's `calls[].phase === 'patches'` entry has a non-empty `patches` array. `git log` shows the cassette files were modified by this commit (i.e., they're real recordings, not edits to the stubs).

---

## Block 2.3 — KB harvest run (×30 across 3 samples)

**Why:** `scripts/vken-kb-seed.ts` currently hardcodes 30 templated rules. Replace it with a harvest script that runs the engine N times against each sample, collects approved patches into rules grouped by `finding_type`, deduplicates, and writes signed JSONL.

**Files:**
- Create: `scripts/vken-kb-harvest.ts` (replaces the seeded-stub semantics)
- Keep: `scripts/vken-kb-seed.ts` for backwards compat — but make it call the harvester or mark deprecated.

**Step 1: Write the harvester**

[scripts/vken-kb-harvest.ts](../../scripts/vken-kb-harvest.ts):

```ts
// 1. Parse args: --runs <N> (default 30), --samples landing-generic,dashboard-cluttered,ecommerce-basic, --signing-key $VKEN_KB_SIGNING_KEY
// 2. For each sample, for i in 0..runsPerSample:
//    - executeDeterministicVkenRun({sample})
//    - Auto-pick direction with the highest evidence count
//    - Auto-approve top-3 patches (by deterministic propose ranking)
//    - Run validate
//    - If validate.ok: collect (findingType, ruleText draft, scoreDelta, patch search/replace)
// 3. Group collected entries by `finding_type`. For each group:
//    - Pick the most common rule_text (post-normalization).
//    - accept_count = group.length, reject_count = 0
//    - avg_score_delta = mean of scoreDeltas
//    - evidence_runs = unique run IDs
//    - examples = top-3 distinct (search, replace) pairs
//    - Sign with HMAC-SHA256 over `${id}|${finding_type}|${rule_text}|${created_at}`
// 4. Write to kb/seed.jsonl (overwrite). Also INSERT each rule into vken_kb_rules.
// 5. Print VKEN_KB_HARVEST_OK rules=<N> samples=<N> runs=<N>
```

Keep total runs to 30 (10 per sample) to fit the AMD budget. At ≈45s/run on MI300X that's ≈22 GPU minutes — well within W2 budget.

**Step 2: Run the harvester against MI300X**

```bash
export VKEN_LLM_PROVIDER=amd-vllm
# (vLLM env)
export VKEN_KB_SIGNING_KEY=$(openssl rand -hex 32)
echo "$VKEN_KB_SIGNING_KEY" > ~/.vken-kb-signing-key.local   # save it; don't commit
pnpm --filter @open-design/daemon build
node scripts/vken-kb-harvest.ts --runs 30
```

**Step 3: Verify the harvest output**

```bash
wc -l kb/seed.jsonl                              # expect ≥ 6 (one per finding_type group), ≤ 30
jq -r '.rule_text' kb/seed.jsonl | sort -u       # expect distinct rule texts, no "Seed variant N"
jq -r '.evidence_runs[]' kb/seed.jsonl | sort -u # expect real ULIDs
jq -r '.signature' kb/seed.jsonl | head -1       # expect a 64-char hex
```

**Step 4: Commit**

```bash
git add scripts/vken-kb-harvest.ts kb/seed.jsonl
git commit -m "feat(vken): real KB seed harvested from 30 MI300X runs across 3 samples"
```

**Gate:** `grep -c "Seed variant" kb/seed.jsonl` returns 0. Signatures verify under the active signing key. `vken_kb_examples` count > 0 in the DB.

---

## Block 2.4 — Tear down + spend reconciliation

**Files:**
- Modify: `docs/amd-spend.md` (final tally)

**Step 1: Stop and destroy**

```bash
ssh <droplet> 'bash open-design/infra/amd-cloud/stop-vllm.sh'
# Then on AMD Developer Cloud UI: destroy the droplet.
```

**Step 2: Update spend log**

Append to `docs/amd-spend.md`:
- W1 + W2 GPU-hours used, $ spent, balance remaining.
- Latency p50/p95 captured during harvest.
- Number of cassette calls recorded.
- Number of harvest runs that completed validate.ok=true (this is the rule yield rate).

**Step 3: Commit**

```bash
git add docs/amd-spend.md
git commit -m "chore(vken): AMD W1+W2 teardown and spend log"
```

**Gate:** Droplet destroyed (verified on AMD UI). Spend log shows ≤ $60 used. Balance > $40 remaining for W3 + W4.

---

## Phase 2 acceptance gate

```bash
test "$(grep -c 'Seed variant' kb/seed.jsonl)" = "0" && echo "no-stubs-OK"
test "$(jq '.calls | map(select(.phase == "patches")) | .[0].response.patches | length' infra/space/cassettes/landing-generic.json)" -gt 0 && echo "real-cassette-OK"
echo "PHASE_2_OK"
```

---

# Phase 3 — Real learning loop (≈4 hours, no AMD needed)

## Block 3.1 — Promotion gate (Tier 2 → Tier 3)

**Why:** Plan §5.3 of the learning-loop doc specifies a 4-condition gate (multi-repo evidence, bench non-regression, self-critique, signature). Audit confirmed **none of this exists**; `kb.commit` writes Tier 3 unconditionally.

**Files:**
- Modify: `apps/daemon/src/vken/kb.ts`
- Create: `apps/daemon/tests/vken-kb-promotion.test.ts`

**Step 1: Write the failing test**

```ts
// apps/daemon/tests/vken-kb-promotion.test.ts
describe('kb.tryPromoteToTier3', () => {
  it('rejects a rule with only one distinct repo_hash in evidence', async () => {
    const db = makeDb();
    await seedRule(db, { id: 'r1', evidence_runs: ['run-a','run-b'], finding_type: 'color' });
    // both runs share repo_hash 'repo-1'
    await seedRunRepoHash(db, { runId: 'run-a', repoHash: 'repo-1' });
    await seedRunRepoHash(db, { runId: 'run-b', repoHash: 'repo-1' });
    const promoted = await tryPromoteToTier3({ db, ruleId: 'r1' });
    expect(promoted).toBe(false);
  });
  it('promotes a rule with ≥2 distinct repo_hashes and bench non-regression', async () => {
    // ... 2 distinct repo_hashes + a stub bench result that is ≥ 0
    expect(promoted).toBe(true);
  });
  it('rejects when bench shows any sample regressed by > 1.0', async () => { ... });
});
```

Run it: `pnpm --filter @open-design/daemon test -- --run vken-kb-promotion` → FAIL (function doesn't exist).

**Step 2: Implement `tryPromoteToTier3`**

In `kb.ts`:

```ts
export async function tryPromoteToTier3(input: {
  db: any;
  ruleId: string;
  benchSamples?: string[]; // default ['landing-generic', 'dashboard-cluttered', 'ecommerce-basic']
}): Promise<{ promoted: boolean; reason?: string }> {
  // 1. Load rule + evidence_runs.
  const rule = input.db.prepare('SELECT * FROM vken_kb_rules WHERE id=?').get(input.ruleId);
  if (!rule) return { promoted: false, reason: 'rule not found' };
  if (rule.tier === 3) return { promoted: true, reason: 'already tier 3' };

  // 2. Multi-repo evidence: ≥2 distinct repo_hash among evidence_runs.
  const evidence: string[] = JSON.parse(rule.evidence_runs);
  const repoHashes = input.db.prepare(
    `SELECT DISTINCT repo_hash FROM vken_runs WHERE id IN (${evidence.map(() => '?').join(',')})`
  ).all(...evidence).map((r: any) => r.repo_hash);
  if (repoHashes.length < 2) return { promoted: false, reason: 'fewer than 2 distinct repos' };

  // 3. Bench non-regression: replay seed-only vs seed+thisRule across samples (delegate to kb-bench).
  const bench = await runKbBenchForCandidate({ db: input.db, candidateRuleId: input.ruleId });
  if (bench.aggregateDelta < 0) return { promoted: false, reason: `aggregate regression ${bench.aggregateDelta}` };
  if (bench.worstSampleDelta < -1.0) return { promoted: false, reason: `sample regressed by ${bench.worstSampleDelta}` };

  // 4. (optional, time-permitting) Self-critique via chatCoder with a 5-line rubric prompt; threshold ≥ 4.
  // For V1, gate behind env VKEN_KB_SELF_CRITIQUE=1; default off to keep promotion deterministic.

  // 5. Signature is already present (rules are signed at creation). Re-verify it.
  if (!verifyRuleSignature(rule)) return { promoted: false, reason: 'signature invalid' };

  // Promote: tier=3, append to kb/learned.jsonl, emit vken:learn.
  input.db.prepare('UPDATE vken_kb_rules SET tier=3, updated_at=? WHERE id=?').run(Date.now(), rule.id);
  appendJsonl(path.resolve('kb/learned.jsonl'), rule);
  return { promoted: true };
}
```

**Step 3: Wire into the finalize handler**

In `server.ts /finalize`, after the existing `kb.commit` call but **before** the `vken:finalize` event, iterate the staged rules and call `tryPromoteToTier3` for each. Emit a `vken:learn` event per promotion (the cockpit already listens for these).

**Step 4: Re-run tests**

```bash
pnpm --filter @open-design/daemon test
```

**Step 5: Commit**

```bash
git add apps/daemon/src/vken/kb.ts apps/daemon/src/server.ts apps/daemon/tests/vken-kb-promotion.test.ts
git commit -m "feat(vken): real Tier-2→Tier-3 promotion gate (multi-repo + bench + signature)"
```

**Gate:** Promotion test passes. A finalize on a single sample's first run does not promote any rule (only one repo_hash in evidence). After running `landing-generic` then `dashboard-cluttered`, a rule whose finding_type fired in both runs gets promoted.

---

## Block 3.2 — Real `kb-bench.ts` (cassette replay)

**Why:** Audit found `scripts/vken-kb-bench.ts:9-26` is literally a line counter: `(seed * 0.03 + learned * 0.05) / (index + 1)`. Replace with a real bench that replays the cassette through the engine with seed-only KB vs seed+learned KB and measures real score deltas.

**Files:**
- Modify: `scripts/vken-kb-bench.ts`

**Step 1: Rewrite the bench**

```ts
// scripts/vken-kb-bench.ts
// Args: --variant seed-only | seed+learned (default seed+learned), --samples <ids>, --json
// For each sample:
//   1. Reset DB to a clean state (in-memory or a temp file).
//   2. Load kb/seed.jsonl (and optionally kb/learned.jsonl) into vken_kb_rules.
//   3. VKEN_LLM_PROVIDER=cassette executeDeterministicVkenRun({sample})
//   4. Auto-pick first direction. Auto-approve all proposed patches.
//   5. Run validate (skipping the live preview to keep bench fast — run only lint + score recompute).
//   6. Record { sample, scoreInitial, scoreFinal, delta }
// Aggregate, print JSON.
```

Important: the bench must be deterministic — same cassettes + same KB → same deltas.

**Step 2: Verify against the harvest output**

```bash
node scripts/vken-kb-bench.ts --variant seed-only --json | tee /tmp/bench-seed-only.json
node scripts/vken-kb-bench.ts --variant seed+learned --json | tee /tmp/bench-with-learned.json
diff <(jq '.aggregate' /tmp/bench-seed-only.json) <(jq '.aggregate' /tmp/bench-with-learned.json)
```

The `seed+learned` variant should produce a higher (or equal) aggregate. If it's lower, that's a real signal worth investigating — do **not** patch the bench to hide it.

**Step 3: Commit**

```bash
git add scripts/vken-kb-bench.ts
git commit -m "feat(vken): real cassette-replay bench replacing line-counter stub"
```

**Gate:** `node scripts/vken-kb-bench.ts --variant seed-only --json | jq '.deltas[0].sample'` returns an actual sample ID. The two variants produce numerically different `aggregate` values that change with the KB contents.

---

## Block 3.3 — Learning bench panel in cockpit

**Why:** "The KB makes runs better" is the demo's most defensible claim. It needs a visible artifact in the cockpit. Plan learning-loop §7 specifies this.

**Files:**
- Create: `apps/web/src/components/vken/LearningBench.tsx`
- Modify: `apps/web/src/components/vken/KBPanel.tsx` (or wherever it best fits — the `/vken/kb` route is a natural home)
- Modify: `apps/daemon/src/server.ts` (new endpoint `GET /api/vken/kb/bench`)

**Step 1: Add the endpoint**

```ts
// apps/daemon/src/server.ts
// GET /api/vken/kb/bench?variant=seed+learned
// → { variant, deltas: [{sample, scoreInitial, scoreFinal, delta}], aggregate, generatedAt }
// Cache for 60s (KB changes are infrequent at runtime; bench is expensive).
```

It should call into the same code path `kb-bench.ts` uses (extract the body of `kb-bench.ts` into a shared `apps/daemon/src/vken/kb-bench-core.ts`).

**Step 2: Render the panel**

`LearningBench.tsx` shows a two-row table:
- Row 1: "Without learned rules" — bar per sample showing scoreInitial → scoreFinal.
- Row 2: "With learned rules" — same, with the delta highlighted in green.
- Footer: "Generated at <timestamp> · KB rules: N total, M signed".

Mount it in `/vken/kb` above the rule table.

**Step 3: Manual verify**

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

Visit `/vken/kb` → see the bench panel render real numbers.

**Step 4: Commit**

```bash
git add apps/daemon/src/server.ts apps/daemon/src/vken/kb-bench-core.ts apps/web/src/components/vken/LearningBench.tsx apps/web/src/components/vken/KBPanel.tsx
git commit -m "feat(vken): learning bench panel showing seed-only vs seed+learned deltas"
```

**Gate:** `/vken/kb` renders the bench panel with non-zero numbers that match `node scripts/vken-kb-bench.ts --json` output.

---

## Phase 3 acceptance gate

```bash
pnpm typecheck && pnpm test
node scripts/vken-kb-bench.ts --variant seed-only --json | jq '.aggregate'   # real number
node scripts/vken-kb-bench.ts --variant seed+learned --json | jq '.aggregate' # real number, ≥ above
echo "PHASE_3_OK"
```

---

# Phase 4 — Demo polish (≈3 hours, **CUTTABLE in truth-first cut order**)

## Block 4.1 — Replay a real recorded score climb in `Hook.tsx`

**Why:** Audit found `Hook.tsx:14-21` loops `[3.8, 4.1, 4.9, 5.6, 6.4, 7.2]`. Now that we have real recorded runs, replay one of them.

**Files:**
- Create: `apps/web/src/components/vken/hook-stream.json` (recorded SSE events from one good run)
- Modify: `apps/web/src/components/vken/Hook.tsx`

**Step 1: Capture a good run's SSE stream**

Run `landing-generic` end-to-end against MI300X cassettes; pipe `/api/vken/runs/:id/sse` output through `jq` to a file. Trim to the score climb (intake → first 3 score events). Pace events at their original timing.

**Step 2: Replay**

`Hook.tsx` reads the JSON, replays the events at original `dt`. Loop with a 2s pause between cycles.

**Step 3: Commit**

```bash
git add apps/web/src/components/vken/hook-stream.json apps/web/src/components/vken/Hook.tsx
git commit -m "feat(vken): Hook replays a real recorded score climb"
```

---

## Block 4.2 — MI300X provider banner

**Files:**
- Modify: `apps/web/src/components/vken/Cockpit.tsx`

**Step 1: Show the provider header**

Use the existing `providerInfo()` shape from `select-provider.ts` (already returns `{id, vlModel, coderModel, source}`). Render in the cockpit header:

```tsx
const labels = {
  'amd-vllm': '🔥 Running on AMD MI300X · Qwen2.5-VL + Qwen3-Coder',
  openrouter: '🪁 Running on OpenRouter free Qwen',
  cassette: '📼 Replaying recorded MI300X run',
  // ...
};
```

When `id === 'cassette'`, also show "Switch to live AMD MI300X" CTA that opens the BYOK panel preset to `amd-vllm`.

**Step 2: Add the BYOK preset**

In `ByokPanel.tsx`, add a "MI300X" preset button that pre-fills the form with the public droplet URL/token (only if `VKEN_VLLM_PUBLIC_URL` is set in the daemon's env; otherwise hide the preset).

**Step 3: Commit**

```bash
git add apps/web/src/components/vken/Cockpit.tsx apps/web/src/components/vken/ByokPanel.tsx
git commit -m "feat(vken): MI300X provider banner + one-click BYOK preset"
```

---

## Block 4.3 — Keyboard shortcuts + focus rings

**Files:**
- Create: `apps/web/src/components/vken/useKeyboardShortcuts.ts`
- Modify: `apps/web/src/components/vken/Cockpit.tsx`, `PatchList.tsx`, `DirectionPicker.tsx`

**Shortcuts:**
- `j` / `k`: next / previous patch
- `a`: approve focused patch
- `s`: skip focused patch
- `?`: toggle help overlay

Add `:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px; }` globally for vken components (a single CSS module is enough — they're inline-styled today, so add a sibling `.css` file imported once at `VkenApp.tsx`).

**Commit:**
```bash
git commit -m "feat(vken): keyboard shortcuts (j/k/a/s/?) + focus-visible rings"
```

---

## Block 4.4 — Mobile bottom sheet + cassette banner

**Files:**
- Modify: `apps/web/src/components/vken/Cockpit.tsx`, `PatchList.tsx`

`@media (max-width: 768px)` → PatchList fixed at bottom of viewport, swipe-up to expand, BeforeAfter takes the rest. Cassette banner at footer when `providerInfo().id === 'cassette'`: "📼 Replaying recorded MI300X run · [Switch to live]".

**Commit:**
```bash
git commit -m "feat(vken): mobile bottom-sheet PatchList + cassette banner"
```

---

# Phase 5 — Space + judging window (≈3h human + ≈5 GPU hours)

## Block 5.1 — Space deploy verification

**Files:**
- Verify: `infra/space/Dockerfile`, `infra/space/entrypoint.sh`, `.github/workflows/space-sync.yml`

**Step 1: Local Docker build**

```bash
docker build -f infra/space/Dockerfile -t vken-space .
docker run --rm -p 7860:7860 \
  -e VKEN_LLM_PROVIDER=cassette \
  -e VKEN_KB_SIGNING_KEY=$(openssl rand -hex 32) \
  vken-space
```

Visit `http://localhost:7860/vken`. Run `landing-generic` end-to-end with cassette. Verify the score climbs and a bundle download is offered (no PR token in this test).

**Step 2: HF Space push**

Configure `HF_SPACE_REPO` + `HF_TOKEN` in GitHub secrets. Push `vken/v1` to `main` (or trigger the workflow manually). Confirm the Space rebuilds and serves.

**Step 3: Public smoke**

From an external machine: `curl https://huggingface.co/spaces/<your-id>/vken/api/vken/runs ...` (or open in browser, run a sample). Capture a 30-second screen recording of the score climb for the demo video.

**Step 4: Commit (if any deploy fixes were needed)**

```bash
git commit -m "chore(vken): HF Space deploy verified end-to-end"
```

---

## Block 5.2 — Judging-window MI300X warm-up

**Files:**
- None (operational)

**Step 1: 30 minutes before judging starts**

- Spin up MI300X droplet from snapshot (if AMD Cloud supports snapshots) or rerun `start-vllm.sh`.
- Set Space env: `VKEN_VLLM_PUBLIC_URL=http://<droplet>:8000/v1` and `VKEN_VLLM_CODER_PUBLIC_URL=http://<droplet>:8001/v1`. Restart Space.
- Confirm the BYOK preset renders the "MI300X" button.
- Run `landing-generic` once to cache.

**Step 2: During judging**

- Default visitors → cassette mode (free, instant).
- Judges who want to flip → BYOK panel → MI300X preset → real Qwen on MI300X.
- Watch `docs/amd-spend.md` — set a hard cap of $40 for this window.

**Step 3: 15 minutes after the last judge**

```bash
ssh <droplet> 'bash open-design/infra/amd-cloud/stop-vllm.sh'
# Destroy droplet on AMD UI.
```

Append final spend to `docs/amd-spend.md`.

---

## Block 5.3 — Final acceptance + tag

```bash
pnpm typecheck && pnpm test && pnpm build
node scripts/vken-day2-acceptance.ts   # update this script to also run kb-bench and verify cassettes are non-stub
git tag day-3-end
git push --tags
git push hf-space HEAD:main --force   # if not auto-synced
```

**Final verification:**

```bash
# 1. No fabricated metrics in source.
git grep -nE "patches\.length \* 0\.[0-9]|visualGap: 0\.0[0-9]|hardcoded.*ok: true" apps/daemon/src   # expect: no matches

# 2. KB seed is real.
test "$(grep -c 'Seed variant' kb/seed.jsonl)" = "0"

# 3. Cassettes have real patches.
for s in landing-generic dashboard-cluttered ecommerce-basic; do
  test "$(jq '.calls | map(select(.phase == "patches")) | .[0].response.patches | length' "infra/space/cassettes/$s.json")" -gt 0
done

# 4. Bench produces real numbers.
node scripts/vken-kb-bench.ts --json | jq -e '.aggregate | type == "number"'

# 5. PR body is honest (manual: open the latest PR, confirm a11y count matches db).

echo "DAY_3_END_OK"
```

---

# Risk register

| Risk | Trigger | Mitigation |
|---|---|---|
| MI300X bring-up fails | ROCm/Docker issue, image pull fail | Fall back to OpenRouter Qwen for harvest. Cassettes will say "recorded on OpenRouter Qwen" — still defensible, slightly weaker AMD story. |
| Qwen returns broken JSON during harvest | Schema validation fails | Already retried once by `client.ts`. Drop those runs from the harvest, accept lower yield. |
| `axe-core` finds many pre-existing violations in samples | Build/validate fails on samples even pre-patch | Either fix the samples to be axe-clean (small), or weaken the pass criterion to "no NEW violations introduced" (compare before/after counts). Document the choice. |
| KB harvest produces too few rules to be interesting | <6 rules from 30 runs | Run additional 10–20 harvest runs; AMD W2 budget has headroom. |
| AMD spend overshoots $100 | Long inference latency | Hard caps in spend log; tear down at $80 threshold. |
| HF Space build OOM | Docker build > 10 min on free tier | Pre-warm samples `node_modules` in stage 1, ship as cached layer (already in Dockerfile per audit). |
| Promotion gate is too strict, never fires | Bench non-regression rejects all candidates | Loosen `worstSampleDelta` threshold from `-1.0` to `-2.0` for V1; document in plan §3.1. |

---

# Definition of done (Day 3)

A judge can:

1. Open the public HF Space.
2. See a real recorded score climb on the hook (no synthetic loop).
3. Paste a Vite+React+Tailwind GitHub URL OR pick a sample.
4. Watch a real run: critique → 2 directions → ranked patches → approve → AFTER iframe diverges → finalize → real PR with **honest** validation checklist.
5. See the LearnedToast fire when a rule promotes.
6. Open `/vken/kb` and see real rules with real evidence runs and a learning-bench panel showing measured deltas.
7. Click the gear → "MI300X" preset → re-run on live MI300X (during judging window) and see the provider banner change.
8. Read the PR body and confirm every checkmark matches what's in `vken_validations` for that run.
9. Read `docs/amd-spend.md` and confirm we burned the credit on real harvest, not theatre.
10. Read `kb/seed.jsonl` and verify every signature.

— end of document —
