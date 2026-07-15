// Phase 4 tests — src/db/categories.ts with a mocked Supabase client (spec §5 Phase 4):
// system category delete is rejected before any network call; custom category CRUD.
import type { Category } from '../src/types';

jest.mock('../src/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

import { supabase } from '../src/db/supabase';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from '../src/db/categories';

const mockFrom = supabase.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

/** Chainable, awaitable postgrest-builder stand-in that records every call. */
function createBuilder(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = { calls };
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return builder;
}

const systemCategory: Category = {
  id: 'sys1',
  user_id: null,
  name: 'Insurance',
  kind: 'expense',
  is_system: true,
  created_at: '2026-07-15T00:00:00Z',
};

const customCategory: Category = {
  ...systemCategory,
  id: 'cust1',
  user_id: 'u1',
  name: 'Hot Tub Maintenance',
  is_system: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('deleteCategory', () => {
  it('rejects system categories without touching the network', async () => {
    await expect(deleteCategory(systemCategory)).rejects.toThrow(
      'System categories cannot be deleted.'
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deletes custom categories by id', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await deleteCategory(customCategory);

    expect(mockFrom).toHaveBeenCalledWith('categories');
    expect(builder.calls).toContainEqual({ method: 'delete', args: [] });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['id', 'cust1'] });
  });
});

describe('createCategory', () => {
  it('inserts a trimmed custom category owned by the user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const builder = createBuilder({ data: customCategory, error: null });
    mockFrom.mockReturnValue(builder);

    await createCategory('  Hot Tub Maintenance  ', 'expense');

    expect(builder.calls).toContainEqual({
      method: 'insert',
      args: [{ name: 'Hot Tub Maintenance', kind: 'expense', user_id: 'u1', is_system: false }],
    });
  });

  it('refuses when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createCategory('X', 'expense')).rejects.toThrow('Not signed in.');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('renameCategory', () => {
  it('updates the name by id', async () => {
    const builder = createBuilder({ data: customCategory, error: null });
    mockFrom.mockReturnValue(builder);

    await renameCategory('cust1', '  New Name ');

    expect(builder.calls).toContainEqual({ method: 'update', args: [{ name: 'New Name' }] });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['id', 'cust1'] });
  });
});

describe('listCategories', () => {
  it('fetches all visible categories in name order', async () => {
    const builder = createBuilder({ data: [systemCategory, customCategory], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await listCategories();

    expect(result).toHaveLength(2);
    expect(builder.calls).toContainEqual({ method: 'order', args: ['name'] });
  });
});
