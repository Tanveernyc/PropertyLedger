# Sign in with Apple and Google Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-tap *Continue with Apple* and *Continue with Google* to the sign-in screen, using native OS sheets exchanged for a Supabase session, without disturbing the existing email/password path.

**Architecture:** Both providers hand the app an ID token, which `supabase.auth.signInWithIdToken` swaps for a session; the existing `SessionProvider` + root-layout guards then route exactly as they do for a password sign-in. Provider-specific SDK calls live behind one module (`src/lib/social-auth.ts`, network-free apart from the SDK calls it delegates to) so the screen only ever sees "signed in" or "this error"; the nonce pair and the cancelled-vs-real error decision are pure functions with their own tests.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, TypeScript, `@supabase/supabase-js`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `expo-crypto`, Jest + jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-22-social-sign-in-design.md`

## Global Constraints

- Ships as **1.2, after App Store version 1.0 is approved**. Do not bump `app.json` version and do not start a production build in this plan (spec header).
- Sign-up stays **instant**: email confirmation remains off in Supabase; no app code depends on a confirmation step (spec §4).
- Identity linking is Supabase's automatic behaviour — **no linking code** is written (spec §4).
- Native flows only. No `signInWithOAuth`, no browser redirect, no Services ID, no `.p8` secret (spec §3).
- Apple: the nonce passed to `signInAsync` is the **SHA-256 hash** of the raw nonce; the **raw** nonce goes to Supabase (spec §3).
- Apple returns `fullName` only on first authorization; when present, persist it via `supabase.auth.updateUser({ data: { full_name } })`. Nothing displays it today (spec §3).
- A cancelled sheet is **not an error**: Apple `ERR_REQUEST_CANCELED`, Google `SIGN_IN_CANCELLED` return silently; every other failure shows in the existing `authError` line (spec §5).
- Buttons render only when the provider is usable; with neither available the screen is byte-for-byte today's screen (spec §5).
- Every file under `src/lib/` keeps zero React imports. `src/lib/social-auth.ts` may import the provider SDKs and the Supabase client — it is the boundary module — but holds no JSX and no component state.
- `npm test` and `npx tsc --noEmit` clean at the end of every task. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Out of scope: Microsoft/Facebook providers, phone or magic-link sign-in, unlinking identities, showing name or avatar, Android specifics (spec §9).

## Review Focus

Five input classes the spec implies but that no task's happy path exercises. Each has a test pinned to the task that owns the code.

1. **Apple returns a null `identityToken`** (revoked credential, Keychain hiccup). Expected: a plain error message, not a crash on `token.substring` inside supabase-js. → Task 3.
2. **Google returns a success payload with no `idToken`** (the SDK's `data.idToken` is nullable when Play/keychain state is odd). Expected: same treatment as Apple's null token. → Task 3.
3. **The user taps a provider button twice before the first sheet resolves.** Expected: one sign-in attempt, not two overlapping sheets or two sessions. Pinned by an **Apple**-button double-tap test, which genuinely exercises the `useRef` single-flight guard — `AppleAuthenticationButton` takes no `disabled` prop, so the guard is all that stops the second press. → Task 4.
4. **Apple's `fullName` persists but `updateUser` fails** (offline right after the token exchange). Expected: the user is still signed in; the name is simply not stored. Covered for both failure shapes: a thrown rejection *and* a resolved `{ error }`, which is what supabase-js actually returns for an auth failure. → Task 3.
5. **A provider error arrives while a previous password error is on screen.** Expected: a new attempt clears a stale error; a cancel adds none. → Task 4.

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/auth-nonce.ts` (create) | `createNoncePair()` — raw + SHA-256 hex, pure apart from `expo-crypto`. |
| `src/lib/social-auth-errors.ts` (create) | `classifyProviderError(e)` → `'cancelled' | 'message'` + text. Pure. |
| `src/lib/social-auth.ts` (create) | `signInWithApple()` / `signInWithGoogle()` / `configureGoogleSignIn()` — the only place the SDKs and `signInWithIdToken` are called. |
| `app/(auth)/sign-in.tsx` (modify) | Provider buttons above the form, availability checks, single-flight guard, error display. |
| `app.json` (modify) | `expo-apple-authentication` and `@react-native-google-signin/google-signin` plugins; `usesAppleSignIn`. |
| `package.json` (modify) | Three new dependencies via `npx expo install`. |
| `jest.setup.js` (modify) | Mock both native SDKs so the suite runs in Node. |
| `.env.example` (modify) | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. |
| `__tests__/auth-nonce.test.ts`, `__tests__/social-auth-errors.test.ts`, `__tests__/social-auth.test.ts`, `__tests__/sign-in-screen.test.tsx` (create) | Tests. |
| `docs/setup-social-sign-in.md` (create) | The click-by-click portal steps the owner performs. |
| `README.md`, `WORKLOG.md` (modify) | Docs. |

