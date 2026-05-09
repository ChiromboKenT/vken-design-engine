# VKEN Self-Learning Loop — Design

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Companion to    | [docs/plans/2026-05-08-vken-day2-zero-cost-pivot.md](2026-05-08-vken-day2-zero-cost-pivot.md)      |
| Source of truth | [docs/plans/2026-05-07-vken-hackathon-v1-design.md](2026-05-07-vken-hackathon-v1-design.md) §15    |
| Owner           | Kenny Chirombo                                                                                     |
| Implements      | Day 2 Block 5 of the zero-cost pivot plan                                                          |
| DB foundations  | Already migrated Day 1: `vken_kb_rules`, `vken_kb_examples`, `vken_repo_memory`, `vken_run_memory` |

---

## 1. What "learning" means here

VKEN does **not** fine-tune any model. We don't own the inference and
the demo runs on free-tier APIs and BYOK keys. So "learning" cannot
mean weight updates.

Instead, VKEN learns the way most production agentic systems learn:

1. **Inference-time learning (RAG).** Past wins and losses become
   retrievable structured rules + few-shot examples that get injected
   into the next prompt. The model's weights never change; the *prompt
   it sees* gets smarter every run.
2. **Symbolic counterfactuals.** Each rule carries running statistics
   (`accept_count`, `reject_count`, `avg_score_delta`). Bad rules
   demote themselves out of retrieval. Good rules promote themselves
   to higher tiers and get more weight in ranking.
3. **Bench-validated promotion.** Before any rule reaches the global
   KB, it must demonstrably improve scores on the 3 bench samples
   without regressing the others. The samples function as a
   regression suite *for the KB itself*.
4. **Provenance-backed evidence.** Every retrieved rule carries its
   `evidence_run_ids[]` list and an HMAC signature. The cockpit can
   show "we recommend this because runs A, B, C improved by X% when
   they applied it." That evidence is what the model — and the human
   judge — actually learns from.

This loop is provider-agnostic by construction: the same retrieved
context + the same prompt envelope go to whichever LLM the active
provider answers with. **Switching from OpenRouter Qwen to BYOK
Anthropic to AMD vLLM does not reset the learning** — the KB lives
in SQLite + signed JSONL on disk, not in any model.

---

## 2. The three tiers

