# Open Design Vken

## Purpose

Open Design Vken is the target-workspace intelligence layer for Open Design.
Its goal is to turn Open Design from a design artifact generator into a
complete design and frontend improvement loop:

1. Connect any local app or workspace folder.
2. Understand the current product, codebase, routes, UI states, and visual
   language using deterministic static analysis before any LLM call.
3. Create or improve a durable design system.
4. Generate an aspirational but feasible target design.
5. Measure the gap between current implementation and target design using
   structured algorithms, not opinions.
6. Apply approved code changes directly to the target workspace using the
   agent the user has already configured in Open Design.
7. Validate the result with deterministic checks and agentic browsing.
8. Learn from accepted and rejected changes so the system gets better over time.

Vken is model-agnostic and agent-agnostic by design. It routes through the
same `agentId` + `model` selection the rest of Open Design uses. Any agent
adapter the daemon supports — Claude Code, GitHub Copilot, Gemini CLI,
OpenCode, ACP-compatible agents, or any generic CLI — can drive the loop.
There is no hard dependency on any single provider or API key.

The first reference target is a Vite app such as
`C:\Users\Computer\Documents\Dreamverse Holdings\Main Projects\Dream2Host\D2hPlatform\apps\public`,
but the architecture must work for any supported folder.

## Why Build This

The current AI design market is converging around prompt-to-app, prompt-to-code,
and design-to-code workflows:

- Figma Make: conversational prompt-to-app, preview, code editing, sharing.
- Figma MCP: structured design context (components, variables, layout) for agents.
- v0: tiered generation — full rewrites for new UI, a separate fine-tuned
  Quick Edit model for small targeted changes, with internal self-correction.
- Lovable: natural-language full-stack app creation with editable code, GitHub
  sync, security governance, and production lifecycle concerns.
- Bolt.new: AI with direct filesystem access, no diff application step, runs
  inside WebContainers for zero cold-start.
- Replit Agent: guided planning, selectable build modes, self-testing, human
  review before major changes.
- Browser Use: agentic browser exploration at 4x the token cost of programmatic
  Playwright — valuable for journey discovery, too expensive for data extraction.
- Builder Visual Copilot: component mapping, framework awareness, design tokens,
  production-code integration.
- Windsurf Cascade: AST-aware code edits that survive formatting differences,
  stateful agent sessions across turns.

Open Design should compete by doing something these tools usually do not do
well enough: continuously improve an existing local codebase using a measurable,
auditable, self-improving design loop that is model-agnostic and works with the
agent the developer already uses.

## Product Thesis

Great design AI should not only generate pretty artifacts. It should close the
gap between design intent and production code with evidence the developer can
audit and reverse.

Vken makes this loop easy:

```text
Connect folder
  -> index workspace (static, no LLM)
  -> choose intent
  -> generate target (any agent)
  -> measure gap (algorithms + LLM scoring)
  -> approve patch (any agent applies)
  -> validate (deterministic + agentic)
  -> learn
  -> repeat
```

The user should feel like they are using a focused design cockpit, not managing
an agent swarm. All agent roles are implementation details; only one assistant
surface is ever visible.

## Modes

Vken exposes three top-level modes.

### 1. Improve

Use when the current app is basically correct but needs better craft.

Scope:

- Preserve routes, content hierarchy, and component structure where reasonable.
- Upgrade typography, spacing, density, colors, states, responsiveness, and
  polish.
- Prefer low-risk patches (token swaps and component-level changes first).

Best for:

- Landing pages that look generic.
- Dashboards with weak hierarchy.
- Apps that have the right features but inconsistent UI.

### 2. Implement

Use when the user has an approved Open Design artifact or target visual and
wants it translated into the real app.

Scope:

- Treat the target artifact as authoritative.
- Translate into the target app's framework and component conventions.
- Reuse existing components and tokens where possible.
- Preserve functional routes and business logic.

Best for:

- Moving from an Open Design prototype to app code.
- Rebuilding a Vite/React screen from a target design.
- Applying a design-system refresh across real components.

### 3. Design From Scratch

Use when the current app is weak enough that the best move is a new design
direction.

Scope:

- Preserve product goals, required flows, information architecture, and
  technical feasibility.
- Allow new layout systems, visual language, and component treatments.
- Generate multiple target directions before any code changes.

Best for:

- Brand refreshes.
- New public marketing surfaces.
- Repositioning a product with no strong design language.

## Creativity Budget

Each run asks for a creativity budget, phrased in plain language:

```text
Safe polish
  Small visual improvements, low implementation risk.

Balanced redesign
  Noticeably better design while preserving most structure.

Bold direction
  Explore a stronger visual point of view while keeping product constraints.
```

Internally:

```text
Safe polish       = 80 percent current structure, 20 percent uplift
Balanced redesign = 50 percent current structure, 50 percent target design
Bold direction    = preserve intent, allow major visual/layout change
```

The default is Improve + Balanced redesign.

The target design must be constraint-aware and aspirational. It must preserve
the product's purpose, required flows, content meaning, accessibility, and
implementation feasibility, but it may substantially improve visual hierarchy,
layout rhythm, interaction polish, and brand expression according to the chosen
budget.

## Agent Architecture — BYOK and Provider-Agnostic

Vken does not introduce a new agent runtime. Every LLM call routes through the
existing `agentId` + `model` mechanism the daemon already exposes.

### How It Reuses the Existing Adapter Infrastructure

The daemon's `AGENT_DEFS` registry in `agents.ts` already handles:

- Claude Code (`stream-json` format)
- GitHub Copilot (dotted event schema)
- Gemini CLI (proto event mapping)
- OpenCode (custom JSON event schema)
- ACP-compatible agents (JSON-RPC 2.0)
- pi/Pinecone (JSON-RPC with UI auto-approval)
- Codex (reasoning effort with model-specific clamping)
- Generic CLIs (plain stdout passthrough)

Vken target runs use a `VkenRunRequest` that carries `agentId` and `model` in
exactly the same way `ChatRunCreateRequest` does. The daemon selects the right
stream handler and builds the correct argv. No new process spawning logic is
needed.

### Agent Capability Detection

Not every agent supports vision, structured output, or large context windows.
Vken detects capabilities at workspace registration time and adjusts the loop
accordingly:

```typescript
interface AgentCapabilityProfile {
  agentId: string;
  supportsVision: boolean;       // can receive image attachments
  supportsStructuredOutput: boolean; // can return reliable JSON
  contextWindowTokens: number;   // estimated safe context limit
  streamFormat: 'claude-stream-json' | 'acp-json-rpc' | 'plain';
  visionFallback: 'describe-only' | 'skip' | 'playwright-extract';
}
```

Capability profiles are stored per agent in the target workspace config. They
are derived from the existing `agentCapabilities` map the daemon already
populates at probe time.

**Vision fallback**: when the active agent does not support image attachments,
the gap engine passes structured JSON (box model, computed styles, ARIA
snapshot, CSS diff) instead of screenshots. Agents that understand structured
context can still reason about design gaps without seeing images.

**Structured output fallback**: when the active agent does not support reliable
JSON output, Vken switches from schema-validated structured responses to
regex-parsed fenced code blocks, the same pattern used throughout the existing
daemon for agents that do not support JSON mode.

### Tier-Based Task Routing

Rather than hard-coding model names, Vken defines three task tiers that the
user maps to their available models:

```text
Tier A — Scan
  Cheap, fast. File classification, CSS var extraction, hardcoded value lint,
  route detection, ARIA snapshot comparison, patch format validation.
  Maps to: whatever the user's cheapest/fastest configured model is.
  No vision required.

Tier B — Reason
  Default quality. Gap analysis, patch generation, design system extraction,
  direction generation, validation interpretation.
  Maps to: whatever the user's default model is.
  Vision preferred, not required.

Tier C — Architect
  Highest quality. Initial workspace architecture decisions, cross-cutting
  refactor plans, design direction proposals that span multiple routes.
  Maps to: whatever the user's best configured model is.
  Used sparingly — once per major decision point, not per component.
```

The user assigns tiers to models in the Vken configuration panel, or accepts
the defaults (Tier A = Tier B = Tier C = the agent's default model, which is
always safe even if less efficient).

### Token Efficiency — Model-Agnostic Patterns

The following patterns reduce token consumption regardless of which provider
is active.

#### Compute Outside Context

Run deterministic analysis before any LLM call. Pass only the summary to the
model, not the raw files.

```text
Instead of: pass 500-line component → LLM finds 3 hardcoded colors
Use:        grep for hardcoded values → 12 matching lines → LLM classifies findings

Token reduction: 40-60 percent on scan phase
```

