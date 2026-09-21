// Modal: edit every field of a recurring rule (README §4.3, extended).
// By default a change applies only to months not yet posted. The switch at the
// bottom also rewrites months already posted from a chosen month onward - but
// never a month the user edited by hand (is_edited), and never a deleted one.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { listCategories } from '@/db/categories';
import { listProperties } from '@/db/properties';
import { applyRuleToPostedEntries, getRecurringRule, syncRule, updateRecurringRule } from '@/db/recurring';
import { orderCategoriesByRecent } from '@/lib/add-transaction-state';
import { isValidISODate, monthKey, todayISO } from '@/lib/dates';
import { collectionNoun, kindsOf, partyLabel } from '@/lib/ledger-copy';
import { validateRecurringRuleForm, type RecurringRuleValidation } from '@/lib/recurring-rule-validation';
import type { EndMode } from '@/types';
import { colors, money, type, ui } from '@/theme';

export default function EditRecurringRuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: rule, isPending } = useQuery({
    queryKey: ['recurring', 'rule', id],
    queryFn: () => getRecurringRule(id),
  });
  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: false }],
    queryFn: () => listProperties(),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [startMonthText, setStartMonthText] = useState('');
  const [endMode, setEndMode] = useState<EndMode>('until_stopped');
  const [occurrencesText, setOccurrencesText] = useState('');
  const [applyToPosted, setApplyToPosted] = useState(false);
  const [applyFromText, setApplyFromText] = useState(monthKey(todayISO()));
  const [errors, setErrors] = useState<RecurringRuleValidation['errors'] & { applyFrom?: string }>({});

  // Prefill once the row arrives.
  useEffect(() => {
    if (!rule) return;
    setPropertyId(rule.property_id);
    setCategoryId(rule.category_id);
    setAmountText(String(rule.amount));
    setParty(rule.party ?? '');
    setNotes(rule.notes ?? '');
    setStartMonthText(monthKey(rule.start_month));
    setEndMode(rule.end_mode);
    setOccurrencesText(rule.occurrences ? String(rule.occurrences) : '12');
  }, [rule]);

  const isExpense = rule?.kind === 'expense';
  const selectedLedger = (properties ?? []).find((p) => p.id === propertyId);
  const ledgerKind = selectedLedger?.property_type;
  const kindCategories = orderCategoriesByRecent(categories ?? [], [], rule?.kind ?? 'expense', ledgerKind);

  // Category selection tracks the selected ledger's scope; drop it if it no longer applies.
  useEffect(() => {
    if (categoryId && !kindCategories.some((c) => c.id === categoryId)) setCategoryId(null);
  }, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const nextErrors: typeof errors = { ...validation.errors };
      const applyFrom = applyFromText.trim();
      const applyFromValid = /^\d{4}-\d{2}$/.test(applyFrom) && isValidISODate(`${applyFrom}-01`);
      if (applyToPosted && !applyFromValid) nextErrors.applyFrom = 'Month must be YYYY-MM.';
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0 || validation.amount === undefined || !validation.startMonth) {
        throw Object.assign(new Error('validation'), { silent: true });
      }

      const updated = await updateRecurringRule(id, {
        property_id: propertyId!,
        category_id: categoryId!,
        amount: validation.amount,
        notes: notes.trim() || null,
        party: party.trim() || null,
        start_month: validation.startMonth,
        end_mode: endMode,
        occurrences: endMode === 'count' ? validation.occurrences! : null,
      });
      const rewritten = applyToPosted ? await applyRuleToPostedEntries(updated, `${applyFrom}-01`) : 0;
      // An earlier start month may now owe months; post them right away.
      const posted = await syncRule(updated);
      return { rewritten, posted };
    },
    onSuccess: ({ rewritten, posted }) => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['income'] });
      const parts: string[] = [];
      if (rewritten > 0) parts.push(`${rewritten} posted ${rewritten === 1 ? 'month' : 'months'} updated`);
      if (posted > 0) parts.push(`${posted} new ${posted === 1 ? 'month' : 'months'} posted`);
      if (parts.length === 0) {
        router.back();
        return;
      }
      Alert.alert('Rule saved', `${parts.join(', ')}.`, [{ text: 'OK', onPress: () => router.back() }]);
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
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
    >
      <Stack.Screen options={{ title: isExpense ? 'Edit Expense Rule' : 'Edit Income Rule' }} />

      <Text style={styles.help}>
        Changes apply to months that haven't been posted yet. To change months already in your
        ledger too, turn on the switch at the bottom.
      </Text>

      <Text style={styles.label}>{collectionNoun(kindsOf(properties ?? []))} *</Text>
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
        keyboardType="decimal-pad"
      />
      {errors.amount ? <Text style={styles.error}>{errors.amount}</Text> : null}

      <Text style={styles.label}>{partyLabel(ledgerKind ?? 'rental', rule?.kind ?? 'expense')}</Text>
      <TextInput
        style={styles.input}
        value={party}
        onChangeText={setParty}
        placeholder={
          isExpense
            ? ledgerKind === 'personal'
              ? "e.g. Trader Joe's"
              : 'e.g. Allstate'
            : 'e.g. tenant name'
        }
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="optional" />

      <Text style={styles.label}>Start month *</Text>
      <TextInput
        style={styles.input}
        value={startMonthText}
        onChangeText={setStartMonthText}
        placeholder="YYYY-MM"
        autoCapitalize="none"
      />
      {errors.startMonth ? <Text style={styles.error}>{errors.startMonth}</Text> : null}

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

      <View style={styles.applyCard}>
        <View style={styles.applyRow}>
          <View style={styles.applyText}>
            <Text style={styles.applyTitle}>Also update months already posted</Text>
            <Text style={styles.applyHint}>
              Rewrites this rule's posted entries with the new amount, {isExpense ? 'vendor' : 'source'},
              category and notes. Months you edited by hand are left alone.
            </Text>
          </View>
          <Switch value={applyToPosted} onValueChange={setApplyToPosted} trackColor={{ true: colors.brass }} />
        </View>
        {applyToPosted ? (
          <>
            <Text style={styles.label}>From month</Text>
            <TextInput
              style={styles.input}
              value={applyFromText}
              onChangeText={setApplyFromText}
              placeholder="YYYY-MM"
              autoCapitalize="none"
            />
            {errors.applyFrom ? <Text style={styles.error}>{errors.applyFrom}</Text> : null}
          </>
        ) : null}
      </View>

      <Pressable style={styles.saveButton} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Text style={styles.saveButtonText}>{saveMutation.isPending ? 'Saving…' : 'Save Changes'}</Text>
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
  spinner: { marginTop: 32 },
  help: { ...type.label, marginBottom: 8, lineHeight: 18 },
  label: { ...ui.label },
  chipStrip: { flexGrow: 0, flexShrink: 0 },
  chipRow: { gap: 6, paddingVertical: 4 },
  chip: { ...ui.chip },
  chipActive: { ...ui.chipActive },
  chipText: { ...ui.chipText },
  chipTextActive: { ...ui.chipTextActive },
  input: { ...ui.input },
  amountInput: { ...money, fontSize: 24, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 10, backgroundColor: colors.line, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentButtonActive: { backgroundColor: colors.card },
  segmentText: { color: colors.slate, fontSize: 14 },
  segmentTextActive: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  applyCard: { ...ui.card, padding: 14, marginTop: 20 },
  applyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  applyText: { flex: 1 },
  applyTitle: { ...type.body, fontWeight: '600' },
  applyHint: { ...type.hint, marginTop: 2, lineHeight: 17 },
  saveButton: { ...ui.buttonPrimary, marginTop: 20 },
  saveButtonText: { ...ui.buttonPrimaryText },
  error: { ...ui.error },
});
