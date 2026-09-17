// Account deletion (Phase 13). The privileged work happens in the
// delete-account Edge Function; this module is the client half.
import { supabase } from './supabase';

/**
 * Permanently deletes the signed-in user and every row they own, then signs out.
 *
 * Sign-out happens only after the delete succeeds — a failed delete must leave
 * the session intact so the user sees an error instead of being quietly logged
 * out of an account that still exists.
 */
export async function deleteAccount(): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    return { error: error.message || 'Could not delete your account. Please try again.' };
  }

  // The account is gone; a failure here only means the dead token could not be
  // cleared cleanly. The auth listener routes to sign-in either way.
  try {
    await supabase.auth.signOut();
  } catch {
    // intentionally ignored
  }

  return { error: null };
}
