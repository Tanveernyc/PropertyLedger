// Phase 5 tests — amount parsing (spec §5 Phase 5):
// amount must be > 0; rejects non-numeric and >2 decimal places.
import { formatMoney, parseAmountInput } from '../src/lib/money';

describe('parseAmountInput', () => {
  it('rejects zero and negative amounts', () => {
    expect(parseAmountInput('0')).toBeUndefined();
    expect(parseAmountInput('0.00')).toBeUndefined();
    expect(parseAmountInput('-5')).toBeUndefined();
  });

  it('rejects non-numeric input', () => {
    for (const bad of ['', '  ', 'abc', '12x', '1,200', '$50', '1.2.3']) {
      expect(parseAmountInput(bad)).toBeUndefined();
    }
  });

  it('rejects more than 2 decimal places', () => {
    expect(parseAmountInput('12.345')).toBeUndefined();
    expect(parseAmountInput('0.001')).toBeUndefined();
  });

  it('accepts valid amounts', () => {
    expect(parseAmountInput('10')).toBe(10);
    expect(parseAmountInput('12.34')).toBe(12.34);
    expect(parseAmountInput('0.01')).toBe(0.01);
    expect(parseAmountInput(' 1500.5 ')).toBe(1500.5); // trims padding, 1 decimal ok
  });
});

describe('formatMoney', () => {
  it('formats dollars with cents and separators', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(0.01)).toBe('$0.01');
  });
});
