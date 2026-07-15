// Sign-in/sign-up form validation — pure functions, no React, no network (spec §4 rule).
// Phase 2 tests: empty email rejected, malformed email rejected, password < 6 rejected.

/** Minimum password length enforced by the form (matches Supabase's default). */
export const MIN_PASSWORD_LENGTH = 6;

// Deliberately simple shape check (something@something.tld) — the real arbiter is
// Supabase Auth; this only catches obvious typos before a network round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message for a bad email, or undefined when acceptable. */
export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (trimmed.length === 0) return 'Email is required.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  return undefined;
}

/** Returns an error message for a bad password, or undefined when acceptable. */
export function validatePassword(password: string): string | undefined {
  if (password.length === 0) return 'Password is required.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

export interface SignInValidation {
  valid: boolean;
  errors: { email?: string; password?: string };
}

/** Validates the whole form at once; the screen shows per-field errors from this. */
export function validateSignIn(email: string, password: string): SignInValidation {
  const errors: SignInValidation['errors'] = {};
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  return { valid: !emailError && !passwordError, errors };
}
