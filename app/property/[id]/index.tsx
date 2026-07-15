// Property transactions screen (Phase 7): expenses + income interleaved newest
// first, category and date-range filters, tap to edit, swipe to delete (confirmed).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { listCategories } from '@/db/categories';
import { deleteExpense, listPropertyExpenses } from '@/db/expenses';
import { deleteIncome, listPropertyIncome } from '@/db/income';
import { getProperty } from '@/db/properties';
import { confirmDelete } from '@/lib/confirm-delete';
import { formatMoney } from '@/lib/money';
import { buildTimeline, filterTimeline, type TimelineEntry } from '@/lib/timeline';

export default function PropertyTransactionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: property } = useQuery({ queryKey: ['property', id], queryFn: () => getProperty(id) });
  const { data: expenses, isPending: loadingExpenses } = useQuery({
    queryKey: ['expenses', { propertyId: id }],
    queryFn: () => listPropertyExpenses(id),
  });
  const { data: income, isPending: loadingIncome } = useQuery({
    queryKey: ['income', { propertyId: id }],
    queryFn: () => listPropertyIncome(id),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const deleteMutation = useMutation({
    mutationFn: (entry: TimelineEntry) =>
      entry.kind === 'expense' ? deleteExpense(entry.id) : deleteIncome(entry.id),
    onSuccess: (_, entry) => {
      queryClient.invalidateQueries({ queryKey: [entry.kind === 'expense' ? 'expenses' : 'income'] });
    },
    onError: (e: Error) => Alert.alert('Could not delete', e.message),
  });

  const timeline = useMemo(
    () =>
      filterTimeline(buildTimeline(expenses ?? [], income ?? []), {
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        categoryId,
      }),
    [expenses, income, from, to, categoryId]
  );

  const categoryName = (catId: string) =>
    categories?.find((c) => c.id === catId)?.name ?? 'Unknown';

  const onDelete = (entry: TimelineEntry) => {
    confirmDelete(
      `Delete this ${entry.kind}?`,
      `${formatMoney(entry.amount)} on ${entry.date} — this cannot be undone.`,
      () => deleteMutation.mutate(entry)
    );
  };

  const loading = loadingExpenses || loadingIncome;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: property?.name ?? 'Property' }} />

      <View style={styles.header}>
        <Link href={{ pathname: '/property/[id]/edit', params: { id } }} asChild>
          <Pressable>
            <Text style={styles.editLink}>Edit details</Text>
          </Pressable>
        </Link>
      </View>

      {/* Filters: category chips + inclusive date range */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipStrip}
      >
        <Pressable
          style={[styles.chip, !categoryId && styles.chipActive]}
          onPress={() => setCategoryId(undefined)}
        >
          <Text style={!categoryId ? styles.chipTextActive : styles.chipText}>All</Text>
        </Pressable>
        {(categories ?? []).map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipActive]}
            onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)}
          >
            <Text style={categoryId === c.id ? styles.chipTextActive : styles.chipText}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dateRow}>
        <TextInput
          style={styles.dateInput}
          value={from}
          onChangeText={setFrom}
          placeholder="from YYYY-MM-DD"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.dateInput}
          value={to}
          onChangeText={setTo}
          placeholder="to YYYY-MM-DD"
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={timeline}
          keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
          ListEmptyComponent={<Text style={styles.empty}>No transactions match.</Text>}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => (
                <Pressable style={styles.deleteAction} onPress={() => onDelete(item)}>
                  <Text style={styles.deleteActionText}>Delete</Text>
                </Pressable>
              )}
            >
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: '/transaction/[kind]/[id]',
                    params: { kind: item.kind, id: item.id },
                  })
                }
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowCategory}>{categoryName(item.category_id)}</Text>
                  <Text style={styles.rowMeta}>
                    {item.date}
                    {item.party ? ` · ${item.party}` : ''}
                  </Text>
                </View>
                <Text style={item.kind === 'income' ? styles.amountIn : styles.amountOut}>
                  {item.kind === 'income' ? '+' : '−'}
                  {formatMoney(item.amount)}
                </Text>
              </Pressable>
            </Swipeable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  editLink: { color: '#2563eb', fontSize: 14 },
  chipStrip: { flexGrow: 0 },
  chipRow: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#2563eb', fontSize: 13 },
  chipTextActive: { color: '#fff', fontSize: 13 },
  dateRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  spinner: { marginTop: 32 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowText: { flex: 1 },
  rowCategory: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  amountIn: { color: '#16a34a', fontWeight: '600', fontSize: 15 },
  amountOut: { color: '#111', fontWeight: '600', fontSize: 15 },
  deleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 84,
  },
  deleteActionText: { color: '#fff', fontWeight: '700' },
});