---

## Task 1: Dependencies, config plugins, Jest mocks

**Files:**
- Modify: `package.json`, `app.json`, `jest.setup.js`, `.env.example`

**Interfaces:**
- Produces: installed modules `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `expo-crypto`; Jest mocks for both native SDKs; env var names `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

- [ ] **Step 1: Install the modules**

```bash
cd /Users/riyad/OrganicHub/propertyledger
npx expo install expo-apple-authentication expo-crypto @react-native-google-signin/google-signin
```
Use `npx expo install` (not `npm install`) so versions match SDK 57.

- [ ] **Step 2: Register the config plugins**

In `app.json`, replace `"plugins": ["expo-router"]` with:
```json
    "plugins": [
      "expo-router",
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        { "iosUrlScheme": "com.googleusercontent.apps.PLACEHOLDER" }
      ]
    ],
```
and add `"usesAppleSignIn": true` inside the existing `"ios"` object (next to `"supportsTablet"`).

`PLACEHOLDER` is replaced in Task 6 with the real reversed iOS client ID once the owner has created it; until then the plugin still builds, it just cannot complete a Google sign-in.

- [ ] **Step 3: Document the env vars**

Append to `.env.example`:
```
# Google Sign-In client IDs (see docs/setup-social-sign-in.md).
# Neither is a secret: both are visible in any OAuth redirect and are restricted by bundle id.
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

- [ ] **Step 4: Mock the native SDKs for Jest**

Append to `jest.setup.js`:
```javascript
// Sign in with Apple is a native module; Jest gets a stub whose availability is
// off by default so screen tests opt in explicitly.
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  signInAsync: jest.fn(),
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// Google's SDK is native too; hasPlayServices resolves so the iOS path is exercised.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
}));
```

- [ ] **Step 5: Verify nothing regressed**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep -E 'Tests:|Suites:'`
Expected: tsc clean, same counts as before this task (206 tests / 28 suites).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json jest.setup.js .env.example
git commit -m "social auth: install Apple/Google SDKs, config plugins, Jest mocks"
```

---

## Task 2: Nonce pair and error classifier (pure)

**Files:**
- Create: `src/lib/auth-nonce.ts`, `src/lib/social-auth-errors.ts`
- Test: `__tests__/auth-nonce.test.ts`, `__tests__/social-auth-errors.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface NoncePair { raw: string; hashed: string }
  export async function createNoncePair(): Promise<NoncePair>;

  export type ProviderOutcome =
    | { kind: 'cancelled' }
    | { kind: 'error'; message: string };
  export function classifyProviderError(error: unknown): ProviderOutcome;
  ```

- [ ] **Step 1: Write the failing tests**

`__tests__/auth-nonce.test.ts`:
```typescript
// The Apple flow needs two forms of one nonce: the hash goes to Apple, the raw
// value goes to Supabase. Getting them the wrong way round fails at the server.
import { createNoncePair } from '../src/lib/auth-nonce';

