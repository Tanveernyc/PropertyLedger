// Transaction timeline — pure functions, no React, no network (spec §4 rule).
// Phase 7 tests: merge/sort of expenses+income into one newest-first timeline;
// date-range filter inclusive on both ends; category filter.
import type { Expense, Income } from '@/types';

/** One row in the per-property transaction list, expense or income. */
export interface TimelineEntry {
  kind: 'expense' | 'income';
  id: string;
  /** paid_on for expenses, received_on for income. */
  date: string;
  amount: number;
  category_id: string;
  /** vendor for expenses, source for income. */
  party: string | null;
  notes: string | null;
  created_at: string;
}

/** Maps an expense row into a timeline entry. */
export function expenseToEntry(expense: Expense): TimelineEntry {
  return {
    kind: 'expense',
    id: expense.id,
    date: expense.paid_on,
    amount: expense.amount,
    category_id: expense.category_id,
    party: expense.vendor,
    notes: expense.notes,
    created_at: expense.created_at,
  };
}

/** Maps an income row into a timeline entry. */
export function incomeToEntry(income: Income): TimelineEntry {
  return {
    kind: 'income',
    id: income.id,
    date: income.received_on,
    amount: income.amount,
    category_id: income.category_id,
    party: income.source,
    notes: income.notes,
    created_at: income.created_at,
  };
}

/**
 * Interleaves expenses and income into one chronological list, newest first.
 * Same-date entries tiebreak on created_at (newest first) for a stable order.
 */
export function buildTimeline(expenses: Expense[], income: Income[]): TimelineEntry[] {
  const entries = [...expenses.map(expenseToEntry), ...income.map(incomeToEntry)];
  // ISO strings (YYYY-MM-DD and timestamptz) sort correctly as plain strings.
  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return 0;
  });
}

export interface TimelineFilter {
  /** Inclusive lower bound (YYYY-MM-DD). */
  from?: string;
  /** Inclusive upper bound (YYYY-MM-DD). */
  to?: string;
  categoryId?: string;
}

/** Applies date-range (inclusive on both ends) and category filters. */
export function filterTimeline(entries: TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  return entries.filter((entry) => {
    if (filter.from && entry.date < filter.from) return false;
    if (filter.to && entry.date > filter.to) return false;
    if (filter.categoryId && entry.category_id !== filter.categoryId) return false;
    return true;
  });
}
