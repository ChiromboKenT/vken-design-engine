import type { RgbaImage } from '../types.js';

export function structuralSimilarity(a: RgbaImage, b: RgbaImage): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`image dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const n = a.width * a.height;
  if (n === 0) return 1;

  const grayA = grayscale(a);
  const grayB = grayscale(b);
  const meanA = mean(grayA);
  const meanB = mean(grayB);
  let varianceA = 0;
  let varianceB = 0;
  let covariance = 0;
  for (let i = 0; i < n; i += 1) {
    const da = (grayA[i] ?? 0) - meanA;
    const db = (grayB[i] ?? 0) - meanB;
    varianceA += da * da;
    varianceB += db * db;
    covariance += da * db;
  }
  const denom = Math.max(1, n - 1);
  varianceA /= denom;
  varianceB /= denom;
  covariance /= denom;

  const c1 = 6.5025;
  const c2 = 58.5225;
  const numerator = (2 * meanA * meanB + c1) * (2 * covariance + c2);
  const denominator = (meanA * meanA + meanB * meanB + c1) * (varianceA + varianceB + c2);
  return clamp01(denominator === 0 ? 1 : numerator / denominator);
}

function grayscale(image: RgbaImage): number[] {
  const out = new Array<number>(image.width * image.height);
  for (let i = 0; i < out.length; i += 1) {
    const idx = i * 4;
    out[i] =
      0.299 * (image.data[idx] ?? 0) +
      0.587 * (image.data[idx + 1] ?? 0) +
      0.114 * (image.data[idx + 2] ?? 0);
  }
  return out;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

