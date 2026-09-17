// Phase 13 tests — src/db/account.ts with a mocked Supabase client.
// The invariant under test: never sign out unless the delete actually succeeded.
jest.mock('../src/db/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { signOut: jest.fn() },
  },
}));

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
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

  it('signs out locally after a successful delete', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await deleteAccount();
    expect(result).toEqual({ error: null });
    // Local-scope sign-out never contacts the server, so it always clears the
    // persisted session even if the server is unreachable or erroring.
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does NOT sign out when the delete fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ status: 500 }) });
    const result = await deleteAccount();
    expect(result).toEqual({ error: 'Could not delete your account. Please try again.' });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('maps a FunctionsHttpError (non-2xx from the function) to friendly copy', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ status: 500 }) });
    const result = await deleteAccount();
    expect(result.error).toBe('Could not delete your account. Please try again.');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('maps a FunctionsFetchError (network failure) to a connectivity message', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new Error('network down')),
    });
    const result = await deleteAccount();
    expect(result.error).toBe('Could not reach the server. Check your connection and try again.');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('maps any other functions-js error (e.g. FunctionsRelayError) to friendly copy', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsRelayError({ region: 'us-east-1' }),
    });
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
