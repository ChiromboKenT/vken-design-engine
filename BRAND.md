# VKEN Design Engine

VKEN Design Engine is the user-facing brand for this repository.

## Product Position

VKEN is an AI design repair loop for existing frontend codebases. It critiques live UI, proposes literal patches, validates the result, and learns from accepted fixes.

## Identity

- Name: VKEN Design Engine
- Short name: VKEN
- Voice: precise, practical, calm, and design-literate
- Core promise: measurable design improvement without breaking the app
- Design principle: neuroinclusive by default

## Neuroinclusive Baseline

VKEN interfaces and generated fixes must favor predictable structure, cognitive clarity, sensory safety, keyboard access, recoverable actions, readable text, and reduced-motion respect. The full standard is in [docs/neuroinclusive-design-standard.md](docs/neuroinclusive-design-standard.md).

## Compatibility Policy

The workspace currently keeps `@open-design/*` package names, the `od` CLI, `.od` data directories, `OD_*` environment variables, and sidecar socket names as compatibility identifiers. They are not user-facing brand names. Broad package-scope and protocol renames are deferred until they can be done as a dedicated migration without disrupting builds, storage, or sidecar discovery.
