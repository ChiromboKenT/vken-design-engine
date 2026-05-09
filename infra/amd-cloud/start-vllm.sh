#!/usr/bin/env bash
set -euo pipefail

: "${VKEN_VLLM_TOKEN:?Set VKEN_VLLM_TOKEN before starting vLLM}"
: "${VKEN_VLLM_VL_MODEL:=Qwen/Qwen2.5-VL-72B-Instruct}"
: "${VKEN_VLLM_CODER_MODEL:=Qwen/Qwen3-Coder-30B-A3B-Instruct}"

docker run -d --rm --name vken-vllm-vl \
  --device=/dev/kfd --device=/dev/dri --group-add video \
  -p 8000:8000 \
  -e HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}" \
  rocm/vllm:latest \
  --model "${VKEN_VLLM_VL_MODEL}" \
  --served-model-name "${VKEN_VLLM_VL_MODEL}" \
  --host 0.0.0.0 \
  --port 8000 \
  --api-key "${VKEN_VLLM_TOKEN}"

docker run -d --rm --name vken-vllm-coder \
  --device=/dev/kfd --device=/dev/dri --group-add video \
  -p 8001:8000 \
  -e HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}" \
  rocm/vllm:latest \
  --model "${VKEN_VLLM_CODER_MODEL}" \
  --served-model-name "${VKEN_VLLM_CODER_MODEL}" \
  --host 0.0.0.0 \
  --port 8000 \
  --api-key "${VKEN_VLLM_TOKEN}"

echo "Set VKEN_LLM_PROVIDER=amd-vllm"
echo "Set VKEN_VLLM_VL_URL=http://<pod-host>:8000/v1"
echo "Set VKEN_VLLM_CODER_URL=http://<pod-host>:8001/v1"
