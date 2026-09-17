// Phase 13 tests — the delete confirmation screen. The button must stay
// disabled until the word is typed, and a failed delete must surface the error
// rather than leaving the user with a silent no-op.
jest.mock('../src/db/account', () => ({ deleteAccount: jest.fn() }));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import DeleteAccountScreen from '../app/delete-account';
import { deleteAccount } from '../src/db/account';

const mockDeleteAccount = deleteAccount as jest.Mock;

beforeEach(() => {
  mockDeleteAccount.mockReset();
  mockDeleteAccount.mockResolvedValue({ error: null });
});

describe('DeleteAccountScreen', () => {
  it('disables the button until the confirmation word is typed', async () => {
    const { getByTestId } = await render(<DeleteAccountScreen />);
    expect(getByTestId('delete-button').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(getByTestId('confirmation-input'), 'DELE');
    expect(getByTestId('delete-button').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(getByTestId('confirmation-input'), 'DELETE');
    expect(getByTestId('delete-button').props.accessibilityState.disabled).toBe(false);
  });

  it('does not call deleteAccount while the button is disabled', async () => {
    const { getByTestId } = await render(<DeleteAccountScreen />);
    await fireEvent.press(getByTestId('delete-button'));
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('calls deleteAccount once confirmed', async () => {
    const { getByTestId } = await render(<DeleteAccountScreen />);
    await fireEvent.changeText(getByTestId('confirmation-input'), 'DELETE');
    await fireEvent.press(getByTestId('delete-button'));
    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
  });

  it('shows the error and stays put when the delete fails', async () => {
    mockDeleteAccount.mockResolvedValue({ error: 'Network unreachable' });
    const { getByTestId, getByText } = await render(<DeleteAccountScreen />);
    await fireEvent.changeText(getByTestId('confirmation-input'), 'DELETE');
    await fireEvent.press(getByTestId('delete-button'));
    await waitFor(() => expect(getByText('Network unreachable')).toBeTruthy());
  });
});
