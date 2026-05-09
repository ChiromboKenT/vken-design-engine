import { describe, expect, it } from 'vitest';

import {
  computeVisualGap,
  hammingDistance,
  perceptualHash,
  pixelDiff,
  structuralSimilarity,
  type RgbaImage,
} from '../src/vken/index.js';

function solid(width: number, height: number, rgb: [number, number, number]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    data[idx] = rgb[0];
    data[idx + 1] = rgb[1];
    data[idx + 2] = rgb[2];
    data[idx + 3] = 255;
  }
  return { width, height, data };
}

function split(width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const light = x < width / 2 ? 30 : 230;
      data[idx] = light;
      data[idx + 1] = light;
      data[idx + 2] = light;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('vken visual algorithms', () => {
  it('computes hamming distance for pHash bitsets', () => {
    expect(hammingDistance(0b1010n, 0b0011n)).toBe(2);
  });

  it('creates stable perceptual hashes for the same image', () => {
    const image = split(16, 16);
    expect(perceptualHash(image)).toBe(perceptualHash(image));
  });

  it('computes zero pixel diff for identical images', () => {
    const image = solid(2, 2, [10, 20, 30]);
    expect(pixelDiff(image, image).diffRatio).toBe(0);
  });

  it('computes lower SSIM for different images', () => {
    const dark = solid(4, 4, [0, 0, 0]);
    const light = solid(4, 4, [255, 255, 255]);
    expect(structuralSimilarity(dark, dark)).toBe(1);
    expect(structuralSimilarity(dark, light)).toBeLessThan(0.01);
  });

  it('classifies a significant visual gap', () => {
    const current = split(16, 16);
    const target = solid(16, 16, [255, 255, 255]);
    expect(computeVisualGap(current, target).match).toBe('significant');
  });
});

