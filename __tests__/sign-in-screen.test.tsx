// The provider buttons must appear only where they work, must not turn a
// cancelled sheet into an error, and must not fire twice on a double tap.
jest.mock('../src/lib/social-auth', () => ({
  configureGoogleSignIn: jest.fn(),
  isAppleSignInAvailable: jest.fn().mockResolvedValue(true),
  isGoogleSignInConfigured: jest.fn().mockReturnValue(true),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
}));
jest.mock('../src/db/supabase', () => ({
  supabase: { auth: { signInWithPassword: jest.fn(), signUp: jest.fn() } },
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SignInScreen from '../app/(auth)/sign-in';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
} from '../src/lib/social-auth';

const mockApple = signInWithApple as jest.Mock;
const mockGoogle = signInWithGoogle as jest.Mock;
const mockAvailable = isAppleSignInAvailable as jest.Mock;
const mockConfigured = isGoogleSignInConfigured as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAvailable.mockResolvedValue(true);
  mockConfigured.mockReturnValue(true);
  mockApple.mockResolvedValue({ ok: true });
  mockGoogle.mockResolvedValue({ ok: true });
});

describe('SignInScreen provider buttons', () => {
  it('shows both buttons when both providers are usable', async () => {
    const { getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('apple-sign-in')).toBeTruthy());
    expect(getByTestId('google-sign-in')).toBeTruthy();
  });

  it('hides the Apple button where Sign in with Apple is unavailable', async () => {
    mockAvailable.mockResolvedValue(false);
    const { queryByTestId, getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    expect(queryByTestId('apple-sign-in')).toBeNull();
  });

  it('hides the Google button when the client ids are missing', async () => {
    mockConfigured.mockReturnValue(false);
    const { queryByTestId, getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('apple-sign-in')).toBeTruthy());
    expect(queryByTestId('google-sign-in')).toBeNull();
  });

  it('keeps the email form usable with no provider available', async () => {
    mockAvailable.mockResolvedValue(false);
    mockConfigured.mockReturnValue(false);
    const { getByLabelText, queryByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByLabelText('Email')).toBeTruthy());
    expect(queryByTestId('apple-sign-in')).toBeNull();
    expect(queryByTestId('google-sign-in')).toBeNull();
  });

  it('shows nothing when the user cancels the sheet', async () => {
    mockGoogle.mockResolvedValue({ ok: false, outcome: { kind: 'cancelled' } });
    const { getByTestId, queryByText } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(mockGoogle).toHaveBeenCalled());
    expect(queryByText(/failed|error/i)).toBeNull();
  });

  it('shows a real provider failure', async () => {
    mockGoogle.mockResolvedValue({ ok: false, outcome: { kind: 'error', message: 'bad audience' } });
    const { getByTestId, getByText } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(getByText('bad audience')).toBeTruthy());
  });

  it('replaces a previous error rather than stacking messages', async () => {
    mockGoogle
      .mockResolvedValueOnce({ ok: false, outcome: { kind: 'error', message: 'first problem' } })
      .mockResolvedValueOnce({ ok: false, outcome: { kind: 'error', message: 'second problem' } });
    const { getByTestId, getByText, queryByText } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(getByText('first problem')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(getByText('second problem')).toBeTruthy());
    expect(queryByText('first problem')).toBeNull();
  });

  it('does not start a second sign-in while one is in flight', async () => {
    let resolveIt: (v: unknown) => void = () => {};
    mockGoogle.mockReturnValue(new Promise((r) => { resolveIt = r; }));
    const { getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await fireEvent.press(getByTestId('google-sign-in'));
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    resolveIt({ ok: true });
  });
});
