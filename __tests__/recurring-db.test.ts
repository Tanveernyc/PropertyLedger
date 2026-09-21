// Phase 15 tests — recurring rule CRUD payloads and the sync wrapper.
jest.mock('../src/db/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

import { supabase } from '../src/db/supabase';
import { createExpenses, listExpensesForRule } from '../src/db/expenses';
import { createIncomes } from '../src/db/income';
import {
  applyRuleToPostedEntries,
  createRecurringRule,
  skipRecurringMonth,
  updateRecurringRule,
  stopRecurringRule,
  syncRecurringEntries,
  syncRule,
} from '../src/db/recurring';
import type { RecurringRule } from '../src/types';

const mockFrom = supabase.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

/** Chainable, awaitable postgrest-builder stand-in that records every call. */
function createBuilder(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = { calls };
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'gte', 'is', 'order', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return builder;
}

const baseRule: RecurringRule = {
  id: 'r1', user_id: 'u1', property_id: 'p1', category_id: 'c1', kind: 'expense',
  amount: 1500, notes: null, party: null, start_month: '2026-01-01', end_mode: 'until_stopped',
  occurrences: null, stopped_on: null, is_active: true, created_at: '2026-01-01T00:00:00Z',
  skipped_months: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('createRecurringRule', () => {
  it('inserts the payload with the signed-in user id', async () => {
    const builder = createBuilder({ data: baseRule, error: null });
    mockFrom.mockReturnValue(builder);
    await createRecurringRule({
      property_id: 'p1', category_id: 'c1', kind: 'expense', amount: 1500,
      start_month: '2026-01-01', end_mode: 'until_stopped', occurrences: null,
    });
    expect(mockFrom).toHaveBeenCalledWith('recurring_rules');
    expect(builder.calls).toContainEqual({
      method: 'insert',
      args: [{
        property_id: 'p1', category_id: 'c1', kind: 'expense', amount: 1500,
        start_month: '2026-01-01', end_mode: 'until_stopped', occurrences: null, user_id: 'u1',
      }],
    });
  });

  it('throws when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createRecurringRule({
      property_id: 'p1', category_id: 'c1', kind: 'expense', amount: 1,
      start_month: '2026-01-01', end_mode: 'until_stopped',
    })).rejects.toThrow('Not signed in.');
  });
});

describe('stopRecurringRule', () => {
  it('sets stopped_on to today and is_active false (README §4.4)', async () => {
    const builder = createBuilder({ data: { ...baseRule, is_active: false }, error: null });
    mockFrom.mockReturnValue(builder);
    await stopRecurringRule('r1', '2026-09-18');
    expect(builder.calls).toContainEqual({ method: 'update', args: [{ stopped_on: '2026-09-18', is_active: false }] });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['id', 'r1'] });
  });
});

describe('createExpenses / createIncomes (bulk)', () => {
  it('returns [] and does not touch the network for an empty list', async () => {
    expect(await createExpenses([])).toEqual([]);
    expect(await createIncomes([])).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('stamps user_id on every row', async () => {
    const builder = createBuilder({ data: [{ id: 'e1' }, { id: 'e2' }], error: null });
    mockFrom.mockReturnValue(builder);
    await createExpenses([
      { property_id: 'p1', category_id: 'c1', amount: 1, paid_on: '2026-01-01', recurring_id: 'r1', is_edited: false },
      { property_id: 'p1', category_id: 'c1', amount: 1, paid_on: '2026-02-01', recurring_id: 'r1', is_edited: false },
    ]);
    const insert = builder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0]).toHaveLength(2);
    expect(insert.args[0].every((row: { user_id: string }) => row.user_id === 'u1')).toBe(true);
  });
});

describe('listExpensesForRule', () => {
  it('filters by recurring_id', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);
    await listExpensesForRule('r1');
    expect(mockFrom).toHaveBeenCalledWith('expenses');
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['recurring_id', 'r1'] });
  });
});

