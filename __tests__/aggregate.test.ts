// Phase 8 tests — P&L math, tested hardest (spec §5 Phase 8): empty inputs → zeros;
// income-only; expense-only; negative net; inclusive range boundaries; out-of-range
// exclusion; category totals sum to expense total; multi-property split.
import {
  calcByCategory,
  calcPL,
  calcPLByProperty,
  lastYearRange,
  thisYearRange,
} from '../src/lib/aggregate';
import type { Category, Expense, Income, Property } from '../src/types';

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

const income = (overrides: Partial<Income>): Income => ({
  id: 'i',
  user_id: 'u1',
  property_id: 'p1',
  category_id: 'c-rent',
  amount: 1800,
  received_on: '2026-06-01',
  source: null,
  notes: null,
  created_at: '2026-06-01T00:00:00Z',
  ...overrides,
});

const property = (id: string, name: string): Property => ({
  id,
  user_id: 'u1',
  name,
  address: null,
  property_type: 'rental',
  purchase_date: null,
  purchase_price: null,
  notes: null,
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
});

describe('calcPL', () => {
  it('returns zeros for empty inputs without crashing', () => {
    expect(calcPL([], [], {})).toEqual({ totalIncome: 0, totalExpense: 0, net: 0 });
    expect(calcPL([], [], { from: '2026-01-01', to: '2026-12-31' })).toEqual({
      totalIncome: 0,
      totalExpense: 0,
      net: 0,
    });
  });

  it('handles income-only', () => {
    const pl = calcPL([], [income({ amount: 1800 }), income({ id: 'i2', amount: 200.5 })], {});
    expect(pl).toEqual({ totalIncome: 2000.5, totalExpense: 0, net: 2000.5 });
  });

  it('handles expense-only', () => {
    const pl = calcPL([expense({ amount: 450.25 })], [], {});
    expect(pl).toEqual({ totalIncome: 0, totalExpense: 450.25, net: -450.25 });
  });

  it('net is negative when expenses exceed income', () => {
    const pl = calcPL([expense({ amount: 2500 })], [income({ amount: 1800 })], {});
    expect(pl.net).toBe(-700);
    expect(pl.net).toBeLessThan(0);
  });

  it('range boundaries are inclusive on both ends', () => {
    const range = { from: '2026-02-01', to: '2026-02-28' };
    const pl = calcPL(
      [
        expense({ id: 'on-from', amount: 10, paid_on: '2026-02-01' }),
        expense({ id: 'on-to', amount: 20, paid_on: '2026-02-28' }),
      ],
      [income({ id: 'i-on-from', amount: 100, received_on: '2026-02-01' })],
      range
    );
    expect(pl.totalExpense).toBe(30);
    expect(pl.totalIncome).toBe(100);
  });

  it('excludes transactions outside the range', () => {
    const range = { from: '2026-02-01', to: '2026-02-28' };
    const pl = calcPL(
      [
        expense({ id: 'before', amount: 10, paid_on: '2026-01-31' }),
        expense({ id: 'inside', amount: 20, paid_on: '2026-02-15' }),
        expense({ id: 'after', amount: 40, paid_on: '2026-03-01' }),
      ],
      [income({ id: 'i-after', amount: 500, received_on: '2026-03-01' })],
      range
    );
    expect(pl.totalExpense).toBe(20);
    expect(pl.totalIncome).toBe(0);
  });

  it('sums float-hostile amounts exactly (cents arithmetic)', () => {
    // 0.1 + 0.2 in naive float math is 0.30000000000000004.
    const pl = calcPL([expense({ amount: 0.1 }), expense({ id: 'e2', amount: 0.2 })], [], {});
    expect(pl.totalExpense).toBe(0.3);
  });
});