```
┌─────────────────────────────────────────────────────────────────┐
│  Tier 1 — Run memory     (vken_run_memory)                       │
│  Lifetime: this run only. Cleared on run end (kept for audit).  │
│  Scope: what this specific run learned about this specific app.  │
│  Promotes to Tier 2 when: enableRepoMemory=true AND patch        │
│  was approved AND validate.ts passed.                            │
├─────────────────────────────────────────────────────────────────┤
│  Tier 2 — Repo memory    (vken_repo_memory, keyed by repo_hash)  │
│  Lifetime: 30 days TTL, refreshed on use.                       │
│  Scope: what we know about THIS repo across runs.                │
│  Promotes to Tier 3 when: bench evaluator confirms generality    │
│  (see §5.2).                                                     │
├─────────────────────────────────────────────────────────────────┤
│  Tier 3 — Global KB      (vken_kb_rules + vken_kb_examples       │
│                           mirrored to kb/learned.jsonl, signed)  │
│  Lifetime: forever (until demoted).                              │
│  Scope: cross-repo design patterns proven across multiple        │
│  workspaces.                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Why three tiers and not one

- **Tier 1** lets the agent *learn within a run* — if direction picker
  rejected one finding category, propose.ts should not emit more
  patches in that category later in the same run.
- **Tier 2** lets us not re-learn the same lesson on the same repo.
  The second run on `acme/landing` should not re-discover that the
  team uses `--brand-purple` as a token; it should *open* with that
  knowledge.
- **Tier 3** is the actual long-term asset. It's what makes VKEN
  better tomorrow than today. Without it, every run starts cold.

---

## 3. Data shape

### 3.1 Tier 1 — `vken_run_memory.memory_json`

```jsonc
{
  "approved":  [{ "patchId": "p_…", "ruleId": "r_…", "scoreDelta": 1.4 }],
  "rejected":  [{ "patchId": "p_…", "ruleId": "r_…", "reason": "skipped" }],
  "reverted":  [{ "patchId": "p_…", "ruleId": "r_…", "reason": "validate-failed" }],
  "directionPicked": "d_…",
  "directionRejected": ["d_…"],
  "categoriesSuppressed": ["radius-inconsistency"],
  "anchorsLearned": [{ "search": "<button class=\"btn-primary\">", "occurrences": 7 }]
}
```

Updated by `vken/memory.ts` on every `vken:apply`, `vken:patch` (status
change), and `vken:direction` (pick) event.

### 3.2 Tier 2 — `vken_repo_memory.memory_json`

```jsonc
{
  "tokenAliases":  { "--brand": "#5b21b6", "--accent": "#f59e0b" },
  "preferredRadius": "0.75rem",
  "anchorsLearned": [/* deduped + persisted from Tier 1 across runs */],
  "ruleStats":     { "r_…": { "uses": 3, "wins": 3, "lastDelta": 1.6 } },
  "userOverrides": { "alwaysSuppress": ["a11y-decorative-img"] }
}
```

`repo_hash = sha256(normalize(repoUrl) + branch).slice(0,16)`. TTL is
refreshed on every read.

### 3.3 Tier 3 — `vken_kb_rules` (already migrated; see schema)

```sql
id              TEXT PRIMARY KEY        -- ulid
finding_type    TEXT                    -- e.g. "hardcoded-color-when-token-exists"
framework       TEXT                    -- "vite-react-tailwind"
severity        TEXT                    -- P0|P1|P2|P3
rule_text       TEXT                    -- imperative: "Replace #6d28d9 with var(--brand-purple)"
accept_count    INTEGER                 -- monotonic
reject_count    INTEGER                 -- monotonic
avg_score_delta REAL                    -- exponentially weighted moving average
evidence_runs   TEXT                    -- JSON: ["run_…","run_…",…] capped at 50
signature       TEXT                    -- HMAC-SHA256 of (id|finding_type|rule_text|created_at)
```

And `vken_kb_examples` holds the actual `(search → replace)` patches
that earned the rule its credibility, indexed by `rule_id`.

### 3.4 Mirroring to signed JSONL

The same rules also get appended to `kb/learned.jsonl` (one line per
rule, sorted by `id`) so the Tier-3 corpus is **auditable in git**.
Each line:

```json
{"id":"01J…","finding_type":"…","rule_text":"…","examples":[…],"sig":"…","ts":1747000000000}
```

`kb/seed.jsonl` is the curated baseline that ships in the repo (50
hand-validated rules from initial dry runs). `kb/learned.jsonl` grows
over time. Both are signed with `VKEN_KB_SIGNING_KEY`. The daemon
**rejects unsigned or invalidly-signed lines on load** — this is the
anti-poisoning gate.

---

## 4. The retrieval flow (how learning enters a prompt)

```
                  POST /api/vken/runs/:id/direction
                                 │
                                 ▼
                       vken/propose.ts begins
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │ kb.retrieve({                        │
              │   findings,                          │
              │   framework: 'vite-react-tailwind',  │
              │   topK: 3 per finding,                │
              │   tier: ['t3','t2','t1']              │
              │ })                                    │
              └──────────────────────────────────────┘
                                 │
                                 ▼
            score(rule) =  0.45 * sigmoid(avg_score_delta)
                         + 0.30 * accept_ratio
                         + 0.15 * recency_decay(updated_at)
                         + 0.10 * tier_bonus(tier)
                                 │
                                 ▼
                  build prompt envelope with:
                    - the user-picked direction
                    - the run's findings
                    - top-K rules as JSON                     ← evidence
                    - top-K examples as (search,replace) pairs ← few-shot
                    - Tier-1 anchorsLearned as DO-NOT-RE-PROPOSE list
                                 │
                                 ▼
                       llm.chatCoder(...)  ← provider doesn't matter
                                 │
                                 ▼
                  zod-validate, emit vken:patch events
