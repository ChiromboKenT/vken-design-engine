#!/usr/bin/env bash
set -euo pipefail

: "${VKEN_VLLM_TOKEN:?Set VKEN_VLLM_TOKEN before starting vLLM}"
: "${VKEN_VLLM_VL_MODEL:=Qwen/Qwen2.5-VL-72B-Instruct}"
: "${VKEN_VLLM_CODER_MODEL:=Qwen/Qwen3-Coder-30B-A3B-Instruct}"
: "${VKEN_VLLM_IMAGE:=vllm/vllm-openai-rocm:latest}"

docker run -d --rm --name vken-vllm-vl \
  --device=/dev/kfd --device=/dev/dri --group-add video \
  -p 8000:8000 \
  -e HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}" \
  "${VKEN_VLLM_IMAGE}" \
  --model "${VKEN_VLLM_VL_MODEL}" \
  --served-model-name "${VKEN_VLLM_VL_MODEL}" \
  --host 0.0.0.0 \
  --port 8000 \
  --api-key "${VKEN_VLLM_TOKEN}"

docker run -d --rm --name vken-vllm-coder \
  --device=/dev/kfd --device=/dev/dri --group-add video \
  -p 8001:8000 \
  -e HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}" \
  "${VKEN_VLLM_IMAGE}" \
  --model "${VKEN_VLLM_CODER_MODEL}" \
  --served-model-name "${VKEN_VLLM_CODER_MODEL}" \
  --host 0.0.0.0 \
  --port 8000 \
  --api-key "${VKEN_VLLM_TOKEN}"

wait_for_models() {
  local port="$1"
  local name="$2"
  local start
  start="$(date +%s)"
  for _ in $(seq 1 180); do
    if curl -sf -H "Authorization: Bearer ${VKEN_VLLM_TOKEN}" "http://127.0.0.1:${port}/v1/models" >/dev/null; then
      local end
      end="$(date +%s)"
      echo "${name} ready in $((end - start))s"
      return 0
    fi
    sleep 5
  done
  echo "${name} did not become ready" >&2
  docker logs "vken-vllm-${name}" >&2 || true
  return 1
}

wait_for_models 8000 vl
wait_for_models 8001 coder

echo "Set VKEN_LLM_PROVIDER=amd-vllm"
echo "Set VKEN_VLLM_VL_URL=http://<pod-host>:8000/v1"
echo "Set VKEN_VLLM_CODER_URL=http://<pod-host>:8001/v1"
