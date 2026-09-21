// Phase 7 tests — timeline (spec §5 Phase 7): merge/sort of two lists into one
// newest-first timeline; date-range filter inclusive on both ends; category filter.
import { buildTimeline, filterTimeline, sortTimeline } from '../src/lib/timeline';
import type { Expense, Income } from '../src/types';

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'e',
  user_id: 'u1',
  property_id: 'p1',
  category_id: 'c-ins',
  amount: 100,
  paid_on: '2026-01-01',
  period_start: null,
  period_end: null,
  vendor: null,
  notes: null,
  recurring_id: null,
  is_edited: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const income = (overrides: Partial<Income>): Income => ({
  id: 'i',
  user_id: 'u1',
  property_id: 'p1',
  category_id: 'c-rent',
  amount: 1800,
  received_on: '2026-01-01',
  source: null,
  notes: null,
  recurring_id: null,
  is_edited: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('buildTimeline', () => {
  it('interleaves expenses and income newest-first', () => {
    const timeline = buildTimeline(
      [expense({ id: 'e1', paid_on: '2026-03-10' }), expense({ id: 'e2', paid_on: '2026-01-05' })],
      [income({ id: 'i1', received_on: '2026-02-01' }), income({ id: 'i2', received_on: '2026-04-01' })]
    );
    expect(timeline.map((t) => t.id)).toEqual(['i2', 'e1', 'i1', 'e2']);
    expect(timeline.map((t) => t.kind)).toEqual(['income', 'expense', 'income', 'expense']);
  });

  it('tiebreaks same-date entries by created_at, newest first', () => {
    const timeline = buildTimeline(
      [expense({ id: 'older', paid_on: '2026-05-01', created_at: '2026-05-01T08:00:00Z' })],
      [income({ id: 'newer', received_on: '2026-05-01', created_at: '2026-05-01T12:00:00Z' })]
    );
    expect(timeline.map((t) => t.id)).toEqual(['newer', 'older']);
  });

  it('handles empty inputs', () => {
    expect(buildTimeline([], [])).toEqual([]);
    expect(buildTimeline([expense({})], [])).toHaveLength(1);
  });
});

describe('filterTimeline — date range', () => {
  const timeline = buildTimeline(
    [
      expense({ id: 'before', paid_on: '2026-01-31' }),
      expense({ id: 'on-start', paid_on: '2026-02-01' }),
      expense({ id: 'inside', paid_on: '2026-02-15' }),
      expense({ id: 'on-end', paid_on: '2026-02-28' }),
      expense({ id: 'after', paid_on: '2026-03-01' }),
    ],
    []
  );

  it('is inclusive on both ends', () => {
    const filtered = filterTimeline(timeline, { from: '2026-02-01', to: '2026-02-28' });
    expect(filtered.map((t) => t.id)).toEqual(['on-end', 'inside', 'on-start']);
  });

  it('supports open-ended ranges', () => {
    expect(filterTimeline(timeline, { from: '2026-02-28' }).map((t) => t.id)).toEqual([
      'after',
      'on-end',
    ]);
    expect(filterTimeline(timeline, { to: '2026-02-01' }).map((t) => t.id)).toEqual([
      'on-start',
      'before',
    ]);
  });

  it('returns everything with no filter', () => {
    expect(filterTimeline(timeline, {})).toHaveLength(5);
  });
});

describe('filterTimeline — category', () => {
  const timeline = buildTimeline(
    [expense({ id: 'e-ins', category_id: 'c-ins' }), expense({ id: 'e-rep', category_id: 'c-rep' })],
    [income({ id: 'i-rent', category_id: 'c-rent' })]
  );

  it('keeps only the requested category', () => {
    expect(filterTimeline(timeline, { categoryId: 'c-ins' }).map((t) => t.id)).toEqual(['e-ins']);
    expect(filterTimeline(timeline, { categoryId: 'c-rent' }).map((t) => t.id)).toEqual(['i-rent']);
  });

  it('combines with a date range', () => {
    const combined = filterTimeline(timeline, {
      categoryId: 'c-rep',
      from: '2026-01-01',
      to: '2026-01-01',
    });
    expect(combined.map((t) => t.id)).toEqual(['e-rep']);
  });
});

describe('recurring linkage on timeline entries', () => {
  it('copies recurring_id from expenses and income rows', () => {
    const e = expense({ id: 'e1', recurring_id: 'r1' });
    const inc = income({ id: 'i1', recurring_id: 'r2' });
    const [a, b] = buildTimeline([e], [inc]);
    expect([a.recurring_id, b.recurring_id].sort()).toEqual(['r1', 'r2']);
  });

  it('is null for manual entries', () => {
    expect(buildTimeline([expense({})], [])[0].recurring_id).toBeNull();
  });
});

describe('sortTimeline', () => {
  const entries = buildTimeline(
    [
      expense({ id: 'e-mar', paid_on: '2026-03-01', amount: 50, created_at: '2026-03-01T00:00:00Z' }),
      expense({ id: 'e-jan', paid_on: '2026-01-01', amount: 900, created_at: '2026-01-01T00:00:00Z' }),
    ],
    [income({ id: 'i-feb', received_on: '2026-02-01', amount: 300, created_at: '2026-02-01T00:00:00Z' })]
  );

  it('oldest-first puts January before February before March', () => {
    expect(sortTimeline(entries, 'oldest').map((e) => e.id)).toEqual(['e-jan', 'i-feb', 'e-mar']);
  });

  it('newest-first is the reverse', () => {
    expect(sortTimeline(entries, 'newest').map((e) => e.id)).toEqual(['e-mar', 'i-feb', 'e-jan']);
  });

  it('largest-first orders by amount regardless of kind', () => {
    expect(sortTimeline(entries, 'largest').map((e) => e.id)).toEqual(['e-jan', 'i-feb', 'e-mar']);
  });

  it('does not mutate the input', () => {
    const before = entries.map((e) => e.id);
    sortTimeline(entries, 'oldest');
    expect(entries.map((e) => e.id)).toEqual(before);
  });

  it('same-day entries keep a stable order: earlier created first when oldest-first', () => {
    const sameDay = buildTimeline(
      [
        expense({ id: 'second', paid_on: '2026-05-01', created_at: '2026-05-01T10:00:00Z' }),
        expense({ id: 'first', paid_on: '2026-05-01', created_at: '2026-05-01T09:00:00Z' }),
      ],
      []
    );
    expect(sortTimeline(sameDay, 'oldest').map((e) => e.id)).toEqual(['first', 'second']);
  });
});
