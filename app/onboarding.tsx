// First run: a signed-in user with no ledgers picks what to track. Creates the
// ledger(s) with a sensible default name and lands on the Ledgers tab.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { createProperty, listProperties } from '@/db/properties';
import type { NewProperty } from '@/types';
import { type, ui } from '@/theme';

const CHOICES: { key: string; title: string; body: string; ledgers: NewProperty[] }[] = [
  {
    key: 'rental',
    title: 'A rental property',
    body: 'Track rent, taxes, repairs and the year-end profit for each property.',
    ledgers: [{ name: 'My first property', property_type: 'rental' }],
  },
  {
    key: 'personal',
    title: 'My own budget',
    body: 'Log income and spending, set up monthly bills, and watch your savings rate.',
    ledgers: [{ name: 'Household', property_type: 'personal' }],
  },
  {
    key: 'both',
    title: 'Both',
    body: 'A property ledger and a household budget, side by side.',
    ledgers: [
      { name: 'My first property', property_type: 'rental' },
      { name: 'Household', property_type: 'personal' },
    ],
  },
];

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    // Idempotent: a double tap (or a retry after a partial failure) must not
    // create a second "Household". Skip any ledger whose name already exists.
    mutationFn: async (ledgers: NewProperty[]) => {
      const existing = await listProperties({ includeArchived: true });
      const taken = new Set(existing.map((p) => p.name.trim().toLowerCase()));
      for (const l of ledgers) {
        if (taken.has(l.name.trim().toLowerCase())) continue;
        await createProperty(l);
      }
    },
    onSuccess: async () => {
      // 'all' also refetches the unmounted dashboard query, whose cached [] would
      // otherwise re-fire the onboarding redirect on the next Dashboard tap.
      await queryClient.invalidateQueries({ queryKey: ['properties'], refetchType: 'all' });
      router.replace('/(tabs)/properties');
    },
    onError: (e: Error) => Alert.alert('Could not set up', e.message),
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Welcome', headerBackVisible: false }} />
      <Text style={styles.heading}>What do you want to track?</Text>
      <Text style={styles.sub}>You can add more ledgers any time. Names can be changed later.</Text>
      {CHOICES.map((c) => (
        <Pressable
          key={c.key}
          style={styles.choice}
          onPress={() => mutation.mutate(c.ledgers)}
          disabled={mutation.isPending}
          accessibilityRole="button"
        >
          <Text style={styles.choiceTitle}>{c.title}</Text>
          <Text style={styles.choiceBody}>{c.body}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...ui.screen, padding: 20, gap: 12 },
  heading: { ...type.display, marginTop: 12 },
  sub: { ...type.label, marginBottom: 8 },
  choice: { ...ui.card, padding: 16, gap: 4 },
  choiceTitle: { ...type.body, fontSize: 17, fontWeight: '700' },
  choiceBody: { ...type.label, lineHeight: 18 },
});
