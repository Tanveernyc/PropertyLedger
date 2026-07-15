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
