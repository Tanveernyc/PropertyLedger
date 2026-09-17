# Account Deletion — Design

Date: 2026-09-17 · Status: approved, not yet implemented

## Why

App Store Review Guideline 5.1.1(v) requires any app offering account creation to
let users start account deletion from inside the app. PropertyLedger currently
offers Sign out only (`app/(tabs)/index.tsx:54`). This blocks submission for
review of v1.0.0.

## Decisions

| Decision | Choice | Rejected |
|---|---|---|
| Delete model | Immediate and permanent | 30-day grace period; export-then-delete |
| Confirmation | Type `DELETE` to enable the button | Password re-entry; stacked native alerts |
| Mechanism | Supabase Edge Function | Postgres `SECURITY DEFINER` RPC; client-side rows-only |

Immediate deletion matches what `schema.sql` already does via `ON DELETE
CASCADE` and needs no new columns, scheduled jobs, or RLS changes.

Type-to-confirm works offline, involves no password handling, survives a future
move to OAuth or magic-link sign-in, and is pure logic — so it can be unit
tested without rendering.

The Edge Function uses Supabase's supported `auth.admin.deleteUser` API. The
RPC alternative would have written directly to the `auth.users` table, which
Supabase owns and may reshape.

Client-side rows-only deletion was rejected outright: it leaves the auth user
alive, so it does not satisfy the guideline that motivated the work.

## Architecture

Four units, each usable and testable on its own.

### 1. `supabase/functions/delete-account/index.ts`

Deno Edge Function. The project's first.

- Reads the `Authorization: Bearer <jwt>` header. Missing or malformed → 401.
- Resolves the JWT to a user with an anon-key client (`auth.getUser(jwt)`).
  Invalid or expired → 401.
- Calls `auth.admin.deleteUser(user.id)` with a service-role client.
- Returns 200 on success, 500 with a message on failure.

The user id comes from the verified token, never the request body. There is no
id parameter to tamper with, so the function cannot be induced to delete another
account.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions
by Supabase automatically — no secret configuration step.

### 2. `src/lib/delete-account.ts`

```ts
export function isDeleteConfirmed(input: string): boolean
```

Trims, uppercases, compares to `DELETE`. Uppercasing means phone
autocapitalization does not fight the user, and `delete` is accepted alongside
`DELETE`. No imports; no I/O.

### 3. `src/db/account.ts`

```ts
export async function deleteAccount(): Promise<{ error: string | null }>
```

Invokes the Edge Function, then signs out **only when the function succeeded**.
A failed delete must leave the session intact so the user sees an error rather
than being silently signed out of an account that still exists.

### 4. `app/delete-account.tsx`

Screen stating exactly what will be destroyed, a text field for the
confirmation word, and a destructive-styled button disabled until
`isDeleteConfirmed` passes. Errors render inline. A spinner covers the in-flight
request and the button stays disabled while it runs, so a double tap cannot fire
two deletes.

Entry point: a "Delete account" link beside Sign out in `app/(tabs)/index.tsx`.

## Data flow

```
confirm
  → deleteAccount()
  → POST /functions/v1/delete-account  (Authorization: user JWT)
  → auth.admin.deleteUser(user.id)
  → Postgres cascades from auth.users:
       properties → expenses, income (via property cascade)
       categories (user rows only; system rows have user_id NULL)
  → client signOut()
  → SessionProvider receives onAuthStateChange(null)
  → root layout guard routes to (auth)/sign-in
```

Navigation is a consequence of the session going null. The screen never routes
manually.

No migration: every cascade this depends on already exists in `schema.sql`.

## Error handling

| Failure | Behaviour |
|---|---|
| No active session | Inline error; user stays put |
| Network failure reaching the function | Inline error; still signed in; retryable |
| Function returns non-2xx | Inline error carrying the server message |
| `signOut()` fails after a successful delete | Ignored — the account is gone and the token is dead; the auth listener routes away regardless |

The governing rule: never sign out unless the delete actually succeeded.

## Testing

Test-driven, three layers.

**Unit — `__tests__/delete-account.test.ts`**
`isDeleteConfirmed` against: exact `DELETE`, lowercase, leading/trailing
whitespace, empty string, partial (`DELE`), and a longer string containing the
word (`DELETE ME` → false).

**Mocked — `__tests__/account-db.test.ts`**
With `supabase.functions.invoke` and `supabase.auth.signOut` stubbed: success
invokes both in order; a function error invokes `signOut` **zero** times and
returns the message. This is the regression guard for the governing rule above.

**Live E2E**
Create a throwaway user, seed one property and one expense, call the deployed
function with that user's JWT, then verify with a service-role client that the
auth user is gone and no rows survive in any of the four tables.

## Out of scope

- Grace period, undo, or any recovery path
- Forcing a CSV export before deletion
- Deleting the user's Supabase Storage objects — the app stores no files
- An account settings screen; the link lives beside Sign out

## Deployment

`supabase functions deploy delete-account` against project
`dxjwyaldmxquuztmnrsb`. Requires a Supabase CLI session, which may need a real
terminal. Until deployed, the screen exists but every attempt returns an error —
so deploy before the next production build.
