// Recurring generation engine — pure, no React, no network (README §4.2–§4.4).
// Walks calendar months from the rule's start_month up to the month containing
// `today`, and returns one GeneratedEntry per month that has no entry yet.
// The caller (src/db/recurring.ts) inserts them; this function never touches
// existing rows, which is what protects is_edited entries (README §4.3).
import type { CategoryKind, RecurringRule } from '@/types';
import { addCalendarMonths, firstOfMonth, monthKey } from './dates';

export interface GeneratedEntry {
  recurring_id: string;
  property_id: string;
  category_id: string;
  kind: CategoryKind;
  amount: number;
  notes: string | null;
  /** First day of the month this entry represents (paid_on / received_on). */
  date: string;
}

/**
 * Entries that should exist for `rule` as of `today` but don't yet.
 * `existingDates` are the dates of rows already linked to this rule (any day in
 * the month counts — the month is the idempotency unit, README §4.2).
 */
export function generateDueEntries(
  rule: RecurringRule,
  existingDates: string[],
  today: string
): GeneratedEntry[] {
  const currentMonth = firstOfMonth(today);
  const start = firstOfMonth(rule.start_month);
  // Last month that may ever be generated: the current month, capped by stopped_on.
  // stopped_on is the engine's source of truth; is_active is UI state (README §4.4 sets both together).
  const lastAllowed = rule.stopped_on
    ? minIso(currentMonth, firstOfMonth(rule.stopped_on))
    : currentMonth;

  const existingMonths = new Set(existingDates.map(monthKey));
  const out: GeneratedEntry[] = [];

  // Count rules: exactly `occurrences` months from start_month. Until-stopped: unbounded.
  const maxMonths = rule.end_mode === 'count' ? (rule.occurrences ?? 0) : Number.POSITIVE_INFINITY;

  for (let i = 0; i < maxMonths; i++) {
    const month = addCalendarMonths(start, i);
    if (month > lastAllowed) break; // never into the future or past stopped_on
    if (existingMonths.has(monthKey(month))) continue; // idempotent
    out.push({
      recurring_id: rule.id,
      property_id: rule.property_id,
      category_id: rule.category_id,
      kind: rule.kind,
      amount: rule.amount,
      notes: rule.notes,
      date: month,
    });
  }
  return out;
}

/** ISO date strings compare correctly as plain strings. */
function minIso(a: string, b: string): string {
  return a < b ? a : b;
}
