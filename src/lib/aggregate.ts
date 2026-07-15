// P&L + aggregation math — the heart of the app (spec §5 Phase 8).
// PURE FUNCTIONS: no React, no network. Screens call these; they never do
// arithmetic inline (spec §4 rule). All sums run in integer cents to avoid
// floating-point drift, then convert back to dollars at the end.
import type { Category, Expense, Income, Property } from '@/types';

/** Inclusive date range; open bounds mean "no limit" (All Time = {}). */
export interface DateRange {
  from?: string;
  to?: string;
}

export interface PL {
  totalIncome: number;
  totalExpense: number;
  /** income − expenses; negative when expenses exceed income. */
  net: number;
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  total: number;
}

export interface PropertyPL extends PL {
  propertyId: string;
  name: string;
}

/** Dollars → integer cents (numeric(12,2) guarantees ≤2 decimals). */
const toCents = (amount: number): number => Math.round(amount * 100);
const toDollars = (cents: number): number => cents / 100;

/** Inclusive range check on ISO YYYY-MM-DD strings (string compare is correct). */
export function isInRange(date: string, range: DateRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

/** P&L over a range: cash basis — expenses count by paid_on, income by received_on. */
export function calcPL(expenses: Expense[], income: Income[], range: DateRange): PL {
  let expenseCents = 0;
  for (const e of expenses) {
    if (isInRange(e.paid_on, range)) expenseCents += toCents(e.amount);
  }
  let incomeCents = 0;
  for (const i of income) {
    if (isInRange(i.received_on, range)) incomeCents += toCents(i.amount);
  }
  return {
    totalIncome: toDollars(incomeCents),
    totalExpense: toDollars(expenseCents),
    net: toDollars(incomeCents - expenseCents),
  };
}

/**
 * Expense totals per category over a range, largest first. Category names come
 * from the optional categories list (falls back to the raw id when unknown).
 * The per-category totals always sum exactly to calcPL's totalExpense.
 */
export function calcByCategory(
  expenses: Expense[],
  range: DateRange,
  categories: Category[] = []
): CategoryTotal[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const centsByCategory = new Map<string, number>();
  for (const e of expenses) {
    if (!isInRange(e.paid_on, range)) continue;
    centsByCategory.set(e.category_id, (centsByCategory.get(e.category_id) ?? 0) + toCents(e.amount));
  }
  return [...centsByCategory.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      name: nameById.get(categoryId) ?? categoryId,
      total: toDollars(cents),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Per-property P&L over a range, in the given property order. */
export function calcPLByProperty(
  properties: Property[],
  expenses: Expense[],
  income: Income[],
  range: DateRange
): PropertyPL[] {
  return properties.map((property) => {
    const pl = calcPL(
      expenses.filter((e) => e.property_id === property.id),
      income.filter((i) => i.property_id === property.id),
      range
    );
    return { propertyId: property.id, name: property.name, ...pl };
  });
}

export interface TrendPoint {
  /** '2026' (year grouping) or '2026-03' (month grouping). */
  period: string;
  total: number;
  /** Dollars vs the previous period with data; null for the first period —
   * absence of data is not "no change" (spec §5 Phase 9). */
  changeFromPrev: number | null;
  /** Percent vs previous period; null for the first period AND when the
   * previous total is 0 (division-by-zero guard). */
  pctChangeFromPrev: number | null;
}

/**
 * Multi-period trend for one expense category — the "did my insurance go up?"
 * math (spec §5 Phase 9). Grouping date is period_start when present, else
 * paid_on: a 2026 school-tax bill paid in Sep 2025 belongs to 2026 (spec §3).
 * Gap periods (a year with no bills) are skipped; each point compares to the
 * previous period that actually has data.
 */
export function calcCategoryTrend(
  expenses: Expense[],
  categoryId: string,
  groupBy: 'year' | 'month'
): TrendPoint[] {
  const periodLength = groupBy === 'year' ? 4 : 7; // YYYY vs YYYY-MM
  const centsByPeriod = new Map<string, number>();
  for (const e of expenses) {
    if (e.category_id !== categoryId) continue;
    const groupDate = e.period_start ?? e.paid_on;
    const period = groupDate.slice(0, periodLength);
    centsByPeriod.set(period, (centsByPeriod.get(period) ?? 0) + toCents(e.amount));
  }

  const periods = [...centsByPeriod.keys()].sort(); // ISO prefixes sort chronologically
  return periods.map((period, index) => {
    const cents = centsByPeriod.get(period)!;
    if (index === 0) {
      return { period, total: toDollars(cents), changeFromPrev: null, pctChangeFromPrev: null };
    }
    const prevCents = centsByPeriod.get(periods[index - 1])!;
    const changeCents = cents - prevCents;
    return {
      period,
      total: toDollars(cents),
      changeFromPrev: toDollars(changeCents),
      // Guard: a 0 previous period makes % change undefined, not Infinity.
      pctChangeFromPrev: prevCents === 0 ? null : (changeCents / prevCents) * 100,
    };
  });
}

/** Preset: This Year — Jan 1 through Dec 31 of today's year. */
export function thisYearRange(todayIso: string): DateRange {
  const year = todayIso.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Preset: Last Year. */
export function lastYearRange(todayIso: string): DateRange {
  const year = Number(todayIso.slice(0, 4)) - 1;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}
