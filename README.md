# VKEN Design Engine

AI design repair for real codebases. VKEN critiques a Vite + React + Tailwind app, chooses a design direction, applies literal patches, validates the result, learns from accepted fixes, and publishes a reviewable output.

- Space URL: add the Hugging Face Space link after deployment.
- Demo video: placeholder for Day 3 recording.
- GitHub repo: this repository.

## What It Does

- Intake scans a sample or public Git repo and builds a workspace index.
- VL critique scores screenshots and grounds findings in ARIA and box-model captures.
- Coder proposals produce literal search-replace patches that must match the current files before they appear.
- Finalize validates, writes a bundle, promotes HMAC-signed KB rules, and opens a PR when `VKEN_GITHUB_BOT_TOKEN` is configured.
- BYOK lets a browser session use OpenAI, Anthropic, Gemini, Ollama, OpenRouter, AMD vLLM, or cassette mode.

## Neuroinclusive Design Standard

VKEN treats neuroinclusive design as a product requirement, not a finishing pass. Every critique, design direction, and patch should preserve:

- Predictable structure: stable navigation, clear headings, consistent component behavior, and no surprise layout shifts.
- Cognitive clarity: plain labels, short task flows, visible status, and minimal competing calls to action.
- Sensory safety: restrained motion, no flashing, accessible contrast, and animation that respects reduced-motion preferences.
- Focus support: clear keyboard focus states, logical tab order, recoverable actions, and form errors tied to fields.
- Flexible reading: readable line lengths, generous spacing, no text hidden behind hover-only affordances, and copy that avoids unnecessary ambiguity.

The working standard lives in [docs/neuroinclusive-design-standard.md](docs/neuroinclusive-design-standard.md).

## Try It

Run the Space and click **Try landing-generic**. Cassette mode keeps the same cockpit working offline when provider quota is unavailable.

## Run Locally

```bash
corepack enable
pnpm install
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

## AMD Pivot

Set `VKEN_LLM_PROVIDER=amd-vllm` after starting the services in [infra/amd-cloud/README.md](infra/amd-cloud/README.md).

## Compatibility Names

The user-facing product is VKEN Design Engine. Some internal package scopes, commands, data paths, and environment variables still use `@open-design/*`, `od`, `.od`, or `OD_*` because they are part of the current workspace and sidecar contract. Those names are compatibility identifiers and should not be changed casually.
