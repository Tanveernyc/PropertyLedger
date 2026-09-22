// The provider boundary: every path either produces a Supabase session or a
// classified outcome. Nothing here may throw at the caller.
jest.mock('../src/db/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn(), updateUser: jest.fn() } },
}));

import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../src/db/supabase';
import { signInWithApple, signInWithGoogle } from '../src/lib/social-auth';

const mockSignInWithIdToken = supabase.auth.signInWithIdToken as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockAppleSignIn = AppleAuthentication.signInAsync as jest.Mock;
const mockGoogleSignIn = GoogleSignin.signIn as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSignInWithIdToken.mockResolvedValue({ data: { session: {} }, error: null });
  mockUpdateUser.mockResolvedValue({ data: {}, error: null });
});

describe('signInWithApple', () => {
  it('sends the identity token with the RAW nonce, and the hash went to Apple', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: 'apple-token', fullName: null });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: true });
    const appleArgs = mockAppleSignIn.mock.calls[0][0];
    const supabaseArgs = mockSignInWithIdToken.mock.calls[0][0];
    expect(supabaseArgs).toMatchObject({ provider: 'apple', token: 'apple-token' });
    expect(supabaseArgs.nonce).toMatch(/^[0-9a-f]{32}$/); // raw
    expect(appleArgs.nonce).toMatch(/^[0-9a-f]{64}$/); // hashed
    expect(appleArgs.nonce).not.toBe(supabaseArgs.nonce);
  });

  it('stores the full name Apple only ever sends once', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    });

    await signInWithApple();

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'Ada Lovelace' } });
  });

  it('still signs in when storing the name fails', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token',
      fullName: { givenName: 'Ada', familyName: null },
    });
    mockUpdateUser.mockRejectedValue(new Error('offline'));

    await expect(signInWithApple()).resolves.toEqual({ ok: true });
  });

  it('reports a missing identity token instead of passing null on', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: null, fullName: null });

    const result = await signInWithApple();

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toEqual({ kind: 'error', message: 'Apple did not return a sign-in token.' });
  });

  it('returns cancelled when the user dismisses the sheet', async () => {
    mockAppleSignIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: false, outcome: { kind: 'cancelled' } });
  });

  it('surfaces a Supabase rejection', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: 'apple-token', fullName: null });
    mockSignInWithIdToken.mockResolvedValue({ data: {}, error: { message: 'bad audience' } });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: false, outcome: { kind: 'error', message: 'bad audience' } });
  });
});

describe('signInWithGoogle', () => {
  it('exchanges the Google id token for a session', async () => {
    mockGoogleSignIn.mockResolvedValue({ data: { idToken: 'google-token' } });

    const result = await signInWithGoogle();

    expect(result).toEqual({ ok: true });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-token' });
  });

  it('accepts the SDK shape that puts idToken at the top level', async () => {
    mockGoogleSignIn.mockResolvedValue({ idToken: 'legacy-token' });

    await signInWithGoogle();

    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'legacy-token' });
  });

  it('reports a missing id token instead of passing undefined on', async () => {
    mockGoogleSignIn.mockResolvedValue({ data: {} });

    const result = await signInWithGoogle();

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toEqual({ kind: 'error', message: 'Google did not return a sign-in token.' });
  });

  it('returns cancelled when the user dismisses the sheet', async () => {
    mockGoogleSignIn.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });

    const result = await signInWithGoogle();

    expect(result).toEqual({ ok: false, outcome: { kind: 'cancelled' } });
  });
});
