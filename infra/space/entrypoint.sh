#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${OD_DATA_DIR:-/data}"
: "${PORT:=7860}"
: "${VKEN_LLM_PROVIDER:=cassette}"

echo "VKEN starting on :${PORT} provider=${VKEN_LLM_PROVIDER}"
exec node apps/daemon/dist/cli.js --host 0.0.0.0 --port "${PORT}" --no-open
