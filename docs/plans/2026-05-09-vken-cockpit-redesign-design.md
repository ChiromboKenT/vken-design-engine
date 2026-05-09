# VKEN Cockpit Redesign — Design

Status: design accepted, implementation pending
Date: 2026-05-09
Owner: Kenny Chirombo

## Why

The current cockpit at `/vken` reads as a generic dashboard with magic numbers (`4.4`, `6.4`), three independent panels that scroll the page out of view, no clear narrative for the self-healing pipeline, and a visual identity indistinguishable from open-design. The daemon URL serves the same SPA, blurring the daemon/web boundary.

This redesign makes the repair-in-motion narrative the hero, replaces magic scores with named problem categories that shrink in real time, contains scroll inside bounded regions, gives VKEN a forest/copper identity that inherits open-design's chrome, and turns the daemon URL into a deliberately plain operator status page.

## Non-goals

- Multi-run comparison view.
- Inline diff editor (handoff to ChatPane covers it).
- Dark mode / theme system.
- Daemon page authentication (localhost-only).
- Replacing or forking AppChromeHeader, AvatarMenu, ConversationsMenu, PetRail, ChatPane, or AgentPicker.

## Decisions

| Question | Decision |
|---|---|
| What's the hero? | Repair in motion — a live, ordered narrative. |
| What replaces magic numbers? | Problems by named category, shrinking live. |
| What's VKEN's visual identity? | Dual-pane workshop (Patient \| Notebook) on a forest/copper/sand palette. |
| Where does VKEN sit in open-design? | Shared chrome, separate body — `/vken` reuses AppChromeHeader, ConversationsMenu, AgentPicker, AvatarMenu, PetRail. |
| What does the daemon URL serve? | Plain HTML operator status page, no React, no brand chrome. |
| What carries multi-option interactions? | Reuse `QuestionFormView` for direction-pick, steer-mid-flight, and discuss-this-finding. |

## Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ AppChromeHeader │ ConversationsMenu ▾ │ AgentPicker ▾ │ AvatarMenu  │
├────┬─────────────────────────────────────────────────────────────────┤
│    │  Sub-header (32px): VKEN · run id · sample tabs · provider chip │
│ P  ├──────────────────────────┬──────────────────────────────────────┤
│ E  │   PATIENT (60%)          │   NOTEBOOK (40%, min 380px)          │
│ T  │   live preview iframe    │   sticky: category bars              │
│    │   before/after toggle    │   scroll: stage cards                │
│ R  │   caption strip          │   sticky: approve bar                │
│ A  │                          │                                      │
│ I  ├──────────────────────────┴──────────────────────────────────────┤
│ L  │  Status rail (32px): pipeline progress · learn toast slot       │
└────┴─────────────────────────────────────────────────────────────────┘
```

- Fixed `100dvh` shell. `<body>` has `overflow: hidden`. The page itself never scrolls.
- Notebook is a flex column with one scrollable region in the middle; category bars stick to top, approve bar sticks to bottom — so the action a reviewer needs is never out of view.
- Below 900px the workshop collapses to tabs (Patient | Notebook), not a stack.

### Shared chrome behavior

- **AppChromeHeader** — gains a `subHeader` slot. Default null; non-VKEN routes unchanged.
- **ConversationsMenu** — VKEN runs become a conversation type. Switch between "Heal: landing-generic" and a chat from the same menu.
- **AgentPicker** — exposes a visible "VKEN" agent so users understand the mode.
- **PetRail** — gains four heal states (`watching`, `worried`, `cheering`, `resting`); state is passed in via prop. Rail background tints `forestDeep` so the pet visually belongs to VKEN's chrome.

## The Notebook (right pane)

### Sticky top — category bars

```
Color tokens missing      ▓▓▓▓▓▓▓░░░░░░░░  23 → 11   (12 fixing)
Spacing inconsistencies   ▓▓▓▓░░░░░░░░░░░  14 → 14   (queued)
Contrast issues           ▓▓░░░░░░░░░░░░░  6 → 2     (4 fixed)
Component repetition      ▓▓▓▓▓░░░░░░░░░░  18 → 18   (queued)
```

- Widths are deterministic (`count / max`), not 0–10 abstractions.
- Bar fill uses chart-1..chart-5 in OKLCH for perceptual distinguishability.
- Tooltip on each row lists the file:line for underlying findings.
- Click a row → filter the stage cards below to that category.

### Scroll middle — stage cards

Stages render in pipeline order. Only the active card is expanded; finished cards collapse to a one-line evidence summary; queued cards are dim placeholders.

```
✓  Capture       3 routes screenshotted · 1.2s
✓  Findings      61 problems across 4 categories
▼  Proposing     Patch 1 of 8  ────────────────────────────────
                  ┌─ Summary ──────────────────── [Code view] ─┐
                  │ "Three different shades of gray are used    │
                  │  for secondary text. Replacing them with    │
                  │  one shared value makes the page feel       │
                  │  more consistent and easier to update."     │
                  │                                             │
                  │ src/styles.css · 1 line · Token gap         │
                  └─────────────────────────────────────────────┘
                  [ Live preview ]  [Approve]  [Discuss]  [Reject]
