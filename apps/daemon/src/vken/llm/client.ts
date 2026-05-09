import type { ZodSchema } from 'zod';
import { VkenLlmError, VkenSchemaError, isDemotableLlmError } from './errors.js';
import {
  modelForProvider,
  selectProviderChain,
  type VkenByokConfig,
  type VkenProviderId,
  type VkenProviderSelection,
} from './select-provider.js';
import { chatOpenRouter } from './providers/openrouter.js';
import { chatGemini } from './providers/gemini.js';
import { chatAmdVllm } from './providers/amd-vllm.js';
import { chatOpenAi } from './providers/openai.js';
import { chatAnthropic } from './providers/anthropic.js';
import { chatOllama } from './providers/ollama.js';
import { chatCassette } from './providers/cassette.js';

export interface VkenChatTextPart {
  type: 'text';
  text: string;
}

export interface VkenChatImageUrlPart {
  type: 'image_url';
  image_url: { url: string };
}

export interface VkenChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<VkenChatTextPart | VkenChatImageUrlPart>;
}

export interface VkenChatUsage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface VkenChatResult {
  parsed: unknown;
  raw: string;
  usage: VkenChatUsage;
  providerId: VkenProviderId;
  modelId: string;
}

export interface VkenChatOptions {
  byok?: VkenByokConfig | undefined;
  provider?: VkenProviderId | undefined;
  sampleId?: string | undefined;
  runId?: string | undefined;
  phase?: 'critique' | 'directions' | 'patches' | 'test' | undefined;
  timeoutMs?: number | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
}

export interface VkenProviderRequest {
  task: 'vl' | 'coder';
  timeoutMs: number;
  phase?: VkenChatOptions['phase'];
  sampleId?: string | undefined;
  byok?: VkenByokConfig | undefined;
  model: string;
  messages: VkenChatMessage[];
  temperature?: number | undefined;
  maxTokens?: number | undefined;
}

export interface VkenProviderRawResult {
  raw: string;
  usage: VkenChatUsage;
  modelId: string;
}

type ProviderFn = (input: VkenProviderRequest) => Promise<VkenProviderRawResult>;

export interface VkenTranscriptRecorder {
  record(call: {
    task: 'vl' | 'coder';
    phase: string;
    messages: VkenChatMessage[];
    response: unknown;
    usage: VkenChatUsage;
    providerId: VkenProviderId;
    modelId: string;
  }): void;
}

let activeRecorder: VkenTranscriptRecorder | null = null;

export function setTranscriptRecorder(recorder: VkenTranscriptRecorder | null): void {
  activeRecorder = recorder;
}

const PROVIDERS: Record<VkenProviderId, ProviderFn> = {
  openrouter: chatOpenRouter,
  gemini: chatGemini,
  'amd-vllm': chatAmdVllm,
  openai: chatOpenAi,
  anthropic: chatAnthropic,
  ollama: chatOllama,
  cassette: chatCassette,
};

export async function chatVL(
  messages: VkenChatMessage[],
  schema?: ZodSchema,
  options: VkenChatOptions = {},
): Promise<VkenChatResult> {
  return chatWithProviders('vl', messages, schema, options);
}

export async function chatCoder(
  messages: VkenChatMessage[],
  schema?: ZodSchema,
  options: VkenChatOptions = {},
): Promise<VkenChatResult> {
  return chatWithProviders('coder', messages, schema, options);
}

export function providerInfo(opts: VkenChatOptions = {}): {
  id: VkenProviderId;
  vlModel: string;
  coderModel: string;
  source: 'env' | 'header';
} {
  const selection = selectProviderChain({ byok: opts.byok })[0] ?? { id: 'cassette' as const, source: 'env' as const };
  return {
    id: selection.id,
    vlModel: modelForProvider(selection.id, 'vl', selection.byok),
    coderModel: modelForProvider(selection.id, 'coder', selection.byok),
    source: selection.source,
  };
}

async function chatWithProviders(
  task: 'vl' | 'coder',
  messages: VkenChatMessage[],
  schema: ZodSchema | undefined,
  options: VkenChatOptions,
): Promise<VkenChatResult> {
  const explicitChain = options.provider
    ? [{ id: options.provider, source: 'env' as const, byok: options.byok }]
    : selectProviderChain({ byok: options.byok });
  let lastError: unknown;
  for (const selection of explicitChain) {
    try {
      return await callProviderWithSchemaRetry(task, selection, messages, schema, options);
    } catch (error) {
      lastError = error;
      if (selection.id === 'cassette' || !isDemotableLlmError(error)) break;
      console.warn(
        `[vken:llm] ${selection.id} demoted after ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new VkenLlmError('VKEN_LLM_EMPTY', 'no LLM provider returned a result');
}

async function callProviderWithSchemaRetry(
  task: 'vl' | 'coder',
  selection: VkenProviderSelection,
  messages: VkenChatMessage[],
  schema: ZodSchema | undefined,
  options: VkenChatOptions,
): Promise<VkenChatResult> {
  let schemaError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const strictMessages =
      attempt === 0
        ? messages
        : [
            {
              role: 'system' as const,
              content:
                'The previous response did not match the required JSON schema. Respond with a single JSON object only. No prose.',
            },
            ...messages,
          ];
    const model = modelForProvider(selection.id, task, selection.byok);
    const raw = await PROVIDERS[selection.id]({
      task,
      phase: options.phase,
      sampleId: options.sampleId,
      byok: selection.byok,
      model,
      messages: strictMessages,
      timeoutMs: options.timeoutMs ?? 60_000,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
    const parsed = parseJsonObject(raw.raw);
    if (!schema) {
      const result = { parsed, raw: raw.raw, usage: raw.usage, providerId: selection.id, modelId: raw.modelId };
      activeRecorder?.record({
        task,
        phase: options.phase ?? 'unknown',
        messages,
        response: result.parsed,
        usage: result.usage,
        providerId: result.providerId,
        modelId: result.modelId,
      });
      return result;
    }
    const checked = schema.safeParse(parsed);
    if (checked.success) {
      const result = {
        parsed: checked.data,
        raw: raw.raw,
        usage: raw.usage,
        providerId: selection.id,
        modelId: raw.modelId,
      };
      activeRecorder?.record({
        task,
        phase: options.phase ?? 'unknown',
        messages,
        response: result.parsed,
        usage: result.usage,
        providerId: result.providerId,
        modelId: result.modelId,
      });
      return result;
    }
    schemaError = checked.error;
  }
  throw new VkenSchemaError('LLM response did not match schema after retry', {
    provider: selection.id,
    error: schemaError instanceof Error ? schemaError.message : String(schemaError),
  });
}

function parseJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new VkenSchemaError('LLM response was not JSON', { raw: raw.slice(0, 400) });
  }
}
