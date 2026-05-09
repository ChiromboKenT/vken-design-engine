import type { RgbaImage } from '../types.js';

const HASH_SIZE = 8;
const SAMPLE_SIZE = 32;

export function hammingDistance(a: bigint, b: bigint): number {
  let value = a ^ b;
  let distance = 0;
  while (value > 0n) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

export function perceptualHash(image: RgbaImage): bigint {
  const grayscale = resizeToGrayscale(image, SAMPLE_SIZE, SAMPLE_SIZE);
  const coefficients = dct2d(grayscale, SAMPLE_SIZE, SAMPLE_SIZE);
  const lows: number[] = [];
  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      if (x === 0 && y === 0) continue;
      lows.push(coefficients[y * SAMPLE_SIZE + x] ?? 0);
    }
  }
  const sorted = [...lows].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  let hash = 0n;
  for (let i = 0; i < lows.length; i += 1) {
    if ((lows[i] ?? 0) > median) hash |= 1n << BigInt(i);
  }
  return hash;
}

function resizeToGrayscale(image: RgbaImage, width: number, height: number): number[] {
  const out = new Array<number>(width * height);
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(image.height - 1, Math.floor((y / height) * image.height));
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(image.width - 1, Math.floor((x / width) * image.width));
      const idx = (srcY * image.width + srcX) * 4;
      const r = image.data[idx] ?? 0;
      const g = image.data[idx + 1] ?? 0;
      const b = image.data[idx + 2] ?? 0;
      out[y * width + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return out;
}

function dct2d(input: number[], width: number, height: number): number[] {
  const out = new Array<number>(width * height).fill(0);
  for (let v = 0; v < height; v += 1) {
    for (let u = 0; u < width; u += 1) {
      let sum = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          sum +=
            (input[y * width + x] ?? 0) *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * width)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * height));
        }
      }
      const cu = u === 0 ? Math.SQRT1_2 : 1;
      const cv = v === 0 ? Math.SQRT1_2 : 1;
      out[v * width + u] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

