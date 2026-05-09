import type { VkenScorePayload, VkenWorkspaceIndex } from './types.js';

export function scoreVkenIndex(
  index: VkenWorkspaceIndex,
  opts: {
    designQuality?: number | undefined;
    when?: VkenScorePayload['when'] | undefined;
    scoreBoost?: number | undefined;
  } = {},
): VkenScorePayload {
  const tokenCoverage = clamp01(index.tokens.coverageRatio);
  const hardcodePenalty = Math.min(0.35, index.hardcodedValues.length * 0.01);
  const designQuality = clamp01(opts.designQuality ?? 0.5 - hardcodePenalty + tokenCoverage * 0.25);
  const accessibility = 0.75;
  const neuroinclusive = clamp01(0.7 + tokenCoverage * 0.15 - Math.min(0.25, index.hardcodedValues.length * 0.005));
  const responsive = index.routes.length > 0 ? 0.7 : 0.3;
  const buildHealth = 1;
  const value =
    (designQuality * 0.28 +
      tokenCoverage * 0.18 +
      accessibility * 0.14 +
      neuroinclusive * 0.12 +
      responsive * 0.14 +
      buildHealth * 0.14) *
      10 +
    (opts.scoreBoost ?? 0);
  return {
    when: opts.when ?? 'initial',
    value: Math.round(value * 10) / 10,
    dimensions: {
      designQuality,
      tokenCoverage,
      accessibility,
      neuroinclusive,
      responsive,
      buildHealth,
    },
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