describe('calcByCategory', () => {
  const categories: Category[] = [
    { id: 'c-ins', user_id: null, name: 'Insurance', kind: 'expense', is_system: true, created_at: '' },
    { id: 'c-rep', user_id: null, name: 'Repairs', kind: 'expense', is_system: true, created_at: '' },
  ];

  it('returns empty for no expenses', () => {
    expect(calcByCategory([], {}, categories)).toEqual([]);
  });

  it('category totals sum exactly to the P&L expense total', () => {
    const expenses = [
      expense({ id: 'e1', category_id: 'c-ins', amount: 100.1 }),
      expense({ id: 'e2', category_id: 'c-ins', amount: 200.2 }),
      expense({ id: 'e3', category_id: 'c-rep', amount: 49.75 }),
    ];
    const totals = calcByCategory(expenses, {}, categories);
    const sum = totals.reduce((acc, t) => acc + Math.round(t.total * 100), 0) / 100;
    expect(sum).toBe(calcPL(expenses, [], {}).totalExpense);
  });

  it('resolves names, sorts largest first, and respects the range', () => {
    const expenses = [
      expense({ id: 'e1', category_id: 'c-ins', amount: 50, paid_on: '2026-06-01' }),
      expense({ id: 'e2', category_id: 'c-rep', amount: 500, paid_on: '2026-06-02' }),
      expense({ id: 'e3', category_id: 'c-rep', amount: 999, paid_on: '2027-01-01' }), // outside
    ];
    const totals = calcByCategory(expenses, { from: '2026-01-01', to: '2026-12-31' }, categories);
    expect(totals).toEqual([
      { categoryId: 'c-rep', name: 'Repairs', total: 500 },
      { categoryId: 'c-ins', name: 'Insurance', total: 50 },
    ]);
  });
});

describe('calcPLByProperty', () => {
  it('splits totals correctly across properties', () => {
    const properties = [property('p1', 'Maple St'), property('p2', 'Oak Ave')];
    const expenses = [
      expense({ id: 'e1', property_id: 'p1', amount: 300 }),
      expense({ id: 'e2', property_id: 'p2', amount: 75.5 }),
      expense({ id: 'e3', property_id: 'p2', amount: 24.5 }),
    ];
    const incomeRows = [
      income({ id: 'i1', property_id: 'p1', amount: 1800 }),
      income({ id: 'i2', property_id: 'p2', amount: 50 }),
    ];

    const result = calcPLByProperty(properties, expenses, incomeRows, {});

    expect(result).toEqual([
      { propertyId: 'p1', name: 'Maple St', totalIncome: 1800, totalExpense: 300, net: 1500 },
      { propertyId: 'p2', name: 'Oak Ave', totalIncome: 50, totalExpense: 100, net: -50 },
    ]);
  });

  it('a property with no transactions gets zeros', () => {
    const result = calcPLByProperty([property('p9', 'Empty')], [], [], {});
    expect(result[0]).toEqual({
      propertyId: 'p9',
      name: 'Empty',
      totalIncome: 0,
      totalExpense: 0,
      net: 0,
    });
  });

  it('portfolio total equals the sum of property nets', () => {
    const properties = [property('p1', 'A'), property('p2', 'B')];
    const expenses = [
      expense({ id: 'e1', property_id: 'p1', amount: 100 }),
      expense({ id: 'e2', property_id: 'p2', amount: 200 }),
    ];
    const incomeRows = [income({ id: 'i1', property_id: 'p1', amount: 1000 })];

    const perProperty = calcPLByProperty(properties, expenses, incomeRows, {});
    const summed = perProperty.reduce((acc, p) => acc + Math.round(p.net * 100), 0) / 100;
    expect(summed).toBe(calcPL(expenses, incomeRows, {}).net);
  });
});

describe('range presets', () => {
  it('thisYearRange covers Jan 1 – Dec 31 of the current year', () => {
    expect(thisYearRange('2026-07-15')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('lastYearRange covers the prior calendar year', () => {
    expect(lastYearRange('2026-07-15')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});
