# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user permanently delete their account and all their data from inside the app, satisfying App Store Review Guideline 5.1.1(v).

**Architecture:** A Supabase Edge Function holds the service-role key and calls `auth.admin.deleteUser` for the caller identified by their JWT. Postgres `ON DELETE CASCADE` (already in `supabase/schema.sql`) removes every owned row. The client confirms intent with a type-to-confirm screen, then signs out only after the delete succeeds; `SessionProvider` sees the null session and the root layout guard routes to sign-in.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, TypeScript, Supabase (supabase-js v2, Deno Edge Functions), Jest + @testing-library/react-native.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-09-17-account-deletion-design.md`
- Deletion is immediate and permanent. No grace period, no undo, no soft-delete column.
- Confirmation word is `DELETE`, matched after `.trim().toUpperCase()` — `delete` is accepted.
- **Never sign out unless the delete actually succeeded.** This is the core invariant; Task 3 has a test that exists solely to guard it.
- No database migration. Every cascade already exists in `supabase/schema.sql`.
- The user id must come from the verified JWT, never from a request body or parameter.
- Import alias is `@/` → `src/` (see `package.json` `jest.moduleNameMapper` and `tsconfig.json`).
- Jest tests must stay hermetic and offline. Live verification is a manual step, not a committed test.
- Run `npm test` and `npx tsc --noEmit` before every commit.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/delete-account.ts` (create) | Pure confirmation-word check. No imports, no I/O. |
| `src/db/account.ts` (create) | Invokes the Edge Function; signs out on success only. |
| `supabase/functions/delete-account/index.ts` (create) | Deno function; verifies JWT, deletes that user with service-role. |
| `app/delete-account.tsx` (create) | Confirmation screen. |
| `app/_layout.tsx` (modify) | Register the route inside the signed-in guard. |
| `app/(tabs)/index.tsx` (modify) | "Delete account" link in the footer. |
| `__tests__/delete-account.test.ts` (create) | Unit tests for the confirmation check. |
| `__tests__/account-db.test.ts` (create) | Mocked tests for `deleteAccount`, including the invariant guard. |

---

### Task 1: Confirmation-word logic

**Files:**
- Create: `src/lib/delete-account.ts`
- Test: `__tests__/delete-account.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `isDeleteConfirmed(input: string): boolean` and `CONFIRM_WORD: string` (the literal `'DELETE'`, imported by Task 4 for its label and placeholder)

- [ ] **Step 1: Write the failing test**

Create `__tests__/delete-account.test.ts`:

```ts
// Phase 13 tests — the type-to-confirm check guarding permanent account deletion.
import { isDeleteConfirmed } from '../src/lib/delete-account';

describe('isDeleteConfirmed', () => {
  it('accepts the exact word', () => {
    expect(isDeleteConfirmed('DELETE')).toBe(true);
  });

  it('accepts lowercase so phone autocapitalization does not fight the user', () => {
    expect(isDeleteConfirmed('delete')).toBe(true);
    expect(isDeleteConfirmed('Delete')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isDeleteConfirmed('  DELETE  ')).toBe(true);
  });

  it('rejects an empty or whitespace-only field', () => {
    expect(isDeleteConfirmed('')).toBe(false);
    expect(isDeleteConfirmed('   ')).toBe(false);
  });

  it('rejects a partial word', () => {
    expect(isDeleteConfirmed('DELE')).toBe(false);
  });

  it('rejects a string that merely contains the word', () => {
    expect(isDeleteConfirmed('DELETE ME')).toBe(false);
    expect(isDeleteConfirmed('undelete')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/delete-account.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/delete-account'`

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/delete-account.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/delete-account.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc silent; 115 tests passing (109 existing + 6 new)

- [ ] **Step 6: Commit**

```bash
git add src/lib/delete-account.ts __tests__/delete-account.test.ts
git commit -m "phase-13: type-to-confirm check for account deletion"
```

---

### Task 2: Edge Function

**Files:**
- Create: `supabase/functions/delete-account/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: an HTTP endpoint at `/functions/v1/delete-account`. Accepts `POST` with header `Authorization: Bearer <user jwt>`. Returns `200 {"ok":true}`, `401 {"error":string}`, `405 {"error":string}`, or `500 {"error":string}`.

There is no Jest coverage for this file — it runs on Deno, not in the React
Native bundle. It is verified live in Task 3, Step 7.

- [ ] **Step 1: Write the function**

Create `supabase/functions/delete-account/index.ts`:

```ts
// Permanently deletes the calling user's account (Phase 13).
//
// The caller is identified solely by their JWT — there is no id parameter, so
// this endpoint cannot be induced to delete anyone else. Deleting the auth user
// cascades through properties, categories, expenses, and income via the foreign
// keys in supabase/schema.sql.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are injected
// into Edge Functions by Supabase; none of them is configured by hand.
import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401);
  }
  const jwt = authHeader.slice('Bearer '.length);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) {
    return json({ error: 'Function is misconfigured' }, 500);
  }

  // Resolve the token to a user with the anon key — never trust the body.
  const caller = createClient(url, anonKey);
  const { data, error } = await caller.auth.getUser(jwt);
  if (error || !data.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Service-role client is the only thing that may delete an auth user.
  const admin = createClient(url, serviceRoleKey);
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    return json({ error: deleteError.message }, 500);
  }

  return json({ ok: true }, 200);
});
```

- [ ] **Step 2: Deploy the function**

Run: `npx supabase functions deploy delete-account --project-ref dxjwyaldmxquuztmnrsb`

Expected: `Deployed Functions on project dxjwyaldmxquuztmnrsb: delete-account`

If this fails with an authentication error, the Supabase CLI needs a session.
`npx supabase login` requires a real terminal (a TTY) — the same constraint that
applied to the Apple credential steps. Hand this step to the user rather than
retrying it non-interactively.

- [ ] **Step 3: Confirm it rejects an unauthenticated call**

Run:

```bash
node -e "fetch('https://dxjwyaldmxquuztmnrsb.supabase.co/functions/v1/delete-account',{method:'POST'}).then(r=>r.status).then(console.log)"
```

Expected: `401` — proof the endpoint is live and refuses callers without a token.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/delete-account/index.ts
git commit -m "phase-13: edge function deleting the calling user's account"
```