○  Validating    waiting
○  Finalize      waiting
```

**Summary / Code toggle** — each patch card defaults to the plain-English Summary view. A "Code view" chip in the card header switches to the raw diff. The toggle state is per-card and persists until the card collapses. Code view shows:

```
  - color: #667085;
  + color: var(--vken-text-secondary);
```

Nothing else. No line numbers, no file path repeated, just the diff. "Summary view" chip switches back.

**Sequential patch ordering — no collisions** — patches are applied to a virtual FS session in strict pipeline order. Each patch's `search` string is matched against the *already-patched* file state, not the original. The pipeline enforces:

1. Token-defining patches first (`:root { ... }` additions) before any patch that references those tokens.
2. Patches to the same file are batched and applied top-to-bottom by line number to eliminate offset drift.
3. If a patch's `search` string no longer matches after prior patches landed, it is automatically marked `skipped` with reason "superseded" — it never reaches the user as a broken card.
4. The notebook renders patches in their enforced order, numbered `Patch 1 of 8`, `Patch 2 of 8`, etc. The user can only act on the topmost unresolved patch; subsequent cards are locked (visually dim) until the one above is resolved. This prevents approve-order collisions entirely.

**Complete patch card states** — every state is defined and has a distinct visual:

| State | Border | Badge | Actions visible |
|---|---|---|---|
| `locked` | `sandLight` dashed | dim number | none (unlocks when prior resolves) |
| `proposed` | `sandLight` solid | patch number | Live preview · Approve · Discuss · Reject |
| `previewing` | `copperWarm` pulse | [Live] pill | Approve · Dismiss preview · Discuss · Reject |
| `approved` | `forestMid` | [CheckCircle] Approved | Undo (until validation starts) |
| `rejected` | `stone` | [XCircle] Rejected | Undo |
| `validating` | `copperWarm` static | [Spinner] Validating… | none |
| `validated` | `forestDeep` | [CheckCircle] Confirmed | — |
| `regression` | `error` | [AlertTriangle] Regression | Re-steer · Reject |
| `skipped` | `sandLight` dashed | [Skip] Superseded | — |

No state is ambiguous. The user always knows exactly where a patch stands.

**Live preview behavior:**
- CSS-only patches: daemon injects a `<style>` tag into the patient pane iframe via `postMessage`. Instant rerender, no file write, no server round-trip. Patient pane shows a `[Live]` badge while preview is active. Clicking anywhere outside the card or "Dismiss preview" removes the injection.
- Non-CSS patches (JSX/HTML): "Live preview" triggers a fast server-side screenshot with the patch applied to the virtual FS. Result replaces the patient pane's after-capture. Latency is ~2–4s; a spinner on the patient pane communicates this.

- New events animate in at the active card with a 200ms fade. `prefers-reduced-motion: reduce` → instant.
- Only the topmost unresolved patch is ever `proposed`; all others below are `locked` until it resolves.

### Sticky bottom — approve bar

`[ Approve top patch ]  [ Reject ]  [ Discuss in chat ]` — always visible.

## Patient pane — making improvements unambiguous

The current before/after toggle hides one state at a time, so the improvement is never visually obvious. Replace it with three mechanisms:

**1. Reveal slider (drag to compare)** — a vertical drag handle sits over the patient pane iframe. Left of the handle shows the original capture; right shows the live or validated after-state. The user drags to reveal as much of each as they want. The handle is keyboard-accessible (left/right arrow keys, 10% increments). This is unambiguous: the user literally uncovers the improvement.

```
┌──────────────────────────────────────┐
│  BEFORE     │drag│  AFTER            │
│  ░░░░░░░░░  ◀──▶  ████████████████  │
│  old grays       → consistent tokens │
└──────────────────────────────────────┘
```

**2. Animated count delta on category bars** — when a patch lands, the relevant category bar's count ticks down with a 300ms counter animation and the bar segment shrinks. The number itself flashes `forestLight` briefly (200ms) before settling. Non-motion users get an instant jump with no flash. This makes "the engine is working" viscerally obvious without any extra UI chrome.

**3. Improvement caption strip** — a fixed strip below the patient pane (never scrolls) shows the plain-English summary of the most recently approved patch in a single sentence. Resets when the next patch becomes active. Example:

```
[CheckCircle]  Just fixed: "All buttons now share one consistent corner size." · src/styles.css
```

This gives a continuous plain-English running commentary of what changed, visible at all times without opening any card.

**What "unambiguous" means concretely:**
- The reveal slider must span the full height of the patient pane — not a thumbnail. The improvement must be visible at the scale the design actually renders.
- The after-state used in the slider is a real re-captured screenshot (or CSS-injected live view), not a mock. The user is looking at the actual outcome.
- Category bars must reach 0 for resolved categories before the run ends — not linger at 1 due to rounding. If a category is fully resolved, its bar disappears and the row gets a `[CheckCircle] All fixed` inline label.

## Suggestion pickers (reuse `QuestionFormView`)

Three places interaction goes through the same component used in chat:

1. **Direction picker** — after Findings, replaces `DirectionPicker.tsx`. Single-select with 2–3 directions ("Token-first", "Contrast-first", "Layout-first").
2. **Steer-mid-flight** — opens under the active stage card. Multi-select ("Prefer fewer files touched", "Avoid public components", "Group by category", "Skip this category"). Submitted as a `vken:steer` event the engine reads on next proposal.
3. **Discuss-this-finding** — opens ChatPane preloaded with finding + diff + a QuestionForm of labeled feedback options ("Wrong category", "Right idea, wrong file", "Breaks visual intent", "Approve with edit"). Selections become labeled training signal for the KB.

## Visual identity

Forest + copper + sand on ivory. One accent color (copperWarm) for "currently healing" — the only thing that moves.

```css
.vken-workshop {
  /* surfaces */
  --vken-surface:        #FAFAF5;   /* ivory      page + cards */
  --vken-surface-alt:    #F0EBE1;   /* sandPale   notebook pane bg */
  --vken-input:          #F5F0E8;   /* ivoryWarm  inputs, code bg */
  --vken-rule:           #E8DFD0;   /* sandLight  hairlines */

  /* ink */
  --vken-heading:        #2D3B2D;   /* forestDeep   h1..h3, chrome */
  --vken-body:           #1A1A1A;   /* charcoal */
  --vken-muted:          #6E6E6E;   /* stone        captions, file paths */

  /* the single moving accent */
  --vken-active:         #C9A96E;   /* copperWarm   active card border, focus rings */
  --vken-active-ink:     #B8944F;   /* copperDark   active card label */

  /* status — icon + label + color, never color alone */
  --vken-success:        #2E7D4F;
  --vken-warning:        #B8860B;
  --vken-error:          #C0392B;
  --vken-info:           #2E6B8A;

  /* progressive narrative */
  --vken-stage-done:     #3D5A3D;   /* forestMid    ✓ collapsed cards */
  --vken-stage-progress: #4A7A4A;   /* forestLight  bar fill base */
}
```

### Role mapping

| Region | Background | Border | Heading | Body |
|---|---|---|---|---|
| AppChromeHeader | `ivory` | bottom: `sandLight` | `forestDeep` | `charcoal` |
| Patient pane | `ivory` | `sandLight` | `forestDeep` | `charcoal` |
| Notebook pane | `sandPale` | left: `sandLight` | `forestDeep` | `charcoal` |
| Active stage card | `ivory` | `copperWarm` 1.5px | `forestDeep` | `charcoal` |
| Done stage card | `ivory` | `sandLight` | `forestMid` | `stone` |
| Queued stage card | `sandPale` | `sandLight` dashed | `stoneMid` | `stoneMid` |
| Approve bar | `ivoryWarm` | top: `sandLight` | — | — |

### Buttons

- **Primary** (Approve, Run direction): `copperWarm` background, `forestDeep` text, focus ring `copperWarm` 2px outline.
- **Secondary** (Discuss, Steer, Reject): `ivory` background, `forestMid` border, `forestDeep` text.
- **Destructive**: `ivory` background, `error` border + text, `XCircle` icon.

### Status pattern (WCAG 1.4.1)

Every status pill is `[Icon] [Label] [optional count]` with color tint. Never just a colored dot. Example: `[CheckCircle] Patch landed · src/styles.css:14`.

### Typography

- UI inherits open-design's sans (Inter).
- Numerals & code use `ui-monospace, SFMono-Regular`. Tabular numerals so category counts don't jitter as they shrink.
- Body headings get `letter-spacing: -0.01em` and a thin top hairline.

### Motion

- 200ms fades only.
- `copperWarm` accent border on the active card breathes at 1.6s.
- All motion disabled under `prefers-reduced-motion: reduce`.

## Metric language rules

Every number gets a noun and a verb. No standalone abstractions.

| Old | New |
|---|---|
| Score: 4.4 | "23 token gaps, 14 spacing, 6 contrast, 18 repeats" |
| 6.4 → end | "Fixed 14 · 0 regressions · 3 need review" |
| `vken:apply` chip | "Patch P2 landed in src/styles.css" |
| Token coverage 0% | "0 of 23 design values are tokenized" |
| evidence: 1 | "Backed by 1 KB precedent (click to view)" |

## Daemon operator page

`apps/daemon/src/server.ts` adds `GET /` returning a single static HTML response. No React, no bundle, no shared CSS — deliberately plain so it cannot be confused with the product. Auto-refresh via `<meta http-equiv="refresh" content="5">`.

```
VKEN daemon · operator status

  Status            running
  Provider          openrouter (env)  ·  fallback: cassette
  Models            VL  qwen/qwen2.5-vl-72b-instruct:free
                    Coder  qwen/qwen-2.5-coder-32b-instruct:free
  KB                seed.jsonl  ·  142 entries  ·  promoted: 3
  Last run          run_2026_05_09_aZ4b  ·  succeeded  ·  3m12s
  Queue             0 pending
  PID               48213
  Logs              C:\…\.tmp\tools-dev\default\daemon.log
  Data              C:\…\.od\app.sqlite

  Use the cockpit at  http://127.0.0.1:17573/vken
