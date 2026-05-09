# VKEN Day 2 — Zero-Cost LLM Pivot Plan

| Field            | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Supersedes       | §5 of [docs/plans/2026-05-07-vken-2day-build-plan.md](2026-05-07-vken-2day-build-plan.md)  |
| Source of truth  | [docs/plans/2026-05-07-vken-hackathon-v1-design.md](2026-05-07-vken-hackathon-v1-design.md) |
| Owner            | Kenny Chirombo                                                                             |
| Build window     | 2026-05-08 (Day 2)                                                                         |
| Trigger          | AMD AI Developer Cloud credits **not yet approved**; treat as may-never-arrive             |
| Pivot direction  | If AMD credits arrive → flip one env var (`VKEN_LLM_PROVIDER=amd-vllm`). No code changes.  |
| Hard deadline    | 2026-05-10 18:00 local                                                                     |

This document replaces §5 of the original 2-day plan. It does not change the
design doc, the contracts, the SSE event names, or the cockpit UX. It changes
**only the inference layer** so that VKEN can demo at full quality with
$0 spent on inference, while keeping a one-flag pivot back to MI300X +
vLLM if credits land.

The story shifts from "VKEN runs on AMD MI300X" to **"VKEN is provider-
agnostic. Production target is AMD MI300X + vLLM serving Qwen2.5-VL +
Qwen3-Coder; in V1 we ship the same engine running against any compatible
endpoint — including free OpenRouter Qwen, BYOK keys, or local Ollama."**
This is *stronger* positioning, not weaker, because it matches what real
teams need.

---

## Table of contents

