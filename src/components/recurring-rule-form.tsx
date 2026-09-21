// New recurring rule (README §4.1): property, category, amount, start month,
// end condition. On save: insert the rule, then immediately sync it so the
// first month(s) appear right away (README §4.2 "right after a rule is created").
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { listProperties } from '@/db/properties';
import { createRecurringRule, syncRule } from '@/db/recurring';
import { orderCategoriesByRecent } from '@/lib/add-transaction-state';
import { isValidISODate, monthKey, todayISO } from '@/lib/dates';
import {
  monthsToBackfill,
  validateRecurringRuleForm,
  type RecurringRuleValidation,
} from '@/lib/recurring-rule-validation';
import type { CategoryKind, EndMode } from '@/types';

interface Props {
  kind: CategoryKind;
  initialPropertyId?: string;
  onSaved: () => void;
}

export function RecurringRuleForm({ kind, initialPropertyId, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [startMonthText, setStartMonthText] = useState(monthKey(todayISO()));
  const [endMode, setEndMode] = useState<EndMode>('until_stopped');
  const [occurrencesText, setOccurrencesText] = useState('12');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<RecurringRuleValidation['errors']>({});

  const isExpense = kind === 'expense';

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: false }],
    queryFn: () => listProperties(),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const kindCategories = orderCategoriesByRecent(categories ?? [], [], kind);

  // Default to the only/first property when none was passed in.
  useEffect(() => {
    if (!propertyId && properties?.length) setPropertyId(properties[0].id);
  }, [properties, propertyId]);

  // Live preview of how many months will post immediately (finding 4) — independent of
  // full form validation so it updates as soon as the start month looks parseable.
  const trimmedStartMonth = startMonthText.trim();
  let pending = 0;
  if (/^\d{4}-\d{2}$/.test(trimmedStartMonth) && isValidISODate(`${trimmedStartMonth}-01`)) {
    pending = monthsToBackfill(`${trimmedStartMonth}-01`, todayISO());
    if (endMode === 'count') pending = Math.min(pending, Number(occurrencesText) || 0);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateRecurringRuleForm({
        propertyId,
        categoryId,
        amountText,
        startMonthText,
        endMode,
        occurrencesText,
      });
      setErrors(validation.errors);
      if (!validation.valid || validation.amount === undefined || !validation.startMonth) {
        throw Object.assign(new Error('validation'), { silent: true });
      }

      let willBackfill = monthsToBackfill(validation.startMonth, todayISO());
      if (endMode === 'count') willBackfill = Math.min(willBackfill, validation.occurrences!);
      if (willBackfill > 12) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            `Post ${willBackfill} months now?`,
            `This backfills ${willBackfill} entries immediately. Deleting the rule later keeps them.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue', onPress: () => resolve(true) },
            ]
          );
        });
        if (!proceed) throw Object.assign(new Error('cancelled'), { silent: true });
      }

      const rule = await createRecurringRule({
        property_id: propertyId!,
        category_id: categoryId!,
        kind,
        amount: validation.amount,
        notes: notes.trim() || null,
        start_month: validation.startMonth,
        end_mode: endMode,
        occurrences: endMode === 'count' ? validation.occurrences! : null,
      });
      try {
        return await syncRule(rule);
      } catch (e) {
        // The rule exists; the launch catch-up will post its months. Don't let the user re-create it.
        console.warn('recurring first sync failed', (e as Error).message);
        return null;
      }
    },
    onSuccess: (inserted) => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: [isExpense ? 'expenses' : 'income'] });
      if (inserted === null) {
        Alert.alert('Recurring rule saved', 'Entries will post the next time the app opens.', [
          { text: 'OK', onPress: onSaved },
        ]);
        return;
      }
      Alert.alert(
        'Recurring rule saved',
        inserted === 1 ? '1 entry was posted.' : `${inserted} entries were posted.`,
        [{ text: 'OK', onPress: onSaved }]
      );
    },
    onError: (e: Error & { silent?: boolean }) => {
      if (!e.silent) Alert.alert('Could not save rule', e.message);
    },
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      // Scroll the focused field (and the Save button) above the keyboard instead of hiding them.
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Text style={styles.help}>
        Posts one {kind} on the 1st of every month, starting from the month you pick, including
        past months up to today. You can edit or delete any single month afterwards.
      </Text>

      <Text style={styles.label}>Property *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipStrip}>
        {(properties ?? []).map((p) => (
          <Chip key={p.id} label={p.name} active={propertyId === p.id} onPress={() => setPropertyId(p.id)} />
        ))}
      </ScrollView>
      {errors.property ? <Text style={styles.error}>{errors.property}</Text> : null}

      <Text style={styles.label}>Category *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipStrip}>
        {kindCategories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>
      {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

      <Text style={styles.label}>Amount ($) each month *</Text>
      <TextInput
        style={[styles.input, styles.amountInput]}
        value={amountText}
        onChangeText={setAmountText}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />
      {errors.amount ? <Text style={styles.error}>{errors.amount}</Text> : null}

      <Text style={styles.label}>Start month *</Text>
      <TextInput
        style={styles.input}
        value={startMonthText}
        onChangeText={setStartMonthText}
        placeholder="YYYY-MM"
        autoCapitalize="none"
      />
      {errors.startMonth ? <Text style={styles.error}>{errors.startMonth}</Text> : null}
      {pending > 0 ? <Text style={styles.help}>Will post {pending} month(s) now</Text> : null}

      <Text style={styles.label}>Ends *</Text>
      <View style={styles.segment}>
        {(
          [
            ['until_stopped', 'Until I stop it'],
            ['count', 'After N months'],
          ] as const
        ).map(([mode, label]) => (
          <Pressable
            key={mode}
            style={[styles.segmentButton, endMode === mode && styles.segmentButtonActive]}
            onPress={() => setEndMode(mode)}
          >
            <Text style={endMode === mode ? styles.segmentTextActive : styles.segmentText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {endMode === 'count' ? (
        <>
          <Text style={styles.label}>Number of months *</Text>
          <TextInput
            style={styles.input}
            value={occurrencesText}
            onChangeText={setOccurrencesText}
            keyboardType="number-pad"
          />
          {errors.occurrences ? <Text style={styles.error}>{errors.occurrences}</Text> : null}
        </>
      ) : null}

      <Text style={styles.label}>Notes</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="optional" />

      <Pressable style={styles.saveButton} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Text style={styles.saveButtonText}>{saveMutation.isPending ? 'Saving…' : 'Save Recurring Rule'}</Text>
      </Pressable>
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
  container: { padding: 16, paddingBottom: 48 },
  help: { color: '#555', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  label: { fontSize: 13, color: '#555', marginTop: 12, marginBottom: 4 },
  chipStrip: { flexGrow: 0, flexShrink: 0 },
  chipRow: { gap: 6, paddingVertical: 4 },
  chip: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#2563eb', fontSize: 13 },
  chipTextActive: { color: '#fff', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  amountInput: { fontSize: 22, fontWeight: '600' },
  segment: { flexDirection: 'row', borderRadius: 8, backgroundColor: '#eee', padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  segmentButtonActive: { backgroundColor: '#fff' },
  segmentText: { color: '#666', fontSize: 14 },
  segmentTextActive: { color: '#111', fontSize: 14, fontWeight: '600' },
  saveButton: { marginTop: 20, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c0392b', fontSize: 12, marginTop: 4 },
});
