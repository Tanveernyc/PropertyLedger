// Add-screen state transitions — pure functions (spec §4 rule).
// Phase 5 test: post-save state retains property/category so entering ten bills
// is ten taps of "amount → save", not ten round trips.
import type { Category, CategoryKind } from '@/types';
import { todayISO } from './dates';

export interface AddTransactionState {
  propertyId: string | null;
  categoryId: string | null;
  amountText: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  vendor: string; // "source" for income
  notes: string;
}

/** Fresh form: today's date, nothing else filled in. */
export function initialAddState(): AddTransactionState {
  return {
    propertyId: null,
    categoryId: null,
    amountText: '',
    date: todayISO(),
    periodStart: '',
    periodEnd: '',
    vendor: '',
    notes: '',
  };
}

/**
 * State after a successful save: amount and per-bill fields clear, but property,
 * category, and date stay — the next bill is usually same property, same day.
 */
export function resetAfterSave(state: AddTransactionState): AddTransactionState {
  return {
    ...state,
    amountText: '',
    periodStart: '',
    periodEnd: '',
    vendor: '',
    notes: '',
  };
}

/**
 * Orders a category list recent-first: categories in recentIds (most recent
 * first) lead, everything else follows in its existing (alphabetical) order.
 */
export function orderCategoriesByRecent(
  categories: Category[],
  recentIds: string[],
  kind: CategoryKind
): Category[] {
  const ofKind = categories.filter((c) => c.kind === kind);
  const byId = new Map(ofKind.map((c) => [c.id, c]));
  const recent = recentIds.map((id) => byId.get(id)).filter((c): c is Category => !!c);
  const recentSet = new Set(recent.map((c) => c.id));
  return [...recent, ...ofKind.filter((c) => !recentSet.has(c.id))];
}

/** Adds a category to the front of the recent list (deduped, capped). */
export function pushRecentCategory(recentIds: string[], categoryId: string, cap = 5): string[] {
  return [categoryId, ...recentIds.filter((id) => id !== categoryId)].slice(0, cap);
}
