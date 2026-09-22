// Create-property modal (Phase 3). Title and button follow the user's ledger
// kinds: a rental-only account reads "New Property" / "Create Property".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Alert } from 'react-native';
import { PropertyForm } from '@/components/property-form';
import { createProperty, listProperties } from '@/db/properties';
import { collectionNoun, kindsOf, nounFor } from '@/lib/ledger-copy';

export default function NewPropertyScreen() {
  const queryClient = useQueryClient();
  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: false }],
    queryFn: () => listProperties({ includeArchived: false }),
  });

  const mutation = useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      // Any cached property list (archived view or not) is now stale.
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.back();
    },
    onError: (error: Error) => Alert.alert('Could not save', error.message),
  });

  return (
    <>
      <Stack.Screen options={{ title: `New ${collectionNoun(kindsOf(properties ?? []))}` }} />
      <PropertyForm
        onSubmit={(values) => mutation.mutate(values)}
        submitting={mutation.isPending}
        submitLabel={(kind) => `Create ${nounFor(kind).one}`}
      />
    </>
  );
}
