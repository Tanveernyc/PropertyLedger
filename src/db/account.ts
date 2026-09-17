// Account deletion (Phase 13). The privileged work happens in the
// delete-account Edge Function; this module is the client half.
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

const GENERIC_ERROR = 'Could not delete your account. Please try again.';
const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';

/**
 * Maps a functions.invoke() error to user-facing copy. @supabase/functions-js
 * always populates `error.message` with its own SDK-internal wording (e.g.
 * "Edge Function returned a non-2xx status code"), so passing `message`
 * straight through would leak jargon onto a destructive confirmation screen.
 * We map by error class instead and ignore `message` entirely.
 */
function toUserFacingError(error: unknown): string {
  if (error instanceof FunctionsFetchError) {
    return NETWORK_ERROR;
  }
  if (error instanceof FunctionsHttpError) {
    return GENERIC_ERROR;
  }
  return GENERIC_ERROR;
}

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
    return { error: toUserFacingError(error) };
  }

  // The account is gone; a failure here only means the dead token could not be
  // cleared cleanly. `scope: 'local'` never contacts the server — it only
  // clears the persisted session — so it always succeeds even if the delete
  // itself left the server unreachable or erroring. Never use the default
  // 'global' scope here: on non-401/403/404 server errors it returns
  // { error } without clearing local storage, which would strand the user on
  // a dead session pointing at an account that no longer exists.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // intentionally ignored
  }

  return { error: null };
}
