// Phase 15 tests — new recurring rule form validation.
import { monthsToBackfill, validateRecurringRuleForm } from '../src/lib/recurring-rule-validation';

const valid = {
  propertyId: 'p1',
  categoryId: 'c1',
  amountText: '1500',
  startMonthText: '2026-01',
  endMode: 'until_stopped' as const,
  occurrencesText: '',
};

describe('validateRecurringRuleForm', () => {
  it('accepts an until_stopped rule and normalizes the start month to the 1st', () => {
    const r = validateRecurringRuleForm(valid);
    expect(r.valid).toBe(true);
    expect(r.amount).toBe(1500);
    expect(r.startMonth).toBe('2026-01-01');
    expect(r.occurrences).toBeUndefined();
  });

  it('accepts a count rule with a positive integer count', () => {
    const r = validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '12' });
    expect(r.valid).toBe(true);
    expect(r.occurrences).toBe(12);
  });

  it('requires property and category', () => {
    const r = validateRecurringRuleForm({ ...valid, propertyId: null, categoryId: null });
    expect(r.valid).toBe(false);
    expect(r.errors.property).toBeDefined();
    expect(r.errors.category).toBeDefined();
  });

  it('rejects a non-positive or 3-decimal amount', () => {
    expect(validateRecurringRuleForm({ ...valid, amountText: '0' }).errors.amount).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, amountText: '1.234' }).errors.amount).toBeDefined();
  });

  it('rejects a malformed or impossible start month', () => {
    expect(validateRecurringRuleForm({ ...valid, startMonthText: '2026-1' }).errors.startMonth).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, startMonthText: '2026-13' }).errors.startMonth).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, startMonthText: '' }).errors.startMonth).toBeDefined();
  });

  it('count mode requires a positive integer count', () => {
    expect(validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '' }).errors.occurrences).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '0' }).errors.occurrences).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '2.5' }).errors.occurrences).toBeDefined();
  });

  it('ignores occurrencesText when endMode is until_stopped', () => {
    const r = validateRecurringRuleForm({ ...valid, occurrencesText: 'garbage' });
    expect(r.valid).toBe(true);
    expect(r.errors.occurrences).toBeUndefined();
  });
});

describe('monthsToBackfill', () => {
  it('counts inclusive months from start through today', () => {
    expect(monthsToBackfill('2026-01-01', '2026-09-18')).toBe(9);
  });

  it('counts 1 when start is the current month', () => {
    expect(monthsToBackfill('2026-09-01', '2026-09-18')).toBe(1);
  });

  it('returns 0 when start is in the future', () => {
    expect(monthsToBackfill('2026-11-01', '2026-09-18')).toBe(0);
  });

  it('handles a far-past start across years', () => {
    expect(monthsToBackfill('2016-01-01', '2026-09-18')).toBe(129);
  });
});
