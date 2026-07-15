// Phase 6 tests — mirror of Phase 5 for income (spec §5 Phase 6):
// save inserts the correct payload with received_on; income categories only
// is covered by orderCategoriesByRecent kind filtering (add-transaction-state tests).
jest.mock('../src/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

import { supabase } from '../src/db/supabase';
import { createIncome } from '../src/db/income';

const mockFrom = supabase.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

/** Chainable, awaitable postgrest-builder stand-in that records every call. */
function createBuilder(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = { calls };
  for (const method of ['select', 'insert', 'eq', 'order', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return builder;
}

beforeEach(() => jest.clearAllMocks());

describe('createIncome', () => {
  it('inserts the payload with received_on and the signed-in user id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const builder = createBuilder({ data: { id: 'i1' }, error: null });
    mockFrom.mockReturnValue(builder);

    await createIncome({
      property_id: 'p1',
      category_id: 'c-rent',
      amount: 1800,
      received_on: '2026-07-01',
      source: 'Tenant A',
      notes: null,
    });

    expect(mockFrom).toHaveBeenCalledWith('income');
    expect(builder.calls).toContainEqual({
      method: 'insert',
      args: [
        {
          property_id: 'p1',
          category_id: 'c-rent',
          amount: 1800,
          received_on: '2026-07-01',
          source: 'Tenant A',
          notes: null,
          user_id: 'u1',
        },
      ],
    });
  });

  it('refuses when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      createIncome({ property_id: 'p1', category_id: 'c1', amount: 1, received_on: '2026-07-01' })
    ).rejects.toThrow('Not signed in.');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('income form rules mirror expenses', () => {
  // The shared validator enforces the same amount/date rules for income
  // (received_on plays the role of paid_on).
  const { validateTransactionForm } = jest.requireActual('../src/lib/expense-validation');

  it('requires received_on and a positive ≤2-decimal amount', () => {
    const base = { amountText: '1800', date: '2026-07-01', propertyId: 'p1', categoryId: 'c1' };
    expect(validateTransactionForm(base).valid).toBe(true);
    expect(validateTransactionForm({ ...base, date: '' }).valid).toBe(false);
    expect(validateTransactionForm({ ...base, amountText: '0' }).valid).toBe(false);
    expect(validateTransactionForm({ ...base, amountText: '1.999' }).valid).toBe(false);
  });
});