describe('createNoncePair', () => {
  it('returns a raw nonce and its SHA-256 hex hash', async () => {
    const { raw, hashed } = await createNoncePair();
    expect(raw).toMatch(/^[0-9a-f]{32}$/);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toBe(raw);
  });

  it('is different every call', async () => {
    const a = await createNoncePair();
    const b = await createNoncePair();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hashed).not.toBe(b.hashed);
  });

  it('hashes the raw value it returns, not something else', async () => {
    const { raw, hashed } = await createNoncePair();
    const again = await require('expo-crypto').digestStringAsync('SHA-256', raw);
    expect(hashed).toBe(again);
  });
});
```

`__tests__/social-auth-errors.test.ts`:
```typescript
// A user who backs out of the Apple or Google sheet has not hit an error, and
// must not be shown one. Everything else must say something.
import { classifyProviderError } from '../src/lib/social-auth-errors';

describe('classifyProviderError', () => {
  it('treats an Apple cancellation as cancelled', () => {
    expect(classifyProviderError({ code: 'ERR_REQUEST_CANCELED' })).toEqual({ kind: 'cancelled' });
  });

  it('treats a Google cancellation as cancelled', () => {
    expect(classifyProviderError({ code: 'SIGN_IN_CANCELLED' })).toEqual({ kind: 'cancelled' });
    expect(classifyProviderError({ code: '-5' })).toEqual({ kind: 'cancelled' });
  });

  it('passes a real error message through', () => {
    expect(classifyProviderError(new Error('network down'))).toEqual({
      kind: 'error',
      message: 'network down',
    });
  });

  it('never returns an empty message', () => {
    for (const weird of [undefined, null, {}, '', 0]) {
      const out = classifyProviderError(weird);
      expect(out.kind).toBe('error');
      if (out.kind === 'error') expect(out.message.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest __tests__/auth-nonce.test.ts __tests__/social-auth-errors.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement both modules**

`src/lib/auth-nonce.ts`:
```typescript
// Apple wants the SHA-256 of a nonce; Supabase wants the same nonce raw, so it
// can verify Apple hashed what we claim. Both come from one call to avoid the
// classic bug of hashing a different string than the one sent on.
import * as Crypto from 'expo-crypto';

export interface NoncePair {
  /** Sent to Supabase's signInWithIdToken. */
  raw: string;
  /** Sent to Apple's signInAsync. */
  hashed: string;
}

export async function createNoncePair(): Promise<NoncePair> {
  const bytes = Crypto.getRandomBytes(16);
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}
```

`src/lib/social-auth-errors.ts`:
```typescript
// Backing out of a provider sheet is a decision, not a failure: it must leave
// the screen silent. Everything else has to say something the user can act on.
export type ProviderOutcome = { kind: 'cancelled' } | { kind: 'error'; message: string };

// Apple: ERR_REQUEST_CANCELED. Google: SIGN_IN_CANCELLED, or the raw iOS code -5.
const CANCELLED_CODES = new Set(['ERR_REQUEST_CANCELED', 'SIGN_IN_CANCELLED', '-5']);

export function classifyProviderError(error: unknown): ProviderOutcome {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && CANCELLED_CODES.has(code)) return { kind: 'cancelled' };

  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message.trim().length > 0) {
    return { kind: 'error', message };
  }
  return { kind: 'error', message: 'Sign-in failed. Please try again.' };
}
```
`Crypto.digestStringAsync` returns lowercase hex by default, which is what the test asserts.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest __tests__/auth-nonce.test.ts __tests__/social-auth-errors.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-nonce.ts src/lib/social-auth-errors.ts __tests__/auth-nonce.test.ts __tests__/social-auth-errors.test.ts
git commit -m "social auth: nonce pair and cancelled-vs-error classifier"
```

---

## Task 3: `src/lib/social-auth.ts` — the provider boundary

**Files:**
- Create: `src/lib/social-auth.ts`
- Test: `__tests__/social-auth.test.ts`

**Interfaces:**
- Consumes: `createNoncePair` (Task 2), `classifyProviderError` (Task 2), `supabase` (`src/db/supabase.ts`).
- Produces:
  ```typescript
  export type SocialResult = { ok: true } | { ok: false; outcome: ProviderOutcome };
  export function configureGoogleSignIn(): void;
  export async function isAppleSignInAvailable(): Promise<boolean>;
  export function isGoogleSignInConfigured(): boolean;
  export async function signInWithApple(): Promise<SocialResult>;
  export async function signInWithGoogle(): Promise<SocialResult>;
  ```
  `{ ok: true }` means a Supabase session exists; the screen navigates nowhere.

- [ ] **Step 1: Write the failing tests**

`__tests__/social-auth.test.ts`:
```typescript
// The provider boundary: every path either produces a Supabase session or a
// classified outcome. Nothing here may throw at the caller.
jest.mock('../src/db/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn(), updateUser: jest.fn() } },
}));

import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../src/db/supabase';
import { signInWithApple, signInWithGoogle } from '../src/lib/social-auth';

const mockSignInWithIdToken = supabase.auth.signInWithIdToken as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockAppleSignIn = AppleAuthentication.signInAsync as jest.Mock;
const mockGoogleSignIn = GoogleSignin.signIn as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSignInWithIdToken.mockResolvedValue({ data: { session: {} }, error: null });
  mockUpdateUser.mockResolvedValue({ data: {}, error: null });
});

describe('signInWithApple', () => {
  it('sends the identity token with the RAW nonce, and the hash went to Apple', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: 'apple-token', fullName: null });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: true });
    const appleArgs = mockAppleSignIn.mock.calls[0][0];
    const supabaseArgs = mockSignInWithIdToken.mock.calls[0][0];
    expect(supabaseArgs).toMatchObject({ provider: 'apple', token: 'apple-token' });
    expect(supabaseArgs.nonce).toMatch(/^[0-9a-f]{32}$/); // raw
    expect(appleArgs.nonce).toMatch(/^[0-9a-f]{64}$/); // hashed
    expect(appleArgs.nonce).not.toBe(supabaseArgs.nonce);
  });

  it('stores the full name Apple only ever sends once', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    });

    await signInWithApple();

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'Ada Lovelace' } });
  });

  it('still signs in when storing the name fails', async () => {
    mockAppleSignIn.mockResolvedValue({
      identityToken: 'apple-token',
      fullName: { givenName: 'Ada', familyName: null },
    });
    mockUpdateUser.mockRejectedValue(new Error('offline'));

    await expect(signInWithApple()).resolves.toEqual({ ok: true });
  });

  it('reports a missing identity token instead of passing null on', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: null, fullName: null });

    const result = await signInWithApple();

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toEqual({ kind: 'error', message: 'Apple did not return a sign-in token.' });
  });

  it('returns cancelled when the user dismisses the sheet', async () => {
    mockAppleSignIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: false, outcome: { kind: 'cancelled' } });
  });

  it('surfaces a Supabase rejection', async () => {
    mockAppleSignIn.mockResolvedValue({ identityToken: 'apple-token', fullName: null });
    mockSignInWithIdToken.mockResolvedValue({ data: {}, error: { message: 'bad audience' } });

    const result = await signInWithApple();

    expect(result).toEqual({ ok: false, outcome: { kind: 'error', message: 'bad audience' } });
  });
});

