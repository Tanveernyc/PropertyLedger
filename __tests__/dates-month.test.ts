// Phase 15 tests — month arithmetic used by the recurring engine (README §4.2).
import { addCalendarMonths, firstOfMonth, monthKey } from '../src/lib/dates';

describe('firstOfMonth', () => {
  it('snaps any date to the first of its month', () => {
    expect(firstOfMonth('2026-09-18')).toBe('2026-09-01');
    expect(firstOfMonth('2026-09-01')).toBe('2026-09-01');
    expect(firstOfMonth('2024-02-29')).toBe('2024-02-01');
  });
});

describe('addCalendarMonths', () => {
  it('adds whole months to a first-of-month date', () => {
    expect(addCalendarMonths('2026-01-01', 0)).toBe('2026-01-01');
    expect(addCalendarMonths('2026-01-01', 1)).toBe('2026-02-01');
    expect(addCalendarMonths('2026-01-01', 11)).toBe('2026-12-01');
  });
  it('rolls over the year boundary', () => {
    expect(addCalendarMonths('2026-11-01', 2)).toBe('2027-01-01');
    expect(addCalendarMonths('2026-12-01', 13)).toBe('2028-01-01');
  });
});

describe('monthKey', () => {
  it('returns YYYY-MM for any date in the month', () => {
    expect(monthKey('2026-09-18')).toBe('2026-09');
    expect(monthKey('2026-09-01')).toBe('2026-09');
  });
});
