export function formatOverlayValue(value: number): string {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) {
      return 'nan';
    }

    return value < 0 ? '-inf' : '+inf';
  }

  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.001 || abs >= 1000)) {
    return value.toExponential(1);
  }

  return value.toPrecision(3);
}
