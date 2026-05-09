# VKEN Data Refresh Runbook

Three commands the user runs on a **Node 24** machine to populate (or re-populate) the engine's data assets: KB seed, Hook stream, and cassettes. None requires a live MI300X — they all work in cassette mode and produce real, auditable artifacts.

| Field | Value |
|---|---|
| Required Node | 24.x (better-sqlite3 ABI) |
| Required pnpm | 10.33.2 |
| Required env | `VKEN_KB_SIGNING_KEY` (HMAC for KB rules) |
| Time | ~5 min total |
| When to re-run | Before every Space deploy, after any change to `propose.ts` deterministic patterns, after Phase-2 MI300X bring-up |

---

## Pre-flight

```bash
node --version       # must be v24.x
pnpm install
pnpm --filter @open-design/daemon build
node samples/install-all.mjs   # warms node_modules in samples
export VKEN_KB_SIGNING_KEY=$(cat ~/.vken-kb-signing-key.local 2>/dev/null || openssl rand -hex 32)
echo "$VKEN_KB_SIGNING_KEY" > ~/.vken-kb-signing-key.local
```

Provider for these steps: **cassette by default**. To re-record cassettes on real Qwen first (Phase-2 of the Day-3 plan), set `VKEN_LLM_PROVIDER` accordingly and the same scripts work unchanged.

---

## 1. Refresh `kb/seed.jsonl`

```bash
node scripts/vken-kb-harvest.ts --runs 30
```

What it does: runs the engine 30 times across the 3 samples, auto-picks one direction per run, applies the top 8 deterministic patches, recomputes scores from the materialized FS, and groups results by `(findingType, ruleText)` tuple — so distinct rationales become distinct rules instead of collapsing into 5 buckets.

Expect:
```
VKEN_KB_HARVEST_OK rules=<10..18> samples=3 runs=30
```

Verify:
```bash
wc -l kb/seed.jsonl                                    # expect ≥ 8
jq -r '.rule_text' kb/seed.jsonl | sort -u | wc -l     # expect distinct rule texts ≥ 6
jq -r '.evidence_runs | length' kb/seed.jsonl | head   # expect non-trivial counts (≥ 2)
grep -c "Seed variant" kb/seed.jsonl                   # expect 0
```

If the harvester yields fewer than 8 rules: bump `--runs` to 50 or extend `propose.ts` deterministic patterns to cover more `findingType` × pattern combinations.

---

## 2. Refresh `apps/web/src/components/vken/hook-stream.json`

```bash
node scripts/vken-record-hook-stream.ts landing-generic
```

What it does: runs one full engine pass against `landing-generic`, emits a `vken:score` event per stage (initial → per-approve → final), and writes the deduplicated score sequence + average inter-event interval to `hook-stream.json`. The Hook component on the public landing page replays this verbatim.

Expect:
```
VKEN_HOOK_STREAM_OK file=apps/web/src/components/vken/hook-stream.json samples=<4..7> intervalMs=<700..1200>
```

Verify:
```bash
jq '.source, .sampleId, .scores | length' apps/web/src/components/vken/hook-stream.json
# Expect: "recorded" "landing-generic" <count>
```

If the recording captured fewer than 3 score events: there's a regression in `executeDeterministicVkenRun` — `vken:score` should fire at least at intake, post-critique, and post-finalize. Investigate before continuing.

---

## 3. Refresh `infra/space/cassettes/*.json` (only after Phase-2 MI300X is up)

```bash
# Only when VKEN_VLLM_VL_URL + VKEN_VLLM_CODER_URL + VKEN_VLLM_TOKEN are set:
export VKEN_LLM_PROVIDER=amd-vllm
node scripts/vken-record-cassette.ts landing-generic
node scripts/vken-record-cassette.ts dashboard-cluttered
node scripts/vken-record-cassette.ts ecommerce-basic
```

What it does: runs each sample end-to-end against live Qwen on MI300X (or whichever provider is active), tags each chat call by phase (`critique` | `directions` | `patches`), and writes the transcript to `infra/space/cassettes/<sampleId>.json`. The Space's offline path then replays these recordings, so visitors without an LLM key still see real model output, not stubs.

Expect: each cassette file's `calls[]` contains one entry per phase with non-empty `response`. Verify:

```bash
for s in landing-generic dashboard-cluttered ecommerce-basic; do
  echo "=== $s ==="
  jq '.calls | map({task, phase, patchCount: (.response.patches // [] | length)})' \
    "infra/space/cassettes/$s.json"
done
```

Each sample should show one `task: coder, phase: patches` row with `patchCount > 0`.

---

## 4. Verify everything

```bash
node scripts/vken-day2-acceptance.ts          # non-strict: passes pre-MI300X
# After step 3 ran on MI300X:
node scripts/vken-day2-acceptance.ts --strict # strict: also requires non-empty cassette patches
```

Non-strict is the gate to pass before any Space deploy. Strict is the gate to pass before logging W2 in `docs/amd-spend.md`.

---

## Provenance honesty

The seed and Hook stream produced by steps 1 & 2 are **real engine output**, but in cassette/no-LLM mode the rule rationales come from `propose.ts`'s deterministic generator, not from Qwen. The submission's accuracy claim is "rules and stream are real engine output, signed and reproducible" — not "rules came from Qwen on MI300X."

Once step 3 runs on MI300X, re-run step 1 with the same provider so rule_text fields are model-derived. At that point `docs/amd-spend.md` window W2 logs the spend, and any "harvested on MI300X" claim is honest.
