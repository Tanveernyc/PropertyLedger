// Backing out of a provider sheet is a decision, not a failure: it must leave
// the screen silent. Everything else has to say something the user can act on.
export type ProviderOutcome = { kind: 'cancelled' } | { kind: 'error'; message: string };

// Apple: ERR_REQUEST_CANCELED. Google: SIGN_IN_CANCELLED, or the raw iOS code -5.
const CANCELLED_CODES = new Set(['ERR_REQUEST_CANCELED', 'SIGN_IN_CANCELLED', '-5']);

export function classifyProviderError(error: unknown): ProviderOutcome {
  // The Google SDK may hand back -5 as a number rather than a string.
  const code = (error as { code?: unknown } | null)?.code;
  if ((typeof code === 'string' || typeof code === 'number') && CANCELLED_CODES.has(String(code))) {
    return { kind: 'cancelled' };
  }

  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message.trim().length > 0) {
    return { kind: 'error', message };
  }
  return { kind: 'error', message: 'Sign-in failed. Please try again.' };
}
