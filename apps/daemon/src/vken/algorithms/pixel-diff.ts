import type { RgbaImage } from '../types.js';

export interface PixelDiffResult {
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
}

export function pixelDiff(a: RgbaImage, b: RgbaImage, threshold = 0.1): PixelDiffResult {
  assertSameShape(a, b);
  let diffPixels = 0;
  const totalPixels = a.width * a.height;
  for (let i = 0; i < totalPixels; i += 1) {
    const idx = i * 4;
    const yiq = colorDeltaYiq(
      a.data[idx] ?? 0,
      a.data[idx + 1] ?? 0,
      a.data[idx + 2] ?? 0,
      b.data[idx] ?? 0,
      b.data[idx + 1] ?? 0,
      b.data[idx + 2] ?? 0,
    );
    if (yiq > threshold) diffPixels += 1;
  }
  return {
    diffPixels,
    totalPixels,
    diffRatio: totalPixels === 0 ? 0 : diffPixels / totalPixels,
  };
}

function colorDeltaYiq(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const y = (0.29889531 * (r1 - r2) + 0.58662247 * (g1 - g2) + 0.11448223 * (b1 - b2)) / 255;
  const i = (0.59597799 * (r1 - r2) - 0.2741761 * (g1 - g2) - 0.32180189 * (b1 - b2)) / 255;
  const q = (0.21147017 * (r1 - r2) - 0.52261711 * (g1 - g2) + 0.31114694 * (b1 - b2)) / 255;
  return Math.sqrt(y * y * 0.5053 + i * i * 0.299 + q * q * 0.1957);
}

function assertSameShape(a: RgbaImage, b: RgbaImage): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`image dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
}

