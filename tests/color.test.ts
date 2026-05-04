import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPLAY_GAMMA,
  DISPLAY_GAMMA_MAX,
  DISPLAY_GAMMA_MIN,
  REC709_LUMINANCE_WEIGHTS,
  computeRec709Luminance,
  linearToDisplayGamma,
  linearToDisplayGammaByte,
  normalizeDisplayGamma
} from '../src/color';

const fragmentSource = readFileSync(
  new URL('../src/rendering/shaders/exr-image.frag.glsl', import.meta.url),
  'utf8'
);

describe('color utilities', () => {
  it('computes Rec.709 luminance from the shared weights', () => {
    expect(computeRec709Luminance(1, 0.5, 0.25)).toBeCloseTo(0.5883, 4);
    expect(computeRec709Luminance(1, 1, 1)).toBe(1);
  });

  it('normalizes display gamma to the supported range', () => {
    expect(DEFAULT_DISPLAY_GAMMA).toBe(2.2);
    expect(normalizeDisplayGamma(2.4)).toBe(2.4);
    expect(normalizeDisplayGamma(-1)).toBe(DISPLAY_GAMMA_MIN);
    expect(normalizeDisplayGamma(10)).toBe(DISPLAY_GAMMA_MAX);
    expect(normalizeDisplayGamma(Number.NaN)).toBe(DEFAULT_DISPLAY_GAMMA);
  });

  it('encodes finite values with signed display gamma', () => {
    const value = 0.25;

    expect(linearToDisplayGamma(value)).toBeCloseTo(Math.pow(value, 1 / DEFAULT_DISPLAY_GAMMA), 12);
    expect(linearToDisplayGamma(-value)).toBeCloseTo(-Math.pow(value, 1 / DEFAULT_DISPLAY_GAMMA), 12);
    expect(linearToDisplayGamma(value, 1)).toBeCloseTo(value, 12);
    expect(linearToDisplayGamma(-value, 2)).toBeCloseTo(-Math.sqrt(value), 12);
  });

  it('sanitizes non-finite inputs to zero', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(linearToDisplayGamma(value)).toBe(0);
      expect(linearToDisplayGammaByte(value)).toBe(0);
    }
  });

  it('rounds and clamps display gamma bytes', () => {
    expect(linearToDisplayGammaByte(0.25)).toBe(Math.round(Math.pow(0.25, 1 / DEFAULT_DISPLAY_GAMMA) * 255));
    expect(linearToDisplayGammaByte(0.5)).toBe(Math.round(Math.pow(0.5, 1 / DEFAULT_DISPLAY_GAMMA) * 255));
    expect(linearToDisplayGammaByte(-0.25)).toBe(0);
    expect(linearToDisplayGammaByte(10)).toBe(255);
  });
});

describe('shader color constants', () => {
  it('mirror the CPU constants exactly', () => {
    expect(readShaderFloatConstant('REC709_LUMINANCE_WEIGHT_R')).toBe(REC709_LUMINANCE_WEIGHTS.r);
    expect(readShaderFloatConstant('REC709_LUMINANCE_WEIGHT_G')).toBe(REC709_LUMINANCE_WEIGHTS.g);
    expect(readShaderFloatConstant('REC709_LUMINANCE_WEIGHT_B')).toBe(REC709_LUMINANCE_WEIGHTS.b);
    expect(readShaderFloatConstant('DISPLAY_GAMMA_MIN')).toBe(DISPLAY_GAMMA_MIN);
  });

  it('produces the same representative luminance and display gamma values as the CPU helpers', () => {
    const shaderWeights = {
      r: readShaderFloatConstant('REC709_LUMINANCE_WEIGHT_R'),
      g: readShaderFloatConstant('REC709_LUMINANCE_WEIGHT_G'),
      b: readShaderFloatConstant('REC709_LUMINANCE_WEIGHT_B')
    };

    for (const [r, g, b] of [
      [1, 0.5, 0.25],
      [0, 1, 0],
      [0.125, 0.25, 0.5]
    ]) {
      expect(computeShaderLuminance(shaderWeights, r, g, b)).toBeCloseTo(
        computeRec709Luminance(r, g, b),
        12
      );
    }

    for (const value of [-1, -0.25, 0, 0.25, 1, 10]) {
      expect(computeShaderLinearToDisplayGamma(value, DEFAULT_DISPLAY_GAMMA))
        .toBeCloseTo(linearToDisplayGamma(value), 12);
    }
  });
});

function readShaderFloatConstant(name: string): number {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = fragmentSource.match(new RegExp(`const float ${escapedName} = ([\\d.eE+-]+);`));
  if (!match) {
    throw new Error(`Missing shader constant: ${name}`);
  }

  return Number(match[1]);
}

function computeShaderLuminance(
  weights: { r: number; g: number; b: number },
  r: number,
  g: number,
  b: number
): number {
  return weights.r * r + weights.g * g + weights.b * b;
}

function computeShaderLinearToDisplayGamma(value: number, gamma: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.sign(value) * Math.pow(Math.abs(value), 1 / Math.max(gamma, DISPLAY_GAMMA_MIN));
}
