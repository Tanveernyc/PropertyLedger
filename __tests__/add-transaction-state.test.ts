// Phase 5 tests — post-save state (spec §5 Phase 5):
// save clears the amount but retains property/category for rapid entry.
import {
  initialAddState,
  orderCategoriesByRecent,
  pushRecentCategory,
  resetAfterSave,
} from '../src/lib/add-transaction-state';
import type { Category } from '../src/types';

describe('resetAfterSave', () => {
  it('clears amount and per-bill fields but keeps property, category, and date', () => {
    const before = {
      ...initialAddState(),
      propertyId: 'p1',
      categoryId: 'c1',
      amountText: '99.50',
      date: '2026-07-15',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      vendor: 'Allstate',
      notes: 'annual premium',
    };

    const after = resetAfterSave(before);

    expect(after.propertyId).toBe('p1'); // retained
    expect(after.categoryId).toBe('c1'); // retained
    expect(after.date).toBe('2026-07-15'); // retained
    expect(after.amountText).toBe(''); // cleared
    expect(after.periodStart).toBe('');
    expect(after.periodEnd).toBe('');
    expect(after.vendor).toBe('');
    expect(after.notes).toBe('');
  });
});

describe('recent-first category ordering', () => {
  const cat = (id: string, name: string, kind: 'expense' | 'income' = 'expense'): Category => ({
    id,
    user_id: null,
    name,
    kind,
    is_system: true,
    created_at: '2026-07-15T00:00:00Z',
  });
  const categories = [
    cat('a', 'Electric'),
    cat('b', 'Insurance'),
    cat('c', 'Repairs'),
    cat('i', 'Rent', 'income'),
  ];

  it('puts recently used categories first, rest in original order', () => {
    const ordered = orderCategoriesByRecent(categories, ['c', 'a'], 'expense');
    expect(ordered.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('filters to the requested kind and ignores unknown recent ids', () => {
    const ordered = orderCategoriesByRecent(categories, ['i', 'gone', 'b'], 'expense');
    expect(ordered.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('pushRecentCategory dedupes and caps', () => {
    expect(pushRecentCategory(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(pushRecentCategory(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['f', 'a', 'b', 'c', 'd']);
  });
});
