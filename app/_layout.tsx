// Root layout — session provider + react-query client, with route groups gated:
// signed-in users get (tabs) and property screens; signed-out users are held at sign-in.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession } from '@/components/session-provider';
import { isSignedIn } from '@/lib/auth-guard';

// One client for the whole app; query caching keeps list screens instant.
const queryClient = new QueryClient();

function RootNavigator() {
  const { session, isLoading } = useSession();

  // Hold rendering until the persisted session is restored from AsyncStorage,
  // otherwise every launch would flash the sign-in screen before redirecting.
  if (isLoading) return null;

  const signedIn = isSignedIn(session);

  return (
    <Stack>
      {/* Protected guards redirect to the first available screen when they fail,
          so a null session always lands on (auth)/sign-in. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="property/new" options={{ title: 'New Property', presentation: 'modal' }} />
        <Stack.Screen name="property/[id]/index" options={{ title: 'Property' }} />
        <Stack.Screen name="property/[id]/edit" options={{ title: 'Edit Property' }} />
        <Stack.Screen name="transaction/[kind]/[id]" options={{ title: 'Edit Transaction' }} />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="history" options={{ title: 'History & Trends' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    // Gesture root is required once, above any Swipeable (transaction rows).
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
