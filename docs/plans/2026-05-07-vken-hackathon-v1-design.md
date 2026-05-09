# VKEN Design Engine — Hackathon V1 Design (Source of Truth)

| Field             | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Status            | Approved for build                                             |
| Author            | brainstormed in session 2026-05-07                             |
| Owner             | Kenny Chirombo                                                 |
| Target submission | AMD Developer Hackathon, Track 1 (AI Agents), 2026-05-10 23:59 |
| Build window      | 2026-05-07 → 2026-05-10                                        |
| Scope             | V1. No shortcuts, no shortwiring of V1 features.               |
| Successor         | V2 design (post-hackathon)                                     |

This document is the single source of truth for the VKEN hackathon V1 build.
Any builder, human or agent, who follows this document end to end MUST produce
the same system. If reality diverges from this document during the build, this
document is updated first; code follows.

The document deliberately specifies file paths, exact commands, exact model
identifiers, exact SQL, exact API shapes, and exact event schemas. It avoids
prose where a code block is more precise.

---

## Table of contents

1. [Goals and non-goals](#1-goals-and-non-goals)
2. [Locked decisions](#2-locked-decisions)
3. [Verified integrations and constraints](#3-verified-integrations-and-constraints)
4. [Architecture (topology)](#4-architecture-topology)
5. [Repository layout](#5-repository-layout)
6. [Module map](#6-module-map)
7. [Data flow (the VKEN loop)](#7-data-flow-the-vken-loop)
8. [Database schema](#8-database-schema)
9. [API contracts](#9-api-contracts)
10. [SSE event schema](#10-sse-event-schema)
11. [Patch model, virtual FS, and rollback](#11-patch-model-virtual-fs-and-rollback)
12. [Learning layer](#12-learning-layer)
13. [Visual gap algorithm chain](#13-visual-gap-algorithm-chain)
14. [Validation pipeline](#14-validation-pipeline)
15. [Anti-hallucination guardrails](#15-anti-hallucination-guardrails)
16. [Cockpit UX (web)](#16-cockpit-ux-web)
17. [AMD Developer Cloud runbook](#17-amd-developer-cloud-runbook)
18. [Hugging Face Space runbook](#18-hugging-face-space-runbook)
19. [GitHub PR finalization](#19-github-pr-finalization)
20. [Sample repos](#20-sample-repos)
21. [DesignBench](#21-designbench)
22. [Cost discipline and telemetry](#22-cost-discipline-and-telemetry)
23. [Build sequence (day-by-day)](#23-build-sequence-day-by-day)
24. [Submission checklist](#24-submission-checklist)
25. [Risk register](#25-risk-register)
26. [References (verified)](#26-references-verified)

---

## 1. Goals and non-goals

### 1.1 Goals (V1 must ship)

1. A public Hugging Face Space at the URL submitted as the hackathon
   "Application URL". Judges open it, paste a GitHub URL or pick a bundled
   sample, and watch a real Vite + React + Tailwind app improve in front of
   them.
2. A deterministic scan, three named design directions, ranked patch
   recommendations, side-by-side preview, and a **timeline scrubber** that
   lets a judge rewind to any earlier checkpoint instantly.
3. A finalize step that produces a **real GitHub PR** on a deterministic bot
   fork, plus a downloadable patched-repo bundle, plus a scorecard JSON.
4. **VKEN DesignBench** baked into the app: three sample apps, eight design
   debt scenarios, reproducible scores. Public leaderboard inside the app.
5. A live **learning layer** with three tiers (run, repo, global KB) that
   visibly biases ranking and adds "learned this run" cards to the timeline,
   without ever inventing rules from thin air.
6. AMD Developer Cloud usage that judges can verify: one MI300X pod serving
   `Qwen/Qwen2.5-VL-7B-Instruct` and `Qwen/Qwen3-Coder-30B-A3B-Instruct` via
   vLLM on ROCm, behind an OpenAI-compatible HTTPS endpoint.
7. A public GitHub repository fit for the "Public Repository" submission
   field — clean architecture, idempotent install, working CI.
8. Build-in-public assets: two technical updates with screen captures, one
   final demo video, slide deck, cover image.

### 1.2 Non-goals (V1 explicitly excludes)

The following are explicitly **out of scope** for V1. Any commit attempting to
add them must be rejected:

- "Implement approved design" mode (aka mode 2 from the original VKEN draft).
- "Design From Scratch" mode (aka mode 3 from the original VKEN draft).
- Local install path of VKEN itself. (The VKEN Design Engine daemon already supports
  local; we are not duplicating that surface.) Local is showcased in a screen
  recording only.
- Browser Use integration. Static analysis + Playwright programmatic capture
  only.
- Figma MCP bridge.
- Animation critique.
- LoRA fine-tune on accepted patches (V2).
- Multi-framework support (Next.js, Astro, Remix, etc.). **Vite + React +
  Tailwind only** for V1 intake.
- Authenticated routes inside target apps. Public routes only.
- Cross-tenant repo memory persistence beyond 7 days.
- Real-time provider switching at request time. The vLLM endpoint set is
  fixed for the demo.
- New npm dependencies in target workspaces. Patches do not introduce
  packages.

---

## 2. Locked decisions

Each decision below was confirmed during brainstorming on 2026-05-07. They
are immutable for V1; changing one requires a new revision of this document.

| ID    | Decision                                                                                  |
| ----- | ----------------------------------------------------------------------------------------- |
| D-01  | **Standalone Hugging Face Space** is the V1 surface. Reuses VKEN Design Engine daemon as a library. |
| D-02  | **Track 1** is the primary entry. Vision capability is a Track 3 secondary story.          |
| D-03  | Hook on landing: **live score-climb cockpit** with tagline "VKEN is all the creativity you need." |
| D-04  | Cockpit visualization: **horizontal timeline scrubber + side-by-side viewport + patch list**. |
| D-05  | Rollback model: **patch-stack with virtual FS preview**, real `git apply` only at finalize. |
| D-06  | Takeaway: **GitHub PR on bot fork + downloadable bundle + scorecard JSON**.                |
| D-07  | Frameworks supported: **Vite + React + Tailwind only**. Three bundled sample repos.        |
| D-08  | Models on AMD Cloud: **Qwen2.5-VL-7B-Instruct + Qwen3-Coder-30B-A3B-Instruct** via vLLM/ROCm. |
| D-09  | Engine runs on **HF Space CPU/T4 hardware**. AMD Cloud pod runs vLLM only.                 |
| D-10  | Learning layer: **three tiers** (run, repo, global KB). No model fine-tune in V1.          |
| D-11  | Anti-hallucination: **proposal-only writes** to KB, deterministic validators on every learned rule. |
| D-12  | DesignBench: **public, append-only**, ships in repo as JSON dataset, surfaced as in-app leaderboard. |
| D-13  | No GitHub OAuth from judge. Bot account opens PRs against a **bot-owned fork**.            |
| D-14  | Patch surface: **`.tsx` + `.css` + `tailwind.config.{js,ts}` only** for V1. No new files.  |
| D-15  | One MI300X pod, two vLLM endpoints, paused when not in use. Credit budget cap: $80 of $100.|

---

## 3. Verified integrations and constraints

Every external dependency below was verified against official documentation
on or before 2026-05-07. Any change in upstream behavior during the build
window MUST be reconciled with this section before code is touched.

### 3.1 Hugging Face Spaces

- Hardware list (verified): CPU Basic (free), CPU Upgrade ($0.03/hr), Nvidia
  T4 small ($0.40/hr), T4 medium, L4, L40S, A10G, A100. **No AMD Instinct
  hardware is offered as a Space tier.** ([HF Spaces GPUs](https://huggingface.co/docs/hub/spaces-gpus))
- Implication: VKEN runs the **engine on CPU Upgrade or T4 small**; the AMD
  MI300X compute lives on AMD Developer Cloud, reachable over HTTPS.
- Docker SDK Space: `sdk: docker` in the Space `README.md` YAML front matter.
  Default port `7860`, configurable via `app_port`. Container runs as UID
  `1000`. Build-time secrets via `--mount=type=secret`. Runtime secrets via
  environment variables. `/data` volume available **at runtime only**, not
  build time. Multiple internal ports allowed; only one public port via
  `app_port` (use Nginx if you need to multiplex). ([HF Docker SDK](https://huggingface.co/docs/hub/spaces-sdks-docker))
- Logs/events SSE: `GET /api/spaces/{ns}/{repo}/logs/run` available for
  observability.

### 3.2 vLLM on ROCm

- vLLM officially supports AMD ROCm GPUs in current stable. ([vLLM Installation](https://docs.vllm.ai/en/stable/getting_started/installation.html))
- Build target: ROCm 6.2+ on MI300-class hardware. Use the official
  `rocm/vllm-dev:main` image (or current stable tag) on the AMD Cloud pod.
- Serve command shape (vLLM OpenAI-compatible entrypoint):
  ```bash
  vllm serve "Qwen/Qwen2.5-VL-7B-Instruct" --port 8000 \
    --max-model-len 32768 --gpu-memory-utilization 0.40 \
    --trust-remote-code --enforce-eager
  vllm serve "Qwen/Qwen3-Coder-30B-A3B-Instruct" --port 8001 \
    --max-model-len 32768 --gpu-memory-utilization 0.55 \
    --trust-remote-code --enforce-eager
  ```
  Both share the single MI300X (192 GB HBM3). VRAM budget: 0.40 + 0.55 =
  0.95 of GPU memory, leaving headroom for activations.
- Both endpoints expose the same `/v1/chat/completions` shape used by
  `openai-python` and `openai-node`. Any OpenAI-compatible client works.

### 3.3 Qwen2.5-VL-7B-Instruct (visual critic)

- HF model id: `Qwen/Qwen2.5-VL-7B-Instruct`. ([model card](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct))
- Vision input is structured: `{"type": "image", "image": "<url-or-base64>"}`
  inside the message `content` array; the processor handles vision tokens
  internally. No raw `<|vision_start|>` injection needed.
- Grounding: model card states "Qwen2.5-VL can accurately localize objects in
  an image by generating bounding boxes or points, and it can provide stable
  JSON outputs for coordinates and attributes." VKEN exploits this for
  visual region annotation.
- Default context window: 32,768 tokens.
- Recommended serving: **vLLM** (primary), SGLang, Transformers.

### 3.4 Qwen3-Coder-30B-A3B-Instruct (patch generator)

- HF model id: `Qwen/Qwen3-Coder-30B-A3B-Instruct`. ([model card](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct))
- 30.5B total / 3.3B activated (MoE, 128 experts, 8 active).
- Native context 262,144 tokens, extendable to 1M with YaRN. **VKEN clamps
  to 32,768** to keep VRAM stable across both endpoints.
- Recommended sampling for agentic coding: `temperature=0.7`, `top_p=0.8`,
  `top_k=20`, `repetition_penalty=1.05`. **Non-thinking mode only** — model
  does not emit `<think></think>` blocks; do not request them.
- Tool-use: standard OpenAI-style `tools` array. VKEN does not register tools;
  it requests structured JSON outputs directly.

### 3.5 Playwright (capture + grounding)

- Daemon dependency. Install Chromium only.
- `locator.ariaSnapshot({ mode: "ai" })` returns YAML with `[ref=eN]`
  references — used for stable element grounding across a page. Added in
  Playwright 1.49. ([Playwright ariaSnapshot](https://playwright.dev/docs/api/class-locator#locator-aria-snapshot))
- VKEN uses the **programmatic Node.js API** only — no MCP server, no CLI
  subprocess.

### 3.6 Visual diff libraries

- `pixelmatch`: pure JS, perceptual color weighting (YIQ NTSC), zero native
  deps. Used for pixel-diff per region. ([pixelmatch](https://github.com/mapbox/pixelmatch))
- `pngjs`: PNG decoder/encoder for pixelmatch input.
- `img-diff-js`: pure JS SSIM. ([img-diff-js](https://github.com/reg-viz/img-diff-js))
- pHash: implemented inline (8x8 DCT-based perceptual hash, ~30 lines).

### 3.7 Accessibility

- `axe-core` injected into Playwright via `page.addScriptTag()` then
  invoked via `page.evaluate(() => axe.run(...))`. No native deps.

### 3.8 GitHub integration

- `@octokit/rest` for fork creation, branch creation, file commits, PR open.
- VKEN bot account credentials stored in HF Space secrets as
  `VKEN_GITHUB_BOT_TOKEN`. PAT scopes: `repo` (full control of bot's own
  forks). No OAuth from judge.

### 3.9 Existing VKEN Design Engine code (audited 2026-05-07)

The following modules already exist and are reused **as-is**:

| Path                                                  | Reuse role                                          |
| ----------------------------------------------------- | --------------------------------------------------- |
| `apps/daemon/src/agents.ts`                           | Provider-agnostic agent registry pattern (reference)|
| `apps/daemon/src/runs.ts`                             | `createChatRunService` factory; VKEN clones to a parallel `createVkenRunService` with the same shape |
| `apps/daemon/src/projects.ts`                         | `resolveSafe`, path traversal guards (pattern reused for target paths) |
| `apps/daemon/src/db.ts`                               | `openDatabase`, `migrate(db)`, idempotent CREATE pattern |
| `apps/daemon/src/design-systems.ts`                   | DESIGN.md parser (used at finalize to seed repo memory) |
| `apps/daemon/src/lint-artifact.ts`                    | Existing regex patterns; VKEN extends with target-workspace patterns |
| `apps/daemon/src/server.ts`                           | Express route registration pattern; VKEN mounts under `/api/vken/*` |
| `packages/contracts/src/sse/common.ts`                | `SseTransportEvent<Name, Payload>` generic; VKEN reuses verbatim |
| `packages/contracts/src/sse/chat.ts`                  | `ChatSseEvent` reference shape; VKEN's `VkenSseEvent` follows the exact same union pattern |
| `apps/web/src/providers/sse.ts`                       | `parseSseFrame`; reused verbatim                    |
| `apps/web/src/providers/daemon.ts`                    | Fetch-based SSE client pattern                      |
| `apps/web/src/components/FileViewer.tsx`              | Diff viewer for patch detail                        |
| `apps/web/app/[[...slug]]/page.tsx`                   | Catch-all SPA shell; VKEN routes flow through it    |

The following modules are **created new** (see [Module map](#6-module-map)):

- All under `apps/daemon/src/vken/*`
- All under `apps/web/src/components/vken/*`
- `packages/contracts/src/api/vken.ts`
- `packages/contracts/src/sse/vken.ts`

The following modules are **extended** with strictly additive changes:

- `apps/daemon/src/db.ts` — append `vken_*` tables to `migrate(db)`
- `apps/daemon/src/server.ts` — register `/api/vken/*` routes
- `apps/daemon/package.json` — add deps listed in §6.4
- `apps/web/src/client-app.tsx` — register `/vken` route in the existing client router
- `packages/contracts/src/index.ts` — re-export new vken contracts

### 3.10 Repository constraints (from `AGENTS.md`)

- Workspace packages: `apps/*`, `packages/*`, `tools/*`, `e2e`. No restoring
  `apps/nextjs` or `packages/shared`.
- pnpm 10.33.2, Node ~24, TypeScript-first.
- Shared API DTOs and SSE shapes live in `packages/contracts` and must remain
  pure TypeScript.
- App business logic must not know about sidecar/control-plane concepts.
- No root lifecycle aliases; use `pnpm tools-dev` for local dev.
- After package or workspace changes: run `pnpm install`, `pnpm typecheck`,
  `pnpm test`. For build-related changes: also `pnpm build`.
- No `Co-authored-by` trailers in commits.
- Daemon writes data under `<projectRoot>/.od/` by default; `OD_DATA_DIR`
  override is honored (used by the Space deployment to point storage at
  `/data`).

---

## 4. Architecture (topology)

```
+---------------------------------------------------------------------------+
|  HUGGING FACE SPACE  (Docker SDK, CPU Upgrade $0.03/hr)                   |
|  Public URL = the hackathon "Application URL"                             |
|                                                                           |
|  Single container, port 7860 -> Nginx -> {                                |
|    - Next.js cockpit  (apps/web build, served as static + SSR shell)     |
|    - Node engine      (apps/daemon library, Express, port 17456)         |
|    - Playwright Chromium                                                  |
|    - better-sqlite3 at /data/vken.sqlite                                 |
|    - git CLI                                                              |
|  }                                                                        |
|                                                                           |
|  Secrets (Space settings):                                                |
|    VKEN_VLLM_VL_URL     = https://<amd-pod>.amd.cloud:8000/v1            |
|    VKEN_VLLM_CODER_URL  = https://<amd-pod>.amd.cloud:8001/v1            |
|    VKEN_VLLM_TOKEN      = <bearer>                                        |
|    VKEN_GITHUB_BOT_TOKEN= <pat scoped to bot account repos>              |
|    VKEN_KB_SIGNING_KEY  = <hmac key for KB rule signatures>              |
+--------------------------+------------------------------------------------+
                           |
                           |  HTTPS (OpenAI-compatible /v1/chat/completions)
                           |  Bearer-token authenticated.
                           v
+---------------------------------------------------------------------------+
|  AMD DEVELOPER CLOUD  (1x MI300X, 192 GB HBM3, ROCm 6.2)                  |
|  Pod runs ONLY vLLM. No public UI.                                        |
|                                                                           |
|  vllm-vl       :8000   Qwen/Qwen2.5-VL-7B-Instruct       (vision)        |
|                        --max-model-len 32768                              |
|                        --gpu-memory-utilization 0.40                      |
|                                                                           |
|  vllm-coder    :8001   Qwen/Qwen3-Coder-30B-A3B-Instruct (patch gen)     |
|                        --max-model-len 32768                              |
|                        --gpu-memory-utilization 0.55                      |
|                                                                           |
|  Reverse proxy in front, terminates TLS, enforces bearer token.           |
|  Pause command: stop pod when not running demos. Resume in <60s.          |
+---------------------------------------------------------------------------+
                           |
                           |  Octokit (REST)
                           v
+---------------------------------------------------------------------------+
|  GITHUB                                                                   |
|  Bot user: vken-bot  (or equivalent)                                      |
|  Workflow per finalize:                                                   |
|    1. Fork sample repo into vken-bot/<repo>-<runId>                      |
|    2. Push branch vken/run-<runId> with squashed approved patches         |
|    3. Open PR against vken-bot/<repo>-<runId>:main with scorecard body    |
|  Judge sees a real, clickable, mergeable PR.                              |
+---------------------------------------------------------------------------+
```

### 4.1 Layer responsibilities

**HF Space**
- Web cockpit, engine orchestration, Playwright capture, deterministic
  scoring, KB read/write, sample-repo fixtures, GitHub PR finalization.
- All non-LLM work happens here.
- All target workspace files live in **ephemeral container disk** under
  `/tmp/vken/<runId>/` (or `/data/vken/runs/<runId>/` if Space has the
  `/data` volume attached; we default to `/data` and fall back to `/tmp`).

**AMD Cloud pod**
- vLLM only. Two endpoints, no other services.
- Inputs: chat-completion requests with vision content (VL endpoint) or
  large code context (Coder endpoint).
- Outputs: structured JSON or fenced JSON code blocks.

**GitHub**
- Permanent record of finalized runs. Judges click into a real PR.

### 4.2 Why not run the engine on AMD Cloud?

- The Space SDK is the natural surface for the "Application URL" submission
  field; making the public URL point at an AMD Cloud pod adds DNS, TLS, and
  CORS work that does not buy us anything.
- Playwright Chromium on AMD Cloud is fine but unnecessary. The engine has
  no GPU dependency.
- Splitting cleanly: orchestration on Space, inference on AMD. Mirrors how
  most production AI apps are structured.
- The Space's CPU Upgrade tier is more than enough for our concurrency
  profile (one judge run at a time during the demo).

### 4.3 Concurrency model

- Engine handles **one VKEN run at a time** in V1. Subsequent requests queue.
- Per-run isolation: a unique `runId`, a unique target dir, a unique
  in-memory virtual FS, a unique SSE event channel.
- vLLM endpoints handle concurrent requests internally; engine sends them in
  parallel where the algorithm allows (e.g., scoring multiple regions).

---

## 5. Repository layout

VKEN ships inside the **existing** `open-design` monorepo. No new repo. The
public submission URL points at this repo's GitHub remote (or a fresh repo
that is a fork-friendly subset; default: existing repo).

```
open-design/
├── apps/
│   ├── daemon/
│   │   ├── package.json                  EXTEND (add deps; §6.4)
│   │   └── src/
│   │       ├── db.ts                     EXTEND (append vken_* tables)
│   │       ├── server.ts                 EXTEND (mount /api/vken routes)
│   │       └── vken/                     NEW (V1 engine)
│   │           ├── runs.ts               NEW (createVkenRunService factory)
│   │           ├── targets.ts            NEW
│   │           ├── intake.ts             NEW (clone + sandbox)
│   │           ├── index-build.ts        NEW (Stage 0 static index)
│   │           ├── runner.ts             NEW (vite dev server lifecycle)
│   │           ├── capture.ts            NEW (Playwright capture)
│   │           ├── score.ts              NEW (deterministic scoring)
│   │           ├── directions.ts         NEW (Tier C: Qwen3-Coder)
│   │           ├── critique.ts           NEW (Tier B: Qwen2.5-VL)
│   │           ├── propose.ts            NEW (Tier B: Qwen3-Coder)
│   │           ├── apply.ts              NEW (in-memory patch stack)
│   │           ├── validate.ts           NEW (build/tsc/diff/a11y)
│   │           ├── memory.ts             NEW (Tier 1/2 memory)
│   │           ├── kb.ts                 NEW (Tier 3 global KB)
│   │           ├── pr.ts                 NEW (Octokit finalize)
│   │           ├── vllm-client.ts        NEW (OpenAI-compat client)
│   │           ├── algorithms/
│   │           │   ├── phash.ts          NEW
│   │           │   ├── pixel-diff.ts     NEW (wraps pixelmatch)
│   │           │   ├── ssim.ts           NEW (wraps img-diff-js)
│   │           │   └── visual-gap.ts     NEW (composite)
│   │           ├── lint/
│   │           │   ├── tokens.ts         NEW
│   │           │   ├── hardcoded.ts      NEW
│   │           │   ├── radius.ts         NEW
│   │           │   └── a11y.ts           NEW (axe-core wrapper)
│   │           └── types.ts              NEW (internal types only;
│   │                                          public types are in
│   │                                          packages/contracts)
│   ├── web/
│   │   └── src/
│   │       ├── client-app.tsx            EXTEND (register /vken route)
│   │       └── components/vken/          NEW
│   │           ├── VkenApp.tsx           NEW (root)
│   │           ├── Hook.tsx              NEW (landing live-score climb)
│   │           ├── Cockpit.tsx           NEW
│   │           ├── Timeline.tsx          NEW (scrubber)
│   │           ├── BeforeAfter.tsx       NEW
│   │           ├── PatchList.tsx         NEW
│   │           ├── PatchCard.tsx         NEW
│   │           ├── ScoreGauge.tsx        NEW
│   │           ├── DirectionPicker.tsx   NEW
│   │           ├── KBPanel.tsx           NEW (Tier 3 view)
│   │           ├── LearnedToast.tsx      NEW (intra-run learning surfacer)
│   │           ├── Leaderboard.tsx       NEW (DesignBench)
│   │           └── useVkenSse.ts         NEW (hook over parseSseFrame)
├── packages/
│   └── contracts/
│       └── src/
│           ├── api/
│           │   └── vken.ts               NEW (request/response DTOs)
│           ├── sse/
│           │   └── vken.ts               NEW (VkenSseEvent union)
│           └── index.ts                  EXTEND (re-export vken)
├── samples/                              NEW (bundled demo repos)
│   ├── landing-generic/                  Vite+React+Tailwind
│   ├── dashboard-cluttered/              Vite+React+Tailwind
│   └── ecommerce-basic/                  Vite+React+Tailwind
├── infra/
│   └── space/                            NEW (HF Space packaging)
│       ├── Dockerfile                    NEW
│       ├── nginx.conf                    NEW
│       ├── start.sh                      NEW
│       ├── README.md                     NEW (Space front-matter)
│       └── .gitattributes                NEW
├── infra/
│   └── amd-cloud/                        NEW (vLLM pod scripts)
│       ├── README.md
│       ├── start-vllm.sh                 NEW
│       └── stop-vllm.sh                  NEW
└── docs/
    └── plans/
        └── 2026-05-07-vken-hackathon-v1-design.md   THIS DOCUMENT
```

The `samples/` directory is **inside** the public repo so judges can browse
the source. The bundled VKEN demo also lists them as one-click options.

---

## 6. Module map

### 6.1 Engine module responsibilities (single sentence each)

| Module                              | Responsibility                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `vken/runs.ts`                      | In-memory run registry, SSE fan-out, terminal-status cleanup. Mirrors `createChatRunService`.   |
| `vken/targets.ts`                   | Target metadata CRUD. Each judge ingest = one target.                                           |
| `vken/intake.ts`                    | Clone GitHub URL or copy bundled sample into `${VKEN_RUNS_DIR}/<runId>/repo`. Detect framework. |
| `vken/index-build.ts`               | Stage 0 static index: framework, package manager, Tailwind version, routes, components, tokens, hardcoded values. |
| `vken/runner.ts`                    | Start/stop the target's `vite dev` server inside the sandbox, wait for port, return URL.        |
| `vken/capture.ts`                   | Use Playwright to capture screenshots, ARIA snapshot (`mode: "ai"`), CSS vars, box models.      |
| `vken/score.ts`                     | Deterministic composite scoring: token coverage, contrast, hierarchy heuristics, build health.  |
| `vken/critique.ts`                  | Tier B / Qwen2.5-VL-7B: visual gap, region grounding (bounding boxes from VL).                  |
| `vken/directions.ts`                | Tier B / Qwen3-Coder: produce 2–3 named design directions as structured JSON.                   |
| `vken/propose.ts`                   | Tier B / Qwen3-Coder: produce ranked patch list per direction, with file paths and search/replace hunks. |
| `vken/apply.ts`                     | Virtual filesystem patch stack with scrub support. Real `git apply` only at finalize.           |
| `vken/validate.ts`                  | Build, `tsc --noEmit`, recapture, pixel diff, axe a11y, console scan. Returns `ValidationResult`. |
| `vken/memory.ts`                    | Tier 1 (run) and Tier 2 (per-repo, 7-day) memory. JSON files in `/data/vken/memory/`.           |
| `vken/kb.ts`                        | Tier 3 global KB: append-only signed JSONL, retrieval over (finding-type, framework, severity). |
| `vken/pr.ts`                        | Octokit-based fork + branch + commit + PR creation. Idempotent per `runId`.                    |
| `vken/vllm-client.ts`               | OpenAI-compatible HTTP client. Two configured endpoints (VL, Coder). Retries + structured-output parsing. |
| `vken/algorithms/phash.ts`          | 8x8 perceptual hash for fast image-similarity pre-filter.                                       |
| `vken/algorithms/pixel-diff.ts`     | Wrapper around `pixelmatch`. Returns diff ratio + diff PNG path.                                |
| `vken/algorithms/ssim.ts`           | Wrapper around `img-diff-js`. Returns SSIM in [0,1].                                            |
| `vken/algorithms/visual-gap.ts`     | Composite gap score per §13.                                                                    |
| `vken/lint/*`                       | Deterministic regex/PostCSS lints used during Stage 0 and validation.                           |

### 6.2 Web component responsibilities (single sentence each)

| Component                              | Responsibility                                                              |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `vken/VkenApp.tsx`                     | Root for `/vken` route. Owns run state, SSE subscription.                   |
| `vken/Hook.tsx`                        | Landing screen: live score climb on a pre-baked sample run, "VKEN is all the creativity you need." |
| `vken/Cockpit.tsx`                     | Layout: timeline (bottom), before/after viewport (center), patch list + KB panel (right). |
| `vken/Timeline.tsx`                    | Horizontal scrubber over checkpoints. Click = jump. Hover = preview thumb.   |
| `vken/BeforeAfter.tsx`                 | Two iframes side-by-side, synced scroll. Annotated overlays from VL grounding. |
| `vken/PatchList.tsx`                   | Ordered cards. Approve, skip, view diff. Uses `FileViewer` for diff render. |
| `vken/PatchCard.tsx`                   | Single patch card: severity, impact, risk, files, rationale, evidence.      |
| `vken/ScoreGauge.tsx`                  | Animated radial gauge. Live score with color thresholds.                    |
| `vken/DirectionPicker.tsx`             | 2–3 named cards. One must be selected before patches load.                  |
| `vken/KBPanel.tsx`                     | "What VKEN knows" — global rules with evidence counts. Read-only.           |
| `vken/LearnedToast.tsx`                | Slide-in card during a run: "Learned: …" with citation back to KB row.      |
| `vken/Leaderboard.tsx`                 | DesignBench: rows per (sample × scenario) with current best score-delta.    |
| `vken/useVkenSse.ts`                   | Subscribe to `/api/vken/runs/:id/sse`, dispatch typed events to component state. |

### 6.3 Generation order (idempotent build)

When implementing, build modules in this order so each step compiles in
isolation:

1. `packages/contracts/src/api/vken.ts` (DTOs)
2. `packages/contracts/src/sse/vken.ts` (event union)
3. `packages/contracts/src/index.ts` (re-exports)
4. `apps/daemon/src/db.ts` migration extension
5. `apps/daemon/src/vken/types.ts`
6. `apps/daemon/src/vken/algorithms/*` (pure functions, easy to test)
7. `apps/daemon/src/vken/lint/*`
8. `apps/daemon/src/vken/intake.ts` + `vken/index-build.ts`
9. `apps/daemon/src/vken/runner.ts` + `vken/capture.ts`
10. `apps/daemon/src/vken/score.ts`
11. `apps/daemon/src/vken/vllm-client.ts`
12. `apps/daemon/src/vken/critique.ts` + `vken/directions.ts` + `vken/propose.ts`
13. `apps/daemon/src/vken/apply.ts` + `vken/validate.ts`
14. `apps/daemon/src/vken/memory.ts` + `vken/kb.ts`
15. `apps/daemon/src/vken/pr.ts`
16. `apps/daemon/src/vken/runs.ts`
17. `apps/daemon/src/server.ts` route mounts
18. `apps/web/src/components/vken/*` (in dependency order; ScoreGauge first
    because Hook uses it)
19. `apps/web/src/client-app.tsx` route registration
20. `samples/*` repos
21. `infra/space/*` Dockerfile + Nginx + start.sh
22. `infra/amd-cloud/*` vLLM scripts

### 6.4 New dependencies

Add to `apps/daemon/package.json` `dependencies`:

```json
{
  "@octokit/rest": "^21.0.0",
  "axe-core": "^4.10.0",
  "img-diff-js": "^0.5.5",
  "pixelmatch": "^7.1.0",
  "playwright": "^1.49.1",
  "pngjs": "^7.0.0",
  "postcss": "^8.4.49",
  "postcss-selector-parser": "^7.0.0",
  "simple-git": "^3.27.0"
}
```

Add to `apps/daemon/package.json` `devDependencies`:

```json
{
  "@types/pixelmatch": "^5.2.6",
  "@types/pngjs": "^6.0.5"
}
```

Run `pnpm install` from repo root after editing.
After install, run: `pnpm --filter @open-design/daemon exec playwright install --with-deps chromium`
(the Space Dockerfile runs the same command at build time).

No new dependencies for `apps/web` — Tailwind, React, etc. are already in.

---

## 7. Data flow (the VKEN loop)

### 7.1 Stages

```
INGEST -> SCAN -> CAPTURE -> SCORE -> DIRECTIONS -> PROPOSE -> APPLY (scrub) -> VALIDATE -> FINALIZE -> LEARN
```

Every stage emits one or more SSE events. Stages are gated; the next never
starts before the previous emits its terminal event.

### 7.2 Stage detail

#### 7.2.1 INGEST

- Input: `{ url: string } | { sampleId: 'landing-generic' | 'dashboard-cluttered' | 'ecommerce-basic' }`.
- `git clone --depth 1 <url> /data/vken/runs/<runId>/repo` for URL ingest.
  For samples, copy from `samples/<sampleId>` into the same target.
- Detect framework. **Reject** if not Vite + React + Tailwind. (See §3 for
  the supported set.)
- Emit: `vken:intake { repo: { name, url, sample? }, framework: 'vite-react-tailwind' }`.

#### 7.2.2 SCAN

- Build `WorkspaceIndex` (see §8.5 for schema). All deterministic — no LLM.
- Sub-passes:
  - Read `package.json`, detect package manager from lockfile.
  - Detect Tailwind version (`tailwind.config.{ts,js}` for v3, `@theme` in
    CSS for v4). Reject mixed setups in V1.
  - Walk routes via React Router file conventions or `App.tsx` analysis.
    For samples, route inventory is also pre-baked in `samples/<id>/.vken/routes.json`
    as a fixture for deterministic demo runs.
  - PostCSS pass over all CSS files for token extraction.
  - Hardcoded value lint (`vken/lint/hardcoded.ts`).
  - Compute `tokenCoverageRatio`.
- Emit: `vken:scan { duration, components: N, routes: N, hardcodedValues: N, tokenCoverage: 0..1 }`.

#### 7.2.3 CAPTURE

- Run `pnpm install --prefer-offline` (or `npm install --prefer-offline`)
  with a 60-second hard timeout. Cached node_modules tarballs for sample
  repos are pre-built into the Space image, so installs for samples are
  near-instant.
- Run `vite dev` (or `npm run dev`) on a free port. Wait up to 30 seconds
  for HTTP 200 on `/`.
- Capture each route at viewports `desktop = 1440x900` and `mobile = 375x812`.
- Per route+viewport persist:
  - `screenshot.png`
  - `aria.yml` (`locator.ariaSnapshot({ mode: "ai" })`)
  - `css-vars.json`
  - `box-models.json` (for `h1, h2, .hero, nav, [data-cta], button, .card`,
    first 3 each)
  - `console.json`
- Stop the dev server immediately after the last capture.
- Emit `vken:capture` per route as the work proceeds, terminal `vken:capture { done: true, count: N }`.

#### 7.2.4 SCORE (initial)

- Compute the V1 composite (see §13.4) from deterministic signals only.
- Emit: `vken:score { runId, when: 'initial', value, dimensions: { ... } }`.

#### 7.2.5 DIRECTIONS

- Tier B prompt to **Qwen3-Coder-30B** with the workspace index summary,
  Stage-1 audit, sampled box models, and explicit constraints (preserve
  routes, preserve components, no new packages).
- System prompt asks for **2 named directions** as structured JSON. Three is
  optional and only added if the model emits a third without prompting.
- Output schema (see §9.4 for full TypeScript): name, mood, summary, change
  bullets, effort, risk, KB-cited evidence rules.
- Emit: `vken:direction` per direction. Terminal `vken:direction { done: true }`.

#### 7.2.6 PROPOSE

- After the user picks a direction (or auto-pick after 5s for the demo
  landing hook), Tier B prompt to **Qwen3-Coder-30B** asks for a ranked
  patch list against that direction.
- Inputs: workspace index, direction object, evidence patches retrieved
  from Tier 3 KB by similarity, hardcoded-value lint findings.
- Output: `PatchPlan` (see §11) — ordered, each patch as a structured JSON
  object with file path, search/replace hunks, severity, impact, risk,
  patchable score, evidence references.
- Emit: `vken:patch` per patch. Terminal `vken:propose { done: true, count: N }`.

#### 7.2.7 APPLY (scrub)

- All patches start in state `proposed`.
- User clicks Approve on any subset. Approved patches enter the **virtual
  filesystem** (see §11). The preview iframe re-renders against the virtual
  state.
- The timeline scrubber stores one **checkpoint** per patch + the `initial`
  state. Scrubbing = swap virtual FS to the checkpoint.
- Per-checkpoint pixel diff is computed lazily against the checkpoint's
  cached screenshot. (Only key routes; not every viewport.)
- No real disk writes happen at this stage.

#### 7.2.8 VALIDATE

- Triggered when the user clicks **Finalize**.
- Materialize the virtual FS to disk in a fresh worktree (`git apply` from
  the patch stack).
- Run `pnpm install` (cached), `tsc --noEmit`, `npm run build`.
- If build fails: emit `vken:validate { stage: 'build', ok: false, error }`
  and offer a "Retry without patch X" rollback.
- If build passes: re-run capture + a11y (`axe-core`).
- Compute the post-patch composite score.
- Emit: `vken:validate { ok, scoreBefore, scoreAfter, dimensions }`.

#### 7.2.9 FINALIZE

- Open Octokit. Authenticate as the bot.
- Idempotent: if a PR for `(runId, sampleId)` already exists, return its
  URL.
- Steps (see §19 for full sequence):
  1. Ensure fork `vken-bot/<sample-or-repo>-<runId>` exists. Create if not.
  2. Push branch `vken/run-<runId>` with squashed commits per patch.
  3. Open PR against `<bot>/<repo>:main` with body templated from §19.3.
- Emit: `vken:finalize { prUrl, bundleUrl, scorecardUrl }`.

#### 7.2.10 LEARN

- Memory Curator builds `LearningProposal[]` from the run.
- Each proposal MUST include `evidence: { patchIds: string[], scoreDelta: number, runId }`.
- Tier 1 (run): always written.
- Tier 2 (repo): written only if user opted in (default off in V1, but the
  bot fork run always has Tier 2 enabled — that is how cross-run memory
  becomes visible to subsequent judge runs).
- Tier 3 (KB): proposal queued. Validator runs (see §15.3). On pass, append
  to `kb.jsonl`.
- Emit: `vken:learn` per item. Terminal `vken:learn { done: true, accepted, queued }`.

### 7.3 Visual flow (per stage SSE timeline)

```
client            engine
  |  POST /api/vken/runs                 (body: { intake })
  |--------------------------------------------->
  |  201 { runId }
  |<---------------------------------------------
  |
  |  GET /api/vken/runs/<runId>/sse
  |--------------------------------------------->
  |  event: vken:intake     data: {...}
  |  event: vken:scan       data: {...}
  |  event: vken:capture    data: {...}            (one per route)
  |  event: vken:capture    data: { done: true }
  |  event: vken:score      data: { when: 'initial' }
  |  event: vken:direction  data: {...}            (one per direction)
  |  event: vken:direction  data: { done: true }
  |
  |  POST /api/vken/runs/<runId>/direction
  |  body: { directionId }
  |--------------------------------------------->
  |  event: vken:patch      data: {...}            (one per patch)
  |  event: vken:propose    data: { done: true }
  |
  |  POST /api/vken/runs/<runId>/approve
  |  body: { patchIds: [...] }
  |--------------------------------------------->
  |  event: vken:apply      data: { patchId, ok: true, scoreDelta }
  |  ... (scrub events as user moves the slider)
  |
  |  POST /api/vken/runs/<runId>/finalize
  |--------------------------------------------->
  |  event: vken:validate   data: { stage: 'build', ok: true }
  |  event: vken:validate   data: { stage: 'a11y',  ok: true }
  |  event: vken:validate   data: { stage: 'pixel', ok: true, ratio: 0.18 }
  |  event: vken:finalize   data: { prUrl, bundleUrl }
  |  event: vken:learn      data: {...}
  |  event: end             data: { status: 'succeeded' }
```

---

## 8. Database schema

VKEN tables are appended to the daemon SQLite DB created by `openDatabase()`
in `apps/daemon/src/db.ts`. All `CREATE TABLE` statements are
`IF NOT EXISTS`. All column adds use the existing `PRAGMA table_info` guard
pattern.

In Space deployments, `OD_DATA_DIR=/data` is set; the file lives at
`/data/.od/app.sqlite`. Locally, the file lives at `<projectRoot>/.od/app.sqlite`.

```sql
-- 8.1 vken_targets
CREATE TABLE IF NOT EXISTS vken_targets (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL CHECK(source IN ('url','sample')),
  source_ref      TEXT NOT NULL,         -- the URL or the sampleId
  framework       TEXT NOT NULL DEFAULT 'vite-react-tailwind',
  package_manager TEXT NOT NULL DEFAULT 'npm',
  tailwind_version INTEGER,
  workspace_path  TEXT NOT NULL,         -- absolute path inside the container
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vken_targets_source
  ON vken_targets(source, source_ref);

-- 8.2 vken_runs
CREATE TABLE IF NOT EXISTS vken_runs (
  id                TEXT PRIMARY KEY,
  target_id         TEXT NOT NULL REFERENCES vken_targets(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK(status IN ('queued','running','succeeded','failed','canceled')),
  started_at        INTEGER,
  ended_at          INTEGER,
  score_initial     REAL,
  score_final       REAL,
  direction_id      TEXT,
  patches_proposed  INTEGER DEFAULT 0,
  patches_approved  INTEGER DEFAULT 0,
  pr_url            TEXT,
  bundle_path       TEXT,
  vllm_input_tokens INTEGER DEFAULT 0,
  vllm_output_tokens INTEGER DEFAULT 0,
  created_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vken_runs_target
  ON vken_runs(target_id, created_at DESC);

-- 8.3 vken_captures
CREATE TABLE IF NOT EXISTS vken_captures (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES vken_runs(id) ON DELETE CASCADE,
  checkpoint      TEXT NOT NULL,         -- 'initial' | 'patch:<patchId>' | 'final'
  route_path      TEXT NOT NULL,
  viewport        TEXT NOT NULL CHECK(viewport IN ('desktop','mobile')),
  screenshot_path TEXT NOT NULL,
  aria_yaml       TEXT,
  css_vars_json   TEXT,
  box_models_json TEXT,
  console_json    TEXT,
  captured_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vken_captures_run_cp
  ON vken_captures(run_id, checkpoint, route_path, viewport);

-- 8.4 vken_directions
CREATE TABLE IF NOT EXISTS vken_directions (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES vken_runs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  mood            TEXT NOT NULL,
  summary         TEXT NOT NULL,
  changes_json    TEXT NOT NULL,         -- string[] of bullet points
  effort          TEXT NOT NULL CHECK(effort IN ('low','medium','high')),
  risk            TEXT NOT NULL CHECK(risk IN ('low','medium','high')),
  evidence_kb_ids TEXT,                  -- JSON array of KB rule ids cited
  is_chosen       INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

-- 8.5 vken_findings
CREATE TABLE IF NOT EXISTS vken_findings (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES vken_runs(id) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK(source IN ('static','vl','score')),
  dimension     TEXT NOT NULL,
  severity      TEXT NOT NULL CHECK(severity IN ('P0','P1','P2','P3')),
  description   TEXT NOT NULL,
  affected_files TEXT NOT NULL,         -- JSON array
  region_box    TEXT,                   -- JSON {x,y,w,h} for VL findings
  resolved_by   TEXT,                   -- patch id or NULL
  created_at    INTEGER NOT NULL
);

-- 8.6 vken_patches
CREATE TABLE IF NOT EXISTS vken_patches (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES vken_runs(id) ON DELETE CASCADE,
  finding_ids   TEXT NOT NULL,          -- JSON array
  file_path     TEXT NOT NULL,
  format        TEXT NOT NULL CHECK(format IN ('search-replace','full-rewrite','json-edit')),
  hunks_json    TEXT NOT NULL,          -- the patch content
  rationale     TEXT NOT NULL,
  severity      TEXT NOT NULL CHECK(severity IN ('P0','P1','P2','P3')),
  impact        REAL NOT NULL,
  risk          REAL NOT NULL,
  effort        REAL NOT NULL,
  confidence    REAL NOT NULL,
  patchable     REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'proposed'
                CHECK(status IN ('proposed','approved','skipped','applied','reverted')),
  evidence_kb_ids TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vken_patches_run
  ON vken_patches(run_id, status, created_at);

-- 8.7 vken_validations
CREATE TABLE IF NOT EXISTS vken_validations (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES vken_runs(id) ON DELETE CASCADE,
  stage        TEXT NOT NULL CHECK(stage IN ('build','tsc','a11y','pixel','console')),
  ok           INTEGER NOT NULL,
  details_json TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

-- 8.8 vken_kb_rules (Tier 3 global KB)
CREATE TABLE IF NOT EXISTS vken_kb_rules (
  id              TEXT PRIMARY KEY,
  finding_type    TEXT NOT NULL,
  framework       TEXT NOT NULL DEFAULT 'vite-react-tailwind',
  severity        TEXT NOT NULL CHECK(severity IN ('P0','P1','P2','P3')),
  rule_text       TEXT NOT NULL,
  accept_count    INTEGER NOT NULL DEFAULT 0,
  reject_count    INTEGER NOT NULL DEFAULT 0,
  avg_score_delta REAL NOT NULL DEFAULT 0,
  evidence_runs   TEXT NOT NULL,        -- JSON array of run ids contributing
  signature       TEXT NOT NULL,        -- HMAC over (id, rule_text, accept, reject, avg_delta)
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vken_kb_rules_lookup
  ON vken_kb_rules(finding_type, framework, severity);

-- 8.9 vken_kb_examples (concrete patches retrievable as few-shot)
CREATE TABLE IF NOT EXISTS vken_kb_examples (
  id              TEXT PRIMARY KEY,
  rule_id         TEXT NOT NULL REFERENCES vken_kb_rules(id) ON DELETE CASCADE,
  finding_summary TEXT NOT NULL,
  patch_format    TEXT NOT NULL,
  patch_json      TEXT NOT NULL,
  score_delta     REAL NOT NULL,
  source_run_id   TEXT,
  created_at      INTEGER NOT NULL
);

-- 8.10 vken_repo_memory (Tier 2, 7-day TTL)
CREATE TABLE IF NOT EXISTS vken_repo_memory (
  repo_hash       TEXT PRIMARY KEY,     -- sha256 of normalized URL
  memory_json     TEXT NOT NULL,
  ttl_at          INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- 8.11 vken_run_memory (Tier 1, ephemeral but persisted for SSE replay)
CREATE TABLE IF NOT EXISTS vken_run_memory (
  run_id          TEXT PRIMARY KEY REFERENCES vken_runs(id) ON DELETE CASCADE,
  memory_json     TEXT NOT NULL,
  updated_at      INTEGER NOT NULL
);
```

### 8.5 Authoritative WorkspaceIndex shape (in code)

This is the JSON object passed across SSE and stored in `vken_runs` via the
serialised `memory_json` column. Defined in `packages/contracts/src/api/vken.ts`:

```typescript
export interface VkenWorkspaceIndex {
  framework: 'vite-react-tailwind';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  tailwindVersion: 3 | 4;
  routes: Array<{
    path: string;
    componentFile: string;
    auth: false;       // V1: public only
  }>;
  components: Array<{
    file: string;
    name: string;
    lines: number;
    primitives: string[]; // e.g. ['Button', 'Card']
  }>;
  tokens: {
    colors: Record<string, string>;
    spacings: Record<string, string>;
    radii: Record<string, string>;
    coverageRatio: number;
  };
  hardcodedValues: Array<{
    file: string;
    line: number;
    kind: 'color' | 'spacing' | 'radius';
    value: string;
  }>;
  dependencies: Record<string, string>;
}
```

---

## 9. API contracts

All routes live under `/api/vken/`. Auth: none for V1 (public Space). Rate
limit: 1 active run per IP, enforced by `vken/runs.ts`. Body parser:
existing Express `json()` middleware on the daemon.

### 9.1 Run lifecycle

```
POST   /api/vken/runs
GET    /api/vken/runs/:runId
GET    /api/vken/runs/:runId/sse
POST   /api/vken/runs/:runId/direction
POST   /api/vken/runs/:runId/approve
POST   /api/vken/runs/:runId/scrub
POST   /api/vken/runs/:runId/finalize
POST   /api/vken/runs/:runId/cancel
```

### 9.2 Read-only

```
GET    /api/vken/samples
GET    /api/vken/runs                       (list, paginated)
GET    /api/vken/leaderboard
GET    /api/vken/kb                         (top N rules)
GET    /api/vken/kb/:ruleId                 (rule detail with examples)
GET    /api/vken/captures/:captureId/screenshot.png
GET    /api/vken/runs/:runId/bundle.zip     (post-finalize)
GET    /api/vken/runs/:runId/scorecard.json (post-finalize)
```

### 9.3 Request/response DTOs (TypeScript)

`packages/contracts/src/api/vken.ts`:

```typescript
// 9.3.1 Create run
export interface VkenCreateRunRequest {
  intake:
    | { kind: 'url'; url: string }
    | { kind: 'sample'; sampleId: 'landing-generic' | 'dashboard-cluttered' | 'ecommerce-basic' };
  enableRepoMemory?: boolean; // Tier 2 opt-in. Default false.
}

export interface VkenCreateRunResponse {
  runId: string;
  status: 'queued';
}

// 9.3.2 Pick a direction
export interface VkenPickDirectionRequest {
  directionId: string;
}
export interface VkenPickDirectionResponse {
  ok: true;
}

// 9.3.3 Approve patches
export interface VkenApprovePatchesRequest {
  patchIds: string[];
}
export interface VkenApprovePatchesResponse {
  ok: true;
  applied: string[];
  failed: Array<{ patchId: string; reason: string }>;
}

// 9.3.4 Scrub timeline
export interface VkenScrubRequest {
  checkpoint: 'initial' | { patchId: string };
}
export interface VkenScrubResponse {
  scoreAt: number;
  pixelDeltaToInitial: number;
}

// 9.3.5 Finalize
export interface VkenFinalizeResponse {
  prUrl: string;
  bundleUrl: string;
  scorecardUrl: string;
  scoreBefore: number;
  scoreAfter: number;
}

// 9.3.6 Run status
export interface VkenRunStatusResponse {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  startedAt: number | null;
  endedAt: number | null;
  scoreInitial: number | null;
  scoreFinal: number | null;
  patchesProposed: number;
  patchesApproved: number;
  prUrl: string | null;
}

// 9.3.7 Leaderboard
export interface VkenLeaderboardRow {
  sampleId: string;
  scenarioId: string;
  bestScoreDelta: number;
  bestRunId: string;
  attempts: number;
}
export interface VkenLeaderboardResponse {
  rows: VkenLeaderboardRow[];
  generatedAt: number;
}
```

### 9.4 Direction object (over SSE)

```typescript
export interface VkenDirection {
  id: string;
  name: string;            // e.g. 'Quiet Premium'
  mood: string;            // one short paragraph
  summary: string;         // one short paragraph
  changes: string[];       // 3-6 bullet points
  effort: 'low' | 'medium' | 'high';
  risk:   'low' | 'medium' | 'high';
  evidenceKbIds: string[]; // KB rule ids cited as supporting this direction
}
```

### 9.5 Patch object (over SSE)

```typescript
export interface VkenPatch {
  id: string;
  findingIds: string[];
  filePath: string;
  format: 'search-replace';
  hunks: Array<{ search: string; replace: string }>;
  rationale: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  impact: number;          // 0..1
  risk:   number;          // 0..1
  effort: number;          // 0..1
  confidence: number;      // 0..1
  patchable: number;       // (impact * confidence) / (risk + 0.1)
  evidenceKbIds: string[];
  status: 'proposed' | 'approved' | 'skipped' | 'applied' | 'reverted';
}
```

V1 is **search/replace only**. Full rewrites and AST edits are V2.

### 9.6 Error shape

Reuse the existing `ApiError` and `ApiErrorResponse` types from
`packages/contracts/src/errors.ts`. New error codes needed:

```typescript
export type VkenErrorCode =
  | 'VKEN_INTAKE_FAILED'
  | 'VKEN_FRAMEWORK_UNSUPPORTED'
  | 'VKEN_DEV_SERVER_TIMEOUT'
  | 'VKEN_VLLM_UNREACHABLE'
  | 'VKEN_PATCH_NO_MATCH'
  | 'VKEN_VALIDATION_FAILED'
  | 'VKEN_PR_FAILED'
  | 'VKEN_RATE_LIMITED'
  | 'VKEN_NOT_FOUND';
```

---

## 10. SSE event schema

`packages/contracts/src/sse/vken.ts`:

```typescript
import type { SseTransportEvent } from './common';
import type { SseErrorPayload } from '../errors';

export interface VkenIntakePayload {
  repo: { name: string; sourceRef: string; sample?: string };
  framework: 'vite-react-tailwind';
}
export interface VkenScanPayload {
  durationMs: number;
  components: number;
  routes: number;
  hardcodedValues: number;
  tokenCoverage: number;
  done?: boolean;
}
export interface VkenCapturePayload {
  routePath?: string;
  viewport?: 'desktop' | 'mobile';
  screenshotUrl?: string;
  done?: boolean;
  count?: number;
}
export interface VkenScorePayload {
  when: 'initial' | 'final' | 'scrub';
  value: number;
  dimensions: {
    designQuality: number;
    tokenCoverage: number;
    accessibility: number;
    responsive: number;
    buildHealth: number;
  };
}
export interface VkenDirectionPayload extends Partial<VkenDirection> {
  done?: boolean;
}
export interface VkenPatchPayload extends Partial<VkenPatch> {
  done?: boolean;
}
export interface VkenApplyPayload {
  patchId: string;
  ok: boolean;
  reason?: string;
  scoreDelta?: number;
  pixelDeltaToInitial?: number;
}
export interface VkenValidatePayload {
  stage: 'build' | 'tsc' | 'a11y' | 'pixel' | 'console';
  ok: boolean;
  details?: unknown;
}
export interface VkenFinalizePayload {
  prUrl: string;
  bundleUrl: string;
  scorecardUrl: string;
}
export interface VkenLearnPayload {
  ruleId?: string;
  ruleText?: string;
  evidenceRunIds?: string[];
  status?: 'proposed' | 'accepted' | 'rejected';
  done?: boolean;
}

export type VkenSseEvent =
  | SseTransportEvent<'vken:intake',   VkenIntakePayload>
  | SseTransportEvent<'vken:scan',     VkenScanPayload>
  | SseTransportEvent<'vken:capture',  VkenCapturePayload>
  | SseTransportEvent<'vken:score',    VkenScorePayload>
  | SseTransportEvent<'vken:direction',VkenDirectionPayload>
  | SseTransportEvent<'vken:patch',    VkenPatchPayload>
  | SseTransportEvent<'vken:apply',    VkenApplyPayload>
  | SseTransportEvent<'vken:validate', VkenValidatePayload>
  | SseTransportEvent<'vken:finalize', VkenFinalizePayload>
  | SseTransportEvent<'vken:learn',    VkenLearnPayload>
  | SseTransportEvent<'error',         SseErrorPayload>
  | SseTransportEvent<'end',           { status: 'succeeded' | 'failed' | 'canceled' }>;

export type VkenSseEventName = VkenSseEvent extends SseTransportEvent<infer N, unknown> ? N : never;
```

The `vken:capture` event payload doubles as a per-route progress event AND
a terminal `{ done: true, count }` event — exactly the same pattern used in
the SSE event union for `vken:direction`, `vken:patch`, and `vken:learn`.

---

## 11. Patch model, virtual FS, and rollback

### 11.1 The patch object on disk

A patch is a JSON document. It is `format: 'search-replace'` only in V1.
Each `hunk` has a `search` (literal string) and `replace` (literal string).
The engine applies hunks **in order, left-to-right, first match only**. A
non-match is a hard error: the patch is marked `status: 'skipped'` with a
`VKEN_PATCH_NO_MATCH` reason; the user sees the unmatched string in the UI.

### 11.2 Virtual filesystem during scrub

For each run, the engine maintains a `Map<filePath, content>` keyed by
absolute paths inside the workspace. This is the "virtual FS".

- Initial state (after Stage 1): file contents are read on demand from the
  cloned repo and cached in the map.
- Approve patch P: apply P's hunks against the cached content, store the
  result back into the map under the same key. Push a checkpoint
  `{ patchId: P.id, files: <changed file paths>, scoreAt, pixelDeltaToInitial }`
  onto the run's checkpoint stack.
- Skip patch P: no change to the map.
- **Scrub** to checkpoint K: reset the virtual FS by replaying patches
  `[initial...K]` from scratch over the cached initial contents. (Idempotent
  by construction.)

The preview iframe uses an internal route
`/api/vken/runs/:runId/preview/<routePath>` that streams the **virtual FS
HTML** for that route — i.e., the engine starts a fresh Vite SSR rendering
pass against the virtual content, captures the HTML, and serves it. For V1
this is implemented by writing the virtual FS to a per-checkpoint disk dir
(`/data/vken/runs/<runId>/preview/<checkpoint>/`) lazily and serving the
already-running `vite preview` from that dir. We chose this over in-memory
Vite to keep the moving parts small.

### 11.3 Why scrub can't be a real `git apply` per checkpoint

- Per-checkpoint `git apply` + `npm run build` would burst CPU and stall the
  scrubber by 10–60 seconds per click. Demo dies.
- Patch-stack scrub gives sub-100ms response. Real apply is deferred to
  finalize, where the user has paid attention to the cost anyway.
- This was the explicit user decision (D-05).

### 11.4 Real materialization at finalize

At Finalize the engine:

1. Creates a fresh worktree dir `/data/vken/runs/<runId>/final/repo`.
2. `git -C ... clone` from the original sandbox. (Local clone, fast.)
3. Computes a unified diff per approved patch from cached file contents.
4. `git apply --index --whitespace=nowarn` each diff in order.
5. `git commit -m "vken: <patch.rationale>"` per patch (or squashes if more
   than 6 patches).
6. Runs validation (§14).
7. If pass, hands off to `vken/pr.ts` (§19).

### 11.5 Patch ordering

Engine sorts patches by `patchable = (impact * confidence) / (risk + 0.1)`,
descending. UI honors that order; user can reorder on the client only for
display. The applied order is whatever the user approves; reordering across
approve clicks is allowed.

---

## 12. Learning layer

This section is the formal contract for §2.5 of the brainstorm — the
"VKEN gets demonstrably smarter without hallucinating" piece.

### 12.1 Tier 1 — Run memory

- Lifetime: one run.
- Storage: `vken_run_memory` table, JSON document.
- Contents:
  - The workspace index summary.
  - Approved/skipped patches with their findings.
  - Resolved finding IDs (so `propose.ts` excludes them on subsequent
    proposal passes within the same run).
  - The current direction.
- Rule: **`propose.ts` must never re-propose a finding marked resolved by an
  approved patch in the same run.** Enforcement is deterministic — a
  set-difference filter, not the model's judgement.

### 12.2 Tier 2 — Repo memory (opt-in, 7 days)

- Lifetime: 7 days from last update, or until manually deleted.
- Storage: `vken_repo_memory` table keyed by `sha256(normalised URL)`.
- Default: **off** for arbitrary URL ingest. **On** for sample repos (so the
  demo demonstrates "VKEN remembers the sample from previous runs").
- Contents:
  - Aggregated DESIGN.md draft (extracted at finalize).
  - Token decisions.
  - Cached workspace index for fast subsequent runs.
  - `lastRunSummary` (one paragraph).
- Privacy: nothing tied to the user's identity is stored. Hash only.

### 12.3 Tier 3 — Global KB

- Lifetime: indefinite.
- Storage: `vken_kb_rules` + `vken_kb_examples` + signed JSONL backup
  (`/data/vken/kb.jsonl`, signed line-by-line via `VKEN_KB_SIGNING_KEY`).
- Public: yes — the KB ships in the GitHub repo as `kb/seed.jsonl` with the
  same signature scheme. Demo Space initializes its DB by replaying the
  seed.
- Contents: per `(finding_type, framework, severity)`:
  - `accept_count`, `reject_count`
  - `avg_score_delta` (rolling)
  - `evidence_runs` (max 50 ids; LRU)
  - `rule_text` (free-form, but always derived from real evidence; see
    §15.3)
  - Up to 10 `vken_kb_examples` per rule.

### 12.4 Retrieval

`propose.ts` calls `kb.retrieve({ findingType, framework, severity, k: 3 })`
and includes the returned examples as **few-shot**, not authoritative
context. The model is free to disagree, but the prompt biases it toward
patterns that have empirically helped.

```typescript
export interface KbRetrievalResult {
  rule: VkenKbRule;
  examples: VkenKbExample[];
  similarity: number; // 0..1
}
```

`similarity` for V1 is computed by simple field overlap (finding type +
severity + framework + token similarity over the rule text vs. the current
finding's description). No vector DB. We can swap to embeddings in V2.

### 12.5 Policy weights

For ranking patches inside a run:

```
adjusted_patchable = base_patchable * (1 + accept_rate - reject_rate)
                     where accept_rate = accept / (accept + reject + 5)   // smoothed
                           reject_rate = reject / (accept + reject + 5)
```

This is **pure arithmetic**, no LLM. It nudges the order; it never adds or
removes patches.

### 12.6 Convergence demo

The DesignBench leaderboard runs a script every 10 minutes that:

1. Picks the bot fork's latest run for each (sample, scenario).
2. Plots that run's `score_final - score_initial`.
3. Shows the rolling 5-run average score-delta per (sample, scenario).

The seed KB ships pre-populated with ~50 prior runs of these samples. Live
runs append. The leaderboard's 5-run average **moves visibly upward** as
judges drive runs that contribute new evidence.

---

## 13. Visual gap algorithm chain

Run fastest-first; stop on conclusive result.

### 13.1 pHash (pre-filter)

```typescript
const distance = hamming(pHash(a), pHash(b)); // distance ∈ [0, 64]
if (distance < 6)  return { match: 'identical', score: 1.0 };
```

### 13.2 pixelmatch (per-pixel diff)

```typescript
import pixelmatch from 'pixelmatch';
const diffPixels = pixelmatch(a, b, diffOut, w, h, {
  threshold: 0.1,
  includeAA: false,
});
const diffRatio = diffPixels / (w * h);
```

### 13.3 SSIM (structural)

```typescript
import { compareImages } from 'img-diff-js';
const { ssim } = await compareImages(a, b);
```

### 13.4 Composite

```typescript
visualGap = (diffRatio * 0.5) + ((1 - ssim) * 0.3) + (Math.min(d, 32) / 32 * 0.2);
// where d = pHash hamming distance
```

Thresholds:
- `< 0.02` → no meaningful change
- `0.02–0.10` → minor (P2/P3)
- `> 0.10` → significant (P0/P1)

### 13.5 Composite design score (0..1)

```
score = 0.30 * designQuality +
        0.20 * tokenCoverage +
        0.20 * accessibility +
        0.15 * responsive +
        0.15 * buildHealth
```

Where each sub-dimension is in [0,1]. `buildHealth = 1` if build & tsc pass,
`0.6` if only tsc passes, `0` otherwise. `tokenCoverage` is the workspace
index ratio, clamped. `accessibility = 1 - clamp(violations / 20, 0, 1)`.
`responsive = 1 - max(layoutShiftDesktop, layoutShiftMobile)`. `designQuality`
is computed by a rubric-bound prompt to Qwen2.5-VL with a regex fallback (see
§15.2 for the structured-output guardrails).

The displayed user-facing score is `Math.round(score * 100)` so it reads as
"42 → 78" on the gauge.

---

## 14. Validation pipeline

### 14.1 Sequence

```
1. tsc --noEmit            (fail-fast type check)
2. npm run build           (production build)
3. vite preview            (serve dist on a free port)
4. capture                 (recapture all routes/viewports)
5. axe-core via Playwright (a11y violations)
6. console scan            (any new errors since initial)
7. visual diff             (each route at each viewport)
8. compose final score
```

### 14.2 Failure handling

- `tsc` fail → emit `vken:validate { stage: 'tsc', ok: false, details: { errors } }`,
  abort. UI offers "Drop the patch most associated with these files" (uses
  `affectedFiles` overlap).
- `build` fail → same shape, abort.
- `axe` fail with **new** violations (compared to initial) → continue but
  surface as warnings; do not block PR.
- Pixel diff regression > 0.10 vs initial on a previously-clean route →
  warn; do not block.

### 14.3 Time budgets

- `tsc`: 30s hard timeout
- `build`: 90s
- `vite preview` warmup: 30s
- recapture: ~10s per route at two viewports
- axe: 5s per route
- pixel diff: <1s per route

Total expected wall time at finalize on the bundled sample: ~90s.

### 14.4 Caching

- node_modules pre-warmed in the Space image for sample repos.
- Per-run worktrees are evicted from `/data/vken/runs/` after 1 hour or when
  disk usage > 4 GB, whichever first.

---

## 15. Anti-hallucination guardrails

The product's credibility hinges on this section. The rules below are
non-negotiable.

### 15.1 Deterministic-first ordering

LLM is **never** the first source of a finding. Order:

1. Static index (regex, PostCSS, file walk).
2. Playwright capture (computed styles, ARIA, console, axe).
3. Pixel/SSIM diff.
4. **Then** Qwen2.5-VL for visual grounding overlays.
5. **Then** Qwen3-Coder for patch synthesis.

The model can refine a finding's description but cannot invent a finding.

### 15.2 Structured output, schema-validated, regex-fallback

All LLM responses are parsed via a strict JSON schema validator (`zod` or
hand-rolled `validate()` per shape). On failure:

1. First: try to extract a fenced ```json``` block from the response.
2. Second: re-prompt once with a tighter "schema only, no prose" instruction.
3. Third: discard. Skip the call's contribution. Surface to the user as a
   non-fatal log line.

Never pass un-validated LLM output to the next stage.

### 15.3 KB write validation

A `LearningProposal` is only accepted into Tier 3 if:

- `evidence.patchIds.length >= 1`, and every id resolves to a real `applied`
  patch in the SQLite DB.
- `evidence.scoreDelta` matches the sum of the proposal's evidence patches'
  `scoreDelta` within ±0.01 (otherwise the model fabricated the number).
- `rule_text` does not contain claims about specific file paths from the
  evidence run. (Rules must generalise; specific paths are private to the
  run.)
- Signing: HMAC-SHA256 with `VKEN_KB_SIGNING_KEY` over the canonical JSON.

If any check fails, the proposal is rejected and **never written**, with a
log line `kb.reject { runId, reason }`.

### 15.4 No "freelance" patch generation

`propose.ts` system prompt explicitly forbids:

- Patches that touch files not present in the workspace index.
- Patches that introduce new packages (Tailwind plugins, libraries).
- Patches that touch `package.json`, `lockfiles`, `vite.config.*`, or
  `tailwind.config.*` in V1. (The single exception is token additions to
  `tailwind.config.{ts,js}`, which is allowed but flagged risk: medium.)
- Patches whose `search` string the model claims exists but that the
  engine cannot find. Engine validates by `string.includes` before sending
  the patch to the user.

### 15.5 The "don't ask twice" rule

Within a run, after a finding F has been resolved by an approved patch:

- Subsequent `propose.ts` invocations see the resolved set as a hard filter.
- The KB write proposal for F is suppressed if already proposed for the
  same `(finding_type, severity)` in this run.

Across runs (Tier 3), the same `(finding_type, framework, severity)` key
collapses to one row; counts increment. The model receives **one** rule per
key in the few-shot retrieval, not duplicate evidence.

### 15.6 Watchdogs

- Any vLLM call that exceeds 60 seconds is canceled and logged. The stage
  proceeds with a deterministic fallback (e.g., "no direction selected →
  pick the highest-`patchable` patch and call the direction 'Quiet
  improvement'").
- `propose.ts` returns at most 12 patches per direction. Anything beyond is
  truncated.

---

## 16. Cockpit UX (web)

### 16.1 Routes

The existing `apps/web/app/[[...slug]]/page.tsx` catch-all renders
`<ClientApp />`. Inside `client-app.tsx`, register a new branch:

```typescript
// apps/web/src/client-app.tsx (snippet)
if (pathname === '/' || pathname.startsWith('/vken')) {
  return <VkenApp pathname={pathname} />;
}
```

Within `VkenApp`:
- `/` or `/vken`            → `<Hook />` (landing live-score climb)
- `/vken/run/:id`           → `<Cockpit runId={id} />`
- `/vken/leaderboard`       → `<Leaderboard />`
- `/vken/kb`                → `<KBPanel mode="full" />`

### 16.2 Hook screen content

Above the fold:

```
+------------------------------------------------+
|  VKEN is all the creativity you need.          |
|  An agentic design-repair cockpit for          |
|  existing frontends.                           |
|                                                |
|     [   42 ============>    78   ]             |
|                                                |
|   Now improving:  samples/landing-generic      |
|                                                |
|  [Try a sample]  [Paste GitHub URL]            |
|  [Watch the demo (90s)]                        |
+------------------------------------------------+
```

The gauge animates against a pre-baked run's events (replayed from
`/api/vken/runs/<seedRunId>/sse?replay=true`) so the page is always alive
even if no judge has started a run yet.

### 16.3 Cockpit screen layout

```
+----------------------------------------------------------------+
|  TOP BAR: run id, status, model badges (Qwen2.5-VL, Qwen3-Coder)|
+--------------------+-------------------+----------------------+
|  BEFORE iframe     |  AFTER iframe    |  PATCH LIST          |
|  current source    |  virtual FS      |  ranked, approve/skip|
|                    |                   |  patch cards         |
|                    |                   |                      |
+--------------------+-------------------+----------------------+
|  TIMELINE SCRUBBER (one node per checkpoint, drag to scrub)   |
|  [o]---[o]---[o]---[X]---[ ]---[ ]                            |
|  init  scan  score patch3 ...                                  |
+----------------------------------------------------------------+
|  KB PANEL (collapsible right): "What VKEN learned this run"   |
+----------------------------------------------------------------+
```

### 16.4 Annotated overlays

When Qwen2.5-VL returns bounding boxes for a finding, the cockpit overlays
clickable annotated regions on the BEFORE iframe. Clicking the overlay
expands the matching patch card.

### 16.5 Empty/error states

- `Vken-framework-unsupported`: friendly "VKEN V1 supports Vite + React +
  Tailwind. Try one of the bundled samples."
- `vllm-unreachable`: "Inference pod paused. The maintainer is woken up.
  Try the bundled samples meanwhile — those run with cached examples."
- For samples: the engine has a "demo-resilient" path that uses cached
  cassettes (recorded vLLM responses) so judges can always see a run.

### 16.6 Accessibility & responsiveness of the cockpit

- Keyboard: Tab through patch cards, Enter to expand, Space to approve.
- Color blocks for severity (P0 red, P1 orange, P2 amber, P3 grey).
- Mobile: stacked layout (BEFORE on top, AFTER below, patch list under,
  timeline collapsed to a stepper).

### 16.7 Replay & resume

- `useVkenSse` honors `Last-Event-ID` so a closed tab can resume mid-run.
- All run state is rebuildable from the SSE event log, which is persisted
  per `vken_runs.id` in `vken/runs.ts`.

---

## 17. AMD Developer Cloud runbook

### 17.1 Provisioning

1. Activate AMD AI Developer Program credits ($100). Note: 30-day expiry.
2. Provision a Single MI300X instance via the AMD Developer Cloud console.
   Region: pick the cheapest option that has MI300X availability.
3. SSH to the instance.
4. Install ROCm 6.2 if not preinstalled (most images have it).
5. `docker pull rocm/vllm-dev:main` (or current stable tag — verify with
   `docker images` and the date tag).

### 17.2 Start vLLM endpoints

Save as `infra/amd-cloud/start-vllm.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Start the vision endpoint (Qwen2.5-VL-7B) on port 8000.
docker run -d --name vllm-vl \
  --device /dev/kfd --device /dev/dri \
  --shm-size=16g \
  -e HF_HUB_ENABLE_HF_TRANSFER=1 \
  -e HF_TOKEN="${HF_TOKEN:-}" \
  -p 8000:8000 \
  rocm/vllm-dev:main \
  vllm serve "Qwen/Qwen2.5-VL-7B-Instruct" \
    --port 8000 \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.40 \
    --trust-remote-code \
    --enforce-eager

# Start the coder endpoint (Qwen3-Coder-30B-A3B) on port 8001.
docker run -d --name vllm-coder \
  --device /dev/kfd --device /dev/dri \
  --shm-size=16g \
  -e HF_HUB_ENABLE_HF_TRANSFER=1 \
  -e HF_TOKEN="${HF_TOKEN:-}" \
  -p 8001:8001 \
  rocm/vllm-dev:main \
  vllm serve "Qwen/Qwen3-Coder-30B-A3B-Instruct" \
    --port 8001 \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.55 \
    --trust-remote-code \
    --enforce-eager

# Health probes.
sleep 60
curl -fsSL http://localhost:8000/v1/models
curl -fsSL http://localhost:8001/v1/models
```

### 17.3 Reverse proxy (TLS + bearer)

Use Caddy or Nginx in front to terminate TLS and enforce a bearer token.
Caddy recipe (preferred for automatic TLS):

```caddy
amd-vllm.example.com {
  @authed {
    header Authorization "Bearer {$VKEN_VLLM_TOKEN}"
  }

  handle_path /vl/* {
    reverse_proxy @authed http://localhost:8000
  }
  handle_path /coder/* {
    reverse_proxy @authed http://localhost:8001
  }
  respond 401
}
```

Set in HF Space secrets:
```
VKEN_VLLM_VL_URL    = https://amd-vllm.example.com/vl/v1
VKEN_VLLM_CODER_URL = https://amd-vllm.example.com/coder/v1
VKEN_VLLM_TOKEN     = <bearer token>
```

### 17.4 Pause / resume

Save as `infra/amd-cloud/stop-vllm.sh`:

```bash
#!/usr/bin/env bash
docker stop vllm-vl vllm-coder || true
docker rm   vllm-vl vllm-coder || true
```

Pause via the AMD Cloud console between runs to stop accruing credits.

### 17.5 Credit budget

| Activity                          | Hours | Cost (estimated) |
| --------------------------------- | ----- | ---------------- |
| Initial setup + smoke tests       | 2     | $5               |
| Build week interactive iteration  | 18    | $45              |
| Demo polish + dry runs            | 6     | $15              |
| Live demo + judge submissions     | 4     | $10              |
| Buffer for retries                | 2     | $5               |
| **Total**                         | 32    | **$80** of $100  |

Pause aggressively. The cockpit shows a "AMD pod paused — wake?" CTA for
internal team use.

---

## 18. Hugging Face Space runbook

### 18.1 Space metadata

`infra/space/README.md` (this becomes the Space repo README):

```yaml
---
title: VKEN — VKEN Design Engine Cockpit
emoji: 🛠
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
short_description: Agentic design-repair cockpit for existing frontends.
---
```

### 18.2 Dockerfile

`infra/space/Dockerfile`:

```dockerfile
# Stage 1: build the daemon + web bundles
FROM node:24-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /src
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools
COPY samples ./samples
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# Stage 2: runtime
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y \
      git ca-certificates curl bash \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
      libcairo2 libasound2 nginx \
   && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
WORKDIR /home/user/app
COPY --from=build --chown=user:user /src ./
USER user

# Pre-install Playwright Chromium with system deps
RUN cd apps/daemon && npx playwright install chromium

# Pre-warm sample repo node_modules to make captures fast.
RUN bash -lc 'for d in samples/*/; do (cd "$d" && npm install --prefer-offline --no-audit --no-fund); done'

COPY --chown=user:user infra/space/nginx.conf  /home/user/app/nginx.conf
COPY --chown=user:user infra/space/start.sh    /home/user/app/start.sh
RUN chmod +x /home/user/app/start.sh

ENV OD_DATA_DIR=/data
ENV OD_PORT=17456
ENV OD_WEB_PORT=17573
EXPOSE 7860

CMD ["/home/user/app/start.sh"]
```

### 18.3 Nginx multiplex

`infra/space/nginx.conf`:

```nginx
worker_processes auto;
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  sendfile on;

  upstream daemon {
    server 127.0.0.1:17456;
  }
  upstream web {
    server 127.0.0.1:17573;
  }

  server {
    listen 7860 default_server;
    proxy_buffering off;          # required for SSE
    proxy_read_timeout 1h;        # SSE long polls

    location /api/ {
      proxy_pass http://daemon;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
      proxy_pass http://web;
    }
  }
}
```

### 18.4 Start script

`infra/space/start.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Daemon (engine)
node apps/daemon/dist/cli.js --no-open &
DAEMON_PID=$!

# Web (Next.js)
( cd apps/web && node node_modules/next/dist/bin/next start -p "$OD_WEB_PORT" ) &
WEB_PID=$!

# Reverse proxy
nginx -g 'daemon off;' -c /home/user/app/nginx.conf &
NGINX_PID=$!

trap "kill $DAEMON_PID $WEB_PID $NGINX_PID" EXIT
wait -n
```

### 18.5 Secrets

Set in Space settings (Settings > Variables and secrets):

| Name                   | Required | Purpose                                  |
| ---------------------- | -------- | ---------------------------------------- |
| `VKEN_VLLM_VL_URL`     | yes      | Qwen2.5-VL endpoint (`/v1`)              |
| `VKEN_VLLM_CODER_URL`  | yes      | Qwen3-Coder endpoint (`/v1`)             |
| `VKEN_VLLM_TOKEN`      | yes      | Bearer for both                          |
| `VKEN_GITHUB_BOT_TOKEN`| yes      | PAT for the bot account                  |
| `VKEN_KB_SIGNING_KEY`  | yes      | HMAC key for KB signatures               |
| `HF_TOKEN`             | no       | Only if private models are needed (V1: no) |

### 18.6 Build & push

The Space repo is its own git remote. Two-remote workflow:

```bash
git remote add hf-space https://huggingface.co/spaces/<ns>/vken
git subtree push --prefix=. hf-space main
```

Or — preferred — set up a GitHub Actions workflow on the open-design repo
that pushes the relevant subtree to the Space remote on tag.

### 18.7 Sleep configuration

Configure the Space to **never sleep** during the hackathon week. Set
custom sleep time to 30+ days. Pause manually after submission to stop
billing.

---

## 19. GitHub PR finalization

### 19.1 Bot account setup

1. Create a GitHub user `vken-bot` (or use an existing org bot).
2. Generate a fine-grained PAT with these scopes (account-scoped):
   - `Contents: Read and write`
   - `Pull requests: Read and write`
   - `Workflows: Read` (no write)
   Repository access: All bot-owned forks.
3. Store as `VKEN_GITHUB_BOT_TOKEN` in the Space secrets.

### 19.2 Octokit flow (`vken/pr.ts`)

```typescript
import { Octokit } from '@octokit/rest';

export async function finalizePr(args: {
  octokit: Octokit;
  bot: string;                // 'vken-bot'
  upstream: { owner: string; repo: string };
  runId: string;
  approvedPatches: VkenPatch[];
  scorecard: ScorecardJson;
}): Promise<{ prUrl: string; bundleUrl: string }> {
  // 1. Idempotent: if a PR with matching `runId` exists, return it.
  // 2. Ensure fork: POST /repos/:owner/:repo/forks; set name to
  //    `${repo}-${runId}` to keep separate per-run.
  // 3. Create branch `vken/run-${runId}` off the fork's default branch.
  // 4. For each approved patch in order, create a commit via the Git Data API
  //    (createTree + createCommit + updateRef). Squash if patches > 6.
  // 5. POST /repos/:owner/:repo/pulls with body templated from §19.3.
  // 6. Return { prUrl, bundleUrl } where bundleUrl is /api/vken/runs/:runId/bundle.zip.
}
```

### 19.3 PR body template

```markdown
# VKEN: design-debt repair (+{{scoreDelta}} score)

VKEN ran on `{{repoName}}` and produced this auto-generated change set.

## Scorecard

| Dimension       | Before | After | Δ      |
| --------------- | ------ | ----- | ------ |
| Design quality  | {{a}}  | {{b}} | {{ab}} |
| Token coverage  | {{c}}  | {{d}} | {{cd}} |
| Accessibility   | {{e}}  | {{f}} | {{ef}} |
| Responsive      | {{g}}  | {{h}} | {{gh}} |
| Build health    | {{i}}  | {{j}} | {{ij}} |

## Patches ({{approvedCount}} approved, {{skippedCount}} skipped)

{{#each approvedPatches}}
- `{{this.severity}}` **{{this.filePath}}** — {{this.rationale}}
  [evidence]({{this.evidenceUrl}})
{{/each}}

## Validation

- `tsc --noEmit` ✓
- `npm run build` ✓
- axe-core: no new violations
- pixel diff vs initial: {{pixelDiffPct}}%

## Run

- runId: `{{runId}}`
- direction: **{{directionName}}**
- bundle: [bundle.zip]({{bundleUrl}})
- live cockpit: [open in VKEN]({{cockpitUrl}})

🛠 Generated with [VKEN](https://huggingface.co/spaces/{{spaceNs}}/vken).
```

### 19.4 Idempotency

- The PR body's first H1 includes the runId in HTML comment form.
- Before opening, search the bot's open PRs for `vken-run-{{runId}}` in
  body. If found, return its URL. Never duplicate.

### 19.5 Failure modes

- 403 (rate limit, scope issue): emit `vken:finalize { ok: false, reason: 'github-403' }`.
  Cockpit offers a "download bundle only" path.
- Network: 3 retries with exponential backoff. After third failure, downgrade to bundle-only.

---

## 20. Sample repos

Three Vite + React + Tailwind repos under `samples/`. Each is intentionally
rough so the demo's improvements are legible.

### 20.1 `samples/landing-generic`

A generic SaaS landing page.

Intentional debt:
- Hardcoded colors (`#3b82f6`, `#1f2937`) in 6 components.
- Hero uses 36px font where target scale would be 60px+.
- Three button radii in use (4px, 8px, 12px).
- No focus-visible styles.
- No mobile breakpoint adjustments on the hero.

### 20.2 `samples/dashboard-cluttered`

A dashboard with weak hierarchy and density problems.

Intentional debt:
- Card padding 8–12px (target 24/16).
- Headings only one size step apart.
- Table contrast under WCAG AA on neutral row.
- 47 hardcoded values total.

### 20.3 `samples/ecommerce-basic`

A product list and detail page.

Intentional debt:
- Mobile layout overflow on product detail.
- Tap targets under 44px on mobile filters.
- Token coverage 22%.

### 20.4 Per-sample scenario files

Each sample includes `samples/<id>/.vken/scenarios.json`:

```json
{
  "scenarios": [
    {
      "id": "tokens-first",
      "title": "Token foundation pass",
      "expectedFindings": ["hardcoded-color", "hardcoded-radius"],
      "expectedScoreDelta": [0.10, 0.30]
    },
    ...
  ]
}
```

Used by the leaderboard to bucket runs and by tests to assert convergence.

---

## 21. DesignBench

### 21.1 Leaderboard data shape

`GET /api/vken/leaderboard` returns rows joined from `vken_runs` and the
sample's `scenarios.json`. Key fields per row:

```typescript
interface LeaderboardRow {
  sampleId: string;
  scenarioId: string;
  bestScoreDelta: number;
  bestRunId: string;
  attempts: number;
  rolling5avg: number;
  trend: 'up' | 'flat' | 'down';
}
```

### 21.2 Convergence pre-seed

Ship `kb/seed.jsonl` with 50 prior runs (curated, sanitized, MIT-licensed
patches only, no PII). On Space first boot, `vken/kb.ts` replays the seed
into `vken_kb_rules` and `vken_kb_examples` (idempotent: signature-keyed).

### 21.3 Public dataset

The seed JSONL doubles as a public artifact for the build-in-public
challenge — it's the visible "VKEN learned over 50 runs" claim.

---

## 22. Cost discipline and telemetry

### 22.1 Telemetry collected (server-side, no PII)

- Per-run: input/output tokens by endpoint, wall time per stage, cache hit
  rate (when prompt caching ships in vLLM), pixel diff time.
- KB: rule churn (rules added vs. rejected), retrieval distribution.
- Stored in `vken_runs.vllm_input_tokens` / `vllm_output_tokens` and the
  `validations.details_json`.

### 22.2 Hard caps

- Per VKEN run: total tokens across both endpoints capped at 80k. Beyond
  that, the run is failed with `VKEN_RATE_LIMITED`.
- Per Space: 30 runs / hour rate limit (rolling).
- AMD Cloud: pause script in `infra/amd-cloud/stop-vllm.sh`.

### 22.3 Build-in-public assets

| Day  | Asset                                                           |
| ---- | --------------------------------------------------------------- |
| 5/8  | Tweet 1 + LinkedIn — repo scan + design-debt map demo (15s GIF) |
| 5/9  | Tweet 2 + LinkedIn — before/after on `landing-generic` (30s)    |
| 5/10 | Demo video (90s), Space launch tweet, slide deck, cover image   |

Tags: `@lablab` / `lablab.ai` / `@AIatAMD` / `AMD Developer`.

---

## 23. Build sequence (day-by-day)

Today is **2026-05-07**. The submission is due **2026-05-10 23:59**. No
shortcuts. No V2 features sneaking into V1.

### 23.1 Day 1 — 2026-05-07 (today)

Goals: end-to-end on samples, no LLM yet, deterministic only.

Deliver:
- [ ] Branch `vken/v1` off `main`.
- [ ] `packages/contracts/src/api/vken.ts` + `sse/vken.ts` + index re-exports.
      `pnpm typecheck` passes.
- [ ] DB migration (§8). `pnpm --filter @open-design/daemon test` passes.
- [ ] `vken/types.ts`, `algorithms/*`, `lint/*`. Unit tests for `phash`,
      `pixel-diff`, `ssim`, `visual-gap`.
- [ ] `vken/intake.ts` (clone + sample copy), `vken/index-build.ts`.
- [ ] `vken/runner.ts` + `vken/capture.ts` against sample repos.
- [ ] `samples/landing-generic` ready (with `.vken/scenarios.json`).
- [ ] AMD Cloud pod provisioned, vLLM-VL up on :8000, smoke `curl /v1/models`.
- [ ] Space repo created, Dockerfile builds locally.

Commit checkpoint: end-to-end intake → scan → capture → score on the
sample, no LLM in the path yet.

### 23.2 Day 2 — 2026-05-08

Goals: LLM integration, two more samples, all stages wired through SSE.

Deliver:
- [ ] `vken/vllm-client.ts` + `vken/critique.ts` + `vken/directions.ts` +
      `vken/propose.ts`.
- [ ] vLLM-Coder up on :8001. Smoke: 3 directions on `landing-generic`.
- [ ] `vken/apply.ts` (virtual FS) + `vken/validate.ts`.
- [ ] `samples/dashboard-cluttered` and `samples/ecommerce-basic` ready.
- [ ] `vken/runs.ts` + `/api/vken/runs/*` routes mounted in `server.ts`.
- [ ] `apps/web/src/components/vken/Hook.tsx`, `ScoreGauge.tsx`,
      `Cockpit.tsx`, `Timeline.tsx`, `BeforeAfter.tsx`, `PatchList.tsx`,
      `useVkenSse.ts`. End-to-end run renders on `localhost`.
- [ ] First HF Space deployment. Public URL works.
- [ ] Build-in-public update #1.

### 23.3 Day 3 — 2026-05-09

Goals: learning layer, finalize/PR, polish.

Deliver:
- [ ] `vken/memory.ts` (Tier 1 + 2) + `vken/kb.ts` (Tier 3).
- [ ] `kb/seed.jsonl` curated (50 prior runs across 3 samples).
- [ ] `vken/pr.ts` with bot account, fork-per-run, idempotent open.
- [ ] `Leaderboard.tsx`, `KBPanel.tsx`, `LearnedToast.tsx`,
      `DirectionPicker.tsx`.
- [ ] axe-core integration. Pixel diff overlay in cockpit.
- [ ] Cockpit copy + a11y pass. Mobile stacked layout works.
- [ ] Demo video v1 (90s), slide deck v1, cover image.
- [ ] Build-in-public update #2.

### 23.4 Day 4 — 2026-05-10

Goals: dry runs, polish, submit.

Deliver:
- [ ] Three full dry runs on each sample. Fix any flakiness.
- [ ] Two stranger-eye reviews of the cockpit. Iterate.
- [ ] Final demo video, final slides, final cover image.
- [ ] Submit by 18:00 local to leave 6 hours of buffer for surprises.
- [ ] After submit: social push for HF Space likes.

---

## 24. Submission checklist

- [ ] Project Title: **VKEN Design Engine — Agentic Design Verification and Auto-Repair for Frontends**
- [ ] Short description (≤ 200 chars)
- [ ] Long description (≤ 1500 chars), repeats the tagline and the 4-stage
      loop
- [ ] Technology tags: `AMD AI Developer Cloud`, `ROCm`, `vLLM`, `Qwen`,
      `AI agents`, `multimodal`, `Hugging Face Spaces`, `Playwright`
- [ ] Cover image (PNG/JPG, ≤ 5MB) with the score-climb hero shot
- [ ] Video presentation (YouTube unlisted, 90s)
- [ ] Slide presentation (PDF, 8–12 slides)
- [ ] Public GitHub repository (this repo, branch `vken/v1` merged to
      `main`)
- [ ] Demo Application Platform: Hugging Face Space
- [ ] Application URL: `https://huggingface.co/spaces/<ns>/vken`
- [ ] Build-in-public posts (≥ 2) with all required tags

---

## 25. Risk register

| Risk                                     | Likelihood | Impact | Mitigation                                                                 |
| ---------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| vLLM ROCm build breaks for a Qwen model  | medium     | high   | Verify on day 1. Fallback: switch Coder to a different Qwen3-Coder size.   |
| MI300X availability low                  | low        | high   | Reserve early; have a Together.ai or Anthropic fallback for cassette demos. |
| Playwright Chromium too slow on CPU Space | medium     | medium | Pre-warm node_modules; cache initial captures for samples.                 |
| Octokit rate limits on demo day          | low        | medium | Bot has its own quota. Pre-create forks for each sample to skip step 2.    |
| Patch hunk no-match on real-world repos  | high       | low    | V1 only handles samples + curated URLs we test in advance.                 |
| Space cold start                         | high       | low    | Set sleep to 30+ days for the week.                                        |
| AMD credit burn                          | medium     | medium | Pause aggressively. Pre-budget §17.5.                                      |
| LLM hallucinates rules into KB           | low        | high   | §15.3 validators reject without evidence. Signed JSONL.                    |
| Judge tries unsupported framework        | high       | low    | §16.5 friendly error + sample fallback.                                    |
| Pre-seed KB looks fabricated             | low        | medium | Seed runs are real (run them ourselves on day 1), not synthesized.         |

---

## 26. References (verified)

All URLs were checked on 2026-05-07. Snapshots in `docs/plans/refs/` if a
backup is needed.

- Hugging Face Spaces — GPU hardware list and pricing:
  https://huggingface.co/docs/hub/spaces-gpus
  (NVIDIA-only as of fetch date; CPU Upgrade $0.03/hr, T4 small $0.40/hr.)
- Hugging Face Spaces — Docker SDK:
  https://huggingface.co/docs/hub/spaces-sdks-docker
  (UID 1000, default port 7860, build-time/runtime secrets, `/data` runtime
  volume.)
- vLLM Installation index (confirms ROCm support):
  https://docs.vllm.ai/en/stable/getting_started/installation.html
- Qwen2.5-VL-7B-Instruct model card:
  https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct
- Qwen3-Coder-30B-A3B-Instruct model card:
  https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct
  (30.5B / 3.3B active MoE, 256K native context, non-thinking-only.)
- Playwright `locator.ariaSnapshot`:
  https://playwright.dev/docs/api/class-locator#locator-aria-snapshot
  (v1.49+, `mode: "ai"` returns `[ref=eN]`-tagged YAML.)
- pixelmatch:
  https://github.com/mapbox/pixelmatch
- img-diff-js:
  https://github.com/reg-viz/img-diff-js
- @octokit/rest (forks, PRs, contents API):
  https://octokit.github.io/rest.js/v21
- AMD Developer Cloud:
  https://www.amd.com/en/developer/resources/cloud-access.html
- AMD AI Developer Program:
  https://www.amd.com/en/developer/programs/ai.html

---

## Appendix A — Module template (TypeScript-first)

All new modules under `apps/daemon/src/vken/` are TypeScript with strict
mode. Existing daemon modules are `// @ts-nocheck`; new code is **not**.
Template:

```typescript
// apps/daemon/src/vken/<name>.ts
//
// One-paragraph description of what this module owns.

import type { ... } from '@open-design/contracts';

export interface <Name>Result { ... }

export async function <name>(input: <Name>Input): Promise<<Name>Result> {
  // Pure where possible. Side effects only via injected callbacks.
}
```

Tests live next to source: `vken/<name>.test.ts`. Run with `pnpm test`.

## Appendix B — Idempotency invariants

The build is idempotent if every step below is true after a fresh checkout
and `pnpm install`:

1. `pnpm typecheck` — green.
2. `pnpm test` — green.
3. `pnpm build` — green.
4. The Dockerfile builds without errors.
5. The Space starts and `GET /api/vken/samples` returns the three samples.
6. Running the smoke script `node infra/space/smoke.mjs` (TBD on day 2)
   exits 0 and produces a PR URL.
7. `kb/seed.jsonl` replay leaves `SELECT COUNT(*) FROM vken_kb_rules`
   matching the seed line count.
8. Re-running the same VKEN run (same intake, same direction, same
   approvals) produces the **same PR URL** (idempotent finalize).

If any of the eight invariants fails, the build is not done.

## Appendix C — Glossary

- **Checkpoint**: a snapshot in the run's timeline. Identified by patch id
  or `'initial'`/`'final'`.
- **Direction**: a named, structured proposed redesign axis the user picks
  before patches are generated.
- **Finding**: a single design-debt fact derived from static analysis,
  capture, or VL critique. Resolves into zero or more patches.
- **KB rule**: a generalized, evidence-backed lesson stored in Tier 3.
  Retrieved as few-shot, never as authority.
- **Patch**: a structured search/replace operation on a single file.
- **Patchable score**: `(impact * confidence) / (risk + 0.1)`. Drives default
  ordering.
- **Tier 1/2/3**: run / repo / global memory layers.
- **Virtual FS**: in-memory `Map<filePath, content>` representing the
  patched-but-not-yet-materialized state during scrub.

— end of document —