---

### Task 3: Client data-access module

**Files:**
- Create: `src/db/account.ts`
- Test: `__tests__/account-db.test.ts`

**Interfaces:**
- Consumes: the `/functions/v1/delete-account` endpoint from Task 2
- Produces: `deleteAccount(): Promise<{ error: string | null }>` — `{ error: null }` on success, `{ error: message }` on failure

- [ ] **Step 1: Write the failing test**

Create `__tests__/account-db.test.ts`:

```ts
// Phase 13 tests — src/db/account.ts with a mocked Supabase client.
// The invariant under test: never sign out unless the delete actually succeeded.
jest.mock('../src/db/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    auth: { signOut: jest.fn() },
  },
}));

import { supabase } from '../src/db/supabase';
import { deleteAccount } from '../src/db/account';

const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;

beforeEach(() => {
  mockInvoke.mockReset();
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue({ error: null });
});

describe('deleteAccount', () => {
  it('calls the delete-account function', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await deleteAccount();
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
  });

  it('signs out after a successful delete', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    const result = await deleteAccount();
    expect(result).toEqual({ error: null });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('does NOT sign out when the delete fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const result = await deleteAccount();
    expect(result).toEqual({ error: 'boom' });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('reports a readable message when the error carries none', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: {} });
    const result = await deleteAccount();
    expect(result.error).toBe('Could not delete your account. Please try again.');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('still reports success when sign-out fails, since the account is gone', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    mockSignOut.mockRejectedValue(new Error('token already dead'));
    const result = await deleteAccount();
    expect(result).toEqual({ error: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/account-db.test.ts`
Expected: FAIL — `Cannot find module '../src/db/account'`

- [ ] **Step 3: Write the minimal implementation**

Create `src/db/account.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/account-db.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc silent; 120 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/db/account.ts __tests__/account-db.test.ts
git commit -m "phase-13: deleteAccount — invoke function, sign out on success only"
```

- [ ] **Step 7: Verify live against the deployed function**

This is a manual one-off, not a committed test — it creates and destroys a real
user. Requires Task 2 to be deployed.

Run:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);
const email = 'delete-test-' + Date.now() + '@example.com';
const password = 'TestPassword123!';
(async () => {
  const { data: signUp, error: signUpErr } = await sb.auth.signUp({ email, password });
  if (signUpErr) throw signUpErr;
  console.log('created user', signUp.user.id);

  const { error: propErr } = await sb.from('properties').insert({
    user_id: signUp.user.id, name: 'Throwaway', property_type: 'rental',
  });
  if (propErr) throw propErr;
  console.log('seeded one property');

  const { error: fnErr } = await sb.functions.invoke('delete-account', { method: 'POST' });
  if (fnErr) throw fnErr;
  console.log('function returned ok');

  const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
  console.log('sign-in after delete:', signInErr ? 'REJECTED — account gone' : 'SUCCEEDED — BUG');
})();
"
```

Run it with the env vars loaded: `set -a && source .env && set +a && node -e '...'`

Expected final line: `sign-in after delete: REJECTED — account gone`

Sign-in failing proves the auth user is gone. Row removal follows from the
`ON DELETE CASCADE` constraints in `supabase/schema.sql` and needs no separate
check (verifying it directly would require a service-role key, which is
deliberately absent from this repo).

---

### Task 4: Confirmation screen and entry point

**Files:**
- Create: `app/delete-account.tsx`
- Modify: `app/_layout.tsx:33` (add a `Stack.Screen` after the `export` entry)
- Modify: `app/(tabs)/index.tsx:47-57` (footer links) and `:75` (footer link styles)

**Interfaces:**
- Consumes: `isDeleteConfirmed` (Task 1), `deleteAccount` (Task 3)
- Produces: the route `/delete-account`

- [ ] **Step 1: Write the screen**

Create `app/delete-account.tsx`:

```tsx
// Account deletion confirmation (Phase 13). Required by App Store Review
// Guideline 5.1.1(v). Deletion is immediate and permanent; the typed word is
// the only thing standing between a tap and unrecoverable data loss.
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { deleteAccount } from '@/db/account';
import { CONFIRM_WORD, isDeleteConfirmed } from '@/lib/delete-account';

