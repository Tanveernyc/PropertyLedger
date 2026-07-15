// Phase 5 tests — add-expense form validation (spec §5 Phase 5):
// paid_on required; period_end >= period_start when both present;
// property and category must be picked.
import { validateTransactionForm } from '../src/lib/expense-validation';

const validInput = {
  amountText: '125.50',
  date: '2026-07-15',
  propertyId: 'p1',
  categoryId: 'c1',
};

describe('validateTransactionForm', () => {
  it('accepts a complete valid form and returns the parsed amount', () => {
    const result = validateTransactionForm(validInput);
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(125.5);
    expect(result.errors).toEqual({});
  });

  it('requires the date (paid_on)', () => {
    const result = validateTransactionForm({ ...validInput, date: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.date).toBeDefined();
  });

  it('rejects a malformed date', () => {
    for (const bad of ['07/15/2026', '2026-13-01', '2026-02-30', 'tomorrow']) {
      expect(validateTransactionForm({ ...validInput, date: bad }).valid).toBe(false);
    }
  });

  it('requires property and category', () => {
    const noProperty = validateTransactionForm({ ...validInput, propertyId: null });
    expect(noProperty.valid).toBe(false);
    expect(noProperty.errors.property).toBeDefined();

    const noCategory = validateTransactionForm({ ...validInput, categoryId: null });
    expect(noCategory.valid).toBe(false);
    expect(noCategory.errors.category).toBeDefined();
  });

  it('accepts period_end equal to period_start', () => {
    const result = validateTransactionForm({
      ...validInput,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-01',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects period_end before period_start when both present', () => {
    const result = validateTransactionForm({
      ...validInput,
      periodStart: '2026-06-01',
      periodEnd: '2026-05-31',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.period).toBeDefined();
  });

  it('allows a single period bound', () => {
    expect(validateTransactionForm({ ...validInput, periodStart: '2026-01-01' }).valid).toBe(true);
    expect(validateTransactionForm({ ...validInput, periodEnd: '2026-12-31' }).valid).toBe(true);
  });

  it('propagates amount rules (non-numeric, >2 decimals, zero)', () => {
    for (const bad of ['abc', '12.345', '0']) {
      const result = validateTransactionForm({ ...validInput, amountText: bad });
      expect(result.valid).toBe(false);
      expect(result.errors.amount).toBeDefined();
    }
  });
});
