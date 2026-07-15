// Phase 7 tests — delete requires confirmation (spec §5 Phase 7).
import type { AlertButton } from 'react-native';
import { confirmDelete } from '../src/lib/confirm-delete';

describe('confirmDelete', () => {
  it('does not delete until the Delete button is pressed', () => {
    const onConfirm = jest.fn();
    let capturedButtons: AlertButton[] = [];
    const fakeAlert = (_t: string, _m?: string, buttons?: AlertButton[]) => {
      capturedButtons = buttons ?? [];
    };

    confirmDelete('Delete?', 'sure?', onConfirm, fakeAlert);

    // Alert shown, nothing deleted yet.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(capturedButtons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);

    // Pressing Delete fires the deletion exactly once.
    capturedButtons.find((b) => b.text === 'Delete')!.onPress!();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel never triggers the deletion', () => {
    const onConfirm = jest.fn();
    let capturedButtons: AlertButton[] = [];
    confirmDelete('Delete?', 'sure?', onConfirm, (_t, _m, buttons) => {
      capturedButtons = buttons ?? [];
    });

    const cancel = capturedButtons.find((b) => b.text === 'Cancel')!;
    cancel.onPress?.(); // Cancel has no onPress — optional chain proves it is inert
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
