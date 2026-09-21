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
import { skipRecurringMonth } from '@/db/recurring';
import { confirmDelete } from '@/lib/confirm-delete';
import { formatMoney } from '@/lib/money';
import { buildTimeline, filterTimeline, type TimelineEntry } from '@/lib/timeline';
import { colors, money, type, ui } from '@/theme';

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
    mutationFn: async (entry: TimelineEntry) => {
      // Record the skip first: if the delete then fails the month is merely hidden
      // from future generation, whereas the reverse order could resurrect it.
      if (entry.recurring_id) await skipRecurringMonth(entry.recurring_id, entry.date);
      return entry.kind === 'expense' ? deleteExpense(entry.id) : deleteIncome(entry.id);
    },
    onSuccess: (_, entry) => {
      queryClient.invalidateQueries({ queryKey: [entry.kind === 'expense' ? 'expenses' : 'income'] });
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
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
      entry.recurring_id
        ? `${formatMoney(entry.amount)} on ${entry.date} - this month will not be posted again by its rule.`
        : `${formatMoney(entry.amount)} on ${entry.date} - this cannot be undone.`,
      () => deleteMutation.mutate(entry)
    );
  };

  const loading = loadingExpenses || loadingIncome;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: property?.name ?? 'Property' }} />

      <View style={styles.header}>
        <Link href={{ pathname: '/property/[id]/recurring', params: { id } }} asChild>
          <Pressable>
            <Text style={styles.editLink}>Recurring</Text>
          </Pressable>
        </Link>
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
          contentContainerStyle={styles.listContent}
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
                  <Text style={styles.rowCategory}>
                    {item.recurring_id ? '↻ ' : ''}
                    {categoryName(item.category_id)}
                  </Text>
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
  container: { ...ui.screen },
  // Home-indicator clearance so the last row is never cut off.
  listContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 16, paddingTop: 10 },
  editLink: { ...ui.link },
  // ScrollView defaults to flexShrink: 1, which lets the column squash the strip
  // under the date row; pin it to its content height.
  chipStrip: { flexGrow: 0, flexShrink: 0 },
  chipRow: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  chip: { ...ui.chip },
  chipActive: { ...ui.chipActive },
  chipText: { ...ui.chipText },
  chipTextActive: { ...ui.chipTextActive },
  dateRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  dateInput: { ...ui.input, flex: 1, fontSize: 14 },
  spinner: { marginTop: 32 },
  empty: { ...ui.empty },
  // The ledger: hairline-ruled rows, amounts in a right-hand column of tabular figures.
  row: { ...ui.row },
  rowText: { flex: 1 },
  rowCategory: { ...type.body, fontWeight: '600' },
  rowMeta: { ...type.hint, marginTop: 2 },
  amountIn: { ...money, color: colors.gain },
  amountOut: { ...money },
  deleteAction: { backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', width: 84 },
  deleteActionText: { color: colors.card, fontWeight: '700' },
});
