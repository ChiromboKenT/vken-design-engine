# AMD MI300X Pivot

VKEN ships provider-agnostic. When AMD capacity is available, start the two vLLM services and set one provider flag:

```bash
export VKEN_VLLM_TOKEN=<token>
./infra/amd-cloud/start-vllm.sh
export VKEN_LLM_PROVIDER=amd-vllm
export VKEN_VLLM_VL_URL=http://<pod-host>:8000/v1
export VKEN_VLLM_CODER_URL=http://<pod-host>:8001/v1
```

No application code changes are required. The same `chatVL` and `chatCoder` calls used by OpenRouter, Gemini, BYOK OpenAI/Anthropic/Ollama, and cassette mode route to the vLLM OpenAI-compatible endpoints.

Stop the pod-side containers when credits are not actively being used:

```bash
./infra/amd-cloud/stop-vllm.sh
```