#### Context Window Discipline

- Each subagent role receives only its specific input context, not the full
  workspace index.
- Each role returns a structured JSON summary (capped at ~500 tokens), not
  its full reasoning chain.
- The orchestrator aggregates role summaries, not raw agent outputs.

#### System Prompt Reuse

The workspace profile, design system spec, and agent role instructions are
stable across a session. Build a fixed prefix that is reused across calls. For
providers that support prompt caching (Anthropic, some OpenAI tiers), mark the
breakpoints. For providers that do not, the fixed prefix still reduces
per-request composition overhead.

Note: Anthropic's prompt cache TTL is 5 minutes. For sessions longer than
5 minutes, re-prime the cache every 4 minutes by re-issuing the cached prefix
with a lightweight heartbeat. Track `cache_read_input_tokens` vs.
`cache_creation_input_tokens` in the run metadata so the user can see
efficiency trends.

#### Incremental Reanalysis

After the first full run, subsequent runs only reanalyse files whose mtime hash
has changed. This cuts analysis cost 70-80 percent on follow-up iterations,
where typically only 2-4 component files changed.

#### Structured Output With Regex Fallback

Request structured JSON output for all machine-consumed results. For agents
that produce unreliable JSON, fall back to regex-parsed fenced code blocks.
Never pass unstructured LLM output to the next pipeline stage directly.

## Workspace Intelligence Pipeline

The pipeline follows a strict ordering: deterministic analysis before any LLM
call, cheap LLM calls before expensive ones, and no expensive capture if cheap
analysis already answers the question.

```text
Stage 0: Static Index (no LLM, no browser)
  grep + PostCSS + file walk
  Output: WorkspaceIndex JSON

Stage 1: Tier A Scan (cheapest model)
  Input: WorkspaceIndex JSON
  Output: DesignAuditReport JSON

Stage 2: Playwright Capture (no LLM)
  Screenshot + CSS vars + ARIA + box model per route/viewport
  Output: TargetCapture records

Stage 3: Tier B Analysis (default model)
  Input: captures + audit + design system spec
  Output: GapReport JSON + direction proposals

Stage 4: Tier B Patch Generation (default model)
  Input: GapReport + workspace index
  Output: PatchPlan JSON

Stage 5: Apply + Validate (deterministic + Tier A verification)
  Apply patches, run build, recapture, rescore
  Output: ValidationResult JSON

Stage 6: Tier A Learn (cheapest model)
  Input: accepted/rejected patches + delta scores
  Output: proposed DesignMemory updates
```

### Stage 0: Static Workspace Index

The index is built entirely from the filesystem with no LLM calls. It runs in
under 5 seconds on a typical 50-component app.

```typescript
interface WorkspaceIndex {
  rootPath: string;
  fingerprint: string;          // hash of mtime of key source files
  framework: FrameworkKind;
  packageManager: PackageManagerKind;
  tailwindVersion: 2 | 3 | 4 | null;
  stylingSystem: StylingSystem; // css-variables | tailwind | emotion | modules | mixed
  devCommand: string;
  buildCommand: string;
  testCommand: string | null;
  routes: RouteEntry[];
  components: ComponentEntry[];
  tokens: TokenEntry[];
  hardcodedValues: HardcodeEntry[];
  tokenCoverageRatio: number;   // percent of style values using tokens vs. literals
  gitAvailable: boolean;
  indexedAt: number;
}
```

Rebuild the index only when the fingerprint (mtime hash of source files) has
changed. Cache the previous index; skip Stage 0 entirely on incremental runs
where fingerprint is unchanged.

**Framework detection**: read `package.json` dependencies. Check for
`vite`, `next`, `astro`, `remix`, `@sveltejs/kit`, `nuxt`, `@angular/core`.
Check `scripts` for `dev` and `build` commands.

**Tailwind version detection**: presence of `tailwind.config.ts` / `.js`
indicates v3. Presence of `@import 'tailwindcss'` in a CSS file with
`@theme {}` blocks indicates v4. This distinction controls the token extraction
strategy — v3 requires parsing the JS config, v4 requires parsing CSS `@theme`
blocks via PostCSS.

**CSS variable extraction (static)**: use PostCSS to walk `:root` rules and
`@theme` blocks. Do not run the app to get CSS vars — static extraction is
faster, cheaper, and works when a dev server is not running.

**Hardcoded value detection**: grep across all source files in one pass:

```bash
grep -rn --include="*.tsx" --include="*.ts" --include="*.css" \
  -E "#[0-9a-fA-F]{3,8}|[0-9]+(px|rem|em)\b" src/
```

Filter results to flag values that are not inside token definition files.

**Token coverage ratio**: `(style declarations using CSS vars) / (all style
declarations)`. Below 60 percent is a signal that the design system is not
being enforced.

### Stage 2: Playwright Capture

Playwright is a daemon dependency (`apps/daemon/package.json`), not an e2e
dependency. Install Chromium only to minimize install size. Use the programmatic
Node.js API — not the MCP server, not a CLI subprocess — for maximum control
and minimum overhead.

For each route and viewport:

```typescript
interface TargetCapture {
  routePath: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  screenshotPath: string;       // stored under .od/targets/<id>/runs/<runId>/current/
  ariaSnapshot: string;         // YAML from locator.ariaSnapshot()
  cssVars: Record<string, string>;  // runtime CSS custom properties
  boxModels: BoxModelEntry[];   // for important elements
  consoleErrors: string[];
  capturedAt: number;
}
```

**Viewport sizes**: desktop = 1440×900, tablet = 768×1024, mobile = 375×812.

**Box model extraction for key elements**:

```typescript
const boxes = await page.evaluate(() => {
  const selectors = ['h1', 'h2', '.hero', 'nav', '[data-cta]', 'button', '.card'];
  return selectors.flatMap(sel =>
    [...document.querySelectorAll(sel)].slice(0, 3).map(el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        selector: sel,
        text: el.textContent?.trim().slice(0, 60),
        x: r.x, y: r.y, width: r.width, height: r.height,
        fontSize: s.fontSize, lineHeight: s.lineHeight,
        color: s.color, background: s.backgroundColor,
        borderRadius: s.borderRadius, padding: s.padding,
        fontWeight: s.fontWeight, letterSpacing: s.letterSpacing,
      };
    })
  );
});
```

**CSS vars at runtime** (catches vars set by JS or themes):

```typescript
const cssVars = await page.evaluate(() => {
  const computed = getComputedStyle(document.documentElement);
  const vars: Record<string, string> = {};
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
          for (const prop of rule.style) {
            if (prop.startsWith('--'))
              vars[prop] = computed.getPropertyValue(prop).trim();
          }
        }
      }
    } catch {} // cross-origin sheets throw
  }
  return vars;
});
```

Only start the dev server when capture is needed. Detect the port from the
run output. Stop the server immediately after all routes are captured.

## User Experience

The GUI must be simple by default and deep when needed. Collapse the workflow
to five core screens, not eight.

### Screen 1: Connect and Configure

Primary action: Connect app folder.

The user picks any folder. Vken runs Stage 0 (static index) immediately in the
background and shows results within 5 seconds:

```text
Vite + React detected
12 routes found
48 components found
CSS variables: 62% coverage (below target)
Tailwind v3 detected
No design guide found
Ready to analyse
```

Below the summary:

```text
Mode:             [Improve ▾]        Creativity: [Balanced redesign ▾]
Agent:            [Claude Code ▾]    Model:      [Default ▾]
```

The agent and model dropdowns are the same pickers used in the main chat UI.
Users who have already configured an agent see their choice pre-selected.

Advanced details (framework, package manager, detected commands, token coverage
chart) live behind "Show technical details". An expandable log shows the static
index output.

"Start Analysis" begins Stage 1 + Stage 2.

### Screen 2: Live Analysis

A progress timeline with collapsible log drawer:

```text
✓ Building workspace index          0.8s
✓ Running design scan               4.2s
⟳ Capturing routes (3/12)          running...
  Preparing gap analysis            waiting
  Building recommendations          waiting
```

The timeline drives via SSE events (`target:index`, `target:capture`,
`target:analysis`). The log drawer shows raw stdout from the agent and
Playwright output. Default: drawer collapsed.

If the dev server fails to start, show the error inline with a suggested fix
command and a "Retry" button.

### Screen 3: Intelligence Dashboard

Left panel — Design Intelligence Report:

```text
Design score: 6.1 / 10

Main issues:
1. Hero typography compressed — font-size 44px vs recommended 64px
2. Buttons use three unrelated radius systems (4px, 8px, 12px)
3. Pricing cards: 14px internal padding vs 24px standard
4. Mobile nav tap targets: 28px vs 44px minimum
5. Accent color overused — 9 occurrences, loses contrast signal

Token coverage: 62% (target: 85%+)
Hardcoded values: 47 found across 18 files
```

Right panel — Target Directions (2-4 cards):

Each card shows:

- Name and mood.
- What changes (3 bullets).
- Implementation effort (Low / Medium / High).
- Risk level.

The user picks one direction or requests another generation pass.

Advanced report files are saved under the run:

```text
.od/targets/<id>/runs/<runId>/
  analysis/current-design-audit.md
  analysis/component-inventory.json
  analysis/route-inventory.json
  analysis/tokens-current.json
  analysis/ux-friction-report.md
```

### Screen 4: Gap + Patch (Unified)

The gap map and patch plan are one screen, not two. Splitting them loses the
spatial connection between a visual problem and its proposed fix.

Top section — split view:

```text
Current                    Target
[screenshot, annotated]    [screenshot, annotated]
```

Annotated regions (hero, nav, primary CTA, cards, forms, mobile layout) are
clickable. Clicking an annotation expands the specific patch proposal for that
region in the panel below.

Bottom section — patch plan:

```text
Patch 1: Token foundation               Risk: Low     Impact: High
  tokens.css — replace 47 hardcoded values with CSS vars
  [View diff] [Approve] [Skip]

Patch 2: Button primitives              Risk: Low     Impact: Medium
  src/components/Button.tsx — consolidate radius to --radius-md
  [View diff] [Approve] [Skip]

Patch 3: Homepage hero layout           Risk: Medium  Impact: High
  src/pages/Home.tsx — increase type scale and layout rail width
  [View diff] [Approve] [Skip]
```

Each patch card shows files touched, risk, expected visual impact, test to run,
and rollback point. The user can approve all, approve individual patches, edit
the plan, or cancel.

### Screen 5: Validate and Learn

After patches are applied:

```text
Build         ✓ Passed (4.1s)
Type check    ✓ No errors
Screenshots   ✓ Captured (desktop + mobile)
Design score  6.1 → 8.2  (+2.1)
A11y          ✓ No new violations
```

Below: proposed learning items with accept/reject toggles:

```text
Proposed learnings from this run:

✓ Primary CTA: 44px minimum height, --radius-md (10px), medium weight
✓ Marketing cards: 24px padding desktop, 18px mobile
✗ Hero: gradient accent background — [Reject] (user preference)
```

Rollback CTA is always visible while patches are applied.

## Self-Learning

Self-learning is controlled, local, auditable, and reversible.

### What Vken Learns From

- Accepted patches.
- Rejected patches and which specific proposals were refused.
- Manual user edits after AI patches.
- Visual score deltas per patch.
- Recurring lint findings across runs.
- Repeated user comments on previews.
- Target workspace component conventions derived from accepted code.
- Build and test failures with their fixes.

### Memory Types

#### 1. Project Design Memory

Stored per target workspace:

```text
.od/targets/<target-id>/memory/design-memory.json
```

Contains accepted style rules, rejected patterns, token decisions, component
preferences, known routes and states, preferred patch granularity, and
user-approved visual directions.

#### 2. Living DESIGN.md

The source of design truth for the workspace:

```text
.od/targets/<target-id>/design/DESIGN.md
```

Optionally written into the target workspace with explicit user approval:

```text
<target-root>/DESIGN.md
```

This file is the same format used by Open Design's existing design systems.
The daemon's `design-systems.ts` parser reads it without modification.

#### 3. Machine Tokens

```text
.od/targets/<target-id>/design/
  tokens.json
  tokens.css
  component-rules.json
```

Formatted using the Style Dictionary schema so they can be consumed by
downstream tools without modification.

#### 4. Run History

```text
.od/targets/<target-id>/runs/<run-id>/
  run.json
  gap-report.md
  patch-plan.md
  validation.json
  current/          — captures before patches
  target/           — rendered target references
  diff/             — heatmaps and delta reports
  patches/          — applied patch content and originals
```

Enables rollback, trend tracking, and reproducible decisions.

### Learning Flow

```text
Observe -> Propose -> Patch -> Validate -> User accepts/rejects -> Learn
```

Rules:

- Learning is always proposed, never silent.
- Learned rules include evidence (patch IDs, score deltas).
- The user can delete or edit individual learned rules.
- Global learning is opt-in; default is project-local.
- Conflicting learnings are surfaced as explicit decisions before writing.

### Learning Record Format

Accepted:

```json
{
  "type": "component_rule",
  "component": "Button",
  "rule": "Primary buttons use 44px minimum height, --radius-md radius, medium weight.",
  "evidence": ["patch-002 accepted", "visual score +0.6"],
  "status": "active",
  "createdAt": 1746345600
}
```

Rejected:

```json
{
  "type": "negative_preference",
  "rule": "Do not use glassmorphism card backgrounds in this workspace.",
  "evidence": ["user rejected target direction 3"],
  "status": "active",
  "createdAt": 1746345600
}
```

## Self-Healing

### Healing Layers

#### 1. Build Healing

If build fails after a patch:

- Capture full error output.
- Identify failing file from error trace.
- Ask the active agent (Tier B) for a minimal fix.
- Apply only after user approval unless trusted-auto mode covers P2/P3.
- Re-run build. If build fails again, revert patch via git stash pop.

#### 2. TypeScript Pre-validation

Before applying any patch, run `tsc --noEmit` on the affected file in the
target workspace. Reject patches that introduce type errors before they reach
the filesystem. This is the first-line guard — cheaper than running the full
build.

#### 3. Runtime Healing

If a route crashes after patch:

- Capture console errors, network errors, and a screenshot.
- Pass structured error context (not the full page) to the active agent.
- Patch only the failing component or import.
- Re-test only the affected route first.

#### 4. Visual Regression Healing

If the gap score worsens after a patch:

- Revert the patch via git stash pop.
- Open a targeted correction targeting only the regressed region.
- Prefer token-level fixes before component rewrites.
- Use measured deltas, not broad visual opinions.

#### 5. Design-System Drift Healing

If the implementation drifts from DESIGN.md between runs:

- Detect new hardcoded values introduced since last run (diff index
  fingerprints).
- Propose token replacement patches for any new hardcoded occurrences.
- Surface drifted components in the Visual Debt Register.

#### 6. Agent Output Healing

If the active agent produces malformed structured output:

- Attempt regex extraction from fenced code blocks as fallback.
- If extraction fails, discard the response and re-prompt once with a
  tighter schema example.
- If the second attempt also fails, surface the raw output to the user in
  an expandable drawer and skip that pipeline stage for this run.
- Never pass malformed output to the next stage.

## Self-Improving

Self-improving means each loop makes future loops easier and more accurate.

### Improvement Signals

Track per run:

- Visual score over time.
- Accessibility score over time.
- Build reliability (pass rate).
- Patch acceptance rate.
- Number of repeated findings (if the same issue recurs, the learned rule
  is not being applied).
- Token coverage ratio trend.
- Component reuse rate (patches using existing primitives vs. new CSS).
- Manual user edits after AI patches (signal that the patch was wrong).

### Improvement Outputs

After each session, the system maintains:

```text
DESIGN.md
tokens.json
tokens.css
component-rules.json
route-baselines.json
known-fixes.json
rejected-patterns.json
prompt-profile.md
```

### Prompt Profile

The prompt profile teaches future agent runs how to work in the target app:

```text
This workspace uses pnpm.
Run pnpm build after changes.
Use CSS variables in src/styles/tokens.css.
Use existing Button and Card primitives before creating new CSS.
Do not add new dependencies without approval.
Avoid gradient backgrounds except the approved hero accent line.
Primary CTA minimum height is 44px.
```

This is similar in spirit to project rules but generated from real accepted
work rather than written from scratch. It is injected into the system prompt
prefix on every subsequent run.

## Browser Use Integration

Browser Use is an optional exploration layer, not a default capture method.
It costs approximately 4x more tokens than equivalent Playwright programmatic
capture and should be used only when genuine user-journey simulation is needed.

### Capture Strategy Decision Tree

```text
Can static analysis answer the question?
  Yes → use grep / PostCSS / ts-morph (no LLM, no browser)
  No  → can Playwright programmatic API answer the question?
    Yes → use Playwright Node.js API (deterministic, no LLM tokens)
    No  → does the question require interaction (menus, forms, modals)?
      No  → use Playwright MCP with accessibility tree (moderate cost)
      Yes → use Browser Use (high cost, user-enabled per workspace)
```

### Vken Roles for Browser Use