describe('signInWithGoogle', () => {
  it('exchanges the Google id token for a session', async () => {
    mockGoogleSignIn.mockResolvedValue({ data: { idToken: 'google-token' } });

    const result = await signInWithGoogle();

    expect(result).toEqual({ ok: true });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-token' });
  });

  it('accepts the SDK shape that puts idToken at the top level', async () => {
    mockGoogleSignIn.mockResolvedValue({ idToken: 'legacy-token' });

    await signInWithGoogle();

    expect(mockSignInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'legacy-token' });
  });

  it('reports a missing id token instead of passing undefined on', async () => {
    mockGoogleSignIn.mockResolvedValue({ data: {} });

    const result = await signInWithGoogle();

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toEqual({ kind: 'error', message: 'Google did not return a sign-in token.' });
  });

  it('returns cancelled when the user dismisses the sheet', async () => {
    mockGoogleSignIn.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });

    const result = await signInWithGoogle();

    expect(result).toEqual({ ok: false, outcome: { kind: 'cancelled' } });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest __tests__/social-auth.test.ts`
Expected: FAIL — cannot find module `../src/lib/social-auth`.

- [ ] **Step 3: Implement**

```typescript
// The only place the Apple and Google SDKs are touched. Everything above this
// module deals in SocialResult: a session exists, or here is why it does not.
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/db/supabase';
import { createNoncePair } from './auth-nonce';
import { classifyProviderError, type ProviderOutcome } from './social-auth-errors';

export type SocialResult = { ok: true } | { ok: false; outcome: ProviderOutcome };

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Called once at app start. Safe to call when the ids are missing — the button hides instead. */
export function configureGoogleSignIn(): void {
  if (!isGoogleSignInConfigured()) return;
  GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID, webClientId: WEB_CLIENT_ID });
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(IOS_CLIENT_ID && WEB_CLIENT_ID);
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<SocialResult> {
  try {
    const nonce = await createNoncePair();
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonce.hashed,
    });

    if (!credential.identityToken) {
      return { ok: false, outcome: { kind: 'error', message: 'Apple did not return a sign-in token.' } };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: nonce.raw,
    });
    if (error) return { ok: false, outcome: { kind: 'error', message: error.message } };

    // Apple sends the name only on the first authorization, so capture it now or never.
    // A failure here must not cost the user their session.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');
    if (fullName) {
      try {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      } catch {
        // Signed in regardless; the name is a nicety we can live without.
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, outcome: classifyProviderError(e) };
  }
}

