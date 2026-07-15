// Phase 11 tests (spec §5 Phase 11): dashboard aggregates match calcPL for the
// same data; the empty state renders without crashing.
import { render } from '@testing-library/react-native';
import { DashboardView } from '../src/components/dashboard-view';
import { calcPL, thisYearRange } from '../src/lib/aggregate';
import { buildDashboardModel, RECENT_COUNT } from '../src/lib/dashboard';
import { buildTimeline } from '../src/lib/timeline';
import type { Expense, Income, Property } from '../src/types';

const TODAY = '2026-07-15';

const property = (id: string, name: string, archived = false): Property => ({
  id,
  user_id: 'u1',
  name,
  address: null,
  property_type: 'rental',
  purchase_date: null,
  purchase_price: null,
  notes: null,
  is_archived: archived,
  created_at: '2026-01-01T00:00:00Z',
});

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

describe('buildDashboardModel', () => {
  const properties = [property('p1', 'Maple St'), property('p2', 'Archived Pl', true)];
  const expenses = [
    expense({ id: 'e1', amount: 300, paid_on: '2026-03-01' }),
    expense({ id: 'e2', amount: 50, paid_on: '2025-03-01' }), // last year — excluded from year PL
  ];
  const incomeRows = [income({ id: 'i1', amount: 1800, received_on: '2026-06-01' })];

  it('year aggregates match calcPL for the same data and range', () => {
    const model = buildDashboardModel(properties, expenses, incomeRows, TODAY);
    expect(model.yearPL).toEqual(calcPL(expenses, incomeRows, thisYearRange(TODAY)));
    expect(model.yearPL.net).toBe(1500);
  });

  it('property cards cover active properties only and match calcPL per property', () => {
    const model = buildDashboardModel(properties, expenses, incomeRows, TODAY);
    expect(model.propertyCards.map((c) => c.propertyId)).toEqual(['p1']); // archived excluded
    const p1Expenses = expenses.filter((e) => e.property_id === 'p1');
    const p1Income = incomeRows.filter((i) => i.property_id === 'p1');
    expect(model.propertyCards[0].net).toBe(
      calcPL(p1Expenses, p1Income, thisYearRange(TODAY)).net
    );
  });

  it('recent shows the five newest transactions', () => {
    const manyExpenses = Array.from({ length: 8 }, (_, n) =>
      expense({ id: `e${n}`, paid_on: `2026-06-0${n + 1}` })
    );
    const model = buildDashboardModel(properties, manyExpenses, incomeRows, TODAY);
    expect(model.recent).toHaveLength(RECENT_COUNT);
    expect(model.recent).toEqual(buildTimeline(manyExpenses, incomeRows).slice(0, RECENT_COUNT));
    expect(model.recent[0].date).toBe('2026-06-08'); // newest first
  });

  it('empty inputs produce a zeroed model', () => {
    const model = buildDashboardModel([], [], [], TODAY);
    expect(model.yearPL).toEqual({ totalIncome: 0, totalExpense: 0, net: 0 });
    expect(model.propertyCards).toEqual([]);
    expect(model.recent).toEqual([]);
  });
});

describe('DashboardView', () => {
  it('empty state renders without crashing', async () => {
    const model = buildDashboardModel([], [], [], TODAY);
    const { getByTestId, getByText } = await render(
      <DashboardView
        model={model}
        categoryNames={new Map()}
        onQuickAdd={() => {}}
        onOpenProperty={() => {}}
        onOpenTransaction={() => {}}
      />
    );
    expect(getByTestId('dashboard')).toBeTruthy();
    expect(getByText('No transactions yet.')).toBeTruthy();
    expect(getByText(/No properties yet/)).toBeTruthy();
  });

  it('renders populated data', async () => {
    const model = buildDashboardModel(
      [property('p1', 'Maple St')],
      [expense({ id: 'e1', amount: 300 })],
      [income({ id: 'i1', amount: 1800 })],
      TODAY
    );
    const { getAllByText, getByText } = await render(
      <DashboardView
        model={model}
        categoryNames={new Map([['c-ins', 'Insurance'], ['c-rent', 'Rent']])}
        onQuickAdd={() => {}}
        onOpenProperty={() => {}}
        onOpenTransaction={() => {}}
      />
    );
    expect(getByText('Maple St')).toBeTruthy();
    // Net appears on the portfolio card and the (only) property card.
    expect(getAllByText('$1,500.00').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Insurance')).toBeTruthy(); // recent row category name
  });
});