Use it only for:

- Exploratory route discovery of hidden or auth-gated states.
- User journey mapping (capturing click sequences, not just page screenshots).
- Form and onboarding exploration.
- Replaying accepted user journeys after a patch to verify flow integrity.

Never use it for:

- Pixel measurement or computed style extraction (Playwright is accurate and cheap).
- Regression baselines (non-deterministic interaction order).
- Build validation (run the build command directly).
- Accessibility conformance (use axe-core via Playwright evaluate).

### Integration Model

Browser Use runs as an external user-installed MCP connector. The daemon
detects the `browser-use-mcp-server` MCP endpoint at workspace registration
time. Users who want it run:

```bash
pip install browser-use-mcp-server
```

Then configure the MCP URL in the Vken workspace settings. This avoids
bundling a Python runtime into the TypeScript daemon.

### Security

Browser Use has access to browser sessions and potentially sensitive pages:

- Off by default.
- Require explicit enablement per target workspace.
- Use isolated browser profiles.
- Never run against production admin pages unless explicitly permitted.
- Show when a browser session is active in the GUI.
- Allow "stop all browser automation" from any screen.

## Measurement Engine

### Visual Gap Algorithm Chain

Run algorithms fastest-first. Stop when the result is conclusive.

```typescript
// Step 1: perceptual hash — O(1) fast pre-filter
const hashDist = hammingDistance(pHash(current), pHash(target));
if (hashDist < 6) return { match: 'identical', score: 1.0 };

// Step 2: pixelmatch — pixel-level diff with perceptual color weighting
// Uses YIQ NTSC color space, better than RGB Euclidean distance for UI
import pixelmatch from 'pixelmatch'; // zero native deps, pure JS
const diffPixels = pixelmatch(img1, img2, diffOut, width, height, {
  threshold: 0.1,    // per-pixel tolerance (0–1)
  includeAA: false,  // ignore anti-aliasing artifacts
});
const diffRatio = diffPixels / (width * height);

// Step 3: SSIM — structural similarity (luminance + contrast + structure)
// Use img-diff-js (pure JS, no native deps, no Python subprocess)
const { ssim } = await compareImages(current, target);

// Composite visual gap score (0 = identical, 1 = completely different)
const visualGap =
  (diffRatio * 0.5) +
  ((1 - ssim) * 0.3) +
  (Math.min(hashDist, 32) / 32 * 0.2);
```

Threshold guidance:

- `visualGap < 0.02`: no meaningful visual change (skip further analysis)
- `visualGap 0.02–0.10`: minor differences (P2/P3 severity)
- `visualGap > 0.10`: significant differences (P0/P1 severity)

### Semantic Gap Dimensions

Scored by the Tier A agent with structured JSON output. Fall back to
deterministic grep when structured output is unreliable.

```text
Visual hierarchy       — heading scale, spacing rhythm, CTA prominence
Typography             — font families, size scale, weight usage, line height
Color and contrast     — WCAG AA compliance, token usage ratio
Component consistency  — radius system, shadow scale, border treatment
Responsive behavior    — layout at mobile breakpoints, tap target sizes
Interaction states     — hover, focus, disabled, loading states present
Accessibility          — ARIA roles, landmark structure, label coverage
Token adherence        — percent of values using CSS vars vs. literals
Copy clarity           — heading length, CTA specificity, label accuracy
Implementation health  — TypeScript errors, build warnings, console errors
```

### Gap Severity

```text
P0: Blocks usability, build, route rendering, or accessibility.
P1: Major visual or interaction mismatch.
P2: Polish issue or consistency improvement.
P3: Optional enhancement.
```

### Patchability Score

Each finding includes:

```typescript
interface GapFinding {
  dimension: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
  affectedFiles: string[];
  patchType: PatchType;
  impact: number;     // 0–1: expected visual score improvement
  risk: number;       // 0–1: likelihood of regression or side effects
  effort: number;     // 0–1: estimated implementation complexity
  confidence: number; // 0–1: how certain the finding is
  patchableScore: number; // (impact * confidence) / (risk + 0.1)
}

type PatchType =
  | 'token'
  | 'component'
  | 'route-layout'
  | 'responsive'
  | 'copy'
  | 'state'
  | 'animation'
  | 'accessibility'
  | 'cleanup';
```

### Capture Artifacts

For each route and viewport stored under the run:

```text
current/
  <route>/<viewport>/screenshot.png
  <route>/<viewport>/aria.yml
  <route>/<viewport>/css-vars.json
  <route>/<viewport>/box-models.json
  <route>/<viewport>/console.json
target/
  <route>/<viewport>/screenshot.png      — rendered target reference
diff/
  <route>/<viewport>/heatmap.png
  <route>/<viewport>/gap-report.json
  <route>/<viewport>/layout-deltas.json
```

## Patch Application

### Format Selection Matrix

The patch format is selected per finding based on scope and file size:

```text
Finding type                  → Format
-----------------------------------------
Token value swaps             → search/replace blocks
  (color, spacing, radius)
  Reliability: high — exact string match
  Condition: target string is unique in file

Component prop/style changes  → search/replace blocks or full rewrite
  (files < 150 lines)         → full rewrite
  (files ≥ 150 lines)         → search/replace blocks

Complex TypeScript refactors  → ts-morph AST transforms
  (interface changes, renames,  via TypeScript Compiler API
   multi-location symbol edits)  survives formatting differences

New files                     → full write
Build config changes          → search/replace blocks (surgical)
```

### Search/Replace Block Format

```json
{
  "patchFormat": "search-replace",
  "filePath": "src/styles/tokens.css",
  "hunks": [
    {
      "search": "#3b82f6",
      "replace": "var(--color-primary)"
    },
    {
      "search": "border-radius: 4px",
      "replace": "border-radius: var(--radius-sm)"
    }
  ]
}
```

The daemon applies hunks in order, aborting on the first non-match. Non-matches
surface the unmatched string in the patch review UI so the user can correct it.

### Rollback Strategy

Before applying any patch to the target workspace:

1. Check `gitAvailable` in the target workspace index.
2. If git is available: `git stash push -m "open-design-vken-<patchId>"`.
   Record the stash ref in the `target_patches` row.
3. If git is not available: write the original file content to
   `.od/targets/<id>/runs/<runId>/patches/<patchId>/original.txt`.
4. Apply the patch.
5. Run TypeScript pre-validation (`tsc --noEmit` on the affected file).
6. If pre-validation fails: rollback immediately (git stash pop or restore
   from original.txt). Surface the type error to the user. Do not proceed
   to the next patch.
7. Run build validation.
8. If build fails: rollback. Surface the build error.
9. Mark patch `applied` in the database only after all validations pass.

### Patch Approval Modes

```text
patch_only (default)
  Every patch requires explicit user approval before applying.
  Recommended for all new target workspaces.

direct_with_approval
  Patches are previewed as diffs; user approves the batch.
  Suitable after the user has seen several runs and trusts the system.

trusted_auto
  P2 and P3 patches apply automatically.
  P0 and P1 patches always require explicit approval.
  Only available after the user explicitly enables it per workspace.
  Never available on the first run of a workspace.
```

## Target Workspace Architecture

### Domain Model

```typescript
interface TargetWorkspace {
  id: string;
  projectId: string;            // links to existing Open Design Project
  rootPath: string;
  displayName: string;
  framework: FrameworkKind;
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';
  tailwindVersion: 2 | 3 | 4 | null;
  stylingSystem: 'css-variables' | 'tailwind' | 'emotion' | 'css-modules' | 'mixed';
  captureStrategy: 'playwright' | 'playwright-mcp' | 'browser-use';
  installCommand: string;
  devCommand: string;
  buildCommand: string;
  testCommand: string | null;
  approvalMode: 'patch_only' | 'direct_with_approval' | 'trusted_auto';
  trustedAutoSeverityThreshold: 'P2' | 'P3';  // only applies in trusted_auto mode
  browserUseEnabled: boolean;
  gitAvailable: boolean;
  agentCapabilityProfile: AgentCapabilityProfile;
  tierAModel: string | null;    // null = use agent default
  tierBModel: string | null;
  tierCModel: string | null;
  detectedRoutes: TargetRoute[];
  createdAt: number;
  updatedAt: number;
}

type FrameworkKind =
  | 'vite-react' | 'vite-vue' | 'vite-svelte'
  | 'nextjs' | 'astro' | 'remix' | 'sveltekit'
  | 'nuxt' | 'angular' | 'plain-html' | 'unknown';

interface TargetRoute {
  id: string;
  path: string;
  label: string;
  filePath: string;             // source file for this route
  requiresAuth: boolean;
  priority: 'primary' | 'secondary' | 'hidden';
  states: TargetRouteState[];
}

interface TargetRouteState {
  id: string;
  name: string;
  setupSteps?: BrowserStep[];
  viewports: Array<'desktop' | 'tablet' | 'mobile'>;
}

interface AgentCapabilityProfile {
  agentId: string;
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
  contextWindowTokens: number;
  streamFormat: 'claude-stream-json' | 'acp-json-rpc' | 'plain';
  visionFallback: 'describe-only' | 'skip' | 'playwright-extract';
}
```

