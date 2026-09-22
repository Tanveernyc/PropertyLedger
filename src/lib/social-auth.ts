// The only place the Apple and Google SDKs are touched. Everything above this
// module deals in SocialResult: a session exists, or here is why it does not.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/db/supabase';
import { createNoncePair } from './auth-nonce';
import { classifyProviderError, type ProviderOutcome } from './social-auth-errors';

export type SocialResult = { ok: true } | { ok: false; outcome: ProviderOutcome };

// babel-preset-expo inlines every EXPO_PUBLIC_* read at build time, so these are
// compile-time constants baked into the bundle, not runtime lookups. Reading
// them inside each function would therefore be no more dynamic than reading
// them once here — changing one always requires a rebuild either way.
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Apple hands out the user's name exactly once, on the first authorization. If
// the token exchange fails that name is gone forever, so park it here and use
// it on the next successful Apple sign-in.
//
// Scoped per Apple user id (`credential.user`, stable per Apple ID per app) so
// that on a shared device, user A's parked name can never be consumed by user
// B's sign-in just because B's Apple ID has already authorized this app (which
// makes Apple send `fullName: null` — the normal case for any non-first
// authorization, not a signal that B's name equals A's stash).
function pendingAppleNameKey(appleUserId: string): string {
  return `pending-apple-full-name:${appleUserId}`;
}

/**
 * Called from the sign-in screen's effect, not at app start — the screen is the
 * only place Google sign-in can begin. `GoogleSignin.configure` is idempotent,
 * so re-running it on every mount is free. Safe to call when the ids are
 * missing: it no-ops and the button hides instead.
 */
export function configureGoogleSignIn(): void {
  if (!isGoogleSignInConfigured()) return;
  GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID, webClientId: WEB_CLIENT_ID });
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(IOS_CLIENT_ID && WEB_CLIENT_ID);
}

/**
 * Fails closed: the Apple button stays hidden until the owner has ticked the
 * App ID capability and enabled the Supabase Apple provider, then flipped this
 * flag. Without it a build renders a button that walks the user through Face ID
 * and then fails — burning Apple's one-shot name. See docs/setup-social-sign-in.md.
 */
export function isAppleSignInEnabled(): boolean {
  return process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';
}

async function stashAppleFullName(appleUserId: string, fullName: string): Promise<void> {
  try {
    await AsyncStorage.setItem(pendingAppleNameKey(appleUserId), fullName);
  } catch {
    // Storage must never cost a session, and a lost name is survivable.
  }
}

// Reads AND clears in one step: whether or not the name goes on to be applied
// successfully, a stale value must never survive to be misapplied to a later
// session under this same Apple user id.
async function takeStashedAppleFullName(appleUserId: string): Promise<string> {
  const key = pendingAppleNameKey(appleUserId);
  try {
    const stashed = await AsyncStorage.getItem(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Worst case the same name is re-applied on a later sign-in.
    }
    return stashed ?? '';
  } catch {
    return '';
  }
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

    // Apple sends the name only on the very first authorization, so read it
    // BEFORE the exchange: a failed exchange must not be what discards it.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: nonce.raw,
    });
    if (error) {
      // No session to attach the name to — park it for the next attempt, but
      // only when we have a stable id to scope it to. Without credential.user
      // there is no safe key, so the name is lost rather than risk a global
      // stash that could leak onto a different account.
      if (fullName && credential.user) await stashAppleFullName(credential.user, fullName);
      return { ok: false, outcome: { kind: 'error', message: error.message } };
    }

    // Signed in. Use this authorization's name, or whatever a failed earlier
    // attempt parked FOR THIS SAME Apple user id. A failure here must not
    // cost the user their session.
    const nameToStore =
      fullName || (credential.user ? await takeStashedAppleFullName(credential.user) : '');
    if (nameToStore) {
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { full_name: nameToStore },
        });
        // updateUser RESOLVES { data, error } for auth failures rather than
        // throwing, so the resolved error needs checking too. Either way the
        // stash was already cleared by takeStashedAppleFullName above.
        if (updateError) {
          console.warn('[social-auth] could not store the Apple full name:', updateError.message);
        }
      } catch {
        // Never log the name or any token; the session stands regardless.
        console.warn('[social-auth] storing the Apple full name threw; keeping the session.');
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
