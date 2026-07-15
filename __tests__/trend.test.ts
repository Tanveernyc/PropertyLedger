// Phase 9 tests — calcCategoryTrend (spec §5 Phase 9): year grouping; period uses
// period_start when present else paid_on; first period null change (not zero);
// % change math; division-by-zero guard; gap years handled.
import { calcCategoryTrend } from '../src/lib/aggregate';
import type { Expense } from '../src/types';

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'e',
  user_id: 'u1',
  property_id: 'p1',
  category_id: 'c-ins',
  amount: 100,
  paid_on: '2026-06-15',
  period_start: null,
  period_end: null,
  vendor: null,
  notes: null,
  created_at: '2026-06-15T00:00:00Z',
  ...overrides,
});

describe('calcCategoryTrend', () => {
  it('groups year-over-year and sums within each year', () => {
    const trend = calcCategoryTrend(
      [
        expense({ id: 'a', amount: 1000, paid_on: '2024-03-01' }),
        expense({ id: 'b', amount: 200, paid_on: '2024-09-01' }),
        expense({ id: 'c', amount: 1400, paid_on: '2025-03-01' }),
      ],
      'c-ins',
      'year'
    );
    expect(trend.map((t) => [t.period, t.total])).toEqual([
      ['2024', 1200],
      ['2025', 1400],
    ]);
  });

  it('only includes the requested category', () => {
    const trend = calcCategoryTrend(
      [
        expense({ id: 'a', category_id: 'c-ins', amount: 100, paid_on: '2024-01-01' }),
        expense({ id: 'b', category_id: 'c-other', amount: 999, paid_on: '2024-01-01' }),
      ],
      'c-ins',
      'year'
    );
    expect(trend).toHaveLength(1);
    expect(trend[0].total).toBe(100);
  });

  it('uses period_start when present, else paid_on', () => {
    // 2026 school tax paid September 2025 must count as 2026 (spec §3 design note).
    const trend = calcCategoryTrend(
      [
        expense({ id: 'a', amount: 3000, paid_on: '2025-09-15', period_start: '2026-01-01', period_end: '2026-12-31' }),
        expense({ id: 'b', amount: 2800, paid_on: '2025-02-01' }), // no period → paid_on
      ],
      'c-ins',
      'year'
    );
    expect(trend.map((t) => [t.period, t.total])).toEqual([
      ['2025', 2800],
      ['2026', 3000],
    ]);
  });

  it('first period has null change — absence of data is not "no change"', () => {
    const trend = calcCategoryTrend([expense({ amount: 500, paid_on: '2024-01-01' })], 'c-ins', 'year');
    expect(trend[0].changeFromPrev).toBeNull();
    expect(trend[0].pctChangeFromPrev).toBeNull();
    expect(trend[0].changeFromPrev).not.toBe(0);
  });

  it('computes change and % change against the previous period', () => {
    const trend = calcCategoryTrend(
      [
        expense({ id: 'a', amount: 1000, paid_on: '2024-06-01' }),
        expense({ id: 'b', amount: 1100, paid_on: '2025-06-01' }),
        expense({ id: 'c', amount: 990, paid_on: '2026-06-01' }),
      ],
      'c-ins',
      'year'
    );
    expect(trend[1].changeFromPrev).toBe(100);
    expect(trend[1].pctChangeFromPrev).toBeCloseTo(10, 10);
    expect(trend[2].changeFromPrev).toBe(-110);
    expect(trend[2].pctChangeFromPrev).toBeCloseTo(-10, 10);
  });

  it('guards division by zero when the previous period total is 0', () => {
    const trend = calcCategoryTrend(
      [
        // A refunded year: two entries netting… wait, amounts are always > 0; a
        // zero period can only appear via a 0-sum group — construct with 0 amount
        // bypassing the check constraint (defensive: math layer must not trust it).
        expense({ id: 'a', amount: 0, paid_on: '2024-06-01' }),
        expense({ id: 'b', amount: 500, paid_on: '2025-06-01' }),
      ],
      'c-ins',
      'year'
    );
    expect(trend[1].changeFromPrev).toBe(500);
    expect(trend[1].pctChangeFromPrev).toBeNull(); // not Infinity, not NaN
  });

  it('handles gap years: 2024 present, 2025 missing, 2026 present', () => {
    const trend = calcCategoryTrend(
      [
        expense({ id: 'a', amount: 1000, paid_on: '2024-06-01' }),
        expense({ id: 'b', amount: 1500, paid_on: '2026-06-01' }),
      ],
      'c-ins',
      'year'
    );
    // No fabricated 2025 row; 2026 compares against the last period with data.
    expect(trend.map((t) => t.period)).toEqual(['2024', '2026']);
    expect(trend[1].changeFromPrev).toBe(500);
    expect(trend[1].pctChangeFromPrev).toBeCloseTo(50, 10);
  });

  it('supports month grouping', () => {
    const trend = calcCategoryTrend(
      [
        expense({ id: 'a', amount: 80, paid_on: '2026-01-15' }),
        expense({ id: 'b', amount: 90, paid_on: '2026-02-15' }),
        expense({ id: 'c', amount: 30, paid_on: '2026-02-20' }),
      ],
      'c-ins',
      'month'
    );
    expect(trend.map((t) => [t.period, t.total])).toEqual([
      ['2026-01', 80],
      ['2026-02', 120],
    ]);
  });

  it('returns empty for no matching expenses', () => {
    expect(calcCategoryTrend([], 'c-ins', 'year')).toEqual([]);
  });
});
