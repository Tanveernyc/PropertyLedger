// Type-to-confirm guard for permanent account deletion (Phase 13).
// Pure logic so the destructive path is testable without rendering or network.

/** The word the user must type to unlock the delete button. */
export const CONFIRM_WORD = 'DELETE';

/**
 * True when the typed text confirms deletion. Compared case-insensitively after
 * trimming: mobile keyboards autocapitalize, and rejecting "delete" would read
 * as a bug rather than a safeguard.
 */
export function isDeleteConfirmed(input: string): boolean {
  return input.trim().toUpperCase() === CONFIRM_WORD;
}
