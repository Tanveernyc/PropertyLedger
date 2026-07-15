// Phase 3 tests — src/db/properties.ts with a mocked Supabase client (spec §5 Phase 3):
// archive sets the flag (an UPDATE, not a delete); list excludes archived unless requested;
// create inserts the right payload with the signed-in user's id.
import type { Property } from '../src/types';

jest.mock('../src/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

import { supabase } from '../src/db/supabase';
import {
  createProperty,
  listProperties,
  setPropertyArchived,
} from '../src/db/properties';

const mockFrom = supabase.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

/**
 * Chainable, awaitable stand-in for the postgrest query builder. Every method
 * call is recorded so tests can assert exactly what the data layer asked for.
 */
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
  // Awaiting the builder resolves with the configured result, like postgrest-js.
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return builder;
}

const sampleProperty: Property = {
  id: 'p1',
  user_id: 'u1',
  name: '12 Maple St',
  address: null,
  property_type: 'rental',
  purchase_date: null,
  purchase_price: null,
  notes: null,
  is_archived: false,
  created_at: '2026-07-15T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listProperties', () => {
  it('excludes archived properties by default', async () => {
    const builder = createBuilder({ data: [sampleProperty], error: null });
    mockFrom.mockReturnValue(builder);

    await listProperties();

    expect(mockFrom).toHaveBeenCalledWith('properties');
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['is_archived', false] });
  });

  it('includes archived properties when requested', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await listProperties({ includeArchived: true });

    const eqCalls = builder.calls.filter((c: { method: string }) => c.method === 'eq');
    expect(eqCalls).toHaveLength(0);
  });
});

describe('createProperty', () => {
  it('inserts the payload with the signed-in user id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const builder = createBuilder({ data: sampleProperty, error: null });
    mockFrom.mockReturnValue(builder);

    await createProperty({ name: '12 Maple St', property_type: 'rental' });

    expect(builder.calls).toContainEqual({
      method: 'insert',
      args: [{ name: '12 Maple St', property_type: 'rental', user_id: 'u1' }],
    });
  });

  it('refuses to insert when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(createProperty({ name: 'X', property_type: 'rental' })).rejects.toThrow(
      'Not signed in.'
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('setPropertyArchived', () => {
  it('archives via an UPDATE of is_archived — never a delete', async () => {
    const builder = createBuilder({
      data: { ...sampleProperty, is_archived: true },
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const result = await setPropertyArchived('p1', true);

    expect(result.is_archived).toBe(true);
    expect(builder.calls).toContainEqual({ method: 'update', args: [{ is_archived: true }] });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['id', 'p1'] });
    const deleteCalls = builder.calls.filter((c: { method: string }) => c.method === 'delete');
    expect(deleteCalls).toHaveLength(0); // archiving must not delete the row
  });

  it('unarchives the same way', async () => {
    const builder = createBuilder({ data: sampleProperty, error: null });
    mockFrom.mockReturnValue(builder);

    await setPropertyArchived('p1', false);

    expect(builder.calls).toContainEqual({ method: 'update', args: [{ is_archived: false }] });
  });
});
