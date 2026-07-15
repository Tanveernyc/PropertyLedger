// Deletion confirmation — deletes must never fire without explicit confirmation
// (spec §5 Phase 7). The Alert implementation is injectable so tests can drive it.
import { Alert, type AlertButton } from 'react-native';

type AlertImpl = (title: string, message?: string, buttons?: AlertButton[]) => void;

/**
 * Shows a Cancel/Delete confirmation; onConfirm runs ONLY when Delete is pressed.
 */
export function confirmDelete(
  title: string,
  message: string,
  onConfirm: () => void,
  alertImpl: AlertImpl = Alert.alert
): void {
  alertImpl(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
