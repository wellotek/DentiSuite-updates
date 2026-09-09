export type MoneyDecision =
  | { ok: true; value: number; lossy: false }
  | { ok: true; value: number; lossy: true; original: number }
  | { ok: false; original: unknown; reason: string };

/** Whole DA. Reports lossy float rounding; never silent. */
export function toWholeDa(raw: unknown): MoneyDecision {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { ok: false, original: raw, reason: 'amount is not a finite number' };
  }
  if (Number.isInteger(raw)) {
    return { ok: true, value: raw, lossy: false };
  }
  return {
    ok: true,
    value: Math.round(raw),
    lossy: true,
    original: raw,
  };
}
