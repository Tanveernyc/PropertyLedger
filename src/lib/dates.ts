// Date helpers — pure functions, no React, no network (spec §4 rule).
// All dates are ISO YYYY-MM-DD strings, matching the Postgres date columns.
import { format, isValid, parseISO } from 'date-fns';

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
