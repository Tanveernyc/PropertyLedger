// Sign-in / sign-up screen (Phase 2). Validation happens locally first
// (src/lib/auth-validation.ts); Supabase Auth errors surface below the form.
import { useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/db/supabase';
import { validateSignIn, type SignInValidation } from '@/lib/auth-validation';
import {
  configureGoogleSignIn,
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
} from '@/lib/social-auth';
import { colors, type, ui } from '@/theme';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignInValidation['errors']>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const submit = async () => {
    setAuthError(null);
    // Local validation first — no network call for an obviously bad form.
    const validation = validateSignIn(email, password);
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setSubmitting(true);
    const credentials = { email: email.trim(), password };
    const { error } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setSubmitting(false);

    // On success the session change propagates through SessionProvider and the
    // root layout's guards route to (tabs) — no manual navigation needed here.
    if (error) setAuthError(error.message);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.title}>PropertyLedger</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign-in' ? 'Sign in to your ledger' : 'Create your account'}
        </Text>

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            testID="apple-sign-in"
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={10}
            style={styles.appleButton}
            onPress={() => {
              runProvider(signInWithApple);
            }}
          />
        ) : null}

        {googleAvailable ? (
          <Pressable
            testID="google-sign-in"
            style={styles.googleButton}
            onPress={() => { runProvider(signInWithGoogle); }}
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

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
        />
        {fieldErrors.email ? <Text style={styles.error}>{fieldErrors.email}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
        />
        {fieldErrors.password ? <Text style={styles.error}>{fieldErrors.password}</Text> : null}

        {authError ? <Text style={styles.error}>{authError}</Text> : null}

        <Pressable style={styles.button} onPress={submit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setAuthError(null);
          }}
        >
          <Text style={styles.switchText}>
            {mode === 'sign-in'
              ? 'No account yet? Sign up'
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.paper },
  form: { paddingHorizontal: 24, gap: 12 },
  title: { ...type.display, textAlign: 'center' },
  subtitle: { ...type.label, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  input: { ...ui.input, fontSize: 16, paddingVertical: 12 },
  error: { ...ui.error, fontSize: 13 },
  button: { ...ui.buttonPrimary, marginTop: 4 },
  buttonText: { ...ui.buttonPrimaryText },
  switchText: { ...ui.link, textAlign: 'center', marginTop: 8 },
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
});
