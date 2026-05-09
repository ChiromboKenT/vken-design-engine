import { describe, expect, it } from 'vitest';
import { chatCoder, chatVL, providerInfo } from '../src/vken/llm/client.js';
import { CritiqueSchema, DirectionsSchema } from '../src/vken/llm/schema.js';

describe('vken llm client', () => {
  it('uses cassette provider for parseable VL and Coder responses', async () => {
    const critique = await chatVL(
      [{ role: 'user', content: 'critique smoke' }],
      CritiqueSchema,
      { provider: 'cassette', sampleId: 'landing-generic', phase: 'critique' },
    );
    expect(critique.providerId).toBe('cassette');
    expect((critique.parsed as { designQuality: number }).designQuality).toBeGreaterThan(0);

    const directions = await chatCoder(
      [{ role: 'user', content: 'directions smoke' }],
      DirectionsSchema,
      { provider: 'cassette', sampleId: 'landing-generic', phase: 'directions' },
    );
    expect((directions.parsed as { directions: unknown[] }).directions).toHaveLength(2);
  });

  it('reports provider info from explicit BYOK config', () => {
    expect(providerInfo({ byok: { provider: 'openai', coderModel: 'gpt-4o-mini' } })).toMatchObject({
      id: 'openai',
      coderModel: 'gpt-4o-mini',
      source: 'header',
    });
  });
});
