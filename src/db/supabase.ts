// Supabase client — the single client instance the whole app imports.
// Sessions persist across app restarts via AsyncStorage (Phase 2 auth relies on this).

// React Native lacks a full URL implementation; supabase-js needs this polyfill first.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// EXPO_PUBLIC_* vars are inlined into the client bundle at build time (safe: anon key only,
// RLS protects the data — see supabase/schema.sql). Values come from .env, shape from .env.example.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Fail loudly at startup instead of producing confusing network errors later.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration: set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example), then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // persist the session on-device
    autoRefreshToken: true, // refresh JWTs in the background while the app is open
    persistSession: true,
    detectSessionInUrl: false, // no OAuth redirect URLs in a native app
  },
});
