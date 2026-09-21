// Per-property recurring rules: active and stopped, with Stop (README §4.4) and
// Delete (history kept via on delete set null). Edit → /recurring/[id] (amount/notes,
// README §4.3). New rule → /recurring/new modal.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { getProperty } from '@/db/properties';
import { deleteRecurringRule, listRecurringRules, stopRecurringRule } from '@/db/recurring';
import { confirmDelete } from '@/lib/confirm-delete';
import { monthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { RecurringRule } from '@/types';

export default function PropertyRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: property } = useQuery({ queryKey: ['property', id], queryFn: () => getProperty(id) });
  const { data: rules, isPending } = useQuery({
    queryKey: ['recurring', { propertyId: id }],
    queryFn: () => listRecurringRules(id),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
  };
  const stopMutation = useMutation({
    mutationFn: (ruleId: string) => stopRecurringRule(ruleId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not stop rule', e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteRecurringRule(ruleId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not delete rule', e.message),
  });

  const categoryName = (catId: string) => categories?.find((c) => c.id === catId)?.name ?? 'Unknown';
  const endsLabel = (r: RecurringRule) =>
    r.end_mode === 'count' ? `for ${r.occurrences} months` : r.stopped_on ? `stopped ${r.stopped_on}` : 'until stopped';

  const onStop = (r: RecurringRule) =>
    Alert.alert('Stop this rule?', 'No more months will be posted. Past entries are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => stopMutation.mutate(r.id) },
    ]);
  const onDelete = (r: RecurringRule) =>
    confirmDelete(
      'Delete this rule?',
      'Entries already posted stay in your ledger and still count toward totals.',
      () => deleteMutation.mutate(r.id)
    );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${property?.name ?? 'Property'} · Recurring` }} />
      <View style={styles.header}>
        <Link href={{ pathname: '/recurring/new', params: { kind: 'expense', propertyId: id } }} style={styles.link}>
          + Expense rule
        </Link>
        <Link href={{ pathname: '/recurring/new', params: { kind: 'income', propertyId: id } }} style={styles.link}>
          + Income rule
        </Link>
      </View>
      {isPending ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={rules}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<Text style={styles.empty}>No recurring rules for this property yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.row, !item.is_active && styles.rowInactive]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  {categoryName(item.category_id)} · {item.kind === 'income' ? '+' : '−'}
                  {formatMoney(item.amount)}/mo
                </Text>
                <Text style={styles.rowMeta}>
                  from {monthKey(item.start_month)} · {endsLabel(item)}
                  {item.notes ? ` · ${item.notes}` : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                {item.is_active ? (
                  <Link href={{ pathname: '/recurring/[id]', params: { id: item.id } }} style={styles.edit}>
                    Edit
                  </Link>
                ) : null}
                {item.is_active && item.end_mode === 'until_stopped' ? (
                  <Pressable onPress={() => onStop(item)}>
                    <Text style={styles.stop}>Stop</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => onDelete(item)}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 16, paddingVertical: 10 },
  link: { color: '#2563eb', fontSize: 14 },
  spinner: { marginTop: 32 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowInactive: { opacity: 0.55 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 14 },
  edit: { color: '#2563eb', fontSize: 14 },
  stop: { color: '#b45309', fontSize: 14 },
  delete: { color: '#dc2626', fontSize: 14 },
});