export default function DeleteAccountScreen() {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canDelete = isDeleteConfirmed(confirmation) && !submitting;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: deleteError } = await deleteAccount();
    if (deleteError) {
      setSubmitting(false);
      setError(deleteError);
      return;
    }
    // Success: the session is gone, SessionProvider fires, and the root layout
    // guard routes to sign-in. Deliberately no setState here — this screen is
    // already unmounting.
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Delete your account</Text>

      <Text style={styles.body}>This permanently deletes:</Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• Every property you have added</Text>
        <Text style={styles.listItem}>• Every expense and income record</Text>
        <Text style={styles.listItem}>• Your custom categories</Text>
        <Text style={styles.listItem}>• Your sign-in credentials</Text>
      </View>

      <Text style={styles.warning}>
        This cannot be undone and there is no way to recover your records afterwards. Export your
        data first if you want to keep a copy.
      </Text>

      <Text style={styles.label}>Type {CONFIRM_WORD} to confirm</Text>
      <TextInput
        testID="confirmation-input"
        style={styles.input}
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!submitting}
        placeholder={CONFIRM_WORD}
        placeholderTextColor="#bbb"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        testID="delete-button"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canDelete }}
        disabled={!canDelete}
        onPress={submit}
        style={[styles.button, !canDelete && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Delete my account</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heading: { fontSize: 20, fontWeight: '700', color: '#111' },
  body: { fontSize: 15, color: '#333' },
  list: { gap: 4, paddingLeft: 4 },
  listItem: { fontSize: 15, color: '#333' },
  warning: { fontSize: 14, color: '#c0392b', lineHeight: 20 },
  label: { fontSize: 13, color: '#666', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  error: { color: '#c0392b', fontSize: 14 },
  button: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: '#e2b3ad' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Register the route**

In `app/_layout.tsx`, add this line immediately after the `export` screen
(currently line 33), still inside `<Stack.Protected guard={signedIn}>`:

```tsx
        <Stack.Screen name="delete-account" options={{ title: 'Delete Account' }} />
```

- [ ] **Step 3: Add the entry point**

In `app/(tabs)/index.tsx`, add a link after the Sign out `Pressable` (currently
lines 54-56), inside the `footerLinks` view:

```tsx
          <Link href="/delete-account" style={styles.signOut}>
            Delete account
          </Link>
```

Then let the footer wrap, since this makes four items. Change the `footerLinks`
style (currently line 75) to:

```tsx
  footerLinks: { flexDirection: 'row', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: silent

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 120 tests passing, no regressions in `__tests__/dashboard.test.tsx`
(that suite renders the dashboard, which this task modifies)

- [ ] **Step 6: Commit**

```bash
git add app/delete-account.tsx app/_layout.tsx "app/(tabs)/index.tsx"
git commit -m "phase-13: delete account screen, route, and dashboard entry point"
```

- [ ] **Step 7: Verify in the running app**

Run: `npm start`

Check, in order:
1. The dashboard footer shows "Delete account" beside Sign out
2. Tapping it opens a screen titled "Delete Account"
3. The button is visibly disabled with the field empty
4. Typing `DELE` leaves it disabled
5. Typing `DELETE` enables it
6. Tapping it on a throwaway account returns you to the sign-in screen
7. Signing back in with those credentials fails

---

## Done when

- `npm test` passes with 120 tests
- `npx tsc --noEmit` is silent
- The Edge Function is deployed and returns 401 to an unauthenticated POST
- The live check in Task 3 Step 7 prints `REJECTED — account gone`
- A user can reach deletion from the dashboard in two taps plus a typed word

## Follow-up, not in this plan

A new production build and App Store submission are needed before this reaches
review — build 16 is already in TestFlight without it. Those are tracked in
`docs/app-store-listing.md` alongside the remaining listing blockers (iPad
screenshots, demo account, support URL).
