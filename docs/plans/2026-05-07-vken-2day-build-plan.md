# VKEN Design Engine — 2-Day Build Implementation Plan

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Source of truth  | [docs/plans/2026-05-07-vken-hackathon-v1-design.md](2026-05-07-vken-hackathon-v1-design.md) |
| Owner            | Kenny Chirombo                                                     |
| Build window     | 2026-05-08 00:00 → 2026-05-09 23:59 (UTC+local; 2 calendar days)   |
| Submission day   | 2026-05-10 (dry runs, video, slides, submit by 18:00)              |
| Today            | 2026-05-07 (D-1: prep, scaffolding, repo rename, AMD pod)          |
| Hard deadline    | 2026-05-10 23:59 local                                             |

This document is the execution plan for the VKEN Design Engine build. It does
not duplicate the design doc; it tells a builder exactly what to do, in what
order, and how to know each step is done. When this plan and the design doc
disagree, the design doc wins; this plan is updated.

The plan is deliberately ruthless. Every hour is committed. The schedule has
escalation rules so that we ship V1 even if a stage slips.

---

## Table of contents

1. [Operating principles](#1-operating-principles)
2. [Repo rename procedure](#2-repo-rename-procedure)
3. [Day 0 — 2026-05-07 (prep)](#3-day-0--2026-05-07-prep)
4. [Day 1 — 2026-05-08 (engine end-to-end)](#4-day-1--2026-05-08-engine-end-to-end)
5. [Day 2 — 2026-05-09 (LLM, polish, PR, learning)](#5-day-2--2026-05-09-llm-polish-pr-learning)
6. [Day 3 — 2026-05-10 (dry runs, submit)](#6-day-3--2026-05-10-dry-runs-submit)
7. [Process flow and checkpoint gates](#7-process-flow-and-checkpoint-gates)
8. [Parallelization strategy](#8-parallelization-strategy)
9. [Smoke tests and definition of done](#9-smoke-tests-and-definition-of-done)
10. [Escalation and cuts](#10-escalation-and-cuts)
11. [Daily rituals](#11-daily-rituals)

---

## 1. Operating principles

1. **Source of truth is the design doc.** The design doc lists 26 sections;
   any deviation gets noted there first. The plan never describes new
   architecture.
2. **Build deterministic before LLM.** Every stage that does not need an LLM
   must work fully without one before any vLLM call is wired in.
3. **Branch discipline.** All work lands on `vken/v1` off `main`. Feature
   branches off that one are encouraged but optional. Merge to `main` only at
   the end of each build day.
4. **Two-day build means two calendar days.** No "I'll just keep going past
   midnight" — fatigue mistakes on day 1 break day 2.
5. **One in-progress task at a time.** Use the running TodoWrite list. Never
   batch-complete multiple items.
6. **Test the smoke before the polish.** Before anything visual is touched,
   the smoke command (§9.1) must exit 0.
7. **Pause AMD pod when not actively using it.** Credit budget is $80 of
   $100; aggressive pausing is the only way the math works.
8. **No new V1 features creep in.** If something is not in the design doc's
   §1.1 goals, defer it to V2.
9. **The cockpit is the demo.** Anything that doesn't make the cockpit
   better in the next 2 days is deferred.
10. **A working ugly demo always beats a beautiful broken one.** Polish is
    the last hour, not the first.

---

## 2. Repo rename procedure

The product brand is **VKEN Design Engine**. The repo name should reflect
that. The monorepo and workspace packages keep their `@open-design/*`
scoping for now (renaming all package names is high-risk churn for a 2-day
build); the rename is at the **GitHub repo level** plus user-facing
branding inside the repo.

### 2.1 Scope of the rename

Rename **only**:
- The GitHub repo: `open-design` → `vken-design-engine`.
- Top-level `README.md` (title, badges, description).
- The Hugging Face Space repo: `<ns>/vken` (already named correctly).
- Cover image, video, slides, submission text.

Do **not** rename:
- pnpm workspace package names (`@open-design/web`, `@open-design/daemon`,
  `@open-design/contracts`, `@open-design/platform`, `@open-design/sidecar`,
  `@open-design/sidecar-proto`, `@open-design/tools-dev`,
  `@open-design/tools-pack`). Renaming them touches every internal import
  and the published `bin: { od }` entry point.
- The `od` CLI bin name. It stays. Branding for end users is "VKEN".
- Any directory paths in `apps/*`, `packages/*`, `tools/*`. They remain.

### 2.2 GitHub rename steps

Execute these on a workstation, not in a script:

1. Confirm there are no open PRs that will be invalidated by the rename
   (GitHub redirects most things, but some webhook URLs need updating).
2. On GitHub web UI: Settings → General → Repository name →
   `vken-design-engine` → Save.
3. GitHub auto-creates a redirect from `open-design` to
   `vken-design-engine`. Existing remotes keep working but the new URL
   should be adopted.
4. Local: update each clone's remote.
   ```bash
   git remote set-url origin https://github.com/<owner>/vken-design-engine.git
   git remote -v   # verify
   ```
5. Update any GitHub Actions secrets that reference the old name (if any).
6. Update the Hugging Face Space's GitHub-sync workflow to point at the new
   repo URL.
7. Verify the README is rendered correctly on the new URL.

### 2.3 Internal branding updates (single PR)

Open a PR titled `chore: rebrand to VKEN Design Engine` containing only:

- `README.md` rewrite with the new title, tagline, and a link block to:
  the live Space, the demo video, the design doc, and this plan.
- A new `BRAND.md` at repo root with one paragraph explaining: "Internally
  we keep `@open-design/*` workspace package names because they are the
  daemon's adapter contract. The user-facing brand is VKEN Design Engine."
- Update of the favicon in `apps/web/public/favicon.ico` (V2 if no time).

Do **not** rename source files in this PR. Defer that to V2.

### 2.4 Validation after rename

```bash
git fetch --all --prune
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

All four must pass. If any fail, revert the rename PR.

---

## 3. Day 0 — 2026-05-07 (prep)

Goal: every external dependency is unblocked before Day 1's first hour.

Time budget: ~6 hours of focused prep.

### 3.1 Hour 0–1: bootstrap

- [ ] Read the design doc end-to-end.
- [ ] Open this plan in a side panel; reference both during the build.
- [ ] Branch: `git checkout -b vken/v1`.
- [ ] Confirm `pnpm typecheck` and `pnpm test` pass on `main` and on the
      branch. (Baseline.)

### 3.2 Hour 1–2: external accounts

- [ ] AMD AI Developer Program: confirm membership active, $100 credits
      visible. If not active, activate now (30-day clock starts).
- [ ] Hugging Face: create account or use existing. Create new Space
      `vken` under your namespace. SDK: Docker. Hardware: CPU Upgrade.
      Sleep: 30+ days. Save secrets placeholders (filled later).
- [ ] GitHub: create bot account `vken-bot` (or use one you control).
      Generate fine-grained PAT with `Contents: write` and
      `Pull requests: write` scopes for bot-owned repos. Save.
- [ ] HMAC signing key: `openssl rand -hex 32` → save to a password
      manager as `VKEN_KB_SIGNING_KEY`.

### 3.3 Hour 2–4: AMD Cloud pod up

- [ ] Provision 1× MI300X on AMD Developer Cloud.
- [ ] SSH in. Confirm `rocm-smi` shows the GPU.
- [ ] `docker pull rocm/vllm-dev:main` (this can run in the background).
- [ ] While pulling, prepare `infra/amd-cloud/start-vllm.sh` per design
      doc §17.2 (just write the file locally; commit to repo).
- [ ] After pull: start vLLM-VL only (the smaller model), curl
      `localhost:8000/v1/models`. Stop the container after smoke.
- [ ] Note the public IP / DNS for the pod. Set up Caddy or note that
      it's pending. Decide: run public on `:8000`/`:8001` directly
      (with bearer enforced by the Space) or behind a hostname (Caddy).
      For 2-day build, Caddy on a free Cloudflare Tunnel is simplest.
- [ ] Pause the pod via the AMD console once smoke is done.

### 3.4 Hour 4–6: scaffolding

- [ ] Create directories per design doc §5: `apps/daemon/src/vken/`,
      `apps/daemon/src/vken/algorithms/`, `apps/daemon/src/vken/lint/`,
      `apps/web/src/components/vken/`, `samples/`, `infra/space/`,
      `infra/amd-cloud/`, `kb/` (for `seed.jsonl`).
- [ ] Add stub files (one-line exports) so imports compile:
      ```
      apps/daemon/src/vken/types.ts
      apps/daemon/src/vken/runs.ts
      apps/daemon/src/vken/intake.ts
      apps/daemon/src/vken/index-build.ts
      ... (one per module in §6.1)
      ```
- [ ] Add stub `apps/web/src/components/vken/VkenApp.tsx` that returns
      `<div>VKEN booting...</div>`.
- [ ] Update `apps/daemon/package.json` with deps from §6.4. Run
      `pnpm install`. Confirm `pnpm --filter @open-design/daemon exec
      playwright install chromium` succeeds.
- [ ] Confirm `pnpm typecheck` is still green.
- [ ] Commit: `chore(vken): scaffolding for v1 (no behavior)`.

### 3.5 Hour 6: end-of-day check

- [ ] Repo is on `vken/v1`, all stubs in place.
- [ ] AMD pod provisioned, paused.
- [ ] HF Space created, secrets placeholders set.
- [ ] Bot PAT in hand.
- [ ] Tomorrow's first task is unblocked.

If any of the five items above is not done, push them into Day 1 hour 0.
Day 1 starts late but starts unblocked.

---

## 4. Day 1 — 2026-05-08 (engine end-to-end)

Goal: a real VKEN run on `samples/landing-generic` flows through every
deterministic stage and renders in the cockpit. **No LLM calls yet.**
Directions and patches are produced by deterministic stub functions that
return canned JSON; the wiring is what matters.

Time budget: 12 focused hours, with two 30-minute breaks.

### 4.1 Block 1 (08:00–10:00): contracts and DB

- [ ] `packages/contracts/src/api/vken.ts`: every DTO in design doc §9.3
      and §9.4 and §9.5.
- [ ] `packages/contracts/src/sse/vken.ts`: `VkenSseEvent` union per §10.
- [ ] `packages/contracts/src/index.ts`: re-export `vken` modules.
- [ ] `pnpm --filter @open-design/contracts typecheck` green.
- [ ] `apps/daemon/src/db.ts`: append the 11 `CREATE TABLE` statements
      from §8 to the existing `migrate(db)` function. Idempotent.
- [ ] Add a smoke test that opens the DB, lists tables, asserts each
      `vken_*` table exists.
- [ ] Commit: `feat(vken): contracts + db migrations`.

### 4.2 Block 2 (10:00–12:00): pure modules

These have no IO and are easy to unit-test. Build them first because
everything else depends on them.

- [ ] `vken/types.ts`: any internal types needed.
- [ ] `vken/algorithms/phash.ts` (8x8 DCT pHash, hamming).
- [ ] `vken/algorithms/pixel-diff.ts` (wrap `pixelmatch`).
- [ ] `vken/algorithms/ssim.ts` (wrap `img-diff-js`).
- [ ] `vken/algorithms/visual-gap.ts` (composite per §13.4).
- [ ] `vken/lint/hardcoded.ts` (regex-based, per §3.7 of original VKEN doc).
- [ ] `vken/lint/tokens.ts` (PostCSS pass).
- [ ] `vken/lint/radius.ts` (regex over CSS + tailwind).
- [ ] `vken/lint/a11y.ts` (placeholder; real impl on Day 2 with axe).
- [ ] Tests for each module. Use known-good fixtures (two PNGs that
      differ; a CSS file with hardcoded colors).
- [ ] `pnpm test` green for the daemon package.
- [ ] Commit: `feat(vken): pure algorithm and lint modules with tests`.

### 4.3 Lunch (12:00–12:30)

### 4.4 Block 3 (12:30–14:30): intake, index, capture

- [ ] `vken/intake.ts`:
  - `intakeFromUrl(url): { runId, repoPath }`
  - `intakeFromSample(sampleId): { runId, repoPath }`
  - Detect framework. Reject if not Vite + React + Tailwind. Throw with
    `VKEN_FRAMEWORK_UNSUPPORTED`.
- [ ] `vken/index-build.ts`: produce `VkenWorkspaceIndex` per §8.5.
- [ ] `vken/runner.ts`: spawn `vite dev` (or `npm run dev`) on a free
      port, wait for `/`, return `{ pid, url, kill() }`. Cleanup on
      process exit.
- [ ] `vken/capture.ts`: Playwright per route × viewport, persist as
      §7.2.3.
- [ ] `samples/landing-generic`: a real Vite+React+Tailwind app with
      intentional debt per design doc §20.1.
- [ ] Smoke: `node -e 'import("./apps/daemon/dist/vken/intake.js")...'`
      end-to-end on the sample. Captures land on disk.
- [ ] Commit: `feat(vken): intake, workspace index, dev runner, capture`.

### 4.5 Block 4 (14:30–16:30): score, runs service, routes

- [ ] `vken/score.ts`: deterministic composite per §13.5. `designQuality`
      uses a stub (returns 0.5) for now; real Qwen2.5-VL impl on Day 2.
- [ ] `vken/runs.ts`: `createVkenRunService` factory mirroring
      `createChatRunService`. Same SSE shape.
- [ ] `apps/daemon/src/server.ts`: register `/api/vken/*` routes per §9.1.
      Mount `/api/vken/runs/:id/sse`. Wire `POST /api/vken/runs` to call
      `intake → index-build → score`. Emit SSE events per §10.
- [ ] Smoke: `curl -X POST localhost:<daemonPort>/api/vken/runs -d
      '{"intake":{"kind":"sample","sampleId":"landing-generic"}}'` returns
      a runId; `curl localhost:<daemonPort>/api/vken/runs/<id>/sse`
      streams events.
- [ ] Commit: `feat(vken): run service, score, /api/vken routes`.

### 4.6 Break (16:30–17:00)

### 4.7 Block 5 (17:00–19:30): cockpit minimum viable

- [ ] `apps/web/src/components/vken/VkenApp.tsx`: root with React Router
      surface for `/`, `/vken`, `/vken/run/:id`, `/vken/leaderboard`,
      `/vken/kb`.
- [ ] `apps/web/src/components/vken/useVkenSse.ts`: subscribe + dispatch.
- [ ] `apps/web/src/components/vken/ScoreGauge.tsx`: animated radial 0–100.
- [ ] `apps/web/src/components/vken/Hook.tsx`: landing with the
      score-climb hook. Replays a hard-coded SSE stream for now.
- [ ] `apps/web/src/components/vken/Cockpit.tsx`: real layout (timeline
      bottom, before/after iframes center, patch list right). Iframes
      pointed at the running vite dev server's URL for the BEFORE side;
      the AFTER side mirrors BEFORE for now (no patches yet).
- [ ] `apps/web/src/components/vken/Timeline.tsx`: render checkpoints
      from SSE events; click-to-scrub stubbed.
- [ ] `apps/web/src/components/vken/BeforeAfter.tsx`: two iframes,
      synced scroll.
- [ ] `apps/web/src/components/vken/PatchList.tsx`: empty state for now.
- [ ] `apps/web/src/client-app.tsx`: register the `/vken` branch.
- [ ] Smoke: open `localhost:<webPort>/vken/run/<runId>` in a browser
      while a run is in flight. See: live SSE-driven score, captured
      route thumbnails appear, BEFORE iframe shows the running sample.
- [ ] Commit: `feat(vken): cockpit MVP wired to SSE`.

### 4.8 Block 6 (19:30–20:00): green checkpoints

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Smoke run on all three samples (even though dashboard-cluttered and
      ecommerce-basic still need to be authored — at least their dirs
      exist with placeholder Vite apps).
- [ ] Tag: `git tag day-1-end`.

### 4.9 Day 1 definition of done

A judge could open the cockpit, click "Try landing-generic", see the
intake → scan → capture → initial-score sequence stream live, and read a
correctly populated workspace index summary. **No LLM calls happened.**
Patches and directions are visibly absent (the patch list shows "Awaiting
direction").

---

## 5. Day 2 — 2026-05-09 (LLM, polish, PR, learning)

Goal: real Qwen2.5-VL and Qwen3-Coder calls produce real directions and
patches. Approve flow works. Finalize creates a real PR. Learning layer
visibly fires. Cockpit is polished. Space is publicly accessible.

Time budget: 12 focused hours.

### 5.1 Block 1 (08:00–09:30): vLLM client

- [ ] Resume AMD Cloud pod. Run `start-vllm.sh`. Confirm both endpoints
      reachable from local with bearer.
- [ ] `vken/vllm-client.ts`: typed wrapper.
  - `chatVL(messages, schema?)` → returns parsed JSON or throws.
  - `chatCoder(messages, schema?)` → same.
  - Retries: 2× with exponential backoff. 60s hard timeout.
  - Token accounting: log input/output tokens per call into the run's
    `vllm_input_tokens` / `vllm_output_tokens` columns.
- [ ] Smoke: a one-shot `chatVL` against an in-tree screenshot returns a
      valid bbox JSON.
- [ ] Commit: `feat(vken): vllm-client with structured-output validation`.

### 5.2 Block 2 (09:30–11:00): critique + directions

- [ ] `vken/critique.ts`: Qwen2.5-VL pass that takes a screenshot + ARIA
      snapshot + box models and returns:
  ```ts
  {
    designQuality: number,           // 0..1
    findings: Array<{
      dimension: string;
      severity: 'P0'|'P1'|'P2'|'P3';
      description: string;
      regionBox?: { x:number; y:number; w:number; h:number };
    }>
  }
  ```
- [ ] Wire `score.ts` to use `critique.ts`'s `designQuality` instead of
      the stub.
- [ ] `vken/directions.ts`: Qwen3-Coder pass that emits 2 directions
      (third optional). Schema validated.
- [ ] Wire `POST /api/vken/runs` to call directions after initial score.
- [ ] Cockpit: `DirectionPicker.tsx` renders the cards. Clicking POSTs
      to `/direction`.
- [ ] Smoke: full run on `landing-generic` produces 2 directions on
      screen.
- [ ] Commit: `feat(vken): VL critique and Coder direction generation`.

### 5.3 Block 3 (11:00–12:30): propose + apply (virtual FS)

- [ ] `vken/propose.ts`: Qwen3-Coder pass. Emits ranked patches per §11
      and §15.4. Engine pre-validates each `search` string by
      `string.includes` before sending to the user.
- [ ] `vken/apply.ts`: virtual FS map per §11.2. Approve/skip endpoints
      mutate it. Scrub endpoint replays from initial.
- [ ] `vken/runs.ts`: `vken:patch` events emitted; client renders the
      patch list.
- [ ] Cockpit: `PatchCard.tsx` and `PatchList.tsx` wired. Approve →
      `vken:apply` → score gauge updates.
- [ ] Preview iframe: write virtual FS to a per-checkpoint dir,
      `vite preview` against it. Iframe URL points at the preview.
- [ ] Smoke: approve all proposed patches; AFTER iframe visibly
      different from BEFORE.
- [ ] Commit: `feat(vken): patch proposal and virtual-FS scrub apply`.

### 5.4 Lunch (12:30–13:00)

### 5.5 Block 4 (13:00–14:30): validate + finalize + PR

- [ ] `vken/validate.ts`: real `tsc --noEmit`, `npm run build`,
      recapture, axe-core, pixel diff per §14.
- [ ] `vken/pr.ts`: Octokit fork-per-run flow per §19. Idempotent.
- [ ] `POST /api/vken/runs/:id/finalize` orchestrates validate → pr.
- [ ] Cockpit: Finalize button. Shows progress per validation stage.
      Final state: PR URL + bundle download link.
- [ ] Smoke: full run end-to-end on `landing-generic`. PR opens on
      `vken-bot/landing-generic-<runId>` against its own main. PR body
      matches §19.3 template.
- [ ] Commit: `feat(vken): validation pipeline and Octokit PR finalize`.

### 5.6 Block 5 (14:30–16:00): learning layer

- [ ] `vken/memory.ts`: Tier 1 (run) writes after every approved patch.
      Tier 2 (repo) writes only when `enableRepoMemory: true` (always
      on for samples).
- [ ] `vken/kb.ts`: Tier 3. Accept proposals, validate per §15.3,
      append signed JSONL, increment counts in `vken_kb_rules`.
      `kb.retrieve()` for `propose.ts`.
- [ ] Wire `propose.ts` to call `kb.retrieve` and pass top-3 examples
      as few-shot.
- [ ] `kb/seed.jsonl`: ship 50 entries by running 50 dry runs across
      the three samples now. Curate, sign, commit.
- [ ] Cockpit: `KBPanel.tsx` (read-only "what VKEN knows") and
      `LearnedToast.tsx` (intra-run learning surfacer).
- [ ] Smoke: a fresh run shows top-3 KB rules surfaced as evidence on
      direction cards.
- [ ] Commit: `feat(vken): learning layer with signed KB and seed`.

### 5.7 Break (16:00–16:30)

### 5.8 Block 6 (16:30–18:30): leaderboard, samples 2 and 3, polish

- [ ] `samples/dashboard-cluttered`: real Vite app with debt per §20.2.
- [ ] `samples/ecommerce-basic`: real Vite app with debt per §20.3.
- [ ] `Leaderboard.tsx`: render rows from `/api/vken/leaderboard`.
      Cron-poll every 60s.
- [ ] Cockpit a11y pass: focus visible, ARIA labels, mobile stacked
      layout.
- [ ] Hook polish: real animation loop, real tagline placement,
      real CTA buttons.
- [ ] Empty/error states per §16.5. Including the cassette fallback
      when vLLM is unreachable.
- [ ] Commit: `feat(vken): two more samples, leaderboard, polish`.

### 5.9 Block 7 (18:30–20:00): Space deployment

- [ ] `infra/space/Dockerfile` per §18.2. Local build:
      `docker build -t vken-space .`. Local run:
      `docker run -p 7860:7860 -e VKEN_VLLM_VL_URL=...
      -e VKEN_VLLM_CODER_URL=... -e VKEN_VLLM_TOKEN=...
      -e VKEN_GITHUB_BOT_TOKEN=... -e VKEN_KB_SIGNING_KEY=...
      vken-space`. Open localhost:7860, run a sample.
- [ ] Push to HF Space remote. Wait for build (5–10 min).
- [ ] Set Space secrets to real values. Restart the Space.
- [ ] Open public URL in a fresh browser. Run on `landing-generic`.
      A real PR opens.
- [ ] Build-in-public update #1 (10 minutes to draft + post): repo scan
      and design-debt map demo, 15-second GIF. Tag everyone.
- [ ] Commit: `chore(vken): Space dockerfile and deployment`.
- [ ] Tag: `git tag day-2-end`.

### 5.10 Block 8 (20:00–20:30): green checkpoints

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- [ ] Three samples each finish a successful end-to-end run on the
      Space. Three real PRs exist on `vken-bot`.
- [ ] Pause AMD pod for the night.

### 5.11 Day 2 definition of done

A judge can:
- Open the public Space URL.
- Pick `landing-generic` (or paste a known-good GitHub URL).
- Watch the live score climb from intake to finalize.
- See 2 directions, pick one, see ranked patches, approve some.
- Click Finalize, get a real PR URL.
- See the leaderboard update.
- See "what VKEN learned this run" cards stream in.

All without anyone in the loop manually fixing a bug mid-demo.

---

## 6. Day 3 — 2026-05-10 (dry runs, submit)

Goal: zero new features. Reduce risk to zero. Submit by 18:00 local to
preserve buffer.

Time budget: 8 hours.

### 6.1 Block 1 (08:00–10:00): three dry runs per sample

- [ ] Cold-start the Space. Run `landing-generic` end-to-end. Record
      every observation: lag spots, copy issues, broken links, console
      errors. Fix only **demo-blocking** issues; everything else logged
      to a `polish.md` file for V2.
- [ ] Same for `dashboard-cluttered`.
- [ ] Same for `ecommerce-basic`.
- [ ] Run with one paste-a-public-URL test using a known-good Vite app.
- [ ] Run with a deliberately-broken framework test (e.g., a Next.js
      repo URL) to confirm the friendly error renders.
- [ ] Commit: `fix(vken): demo-blocking polish from dry runs`.

### 6.2 Block 2 (10:00–12:00): video, slides, cover

Use OBS or built-in screen recorder. Record three takes, pick the best.

- [ ] Demo video script (60–90s):
  - 0–10s: tagline + landing hook live score climb.
  - 10–25s: pick `landing-generic`, scan + capture.
  - 25–40s: directions appear, pick one, patches stream in.
  - 40–55s: approve top patches, scrub timeline back and forward.
  - 55–70s: finalize → PR opens → click into PR on GitHub.
  - 70–85s: leaderboard + KB panel ("learned over 50 runs").
  - 85–90s: tagline reprise + CTA.
- [ ] Record video. Edit lightly. Upload to YouTube as unlisted.
- [ ] Slide deck (8–12 slides):
  1. Title + tagline.
  2. The problem (frontend teams have apps, not generators).
  3. The hero loop in one diagram.
  4. The cockpit screenshot.
  5. The score-delta graph for the three samples.
  6. The architecture (Space + AMD Cloud).
  7. The learning layer (Tier 1/2/3) with anti-hallucination guardrails.
  8. AMD-specific: MI300X, ROCm, vLLM, Qwen2.5-VL + Qwen3-Coder.
  9. The DesignBench leaderboard.
  10. Roadmap (V2 features, Figma, multi-framework).
  11. Try it: Space URL + GitHub repo + video.
  12. Thank you.
- [ ] Cover image: composition with the live score-climb gauge as the
      hero, tagline as headline.

### 6.3 Lunch (12:00–12:30)

### 6.4 Block 3 (12:30–14:30): submission texts

- [ ] Project Title (verbatim): **VKEN Design Engine — Agentic Design
      Verification and Auto-Repair for Frontends**
- [ ] Short description (≤200 chars): "Paste a frontend repo. VKEN scans
      design debt, proposes named directions, ranks fixes, opens a real
      PR with proof. Built on AMD MI300X."
- [ ] Long description (≤1500 chars): tagline + 4-stage loop + AMD stack
      + DesignBench claim + try-it links.
- [ ] Tags: `AMD AI Developer Cloud`, `ROCm`, `vLLM`, `Qwen`,
      `AI agents`, `multimodal`, `Hugging Face Spaces`, `Playwright`.
- [ ] Cover image, video link, slide deck PDF, GitHub repo URL, Space
      URL, all gathered in one Notion or text file.

### 6.5 Block 4 (14:30–16:00): build-in-public update #2

- [ ] Tweet 2 + LinkedIn: 30s before/after on `landing-generic` with the
      score climb visible. Tag `@lablab`, `lablab.ai`, `@AIatAMD`,
      `AMD Developer`.
- [ ] Reshare from a second account if you have one.

### 6.6 Block 5 (16:00–18:00): final dry runs and submit

- [ ] One more clean run on each sample on the Space. Record logs.
- [ ] Confirm the top-level README.md is accurate, has the Space URL
      and demo video link.
- [ ] Submit on lablab.ai with all required fields. Save the
      submission ID.
- [ ] Confirm the submission renders correctly on lablab.ai (some
      fields cap silently).

### 6.7 Block 6 (18:00–22:00): public push

- [ ] Final tweet: "We just shipped VKEN. Watch a real app improve in
      front of you on AMD MI300X. <Space URL>". Pin it.
- [ ] Post to relevant communities (HN, r/programming, r/MachineLearning,
      Indie Hackers). Stick to one post each — anti-spam.
- [ ] Like the Space ourselves and ask team to like.
- [ ] Pause AMD pod once submission is filed and demo runs are recorded.
      (Demo videos are evergreen; re-running the live demo only costs
      credits.)

### 6.8 Day 3 definition of done

- [ ] Submission filed before 18:00 local.
- [ ] All five required submission artifacts uploaded.
- [ ] Two build-in-public posts live with all required tags.
- [ ] Cover, video, slides, repo all on the public URL.
- [ ] AMD pod paused.

---

## 7. Process flow and checkpoint gates

A "checkpoint gate" is a state the build must reach before proceeding. If a
gate fails, the next block does not start; instead, escalation §10 kicks in.

### 7.1 Gate diagram

```
                    Day 0
   [Repo on vken/v1 + AMD pod up + HF Space created + bot PAT] [GATE 0]
                                |
                                v
                    Day 1 morning
       [Contracts compile + DB migrations idempotent]          [GATE 1]
                                |
                                v
                    Day 1 midday
       [Pure modules + tests green]                            [GATE 2]
                                |
                                v
                    Day 1 afternoon
       [Intake + index + capture work on landing-generic]      [GATE 3]
                                |
                                v
                    Day 1 evening
       [Cockpit MVP renders SSE-driven run on localhost]       [GATE 4]
                                |
                                v
                    Day 2 morning
       [Real Qwen2.5-VL + Qwen3-Coder calls return JSON]       [GATE 5]
                                |
                                v
                    Day 2 midday
       [Approve flow updates virtual FS + score]               [GATE 6]
                                |
                                v
                    Day 2 afternoon
       [Finalize creates real PR on bot fork]                  [GATE 7]
                                |
                                v
                    Day 2 evening
       [Public Space serves a full end-to-end run]             [GATE 8]
                                |
                                v
                    Day 3 morning
       [3 dry runs per sample, no demo-blocking bugs]          [GATE 9]
                                |
                                v
                    Day 3 afternoon
       [Submission filed]                                       [GATE 10]
```

### 7.2 Gate validation commands

| Gate | Validation                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------- |
| 0    | `git branch --show-current` = `vken/v1`; `curl <amdpod>/v1/models` = 200; HF Space settings filled. |
| 1    | `pnpm --filter @open-design/contracts typecheck`; smoke test for `vken_*` tables exists and passes. |
| 2    | `pnpm --filter @open-design/daemon test` covers all algorithm + lint modules; all green.            |
| 3    | `node infra/space/smoke-day1.mjs sample landing-generic` (script TBD on Day 1) prints a valid index. |
| 4    | Manual: open `localhost:<webPort>/vken/run/<id>`, see live score and capture thumbnails.            |
| 5    | `node infra/space/smoke-day2.mjs vl  landing-generic` prints a parseable critique JSON.            |
| 5    | `node infra/space/smoke-day2.mjs coder landing-generic` prints 2 valid directions.                 |
| 6    | Manual: approve a patch, see AFTER iframe diverge from BEFORE within 1s.                            |
| 7    | A real PR URL on `vken-bot` returns 200; PR body matches §19.3.                                    |
| 8    | `curl https://huggingface.co/spaces/<ns>/vken/api/vken/samples` returns three samples.              |
| 9    | Logs from three back-to-back runs show no errors, no console warnings.                              |
| 10   | The lablab.ai submission ID is in hand and the page renders all fields.                             |

---

## 8. Parallelization strategy

If two builders are working in parallel (one human + one agent, or two
humans), use this split:

| Track A (engine, daemon-side)         | Track B (cockpit, web-side)           |
| ------------------------------------- | ------------------------------------- |
| Day 0: AMD pod, HF Space, scaffolding | Day 0: contracts skeleton, samples scoping |
| Day 1: contracts, db, algos, lint, intake, index, capture, score, runs, routes | Day 1: Hook, ScoreGauge, Cockpit shell, BeforeAfter, Timeline, useVkenSse |
| Day 2: vllm-client, critique, directions, propose, apply, validate, pr, memory, kb | Day 2: DirectionPicker, PatchList, PatchCard, KBPanel, LearnedToast, Leaderboard, polish |
| Day 3: dry-run logs, server-side fixes | Day 3: video, slides, cover, README |

Sync points:
- After Block 1 each day (contracts/types must agree).
- Before Block 5 Day 1 (cockpit can't render without runs.ts).
- Before Block 4 Day 2 (finalize end-to-end requires both).

---

## 9. Smoke tests and definition of done

### 9.1 The smoke command (Day 1+)

`infra/space/smoke.mjs` (created early on Day 1, evolves over time):

```
Day 1 form:    `node infra/space/smoke.mjs --no-llm sample landing-generic`
                must exit 0 with stdout containing
                `intake → scan → capture → score=0.42`.

Day 2 form:    `node infra/space/smoke.mjs sample landing-generic`
                must exit 0 with stdout ending in a real PR URL.
```

Run before every commit to `vken/v1`.

### 9.2 Definition of done per stage

| Stage    | Done when…                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------- |
| INGEST   | Cloning a public Vite + React + Tailwind URL produces a valid index in <30s.                      |
| SCAN     | `tokenCoverage`, `hardcodedValues`, `routes`, `components` all populated for all three samples.   |
| CAPTURE  | Six screenshots per sample (3 routes × 2 viewports) land on disk; ARIA YAML present.              |
| SCORE    | Initial score is in [0,100] for all three samples and reproducible across two runs (±2 points).   |
| DIRECTIONS | At least 2 valid `VkenDirection` JSONs returned in <30s on a warmed pod.                        |
| PROPOSE  | At least 5 patches per sample, each with a `search` string the engine can find verbatim.          |
| APPLY    | Approving any patch updates the AFTER iframe within 1s and increments the score gauge.            |
| SCRUB    | Scrubbing the timeline back to `initial` reverts AFTER iframe within 1s and resets the score.     |
| VALIDATE | `tsc` + `build` pass on all three samples after applying their respective top-5 patches.         |
| FINALIZE | A PR URL is returned in <60s; the PR body matches §19.3; clicking it lands on a real GitHub PR.   |
| LEARN    | At least one `vken:learn` event fires per run; the KB row count increases; signature verifies.    |

---

## 10. Escalation and cuts

If a gate slips, apply these cuts in order. Stop cutting as soon as the
schedule is recoverable.

### 10.1 Day 1 slips (engine deterministic)

1. Drop sample 3 (`ecommerce-basic`). Demo only on samples 1 and 2.
2. Drop the `mobile` viewport from capture. Desktop only.
3. Drop axe-core. Static a11y lint only.
4. Drop the cockpit's KB panel. (Add Day 3 if recovered.)

### 10.2 Day 2 slips (LLM, finalize)

1. Drop the third direction. Always 2 directions.
2. Cap proposals at 6 patches per direction (was 12).
3. Skip Tier 2 repo memory write. (Tier 1 + Tier 3 only.)
4. If `vken/pr.ts` is the slipping piece, ship a `bundle.zip` only path
   and stub the PR with a "PR coming soon — view bundle" link. Drop the
   PR claim from the demo video; emphasize the bundle.
5. If the Space build is the slipping piece, expose a tunneled localhost
   URL (e.g., Cloudflare Tunnel) as a temporary App URL, and migrate to
   the Space on Day 3 morning.

### 10.3 Day 3 slips (polish, video)

1. Use a 60s video instead of 90s. Cut the leaderboard segment.
2. Use a 6-slide deck instead of 12.
3. One build-in-public post instead of two — ship the day-of-submission
   one only. (We then qualify only for the main track prizes, not the
   build-in-public bonus, but ship V1.)

### 10.4 Hard cuts (do not breach)

These are non-negotiable. If at any point the schedule pressures one of
these, stop and reassess scope:

- A real PR. (Fall back: bundle download. Both: ideal.)
- A cockpit that streams live SSE. (No "pre-rendered video as the demo".)
- Three samples available in the bundle, even if only two are demoed.
- AMD MI300X actually serving inference (not a stub). Without this the
  AMD-specific story collapses.

---

## 11. Daily rituals

### 11.1 Morning (15 min)

- Read the previous day's tag's commit summary and the `polish.md` log.
- Pull the AMD pod state. Resume if working today.
- Confirm `pnpm typecheck` is green on `vken/v1`.
- Update the running TodoWrite list with today's blocks.

### 11.2 Mid-day (5 min)

- Run smoke: `node infra/space/smoke.mjs sample landing-generic`.
- If red, stop polishing and fix the smoke first.

### 11.3 End of day (15 min)

- `pnpm typecheck && pnpm test && pnpm build` — green or the day is not
  done.
- Tag `git tag day-N-end`.
- Pause the AMD pod.
- One-paragraph update in `polish.md` of "what's known broken / known
  ugly / known missing".
- Schedule tomorrow's first block.

---

## Appendix A — Quick command reference

### A.1 Local dev

```bash
pnpm install
pnpm tools-dev                                     # the existing local lifecycle
pnpm tools-dev start web                            # start web only
pnpm typecheck
pnpm test
pnpm build
```

### A.2 Smoke

```bash
node infra/space/smoke.mjs --help
node infra/space/smoke.mjs --no-llm sample landing-generic
node infra/space/smoke.mjs sample landing-generic
node infra/space/smoke.mjs url https://github.com/<owner>/<repo>
```

### A.3 AMD pod

```bash
ssh <amdpod>
bash infra/amd-cloud/start-vllm.sh
curl localhost:8000/v1/models
curl localhost:8001/v1/models
bash infra/amd-cloud/stop-vllm.sh
```

### A.4 Space

```bash
docker build -f infra/space/Dockerfile -t vken-space .
docker run --rm -p 7860:7860 \
  -e VKEN_VLLM_VL_URL=...   -e VKEN_VLLM_CODER_URL=... \
  -e VKEN_VLLM_TOKEN=...    -e VKEN_GITHUB_BOT_TOKEN=... \
  -e VKEN_KB_SIGNING_KEY=... \
  vken-space
git subtree push --prefix=. hf-space main
```

### A.5 Octokit smoke

```bash
node -e "
const { Octokit } = require('@octokit/rest');
const o = new Octokit({ auth: process.env.VKEN_GITHUB_BOT_TOKEN });
o.rest.users.getAuthenticated().then(r => console.log(r.data.login));
"
```

— end of document —
