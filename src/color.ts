export const REC709_LUMINANCE_WEIGHTS = {
  r: 0.2126,
  g: 0.7152,
  b: 0.0722
} as const;

export const DEFAULT_DISPLAY_GAMMA = 2.2;
export const DISPLAY_GAMMA_MIN = 0.01;
export const DISPLAY_GAMMA_MAX = 5.0;

export function computeRec709Luminance(r: number, g: number, b: number): number {
  return REC709_LUMINANCE_WEIGHTS.r * r +
    REC709_LUMINANCE_WEIGHTS.g * g +
    REC709_LUMINANCE_WEIGHTS.b * b;
}

export function normalizeDisplayGamma(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_DISPLAY_GAMMA;
  }

  return Math.min(DISPLAY_GAMMA_MAX, Math.max(DISPLAY_GAMMA_MIN, value));
}

export function linearToDisplayGamma(value: number, gamma = DEFAULT_DISPLAY_GAMMA): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value === 0) {
    return 0;
  }

  const displayGamma = normalizeDisplayGamma(gamma);
  return Math.sign(value) * Math.pow(Math.abs(value), 1 / displayGamma);
}

export function linearToDisplayGammaByte(value: number, gamma = DEFAULT_DISPLAY_GAMMA): number {
  const encoded = linearToDisplayGamma(value, gamma);
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}
