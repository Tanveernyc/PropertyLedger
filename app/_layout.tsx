// Root layout — wraps the app in the session provider and gates route groups:
// signed-in users see (tabs), signed-out users are held at (auth)/sign-in.
import { Stack } from 'expo-router/stack';
import { SessionProvider, useSession } from '@/components/session-provider';
import { isSignedIn } from '@/lib/auth-guard';

function RootNavigator() {
  const { session, isLoading } = useSession();

  // Hold rendering until the persisted session is restored from AsyncStorage,
  // otherwise every launch would flash the sign-in screen before redirecting.
  if (isLoading) return null;

  const signedIn = isSignedIn(session);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Protected guards redirect to the first available screen when they fail,
          so a null session always lands on (auth)/sign-in. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
