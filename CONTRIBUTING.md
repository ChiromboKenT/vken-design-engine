# Contributing to VKEN Design Engine

VKEN is an AI design repair system for real codebases. Contributions should improve design quality, reliability, validation, or the VKEN workflow without weakening the app's existing runtime contracts.

## Good Contribution Areas

| If you want to... | You are changing | Where it lives |
|---|---|---|
| Improve the VKEN repair loop | critique, patching, validation, learning | `apps/daemon/src/vken/`, `apps/web/src/components/vken/`, `packages/contracts/src/api/vken.ts` |
| Improve user-facing product UX | React UI, copy, cockpit states | `apps/web/src/` |
| Add or refine a design standard | design rules and review guidance | `docs/`, `design-systems/`, `craft/` |
| Improve daemon behavior | API, persistence, local execution | `apps/daemon/src/` |
| Improve lifecycle tooling | dev, packaging, release flows | `tools/` |

Root documentation is English-only. Do not add translated root READMEs, translated quickstarts, or translation maintenance guides unless the product deliberately reopens a localization program.

## Local Setup

```bash
corepack enable
pnpm install
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

Node `~24` and pnpm `10.33.x` are required. Use Corepack so the version pinned in `package.json` is selected.

## Compatibility Boundaries

The product brand is VKEN Design Engine, but several internal identifiers remain load-bearing:

- `@open-design/*` workspace package names
- `od` CLI name
- `.od` local data directory
- `OD_*` environment variables
- sidecar socket and stamp names that still contain `open-design`

Treat these as compatibility identifiers. Rename them only in a dedicated migration that updates contracts, tests, package manifests, sidecar runtime, docs, and existing data upgrade behavior together.

## Neuroinclusive Bar

VKEN changes should preserve the standard in [docs/neuroinclusive-design-standard.md](docs/neuroinclusive-design-standard.md). In practice, this means:

- Do not introduce flashing, aggressive animation, or motion that ignores reduced-motion preferences.
- Keep controls keyboard reachable with visible focus.
- Use plain labels and visible system status.
- Avoid dense, ambiguous, or hidden-only interaction patterns.
- Validate contrast, spacing, reading order, and error recovery when UI changes are user-facing.

## Code Style

- Project-owned entrypoints, modules, scripts, tests, reporters, and configs should be TypeScript-first.
- Match existing formatting and naming patterns.
- Keep comments short and useful.
- Do not add new top-level dependencies without a clear reason.
- Keep shared DTOs and web/daemon contracts in `packages/contracts`.

## Validation

Before marking regular work ready, run:

```bash
pnpm typecheck
pnpm test
```

Run `pnpm build` when build boundaries, packaging, or runtime entrypoints are involved. After changing package manifests, workspace layout, command entrypoints, or bin/link-related content, run `pnpm install`.

## Pull Requests

- Keep one concern per PR.
- Explain why the change exists, not just what changed.
- Include validation results.
- Do not add `Co-authored-by` trailers or other co-author metadata.
