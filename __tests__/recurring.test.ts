// Phase 15 tests — README §4.5 "Tests for recurring (test this hardest)".
import { generateDueEntries } from '../src/lib/recurring';
import type { RecurringRule } from '../src/types';

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r1',
    user_id: 'u1',
    property_id: 'p1',
    category_id: 'c1',
    kind: 'expense',
    amount: 1500,
    notes: 'mortgage',
    party: null,
    start_month: '2026-01-01',
    end_mode: 'until_stopped',
    occurrences: null,
    stopped_on: null,
    skipped_months: [],
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
const dates = (entries: { date: string }[]) => entries.map((e) => e.date);

describe('generateDueEntries', () => {
  it('count rule for 3 months starting Jan generates exactly Jan, Feb, Mar — no more', () => {
    const r = rule({ end_mode: 'count', occurrences: 3 });
    expect(dates(generateDueEntries(r, [], '2026-09-18'))).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('until_stopped rule generates one entry per month up to the current month, none in the future', () => {
    expect(dates(generateDueEntries(rule(), [], '2026-04-15'))).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
    ]);
  });

  it('running generation twice produces no duplicates (idempotent)', () => {
    const first = generateDueEntries(rule(), [], '2026-03-10');
    const second = generateDueEntries(rule(), dates(first), '2026-03-10');
    expect(second).toEqual([]);
  });

  it('an existing (possibly edited) month is skipped regardless of its exact day', () => {
    // A day-shifted entry still claims its month. (Moving an entry to a different month
    // vacates the original month, which will regenerate — month is the idempotency unit.)
    const out = generateDueEntries(rule(), ['2026-01-01', '2026-02-05'], '2026-03-10');
    expect(dates(out)).toEqual(['2026-03-01']);
  });

  it('changing the rule amount only affects months not yet generated', () => {
    const jan = generateDueEntries(rule({ amount: 1500 }), [], '2026-01-31');
    expect(jan[0].amount).toBe(1500);
    const feb = generateDueEntries(rule({ amount: 1600 }), dates(jan), '2026-02-28');
    expect(feb).toHaveLength(1);
    expect(feb[0]).toMatchObject({ date: '2026-02-01', amount: 1600 });
  });

  it('stopping mid-year: months before stopped_on remain, none after', () => {
    const r = rule({ stopped_on: '2026-05-20', is_active: false });
    // The stopped month itself (May) is still generated if it was due; June+ never.
    expect(dates(generateDueEntries(r, [], '2026-09-18'))).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01',
    ]);
  });

  it('start month in the future generates nothing yet', () => {
    expect(generateDueEntries(rule({ start_month: '2026-11-01' }), [], '2026-09-18')).toEqual([]);
  });

  it('start month equal to the current month generates exactly that month', () => {
    expect(dates(generateDueEntries(rule({ start_month: '2026-09-01' }), [], '2026-09-18'))).toEqual(['2026-09-01']);
  });

  it('count rule never exceeds occurrences even with a large gap to today', () => {
    const r = rule({ end_mode: 'count', occurrences: 12, start_month: '2024-01-01' });
    const out = generateDueEntries(r, [], '2026-09-18');
    expect(out).toHaveLength(12);
    expect(out[11].date).toBe('2024-12-01');
  });

  it('count rule with some months already present only fills the missing ones within the count', () => {
    const r = rule({ end_mode: 'count', occurrences: 3 });
    expect(dates(generateDueEntries(r, ['2026-02-01'], '2026-09-18'))).toEqual(['2026-01-01', '2026-03-01']);
  });

  it('copies rule fields onto every generated entry', () => {
    const [e] = generateDueEntries(rule({ kind: 'income', amount: 2150, notes: 'Unit A rent', party: 'J. Alvarez' }), [], '2026-01-15');
    expect(e).toEqual({
      recurring_id: 'r1',
      property_id: 'p1',
      category_id: 'c1',
      kind: 'income',
      amount: 2150,
      notes: 'Unit A rent',
      party: 'J. Alvarez',
      date: '2026-01-01',
    });
  });

  it('normalizes a non-first-of-month start_month before iterating', () => {
    expect(dates(generateDueEntries(rule({ start_month: '2026-01-15' }), [], '2026-02-10'))).toEqual([
      '2026-01-01', '2026-02-01',
    ]);
  });

  it('count rule combined with an earlier stopped_on stops at stopped_on', () => {
    const r = rule({ end_mode: 'count', occurrences: 12, stopped_on: '2026-03-15', is_active: false });
    expect(dates(generateDueEntries(r, [], '2026-09-18'))).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('stopped_on before start_month generates nothing', () => {
    const r = rule({ stopped_on: '2025-12-20', is_active: false });
    expect(generateDueEntries(r, [], '2026-09-18')).toEqual([]);
  });

  it('today on the 1st of the start month generates that month', () => {
    expect(dates(generateDueEntries(rule({ start_month: '2026-09-01' }), [], '2026-09-01'))).toEqual(['2026-09-01']);
  });

  it('stopped_on exactly on the first of a month includes that month', () => {
    const r = rule({ stopped_on: '2026-03-01', is_active: false });
    expect(dates(generateDueEntries(r, [], '2026-09-18'))).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('does not mutate its inputs', () => {
    const r = rule();
    const existing = ['2026-01-01'];
    const snapshotRule = JSON.stringify(r);
    generateDueEntries(r, existing, '2026-03-01');
    expect(JSON.stringify(r)).toBe(snapshotRule);
    expect(existing).toEqual(['2026-01-01']);
  });
});
