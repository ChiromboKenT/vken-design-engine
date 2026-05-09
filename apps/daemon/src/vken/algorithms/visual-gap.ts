import type { RgbaImage, VisualGapResult } from '../types.js';
import { hammingDistance, perceptualHash } from './phash.js';
import { pixelDiff } from './pixel-diff.js';
import { structuralSimilarity } from './ssim.js';

export function computeVisualGap(current: RgbaImage, target: RgbaImage): VisualGapResult {
  const pHashDistance = hammingDistance(perceptualHash(current), perceptualHash(target));
  if (pHashDistance < 6) {
    return {
      pHashDistance,
      diffRatio: 0,
      ssim: 1,
      visualGap: 0,
      match: 'identical',
    };
  }
  const diffRatio = pixelDiff(current, target).diffRatio;
  const ssim = structuralSimilarity(current, target);
  const visualGap = diffRatio * 0.5 + (1 - ssim) * 0.3 + (Math.min(pHashDistance, 32) / 32) * 0.2;
  return {
    pHashDistance,
    diffRatio,
    ssim,
    visualGap,
    match: visualGap < 0.02 ? 'identical' : visualGap <= 0.1 ? 'minor' : 'significant',
  };
}

