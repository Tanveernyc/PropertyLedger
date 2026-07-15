// Phase 2 tests — routing guard (spec §5 Phase 2):
// a null session must be sent to sign-in; a live session goes to the app tabs.
import type { Session } from '@supabase/supabase-js';
import { HOME_ROUTE, SIGN_IN_ROUTE, isSignedIn, resolveInitialRoute } from '../src/lib/auth-guard';

// Only the presence of the object matters to the guard; a minimal stub suffices.
const fakeSession = { user: { id: 'user-1' } } as unknown as Session;

describe('isSignedIn', () => {
  it('is false for null and undefined sessions', () => {
    expect(isSignedIn(null)).toBe(false);
    expect(isSignedIn(undefined)).toBe(false);
  });

  it('is true for a real session', () => {
    expect(isSignedIn(fakeSession)).toBe(true);
  });
});

describe('resolveInitialRoute', () => {
  it('sends null-session users to sign-in', () => {
    expect(resolveInitialRoute(null)).toBe(SIGN_IN_ROUTE);
  });

  it('sends authenticated users to the tab group', () => {
    expect(resolveInitialRoute(fakeSession)).toBe(HOME_ROUTE);
  });
});
