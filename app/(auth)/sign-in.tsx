// Sign-in / sign-up screen (Phase 2). Validation happens locally first
// (src/lib/auth-validation.ts); Supabase Auth errors surface below the form.
import { useState } from 'react';
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

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SignInValidation['errors']>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#fff' },
  form: { paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: '#c0392b', fontSize: 13 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchText: { color: '#2563eb', textAlign: 'center', marginTop: 8 },
});