### API Routes

All routes follow the existing Express pattern in `server.ts`:

```text
POST   /api/targets/register
GET    /api/targets
GET    /api/targets/:id
PATCH  /api/targets/:id
DELETE /api/targets/:id

POST   /api/targets/:id/index          — Stage 0: build workspace index
POST   /api/targets/:id/scan           — Stage 1: Tier A design scan
POST   /api/targets/:id/start          — start dev server
POST   /api/targets/:id/stop           — stop dev server
POST   /api/targets/:id/capture        — Stage 2: Playwright capture
POST   /api/targets/:id/generate-target — Stage 3a: generate directions
POST   /api/targets/:id/compare        — Stage 3b: gap analysis
POST   /api/targets/:id/propose-patches — Stage 4: patch plan generation
POST   /api/targets/:id/apply-patch    — Stage 5a: apply single patch
POST   /api/targets/:id/validate       — Stage 5b: validate applied patches
POST   /api/targets/:id/learn          — Stage 6: propose memory updates
POST   /api/targets/:id/rollback       — revert a specific patch

GET    /api/targets/:id/runs
GET    /api/targets/:id/runs/:runId
GET    /api/targets/:id/captures
GET    /api/targets/:id/memory
PATCH  /api/targets/:id/memory         — accept/reject learning proposals
```

Each mutating route creates or updates a run and streams progress via SSE on
`/api/targets/:id/runs/:runId/sse` using the same SSE pattern as
`/api/runs/:runId/sse`.

### SSE Event Schema

Extends the existing `ChatSseEvent` pattern from `packages/contracts/src/sse/chat.ts`:

```typescript
// packages/contracts/src/sse/targets.ts

export type TargetSseEventKind =
  | 'target:index'      // workspace index progress
  | 'target:scan'       // Tier A scan progress and findings
  | 'target:capture'    // Playwright capture progress
  | 'target:analysis'   // gap analysis findings (streaming)
  | 'target:direction'  // generated target direction card
  | 'target:patch'      // patch proposal (one event per patch)
  | 'target:apply'      // patch apply status
  | 'target:validate'   // validation result
  | 'target:learn'      // proposed learning item
  | 'target:score'      // gap score update
  | 'target:error';     // scoped non-fatal error

export type TargetSseEvent =
  | SseTransportEvent<'target:index', TargetIndexPayload>
  | SseTransportEvent<'target:scan', TargetScanPayload>
  | SseTransportEvent<'target:capture', TargetCapturePayload>
  | SseTransportEvent<'target:analysis', TargetAnalysisPayload>
  | SseTransportEvent<'target:direction', TargetDirectionPayload>
  | SseTransportEvent<'target:patch', TargetPatchPayload>
  | SseTransportEvent<'target:apply', TargetApplyPayload>
  | SseTransportEvent<'target:validate', TargetValidatePayload>
  | SseTransportEvent<'target:learn', TargetLearnPayload>
  | SseTransportEvent<'target:score', TargetScorePayload>
  | SseTransportEvent<'target:error', SseErrorPayload>;
```

### Storage Layout

```text
.od/
  targets/
    <target-id>/
      target.json               — TargetWorkspace record
      memory/
        design-memory.json      — ProjectDesignMemory
        rejected-patterns.json
        known-fixes.json
        prompt-profile.md
      design/
        DESIGN.md
        tokens.json             — Style Dictionary format
        tokens.css
        component-rules.json
      analysis/
        workspace-index.json    — current WorkspaceIndex (cached, fingerprinted)
        route-inventory.json
        component-inventory.json
      runs/
        <run-id>/
          run.json
          analysis/
          current/
          target/
          diff/
          patches/
          validation/
```

### Database Schema Extensions

Add to the existing SQLite database via idempotent `ALTER TABLE` migrations
(same pattern as existing migrations in `db.ts`):

```sql
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  root_path TEXT NOT NULL,
  display_name TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT 'unknown',
  package_manager TEXT NOT NULL DEFAULT 'unknown',
  tailwind_version INTEGER,
  styling_system TEXT NOT NULL DEFAULT 'mixed',
  capture_strategy TEXT NOT NULL DEFAULT 'playwright',
  install_command TEXT,
  dev_command TEXT,
  build_command TEXT,
  test_command TEXT,
  approval_mode TEXT NOT NULL DEFAULT 'patch_only',
  trusted_auto_severity TEXT NOT NULL DEFAULT 'P3',
  browser_use_enabled INTEGER NOT NULL DEFAULT 0,
  git_available INTEGER NOT NULL DEFAULT 0,
  agent_id TEXT,
  tier_a_model TEXT,
  tier_b_model TEXT,
  tier_c_model TEXT,
  agent_capability_json TEXT,
  workspace_index_json TEXT,
  design_memory_json TEXT,
  prompt_profile TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS target_runs (
  id TEXT PRIMARY KEY,
  target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  creativity_budget TEXT,
  scope_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  gap_score_before REAL,
  gap_score_after REAL,
  patch_count INTEGER DEFAULT 0,
  patches_accepted INTEGER DEFAULT 0,
  patches_rejected INTEGER DEFAULT 0,
  agent_id TEXT,
  model TEXT,
  token_usage_json TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS target_captures (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES target_runs(id) ON DELETE CASCADE,
  route_path TEXT NOT NULL,
  viewport TEXT NOT NULL,
  screenshot_path TEXT,
  aria_snapshot TEXT,
  css_vars_json TEXT,
  box_models_json TEXT,
  console_errors_json TEXT,
  captured_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS target_patches (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES target_runs(id) ON DELETE CASCADE,
  target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  patch_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  patch_format TEXT NOT NULL,
  original_content TEXT,
  patch_content TEXT NOT NULL,
  description TEXT,
  impact REAL,
  risk REAL,
  effort REAL,
  confidence REAL,
  patchable_score REAL,
  status TEXT NOT NULL DEFAULT 'proposed',
  stash_ref TEXT,
  validation_result_json TEXT,
  applied_at INTEGER,
  created_at INTEGER NOT NULL
);
```

### Path Safety

External target folders are more sensitive than Open Design project folders.
Apply the same principles from `projects.ts`:

- A target path must be explicitly registered by the user via the UI.
- All reads and writes stay inside the registered root path.
- Resolve symlinks and reject paths that escape the root.
- Direct edits require approval unless trusted-auto mode is enabled for that
  severity level.
- Destructive edits (file deletion, full rewrites of files over 500 lines)
  require extra confirmation regardless of approval mode.
- Every patch is recorded in the database before being applied.
- Rollback must be available for every applied patch.

## Agent Roles

All roles route through the existing `spawnAgent()` infrastructure. The GUI
shows one unified assistant; the roles are implementation details visible only
in logs and advanced mode.

### Product Cartographer (Tier A)

Maps routes, flows, user goals, and current information architecture from the
workspace index. Returns a structured route-inventory JSON.

Input: WorkspaceIndex + file tree
Output: RouteInventory, ComponentInventory

### Design System Extractor (Tier B)

Builds DESIGN.md, token files, and component rules from code, static CSS
analysis, and runtime CSS vars from Playwright. Merges with any existing
DESIGN.md in the workspace.

Input: WorkspaceIndex, runtime CSS vars, existing DESIGN.md (if any)
Output: DESIGN.md draft, tokens.json, component-rules.json

### Target Designer (Tier C — once per workspace registration, cached)

Creates 2-4 named target design directions. Each direction is a structured
description (name, mood, typography scale, color palette, layout rhythm,
component treatments, estimated effort, risk). Does not generate visual mockups
on its own — the renderer in the web app converts the structured description to
a preview card.

Input: WorkspaceIndex, DESIGN.md, existing design audit, creativity budget
Output: array of TargetDirection objects

### Measurement Critic (Tier B with vision if available, Tier A fallback)

Compares current captures against target direction using structured JSON
(box models, CSS vars, ARIA) when vision is unavailable. Returns a structured
GapReport with findings ranked by patchable score.

Input: current captures, target reference, DESIGN.md
Output: GapReport (findings[], gap scores per dimension)