```

Key point: the LLM never sees the database or the JSONL. It only sees
a structured JSON envelope of distilled rules. The rules are short and
imperative ("When `class` includes `btn-primary` and there is no
focus-visible style, add `focus-visible:ring-2 focus-visible:ring-…`").
This keeps prompt budget bounded regardless of how big the KB grows.

---

## 5. The feedback loop (how learning happens)

### 5.1 Per-event updates

| SSE event           | What `vken/memory.ts` does                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `vken:direction`    | Append to `directionPicked` / `directionRejected`. Cluster the rejected direction's findings → `categoriesSuppressed`. |
| `vken:patch`        | Append the patch + its `ruleId` to Tier 1 with `status='proposed'`.                                     |
| `vken:apply` (ok)   | Update Tier 1: `approved[]` += entry. **Stage** a Tier-3 update: `accept_count++`, push run into `evidence_runs`. |
| `vken:apply` (fail) | Update Tier 1: `rejected[]` or `reverted[]`. **Stage** Tier-3: `reject_count++`. Mark anchor as do-not-re-propose. |
| `vken:validate`     | If validate fails, **un-stage** the most recent Tier-3 stages from this run and instead `reject_count++` for those rules (because a "successful" approve that broke the build is not a win). |
| `vken:finalize`     | **Commit** all staged Tier-3 updates. Recompute `avg_score_delta`. Re-sign the rule. Append to `kb/learned.jsonl`. Emit `vken:learn` events. |

The two-phase staging is critical: a patch that the user approved but
that broke `tsc --noEmit` is *worse* than a patch they skipped, and
the KB must reflect that.

### 5.2 Promotion: Tier 1 → Tier 2

At `vken:finalize`, if `enableRepoMemory: true`:

```ts
for (const entry of run.tier1.approved) {
  if (entry.validatePassed && entry.scoreDelta > 0) {
    repoMemory.ruleStats[entry.ruleId].uses++;
    repoMemory.ruleStats[entry.ruleId].wins++;
    repoMemory.ruleStats[entry.ruleId].lastDelta = entry.scoreDelta;
  }
}
repoMemory.anchorsLearned = dedupeAnchors([...repoMemory.anchorsLearned, ...run.tier1.anchorsLearned]);
write(vken_repo_memory, repoHash(run.repoUrl), repoMemory, ttl=30d);
```

### 5.3 Promotion: Tier 2 → Tier 3 (the gate)

Far stricter. A repo-rule earns global-KB status only when **all** are
true:

1. **Multi-repo evidence.** The same `finding_type` + similar
   `rule_text` (cosine similarity > 0.85 on a tiny embedding from the
   active provider, OR exact normalized-text match) has been observed
   in ≥ 2 distinct `repo_hash` values.
2. **Bench non-regression.** A canary script
   (`scripts/vken-kb-bench.ts`) replays the candidate rule against the
   3 sample cassettes (see §7). The aggregate score delta across
   samples must be ≥ 0 *and* no individual sample regressed by > 1.0
   points.
3. **Self-critique.** A small Coder call rates the rule on a 1–5
   rubric (clarity, generality, anti-hallucination). Threshold ≥ 4.
4. **HMAC sign-off.** The daemon signs the rule with
   `VKEN_KB_SIGNING_KEY` and appends to `kb/learned.jsonl`.

Only after all four does the rule get an `INSERT` into `vken_kb_rules`
with `tier=3`. This is what stops the KB from filling up with noisy or
overfit rules — a real concern when you let an inference loop write to
its own retrieval source.

### 5.4 Demotion / pruning

Run as a background sweep at the end of every run:

- A Tier-3 rule whose **last-5 outcomes** show `success_rate < 0.4`
  → status `quarantined`. Excluded from retrieval, kept for audit.
- A Tier-3 rule whose patch has caused a `validate.ts` failure even
  once → status `quarantined` immediately.
- A quarantined rule with no recoveries in 14 days → status `retired`.
- A retired rule's row stays for traceability; its line in
  `kb/learned.jsonl` gets a `"retired_at": <ts>` field on next sweep.

We never delete rule rows. Provenance must be reconstructable from
`evidence_runs` even after demotion.

---

## 6. The cockpit surface

The user sees the loop in three places:

### 6.1 During a run — `LearnedToast.tsx`

When `vken:learn` fires, a small bottom-right toast slides in:

```
┌─────────────────────────────────────────┐
│ ✨ VKEN learned                          │
│                                         │
│ "When btn-primary lacks focus-visible,   │
│  add focus-visible:ring-2"               │
│                                         │
│ Tier 2 → Tier 3   ·   evidence: 3 runs  │
│ avg score delta: +1.6                    │
└─────────────────────────────────────────┘
```

This is the single most important demo moment after the score climb
— it makes the learning **visible**. Without it, the loop is invisible
to a judge.

### 6.2 On direction cards — evidence chips

Every direction and every patch in the cockpit shows
`evidence: N` next to it. Clicking expands the source rules and a
"runs that proved it" list. This is what makes "the agent learned"
into "the agent can show its receipts".

### 6.3 In `KBPanel.tsx` (`/vken/kb`)

A read-only browse of the global KB:

- Filter by finding_type, severity.
- Sortable by `avg_score_delta`, `accept_count`, `recency`.
- Each row shows: rule text, examples (collapsible), evidence runs
  (link out), tier, status, signature-verified badge.
- A "Tier promotion timeline" sparkline shows when each rule moved
  between tiers.

---

## 7. Cassettes are the learning bench

This part matters and is easy to overlook.

The cassette provider (`apps/daemon/src/vken/llm/providers/cassette.ts`)
lets us replay an entire LLM transcript deterministically. That means
we can run **the same engine logic against the same sample** with two
different KB states and measure the score delta caused purely by the
KB.

```bash
# Without learned rules
VKEN_LLM_PROVIDER=cassette VKEN_KB_VARIANT=seed-only \
  node scripts/vken-kb-bench.ts sample landing-generic
