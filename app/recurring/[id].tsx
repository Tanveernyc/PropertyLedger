// Modal: edit a recurring rule's monthly amount and notes (README §4.3).
// Only months not yet generated pick up the new amount; posted entries are history.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { getRecurringRule, updateRecurringRule } from '@/db/recurring';
import { monthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { validateRuleAmount } from '@/lib/recurring-rule-validation';

export default function EditRecurringRuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: rule, isPending } = useQuery({
    queryKey: ['recurring', 'rule', id],
    queryFn: () => getRecurringRule(id),
  });

  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();

  // Prefill once the row arrives.
  useEffect(() => {
    if (!rule) return;
    setAmountText(String(rule.amount));
    setNotes(rule.notes ?? '');
  }, [rule]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateRuleAmount(amountText);
      setError(validation.error);
      if (validation.amount === undefined) {
        throw Object.assign(new Error('validation'), { silent: true });
      }
      return updateRecurringRule(id, { amount: validation.amount, notes: notes.trim() || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      router.back();
    },
    onError: (e: Error & { silent?: boolean }) => {
      if (!e.silent) Alert.alert('Could not save changes', e.message);
    },
  });

  if (isPending || !rule) return <ActivityIndicator style={styles.spinner} />;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      // Scroll the focused field (and the Save button) above the keyboard instead of hiding them.
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Stack.Screen options={{ title: rule.kind === 'income' ? 'Edit Income Rule' : 'Edit Expense Rule' }} />

      <Text style={styles.help}>
        Currently {formatMoney(rule.amount)}/mo from {monthKey(rule.start_month)}. A new amount applies
        to months that haven't been posted yet — entries already in your ledger keep their numbers.
      </Text>

      <Text style={styles.label}>Amount ($) each month *</Text>
      <TextInput
        style={[styles.input, styles.amountInput]}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Notes</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="optional" />

      <Pressable style={styles.saveButton} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Text style={styles.saveButtonText}>{saveMutation.isPending ? 'Saving…' : 'Save Changes'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  spinner: { marginTop: 32 },
  help: { color: '#555', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  label: { fontSize: 13, color: '#555', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  amountInput: { fontSize: 22, fontWeight: '600' },
  saveButton: { marginTop: 20, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c0392b', fontSize: 12, marginTop: 4 },
});