### Patch Planner (Tier B)

Converts GapReport findings into a sequenced PatchPlan. Selects patch format
per finding. Orders patches from low-risk foundational changes (tokens) to
higher-risk structural changes (layouts).

Input: GapReport, WorkspaceIndex, component-rules.json
Output: PatchPlan (ordered array of PatchProposal)

### Implementation Agent (Tier B — uses existing agent adapter directly)

Edits the target workspace after user approval. Receives a specific patch
proposal and the current file content. Returns the patched content in the
specified patch format. Runs inside the existing `spawnAgent()` lifecycle.

Input: PatchProposal, current file content, prompt profile
Output: patched content in the specified format

### Validation Agent (Tier A — mostly deterministic)

Runs build, type check, route smoke tests, screenshot recapture, visual diff,
ARIA snapshot comparison, and console error scan. Reports a structured
ValidationResult. The LLM component is only for interpreting build errors and
classifying new console warnings.

Input: ValidationResult raw data (build output, diff scores, ARIA diff)
Output: ValidationResult (pass/fail per dimension, error summaries)

### Memory Curator (Tier A)

Proposes updates to DESIGN.md and design-memory.json based on accepted and
rejected patches. Surfaces conflicting signals as explicit decisions.

Input: run history (accepted patches, rejected patches, score deltas)
Output: array of proposed MemoryUpdate objects (each accept/reject-able)

## GUI Design Principles

### Progressive Disclosure

Default view: goal, target direction, current vs. target, patch plan, results.

Advanced view (per-screen expandable drawer): raw screenshots, DOM snapshots,
box-model JSON, agent logs, file diffs, prompt details, validation logs.

Never surface advanced content by default.

### Agent and Model Picker

The agent and model dropdowns on Screen 1 are the same components used in the
main Open Design chat UI. They are driven by the existing registry endpoint
`GET /api/registry/agents`. No new agent discovery UI is needed.

### Confidence and Risk on Every Patch

Every patch card shows:

```text
Visual impact: High
Implementation risk: Low
Confidence: 82%
Files: tokens.css (+3 / -3 lines)
Rollback: git stash available
```

### Before/After Always Visible

The user must always be able to see current, target, after-patch, and diff
views. Never navigate away from the context to show a diff.

### Human Approval Checkpoints

Approval required before:

- Starting the target dev server.
- Installing dependencies in the target workspace.
- Applying any P0 or P1 patch.
- Applying any patch on the first run of a workspace.
- Writing DESIGN.md into the target workspace root.
- Deleting any file.
- Running browser automation against authenticated routes.
- Deploying.

### Live Design Compass (Persistent Sidebar)

Visible on Screens 3, 4, and 5. A compact score panel on the right edge:

```text
Visual   6.1 → 8.2
A11y     8.4
Tokens   62% → 91%
Build    ✓
```

Clicking any row opens the evidence drawer for that dimension.

## Workflow Examples

### Example 1: Vite App Polish With Claude Code

```text
1.  User connects apps/public — agent: Claude Code, model: default.
2.  Stage 0: static index runs in 1.2s. 48 components, 12 routes, 62% token
    coverage, 47 hardcoded values found.
3.  User chooses Improve + Balanced redesign.
4.  Stage 1: Tier A scan. Audit report: 5 main issues. Score: 6.1/10.
5.  Stage 2: Playwright captures 12 routes at desktop + mobile. Dev server
    started, captured, stopped. No browser session left running.
6.  Stage 3a: Tier C generates 4 directions. User picks "Premium Infrastructure".
7.  Stage 3b: Tier B gap analysis. GapReport: 14 findings, 3 P1, 7 P2, 4 P3.
8.  Stage 4: Tier B patch plan: 5 patches, ordered token-first.
9.  User reviews gap map on Screen 4. Approves patches 1-3, skips 4, approves 5.
10. Stage 5: apply patch 1 (tokens.css). TypeScript pre-validation passes.
    Git stash created. Patch applied. Build passes. Score delta: +0.9.
11. Apply patches 2 and 3. Build passes. Score: 6.1 → 8.2.
12. Screen 5: Validate and Learn. 3 proposed learning items. User accepts 2,
    rejects the gradient rule.
13. DESIGN.md updated with 2 new rules. prompt-profile.md updated.
```

### Example 2: Implement Open Design Artifact With Copilot

```text
1.  User creates a landing page artifact in Open Design using GitHub Copilot.
2.  User connects the target Vite app. Agent: GitHub Copilot.
3.  User chooses Implement mode.
4.  Stage 0: index shows existing Button, Card, Section components.
5.  Tier B maps artifact sections to existing components:
    "Hero" → src/components/Hero.tsx
    "Feature grid" → src/components/FeatureGrid.tsx
6.  Patch planner translates artifact into React/Vite + existing primitives.
    Does not create new CSS where existing components can be configured.
7.  User approves 4 patches.
8.  Validation: build passes, screenshots match artifact within 8% pixel diff.
9.  DESIGN.md learns the new section layout patterns.
```

### Example 3: Design From Scratch With Any Agent

```text
1.  User connects a weak public app with no design system.
2.  User chooses Design From Scratch + Bold direction.
3.  Agent: whatever the user has configured. Tier C used only for direction
    generation. All other stages use Tier B or Tier A.
4.  Target Designer proposes 4 directions. User picks one.
5.  Vken creates a phased implementation roadmap (3 stages across multiple runs)
    rather than rewriting all UI in one pass.
6.  Stage 1 patches: token foundation and typography scale only.
7.  User validates, accepts learnings, initiates stage 2.
```

## Pro Features

### Design Memory Timeline

Shows how the design system evolved across runs:

```text
v0 (initial): extracted from current app, 62% token coverage
v1 (run 1):   premium hosting palette, 91% token coverage
v2 (run 2):   button system consolidated, --radius-md standard
v3 (run 3):   mobile nav rules added, tap targets ≥44px enforced
```

### Visual Debt Register

Tracks unresolved design issues across runs:

```text
P1: Dashboard empty states need redesign        [open since run 1]
P1: Pricing comparison table overflows mobile   [open since run 2]
P2: Secondary cards use legacy shadow token     [introduced in run 3]
```

Items persist until a patch resolves them. Recurring items surface as warnings
in the patch plan.

### Design System Doctor

One-click audit of the living DESIGN.md and token files:

- Missing tokens (hardcoded values with no corresponding CSS var).
- Inconsistent values (same intent, different values in different components).
- Hardcoded radii not using token system.
- Typography drift (components not following the scale).
- Contrast violations.
- Component duplication (similar patterns that should be unified).
- Unused CSS vars.

### Component Mapper

Maps target visual elements to existing code components:

```text
Target "Primary CTA"  → src/components/Button.tsx   variant="primary"
Target "Feature Card" → src/components/Card.tsx      variant="feature"
Target "Nav Item"     → src/components/NavLink.tsx
```

Used by the Patch Planner to prefer configuring existing primitives over
creating new CSS. This is essential for keeping the target app maintainable.

### Route Story Generator

If the app has no Storybook, generate lightweight route stories or Playwright
states for future regression testing:

```text
homepage.default
homepage.mobile-menu-open
pricing.annual-toggle
login.error-state
dashboard.empty-state
```

Stored journeys become regression baselines for subsequent Vken runs.

### State Coverage Matrix

```text
Route       Default  Loading  Empty  Error  Mobile  Auth-gated
Homepage    ✓        n/a      n/a    n/a    ✓       n/a
Pricing     ✓        n/a      n/a    n/a    ✓       n/a
Dashboard   ✓        ✗        ✗      ✗      partial  ✓
Login       ✓        ✓        n/a    ✓      ✓       n/a
```

Missing coverage surfaces as low-priority findings in the gap report.

### Anti-Slop Gate

Extends the existing `lint-artifact.ts` patterns into a target-workspace code
quality gate. Deterministic, regex-based — no LLM tokens spent on lint:

- No hardcoded color hex when project has a color token.
- No hardcoded pixel values when a spacing token exists.
- No inconsistent radius values across components.
- No gradient backgrounds except approved patterns in DESIGN.md.
- No emoji icons used as UI primitives.
- No inaccessible contrast (computed at capture time via axe-core).
- No layout shift from dynamic text (flagged in console error scan).

The gate runs at Stage 0 (static grep) and again at Stage 5 (post-patch
validation via Playwright). Findings below the gate threshold block the patch
from being marked `applied`.

### Design Contracts

Generated from DESIGN.md and component-rules.json. Machine-readable contracts
that agents can reference in system prompts:

