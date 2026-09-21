// Edit-transaction screen (Phase 7): amount, date, party, notes, and (expenses
// only) the covers-period fields. Kind comes from the route: /transaction/expense/:id.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getExpense, updateExpense } from '@/db/expenses';
import { getIncome, updateIncome } from '@/db/income';
import { skipRecurringMonth } from '@/db/recurring';
import { monthKey } from '@/lib/dates';
import { validateTransactionForm, type TransactionValidation } from '@/lib/expense-validation';
import type { Expense, Income } from '@/types';
import { money, type, ui } from '@/theme';

export default function EditTransactionScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'expense' | 'income'; id: string }>();
  const isExpense = kind === 'expense';
  const queryClient = useQueryClient();

  const { data: transaction, isPending } = useQuery<Expense | Income>({
    queryKey: [isExpense ? 'expense' : 'income-entry', id],
    queryFn: () => (isExpense ? getExpense(id) : getIncome(id)),
  });

  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState('');
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [errors, setErrors] = useState<TransactionValidation['errors']>({});

  // Prefill once the row arrives.
  useEffect(() => {
    if (!transaction) return;
    setAmountText(String(transaction.amount));
    setNotes(transaction.notes ?? '');
    if ('paid_on' in transaction) {
      setDate(transaction.paid_on);
      setParty(transaction.vendor ?? '');
      setPeriodStart(transaction.period_start ?? '');
      setPeriodEnd(transaction.period_end ?? '');
    } else {
      setDate(transaction.received_on);
      setParty(transaction.source ?? '');
    }
  }, [transaction]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateTransactionForm({
        amountText,
        date,
        // Property/category are not edited here; pass placeholders that satisfy the validator.
        propertyId: transaction?.property_id ?? null,
        categoryId: transaction?.category_id ?? null,
        periodStart: isExpense ? periodStart : undefined,
        periodEnd: isExpense ? periodEnd : undefined,
      });
      setErrors(validation.errors);
      if (!validation.valid || validation.amount === undefined) {
        throw Object.assign(new Error('validation'), { silent: true });
      }
      if (transaction?.recurring_id) {
        const originalDate = 'paid_on' in transaction ? transaction.paid_on : transaction.received_on;
        if (monthKey(date.trim()) !== monthKey(originalDate)) {
          // Same "skip first" ordering as delete: the vacated month must never be re-posted.
          await skipRecurringMonth(transaction.recurring_id, originalDate);
        }
      }
      if (isExpense) {
        return updateExpense(id, {
          amount: validation.amount,
          paid_on: date.trim(),
          period_start: periodStart.trim() || null,
          period_end: periodEnd.trim() || null,
          vendor: party.trim() || null,
          notes: notes.trim() || null,
          is_edited: transaction?.recurring_id ? true : undefined,
        });
      }
      return updateIncome(id, {
        amount: validation.amount,
        received_on: date.trim(),
        source: party.trim() || null,
        notes: notes.trim() || null,
        is_edited: transaction?.recurring_id ? true : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [isExpense ? 'expenses' : 'income'] });
      queryClient.invalidateQueries({ queryKey: [isExpense ? 'expense' : 'income-entry', id] });
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      router.back();
    },
    onError: (e: Error & { silent?: boolean }) => {
      if (!e.silent) Alert.alert('Could not save changes', e.message);
    },
  });

  if (isPending) return <ActivityIndicator style={styles.spinner} />;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      // Scroll the focused field (and the Save button) above the keyboard instead of hiding them.
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Stack.Screen options={{ title: isExpense ? 'Edit Expense' : 'Edit Income' }} />

      {transaction?.recurring_id ? (
        <Text style={styles.recurringNote}>
          ↻ Posted by a monthly rule. Changes here apply to this month only; the rule keeps posting
          future months at its own amount. Moving it to another month leaves the original month
          empty for good.
        </Text>
      ) : null}

      <Text style={styles.label}>Amount ($) *</Text>
      <TextInput
        style={[styles.input, styles.amountInput]}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
      />
      {errors.amount ? <Text style={styles.error}>{errors.amount}</Text> : null}

      <Text style={styles.label}>{isExpense ? 'Paid on' : 'Received on'} *</Text>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}

      {isExpense ? (
        <>
          <Text style={styles.label}>Covers period (optional)</Text>
          <View style={styles.periodRow}>
            <TextInput
              style={[styles.input, styles.periodInput]}
              value={periodStart}
              onChangeText={setPeriodStart}
              placeholder="start YYYY-MM-DD"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.periodInput]}
              value={periodEnd}
              onChangeText={setPeriodEnd}
              placeholder="end YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
          {errors.period ? <Text style={styles.error}>{errors.period}</Text> : null}
        </>
      ) : null}

      <Text style={styles.label}>{isExpense ? 'Vendor' : 'Source'}</Text>
      <TextInput style={styles.input} value={party} onChangeText={setParty} />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} />

      <Pressable
        style={styles.saveButton}
        onPress={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        <Text style={styles.saveButtonText}>
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 4 },
  spinner: { marginTop: 40 },
  label: { ...ui.label },
  recurringNote: { ...type.label, fontSize: 12, marginBottom: 8, lineHeight: 16 },
  input: { ...ui.input, fontSize: 16 },
  amountInput: { ...money, fontSize: 26, fontWeight: '700' },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodInput: { flex: 1 },
  error: { ...ui.error, fontSize: 13 },
  saveButton: { ...ui.buttonPrimary, marginTop: 20 },
  saveButtonText: { ...ui.buttonPrimaryText },
});
