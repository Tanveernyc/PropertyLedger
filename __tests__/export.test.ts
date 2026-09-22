// Phase 10 tests — export (spec §5 Phase 10): shape includes all tables; CSV
// escapes commas and quotes in notes/vendor fields; empty database exports a
// valid empty structure.
import {
  buildTransactionsCsv,
  csvEscape,
  TRANSACTIONS_CSV_HEADER,
} from '../src/lib/export';
import type { Category, Expense, Income, Property } from '../src/types';

const property: Property = {
  id: 'p1',
  user_id: 'u1',
  name: 'Maple St',
  address: null,
  property_type: 'rental',
  purchase_date: null,
  purchase_price: null,
  notes: null,
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
};

const category: Category = {
  id: 'c-ins',
  user_id: null,
  name: 'Insurance',
  kind: 'expense',
  is_system: true,
  scope: 'rental',
  created_at: '2026-01-01T00:00:00Z',
};

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'e1',
  user_id: 'u1',
  property_id: 'p1',
  category_id: 'c-ins',
  amount: 100,
  paid_on: '2026-06-15',
  period_start: null,
  period_end: null,
  vendor: null,
  notes: null,
  recurring_id: null,
  is_edited: false,
  created_at: '2026-06-15T00:00:00Z',
  ...overrides,
});

const income = (overrides: Partial<Income>): Income => ({
  id: 'i1',
  user_id: 'u1',
  property_id: 'p1',
  category_id: 'c-rent',
  amount: 1800,
  received_on: '2026-06-01',
  source: null,
  notes: null,
  recurring_id: null,
  is_edited: false,
  created_at: '2026-06-01T00:00:00Z',
  ...overrides,
});

describe('csvEscape', () => {
  it('escapes commas, quotes, and newlines; doubles inner quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape(null)).toBe('');
  });
});

describe('buildTransactionsCsv', () => {
  it('escapes commas and quotes in notes and vendor fields', () => {
    const csv = buildTransactionsCsv({
      properties: [property],
      categories: [category],
      expenses: [
        expense({
          vendor: 'Smith, Jones & Co',
          notes: 'He said "paid in full", then left',
        }),
      ],
      income: [],
    });
    const dataRow = csv.split('\n')[1];
    expect(dataRow).toContain('"Smith, Jones & Co"');
    expect(dataRow).toContain('"He said ""paid in full"", then left"');
    // The escaped row still parses to the exact 9 header columns.
    const columns = dataRow.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.filter((c) => c !== '');
    expect(columns).toHaveLength(TRANSACTIONS_CSV_HEADER.split(',').length);
  });

  it('interleaves both kinds and resolves names', () => {
    const csv = buildTransactionsCsv({
      properties: [property],
      categories: [category],
      expenses: [expense({ paid_on: '2026-06-15' })],
      income: [income({ received_on: '2026-07-01' })],
    });
    const lines = csv.split('\n');
    expect(lines[0]).toBe(TRANSACTIONS_CSV_HEADER);
    expect(lines[1].startsWith('income,2026-07-01,1800.00,Maple St')).toBe(true);
    expect(lines[2].startsWith('expense,2026-06-15,100.00,Maple St,Insurance')).toBe(true);
  });

  it('an empty database yields just the header', () => {
    const csv = buildTransactionsCsv({ properties: [], categories: [], expenses: [], income: [] });
    expect(csv).toBe(TRANSACTIONS_CSV_HEADER);
  });
});
