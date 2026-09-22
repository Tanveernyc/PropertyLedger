# Sign in with Apple and Google — design

**Date:** 2026-09-22
**Status:** draft for review
**Ships as:** 1.2, after App Store version 1.0 is approved. No binary change while 1.0 is in review.

**Decisions taken in brainstorming:** Apple + Google only (no Microsoft); accounts with the same email address are linked into one account; password sign-ups must confirm their email address first.

## 1. Goal

One tap to get in. A new user picks *Continue with Apple* or *Continue with Google* and lands in the app with a ledger ready; an existing password user keeps signing in exactly as before, and may also use a social button on the same email address without splitting their data.

## 2. Why these two

Apple's Guideline 4.8 requires an equivalent privacy-preserving login option whenever an app offers third-party login. Sign in with Apple satisfies it, so shipping Google without Apple is not allowed; shipping Apple alone would be. Microsoft is excluded: it serves business identities this app does not target, and each provider adds a console, a secret, and a button.

## 3. Flow (native, not browser)

Both providers use the **native** path: the OS presents the sheet, the app receives an ID token, and the token is exchanged for a Supabase session. No web redirect, no browser bounce, nothing to intercept.

```
user taps Continue with Apple
  → expo-apple-authentication signInAsync({ nonce: sha256(raw) })
  → identityToken
  → supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce: raw })
  → session → SessionProvider → (tabs) or /onboarding
```

```
user taps Continue with Google
  → GoogleSignin.signIn()            (@react-native-google-signin/google-signin)
  → idToken
  → supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  → session → SessionProvider → (tabs) or /onboarding
```

Neither provider needs the Supabase OAuth redirect flow, so there is **no Services ID and no `.p8` secret to rotate every six months** — that maintenance burden only applies to the web flow. The Apple provider in Supabase needs the bundle identifier `com.trueorganichub.propertyledger` in *Authorized Client IDs*; the Google provider needs the iOS client ID in the same field.

### Apple's name quirk

Apple returns `fullName` **only on the very first authorization** and never again; the identity token never carries it. On first sign-in the app writes it to user metadata (`supabase.auth.updateUser({ data: { full_name } })`) so it survives. Nothing in the app displays a name today, so this is captured for later use, not shown.

### Nonce

Apple requires the nonce sent to `signInAsync` to be the SHA-256 hash of the raw nonce, while Supabase must receive the **raw** value. The pair is generated per attempt with `expo-crypto`. Google's native SDK handles its own nonce; none is passed.

## 4. Identity linking and the email-verification change

Supabase links identities automatically when the email address matches and is verified. That is the behaviour we want — one account whichever button you press — but it is only safe if password accounts are verified, otherwise someone who registers `victim@example.com` first would absorb the victim's Google identity (a pre-account-takeover).

The project currently has email confirmation **off**: `signUp` returns a session immediately. This spec turns it **on**:

- New password sign-ups receive a confirmation email and cannot sign in until they click it. The sign-in screen shows "Check your email to confirm your account" instead of dropping into the app.
- Apple and Google sign-ins are unaffected — those emails arrive verified from the provider.
- Existing accounts are unaffected: rows already marked confirmed stay confirmed.
- The demo reviewer account stays confirmed; App Review notes must drop the sentence that says no confirmation is required.

The confirmation email is sent by Supabase's built-in service, whose rate limits are low but adequate at this scale; the redirect target is the app's existing scheme, `propertyledger://`, so tapping the link reopens the app.

## 5. Screen

`app/(auth)/sign-in.tsx` gains a provider block **above** the email form, because that is where people look first:

```
            PropertyLedger
        Sign in to your ledger

   [   Continue with Apple      ]     (black, Apple's required style)
   [   Continue with Google     ]     (white, Google's required style)

   ──────────  or  ──────────

   Email                                (existing form, unchanged)
   Password
   [       Sign In       ]
   No account yet? Sign up
```

- The Apple button uses `AppleAuthentication.AppleAuthenticationButton` so it always matches Apple's current guidelines. The Google button is a plain `Pressable` styled per Google's brand rules (white background, grey border, official mark as an inline SVG asset).
- Buttons render only where they work: the Apple button is hidden when `AppleAuthentication.isAvailableAsync()` is false; the Google button is hidden if the SDK is unconfigured. On a device with neither, the screen is exactly today's screen.
- A cancelled sheet is not an error: `ERR_REQUEST_CANCELED` (Apple) and `SIGN_IN_CANCELLED` (Google) return silently. Every other failure surfaces in the existing `authError` line.
- Provider sign-in never navigates; the session lands in `SessionProvider` and the root layout's guards route, same as the password path. A new account therefore meets the first-run chooser.

## 6. Account deletion

Unchanged and still compliant: the edge function deletes the `auth.users` row, which removes every linked identity with it. The Delete account screen keeps its typed-`DELETE` confirmation.

## 7. Modules and configuration

| Piece | What |
|---|---|
| `expo-apple-authentication` | Expo module; adds the Sign in with Apple entitlement via `app.json` plugin. |
| `@react-native-google-signin/google-signin` | Native Google SDK wrapper; config plugin takes `iosUrlScheme`. |
| `expo-crypto` | SHA-256 for the Apple nonce. |
| Apple Developer portal | App ID `com.trueorganichub.propertyledger` → enable the **Sign in with Apple** capability. |
| Google Cloud console | OAuth consent screen + **iOS** client ID (bundle id) and a **Web** client ID (Supabase needs the web one as its Google client ID). |
| Supabase dashboard | Enable Apple provider (authorized client id = bundle id) and Google provider (client id = web client id, plus the iOS client id in authorized clients); turn on **Confirm email**. |

Both new packages ship native code, so 1.2 requires a fresh EAS build — no OTA update can deliver it.

## 8. Testing

- **Pure:** a `nonce.ts` helper (raw + SHA-256 pair) and a `providerError.ts` classifier (cancelled vs real failure) are pure functions with unit tests. The provider SDKs themselves are mocked at the module boundary in a sign-in screen render test that asserts the buttons appear, a cancel leaves no error on screen, and a failure shows one.
- **Live, on device:** sign up fresh with Apple → app opens on the first-run chooser; sign out; sign in again with Apple → same ledgers. Repeat for Google. Then: create a password account with `x@gmail.com`, confirm the email, sign out, tap Continue with Google as the same address → same account, same ledgers (verified in the database: one `auth.users` row, two rows in `auth.identities`).
- **Regression:** the existing email/password path, including a deliberately wrong password and the new "confirm your email" state.

## 9. Out of scope

Facebook/Microsoft/X providers; phone or magic-link sign-in; unlinking an identity from inside the app; showing the user's name or avatar anywhere; Android specifics (the app is iPhone-only).

## 10. Risks

- **Google brand review.** Google's consent screen shows the Supabase project domain until the brand is verified; verification takes a few business days and should be started early, not at submission time.
- **Confirmation email deliverability.** Supabase's shared sender can land in spam. If that shows up in testing, the fix is a custom SMTP sender, which is configuration, not code.
- **Apple review.** Adding Sign in with Apple is expected and welcomed; the risk is the opposite case, shipping Google without it, which this spec avoids.
