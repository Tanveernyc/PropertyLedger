// Money helpers — pure functions, no React, no network (spec §4 rule).
// Amounts are dollars backed by numeric(12,2) in Postgres; never floats in sums
// without rounding at the cent boundary.

/**
 * Parses an amount text field. Valid: positive number with at most 2 decimal
 * places (cents). Returns undefined for anything else — including 0, negatives,
 * non-numeric text, and 3+ decimal places (spec §5 Phase 5).
 */
export function parseAmountInput(text: string): number | undefined {
  const trimmed = text.trim();
  // Digits with an optional 1–2 digit decimal tail; rejects '1.234', '12x', '-5', ''.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  if (!(value > 0)) return undefined;
  return value;
}

/** Formats dollars for display: 1234.5 → "$1,234.50". */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
