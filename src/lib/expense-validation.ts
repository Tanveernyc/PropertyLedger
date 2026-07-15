// Add Expense / Add Income form validation — pure functions (spec §4 rule).
// Phase 5 tests: amount > 0, numeric, ≤2 decimals; paid_on required;
// period_end >= period_start when both present.
import { isPeriodOrdered, isValidISODate } from './dates';
import { parseAmountInput } from './money';

export interface TransactionFormInput {
  amountText: string;
  /** paid_on for expenses, received_on for income — same rules. */
  date: string;
  propertyId: string | null;
  categoryId: string | null;
  periodStart?: string;
  periodEnd?: string;
}

export interface TransactionValidation {
  valid: boolean;
  /** Parsed amount in dollars; only set when the amount field is valid. */
  amount?: number;
  errors: {
    amount?: string;
    date?: string;
    property?: string;
    category?: string;
    period?: string;
  };
}

/** Validates the shared add-transaction form; income (Phase 6) reuses this. */
export function validateTransactionForm(input: TransactionFormInput): TransactionValidation {
  const errors: TransactionValidation['errors'] = {};

  const amount = parseAmountInput(input.amountText);
  if (amount === undefined) {
    errors.amount = 'Amount must be a positive number with at most 2 decimal places.';
  }

  if (input.date.trim() === '') {
    errors.date = 'Date is required.';
  } else if (!isValidISODate(input.date.trim())) {
    errors.date = 'Date must be a valid YYYY-MM-DD date.';
  }

  if (!input.propertyId) errors.property = 'Pick a property.';
  if (!input.categoryId) errors.category = 'Pick a category.';

  const start = input.periodStart?.trim() ?? '';
  const end = input.periodEnd?.trim() ?? '';
  if (start && !isValidISODate(start)) errors.period = 'Period start must be YYYY-MM-DD.';
  else if (end && !isValidISODate(end)) errors.period = 'Period end must be YYYY-MM-DD.';
  else if (start && end && !isPeriodOrdered(start, end)) {
    errors.period = 'Period end must be on or after period start.';
  }

  const valid = Object.keys(errors).length === 0;
  return valid ? { valid, amount, errors } : { valid, errors };
}
