// Add Expense tab (Phase 5) — the most-used screen; optimized for rapid entry:
// property defaults to last used, categories are recent-first, and a save keeps
// property/category so ten bills are ten "amount → save" taps (spec §5 Phase 5).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { listCategories } from '@/db/categories';
import { createExpense } from '@/db/expenses';
import { listProperties } from '@/db/properties';
import {
  initialAddState,
  orderCategoriesByRecent,
  pushRecentCategory,
  resetAfterSave,
  type AddTransactionState,
} from '@/lib/add-transaction-state';
import { validateTransactionForm, type TransactionValidation } from '@/lib/expense-validation';

// AsyncStorage keys for the "defaults to last used" behavior.
const LAST_PROPERTY_KEY = 'add:last-property-id';
const RECENT_CATEGORIES_KEY = 'add:recent-expense-category-ids';

export default function AddExpenseScreen() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AddTransactionState>(initialAddState);
  const [recentCategoryIds, setRecentCategoryIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<TransactionValidation['errors']>({});
  const [savedFlash, setSavedFlash] = useState(false);

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: false }],
    queryFn: () => listProperties(),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  // Restore last-used property + recent categories once on mount.
  useEffect(() => {
    (async () => {
      const [lastProperty, recentJson] = await Promise.all([
        AsyncStorage.getItem(LAST_PROPERTY_KEY),
        AsyncStorage.getItem(RECENT_CATEGORIES_KEY),
      ]);
      if (lastProperty) setState((s) => ({ ...s, propertyId: lastProperty }));
      if (recentJson) setRecentCategoryIds(JSON.parse(recentJson));
    })();
  }, []);

  const expenseCategories = orderCategoriesByRecent(categories ?? [], recentCategoryIds, 'expense');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateTransactionForm({
        amountText: state.amountText,
        date: state.date,
        propertyId: state.propertyId,
        categoryId: state.categoryId,
        periodStart: state.periodStart,
        periodEnd: state.periodEnd,
      });
      setErrors(validation.errors);
      if (!validation.valid || validation.amount === undefined) {
        throw Object.assign(new Error('validation'), { silent: true });
      }
      return createExpense({
        property_id: state.propertyId!,
        category_id: state.categoryId!,
        amount: validation.amount,
        paid_on: state.date.trim(),
        period_start: state.periodStart.trim() || null,
        period_end: state.periodEnd.trim() || null,
        vendor: state.vendor.trim() || null,
        notes: state.notes.trim() || null,
      });
    },
    onSuccess: () => {
      // Stay on the screen; clear the per-bill fields, keep property/category.
      const recents = pushRecentCategory(recentCategoryIds, state.categoryId!);
      setRecentCategoryIds(recents);
      AsyncStorage.setItem(LAST_PROPERTY_KEY, state.propertyId!);
      AsyncStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(recents));
      setState(resetAfterSave(state));
      setErrors({});
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (e: Error & { silent?: boolean }) => {
      if (!e.silent) Alert.alert('Could not save expense', e.message);
    },
  });

  const set = (patch: Partial<AddTransactionState>) => setState((s) => ({ ...s, ...patch }));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Property *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {(properties ?? []).map((p) => (
          <Chip
            key={p.id}
            label={p.name}
            active={state.propertyId === p.id}
            onPress={() => set({ propertyId: p.id })}
          />
        ))}
      </ScrollView>
      {errors.property ? <Text style={styles.error}>{errors.property}</Text> : null}

      <Text style={styles.label}>Category * (recent first)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {expenseCategories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={state.categoryId === c.id}
            onPress={() => set({ categoryId: c.id })}
          />
        ))}
      </ScrollView>
      {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

      <Text style={styles.label}>Amount ($) *</Text>
      <TextInput
        style={[styles.input, styles.amountInput]}
        value={state.amountText}
        onChangeText={(amountText) => set({ amountText })}
        placeholder="0.00"
        keyboardType="decimal-pad"
        accessibilityLabel="Amount"
      />
      {errors.amount ? <Text style={styles.error}>{errors.amount}</Text> : null}

      <Text style={styles.label}>Paid on *</Text>
      <TextInput
        style={styles.input}
        value={state.date}
        onChangeText={(date) => set({ date })}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}

      <Text style={styles.label}>Covers period (optional)</Text>
      <View style={styles.periodRow}>
        <TextInput
          style={[styles.input, styles.periodInput]}
          value={state.periodStart}
          onChangeText={(periodStart) => set({ periodStart })}
          placeholder="start YYYY-MM-DD"
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.periodInput]}
          value={state.periodEnd}
          onChangeText={(periodEnd) => set({ periodEnd })}
          placeholder="end YYYY-MM-DD"
          autoCapitalize="none"
        />
      </View>
      {errors.period ? <Text style={styles.error}>{errors.period}</Text> : null}

      <Text style={styles.label}>Vendor</Text>
      <TextInput
        style={styles.input}
        value={state.vendor}
        onChangeText={(vendor) => set({ vendor })}
        placeholder="e.g. Allstate"
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.input}
        value={state.notes}
        onChangeText={(notes) => set({ notes })}
        placeholder="optional"
      />

      <Pressable
        style={styles.saveButton}
        onPress={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        <Text style={styles.saveButtonText}>
          {saveMutation.isPending ? 'Saving…' : 'Save Expense'}
        </Text>
      </Pressable>
      {savedFlash ? <Text style={styles.savedFlash}>Saved ✓</Text> : null}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 12 },
  chipRow: { gap: 8, paddingVertical: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#2563eb' },
  chipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  amountInput: { fontSize: 24, fontWeight: '600' },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodInput: { flex: 1 },
  error: { color: '#c0392b', fontSize: 13, marginTop: 2 },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  savedFlash: { color: '#16a34a', textAlign: 'center', marginTop: 8, fontWeight: '600' },
});
