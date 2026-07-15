// Create-property modal (Phase 3).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { PropertyForm } from '@/components/property-form';
import { createProperty } from '@/db/properties';

export default function NewPropertyScreen() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      // Any cached property list (archived view or not) is now stale.
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.back();
    },
    onError: (error: Error) => Alert.alert('Could not save property', error.message),
  });

  return (
    <PropertyForm
      onSubmit={(values) => mutation.mutate(values)}
      submitting={mutation.isPending}
      submitLabel="Create Property"
    />
  );
}
