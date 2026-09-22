// Phase 4 tests — category helpers (spec §5 Phase 4):
// expense/income lists filter by kind correctly; system categories are undeletable.
import {
  canDeleteCategory,
  categoriesForLedger,
  filterCategoriesByKind,
  splitCategoriesByKind,
} from '../src/lib/categories';
import type { Category } from '../src/types';

const cat = (overrides: Partial<Category>): Category => ({
  id: 'c1',
  user_id: null,
  name: 'Insurance',
  kind: 'expense',
  is_system: true,
  scope: 'rental',
  created_at: '2026-07-15T00:00:00Z',
  ...overrides,
});

const fixtures: Category[] = [
  cat({ id: 'e1', name: 'Insurance', kind: 'expense', is_system: true }),
  cat({ id: 'e2', name: 'Repairs', kind: 'expense', is_system: true }),
  cat({ id: 'e3', name: 'Custom Expense', kind: 'expense', is_system: false, user_id: 'u1' }),
  cat({ id: 'i1', name: 'Rent', kind: 'income', is_system: true }),
  cat({ id: 'i2', name: 'Custom Income', kind: 'income', is_system: false, user_id: 'u1' }),
];

describe('filterCategoriesByKind', () => {
  it('returns only expense categories for kind=expense', () => {
    const result = filterCategoriesByKind(fixtures, 'expense');
    expect(result.map((c) => c.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('returns only income categories for kind=income', () => {
    const result = filterCategoriesByKind(fixtures, 'income');
    expect(result.map((c) => c.id)).toEqual(['i1', 'i2']);
  });
});

describe('splitCategoriesByKind', () => {
  it('partitions the list with nothing lost or duplicated', () => {
    const { expense, income } = splitCategoriesByKind(fixtures);
    expect(expense).toHaveLength(3);
    expect(income).toHaveLength(2);
    expect(expense.length + income.length).toBe(fixtures.length);
  });
});

describe('canDeleteCategory', () => {
  it('forbids deleting system categories', () => {
    expect(canDeleteCategory(cat({ is_system: true }))).toBe(false);
  });

  it('allows deleting custom categories', () => {
    expect(canDeleteCategory(cat({ is_system: false, user_id: 'u1' }))).toBe(true);
  });
});

describe('categoriesForLedger', () => {
  const scoped: Category[] = [
    cat({ id: 'r', name: 'Mortgage Interest', kind: 'expense', scope: 'rental' }),
    cat({ id: 'b', name: 'Electric', kind: 'expense', scope: 'both' }),
    cat({ id: 'p', name: 'Groceries', kind: 'expense', scope: 'personal' }),
    cat({ id: 'pi', name: 'Salary', kind: 'income', scope: 'personal' }),
  ];
  it('a rental ledger sees rental + both, never personal', () => {
    expect(categoriesForLedger(scoped, 'rental', 'expense').map((c) => c.id)).toEqual(['r', 'b']);
  });
  it('a personal ledger sees personal + both, never rental', () => {
    expect(categoriesForLedger(scoped, 'personal', 'expense').map((c) => c.id)).toEqual(['b', 'p']);
  });
  it('still filters by entry kind', () => {
    expect(categoriesForLedger(scoped, 'personal', 'income').map((c) => c.id)).toEqual(['pi']);
  });
});