```text
Button contract:     min-height 44px, radius --radius-md, weight 500
Card contract:       padding 24px desktop / 18px mobile, border --border-subtle
Page shell contract: max-width 1280px, horizontal padding 48px desktop / 24px mobile
Color contract:      primary #0f172a, accent #3b82f6, danger #dc2626
```

### Intent-Preserving Redesign Checkpoint

Before any bold redesign begins, require the system to capture and confirm:

- Product purpose (one sentence).
- Primary user (one persona).
- Main conversion goal (one action).
- Required routes (list).
- Accessibility minimums (WCAG AA at minimum).
- Implementation budget (estimated hours of engineering time).
- Existing domain constraints (auth model, API dependencies, CMS, etc.).

The user reviews and confirms this checkpoint. It becomes the "north star" that
the Measurement Critic checks against after each patch.

### Browser Journey Recorder

Uses Browser Use or Playwright to record and replay flows:

```text
Open homepage → scroll to pricing → click CTA → open mobile menu → submit form
```

Stored journeys become regression checks. After each patch batch, the journey
is replayed and compared against the baseline. Score drop > 10% flags a
regression.

### Patch Simulation

Before applying a patch, show:

- Expected screenshots based on the target direction (not actual render).
- Files and line ranges affected.
- Full diff in the existing file viewer.
- Rollback plan (stash ref or original file path).

### Figma Optional Bridge

Future integration (not in MVP):

- Import Figma frames as target design context via Figma MCP.
- Export current app screenshots as Figma-like design snapshots.
- Map Figma components and variables to existing code primitives.

Open Design must remain fully usable without Figma.

## Validation Strategy

### Deterministic Checks (run by daemon, no LLM tokens)

- Build: `<buildCommand>` in target workspace.
- Type check: `tsc --noEmit`.
- Unit tests: `<testCommand>` if configured.
- Route smoke tests: Playwright navigates all primary routes, checks for
  console errors and network failures.
- Screenshot recapture and visual diff (pixelmatch + pHash + SSIM).
- ARIA snapshot diff (before vs. after patch).
- Accessibility scan: axe-core via Playwright `page.evaluate()`.
- Console error diff (new errors since last clean capture).
- Anti-slop gate: regex lint of patched files.

### Agentic Checks (Tier A, structured output)

- Copy critique: heading specificity, CTA verb strength, label accuracy.
- Design critique: hierarchy, rhythm, contrast, originality.
- UX friction report: path completion, tap target coverage, error state
  presence.

### Human Checks (always)

- Target direction selection.
- Patch approval (all P0/P1, all patches on first run).
- Learning acceptance (each proposed memory update).
- Final run acceptance.

## Scoring Model

Composite design quality score (0-10):

```text
Design Quality:        30 percent — hierarchy, rhythm, originality
Design-System Match:   20 percent — token coverage, component adherence
Accessibility:         15 percent — ARIA, contrast, tap targets
Responsive Quality:    15 percent — layout at all viewports
Implementation Health: 15 percent — build, type errors, console errors
Copy/Content Clarity:   5 percent — headings, labels, CTAs
```

Mode-specific weight adjustments:

- Implement mode: increase Design-System Match to 35 percent, reduce Design
  Quality to 20 percent (target fidelity is the primary goal).
- Improve mode: increase Implementation Health to 25 percent, reduce
  Design Quality to 20 percent (risk management is the primary concern).
- Design From Scratch: increase Design Quality to 40 percent, add Originality
  sub-dimension (5 percent), retain all feasibility gates.

## Implementation Phases

### Phase 0: Capture Spike (1 week)

Goal: prove Playwright captures a Vite app through the daemon.

Deliver:

- `TargetWorkspace` registration: `POST /api/targets/register` with framework
  detection from `package.json`.
- Dev server lifecycle: start, wait for port, capture, stop. Use the existing
  `platform` package primitives for process management.
- Playwright integration in daemon: add `playwright` to `apps/daemon/package.json`,
  install Chromium only. Expose `captureRoute(url, viewport)`.
- Store captures in `target_captures` table (add to existing SQLite).
- No agent calls, no LLM — purely deterministic.

Success: 3 routes captured at 3 viewports, data in SQLite, screenshots on disk.

### Phase 1: Static Intelligence (1-2 weeks)

Goal: static workspace index feeds a structured design audit via any agent.

Deliver:

- `WorkspaceIndex` builder: grep + PostCSS + simple TS file walk. Fingerprint
  cache: skip re-index if unchanged.
- Framework detection for Vite, Next.js, Astro, Remix, plain HTML.
- Tailwind v3 (config file) and v4 (`@theme` blocks) token extraction.
- Agent call for design audit: `VkenRunRequest` using existing `agentId` +
  `model` pattern. Returns structured `DesignAuditReport` JSON.
- Screen 1 (Connect) and Screen 2 (Live Analysis) in the web app. Use
  existing SSE infrastructure — just new event types on the same transport.
- `GET /api/targets/:id/analyze` with SSE stream on
  `GET /api/targets/:id/runs/:runId/sse`.

### Phase 2: Target Direction and Gap Engine (2 weeks)

Deliver:

- Tier C direction generation: structured `TargetDirection[]` JSON. 2-4
  directions per run.
- Direction preview cards in the web app (Screen 3). Render from structured
  JSON, no image generation needed for MVP.
- Gap measurement: pHash + pixelmatch + SSIM chain. Pure JS libraries — no
  native binaries, no Python subprocess.
- Semantic gap scoring via Tier A structured output (or regex fallback).
- `GapReport` stored in run directory and summarised in the database.
- Screen 3 (Intelligence Dashboard) and the gap view in Screen 4.

### Phase 3: Patch Loop With Approval (2 weeks)

Deliver:

- `PatchPlanner` role: Tier B generates ordered `PatchPlan` from `GapReport`.
- Patch format selection per finding type (search/replace, full rewrite).
- TypeScript pre-validation before apply (`tsc --noEmit` via `execFile`).
- Git stash rollback for git workspaces; file-backup rollback for non-git.
- `POST /api/targets/:id/apply-patch` with approval gate.
- `POST /api/targets/:id/rollback` for emergency revert.
- Full Screen 4 (Gap + Patch unified) in the web app.
- Patch diff viewer reusing the existing file viewer component.

### Phase 4: Validation and Learn (1 week)

Deliver:

- Post-patch recapture: incremental (only re-capture routes touched by patch).
- Build validation and type check via subprocess.
- Score delta: before vs. after composite score.
- `MemoryCurator` role: proposes DESIGN.md and `design-memory.json` updates.
- Screen 5 (Validate and Learn) in the web app.
- `PATCH /api/targets/:id/memory` for accept/reject of proposed learnings.
- Run history panel (trend over time for the workspace).

### Phase 5: Browser Use and Journey Discovery (1 week)

Deliver:

- Browser Use MCP connector detection at workspace registration.
- Journey recorder: capture route → interaction sequence → state screenshots.
- Journey replay after patch batches.
- UX friction report from journey replay (Tier B structured output).
- Opt-in enablement per workspace; off by default.

### Phase 6: Pro Workflow (2 weeks)

Deliver:

- Component Mapper: visual element → code component mapping.
- Route Story Generator: lightweight Playwright state definitions.
- State Coverage Matrix: coverage tracking across routes and states.
- Design Contracts: machine-readable contracts from DESIGN.md.
- Design System Doctor: one-click drift audit.
- Live Design Compass: persistent score sidebar (Screens 3-5).
- Visual Debt Register: persistent unresolved issue tracker.
- Anti-Slop Gate: integrated into Stage 5 validation.

### Phase 7: Integrations (2 weeks)

Deliver:

- ts-morph integration for complex TypeScript AST-level patches.
- Style Dictionary pipeline for token output (tokens.json → tokens.css →
  platform-specific formats).
- GitHub branch and PR flow (create branch per patch batch, open PR with
  gap report as description).
- CI check integration (Vken validation as a GitHub Actions step).
- Deployment preview comparison (capture production vs. target, score delta).
- Figma MCP optional bridge (import Figma frame as target design context).

## Technical Fit With Current Open Design

### Modules to Reuse Directly (No Changes)

- `apps/daemon/src/agents.ts` — agent adapter registry, process spawning,
  stream format selection, capability detection.
- `apps/daemon/src/runs.ts` — in-memory run registry, SSE client tracking.
- `apps/daemon/src/projects.ts` — safe path operations (`resolveProjectPath`,
  traversal protection). Mirror the same patterns for `targetRoot`.
- `apps/daemon/src/db.ts` — `openDatabase()`, WAL mode, idempotent migration
  pattern. Add Vken tables as new migrations.
