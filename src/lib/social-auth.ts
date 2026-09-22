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