export async function signInWithGoogle(): Promise<SocialResult> {
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    // The SDK moved idToken under `data` in v13; accept both shapes.
    const idToken =
      (response as { data?: { idToken?: string | null } }).data?.idToken ??
      (response as { idToken?: string | null }).idToken;

    if (!idToken) {
      return { ok: false, outcome: { kind: 'error', message: 'Google did not return a sign-in token.' } };
    }

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) return { ok: false, outcome: { kind: 'error', message: error.message } };
    return { ok: true };
  } catch (e) {
    return { ok: false, outcome: classifyProviderError(e) };
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest __tests__/social-auth.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Full suite, typecheck, commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep -E 'Tests:'`
```bash
git add src/lib/social-auth.ts __tests__/social-auth.test.ts
git commit -m "social auth: Apple and Google sign-in behind one module"
```

---

## Task 4: Sign-in screen — provider buttons

**Files:**
- Modify: `app/(auth)/sign-in.tsx`
- Test: `__tests__/sign-in-screen.test.tsx`

**Interfaces:**
- Consumes: `signInWithApple`, `signInWithGoogle`, `isAppleSignInAvailable`, `isGoogleSignInConfigured`, `configureGoogleSignIn` (Task 3).

- [ ] **Step 1: Write the failing tests**

`__tests__/sign-in-screen.test.tsx`:
```tsx
// The provider buttons must appear only where they work, must not turn a
// cancelled sheet into an error, and must not fire twice on a double tap.
jest.mock('../src/lib/social-auth', () => ({
  configureGoogleSignIn: jest.fn(),
  isAppleSignInAvailable: jest.fn().mockResolvedValue(true),
  isGoogleSignInConfigured: jest.fn().mockReturnValue(true),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
}));
jest.mock('../src/db/supabase', () => ({
  supabase: { auth: { signInWithPassword: jest.fn(), signUp: jest.fn() } },
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SignInScreen from '../app/(auth)/sign-in';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
} from '../src/lib/social-auth';

const mockApple = signInWithApple as jest.Mock;
const mockGoogle = signInWithGoogle as jest.Mock;
const mockAvailable = isAppleSignInAvailable as jest.Mock;
const mockConfigured = isGoogleSignInConfigured as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAvailable.mockResolvedValue(true);
  mockConfigured.mockReturnValue(true);
  mockApple.mockResolvedValue({ ok: true });
  mockGoogle.mockResolvedValue({ ok: true });
});

describe('SignInScreen provider buttons', () => {
  it('shows both buttons when both providers are usable', async () => {
    const { getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('apple-sign-in')).toBeTruthy());
    expect(getByTestId('google-sign-in')).toBeTruthy();
  });

  it('hides the Apple button where Sign in with Apple is unavailable', async () => {
    mockAvailable.mockResolvedValue(false);
    const { queryByTestId, getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    expect(queryByTestId('apple-sign-in')).toBeNull();
  });

  it('hides the Google button when the client ids are missing', async () => {
    mockConfigured.mockReturnValue(false);
    const { queryByTestId, getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('apple-sign-in')).toBeTruthy());
    expect(queryByTestId('google-sign-in')).toBeNull();
  });

  it('keeps the email form usable with no provider available', async () => {
    mockAvailable.mockResolvedValue(false);
    mockConfigured.mockReturnValue(false);
    const { getByLabelText, queryByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByLabelText('Email')).toBeTruthy());
    expect(queryByTestId('apple-sign-in')).toBeNull();
    expect(queryByTestId('google-sign-in')).toBeNull();
  });

  it('shows nothing when the user cancels the sheet', async () => {
    mockGoogle.mockResolvedValue({ ok: false, outcome: { kind: 'cancelled' } });
    const { getByTestId, queryByText } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(mockGoogle).toHaveBeenCalled());
    expect(queryByText(/failed|error/i)).toBeNull();
  });

  it('shows a real provider failure', async () => {
    mockGoogle.mockResolvedValue({ ok: false, outcome: { kind: 'error', message: 'bad audience' } });
    const { getByTestId, getByText } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(getByText('bad audience')).toBeTruthy());
  });

  it('replaces a previous error rather than stacking messages', async () => {
    mockGoogle
      .mockResolvedValueOnce({ ok: false, outcome: { kind: 'error', message: 'first problem' } })
      .mockResolvedValueOnce({ ok: false, outcome: { kind: 'error', message: 'second problem' } });
    const { getByTestId, getByText, queryByText } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(getByText('first problem')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await waitFor(() => expect(getByText('second problem')).toBeTruthy());
    expect(queryByText('first problem')).toBeNull();
  });

  it('does not start a second sign-in while one is in flight', async () => {
    let resolveIt: (v: unknown) => void = () => {};
    mockGoogle.mockReturnValue(new Promise((r) => { resolveIt = r; }));
    const { getByTestId } = await render(<SignInScreen />);
    await waitFor(() => expect(getByTestId('google-sign-in')).toBeTruthy());
    await fireEvent.press(getByTestId('google-sign-in'));
    await fireEvent.press(getByTestId('google-sign-in'));
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    resolveIt({ ok: true });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest __tests__/sign-in-screen.test.tsx`
Expected: FAIL — no `apple-sign-in` testID.

- [ ] **Step 3: Implement the screen changes**

In `app/(auth)/sign-in.tsx`:

Add to the imports:
```tsx
import { useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  configureGoogleSignIn,
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
} from '@/lib/social-auth';
```
(the file currently imports `useState` only — replace that import line.)

Add state and the provider handler inside the component, after `submitting`:
```tsx
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleAvailable = isGoogleSignInConfigured();

  useEffect(() => {
    configureGoogleSignIn();
    let cancelled = false;
    isAppleSignInAvailable().then((available) => {
      if (!cancelled) setAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One sheet at a time: a double tap must not open two sheets or create two sessions.
  const runProvider = async (start: () => Promise<{ ok: boolean; outcome?: { kind: string; message?: string } }>) => {
    if (submitting) return;
    setAuthError(null);
    setSubmitting(true);
    const result = await start();
    setSubmitting(false);
    // ok: the session lands in SessionProvider and the root layout routes.
    if (!result.ok && result.outcome?.kind === 'error') {
      setAuthError(result.outcome.message ?? 'Sign-in failed. Please try again.');
    }
  };
```

Render the provider block directly under the `subtitle` `Text`, before the email `TextInput`:
```tsx
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            testID="apple-sign-in"
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={10}
            style={styles.appleButton}
            onPress={() => runProvider(signInWithApple)}
          />
        ) : null}

        {googleAvailable ? (
          <Pressable
            testID="google-sign-in"
            style={styles.googleButton}
            onPress={() => runProvider(signInWithGoogle)}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>
        ) : null}

        {appleAvailable || googleAvailable ? (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
        ) : null}
```

Add the styles:
```tsx
  appleButton: { height: 48 },
  googleButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  dividerText: { ...type.hint },
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest __tests__/sign-in-screen.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Full suite, typecheck, commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep -E 'Tests:|Suites:'`
```bash
git add 'app/(auth)/sign-in.tsx' __tests__/sign-in-screen.test.tsx
git commit -m "social auth: Continue with Apple and Google on the sign-in screen"
```

---

## Task 5: Owner setup guide

**Files:**
- Create: `docs/setup-social-sign-in.md`

**Interfaces:** none — this is the document the repository owner follows in the Apple, Google and Supabase consoles.

- [ ] **Step 1: Write the guide**

Content, exactly:

```markdown
# Setting up Sign in with Apple and Google

One-time console work. Nothing here is secret: both Google client IDs appear in
network traffic and are restricted by bundle id. Do these before building 1.2.

## 1. Apple (5 minutes)

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**.
2. Open `com.trueorganichub.propertyledger`.
3. Tick **Sign in with Apple** → **Save**. Leave "Server-to-Server Notification
   Endpoint" blank; Supabase does not use it.

No Services ID and no `.p8` key: those belong to the web OAuth flow, which this
app does not use, so there is also no six-month secret rotation.

## 2. Google (10 minutes)

1. console.cloud.google.com → create a project (e.g. "PropertyLedger").
2. **APIs & Services → OAuth consent screen**: External, app name
   "PropertyLedger", support email `support@trueorganichub.com`, developer email
   the same. Scopes: `openid`, `.../auth/userinfo.email`,
   `.../auth/userinfo.profile` — the three defaults, nothing more, or Google
   review is triggered.
3. **Credentials → Create credentials → OAuth client ID → iOS**:
   bundle id `com.trueorganichub.propertyledger`. Copy the client ID.
4. **Create credentials → OAuth client ID → Web application**, name it
   "Supabase". Copy that client ID too. Under **Authorized redirect URIs** add
   `https://dxjwyaldmxquuztmnrsb.supabase.co/auth/v1/callback`.
5. Optional but recommended: start **Branding** verification so the consent
   screen shows "PropertyLedger" instead of the Supabase project URL. It takes
   a few business days, so start it early.

## 3. Supabase (3 minutes)

Dashboard → Authentication → **Providers**:

- **Apple**: enable. In *Authorized Client IDs* put
  `com.trueorganichub.propertyledger`. Leave Secret Key empty (native flow only).
- **Google**: enable. *Client ID* = the **Web** client ID from step 2.4.
  *Client Secret* = that web client's secret. In *Authorized Client IDs* put the
  **iOS** client ID from step 2.3.
- Leave **Confirm email** OFF — see §4 of the design spec for why, and what to
  change if that decision is revisited.

## 4. This repository (2 minutes)

In `.env` (never committed):

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS client id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
```

In `app.json`, replace the placeholder in the google-signin plugin with the
**reversed** iOS client ID:

```json
["@react-native-google-signin/google-signin",
  { "iosUrlScheme": "com.googleusercontent.apps.<iOS client id without the suffix>" }]
```

Then rebuild — both modules are native, so an OTA update cannot deliver them:

```bash
npx eas-cli@latest build -p ios --profile production --auto-submit
```

## 5. Verify on a device

- Continue with Apple on a fresh account → lands on the first-run chooser.
- Sign out, Continue with Apple again → same ledgers.
- Same two steps for Google.
- Create a password account, sign out, Continue with Google with that same
  address → the same ledgers appear (identity linking).
- Delete account still removes everything.
```

- [ ] **Step 2: Commit**

```bash
git add docs/setup-social-sign-in.md
git commit -m "docs: console setup guide for Apple and Google sign-in"
```

---

## Task 6: Wire real client IDs, build, verify on device, docs

**Files:**
- Modify: `app.json` (real `iosUrlScheme`), `.env` (untracked), `README.md`, `WORKLOG.md`

**Interfaces:** none.

> **Blocked until the owner completes `docs/setup-social-sign-in.md` steps 1–3** and supplies the two client IDs. Do not start this task before then.

- [ ] **Step 1: Put the real values in place**

Replace `com.googleusercontent.apps.PLACEHOLDER` in `app.json` with the reversed iOS client ID, and write both `EXPO_PUBLIC_GOOGLE_*` values into `.env`.

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep -E 'Tests:'` — unchanged.

- [ ] **Step 2: Build**

```bash
npx eas-cli@latest build -p ios --profile production --auto-submit --non-interactive --no-wait
```
Do **not** attach the resulting build to an App Store version while 1.0 is under review; it goes to TestFlight only.

- [ ] **Step 3: Verify on device**

Run every check in `docs/setup-social-sign-in.md` §5. Record the result of each in the task report, including the identity-linking check (one `auth.users` row, two rows in `auth.identities`), which can be confirmed with psql:
```bash
cd /Users/riyad/OrganicHub/propertyledger && set -a && source .env && set +a
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "host=db.dxjwyaldmxquuztmnrsb.supabase.co port=5432 dbname=postgres user=postgres sslmode=require" -Atc \
 "select u.email, count(i.id) from auth.users u join auth.identities i on i.user_id = u.id group by 1 order by 2 desc limit 5;"
```

- [ ] **Step 4: Docs**

- `README.md`: under "Using the app", add to the **First run** paragraph: "You can also tap *Continue with Apple* or *Continue with Google* — the same account is used whichever way you sign in, as long as the email address matches." Add `docs/setup-social-sign-in.md` to the Docs list at the bottom.
- `WORKLOG.md`: Phase 17 START/FINISH lines in the existing format, with test counts and the device-verification results.

- [ ] **Step 5: Commit**

```bash
git add app.json README.md WORKLOG.md
git commit -m "social auth: real Google client ids; device-verified; docs"
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §2 Apple + Google, no Microsoft | 1, 3, 4 |
| §3 native flows, no OAuth redirect/Services ID/.p8 | 3, 5 |
| §3 nonce: hash to Apple, raw to Supabase | 2, 3 (test asserts both) |
| §3 Apple full name captured on first authorization | 3 |
| §4 automatic linking, no linking code, confirmation stays off | 5 (Supabase step), 6 (device check) |
| §5 buttons above the form, Apple's own button component | 4 |
| §5 buttons hidden when provider unusable; screen unchanged with neither | 4 |
| §5 cancel is silent; other failures show in `authError` | 2, 3, 4 |
| §5 no navigation on success | 3 (`{ ok: true }` only), 4 |
| §6 account deletion unchanged | no code change; re-verified in 6 §5 |
| §7 modules, plugins, `usesAppleSignIn`, console setup | 1, 5, 6 |
| §8 pure tests, mocked SDK screen test, live device checks | 2, 3, 4, 6 |
| §10 Google brand verification risk | 5 (guide says start early) |

Review Focus coverage: null Apple token → Task 3; missing Google idToken → Task 3; double tap → Task 4; `updateUser` failure → Task 3; error replacing a previous error → Task 4.

Type consistency: `SocialResult`, `ProviderOutcome`, `NoncePair`, `createNoncePair`, `classifyProviderError`, `signInWithApple`, `signInWithGoogle`, `isAppleSignInAvailable`, `isGoogleSignInConfigured`, `configureGoogleSignIn` are spelled identically in Tasks 2, 3 and 4.