- `packages/sidecar`, `packages/platform` — process management primitives
  for dev server lifecycle.
- `apps/web/src/providers/daemon.ts` — SSE client. New `TargetSseEvent` types
  are added to the same transport.
- `apps/web/src/components/FileViewer.tsx` — reuse for patch diff display.

### Modules to Extend

- `apps/daemon/src/design-systems.ts` — add runtime CSS var extraction pass
  alongside existing DESIGN.md parser.
- `apps/daemon/src/lint-artifact.ts` — extend regex patterns for hardcoded
  value detection in target workspace source files.
- `packages/contracts/src/api/` — add `targets.ts` following the exact shape
  of `projects.ts`.
- `packages/contracts/src/sse/` — add `targets.ts` following the exact shape
  of `chat.ts`.

### New Modules

```text
apps/daemon/src/targets.ts          — TargetWorkspace CRUD, registration, path safety
apps/daemon/src/target-index.ts     — Stage 0 static workspace index builder
apps/daemon/src/target-runner.ts    — dev server lifecycle (start / stop / port detect)
apps/daemon/src/target-capture.ts   — Stage 2 Playwright capture orchestration
apps/daemon/src/target-gap.ts       — visual diff chain (pHash + pixelmatch + SSIM)
apps/daemon/src/target-memory.ts    — design memory read/write, prompt profile generation
apps/daemon/src/target-patch.ts     — patch format selection, apply, rollback
apps/web/src/components/TargetPanel.tsx         — Screen 1: Connect and Configure
apps/web/src/components/TargetAnalysis.tsx      — Screen 2: Live Analysis
apps/web/src/components/TargetDashboard.tsx     — Screen 3: Intelligence Dashboard
apps/web/src/components/TargetGapPatch.tsx      — Screen 4: Gap + Patch unified
apps/web/src/components/TargetValidate.tsx      — Screen 5: Validate and Learn
apps/web/src/components/DesignCompass.tsx       — persistent score sidebar
```

### Boundary Rules (Unchanged From Existing Conventions)

- `packages/contracts` stays pure TypeScript — no Node.js APIs, no filesystem,
  no Express, no Playwright, no daemon internals.
- New daemon modules stay out of `packages/contracts`.
- Web components have no direct access to `.od/` — all data comes through the
  daemon API.
- Playwright import stays inside `apps/daemon/src/target-capture.ts` only,
  not in contracts or web.

## Product Differentiation

Vken is worth using because it is:

- **Local-first**: no cloud sync, no data leaves the machine, no monthly
  subscription required for the core loop.
- **BYO agent**: works with Claude Code, GitHub Copilot, Gemini, OpenCode,
  ACP-compatible tools, or any generic CLI the user has already configured.
- **Works on existing codebases**: not a from-scratch generator. Designed for
  apps that already exist and need improvement.
- **Uses real measurements**: pixelmatch, SSIM, computed styles, ARIA
  snapshots — not LLM opinions about screenshots.
- **Aspirational but feasible**: designs can be bold without becoming
  unimplementable. The creativity budget system makes the tradeoff explicit.
- **Approved patches, not only mockups**: code changes go into the real app,
  with rollback, not into a disconnected prototype.
- **Learns the project over time**: DESIGN.md and design memory improve with
  every accepted run.
- **Explains every recommendation with evidence**: patchable scores, gap
  dimensions, before/after screenshots — always available.
- **Keeps the user in control**: every P0/P1 patch requires human approval.
  Every learning item is individually accept/reject-able. Rollback is always
  one click.

Positioning:

```text
Open Design Vken is a local-first design intelligence loop for real frontend
codebases. It indexes your app without any LLM cost, learns your design
system, measures the actual gap with visual algorithms, applies approved
patches using whatever AI agent you already use, validates the result
deterministically, and improves its design guide every iteration.
```

## Non-Goals

- Do not become a hosted SaaS-only workflow.
- Do not require any specific AI provider or API key.
- Do not require Figma.
- Do not silently rewrite external folders.
- Do not use agentic browsing where static analysis or programmatic Playwright
  can answer the question cheaper.
- Do not optimize only for screenshot similarity while breaking TypeScript
  types, ARIA semantics, or component boundaries.
- Do not generate unrelated fantasy designs unless the user explicitly chooses
  a bold design-from-scratch mode.
- Do not hide risk from the user.
- Do not auto-apply P0 or P1 patches under any approval mode.
- Do not add new npm dependencies to the target workspace without user approval.

## Open Questions (Resolved)

**1. Should target metadata live in `.od/targets/` or in the target repo?**

Default: `.od/targets/` only. Opt-in flag `--write-to-workspace` writes
`.open-design/` into the target repo root after explicit user approval, useful
for teams who want to commit design memory to git.

**2. Should auto-apply ever be available?**

Yes, but scoped. P2 and P3 patches only, in `trusted_auto` mode, and only
after the user explicitly enables it for that workspace. P0 and P1 patches
always require explicit approval. Auto-apply is never available on the first
run of a workspace.

**3. Should Browser Use be bundled?**

No. External user-installed MCP connector. `pip install browser-use-mcp-server`,
then configure the MCP URL in Vken workspace settings. Avoids Python runtime
dependency in the TypeScript daemon.

**4. Should Playwright be a daemon dependency?**

Yes. Add `playwright` to `apps/daemon/package.json`. Install Chromium only.
Use the programmatic Node.js API in `target-capture.ts`. Not the MCP server,
not a CLI subprocess.

**5. Should Vken support authenticated flows in v1?**

No. Detect auth-gated routes (redirect on navigation) and mark them
`requiresAuth: true` with `priority: 'hidden'`. Surface to user in the
workspace index summary. Full authenticated flow support defers to v2.

**6. Should design memory sync to git by default?**

No. Local by default. Explicit "Export memory to git" action commits
`.open-design/design-memory.json` to the target repo. Never auto-push.

**7. What is the ts-morph integration point?**

Phase 7. Not in MVP. For MVP, search/replace blocks and full rewrites cover
the majority of patch types. ts-morph unlocks complex refactors (symbol
renames, interface changes, multi-location edits) in later phases.

**8. How does the tier model routing integrate with the existing agent picker?**

The Vken workspace configuration panel extends the existing agent and model
dropdowns. Tier A, B, and C each get their own model selector, defaulting to
the agent's configured default model for all three. Users who want efficiency
can configure Tier A to a faster model; users who want simplicity leave all
three at default. The mapping is stored in the `targets` table as
`tier_a_model`, `tier_b_model`, `tier_c_model`.

## Research References

- Figma Make: https://help.figma.com/hc/en-us/articles/31304412302231-Explore-Figma-Make
- Figma MCP server: https://help.figma.com/hc/en-us/articles/39216419318551-Get-started-with-the-Figma-MCP-server
- v0 docs: https://v0.app/docs
- Lovable docs: https://docs.lovable.dev/introduction/welcome
- Bolt.new open-source repo: https://github.com/stackblitz/bolt.new
- Replit Agent docs: https://docs.replit.com/core-concepts/agent
- Browser Use MCP: https://docs.browser-use.com/open-source/customize/integrations/mcp-server
- Browser Use introduction: https://docs.browser-use.com/open-source/introduction
- Builder Visual Copilot: https://www.builder.io/ai
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright ARIA snapshots: https://playwright.dev/docs/aria-snapshots
- Playwright MCP: https://github.com/microsoft/playwright-mcp
- pixelmatch (visual diff): https://github.com/mapbox/pixelmatch
- img-diff-js (SSIM, pure JS): https://github.com/reg-viz/img-diff-js
- Style Dictionary (token pipeline): https://amzn.github.io/style-dictionary/
- ts-morph (TypeScript AST): https://ts-morph.com/
- Windsurf Cascade architecture: https://www.qodo.ai/blog/windsurf-vs-cursor/
- Aider edit formats: https://aider.chat/docs/more/edit-formats.html
- Morph edit format guide: https://www.morphllm.com/edit-formats
- Token efficiency in agentic SE: https://arxiv.org/html/2601.14470v1
- Tailwind v4 token migration: https://www.oneminutebranding.com/blog/tailwind-v4-design-tokens
- Hardik Pandya on design systems and LLMs: https://hvpandya.com/llm-design-systems
- extract-design-system tool: https://github.com/arvindrk/extract-design-system
- WebGen-V bench visual scoring: https://arxiv.org/html/2510.15306v1
- Claude Agent SDK: https://claude.com/blog/building-agents-with-the-claude-agent-sdk
- Effective context engineering: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Prompt caching (5-minute TTL): https://platform.claude.com/docs/en/build-with-claude/prompt-caching