describe('syncRule', () => {
  it('inserts only the missing months as expense rows dated the 1st', async () => {
    // First call: existing rows for the rule (Jan present). Second call: the insert.
    const listBuilder = createBuilder({ data: [{ id: 'e1', paid_on: '2026-01-01' }], error: null });
    const insertBuilder = createBuilder({ data: [{ id: 'e2' }, { id: 'e3' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder).mockReturnValueOnce(insertBuilder);

    const inserted = await syncRule(baseRule, '2026-03-15');

    expect(inserted).toBe(2);
    const insert = insertBuilder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0]).toEqual([
      { property_id: 'p1', category_id: 'c1', amount: 1500, notes: null, vendor: null, paid_on: '2026-02-01', recurring_id: 'r1', is_edited: false, user_id: 'u1' },
      { property_id: 'p1', category_id: 'c1', amount: 1500, notes: null, vendor: null, paid_on: '2026-03-01', recurring_id: 'r1', is_edited: false, user_id: 'u1' },
    ]);
  });

  it('uses received_on and the income table for income rules', async () => {
    const listBuilder = createBuilder({ data: [], error: null });
    const insertBuilder = createBuilder({ data: [{ id: 'i1' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder).mockReturnValueOnce(insertBuilder);

    await syncRule({ ...baseRule, kind: 'income', start_month: '2026-03-01' }, '2026-03-15');

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'income');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'income');
    const insert = insertBuilder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0][0]).toMatchObject({ received_on: '2026-03-01', recurring_id: 'r1' });
  });

  it('does nothing when every month already exists', async () => {
    const listBuilder = createBuilder({ data: [{ id: 'e1', paid_on: '2026-01-01' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder);
    expect(await syncRule(baseRule, '2026-01-20')).toBe(0);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('skips a month listed in rule.skipped_months', async () => {
    const listBuilder = createBuilder({ data: [{ id: 'e1', paid_on: '2026-01-01' }], error: null });
    const insertBuilder = createBuilder({ data: [{ id: 'e3' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder).mockReturnValueOnce(insertBuilder);

    const inserted = await syncRule({ ...baseRule, skipped_months: ['2026-02-01'] }, '2026-03-15');

    expect(inserted).toBe(1);
    const insert = insertBuilder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0]).toEqual([
      { property_id: 'p1', category_id: 'c1', amount: 1500, notes: null, vendor: null, paid_on: '2026-03-01', recurring_id: 'r1', is_edited: false, user_id: 'u1' },
    ]);
  });
});

describe('syncRecurringEntries', () => {
  it('loads active rules and syncs each, summing inserted rows', async () => {
    const rulesBuilder = createBuilder({ data: [baseRule, { ...baseRule, id: 'r2', kind: 'income' }], error: null });
    const list1 = createBuilder({ data: [], error: null });
    const ins1 = createBuilder({ data: [{ id: 'e1' }], error: null });
    const list2 = createBuilder({ data: [], error: null });
    const ins2 = createBuilder({ data: [{ id: 'i1' }], error: null });
    mockFrom
      .mockReturnValueOnce(rulesBuilder)
      .mockReturnValueOnce(list1).mockReturnValueOnce(ins1)
      .mockReturnValueOnce(list2).mockReturnValueOnce(ins2);

    const total = await syncRecurringEntries('2026-01-20');

    expect(total).toBe(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'recurring_rules');
    expect(rulesBuilder.calls).toContainEqual({ method: 'eq', args: ['is_active', true] });
  });

  it('skips a rule that fails and still syncs the rest, logging a warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const rulesBuilder = createBuilder({ data: [baseRule, { ...baseRule, id: 'r2' }], error: null });
    const failingList = createBuilder({ data: null, error: new Error('boom') });
    const list2 = createBuilder({ data: [], error: null });
    const ins2 = createBuilder({ data: [{ id: 'e1' }], error: null });
    mockFrom
      .mockReturnValueOnce(rulesBuilder)
      .mockReturnValueOnce(failingList)
      .mockReturnValueOnce(list2).mockReturnValueOnce(ins2);

    const total = await syncRecurringEntries('2026-01-20');

    expect(total).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe('skipRecurringMonth', () => {
  it('appends the first-of-month to skipped_months', async () => {
    const getBuilder = createBuilder({ data: { ...baseRule, skipped_months: ['2026-01-01'] }, error: null });
    const updateBuilder = createBuilder({ data: { ...baseRule, skipped_months: ['2026-01-01', '2026-02-01'] }, error: null });
    mockFrom.mockReturnValueOnce(getBuilder).mockReturnValueOnce(updateBuilder);

    await skipRecurringMonth('r1', '2026-02-14');

    expect(updateBuilder.calls).toContainEqual({
      method: 'update',
      args: [{ skipped_months: ['2026-01-01', '2026-02-01'] }],
    });
  });

  it('is a no-op when the month is already skipped', async () => {
    const getBuilder = createBuilder({ data: { ...baseRule, skipped_months: ['2026-01-01'] }, error: null });
    mockFrom.mockReturnValueOnce(getBuilder);

    await skipRecurringMonth('r1', '2026-01-20');

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe('syncRule copies party onto generated rows', () => {
  it('expense rules write vendor', async () => {
    const listBuilder = createBuilder({ data: [], error: null });
    const insertBuilder = createBuilder({ data: [{ id: 'e1' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder).mockReturnValueOnce(insertBuilder);
    await syncRule({ ...baseRule, party: 'KeyBank', start_month: '2026-03-01' }, '2026-03-15');
    const insert = insertBuilder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0][0]).toMatchObject({ vendor: 'KeyBank', paid_on: '2026-03-01' });
  });

  it('income rules write source', async () => {
    const listBuilder = createBuilder({ data: [], error: null });
    const insertBuilder = createBuilder({ data: [{ id: 'i1' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder).mockReturnValueOnce(insertBuilder);
    await syncRule({ ...baseRule, kind: 'income', party: 'J. Alvarez', start_month: '2026-03-01' }, '2026-03-15');
    const insert = insertBuilder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0][0]).toMatchObject({ source: 'J. Alvarez', received_on: '2026-03-01' });
  });
});

describe('updateRecurringRule', () => {
  it('sends every editable field', async () => {
    const builder = createBuilder({ data: baseRule, error: null });
    mockFrom.mockReturnValue(builder);
    await updateRecurringRule('r1', {
      amount: 1600, notes: 'n', party: 'v', category_id: 'c2', property_id: 'p2',
      start_month: '2026-02-01', end_mode: 'count', occurrences: 6,
    });
    expect(builder.calls).toContainEqual({
      method: 'update',
      args: [{ amount: 1600, notes: 'n', party: 'v', category_id: 'c2', property_id: 'p2', start_month: '2026-02-01', end_mode: 'count', occurrences: 6 }],
    });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['id', 'r1'] });
  });
});

describe('applyRuleToPostedEntries', () => {
  it('rewrites unedited expense rows from the given month onward, never edited ones', async () => {
    const builder = createBuilder({ data: [{ id: 'e2' }, { id: 'e3' }], error: null });
    mockFrom.mockReturnValue(builder);
    const rule = { ...baseRule, amount: 1700, party: 'KeyBank', notes: 'new', category_id: 'c9' };
    const n = await applyRuleToPostedEntries(rule, '2026-04-10');
    expect(n).toBe(2);
    expect(mockFrom).toHaveBeenCalledWith('expenses');
    expect(builder.calls).toContainEqual({
      method: 'update',
      args: [{ amount: 1700, vendor: 'KeyBank', notes: 'new', category_id: 'c9' }],
    });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['recurring_id', 'r1'] });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['is_edited', false] });
    // Month boundary is normalised to the 1st.
    expect(builder.calls).toContainEqual({ method: 'gte', args: ['paid_on', '2026-04-01'] });
  });

  it('uses the income table and source for income rules', async () => {
    const builder = createBuilder({ data: [{ id: 'i1' }], error: null });
    mockFrom.mockReturnValue(builder);
    const n = await applyRuleToPostedEntries({ ...baseRule, kind: 'income', party: 'Tenant' }, '2026-01-01');
    expect(n).toBe(1);
    expect(mockFrom).toHaveBeenCalledWith('income');
    expect(builder.calls).toContainEqual({
      method: 'update',
      args: [{ amount: 1500, source: 'Tenant', notes: null, category_id: 'c1' }],
    });
    expect(builder.calls).toContainEqual({ method: 'gte', args: ['received_on', '2026-01-01'] });
  });
});
