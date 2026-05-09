# Quickstart

Run VKEN Design Engine locally.

## Requirements

- Node.js `~24`
- pnpm `10.33.x`, selected through Corepack
- macOS, Linux, WSL2, or Windows native for most flows
- Optional local coding-agent CLI such as Codex, Claude Code, Gemini CLI, OpenCode, Cursor Agent, Qwen, Devin for Terminal, or GitHub Copilot CLI

```bash
corepack enable
corepack pnpm --version
pnpm install
```

## Start Web + Daemon

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

Open the web URL printed by `tools-dev`.

For the desktop shell and all managed sidecars in the background:

```bash
pnpm tools-dev
```

## Useful Commands

```bash
pnpm tools-dev status --json
pnpm tools-dev logs --json
pnpm tools-dev check
pnpm tools-dev stop
pnpm typecheck
pnpm test
pnpm build
```

`pnpm tools-dev` is the only local lifecycle entry point. Do not restore root aliases such as `pnpm dev`, `pnpm dev:all`, `pnpm daemon`, `pnpm preview`, or `pnpm start`.

## VKEN Provider Mode

The VKEN cockpit supports a per-browser-session provider selection. Use cassette mode for offline demo behavior, or bring your own key for OpenAI, Anthropic, Gemini, Ollama, OpenRouter, or AMD vLLM.

For AMD vLLM:

```bash
VKEN_LLM_PROVIDER=amd-vllm pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

Start the AMD services first using [infra/amd-cloud/README.md](infra/amd-cloud/README.md).

## Compatibility Runtime Names

Some internal names still use the original runtime contract:

- `@open-design/*` packages
- `od` CLI
- `.od/` data directory
- `OD_BIN`, `OD_DAEMON_URL`, `OD_PROJECT_ID`, and `OD_PROJECT_DIR`

Those names are expected. Reopen a project from the VKEN app when old agent sessions have stale `OD_*` values.
