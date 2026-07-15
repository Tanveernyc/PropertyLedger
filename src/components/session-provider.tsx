// Supabase session context — restores the persisted session on launch and tracks
// auth changes. Everything below the root layout reads auth state through useSession().
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/db/supabase';

interface SessionState {
  /** Null when signed out; a Supabase session when signed in. */
  session: Session | null;
  /** True until the persisted session has been read from AsyncStorage. */
  isLoading: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

/** Read the current auth state anywhere in the app. */
export function useSession(): SessionState {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    // Initial restore from AsyncStorage (why sessions survive app restarts).
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, isLoading: false });
    });
    // Live updates: sign-in, sign-out, token refresh all flow through here.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoading: false });
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
