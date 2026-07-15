// Phase 5 tests — save calls insert with the correct payload (spec §5 Phase 5).
jest.mock('../src/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

import { supabase } from '../src/db/supabase';
import { createExpense } from '../src/db/expenses';

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

describe('createExpense', () => {
  it('inserts the full payload with the signed-in user id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const builder = createBuilder({ data: { id: 'e1' }, error: null });
    mockFrom.mockReturnValue(builder);

    await createExpense({
      property_id: 'p1',
      category_id: 'c1',
      amount: 125.5,
      paid_on: '2026-07-15',
      period_start: '2026-01-01',
      period_end: '2026-12-31',
      vendor: 'Allstate',
      notes: 'annual premium',
    });

    expect(mockFrom).toHaveBeenCalledWith('expenses');
    expect(builder.calls).toContainEqual({
      method: 'insert',
      args: [
        {
          property_id: 'p1',
          category_id: 'c1',
          amount: 125.5,
          paid_on: '2026-07-15',
          period_start: '2026-01-01',
          period_end: '2026-12-31',
          vendor: 'Allstate',
          notes: 'annual premium',
          user_id: 'u1',
        },
      ],
    });
  });

  it('refuses when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      createExpense({ property_id: 'p1', category_id: 'c1', amount: 1, paid_on: '2026-07-15' })
    ).rejects.toThrow('Not signed in.');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
