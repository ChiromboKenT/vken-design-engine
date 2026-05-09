# VKEN AMD MI300X Spend Log

This is the authoritative ledger of every AMD Developer Cloud GPU-hour we spend on VKEN. It is **append-only** (no editing past rows once committed) and is the document a judge reads to confirm that any "harvested on MI300X" claim has receipts.

| Field | Value |
|---|---|
| Credit issued | $100.00 (AMD Developer Cloud, 2026-05-09) |
| Credit expires | 2026-06-07 |
| Hard cap | Stop and reassess at $80.00 used; never exceed $95.00 |
| Operational rule | Every AMD block ends with `bash infra/amd-cloud/stop-vllm.sh` and droplet destruction in the AMD Developer Cloud UI |
| Owner | Kenny Chirombo |

## Current state (as of 2026-05-09)

**No MI300X work has occurred yet.** The droplet has not been provisioned.

This means:
- `kb/seed.jsonl` is currently the output of running the deterministic engine pipeline against the three sample apps in **cassette mode** (no live LLM inference). Rules are real engine output and HMAC-signed, but the rationales come from the deterministic propose-pass, not from Qwen.
- `infra/space/cassettes/*.json` are hand-authored stubs whose `phase: "patches"` entries have empty `patches[]`. No real LLM transcripts have been recorded yet.
- Any submission text that says "harvested on MI300X" is **aspirational** until at least window W2 below has been completed and logged.

## Budget plan

| Window | Purpose | Target hours | Spend cap |
|---|---|---:|---:|
| W0 | Planning, documentation, zero-cost code work | 0 GPU-h | $0 |
| W1 | Droplet bring-up + vLLM smoke + latency baseline | 1–2 GPU-h | $8 |
| W2 | Cassette recording + 30-run KB harvest across 3 samples | 8–12 GPU-h | $48 |
| W3 | Bench validation runs (seed-only vs seed+learned) | 2–3 GPU-h | $12 |
| W4 | Live judging window (warm MI300X for live demo) | 4–6 GPU-h | $24 |
| Buffer | Debug, retry, rate-limit recovery | 4 GPU-h | $16 |
| **Total budget** |  | **19–27 GPU-h** | **~$108 (overspends buffer absorbs)** |

## Ledger

Append one row per work session. Format: `YYYY-MM-DD HH:MM | window | duration | spent$ | balance$ | task | result | notes`.

| Timestamp | Window | Duration (GPU-h) | Spent ($) | Balance ($) | Task | Result | Notes |
|---|---|---:|---:|---:|---|---|---|
| 2026-05-09 — | W0 | 0.0 | $0.00 | $100.00 | Plan, docs, code-only Day-3 truth fixes | ok | No GPU consumed; phases 1, 3, 4 of Day-3 plan complete. Phases 2, 5 require W1+. |

## Pre-flight checklist before logging W1

Do not bring up the droplet until all of these are green; doing so otherwise just burns credit.

- [ ] AMD Developer Cloud account verified, credit visible in dashboard
- [ ] SSH key uploaded to AMD profile
- [ ] Payment method on file (per AMD's safety-net rule for credit exhaustion)
- [ ] HF_TOKEN with Qwen2.5-VL-72B-Instruct gated-model access approved
- [ ] `VKEN_VLLM_TOKEN` generated (`openssl rand -hex 32`) and stored in secrets manager
- [ ] `VKEN_KB_SIGNING_KEY` exists (32+ hex chars) and is the same value across local + Space
- [ ] Local daemon dist built and Day-3 acceptance script (non-strict) prints `DAY_3_ACCEPTANCE_OK`
- [ ] Runbook `docs/runbooks/2026-05-09-vken-deployment-and-demo.md` §5 reviewed in full

## Honesty protocol

This ledger exists to make the AMD claim auditable. Do not pre-fill rows. Do not log spend that hasn't happened. If a window aborts (e.g., model pull fails), log it as `aborted` with the partial GPU-hours actually consumed — incomplete is honest, fictional is not.

Any submission text (PR body, README, runbook, Hugging Face Space description) that says "harvested on AMD MI300X" must be edited to current truth until W2 is logged green here. The seed and cassettes are real engine output; until W2 they are not Qwen output. That distinction matters.