```

## File changes

### New

- `apps/daemon/src/operator-page.ts` — string-template HTML for `GET /`.
- `apps/web/src/components/vken/Workshop.tsx` — replaces `Cockpit.tsx`.
- `apps/web/src/components/vken/PatientPane.tsx` — preview iframe + before/after toggle + caption.
- `apps/web/src/components/vken/Notebook.tsx` — sticky bars + scroll stage list + sticky approve bar.
- `apps/web/src/components/vken/StageCard.tsx` — one card per pipeline stage, expand/collapse logic.
- `apps/web/src/components/vken/PatchCard.tsx` — single patch with all 9 states, summary/code toggle, live preview trigger.
- `apps/web/src/components/vken/CategoryBars.tsx` — bucket bar chart in OKLCH, animated count deltas.
- `apps/web/src/components/vken/RevealSlider.tsx` — drag-to-compare before/after slider over the patient pane.
- `apps/web/src/components/vken/ImprovementCaption.tsx` — sticky single-sentence plain-English caption strip.
- `apps/web/src/components/vken/SteerForm.tsx` — wrapper around `QuestionFormView` for steer/discuss/direction.
- `apps/web/src/components/vken/tokens.css` — palette variables.

### Modified

- `apps/web/src/components/vken/VkenApp.tsx` — wraps Workshop in AppChromeHeader + PetRail; injects `tokens.css`; adds VKEN sub-header.
- `apps/web/src/components/pet/PetRail.tsx` — add four heal states (`watching` / `worried` / `cheering` / `resting`); state via prop.
- `apps/web/src/components/ConversationsMenu.tsx` — add VKEN run type.
- `apps/web/src/components/AppChromeHeader.tsx` — add a `subHeader` slot (default null).
- `apps/daemon/src/server.ts` — register `GET /` operator page route.
- `packages/contracts/src/sse/vken.ts` — add per-category breakdown to events (`{ category, total, fixed, queued }`).

### Deleted

- `apps/web/src/components/vken/DirectionPicker.tsx` — replaced by `SteerForm`.
- `apps/web/src/components/vken/Timeline.tsx` — replaced by `StageCard` sequence.
- `apps/web/src/components/vken/ScoreGauge.tsx` — replaced by `CategoryBars`.
- `apps/web/src/components/vken/Cockpit.tsx` — replaced by `Workshop`.

## What breaks

- `/vken` URL stays. Bookmarks survive.
- Daemon root previously served the SPA index — now serves the operator page. Anyone scripting against `GET /` for HTML will see new markup; nobody should be (the SPA is the web port's job).
- Removed components have no consumers outside `VkenApp`.

## Validation

1. `pnpm typecheck && pnpm test`
2. `pnpm tools-dev run web --daemon-port 17456 --web-port 17573` with `VKEN_LLM_PROVIDER=cassette`.
3. Open `http://127.0.0.1:17573/vken`, click "Try landing-generic", confirm:
   - Page itself does not scroll. Approve bar always visible.
   - Category bars render four buckets, counts shrink as patches land.
   - Active stage card has copper border; finished cards collapse to one-line summary.
   - PetRail changes state during the run.
   - "Discuss" on a patch opens ChatPane with the patch attached.
4. Open `http://127.0.0.1:17456/`, confirm the operator page loads, auto-refreshes, links back to the cockpit.
5. `pnpm test:ui` for the workshop happy path.
6. `pnpm check:residual-js` (no new `.js` files introduced).

## Constraint compliance

- **AGENTS.md** — TypeScript-first; new files all `.ts/.tsx`; contracts updated in `packages/contracts` before web/daemon divergence; daemon route stays in `apps/daemon`.
- **BRAND.md** — VKEN identity is the user-facing name; `@open-design/*` packages, `od` CLI, `.od` paths, `OD_*` envs untouched. Voice precise/calm/design-literate. Neuroinclusive baseline honored: predictable structure (single dual-pane shell), reduced motion respected, keyboard-first picker reuse, status uses icon+label+color (WCAG 1.4.1).
- **docs/neuroinclusive-design-standard.md** — sticky regions prevent disorientation; bounded scroll; one accent color; tabular numerals; reduced-motion path.