1. [Day 1 audit (what's done, what's missing)](#1-day-1-audit-whats-done-whats-missing)
2. [Pivot strategy: one provider interface, many backends](#2-pivot-strategy-one-provider-interface-many-backends)
3. [Day 2 schedule (zero-cost path)](#3-day-2-schedule-zero-cost-path)
4. [Provider matrix and env vars](#4-provider-matrix-and-env-vars)
5. [BYOK panel design](#5-byok-panel-design)
6. [Pivot-back checklist (when AMD credits arrive)](#6-pivot-back-checklist-when-amd-credits-arrive)
7. [Updated definition of done for Day 2](#7-updated-definition-of-done-for-day-2)
8. [Demo narrative changes](#8-demo-narrative-changes)
9. [Risk register and escalation](#9-risk-register-and-escalation)

---

## 1. Day 1 audit (what's done, what's missing)

Audit performed against §4 of the original 2-day plan. State as of
2026-05-08 morning, branch `vken/v1`, single Day-1 commit `f5848b2`.

### 1.1 Done ✅

| Plan ref | Item                                                          | Evidence                                                         |
| -------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| §4.1     | API DTOs                                                      | [packages/contracts/src/api/vken.ts](../../packages/contracts/src/api/vken.ts) |
| §4.1     | SSE union                                                     | [packages/contracts/src/sse/vken.ts](../../packages/contracts/src/sse/vken.ts) |
| §4.1     | Contracts re-export                                           | [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts)       |
| §4.1     | DB migrations (11 vken_* tables)                              | [apps/daemon/src/db.ts](../../apps/daemon/src/db.ts)             |
| §4.1     | DB smoke test                                                 | [apps/daemon/tests/vken-db.test.ts](../../apps/daemon/tests/vken-db.test.ts) |
| §4.2     | pHash, pixel-diff, ssim, visual-gap                           | [apps/daemon/src/vken/algorithms/](../../apps/daemon/src/vken/algorithms/) |
| §4.2     | Lint (hardcoded, tokens, radius)                              | [apps/daemon/src/vken/lint/](../../apps/daemon/src/vken/lint/)   |
| §4.2     | Algorithm + lint tests                                        | [apps/daemon/tests/vken-algorithms.test.ts](../../apps/daemon/tests/vken-algorithms.test.ts), [apps/daemon/tests/vken-lint.test.ts](../../apps/daemon/tests/vken-lint.test.ts) |
| §4.4     | Intake (sample path)                                          | [apps/daemon/src/vken/intake.ts](../../apps/daemon/src/vken/intake.ts) |
| §4.4     | Workspace index builder                                       | [apps/daemon/src/vken/index-build.ts](../../apps/daemon/src/vken/index-build.ts) |
| §4.4     | Vite dev runner                                               | [apps/daemon/src/vken/runner.ts](../../apps/daemon/src/vken/runner.ts) |
| §4.4     | Playwright capture (3 viewports)                              | [apps/daemon/src/vken/capture.ts](../../apps/daemon/src/vken/capture.ts) |
| §4.4     | Pipeline smoke                                                | [infra/space/smoke.mjs](../../infra/space/smoke.mjs), [apps/daemon/tests/vken-pipeline.test.ts](../../apps/daemon/tests/vken-pipeline.test.ts) |
| §4.5     | Score (deterministic; designQuality stubbed at 0.5)            | [apps/daemon/src/vken/score.ts](../../apps/daemon/src/vken/score.ts) |
| §4.5     | Run service (SSE backbone)                                    | [apps/daemon/src/vken/runs.ts](../../apps/daemon/src/vken/runs.ts) |
| §4.5     | Routes: POST /api/vken/runs, GET …/:id, /sse, /leaderboard, /captures/:id/screenshot.png | [apps/daemon/src/server.ts:2983-3038](../../apps/daemon/src/server.ts#L2983-L3038) |
| §4.7     | Cockpit MVP (Hook, Cockpit, ScoreGauge, Timeline, BeforeAfter, PatchList) | [apps/web/src/components/vken/](../../apps/web/src/components/vken/) |
| §4.7     | useVkenSse (live SSE wiring)                                  | [apps/web/src/components/vken/useVkenSse.ts](../../apps/web/src/components/vken/useVkenSse.ts) |
| §4.7     | Web router `/vken`, `/vken/run/:id`, `/vken/leaderboard`, `/vken/kb` | [apps/web/src/router.ts](../../apps/web/src/router.ts) |
| §4.7     | App.tsx mounts `<VkenApp/>` for vken routes                   | [apps/web/src/App.tsx](../../apps/web/src/App.tsx) |
| §4.4     | `samples/landing-generic` real Vite+React+Tailwind app         | [samples/landing-generic/](../../samples/landing-generic/)       |

**Day 1 GATE 4 status:** A judge can `POST /api/vken/runs` with
`{intake:{kind:'sample',sampleId:'landing-generic'}}`, watch SSE events
`vken:intake → vken:scan → vken:capture (×3) → vken:score → end`, and
the cockpit reflects them. **Day 1 succeeded.**

### 1.2 Gaps to close on Day 2 (carried over before LLM work) 🟡

These are real Day-1 holes that Day-2 must fix before LLM work. They
were originally Day-1 nice-to-haves or already on the Day-2 docket but
deserve explicit call-out so they aren't forgotten.

| #  | Gap                                                                                          | Why it matters                                                | Where it lives in Day 2 |
| -- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------- |
| G1 | `samples/dashboard-cluttered` and `samples/ecommerce-basic` have empty `src/` (no `App.tsx`) | Smoke command already accepts these IDs and will fail on capture | Block 1 (warm-up)       |
| G2 | None of the 3 sample apps have `node_modules/` installed; runner spawns `node_modules/vite/bin/vite.js` directly | Runner will throw `ENOENT` on first end-to-end run            | Block 1 (warm-up)       |
| G3 | URL intake throws `VKEN_INTAKE_FAILED` by design                                             | Demo allows pasting a public Vite repo — needs real impl      | Block 5 (alongside KB) |
| G4 | `score.designQuality` is a 0.5 baseline stub                                                 | Real critique result must replace it                          | Block 2 (critique)      |
| G5 | `PatchList.tsx` is a 208-byte placeholder                                                    | Needs real list, approve/skip buttons                         | Block 3 (apply)         |
| G6 | `Hook.tsx` does not yet replay the canned score-climb stream                                  | Landing animation = the hook of the demo                      | Block 6 (polish)        |
| G7 | No `vken/captures/:id/screenshot.png` cache headers; large PNGs reload every event           | Cockpit feels janky on slow networks                          | Block 6 (polish)        |
| G8 | `apps/daemon/src/vken/runs.ts` and `server.ts` have `// @ts-nocheck`                          | Acceptable for hackathon; flag for V2 cleanup                 | (defer to V2)           |
| G9 | `infra/amd-cloud/` directory referenced in plan §3.3 does not exist                          | Only matters if AMD credits arrive — ship script then         | §6 pivot-back checklist |
| G10 | `kb/` directory referenced in plan §3.4 does not exist                                       | KB seed lives there                                            | Block 5 (KB)            |

### 1.3 Risks now visible

- **R1 — Vite installs in samples may inflate the Space Docker image.**
  Three sample apps each `npm install`-ing pulls ~80 MB. Mitigation: a
  shared `samples/.pnpm-store` symlink, or a build-time
  `pnpm install --filter './samples/*' --offline` from a pre-warmed
  store. Decision recorded in Block 1.
- **R2 — OpenRouter free-tier rate limits.** `:free` model variants
  enforce per-minute limits. A run does ~6 LLM calls. Mitigation:
  Block 1 wires automatic retry with provider fallback to Gemini Flash,
  then to cassette (per user choice in plan-prep).
- **R3 — Playwright in HF Space Docker.** Dockerfile must install
  Chromium; build timeout is the risk. Mitigation: prebuilt
  `mcr.microsoft.com/playwright:v1.49.0-jammy` base.

---

## 2. Pivot strategy: one provider interface, many backends

The original plan calls for `vken/vllm-client.ts` with two methods:
`chatVL(messages, schema?)` and `chatCoder(messages, schema?)`. We
**rename and broaden it** instead of replacing it.

### 2.1 New file layout

```
apps/daemon/src/vken/llm/
├─ client.ts            # public surface: chatVL, chatCoder, providerInfo
├─ schema.ts            # shared structured-output validators (zod)
├─ providers/
│  ├─ amd-vllm.ts       # original target — preserved, untouched semantically
│  ├─ openrouter.ts     # PRIMARY zero-cost path
│  ├─ gemini.ts         # fallback (used by hybrid mode)
│  ├─ ollama.ts         # local zero-cost (BYOK runtime)
│  ├─ openai.ts         # BYOK
│  ├─ anthropic.ts      # BYOK
│  └─ cassette.ts       # offline pre-recorded responses (last resort)
└─ select-provider.ts   # env + per-request override resolver
```

`vllm-client.ts` becomes a 1-line deprecation shim:
`export { chatVL, chatCoder } from './llm/client.js';`

### 2.2 Provider contract

Every provider exports:

```ts
export interface VkenProvider {
  id: VkenProviderId;
  capabilities: { vision: boolean; structuredOutput: boolean };
  chat(input: VkenChatInput): Promise<VkenChatOutput>;
  // structured-output: provider returns parsed JSON or throws
  // VkenStructuredOutputError, which client.ts retries 2× then falls
  // back to the next provider in the chain.
}
```

`client.ts.chatVL(messages, schema?)` → resolves provider chain →
calls `chat({ task: 'vl', ... })`. `client.ts.chatCoder(...)` is
identical with `task: 'coder'`. **Every existing call site uses the
same two functions** — Block 2 onward is unchanged from §5 of the
original plan.

### 2.3 Why this is *better* than the AMD-only path for V1

1. **One env var** (`VKEN_LLM_PROVIDER`) flips the whole engine. The
   PR title `feat(vken): provider-agnostic inference` says everything.
2. **Zero-cost demo on the Space.** Free OpenRouter Qwen models keep
   the Qwen story intact and cost $0.
3. **BYOK-by-construction.** A judge with their own key sees their
   own usage on their own dashboard — strongest possible "is this
   real?" answer.
4. **Pivot-back is one PR.** When AMD credits arrive, set
   `VKEN_LLM_PROVIDER=amd-vllm` on the Space. Same code path, same
   prompts, same JSON schema.

---

## 3. Day 2 schedule (zero-cost path)

Time budget: 12 focused hours. Each block ends with a green `pnpm
typecheck` and a smoke command.

### 3.1 Block 0 (08:00–08:45) — close Day-1 gaps (G1, G2, G10)

- [ ] Author `samples/dashboard-cluttered/src/App.tsx` and `styles.css`
      with the debt fingerprint per design doc §20.2 (cluttered grid,
      hardcoded greys, inconsistent radii, low contrast badges).
- [ ] Author `samples/ecommerce-basic/src/App.tsx` and `styles.css`
      per §20.3 (PDP w/ broken primary, stretched product image,
      inconsistent button hierarchy).
- [ ] Add a `samples/_setup.mjs` script invoked from a new
      `tools-dev` task `samples:install` that runs
      `npm install --no-audit --no-fund --prefer-offline` in each
      sample dir. Idempotent.
- [ ] Run `pnpm tools-dev samples:install` once. Confirm
      `samples/landing-generic/node_modules/vite/bin/vite.js` exists.
- [ ] Create `kb/` directory with a `.gitkeep` + a placeholder
      `kb/README.md` ("populated on Block 5").
- [ ] Run `node infra/space/smoke.mjs --no-llm sample landing-generic`
      → expect `VKEN_SMOKE_OK`. Repeat for the other two sample IDs.
- [ ] Commit: `feat(vken): finish samples 2 + 3, samples:install task`.

### 3.2 Block 1 (08:45–10:30) — provider abstraction + OpenRouter

- [ ] Add `apps/daemon/src/vken/llm/client.ts` with `chatVL` and
      `chatCoder` and `providerInfo()`.
- [ ] Add `apps/daemon/src/vken/llm/schema.ts` with zod validators
      for the critique payload, the directions payload, and the
      patch-proposal payload (matches design doc §11 + §15).
- [ ] Implement `apps/daemon/src/vken/llm/providers/openrouter.ts`
      using the OpenAI-compatible Chat Completions endpoint at
      `https://openrouter.ai/api/v1/chat/completions`. Authorization
      header `Bearer $VKEN_OPENROUTER_KEY`. Support image content
      parts as `image_url` (data: URLs accepted by OR).
- [ ] Implement `apps/daemon/src/vken/llm/providers/cassette.ts`
      that replays JSON from `infra/space/cassettes/<sampleId>.json`.
- [ ] Implement `apps/daemon/src/vken/llm/providers/amd-vllm.ts`
      (port the original `vllm-client.ts` plan; same OpenAI-compatible
      shape, just two URLs `VKEN_VLLM_VL_URL` and `VKEN_VLLM_CODER_URL`).
- [ ] `apps/daemon/src/vken/llm/select-provider.ts` reads
      `VKEN_LLM_PROVIDER`. Per-request override via header
      `x-vken-byok` (JSON-base64) — see §5.
- [ ] Token accounting normalized into `vllm_input_tokens` /
      `vllm_output_tokens` columns regardless of provider (rename to
      `llm_*` columns is V2 churn — not now).
- [ ] Smoke: `node infra/space/smoke-vl.mjs sample landing-generic`
      sends the desktop screenshot to OpenRouter Qwen2.5-VL and
      prints a parseable critique JSON. Same with `smoke-coder.mjs`
      for Qwen-Coder directions on a hardcoded captured workspace
      index.
- [ ] Commit: `feat(vken): provider-agnostic LLM client (OpenRouter primary)`.

### 3.3 Block 2 (10:30–11:45) — critique + directions

- [ ] `apps/daemon/src/vken/critique.ts` — Qwen2.5-VL (or whichever
      provider is active) pass. Same payload shape as §5.2 of the
      original plan.
- [ ] Wire `score.ts` to consume `critique.designQuality` (replaces
      the 0.5 stub — closes **G4**).
- [ ] `apps/daemon/src/vken/directions.ts` — Qwen3-Coder pass.
      Always 2 directions (escalation cut §10.2 #1 already in effect
      to keep cost low).
- [ ] `executeDeterministicVkenRun` extended → after capture/score,
      emit `vken:direction` events.
- [ ] Cockpit `DirectionPicker.tsx` — cards with mood, summary,
      changes, evidence count. POST → `/api/vken/runs/:id/direction`.
- [ ] Smoke: full run on `landing-generic` produces 2 directions on
      screen.
- [ ] Commit: `feat(vken): critique + directions (provider-agnostic)`.

### 3.4 Block 3 (11:45–13:00) — propose + apply (virtual FS)

(Same as §5.3 of the original plan — no provider-specific changes.)

- [ ] `apps/daemon/src/vken/propose.ts` — Coder pass; pre-validates
      `search` strings via `string.includes` before emitting.
- [ ] `apps/daemon/src/vken/apply.ts` — virtual FS map per design
      doc §11.2.
- [ ] `vken:patch` events; client renders patch list (closes **G5**).
- [ ] Cockpit: `PatchCard.tsx`, real `PatchList.tsx` with
      approve/skip; AFTER iframe re-renders within 1s of approve.
- [ ] Smoke: approve all proposed patches; AFTER iframe visibly
      different from BEFORE.
- [ ] Commit: `feat(vken): patch proposal + virtual-FS apply with scrub`.

### 3.5 Lunch (13:00–13:30)

### 3.6 Block 4 (13:30–14:45) — validate + finalize + PR

(Same as §5.5 of the original plan.)

- [ ] `validate.ts` — real `tsc --noEmit`, sample `npm run build`,
      recapture, axe-core, pixel diff.
- [ ] `pr.ts` — Octokit fork-per-run flow. Same as §19.
- [ ] `POST /api/vken/runs/:id/finalize`.
- [ ] Cockpit: Finalize button + per-stage progress.
- [ ] Smoke: real PR opens on `vken-bot/landing-generic-<runId>`.
- [ ] Commit: `feat(vken): validate + Octokit PR finalize`.

### 3.7 Block 5 (14:45–16:15) — learning layer + URL intake (G3)

- [ ] `vken/memory.ts` (Tier 1, Tier 2) per §15.
- [ ] `vken/kb.ts` (Tier 3) — signed JSONL.
- [ ] Wire `propose.ts` to call `kb.retrieve()` for top-3 examples.
- [ ] `kb/seed.jsonl` — generate by running the engine 30× across
      the three samples (down from 50 to fit the budget). Curate, sign.
- [ ] `KBPanel.tsx` and `LearnedToast.tsx` in cockpit.
- [ ] **G3 — URL intake.** Replace the throwing stub in
      `apps/daemon/src/vken/intake.ts` with a real `git clone --depth 1`
      under `<dataDir>/vken/clones/<runId>/`. Reuse
      `detectSupportedWorkspace` to validate; reject non-Vite+React+
      Tailwind with the friendly error path.
- [ ] Smoke: paste a known-good public Vite repo URL → run completes;
      a fresh run shows top-3 KB rules surfaced as evidence on
      direction cards.
- [ ] Commit: `feat(vken): KB + URL intake + learning toasts`.

### 3.8 Break (16:15–16:45)

### 3.9 Block 6 (16:45–18:30) — leaderboard, BYOK panel, polish

- [ ] `Leaderboard.tsx` — render rows from `/api/vken/leaderboard`,
      poll every 60s. (API already exists.)
- [ ] **BYOK panel** per §5 below. Lives in a settings drawer
      reachable from a gear icon in the cockpit header.
- [ ] **Hook polish (G6)** — `Hook.tsx` replays a pre-recorded
      checkpoint stream so the score-climb hero animates immediately
      on landing.
- [ ] **Capture cache headers (G7)** — server adds
      `Cache-Control: public, max-age=31536000, immutable` to
      `/api/vken/captures/:id/screenshot.png` (capture IDs are UUIDs,
      so cache-forever is safe).
- [ ] Empty + error states per §16.5: provider misconfigured,
      OpenRouter rate-limit hit, sample install missing, framework
      unsupported.
- [ ] Cassette badge: when `cassette.ts` answered the call, the
      cockpit footer shows "Replaying recorded run — flip
      `VKEN_LLM_PROVIDER` to go live".
- [ ] Provider badge in cockpit header: "Running on Qwen via
      OpenRouter" / "Running on your Anthropic key" / etc.
- [ ] Commit: `feat(vken): leaderboard + BYOK + cockpit polish`.

### 3.10 Block 7 (18:30–20:00) — Space deployment (CPU-only)

- [ ] `infra/space/Dockerfile`. Base
      `mcr.microsoft.com/playwright:v1.49.0-jammy`. Multi-stage:
      stage 1 builds web + daemon; stage 2 copies dist + samples
      `node_modules` (warmed via `pnpm samples:install` in stage 1).
- [ ] `infra/space/entrypoint.sh` — starts the daemon on `:7860`
      with `OD_DATA_DIR=/data`. (Space mounts `/data` ephemerally;
      that's fine — nothing in V1 needs to survive a Space restart
      except the KB which lives in the repo.)
- [ ] Local validation:
      ```bash
      docker build -f infra/space/Dockerfile -t vken-space .
      docker run --rm -p 7860:7860 \
        -e VKEN_LLM_PROVIDER=openrouter \
        -e VKEN_OPENROUTER_KEY=... \
        -e VKEN_OR_VL_MODEL=qwen/qwen2.5-vl-72b-instruct:free \
        -e VKEN_OR_CODER_MODEL=qwen/qwen-2.5-coder-32b-instruct:free \
        -e VKEN_GITHUB_BOT_TOKEN=... \
        -e VKEN_KB_SIGNING_KEY=... \
        vken-space
      ```
- [ ] Push to HF Space. Set Space secrets. Restart.
- [ ] Public URL: run `landing-generic` end-to-end. Real PR opens.
- [ ] Build-in-public update #1: 15s GIF of the score climb.
- [ ] Tag: `git tag day-2-end`.

### 3.11 Block 8 (20:00–20:30) — green checkpoints

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- [ ] One end-to-end run per sample on the public Space, each
      producing a real PR.
- [ ] Update `BRAND.md` if it mentions AMD-as-runtime; reword as
      "AMD MI300X + vLLM is the production target. V1 ships
      provider-agnostic and demos on free-tier OpenRouter Qwen
      models with one-flag pivot to MI300X."

---

## 4. Provider matrix and env vars

| `VKEN_LLM_PROVIDER` | Model selection env vars                                                     | Cost     | Notes                              |
| ------------------- | ---------------------------------------------------------------------------- | -------- | ---------------------------------- |
| `openrouter` (★)    | `VKEN_OPENROUTER_KEY`, `VKEN_OR_VL_MODEL`, `VKEN_OR_CODER_MODEL`             | $0 free  | **Demo default.** Qwen models.     |
| `amd-vllm`          | `VKEN_VLLM_VL_URL`, `VKEN_VLLM_CODER_URL`, `VKEN_VLLM_TOKEN`                 | $ AMD    | Pivot-back target.                 |
| `gemini`            | `GOOGLE_API_KEY`, `VKEN_GEMINI_MODEL` (default `gemini-2.5-flash`)            | $0 free  | Vision + code, single model.       |
| `ollama`            | `VKEN_OLLAMA_URL` (default `http://127.0.0.1:11434`), `VKEN_OLLAMA_VL_MODEL` (default `qwen2.5-vl:7b`), `VKEN_OLLAMA_CODER_MODEL` (default `qwen2.5-coder:7b`) | $0 local | Local-only demo path.              |
| `openai`            | `OPENAI_API_KEY`, `VKEN_OPENAI_VL_MODEL` (`gpt-4o-mini`), `VKEN_OPENAI_CODER_MODEL` (`gpt-4o-mini`) | $ user   | BYOK.                              |
| `anthropic`         | `ANTHROPIC_API_KEY`, `VKEN_ANTHROPIC_MODEL` (`claude-haiku-4-5-20251001`)    | $ user   | BYOK; single model handles both.   |
| `cassette`          | (none)                                                                        | $0       | Pre-recorded; demo-safe.           |

(★) = Space default.

A per-request header `x-vken-byok` (base64-JSON of `{provider,...}`) lets
the BYOK panel override the server default without writing the key to
disk — see §5.

---

## 5. BYOK panel design

A gear icon in the cockpit header opens a right-side settings drawer:

```
┌──────────────────────────────────────────────┐
│ Inference                                    │
│                                              │
│ Provider: [ OpenRouter (free Qwen)        ▼] │
│           [ Bring your own key            ▼] │
│              ├─ OpenAI                       │
│              ├─ Anthropic                    │
│              ├─ Google (Gemini)              │
│              ├─ OpenRouter                   │
│              ├─ Ollama (local)               │
│              └─ vLLM URL (e.g. AMD pod)      │
│                                              │
│ API key:  ┌───────────────────────────────┐  │
│           │ ••••••••••••••••••••          │  │
│           └───────────────────────────────┘  │
│                                              │
│ VL model:    [ qwen2.5-vl-72b-instruct  ]    │
│ Coder model: [ qwen-2.5-coder-32b-inst  ]    │
│                                              │
│ ☐ Remember in this browser only              │
│ ☐ I understand keys are sent to my own       │
│   provider; this Space does not store them.  │
│                                              │
│ [ Cancel ]                  [ Use my key ]   │
└──────────────────────────────────────────────┘
```

### 5.1 Storage & transport rules

- Default storage: in-memory (`useState`). Lost on refresh.
- "Remember in this browser only" stores under `localStorage` with key
  `vken.byok.v1`. Never sent anywhere except the daemon's
  `x-vken-byok` header on the next run.
- The daemon receives `x-vken-byok`, decodes, **never logs**, **never
  writes to SQLite**, passes to the provider for that request only.
- Server-side default `VKEN_LLM_PROVIDER` is used when no header.
- A "Test connection" button in the drawer hits
  `POST /api/vken/llm/test` which performs a tiny one-token call and
  returns `{ ok, provider, model, latencyMs }`.

### 5.2 Why this earns points

- Differentiator: judges can verify VKEN works on *their* infra in
  real-time.
- Privacy story: keys never touch the database, never touch logs.
- "Provider-agnostic" goes from a slide claim to a UI fact.

---

## 6. Pivot-back checklist (when AMD credits arrive)

The moment the credits land — even mid-Day-3:

1. SSH to the MI300X pod. Run `bash infra/amd-cloud/start-vllm.sh`
   (write this script when credits arrive — it already exists in the
   plan §17.2 spec but we don't burn time on it speculatively).
2. Confirm `curl http://<pod>:8000/v1/models` returns Qwen2.5-VL and
   `curl http://<pod>:8001/v1/models` returns Qwen3-Coder.
3. On the Hugging Face Space → Settings → Variables and secrets:
   - Set `VKEN_LLM_PROVIDER=amd-vllm`
   - Set `VKEN_VLLM_VL_URL=http://<pod>:8000/v1`
   - Set `VKEN_VLLM_CODER_URL=http://<pod>:8001/v1`
   - Set `VKEN_VLLM_TOKEN=<bearer>`
4. Restart the Space (UI button — no rebuild needed).
5. Sanity run: `landing-generic` end-to-end. Provider badge in cockpit
   should now read "Running on Qwen via AMD MI300X + vLLM".
6. Update the demo video lower-third caption to match.

**Total elapsed time on a successful pivot: ~10 minutes.** No code
changes, no PRs, no redeploys. This is the value of the abstraction.

---

## 7. Updated definition of done for Day 2

A judge can:

- Open the public Space URL.
- See the score-climb hook animate on first paint.
- Pick `landing-generic` (or paste a known-good Vite repo URL).
- Watch the live score climb from intake → finalize, all from
  free-tier Qwen via OpenRouter — **at no cost to us or them**.
- See 2 directions, pick one, see ranked patches, approve some.
- Click Finalize, get a real PR URL.
- See the leaderboard update.
- See "what VKEN learned this run" cards stream in.
- Click the gear → paste their own OpenAI/Anthropic/Gemini/vLLM key
  → run the same demo on their own dime, see their own usage.
- Read the provider badge in the header to know exactly what's
  serving inference.

All without anyone in the loop manually fixing a bug mid-demo.

---

## 8. Demo narrative changes

The submission text (plan §6.4) updates from "Built on AMD MI300X" to
**"Production target: AMD MI300X + vLLM serving Qwen2.5-VL +
Qwen3-Coder. V1 ships provider-agnostic and demos on free-tier
OpenRouter Qwen models with one-flag pivot to MI300X. BYOK supported
out of the box."**

Slide 8 (AMD-specific) becomes a two-pane diagram:

```
   [ Production ]                  [ V1 demo ]
                                   ┌──────────────────────┐
   ┌──────────────────────┐        │ OpenRouter ─ Qwen2.5 │
   │ AMD MI300X + ROCm    │ <── 1 ─┤ Gemini Flash         │
   │ vLLM-VL + vLLM-Coder │   env  │ Local Ollama         │
   │ Qwen2.5-VL + Qwen3   │        │ BYOK any vendor      │
   └──────────────────────┘        └──────────────────────┘
                ▲                              ▲
                └──────── same prompts, same JSON, same UX ───┘
```

This actually strengthens the AMD pitch — *"we built so cleanly that
swapping inference providers is one env var. The performance ceiling
sits with MI300X; the floor is whatever a developer already has."*

---

## 9. Risk register and escalation

| Risk                                      | Trigger                                   | Mitigation                                                                         |
| ----------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| OpenRouter free-tier rate-limit mid-demo  | 429 from `openrouter.ai`                  | Auto-fallback to Gemini Flash; if also 429 → cassette mode with banner             |
| Qwen-Coder free model returns broken JSON | zod parse failure                         | Retry once with stricter JSON-only system prompt; then fall back per chain         |
| Sample npm install slow in Docker         | Space build > 10 min                      | Pre-warm `samples/*/node_modules` into the Docker image as a cached layer         |
| HF Space CPU OOM on Playwright            | Capture step OOM                          | Run captures sequentially (already the case); cap viewport to desktop on Space    |
| PR creation fails (Octokit 403)           | Bot PAT expired / scope wrong             | Cockpit surfaces error; Finalize falls back to bundle download (plan §10.2 #4)    |
| AMD credits arrive late on Day 3          | Mid-dry-run                               | Pivot-back checklist §6 — 10 minutes; do NOT touch code mid-day                    |

### 9.1 Day 2 escalation cuts (replaces §10.2)

If a block slips:

1. Drop Block 5 KB seeding from 30 runs to 10. Demo still has
   "learned" cards.
2. Drop Block 6 BYOK panel; ship env-var-only BYOK with a README
   section. (User explicitly chose BYOK panel; this is a last resort.)
3. Drop Block 5 URL intake; demo only the 3 samples. Friendly error
   for URL stays in place.
4. Drop directions to 1 instead of 2. Plan §10.2 cuts beyond this.

### 9.2 Hard cuts (do not breach — updated)

- A real PR. (Fallback: bundle download.)
- Live SSE-driven cockpit. (No pre-rendered video as the demo.)
- All three samples available in the bundle, even if only `landing-
  generic` is demoed live.
- **The provider abstraction itself.** Without it, the AMD pivot-back
  story collapses and we lose the "agnostic" differentiator.

---

— end of document —
