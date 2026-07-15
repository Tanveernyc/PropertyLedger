// Phase 1 tests — src/db/supabase.ts (spec §5 Phase 1).
// The module reads env at import time, so each case re-imports it with jest.resetModules().

const ORIGINAL_ENV = process.env;

// Import the module fresh under the current process.env.
const importSupabaseModule = () => require('../src/db/supabase');

describe('supabase client (src/db/supabase.ts)', () => {
  beforeEach(() => {
    jest.resetModules(); // clear the module cache so import-time env checks re-run
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV; // restore the real env for other suites
  });

  it('throws a clear error when both env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    expect(importSupabaseModule).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(importSupabaseModule).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('throws when only the URL is set (anon key missing)', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    expect(importSupabaseModule).toThrow(/Missing Supabase configuration/);
  });

  it('throws when only the anon key is set (URL missing)', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    expect(importSupabaseModule).toThrow(/Missing Supabase configuration/);
  });

  it('exports a configured client when both env vars are present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    const { supabase } = importSupabaseModule();
    expect(supabase).toBeDefined();
    // Spot-check the client surface the app will use.
    expect(typeof supabase.from).toBe('function');
    expect(supabase.auth).toBeDefined();
  });
});
