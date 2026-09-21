// New-recurring-rule form validation — pure functions (README §4.1 fields).
import type { EndMode } from '@/types';
import { firstOfMonth, isValidISODate, monthKey } from './dates';
import { parseAmountInput } from './money';

export interface RecurringRuleFormInput {
  propertyId: string | null;
  categoryId: string | null;
  amountText: string;
  /** 'YYYY-MM' as typed by the user. */
  startMonthText: string;
  endMode: EndMode;
  occurrencesText: string;
}

export interface RecurringRuleValidation {
  valid: boolean;
  amount?: number;
  /** 'YYYY-MM-01' — only when startMonthText is valid. */
  startMonth?: string;
  /** Parsed count — only when endMode === 'count' and valid. */
  occurrences?: number;
  errors: {
    property?: string;
    category?: string;
    amount?: string;
    startMonth?: string;
    occurrences?: string;
  };
}

export function validateRecurringRuleForm(input: RecurringRuleFormInput): RecurringRuleValidation {
  const errors: RecurringRuleValidation['errors'] = {};

  if (!input.propertyId) errors.property = 'Pick a property.';
  if (!input.categoryId) errors.category = 'Pick a category.';

  const amount = parseAmountInput(input.amountText);
  if (amount === undefined) {
    errors.amount = 'Amount must be a positive number with at most 2 decimal places.';
  }

  const monthText = input.startMonthText.trim();
  let startMonth: string | undefined;
  if (!/^\d{4}-\d{2}$/.test(monthText) || !isValidISODate(`${monthText}-01`)) {
    errors.startMonth = 'Start month must be YYYY-MM.';
  } else {
    startMonth = `${monthText}-01`;
  }

  let occurrences: number | undefined;
  if (input.endMode === 'count') {
    const text = input.occurrencesText.trim();
    if (!/^\d+$/.test(text) || Number(text) < 1) {
      errors.occurrences = 'Number of months must be a whole number of 1 or more.';
    } else {
      occurrences = Number(text);
    }
  }

  const valid = Object.keys(errors).length === 0;
  return valid ? { valid, amount, startMonth, occurrences, errors } : { valid, errors };
}

/**
 * Count of months from `startMonth` (YYYY-MM-01) through the month containing
 * `today`, inclusive; 0 when the start month is in the future.
 */
export function monthsToBackfill(startMonth: string, today: string): number {
  const start = monthKey(firstOfMonth(startMonth));
  const current = monthKey(firstOfMonth(today));
  const [startYear, startMonthNum] = start.split('-').map(Number);
  const [curYear, curMonthNum] = current.split('-').map(Number);
  const diff = (curYear * 12 + curMonthNum) - (startYear * 12 + startMonthNum) + 1;
  return diff > 0 ? diff : 0;
}
