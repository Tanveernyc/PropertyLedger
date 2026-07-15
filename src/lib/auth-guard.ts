// Routing guard logic — pure functions, no React (spec §4 rule).
// app/_layout.tsx feeds these into <Stack.Protected>; tests exercise them directly.
import type { Session } from '@supabase/supabase-js';

/** Where unauthenticated users land. */
export const SIGN_IN_ROUTE = '/(auth)/sign-in' as const;
/** Where authenticated users land (the tab group's index = Dashboard). */
export const HOME_ROUTE = '/(tabs)' as const;

/** True when a Supabase session exists — the single predicate the router guards on. */
export function isSignedIn(session: Session | null | undefined): boolean {
  return session != null;
}

/** Resolves which route group a user may enter. Null/undefined session → sign-in. */
export function resolveInitialRoute(
  session: Session | null | undefined
): typeof SIGN_IN_ROUTE | typeof HOME_ROUTE {
  return isSignedIn(session) ? HOME_ROUTE : SIGN_IN_ROUTE;
}
