# VKEN Hugging Face Space

Use the Docker Space runtime. Required or useful secrets:

- `VKEN_LLM_PROVIDER` defaults to `openrouter`; set `cassette` for offline demo safety.
- `VKEN_OPENROUTER_KEY`.
- `VKEN_OR_VL_MODEL`, default `qwen/qwen2.5-vl-72b-instruct:free`.
- `VKEN_OR_CODER_MODEL`, default `qwen/qwen-2.5-coder-32b-instruct:free`.
- `VKEN_LLM_FALLBACK1`, use `gemini` when `GOOGLE_API_KEY` is available, otherwise `cassette`.
- `GOOGLE_API_KEY` only for Gemini fallback.
- `VKEN_GITHUB_BOT_TOKEN` for real PR creation.
- `VKEN_KB_SIGNING_KEY` for HMAC-signed learned rules.
- `HF_SPACE_ID` for the OpenRouter referer header.

Local smoke:

```bash
docker build -f infra/space/Dockerfile -t vken-space:dev .
docker run --rm -p 7860:7860 -e VKEN_LLM_PROVIDER=cassette -e VKEN_KB_SIGNING_KEY=test vken-space:dev
```
