# VKEN Day 2 — Source of Truth Build Plan

| Field           | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Status          | **AUTHORITATIVE** — supersedes prior Day 2 docs for execution purposes                          |
| Build window    | 2026-05-08 (Day 2)                                                                              |
| Owner           | Kenny Chirombo                                                                                  |
| Branch          | `vken/v1`                                                                                       |
| Reference plans | [zero-cost pivot](2026-05-08-vken-day2-zero-cost-pivot.md), [learning loop](2026-05-08-vken-self-learning-loop.md), [original 2-day](2026-05-07-vken-2day-build-plan.md), [hackathon design](2026-05-07-vken-hackathon-v1-design.md) |
| Inference cost  | $0 on Space (OpenRouter free Qwen + Gemini fallback + cassette safety net)                      |
| AMD pivot       | One env var (`VKEN_LLM_PROVIDER=amd-vllm`); ≤10 min, no code changes (see §11)                  |

This document is **the single thing an agent or human needs to execute
Day 2**. It is self-contained: every file path, env var, command,
acceptance criterion, and recovery step is inline. The earlier
zero-cost-pivot and self-learning-loop docs remain as background
reading; this one is for execution.

---

## Table of contents

1. [How to use this document](#1-how-to-use-this-document)
2. [Pre-flight: state assessment (run first every session)](#2-pre-flight-state-assessment-run-first-every-session)
3. [Block 0 — Day-1 gap closure (samples 2 & 3, kb dir, npm install)](#3-block-0--day-1-gap-closure)
4. [Block 1 — Provider-agnostic LLM client](#4-block-1--provider-agnostic-llm-client)
5. [Block 2 — Critique + directions](#5-block-2--critique--directions)
6. [Block 3 — Propose + apply (virtual FS)](#6-block-3--propose--apply-virtual-fs)
7. [Block 4 — Validate + finalize + real PR](#7-block-4--validate--finalize--real-pr)
8. [Block 5 — Self-learning loop (memory tiers + KB)](#8-block-5--self-learning-loop-memory-tiers--kb)
9. [Block 6 — URL intake, BYOK panel, leaderboard, polish](#9-block-6--url-intake-byok-panel-leaderboard-polish)
10. [Block 7 — Hugging Face Space deployment](#10-block-7--hugging-face-space-deployment)
11. [Block 8 — Final acceptance + AMD pivot readiness](#11-block-8--final-acceptance--amd-pivot-readiness)
12. [Final acceptance suite (the green-light check)](#12-final-acceptance-suite-the-green-light-check)
13. [Demo runbook (judge's POV walkthrough)](#13-demo-runbook-judges-pov-walkthrough)
14. [Recovery playbook (when a gate fails)](#14-recovery-playbook-when-a-gate-fails)
15. [Appendix A — Env var reference](#15-appendix-a--env-var-reference)
16. [Appendix B — File inventory (post-build)](#16-appendix-b--file-inventory-post-build)
17. [Appendix C — What makes this submission superior](#17-appendix-c--what-makes-this-submission-superior)

---

## 1. How to use this document

### 1.1 Idempotency policy

This plan is **safe to re-enter from any point**. Every step starts
with an explicit "skip if" check. An agent picking up mid-build runs
the pre-flight (§2), identifies the first non-green gate, and starts
work *there*. No step assumes prior steps were just run; each verifies
its own preconditions.

### 1.2 Block contract

Each block has the same structure:

- **Prerequisites** — files / commits / env vars that must exist first.
  Listed as "skip-if" checks so the block is no-op when already done.
- **Deliverables** — exact files to create or modify, with their final
  responsibilities.
- **Acceptance criteria (AC)** — what *must* be true at block end.
- **Verification commands** — copy-paste shell commands that print
  `OK` or fail loudly. The block is **not done** until every command
  prints `OK`.
- **Commit** — exact message to use.
- **Gate** — one-line check the next block runs as its first
  prerequisite.

### 1.3 Error policy

When a verification command fails:

1. Do **not** edit files to make the verifier pass tautologically.
2. Identify the root cause (read the error, not the symptom).
3. Apply the smallest fix in the named file.
4. Re-run the verifier.
5. If still red, jump to §14 (recovery playbook) — find the matching
   row.
6. Only when the verifier prints `OK` may the block be considered
   complete.

### 1.4 What this plan does *not* do

- Does **not** rename packages, dirs, or workspace scopes (high
  churn, zero demo value — all `@open-design/*` names stay).
- Does **not** introduce new abstractions beyond those listed.
- Does **not** add features after Block 8. Polish is the last hour,
  not the first.
- Does **not** change the design doc, the contracts surface, or the
  SSE event names already shipped on Day 1.

### 1.5 The single overriding rule

**Every gate in §2–§11 must be green before §12 runs. §12 must be
green before §10 (Space deploy) is considered done. No exceptions, no
"I'll fix that later", no half-merged blocks.**

---

## 2. Pre-flight: state assessment (run first every session)

Before touching any code in any session, run this sequence. It tells
you which block to start in.

### 2.1 Environment

```bash
node --version          # expect v24.x
pnpm --version          # expect 10.33.2
git rev-parse --abbrev-ref HEAD   # expect vken/v1
git status -s | wc -l              # baseline; record the number
```

If `git rev-parse` returns anything other than `vken/v1`:

```bash
git checkout vken/v1
```

If `node` is not 24.x: install it via the user's package manager
before continuing. Do not proceed on a wrong Node version — the
runner spawns Vite using `process.execPath`.

### 2.2 Day-1 sanity (must already pass)

```bash
pnpm install
pnpm --filter @open-design/contracts typecheck
pnpm --filter @open-design/daemon test -- --run vken-db vken-algorithms vken-lint vken-pipeline
```

All three must be green. If any are red, stop and fix Day-1 regression
*before* starting Day 2 work — no Day 2 block will recover from a
broken Day-1 baseline.

### 2.3 Block-completion ledger

The build is divided into 9 blocks (0–8). Run the matching
"gate-check" commands below; the **first one that fails** is the
block to start in.

| Block | Done if all of these print `OK`                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `test -f samples/dashboard-cluttered/src/App.tsx && test -f samples/ecommerce-basic/src/App.tsx && test -d samples/landing-generic/node_modules/vite && test -d kb && echo OK` |
| 1     | `test -f apps/daemon/src/vken/llm/client.ts && test -f apps/daemon/src/vken/llm/providers/openrouter.ts && test -f apps/daemon/src/vken/llm/providers/cassette.ts && echo OK` |
| 2     | `test -f apps/daemon/src/vken/critique.ts && test -f apps/daemon/src/vken/directions.ts && grep -q "vken:direction" apps/daemon/src/vken/run-pipeline.ts && echo OK`            |
| 3     | `test -f apps/daemon/src/vken/propose.ts && test -f apps/daemon/src/vken/apply.ts && test -f apps/web/src/components/vken/PatchCard.tsx && echo OK`                            |
| 4     | `test -f apps/daemon/src/vken/validate.ts && test -f apps/daemon/src/vken/pr.ts && grep -q "/finalize" apps/daemon/src/server.ts && echo OK`                                  |
| 5     | `test -f apps/daemon/src/vken/memory.ts && test -f apps/daemon/src/vken/kb.ts && test -f kb/seed.jsonl && test -f scripts/vken-kb-bench.ts && echo OK`                          |
| 6     | `test -f apps/web/src/components/vken/ByokPanel.tsx && test -f apps/web/src/components/vken/Leaderboard.tsx && grep -q "x-vken-byok" apps/daemon/src/server.ts && echo OK`     |
| 7     | `test -f infra/space/Dockerfile && test -f infra/space/entrypoint.sh && echo OK`                                                                                                |
| 8     | `git tag -l day-2-end \| grep -q day-2-end && echo OK`                                                                                                                          |

The first row that does **not** print `OK` is your starting block.

### 2.4 LLM provider readiness (Block 1+)

Before starting Block 1, confirm OpenRouter access:

```bash
test -n "$VKEN_OPENROUTER_KEY" && echo "key set" || echo "MISSING"
curl -sf https://openrouter.ai/api/v1/models -H "Authorization: Bearer $VKEN_OPENROUTER_KEY" \
  | jq -r '.data[].id' | grep -E "qwen2.5-vl|qwen-2.5-coder" | head -5
```

If the key is missing, get one from <https://openrouter.ai> (free
account, no card required) before Block 1. The model list query
should print at least one VL and one Coder model. If models named
`qwen/qwen2.5-vl-72b-instruct:free` or
`qwen/qwen-2.5-coder-32b-instruct:free` are unavailable on the day,
fall back to whichever `:free` Qwen variants are listed (the env
vars `VKEN_OR_VL_MODEL` / `VKEN_OR_CODER_MODEL` make this trivial).

---

## 3. Block 0 — Day-1 gap closure

**Time:** 45 min · **Lock-step prereq for everything that follows.**

### 3.1 Prerequisites

Skip this block entirely if §2.3 row 0 prints `OK`.

### 3.2 Deliverables

- [samples/dashboard-cluttered/src/App.tsx](../../samples/dashboard-cluttered/src/App.tsx) —
  real Vite+React app with intentional debt (cluttered grid, hardcoded
  greys, inconsistent radii, low-contrast badges) per design doc §20.2.
- [samples/dashboard-cluttered/src/styles.css](../../samples/dashboard-cluttered/src/styles.css) —
  Tailwind v3 `@tailwind base/components/utilities` + ~10 lines of
  custom CSS that introduce 3+ hardcoded colors and 2+ inconsistent
  radii.
- [samples/dashboard-cluttered/src/main.tsx](../../samples/dashboard-cluttered/src/main.tsx) —
  ReactDOM bootstrap.
- [samples/dashboard-cluttered/postcss.config.js](../../samples/dashboard-cluttered/postcss.config.js)
  and `vite.config.ts` — the standard Vite + Tailwind config trio.
- Same set under [samples/ecommerce-basic/src/](../../samples/ecommerce-basic/src/)
  with PDP layout debt per §20.3 (broken primary CTA, stretched
  product image, inconsistent button hierarchy).
- [samples/landing-generic/postcss.config.js](../../samples/landing-generic/postcss.config.js)
  and `vite.config.ts` — only if missing (sample exists already).
- [samples/install-all.mjs](../../samples/install-all.mjs) — Node script
  that runs `npm install --no-audit --no-fund --prefer-offline` in
  each sample directory, idempotently. Logs per-sample size and
  duration.
- [scripts/vken-day2-state.ts](../../scripts/vken-day2-state.ts) — TypeScript
  port of the §2.3 ledger as a single command. Optional but lifts
  re-entry friction; defer if time-pressed.
- [kb/.gitkeep](../../kb/.gitkeep) and [kb/README.md](../../kb/README.md)
  with one paragraph: "Tier-3 KB lives here. `seed.jsonl` ships
  curated baseline rules; `learned.jsonl` accumulates promoted rules.
  Both are HMAC-signed with `VKEN_KB_SIGNING_KEY`."

### 3.3 Authoring rules for sample apps

Each sample app must:

- Use **Vite + React 18 + Tailwind v3** (matches what
  `intake.detectSupportedWorkspace` accepts).
- Have a `package.json` `scripts: { dev, build }` pair where `dev`
  starts on a configurable port (Vite respects `--port`).
- Render a non-trivial route at `/` (≥ 30 visible elements) so
  `capture.readBoxModels` returns useful data.
- Be **deterministically broken** in a measurable way: at least 6
  hardcoded color literals and ≥ 4 hardcoded `border-radius` values,
  none using a CSS variable. This is what gives `score.ts` something
  to flag and what gives the LLM something to fix.
- Have **no external dependencies** beyond `react`, `react-dom`,
  `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`,
  `autoprefixer`. No icon libraries, no router (single route is
  fine for V1). Smaller `npm install` = faster Space build.

### 3.4 `samples/install-all.mjs` shape

```js
// One responsibility: install node_modules in every sample dir,
// skipping samples that already have a working node_modules.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const samples = readdirSync(here)
  .filter((name) => statSync(join(here, name)).isDirectory())
  .filter((name) => existsSync(join(here, name, 'package.json')));

for (const name of samples) {
  const dir = join(here, name);
  if (existsSync(join(dir, 'node_modules', 'vite', 'bin', 'vite.js'))) {
    console.log(`[skip] ${name} (already installed)`);
    continue;
  }
  console.log(`[install] ${name}`);
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'], {
    cwd: dir, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (r.status !== 0) { console.error(`[fail] ${name}`); process.exit(1); }
}
console.log('SAMPLES_INSTALLED_OK');
```

Add an `od:samples` script to root `package.json`:

```json
"od:samples": "node samples/install-all.mjs"
```

### 3.5 Acceptance criteria

- All three samples have `src/App.tsx`, `src/main.tsx`, `index.html`,
  `package.json`, `vite.config.ts`, `tailwind.config.ts`,
  `postcss.config.js`, `src/styles.css`.
- Each sample has `node_modules/vite/bin/vite.js`.
- `kb/` exists.
- `pnpm typecheck` passes.
- `pnpm test` passes (no new test added in this block, just no
  regressions).
- `node infra/space/smoke.mjs --no-llm sample landing-generic` →
  `VKEN_SMOKE_OK`.
- `node infra/space/smoke.mjs --no-llm sample dashboard-cluttered` →
  `VKEN_SMOKE_OK`.
- `node infra/space/smoke.mjs --no-llm sample ecommerce-basic` →
  `VKEN_SMOKE_OK`.

### 3.6 Verification

```bash
pnpm install
pnpm od:samples
pnpm typecheck && pnpm test
node infra/space/smoke.mjs --no-llm sample landing-generic
node infra/space/smoke.mjs --no-llm sample dashboard-cluttered
node infra/space/smoke.mjs --no-llm sample ecommerce-basic
echo "BLOCK_0_OK"
```

If `BLOCK_0_OK` does not print, see §14 row B0.

### 3.7 Commit + gate

```bash
git add samples/ kb/ package.json scripts/vken-day2-state.ts
git commit -m "feat(vken): finish samples 2 + 3, samples installer, kb dir"
```

**Gate:** §2.3 row 0 now prints `OK`.

---

## 4. Block 1 — Provider-agnostic LLM client

**Time:** 105 min · **Foundation for every Block ≥ 2.**

### 4.1 Prerequisites

- §2.3 row 0 = `OK`.
- `$VKEN_OPENROUTER_KEY` is set in the shell (or `.env.local` is
  loaded by the daemon).

### 4.2 Deliverables

```
apps/daemon/src/vken/llm/
├── client.ts                    # public surface
├── schema.ts                    # zod schemas (critique, directions, propose)
├── select-provider.ts           # env + per-request override
├── token-account.ts             # normalized usage capture
├── errors.ts                    # VkenLlmError taxonomy
└── providers/
    ├── openrouter.ts            # PRIMARY (Space default)
    ├── gemini.ts                # auto-fallback
    ├── amd-vllm.ts              # AMD pivot target
    ├── openai.ts                # BYOK
    ├── anthropic.ts             # BYOK
    ├── ollama.ts                # local BYOK runtime
    └── cassette.ts              # offline last-resort
infra/space/cassettes/
├── landing-generic.json         # one full LLM transcript per sample
├── dashboard-cluttered.json
└── ecommerce-basic.json
infra/space/smoke-vl.mjs         # one-shot VL call against landing-generic
infra/space/smoke-coder.mjs      # one-shot Coder call against landing-generic
```

### 4.3 Public surface (`client.ts`)

Exactly two callable functions plus one introspection function:

```ts
export async function chatVL(
  messages: VkenChatMessage[],
  schema?: ZodSchema,
  options?: VkenChatOptions,
): Promise<VkenChatResult>;

export async function chatCoder(
  messages: VkenChatMessage[],
  schema?: ZodSchema,
  options?: VkenChatOptions,
): Promise<VkenChatResult>;

export function providerInfo(opts?: VkenChatOptions): {
  id: VkenProviderId;
  vlModel: string;
  coderModel: string;
  source: 'env' | 'header';
};
```

`VkenChatResult` is `{ parsed: unknown; raw: string; usage: { inputTokens, outputTokens, latencyMs }; providerId, modelId }`. The
client validates against `schema` if provided; on failure it retries
with a stricter system prompt (one retry), then **falls through to
the next provider in the chain** (per §4.5).

### 4.4 Add `zod` to daemon deps

```bash
pnpm --filter @open-design/daemon add zod
```

Confirm `zod` appears in [apps/daemon/package.json](../../apps/daemon/package.json)
dependencies.

### 4.5 Provider chain resolution (`select-provider.ts`)

```
Default chain (no header):  primary → fallback1 → fallback2
  primary    = $VKEN_LLM_PROVIDER (default 'openrouter')
  fallback1  = $VKEN_LLM_FALLBACK1 (default 'gemini' if GOOGLE_API_KEY set, else 'cassette')
  fallback2  = 'cassette'

Per-request override (header `x-vken-byok` present):
  use only the header-specified provider; no chain (judges control their own destiny).
```

A provider is **demoted to the next in chain** when:

- HTTP 429 (rate limit).
- HTTP 5xx after one retry.
- `VkenSchemaError` after one retry.
- `VkenTimeoutError` (per-call timeout = 60s).

Cassette **never throws** — it always returns the recorded transcript
for that sample/task pair. A cockpit badge ("Replaying recorded
run") makes this transparent.

### 4.6 OpenRouter provider notes

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`.
- Headers: `Authorization: Bearer ${VKEN_OPENROUTER_KEY}`,
  `HTTP-Referer: https://huggingface.co/spaces/${HF_SPACE_ID}` (some
  free models gate on referer), `X-Title: VKEN Design Engine`.
- VL: pass image as `{type: 'image_url', image_url: {url: 'data:image/png;base64,...'}}`.
- Structured output: include
  `response_format: { type: 'json_object' }` *and* a system prompt
  ending in "Respond with a single JSON object only. No prose."
  (OR free models honor neither alone reliably; together they do.)
- Token usage comes back in `.usage` — capture into `token-account`.

### 4.7 Cassette format (`infra/space/cassettes/<sample>.json`)

```jsonc
{
  "schemaVersion": 1,
  "sampleId": "landing-generic",
  "calls": [
    {
      "task": "vl",            // 'vl' | 'coder'
      "promptHash": "sha256:…", // for re-record validation
      "response": {…parsed…},
      "usage": {"inputTokens": 1234, "outputTokens": 456}
    },
    …
  ]
}
```

The cassette provider matches calls by `(task, promptHash)`. If no
match, it returns the first unused call of the matching `task` and
logs a warning — graceful degradation rather than throwing.

To **record** a cassette: run a real OpenRouter run and pipe its
calls through a thin wrapper (`scripts/vken-record-cassette.ts`,
created in Block 5). Day 2's first cassettes can be hand-authored
from the Block 2 smoke output.

### 4.8 Token accounting (`token-account.ts`)

A single function `recordUsage(db, runId, providerId, modelId, usage,
task)` that writes to the existing `vllm_input_tokens` /
`vllm_output_tokens` columns on `vken_runs` (additive). Renaming
those columns is V2 churn — *do not rename now.*

### 4.9 Smoke scripts

`infra/space/smoke-vl.mjs`:

```js
// Loads dist/, opens db, picks first capture from a run, sends to chatVL,
// asserts the parsed object has `designQuality: number` in [0,1] and
// `findings: array`. Prints VL_SMOKE_OK on success.
```

`infra/space/smoke-coder.mjs` is identical but calls `chatCoder` with
a workspace-index payload and asserts `directions: array` length 2.

### 4.10 Acceptance criteria

- `pnpm --filter @open-design/daemon typecheck` passes.
- `pnpm --filter @open-design/daemon test` passes (existing tests
  unchanged; one new test `vken-llm-client.test.ts` covers chain
  fallback with mocked providers).
- `node infra/space/smoke-vl.mjs landing-generic` prints
  `VL_SMOKE_OK`.
- `node infra/space/smoke-coder.mjs landing-generic` prints
  `CODER_SMOKE_OK`.
- `VKEN_LLM_PROVIDER=cassette node infra/space/smoke-vl.mjs
  landing-generic` prints `VL_SMOKE_OK` (proves cassette mode works
  offline).

### 4.11 Verification

```bash
pnpm --filter @open-design/daemon typecheck
pnpm --filter @open-design/daemon test
node infra/space/smoke-vl.mjs landing-generic
node infra/space/smoke-coder.mjs landing-generic
VKEN_LLM_PROVIDER=cassette node infra/space/smoke-vl.mjs landing-generic
echo "BLOCK_1_OK"
```

### 4.12 Commit + gate

```bash
git add apps/daemon/src/vken/llm apps/daemon/package.json infra/space/cassettes infra/space/smoke-*.mjs apps/daemon/tests/vken-llm-client.test.ts
git commit -m "feat(vken): provider-agnostic LLM client with OpenRouter primary + cassette fallback"
```

**Gate:** §2.3 row 1 now prints `OK`. Either OpenRouter or cassette
returns parseable JSON for both VL and Coder tasks.

---

## 5. Block 2 — Critique + directions

**Time:** 75 min.

### 5.1 Prerequisites

- §2.3 row 1 = `OK`.

### 5.2 Deliverables

- [apps/daemon/src/vken/critique.ts](../../apps/daemon/src/vken/critique.ts) —
  one exported function `critiqueCapture({captureId, db, opts})` that
  loads the screenshot + ARIA + box models, calls `chatVL` with the
  zod-validated `CritiqueSchema`, returns
  `{ designQuality: number, findings: Finding[] }`, and persists each
  finding into `vken_findings` (table already migrated).
- [apps/daemon/src/vken/directions.ts](../../apps/daemon/src/vken/directions.ts) —
  `proposeDirections({runId, db, opts})` that takes the run's
  workspace index + critique findings + **kb.retrieve() top-3 (Block
  5 fills this in; until then a stub returning `[]` is fine)** and
  returns 2 validated `VkenDirection` objects, persisting to
  `vken_directions`.
- [apps/daemon/src/vken/run-pipeline.ts](../../apps/daemon/src/vken/run-pipeline.ts) —
  extend `executeDeterministicVkenRun`: after capture, call
  `critique` per desktop capture, average `designQuality` into score,
  emit `vken:score (when:'initial')` with the *real* number, then call
  `directions` and emit `vken:direction` events plus a final
  `{done:true}`.
- [apps/web/src/components/vken/DirectionPicker.tsx](../../apps/web/src/components/vken/DirectionPicker.tsx) —
  card grid with mood, summary, change list, evidence count chip,
  CTA button. POSTs `/api/vken/runs/:id/direction` with
  `{ directionId }`.
- [apps/web/src/components/vken/Cockpit.tsx](../../apps/web/src/components/vken/Cockpit.tsx) —
  insert `<DirectionPicker>` between the workspace index summary and
  the BeforeAfter pane. Render only when `state.directions.length > 0`
  AND `state.directionPicked == null`.
- [apps/web/src/components/vken/useVkenSse.ts](../../apps/web/src/components/vken/useVkenSse.ts) —
  reduce `vken:direction` events into `state.directions[]`; reduce
  `vken:apply (directionPicked)` into `state.directionPicked`.
- [apps/daemon/src/server.ts](../../apps/daemon/src/server.ts) —
  add `POST /api/vken/runs/:id/direction` handler that records the
  pick, kicks off the propose phase (Block 3 supplies the body; for
  now this handler just stores the choice and emits a
  `vken:direction:picked` event).

### 5.3 Wire `score.ts` to real critique

Replace the 0.5 stub in
[apps/daemon/src/vken/score.ts](../../apps/daemon/src/vken/score.ts):

```ts
export function scoreVkenIndex(index: VkenWorkspaceIndex, opts?: { designQuality?: number }): VkenScorePayload {
  const designQuality = clamp01(opts?.designQuality ?? 0.5);
  // …existing math, designQuality fed through instead of computed
}
```

`run-pipeline.ts` averages critique results across desktop captures
and passes the average to `scoreVkenIndex`.

### 5.4 Critique prompt skeleton (system message)

Keep it small — free-tier context windows matter:

```
You are a senior product designer auditing a single screenshot of a
React + Tailwind app. Output ONE JSON object only:

{
  "designQuality": number,           // 0..1, calibrated to industry
  "findings": [
    { "dimension": "hierarchy"|"contrast"|"spacing"|"typography"|"alignment"|"color"|"motion"|"a11y",
      "severity": "P0"|"P1"|"P2"|"P3",
      "description": "<one sentence, imperative>",
      "regionBox": { "x": int, "y": int, "w": int, "h": int }
    }
  ]
}

Rules:
- 5-15 findings.
- Use the ARIA snapshot to ground claims in real elements.
- Use box-models JSON for spacing/contrast math; do not hallucinate
  pixel measurements.
- Respond with JSON only. No prose.
```

### 5.5 Acceptance criteria

- `pnpm typecheck` passes.
- `pnpm test` passes (one new test `vken-critique.test.ts` mocks
  `chatVL` and asserts persistence + emission).
- A run on `landing-generic`:
  - `vken:score` carries a `designQuality` between 0 and 1 that is
    **not** 0.5 (proves the stub was replaced).
  - 2 `vken:direction` events stream in within 30s on a warm OR
    connection.
- The cockpit displays both direction cards. Clicking one removes
  the picker.

### 5.6 Verification

```bash
pnpm typecheck && pnpm test
node infra/space/smoke.mjs sample landing-generic 2>&1 | tee /tmp/vken-block2.log
grep -E "vken:score.*designQuality" /tmp/vken-block2.log
grep -c "vken:direction" /tmp/vken-block2.log   # expect ≥ 2
echo "BLOCK_2_OK"
```

(`infra/space/smoke.mjs` needs a small extension here: when invoked
without `--no-llm` it asserts at least 2 direction events. Add that
assertion in this block.)

### 5.7 Commit + gate

```bash
git add apps/daemon/src/vken/critique.ts apps/daemon/src/vken/directions.ts apps/daemon/src/vken/run-pipeline.ts apps/daemon/src/vken/score.ts apps/daemon/src/server.ts apps/web/src/components/vken/DirectionPicker.tsx apps/web/src/components/vken/Cockpit.tsx apps/web/src/components/vken/useVkenSse.ts apps/daemon/tests/vken-critique.test.ts infra/space/smoke.mjs
git commit -m "feat(vken): VL critique and Coder directions wired into pipeline"
```

**Gate:** §2.3 row 2 = `OK`. Real `designQuality` flows into score;
two directions render in cockpit.

---

## 6. Block 3 — Propose + apply (virtual FS)

**Time:** 75 min.

### 6.1 Prerequisites

- §2.3 row 2 = `OK`.

### 6.2 Deliverables

- [apps/daemon/src/vken/propose.ts](../../apps/daemon/src/vken/propose.ts) —
  Coder pass that takes the picked direction + relevant capture
  excerpts + (Block 5 stub) KB few-shot, returns a ranked
  `VkenPatch[]`. **Pre-validates each `search` string by
  `await fileContent.includes(search)` against the workspace before
  emitting the patch.** Patches whose `search` is not literally
  present are dropped with a logged reason — this is the single
  biggest anti-hallucination gate.
- [apps/daemon/src/vken/apply.ts](../../apps/daemon/src/vken/apply.ts) —
  virtual FS map, in-memory `Map<filePath, content>`. Functions:
  `initVirtualFs(workspacePath)`, `applyPatchVirtual(patchId)`,
  `revertPatchVirtual(patchId)`, `materializeTo(dir)` (writes the
  current virtual FS contents under `dir/`),
  `scrubTo(checkpoint)` (resets virtual FS to a snapshot).
- [apps/daemon/src/vken/preview.ts](../../apps/daemon/src/vken/preview.ts) —
  builds preview URLs by writing materialized FS to a per-checkpoint
  dir under `<dataDir>/vken/runs/<id>/preview/<checkpoint>/`,
  spawning `vite preview --port <free>` against it (ports allocated
  via the same `getFreePort` helper as the dev runner). Returns
  `{ url, kill() }`.
- [apps/daemon/src/server.ts](../../apps/daemon/src/server.ts) — new
  routes:
  - `POST /api/vken/runs/:id/approve` — body
    `{ patchIds: string[] }`. For each: `applyPatchVirtual` →
    re-score (design quality recomputed via a fresh critique on the
    materialized desktop capture) → emit `vken:apply`,
    `vken:score (when:'scrub')`.
  - `POST /api/vken/runs/:id/skip` — body
    `{ patchIds: string[] }`. Mark patches `skipped`; no FS change.
  - `POST /api/vken/runs/:id/scrub` — body
    `{ checkpoint: 'initial' | { patchId } }`. `scrubTo` + recompute
    score.
- [apps/web/src/components/vken/PatchCard.tsx](../../apps/web/src/components/vken/PatchCard.tsx) —
  renders one patch (search/replace preview, severity chip, evidence
  count, approve/skip buttons).
- [apps/web/src/components/vken/PatchList.tsx](../../apps/web/src/components/vken/PatchList.tsx) —
  ranked list of `PatchCard`s; bulk-approve top-N button; empty
  state when none yet.
- [apps/web/src/components/vken/BeforeAfter.tsx](../../apps/web/src/components/vken/BeforeAfter.tsx) —
  upgrade: AFTER iframe now points at the preview URL emitted by
  `vken:apply`. Synced scroll between BEFORE and AFTER iframes via
  postMessage.
- [apps/web/src/components/vken/Timeline.tsx](../../apps/web/src/components/vken/Timeline.tsx) —
  upgrade: clickable checkpoints invoke `/scrub` and visually
  highlight the active checkpoint.

### 6.3 Critical detail: line-ending normalization

Patches generated against captured files often fail to match because
of CRLF/LF differences. Before the `includes` check **and** before
applying, normalize both sides to `\n` only:

```ts
const norm = (s: string) => s.replace(/\r\n/g, '\n');
```

Apply the patch result back with the *original* file's line ending
preserved (detect from the first newline). This is one line of code
that prevents 30% of patch-application failures in the wild.

### 6.4 Acceptance criteria

- A run on `landing-generic`:
  - At least 5 patches emitted with valid `search` strings.
  - Approving any patch triggers a `vken:apply` event within 1s.
  - Approving any patch updates the AFTER iframe within 2s.
  - Score gauge increments after apply (non-zero `scoreDelta`).
  - Scrub-to-initial reverts AFTER iframe within 1s and resets score.
- `pnpm typecheck && pnpm test` green.

### 6.5 Verification

```bash
pnpm typecheck && pnpm test
node infra/space/smoke.mjs sample landing-generic 2>&1 | tee /tmp/vken-block3.log
grep -c "vken:patch" /tmp/vken-block3.log    # expect ≥ 5
# Manual: open http://localhost:<webPort>/vken/run/<id>, approve top patch,
# confirm AFTER iframe diverges within 2s.
echo "BLOCK_3_OK"
```

### 6.6 Commit + gate

```bash
git add apps/daemon/src/vken/propose.ts apps/daemon/src/vken/apply.ts apps/daemon/src/vken/preview.ts apps/daemon/src/server.ts apps/web/src/components/vken/
git commit -m "feat(vken): patch proposal + virtual-FS apply + preview scrub"
```

**Gate:** §2.3 row 3 = `OK`.

---

## 7. Block 4 — Validate + finalize + real PR

**Time:** 75 min.

### 7.1 Prerequisites

- §2.3 row 3 = `OK`.
- `$VKEN_GITHUB_BOT_TOKEN` set with `Contents: write` and
  `Pull requests: write` for `vken-bot/*` (or your bot account).
- Verify with:
  ```bash
  curl -sf -H "Authorization: Bearer $VKEN_GITHUB_BOT_TOKEN" https://api.github.com/user | jq -r '.login'
  ```

### 7.2 Deliverables

- [apps/daemon/src/vken/validate.ts](../../apps/daemon/src/vken/validate.ts) —
  pipeline that for the current materialized FS runs:
  1. `tsc --noEmit` (sample's local TS — `npx tsc --noEmit -p .`).
  2. `npm run build` (sample's Vite build).
  3. `vite preview` + Playwright recapture per route × desktop
     viewport.
  4. `axe-core` injected via `@axe-core/playwright` on each
     recaptured page; collect violations.
  5. Pixel diff vs. initial capture (uses the existing
     `algorithms/pixel-diff.ts`).
  6. Console-error scan from recapture.
  Each step emits `vken:validate { stage, ok, details }`. Returns an
  aggregate `{ ok: boolean, byStage: Record<stage, result> }`.
- [apps/daemon/src/vken/pr.ts](../../apps/daemon/src/vken/pr.ts) —
  Octokit fork-per-run flow:
  1. Ensure `vken-bot/<sampleId>-<runId>` exists (create from a
     template repo or by initializing a bare repo with the
     materialized FS).
  2. Push the materialized FS to a branch
     `vken/run-<runId>` (force-push allowed; this is a bot fork).
  3. Open a PR against the fork's `main` (which holds the BEFORE
     state) with the body template in §7.3.
  4. Idempotent: if a PR for `<runId>` exists, return its URL
     instead of opening a duplicate.
- [apps/daemon/src/vken/bundle.ts](../../apps/daemon/src/vken/bundle.ts) —
  produces a `bundle.zip` containing the materialized FS + the
  scorecard JSON + the patch transcript. Used as fallback when PR
  creation fails (per escalation §10.2 #4 of the original plan).
- [apps/daemon/src/server.ts](../../apps/daemon/src/server.ts) — add:
  - `POST /api/vken/runs/:id/finalize` — orchestrates validate → pr
    (or bundle on PR failure). Returns `VkenFinalizeResponse`.
  - `GET /api/vken/runs/:id/bundle.zip` — streams the bundle.
- [apps/web/src/components/vken/FinalizeButton.tsx](../../apps/web/src/components/vken/FinalizeButton.tsx) —
  shows per-stage progress chips, displays final PR URL or bundle
  link.

### 7.3 PR body template

```
## VKEN Run <runId>

**Sample:** <sampleId>
**Score:** <before> → <after> (Δ <delta>)
**Direction picked:** <directionName>

### Patches applied
- [P1] <patchRationale> (`<filePath>`)
- …

### Validation
- ✅ tsc --noEmit
- ✅ npm run build
- ✅ axe-core (0 violations)
- ✅ pixel diff (visual gap < threshold)

### Provider
Inference served by **<providerId>** (model `<modelId>`).

### Reproducibility
Run transcript and bundle: <bundleUrl>
Cockpit replay: <replayUrl>

🤖 Generated by VKEN Design Engine — <repoUrl>
```

### 7.4 Acceptance criteria

- A finalize call on `landing-generic`:
  - Streams `vken:validate` events for all 6 stages.
  - Returns a real PR URL (returns 200; clicking it loads the PR
    page).
  - Idempotent: a second finalize for the same runId returns the
    same URL.
- If PR creation fails (test by temporarily setting an invalid
  token), `bundleUrl` is non-null and the `.zip` downloads
  successfully.

### 7.5 Verification

```bash
pnpm typecheck && pnpm test
RUN_ID=$(curl -sX POST http://localhost:<daemonPort>/api/vken/runs \
  -H 'Content-Type: application/json' \
  -d '{"intake":{"kind":"sample","sampleId":"landing-generic"}}' \
  | jq -r '.runId')
# Wait for direction picking + auto-approve top patch (script needed; or do it via cockpit)
# Then:
PR_URL=$(curl -sX POST http://localhost:<daemonPort>/api/vken/runs/$RUN_ID/finalize | jq -r '.prUrl')
curl -sf "$PR_URL" >/dev/null && echo "PR_REACHABLE_OK"
# Idempotency:
PR_URL2=$(curl -sX POST http://localhost:<daemonPort>/api/vken/runs/$RUN_ID/finalize | jq -r '.prUrl')
test "$PR_URL" = "$PR_URL2" && echo "FINALIZE_IDEMPOTENT_OK"
echo "BLOCK_4_OK"
```

### 7.6 Commit + gate

```bash
git add apps/daemon/src/vken/validate.ts apps/daemon/src/vken/pr.ts apps/daemon/src/vken/bundle.ts apps/daemon/src/server.ts apps/web/src/components/vken/FinalizeButton.tsx
git commit -m "feat(vken): validate pipeline + Octokit PR finalize + bundle fallback"
```

**Gate:** §2.3 row 4 = `OK`.

---

## 8. Block 5 — Self-learning loop (memory tiers + KB)

**Time:** 90 min · **The differentiator. Do not skip the bench gate.**

### 8.1 Prerequisites

- §2.3 row 4 = `OK`.
- `$VKEN_KB_SIGNING_KEY` set (`openssl rand -hex 32`). Save to a
  password manager too.

### 8.2 Deliverables

- [apps/daemon/src/vken/memory.ts](../../apps/daemon/src/vken/memory.ts) —
  Tier 1 (run) + Tier 2 (repo) lifecycle. Functions:
  - `loadRunMemory(db, runId)` / `saveRunMemory(db, runId, memory)`.
  - `loadRepoMemory(db, repoHash)` / `saveRepoMemory(db, repoHash,
    memory)` (refreshes TTL on read).
  - `recordEvent(memory, event)` — pure reducer. Handles every event
    type per §5.1 of the learning-loop doc.
  - `promoteRunToRepo({db, runId, repoUrl})` — invoked at finalize
    when `enableRepoMemory` is true.
- [apps/daemon/src/vken/kb.ts](../../apps/daemon/src/vken/kb.ts) —
  Tier 3 ops:
  - `kb.retrieve({findings, framework, topK, db})` — symbolic
    ranking per learning-loop doc §4.
  - `kb.stage({db, runId, ruleId, delta})` — increments staged
    counters but does **not** commit.
  - `kb.commit({db, runId})` — applies all staged updates, recomputes
    EWMA, re-signs rule, appends to `kb/learned.jsonl`.
  - `kb.unstage({db, runId, ruleIds})` — invoked on validate
    failure.
  - `kb.demote({db, ruleId, reason})` — quarantines.
  - `kb.loadJsonl(path)` — verifies HMAC on every line; rejects
    invalid signatures with a logged warning (does not crash).
- [apps/daemon/src/vken/kb-signature.ts](../../apps/daemon/src/vken/kb-signature.ts) —
  HMAC-SHA256 helpers. Uses `node:crypto`. Signs the canonical
  string `id|finding_type|rule_text|created_at`.
- [apps/daemon/src/vken/run-pipeline.ts](../../apps/daemon/src/vken/run-pipeline.ts) —
  wire memory hooks at every event emission point per §5.1 of the
  learning-loop doc.
- [apps/daemon/src/server.ts](../../apps/daemon/src/server.ts) —
  - In `finalize` handler, after validate passes, call `kb.commit`.
    On validate fail, call `kb.unstage` for the run's staged rules.
  - Add `GET /api/vken/kb` — paginated rule list with stats.
  - Add `GET /api/vken/kb/:ruleId` — rule detail + examples +
    evidence runs.
  - Emit `vken:learn` events on every commit.
- [apps/web/src/components/vken/LearnedToast.tsx](../../apps/web/src/components/vken/LearnedToast.tsx) —
  bottom-right slide-in on every `vken:learn`. Auto-dismiss 6s.
- [apps/web/src/components/vken/KBPanel.tsx](../../apps/web/src/components/vken/KBPanel.tsx) —
  full page at `/vken/kb`. Filters, sorts, evidence drill-down.
- [apps/web/src/components/vken/EvidenceChip.tsx](../../apps/web/src/components/vken/EvidenceChip.tsx) —
  small "evidence: 3 runs" pill on direction + patch cards. Click
  expands inline.
- [scripts/vken-kb-bench.ts](../../scripts/vken-kb-bench.ts) —
  the promotion gate enforcer. Replays the 3 sample cassettes against
  a candidate KB. Used both by the Tier-2→Tier-3 promotion code path
  and as a CLI for manual checks.
- [scripts/vken-kb-seed.ts](../../scripts/vken-kb-seed.ts) — runs the
  engine N times across the 3 samples, harvests rules, writes the
  signed `kb/seed.jsonl`. Target: 30 seed entries (down from 50 to
  fit budget).
- [kb/seed.jsonl](../../kb/seed.jsonl) — 30 signed lines.

### 8.3 Promotion gate enforcement (do not bypass)

`kb.tryPromoteToTier3(candidateRule)` must return `false` unless
**all four** are true:

1. **Multi-repo**: ≥ 2 distinct `repo_hash` in `evidence_runs`.
2. **Bench non-regression**: `vken-kb-bench` returns aggregate
   delta ≥ 0 across the 3 samples and no individual sample regressed
   by > 1.0.
3. **Self-critique**: a single Coder call rates the rule 4 or 5 on
   the rubric below.
4. **Signature**: HMAC verification passes on the rule's canonical
   string.

The self-critique system prompt (≤ 300 tokens):

```
You are auditing a candidate design rule for inclusion in a global KB.
Rate it 1–5 on each dimension. Output JSON only.

{ "clarity": 1..5, "generality": 1..5, "antiHallucination": 1..5, "overall": 1..5, "reason": "<one sentence>" }

Rule: <rule_text>
Examples:
- search: "<...>"  replace: "<...>"
…
```

Threshold: `overall >= 4`.

### 8.4 KB seeding (`scripts/vken-kb-seed.ts`)

To produce 30 high-quality seeds without burning OpenRouter budget:

1. Run the full pipeline on each sample 10 times with `temperature:
   0.3` to diversify proposals.
2. Auto-stage every approved+validated patch.
3. After all 30 runs, run the same promotion gate as above (forcing
   multi-repo to be satisfied across the 3 samples even though
   they're not "different repos" semantically — this is a documented
   exception: see §8.5).
4. Sign and write to `kb/seed.jsonl`.

### 8.5 Documented exception: 3 samples count as 3 repos for seeding

Rationale: without this, the seed file would be empty (the 3 samples
are the only inputs available pre-launch). The exception is gated by
`process.env.VKEN_KB_SEED_MODE === 'true'`, which **only the seed
script sets**. Live runs cannot trigger the exception.

### 8.6 Acceptance criteria

- `pnpm typecheck && pnpm test` (one new test
  `vken-kb.test.ts` covering retrieve, stage, commit, unstage,
  demote, signature verify).
- `kb/seed.jsonl` exists, has ≥ 25 lines, every line passes HMAC
  verification.
- A live run on `landing-generic`:
  - `vken:learn` events fire for at least one rule.
  - The cockpit shows a `LearnedToast`.
  - `vken_kb_rules` row count increases by ≥ 1 over the run.
- `node scripts/vken-kb-bench.ts seed-only` and
  `node scripts/vken-kb-bench.ts seed+learned` both run to
  completion and print numeric deltas.
- A second run on the same sample uses retrieved rules: check
  `vken:patch` event payloads include populated `evidenceKbIds`.

### 8.7 Verification

```bash
test -n "$VKEN_KB_SIGNING_KEY" || (echo "MISSING KEY"; exit 1)
pnpm typecheck && pnpm test
node scripts/vken-kb-seed.ts            # 5–10 min; uses cassette by default to avoid OR cost
test $(wc -l < kb/seed.jsonl) -ge 25 && echo "SEED_OK"
node scripts/vken-kb-bench.ts seed-only        | tee /tmp/bench-seed.log
node scripts/vken-kb-bench.ts seed+learned     | tee /tmp/bench-learned.log
echo "BLOCK_5_OK"
```

### 8.8 Commit + gate

```bash
git add apps/daemon/src/vken/memory.ts apps/daemon/src/vken/kb.ts apps/daemon/src/vken/kb-signature.ts apps/daemon/src/vken/run-pipeline.ts apps/daemon/src/server.ts apps/web/src/components/vken/LearnedToast.tsx apps/web/src/components/vken/KBPanel.tsx apps/web/src/components/vken/EvidenceChip.tsx scripts/vken-kb-bench.ts scripts/vken-kb-seed.ts kb/seed.jsonl apps/daemon/tests/vken-kb.test.ts
git commit -m "feat(vken): self-learning loop with HMAC-signed KB and bench-gated promotion"
```

**Gate:** §2.3 row 5 = `OK`.

---

## 9. Block 6 — URL intake, BYOK panel, leaderboard, polish

**Time:** 105 min.

### 9.1 Prerequisites

- §2.3 row 5 = `OK`.

### 9.2 Deliverables

#### URL intake (closes Day-1 gap G3)

- [apps/daemon/src/vken/intake.ts](../../apps/daemon/src/vken/intake.ts) —
  replace the throwing stub with a real `git clone --depth 1
  --single-branch` into `<dataDir>/vken/clones/<runId>/`. Validate
  via existing `detectSupportedWorkspace`. Reject non-Vite+React+
  Tailwind with the friendly `VKEN_FRAMEWORK_UNSUPPORTED` path.
- **Security clamps** (non-negotiable):
  - URL must match
    `^https://(github\.com|gitlab\.com|codeberg\.org)/[\w.-]+/[\w.-]+(\.git)?$`.
  - `git clone` runs with `GIT_TERMINAL_PROMPT=0`
    `GIT_ASKPASS=/bin/false` so it cannot wait for credentials.
  - Repo size cap: `--depth 1` plus a 50 MB post-clone size check.
    Larger → error `VKEN_REPO_TOO_LARGE`.
  - Filesystem isolation: clone path is the only writable dir for
    that run.

#### BYOK panel

- [apps/web/src/components/vken/ByokPanel.tsx](../../apps/web/src/components/vken/ByokPanel.tsx) —
  drawer per zero-cost-pivot doc §5. Provider dropdown, key field,
  model overrides, "Test connection" button, "Remember in this
  browser only" checkbox. Stores under `localStorage['vken.byok.v1']`
  only when opt-in.
- [apps/web/src/state/byok.ts](../../apps/web/src/state/byok.ts) —
  reads/writes the local config; produces the
  base64-JSON `x-vken-byok` header for fetch calls.
- [apps/web/src/providers/registry.ts](../../apps/web/src/providers/registry.ts) —
  every `/api/vken/*` fetch call attaches the header if BYOK is
  active.
- [apps/daemon/src/server.ts](../../apps/daemon/src/server.ts) —
  middleware decodes the header, hangs it on `req.byok`, scrubs it
  from logs. The middleware **must reject any header > 4 KB** to
  prevent payload abuse.
- [apps/daemon/src/vken/llm/select-provider.ts](../../apps/daemon/src/vken/llm/select-provider.ts) —
  if `req.byok` is present, use it for this request only; bypass
  the chain.
- [apps/daemon/src/server.ts](../../apps/daemon/src/server.ts) —
  add `POST /api/vken/llm/test` that performs a 1-token call with
  the active config and returns `{ok, provider, model, latencyMs}`.

#### Leaderboard polish

- [apps/web/src/components/vken/Leaderboard.tsx](../../apps/web/src/components/vken/Leaderboard.tsx) —
  rows from `/api/vken/leaderboard` (route already exists). Poll
  every 60s. Sortable by sample, delta, attempts. Click row →
  `/vken/run/<bestRunId>` deep link.

#### Polish closures

- **Hook (Day-1 gap G6):** [apps/web/src/components/vken/Hook.tsx](../../apps/web/src/components/vken/Hook.tsx)
  replays a small recorded score-climb (hard-coded events array)
  immediately on landing — no real run needed. Adds a primary CTA
  "Try `landing-generic`" that calls `startSample()`.
- **Capture cache (Day-1 gap G7):** in
  [apps/daemon/src/server.ts](../../apps/daemon/src/server.ts)
  `/api/vken/captures/:id/screenshot.png` handler, set
  `Cache-Control: public, max-age=31536000, immutable`. UUIDs are
  immutable so this is safe.
- **Empty + error states:** every cockpit pane handles `loading`,
  `error`, `empty` explicitly. Provider misconfigured banner. OR
  rate-limit banner with auto-dismiss when fallback succeeds.
- **Provider badge:** cockpit header shows the active provider,
  e.g. "Running on Qwen via OpenRouter". Reads from a new
  `/api/vken/provider/info` route that returns `providerInfo()`.
- **Cassette banner:** when the cassette provider is the one
  answering, the cockpit footer shows "Replaying recorded run — set
  `VKEN_LLM_PROVIDER` to go live".
- **Mobile layout:** Cockpit grid collapses to single column under
  768px. PatchList becomes a bottom sheet on mobile. (Not just for
  niceness — **it's a differentiator. Most demos are desktop only.**)
- **Focus-visible everywhere.** All interactive elements need
  `focus-visible:ring`. Run axe-core on the cockpit itself; fix any
  P0/P1.
- **Keyboard shortcuts:** `j/k` navigate patches, `a` approve, `s`
  skip, `?` show shortcut help. Demo-friendly.

### 9.3 Acceptance criteria

- `pnpm typecheck && pnpm test` green.
- Pasting a known-good public Vite repo URL (e.g.
  `https://github.com/<known-vite-react-tailwind-app>`) runs to
  completion.
- Pasting a non-Vite repo (e.g. a Next.js one) shows the friendly
  error inline within 5s.
- Pasting a non-allowlisted URL (e.g. raw http URL) is rejected
  before clone.
- BYOK drawer: pasting a wrong key → "Test connection" returns the
  provider error within 10s. Pasting a correct key → shows latency.
- BYOK keys never appear in `git grep`-able logs (`pnpm tools-dev
  logs --json | grep -i 'sk-\|Bearer'` returns no key material).
- Leaderboard renders rows for the 3 samples after 1 run each.
- Cockpit on a 375px viewport stacks vertically without overflow.
- axe-core on the cockpit reports zero P0 / P1 violations.

### 9.4 Verification

```bash
pnpm typecheck && pnpm test
# Manual:
# 1. Open cockpit, click gear, paste a wrong OpenAI key, hit Test → expect error.
# 2. Replace with valid key, hit Test → expect ok with latency.
# 3. Resize browser to 375px wide, scroll cockpit → no horizontal scroll.
# 4. Tab through cockpit → focus rings visible everywhere.
# 5. Paste a Next.js repo URL → friendly error within 5s.
# 6. Run all 3 samples → leaderboard shows 3 rows.
echo "BLOCK_6_OK"
```

### 9.5 Commit + gate

```bash
git add apps/daemon/src/vken/intake.ts apps/web/src/components/vken/ByokPanel.tsx apps/web/src/components/vken/Leaderboard.tsx apps/web/src/components/vken/Hook.tsx apps/daemon/src/server.ts apps/web/src/components/vken/ apps/web/src/state/byok.ts apps/web/src/providers/registry.ts
git commit -m "feat(vken): URL intake + BYOK panel + leaderboard + cockpit polish"
```

**Gate:** §2.3 row 6 = `OK`.

---

## 10. Block 7 — Hugging Face Space deployment

**Time:** 90 min.

### 10.1 Prerequisites

- §2.3 row 6 = `OK`.
- HF Space created (Day 0 task), with secret slots ready.
- `git subtree` available (standard with git ≥ 2.x).

### 10.2 Deliverables

- [infra/space/Dockerfile](../../infra/space/Dockerfile):

  ```dockerfile
  FROM mcr.microsoft.com/playwright:v1.49.0-jammy AS base
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PNPM_HOME=/pnpm
  ENV PATH=$PNPM_HOME:$PATH
  RUN corepack enable

  FROM base AS build
  COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
  COPY apps ./apps
  COPY packages ./packages
  COPY tools ./tools
  COPY samples ./samples
  COPY scripts ./scripts
  COPY kb ./kb
  RUN pnpm install --frozen-lockfile
  RUN pnpm build
  RUN node samples/install-all.mjs

  FROM base AS runtime
  COPY --from=build /app /app
  RUN chmod +x infra/space/entrypoint.sh
  EXPOSE 7860
  ENV PORT=7860
  ENV OD_DATA_DIR=/data
  ENTRYPOINT ["infra/space/entrypoint.sh"]
  ```

- [infra/space/entrypoint.sh](../../infra/space/entrypoint.sh):

  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  mkdir -p "$OD_DATA_DIR"
  : "${VKEN_LLM_PROVIDER:=openrouter}"
  echo "VKEN starting on :${PORT} provider=${VKEN_LLM_PROVIDER}"
  exec node apps/daemon/dist/server.js
  ```

- [infra/space/README.md](../../infra/space/README.md) —
  list of required Space secrets:
  - `VKEN_LLM_PROVIDER` (default `openrouter`)
  - `VKEN_OPENROUTER_KEY`
  - `VKEN_OR_VL_MODEL` (default `qwen/qwen2.5-vl-72b-instruct:free`)
  - `VKEN_OR_CODER_MODEL` (default `qwen/qwen-2.5-coder-32b-instruct:free`)
  - `VKEN_LLM_FALLBACK1` (`gemini` if you have a Gemini key, else `cassette`)
  - `GOOGLE_API_KEY` (only if `VKEN_LLM_FALLBACK1=gemini`)
  - `VKEN_GITHUB_BOT_TOKEN`
  - `VKEN_KB_SIGNING_KEY`
  - `HF_SPACE_ID` (used as Referer header for OpenRouter)

- Sync workflow: [.github/workflows/space-sync.yml](../../.github/workflows/space-sync.yml) —
  pushes the repo subtree to the HF Space remote on every commit to
  `vken/v1` and `main`. Skip if already configured.

### 10.3 Local validation (before pushing)

```bash
docker build -f infra/space/Dockerfile -t vken-space:dev .
docker run --rm -p 7860:7860 \
  -e VKEN_LLM_PROVIDER=cassette \
  -e VKEN_KB_SIGNING_KEY=$VKEN_KB_SIGNING_KEY \
  vken-space:dev &
sleep 8
curl -sf http://localhost:7860/api/vken/leaderboard | jq .
docker stop $(docker ps -q --filter ancestor=vken-space:dev)
```

Expected: 200 with a JSON body. (Cassette mode means no LLM calls
needed for this smoke.)

### 10.4 Push to HF + smoke

```bash
git remote add hf-space https://huggingface.co/spaces/<ns>/vken || true
git subtree push --prefix=. hf-space main
# Wait 5–10 min for Space build. Watch logs in HF UI.
# Then:
SPACE_URL=https://huggingface.co/spaces/<ns>/vken
curl -sf "$SPACE_URL/api/vken/leaderboard" | jq .
# Open browser, run landing-generic end-to-end. Real PR opens.
```

### 10.5 Acceptance criteria

- Docker image builds locally in < 12 min.
- Local container serves `/api/vken/leaderboard` (200) within 10s
  of start.
- Pushed Space builds within 15 min.
- Public Space URL renders the cockpit landing.
- Public Space runs `landing-generic` end-to-end and produces a
  real PR.
- Provider badge on the public Space says "Running on Qwen via
  OpenRouter" (or "Running on Gemini" if OR rate-limited).
- Cassette badge appears only when cassette provider answers.

### 10.6 Verification

```bash
docker build -f infra/space/Dockerfile -t vken-space:dev . | tail -20
docker run --rm -p 7860:7860 -e VKEN_LLM_PROVIDER=cassette -e VKEN_KB_SIGNING_KEY=test vken-space:dev &
sleep 10
curl -sfI http://localhost:7860/ | head -3
curl -sf http://localhost:7860/api/vken/leaderboard | jq .
docker stop $(docker ps -q --filter ancestor=vken-space:dev)
echo "BLOCK_7_OK"
```

### 10.7 Commit + push

```bash
git add infra/space/ .github/workflows/space-sync.yml
git commit -m "chore(vken): Space Dockerfile + entrypoint + sync workflow"
git subtree push --prefix=. hf-space main
```

**Gate:** §2.3 row 7 = `OK`. Public Space URL is live and runs end-to-end.

---

## 11. Block 8 — Final acceptance + AMD pivot readiness

**Time:** 30 min.

### 11.1 Prerequisites

- §2.3 row 7 = `OK`.

### 11.2 Deliverables

- [infra/amd-cloud/start-vllm.sh](../../infra/amd-cloud/start-vllm.sh) —
  the actual script that, when AMD credits arrive, starts both vLLM
  containers on the MI300X pod per design doc §17.2. Author it now
  even though we can't run it; it's part of "pivot in 10 minutes".
- [infra/amd-cloud/stop-vllm.sh](../../infra/amd-cloud/stop-vllm.sh) —
  graceful shutdown for credit conservation.
- [infra/amd-cloud/README.md](../../infra/amd-cloud/README.md) — the
  pivot checklist (lifted from the zero-cost-pivot doc §6, no
  duplication of code).
- [BRAND.md](../../BRAND.md) — one paragraph: "We keep `@open-design/*`
  workspace package names internally; user-facing brand is VKEN
  Design Engine. Production target is AMD MI300X + vLLM serving
  Qwen2.5-VL + Qwen3-Coder. V1 ships provider-agnostic and demos
  on free-tier OpenRouter Qwen with one-flag pivot to MI300X.
  BYOK supported out of the box."
- [README.md](../../README.md) — top-level rewrite. Tagline,
  Space URL, demo video link (placeholder until Day 3), GitHub repo
  link, "How it works" 4-bullet summary, "Try it" link to the Space,
  "Run it locally" 3-line snippet, "Bring your own key" 1-line
  pointer to the cockpit gear icon, "AMD pivot" 1-line pointer to
  `infra/amd-cloud/README.md`.

### 11.3 Final tag

```bash
git tag day-2-end
```

### 11.4 Verification

Run the **full** acceptance suite (§12). All rows must be green.

---

## 12. Final acceptance suite (the green-light check)

This is the canonical "is Day 2 done?" check. Every row must pass.

### 12.1 Build hygiene

```bash
pnpm install
pnpm typecheck                              # green
pnpm test                                    # green
pnpm build                                   # green
pnpm check:residual-js                       # green
```

### 12.2 Local end-to-end

```bash
pnpm tools-dev start web
sleep 5
# Run all 3 samples through the API:
for sample in landing-generic dashboard-cluttered ecommerce-basic; do
  RUN_ID=$(curl -sX POST http://localhost:<daemonPort>/api/vken/runs \
    -H 'Content-Type: application/json' \
    -d "{\"intake\":{\"kind\":\"sample\",\"sampleId\":\"$sample\"}}" | jq -r '.runId')
  echo "started $sample $RUN_ID"
  # …drive through direction picking + approve top patch + finalize
done
```

Expected: 3 real PRs, 3 leaderboard rows, ≥ 1 KB rule update.

### 12.3 Public Space end-to-end

Open the public Space URL in a fresh browser window (no cookies).
Run `landing-generic` from the landing CTA. Confirm:

- Score gauge climbs continuously.
- 2 directions appear within 30s.
- 5+ patches appear within 30s of picking a direction.
- AFTER iframe diverges from BEFORE within 2s of approve.
- Finalize button returns a real PR URL within 60s.
- Leaderboard updates.
- LearnedToast fires at least once.

### 12.4 BYOK proof

In the cockpit gear drawer:

1. Pick "BYOK → OpenAI", paste an `OPENAI_API_KEY`, set models to
   `gpt-4o-mini`. Hit Test → green within 10s.
2. Run `landing-generic`. Provider badge reads "Running on OpenAI
   gpt-4o-mini". The same engine produces patches and a real PR.
3. Run cassette mode (set provider in drawer to `cassette`). Same
   demo runs offline. Cassette banner appears.

### 12.5 Negative tests

- Paste a Next.js repo URL → friendly error in cockpit, no crash.
- Disable `VKEN_OPENROUTER_KEY` and run → fallback chain kicks in,
  cassette serves, banner appears, demo still completes.
- Approve a patch that breaks `tsc --noEmit` (force one in
  cassette) → validate fails, KB **un-stages** the rule (verify by
  re-querying `vken_kb_rules` accept_count).

### 12.6 Cross-browser smoke

- Chromium (latest): pass.
- Firefox (latest): SSE works, patches render.
- Safari (mac, if available): SSE works.

### 12.7 The single green-light command

Author [scripts/vken-day2-acceptance.ts](../../scripts/vken-day2-acceptance.ts)
that runs §12.1–12.5 in sequence and prints `DAY_2_ACCEPTANCE_OK` at
the end. This is the single command Day 3 morning must invoke before
recording any video.

```bash
node scripts/vken-day2-acceptance.ts
# Expected last line: DAY_2_ACCEPTANCE_OK
```

---

## 13. Demo runbook (judge's POV walkthrough)

Mirror the demo script in plan §6.2 but anchored to the V1 features:

1. **Land on Space URL.** Hook hero animates the score-climb. CTA
   "Try landing-generic" is the only thing to click.
2. **Click CTA.** SSE streams `vken:intake → vken:scan →
   vken:capture × 3 → vken:score`. Cockpit updates live.
3. **Two direction cards appear** with mood + summary + evidence
   chips. Pick "Token consolidation".
4. **Patch list streams in.** Each card shows search/replace + a
   severity chip + evidence chip.
5. **Approve top 3 patches.** AFTER iframe diverges within 2s. Score
   gauge climbs. LearnedToast fires.
6. **Click Finalize.** Per-stage validate chips light up. Final
   state: PR URL + bundle download.
7. **Click PR URL.** GitHub PR loads with the body template.
8. **Open `/vken/leaderboard`.** Three sample rows visible.
9. **Open `/vken/kb`.** Rules listed; click into one for evidence
   trail.
10. **Click gear → BYOK panel.** Show provider switching to "your
    own key" — judges can verify on their own infra.

Optional: open `infra/amd-cloud/README.md` and explain the 1-env-var
pivot to AMD MI300X.

---

## 14. Recovery playbook (when a gate fails)

### 14.1 Universal first response

- Re-read the verifier's actual error output (not the symptom).
- `pnpm install` (a stale workspace link is the most common cause).
- If a sample-related test fails: `pnpm od:samples` to refresh
  `node_modules` in the sample dirs.

### 14.2 Per-block table

| Symptom                                                   | Root cause                                          | Fix                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **B0** smoke fails: `ENOENT … vite/bin/vite.js`           | Sample `node_modules` missing                       | `pnpm od:samples`                                                                                     |
| **B0** smoke fails: empty `App.tsx`                       | Sample 2 or 3 not authored                          | Author per §3.3                                                                                       |
| **B1** OpenRouter 401                                      | Wrong/expired key                                   | Regenerate `VKEN_OPENROUTER_KEY` at openrouter.ai                                                    |
| **B1** OpenRouter 429 in smoke                             | Free-tier per-min cap                               | Wait 60s; or run smoke with `VKEN_LLM_PROVIDER=cassette`                                             |
| **B1** zod parse failure                                   | Free model returned prose around the JSON           | Confirm `response_format` + system-prompt JSON-only directive both present                            |
| **B2** `designQuality` is 0.5 in `vken:score`              | Pipeline still calls stub                           | Check `run-pipeline.ts` passes `{designQuality}` into `scoreVkenIndex`                              |
| **B2** No directions emitted                               | Coder schema mismatch                               | Inspect `chatCoder` raw response in logs; tighten zod schema OR loosen prompt                        |
| **B3** Patches all dropped (zero pass `includes` check)    | CRLF mismatch                                       | Apply `norm()` per §6.3 on both sides of the check                                                   |
| **B3** AFTER iframe never updates                          | Preview server not started                          | Check `preview.ts` spawn logs; confirm port allocation and `vite preview` process alive              |
| **B4** PR creation 403                                     | PAT scope wrong                                     | Regenerate PAT with `Contents: write` + `Pull requests: write` for `vken-bot/*`                      |
| **B4** PR is empty                                         | Materialized FS wrote to wrong dir                  | Check `materializeTo` target matches the dir the bundle/push reads from                              |
| **B5** Bench fails: `seed.jsonl` empty                     | Seed script not actually running engine             | Check `VKEN_KB_SEED_MODE=true` is set in seed script                                                 |
| **B5** Signature verify fails on every line                | Signing key changed between sign and verify         | Re-sign with current key; do **not** rotate `VKEN_KB_SIGNING_KEY` mid-build                          |
| **B5** Toast never fires                                    | `vken:learn` not emitted                            | Check `kb.commit` is called inside the finalize success path                                          |
| **B6** BYOK key leaks into logs                             | Logger swallowed `req.byok`                         | Add `req.byok` to the log redaction list; re-run §12.4 step "key never appears in logs"              |
| **B6** Mobile layout overflows                              | One pane has fixed `min-width`                      | Find via DevTools; replace with `min-w-0` + `flex-1`                                                  |
| **B7** Docker build > 12 min                                | `samples/install-all.mjs` reinstalling every layer  | Move sample install before the build copy so it caches                                                |
| **B7** Space build OOM                                      | Multi-stage copying `node_modules` from build stage | Reduce sample dependencies (no icon libs, no router) or use `pnpm fetch` + offline install            |
| **B8** Acceptance fails on cross-browser                    | EventSource polyfill missing in older Safari        | Use `fetch` + `getReader` (already does) — confirm no `new EventSource` references in web code        |

If a row is not here, debug with `pnpm tools-dev logs --json
--namespace dev` and the daemon's stdout.

### 14.3 The "stop the build" criteria

Stop and reassess scope (don't push through) if any of these are
true after 2 hours of attempts:

- Block 4 PR creation fundamentally cannot work (Octokit auth keeps
  failing despite valid PAT and correct scopes). Fall back to bundle-
  only path per original plan §10.2 #4.
- Block 5 KB-bench shows learning *regressing* the samples (negative
  delta consistently). Disable the promotion gate; ship Tier-1 only.
- Block 7 Docker build keeps timing out on HF. Tunnel a local daemon
  via Cloudflare Tunnel as the public URL; deploy on Day 3 morning.

---

## 15. Appendix A — Env var reference

Authoritative list. Anything not on this list is unused.

| Var                           | Required when               | Default                                     | Notes                                              |
| ----------------------------- | --------------------------- | ------------------------------------------- | -------------------------------------------------- |
| `VKEN_LLM_PROVIDER`           | always                      | `openrouter`                                | Primary provider.                                  |
| `VKEN_LLM_FALLBACK1`          | optional                    | `cassette`                                  | Auto-fallback on 429/5xx/schema-error.             |
| `VKEN_OPENROUTER_KEY`         | provider=openrouter         | —                                           | OpenRouter API key.                                |
| `VKEN_OR_VL_MODEL`            | provider=openrouter         | `qwen/qwen2.5-vl-72b-instruct:free`         |                                                    |
| `VKEN_OR_CODER_MODEL`         | provider=openrouter         | `qwen/qwen-2.5-coder-32b-instruct:free`     |                                                    |
| `GOOGLE_API_KEY`              | provider=gemini             | —                                           | Free-tier Gemini key.                              |
| `VKEN_GEMINI_MODEL`           | provider=gemini             | `gemini-2.5-flash`                          |                                                    |
| `VKEN_VLLM_VL_URL`            | provider=amd-vllm           | —                                           | e.g. `http://<pod>:8000/v1`                        |
| `VKEN_VLLM_CODER_URL`         | provider=amd-vllm           | —                                           | e.g. `http://<pod>:8001/v1`                        |
| `VKEN_VLLM_TOKEN`             | provider=amd-vllm           | —                                           | Bearer for vLLM containers.                        |
| `OPENAI_API_KEY`              | BYOK=openai                 | —                                           |                                                    |
| `ANTHROPIC_API_KEY`           | BYOK=anthropic              | —                                           |                                                    |
| `VKEN_OLLAMA_URL`             | BYOK=ollama                 | `http://127.0.0.1:11434`                    |                                                    |
| `VKEN_GITHUB_BOT_TOKEN`       | always (for finalize)       | —                                           | Fine-grained PAT for `vken-bot/*`.                 |
| `VKEN_KB_SIGNING_KEY`         | always                      | —                                           | `openssl rand -hex 32`. Do NOT rotate mid-build.   |
| `HF_SPACE_ID`                 | when on Space               | —                                           | Used as Referer for OpenRouter free models.        |
| `OD_DATA_DIR`                 | when on Space               | `<projectRoot>/.od`                         | Existing daemon var; Space sets to `/data`.        |
| `VKEN_KB_SEED_MODE`           | seed script only            | unset                                       | Bypasses multi-repo gate during seeding.           |

---

## 16. Appendix B — File inventory (post-build)

Every file Day 2 creates or materially modifies. Useful for code
review and for verifying the `git status` end state.

### 16.1 New files

```
apps/daemon/src/vken/llm/client.ts
apps/daemon/src/vken/llm/schema.ts
apps/daemon/src/vken/llm/select-provider.ts
apps/daemon/src/vken/llm/token-account.ts
apps/daemon/src/vken/llm/errors.ts
apps/daemon/src/vken/llm/providers/openrouter.ts
apps/daemon/src/vken/llm/providers/gemini.ts
apps/daemon/src/vken/llm/providers/amd-vllm.ts
apps/daemon/src/vken/llm/providers/openai.ts
apps/daemon/src/vken/llm/providers/anthropic.ts
apps/daemon/src/vken/llm/providers/ollama.ts
apps/daemon/src/vken/llm/providers/cassette.ts
apps/daemon/src/vken/critique.ts
apps/daemon/src/vken/directions.ts
apps/daemon/src/vken/propose.ts
apps/daemon/src/vken/apply.ts
apps/daemon/src/vken/preview.ts
apps/daemon/src/vken/validate.ts
apps/daemon/src/vken/pr.ts
apps/daemon/src/vken/bundle.ts
apps/daemon/src/vken/memory.ts
apps/daemon/src/vken/kb.ts
apps/daemon/src/vken/kb-signature.ts
apps/daemon/tests/vken-llm-client.test.ts
apps/daemon/tests/vken-critique.test.ts
apps/daemon/tests/vken-kb.test.ts
apps/web/src/components/vken/DirectionPicker.tsx
apps/web/src/components/vken/PatchCard.tsx
apps/web/src/components/vken/PatchList.tsx           (replace placeholder)
apps/web/src/components/vken/FinalizeButton.tsx
apps/web/src/components/vken/LearnedToast.tsx
apps/web/src/components/vken/KBPanel.tsx
apps/web/src/components/vken/EvidenceChip.tsx
apps/web/src/components/vken/ByokPanel.tsx
apps/web/src/components/vken/Leaderboard.tsx
apps/web/src/state/byok.ts
infra/space/Dockerfile
infra/space/entrypoint.sh
infra/space/cassettes/landing-generic.json
infra/space/cassettes/dashboard-cluttered.json
infra/space/cassettes/ecommerce-basic.json
infra/space/smoke-vl.mjs
infra/space/smoke-coder.mjs
infra/amd-cloud/start-vllm.sh
infra/amd-cloud/stop-vllm.sh
infra/amd-cloud/README.md
samples/install-all.mjs
samples/dashboard-cluttered/src/App.tsx
samples/dashboard-cluttered/src/main.tsx
samples/dashboard-cluttered/src/styles.css
samples/dashboard-cluttered/vite.config.ts
samples/dashboard-cluttered/postcss.config.js
samples/ecommerce-basic/src/App.tsx
samples/ecommerce-basic/src/main.tsx
samples/ecommerce-basic/src/styles.css
samples/ecommerce-basic/vite.config.ts
samples/ecommerce-basic/postcss.config.js
scripts/vken-kb-bench.ts
scripts/vken-kb-seed.ts
scripts/vken-day2-acceptance.ts
kb/seed.jsonl
kb/README.md
BRAND.md
.github/workflows/space-sync.yml
docs/plans/2026-05-08-vken-day2-source-of-truth.md   (this doc)
```

### 16.2 Modified files

```
apps/daemon/package.json                     (zod, @axe-core/playwright, octokit)
apps/daemon/src/db.ts                        (only if any new column needed; ideally none)
apps/daemon/src/server.ts                    (route additions: direction, approve, skip, scrub, finalize, llm/test, provider/info, kb listing, byok middleware, cache headers)
apps/daemon/src/vken/intake.ts               (URL clone implementation)
apps/daemon/src/vken/score.ts                (designQuality from arg)
apps/daemon/src/vken/run-pipeline.ts         (critique, directions, memory hooks, learn events)
apps/web/src/components/vken/Cockpit.tsx     (direction picker, patch list, BYOK gear)
apps/web/src/components/vken/Hook.tsx        (real animation)
apps/web/src/components/vken/BeforeAfter.tsx (preview iframe)
apps/web/src/components/vken/Timeline.tsx    (clickable scrub)
apps/web/src/components/vken/useVkenSse.ts   (new event reducers)
apps/web/src/providers/registry.ts           (BYOK header)
README.md                                    (full rewrite)
package.json                                 (od:samples script)
```

---

## 17. Appendix C — What makes this submission superior

Tracked deliberately, baked into the build, not bolted on at video
time.

1. **It actually works end-to-end on demo day.** Cassette mode +
   provider chain means the live demo cannot fail — if every API
   provider is down, recorded JSON still drives the same UX. Most
   submissions die on stage; this one cannot.
2. **The learning is visible.** Every committed rule fires a
   `LearnedToast` with the actual stats. Most "AI agent" submissions
   claim learning; few show it happening in real time. This one shows
   it after every approved patch.
3. **The learning is auditable.** Every Tier-3 rule is HMAC-signed
   and committed to a JSONL file in git. A reviewer can trace any
   recommendation to the runs that proved it. This is rare and earns
   trust.
4. **Provider-agnostic by construction.** Slide claim becomes a UI
   fact: the gear icon switches providers live. AMD MI300X +
   OpenRouter + Gemini + Ollama + BYOK all use the same engine, same
   prompts, same JSON schema.
5. **Real PRs, not just diffs.** Many demos show "I generated a
   patch"; this one opens a reviewable PR on a public bot account
   that anyone can inspect.
6. **Bench-validated learning.** A rule cannot enter the global KB
   unless it improves scores on the 3 sample bench without regressing
   any of them. This is a real anti-overfitting discipline that few
   self-improving agent demos implement.
7. **Two-phase staging.** A patch that's "approved" but breaks tsc
   *demotes* its rule. The system learns that approval ≠ correctness.
   This subtle correctness pattern is what separates serious agentic
   systems from theatre.
8. **Anti-hallucination patch gate.** Every `search` string is
   pre-validated against the workspace before the patch is shown to
   the user. No "the model proposed a fix to a line that doesn't
   exist".
9. **Mobile-responsive cockpit.** Most hackathon demos are
   desktop-only; this one works on a phone. Judges who skim on mobile
   land on a working experience.
10. **Keyboard shortcuts.** `j/k/a/s/?` make the demo feel like a
    tool, not a tech demo.
11. **Full BYOK panel.** Judges can verify on their own infra. This
    is the strongest possible "is this real?" answer.
12. **AMD pivot is one env var.** When credits arrive, the Space
    flips runtime in 10 minutes without touching code. The narrative
    actually strengthens the AMD partnership claim — *we built so
    cleanly that swapping inference providers is a config change*.

— end of document —
