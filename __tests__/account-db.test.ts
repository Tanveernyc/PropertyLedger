// Phase 13 tests — src/db/account.ts with a mocked Supabase client.
// The invariant under test: never sign out unless the delete actually succeeded.
jest.mock('../src/db/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { signOut: jest.fn() },
  },
}));

import { supabase } from '../src/db/supabase';
import { deleteAccount } from '../src/db/account';

const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;

beforeEach(() => {
  mockInvoke.mockReset();
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue({ error: null });
});

describe('deleteAccount', () => {
  it('calls the delete-account function', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await deleteAccount();
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
  });

  it('signs out after a successful delete', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await deleteAccount();
    expect(result).toEqual({ error: null });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('does NOT sign out when the delete fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const result = await deleteAccount();
    expect(result).toEqual({ error: 'boom' });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('reports a readable message when the error carries none', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: {} });
    const result = await deleteAccount();
    expect(result.error).toBe('Could not delete your account. Please try again.');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('still reports success when sign-out fails, since the account is gone', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    mockSignOut.mockRejectedValue(new Error('token already dead'));
    const result = await deleteAccount();
    expect(result).toEqual({ error: null });
  });
});
