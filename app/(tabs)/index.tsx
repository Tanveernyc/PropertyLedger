// Dashboard tab — placeholder until Phase 11 builds the real dashboard.
// Proves the auth flow end-to-end: shows who is signed in and offers sign-out.
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/db/supabase';
import { useSession } from '@/components/session-provider';

export default function DashboardScreen() {
  const { session } = useSession();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>
      <Text style={styles.body}>Signed in as {session?.user.email ?? 'unknown'}</Text>
      <Link href="/categories" style={styles.link}>
        Manage categories
      </Link>
      <Link href="/export" style={styles.link}>
        Export all data
      </Link>
      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  heading: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 15, color: '#444', textAlign: 'center' },
  signOut: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#eee' },
  signOutText: { color: '#c0392b', fontWeight: '600' },
  link: { color: '#2563eb', fontSize: 15, marginTop: 4 },
});
