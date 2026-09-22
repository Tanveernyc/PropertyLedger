// Edit-property screen (Phase 3): edit fields, archive/unarchive (never delete).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PropertyForm } from '@/components/property-form';
import { getProperty, setPropertyArchived, updateProperty } from '@/db/properties';
import type { NewProperty } from '@/types';
import { colors, ui } from '@/theme';
import { nounFor } from '@/lib/ledger-copy';

export default function EditPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: property, isPending, error } = useQuery({
    queryKey: ['property', id],
    queryFn: () => getProperty(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    queryClient.invalidateQueries({ queryKey: ['property', id] });
  };

  const saveMutation = useMutation({
    mutationFn: (values: NewProperty) => updateProperty(id, values),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not save changes', e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => setPropertyArchived(id, archived),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not update archive state', e.message),
  });

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !property) {
    return <Text style={styles.error}>{(error as Error | null)?.message ?? 'Not found.'}</Text>;
  }

  const toggleArchive = () => {
    const archiving = !property.is_archived;
    const noun = nounFor(property.property_type).one.toLowerCase();
    Alert.alert(
      archiving ? `Archive ${noun}?` : `Unarchive ${noun}?`,
      archiving
        ? `It will be hidden from your ${noun} lists but all its history is kept.`
        : `It will reappear in your active ${noun} lists.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: archiving ? 'Archive' : 'Unarchive',
          style: archiving ? 'destructive' : 'default',
          onPress: () => archiveMutation.mutate(archiving),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Edit ${nounFor(property.property_type).one}` }} />
      <PropertyForm
        initial={property}
        onSubmit={(values) => saveMutation.mutate(values)}
        submitting={saveMutation.isPending}
        submitLabel={(kind) => `Save ${nounFor(kind).one}`}
      />
      <Pressable style={styles.archiveButton} onPress={toggleArchive}>
        <Text style={styles.archiveText}>
          {property.is_archived ? 'Unarchive' : 'Archive'} {nounFor(property.property_type).one}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...ui.screen },
  spinner: { marginTop: 40 },
  error: { ...ui.error, padding: 16 },
  archiveButton: { alignItems: 'center', padding: 16 },
  archiveText: { color: colors.danger, fontWeight: '600' },
});
