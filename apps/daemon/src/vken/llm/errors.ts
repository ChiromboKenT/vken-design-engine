export type VkenLlmErrorCode =
  | 'VKEN_LLM_CONFIG'
  | 'VKEN_LLM_HTTP'
  | 'VKEN_LLM_RATE_LIMIT'
  | 'VKEN_LLM_SCHEMA'
  | 'VKEN_LLM_TIMEOUT'
  | 'VKEN_LLM_EMPTY';

export class VkenLlmError extends Error {
  constructor(
    public readonly code: VkenLlmErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export class VkenSchemaError extends VkenLlmError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('VKEN_LLM_SCHEMA', message, details);
  }
}

export class VkenTimeoutError extends VkenLlmError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('VKEN_LLM_TIMEOUT', message, details);
  }
}

export function isDemotableLlmError(error: unknown): boolean {
  if (!(error instanceof VkenLlmError)) return false;
  return (
    error.code === 'VKEN_LLM_RATE_LIMIT' ||
    error.code === 'VKEN_LLM_TIMEOUT' ||
    error.code === 'VKEN_LLM_SCHEMA' ||
    (error.code === 'VKEN_LLM_HTTP' &&
      typeof error.details.status === 'number' &&
      error.details.status >= 500)
  );
}
