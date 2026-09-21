// Date helpers — pure functions, no React, no network (spec §4 rule).
// All dates are ISO YYYY-MM-DD strings, matching the Postgres date columns.
import { addMonths, format, isValid, parseISO, startOfMonth } from 'date-fns';

/** Today's date in the device's timezone as YYYY-MM-DD (paid_on default). */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** True when the string is a real calendar date in YYYY-MM-DD form. */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isValid(parseISO(value));
}

/**
 * True when a period range is ordered: end >= start. ISO date strings compare
 * correctly as plain strings, no Date parsing needed.
 */
export function isPeriodOrdered(periodStart: string, periodEnd: string): boolean {
  return periodEnd >= periodStart;
}

/** Snaps a date to the first of its month: '2026-09-18' → '2026-09-01'. */
export function firstOfMonth(iso: string): string {
  return format(startOfMonth(parseISO(iso)), 'yyyy-MM-dd');
}

/** Adds n calendar months to a first-of-month date; n may be 0. Year rollover handled by date-fns. */
export function addCalendarMonths(firstOfMonthIso: string, n: number): string {
  return format(addMonths(parseISO(firstOfMonthIso), n), 'yyyy-MM-dd');
}

/** 'YYYY-MM' bucket key — the recurring engine's idempotency unit (README §4.2). */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
