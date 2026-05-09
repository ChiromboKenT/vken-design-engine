#!/usr/bin/env bash
set -euo pipefail

docker stop vken-vllm-vl vken-vllm-coder 2>/dev/null || true
echo "VKEN vLLM containers stopped"