# → score: 6.2

# With learned rules
VKEN_LLM_PROVIDER=cassette VKEN_KB_VARIANT=seed+learned \
  node scripts/vken-kb-bench.ts sample landing-generic
# → score: 7.4

# delta = +1.2  ← this is "what learning bought us"
```

This is what `scripts/vken-kb-bench.ts` does for promotion gating
(§5.3 #2), and it doubles as the demo-time chart on slide 5 ("score
delta on 3 samples after N runs of learning").

---

## 8. Provider-agnostic by construction

The loop is unaffected by which LLM is answering because:

- The KB stores **rules and structured patches**, not model-specific
  embeddings or completion artifacts.
- Retrieval ranks by symbolic statistics (counts, ratios, recency),
  not by neural similarity.
- When neural similarity *is* needed (Tier 2 → Tier 3 rule
  deduplication, §5.3 #1), we use whatever embedding endpoint the
  current provider exposes (OpenRouter, Gemini, OpenAI, vLLM all
  have one). If none, we fall back to a tiny local hash-bucket
  similarity — good enough for "is this the same finding type?"
- The HMAC signature key is independent of any provider.

The result: a KB seeded by 30 OpenRouter Qwen runs continues to work
unchanged when the same Space later serves traffic from MI300X vLLM.
The learning is **transferred between models** because it lives at
the prompt-envelope layer, above the model.

---

## 9. End-to-end worked example

A new run on `landing-generic` with a non-empty KB:

1. **Intake + scan + capture** → workspace index has 14 hardcoded
   colors and 6 inconsistent radii.
2. **Initial score** → 6.0 (designQuality from VL critique = 0.45).
3. **kb.retrieve** is called with the findings. It returns:
   - Rule R1 (`hardcoded-color-when-token-exists`, evidence 12 runs,
     avg delta +1.4) with two example patches.
   - Rule R2 (`radius-inconsistency`, evidence 8 runs, avg delta
     +0.9) with one example patch.
   - Rule R3 (`btn-primary-missing-focus-visible`, evidence 3 runs,
     avg delta +1.6) — newly promoted last week.
4. **directions.ts** sees the rules in the prompt and proposes:
   - Direction A: "Token consolidation" (cites R1, R2).
   - Direction B: "Accessibility lift" (cites R3 + a11y findings).
5. User picks Direction A.
6. **propose.ts** emits 7 patches; 5 of them re-use the example
   patches from R1 and R2 verbatim with anchors found in this repo.
7. User approves 4 patches. `vken:apply` for each → Tier 1 records
   the wins.
8. **validate.ts** passes. `vken:finalize` commits Tier-3 stages:
   R1.accept_count: 12 → 16; R2.accept_count: 8 → 9.
9. `vken:learn` events fire for each updated rule. Toasts appear:
   "VKEN learned · R1 now has 16 winning runs · avg delta +1.45".
10. `kb/learned.jsonl` gets two updated lines (re-signed).
11. Background sweep: nothing to demote.

A **second judge** opens the cockpit 5 minutes later and runs
`landing-generic` again. Their run's `kb.retrieve` returns R1 and R2
ranked higher than before because their `avg_score_delta` ticked up
and their `accept_count` is fresher. The model's prompt is *measurably
smarter* than it was 5 minutes ago. **That is the learning loop.**

---

## 10. What we cut for the 2-day window

To keep this shippable on Day 2 Block 5 (≈90 minutes for the loop on
top of KB seed authoring):

- **No neural rule deduplication.** Tier-2→Tier-3 dedup uses
  normalized-text exact match only. Embedding cosine is a V2 add.
- **No background sweep daemon.** Demotion runs synchronously at the
  end of each run, not on a schedule.
- **Self-critique rubric (§5.3 #3) is a single Coder call with a
  5-line system prompt**, not a panel. Good enough to filter obvious
  garbage.
- **`vken_kb_examples` capped at 3 per rule.** More overflows the
  prompt budget on small free-tier context windows.
- **Repo memory scope = sample IDs only for V1.** URL-based repos
  also get Tier 2 once URL intake (gap G3) lands; both share the same
  `vken_repo_memory` table.

These are deferrals, not architectural compromises. The DB shape, the
HMAC chain, and the promotion gate are all V1-correct.

---

— end of document —
