// Reports tab (Phase 8): portfolio-wide and per-property P&L for
// This Year / Last Year / All Time / Custom, plus expense-by-category totals.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { listAllExpenses } from '@/db/expenses';
import { listAllIncome } from '@/db/income';
import { listProperties } from '@/db/properties';
import {
  calcByCategory,
  calcPL,
  calcPLByProperty,
  lastYearRange,
  thisYearRange,
  type DateRange,
} from '@/lib/aggregate';
import { todayISO } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

type Preset = 'this-year' | 'last-year' | 'all-time' | 'custom';

export default function ReportsScreen() {
  const [preset, setPreset] = useState<Preset>('this-year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: true }],
    queryFn: () => listProperties({ includeArchived: true }),
  });
  const { data: expenses } = useQuery({ queryKey: ['expenses', 'all'], queryFn: listAllExpenses });
  const { data: income } = useQuery({ queryKey: ['income', 'all'], queryFn: listAllIncome });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const range: DateRange = useMemo(() => {
    switch (preset) {
      case 'this-year':
        return thisYearRange(todayISO());
      case 'last-year':
        return lastYearRange(todayISO());
      case 'all-time':
        return {};
      case 'custom':
        return { from: customFrom.trim() || undefined, to: customTo.trim() || undefined };
    }
  }, [preset, customFrom, customTo]);

  // All math is delegated to src/lib/aggregate.ts (spec §4: no inline arithmetic).
  const portfolio = calcPL(expenses ?? [], income ?? [], range);
  const perProperty = calcPLByProperty(properties ?? [], expenses ?? [], income ?? [], range);
  const byCategory = calcByCategory(expenses ?? [], range, categories ?? []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.presets}>
        {(
          [
            ['this-year', 'This Year'],
            ['last-year', 'Last Year'],
            ['all-time', 'All Time'],
            ['custom', 'Custom'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.presetChip, preset === value && styles.presetChipActive]}
            onPress={() => setPreset(value)}
          >
            <Text style={preset === value ? styles.presetTextActive : styles.presetText}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {preset === 'custom' ? (
        <View style={styles.customRow}>
          <TextInput
            style={styles.dateInput}
            value={customFrom}
            onChangeText={setCustomFrom}
            placeholder="from YYYY-MM-DD"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.dateInput}
            value={customTo}
            onChangeText={setCustomTo}
            placeholder="to YYYY-MM-DD"
            autoCapitalize="none"
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Portfolio</Text>
        <PLRow label="Income" value={portfolio.totalIncome} positive />
        <PLRow label="Expenses" value={portfolio.totalExpense} />
        <View style={styles.divider} />
        <PLRow label="Net" value={portfolio.net} positive={portfolio.net >= 0} bold />
      </View>

      <Text style={styles.sectionTitle}>By property</Text>
      {perProperty.map((p) => (
        <View key={p.propertyId} style={styles.card}>
          <Text style={styles.cardTitle}>{p.name}</Text>
          <PLRow label="Income" value={p.totalIncome} positive />
          <PLRow label="Expenses" value={p.totalExpense} />
          <View style={styles.divider} />
          <PLRow label="Net" value={p.net} positive={p.net >= 0} bold />
        </View>
      ))}

      <Link href="/history" style={styles.historyLink}>
        History &amp; trends — “did my insurance go up?” →
      </Link>

      <Text style={styles.sectionTitle}>Expenses by category</Text>
      <View style={styles.card}>
        {byCategory.length === 0 ? (
          <Text style={styles.emptyText}>No expenses in this range.</Text>
        ) : (
          byCategory.map((c) => <PLRow key={c.categoryId} label={c.name} value={c.total} />)
        )}
      </View>
    </ScrollView>
  );
}

function PLRow({
  label,
  value,
  positive = false,
  bold = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={styles.plRow}>
      <Text style={[styles.plLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[positive ? styles.plPositive : styles.plValue, bold && styles.bold]}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 10 },
  presets: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  presetChip: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipActive: { backgroundColor: '#2563eb' },
  presetText: { color: '#2563eb', fontSize: 13 },
  presetTextActive: { color: '#fff', fontSize: 13 },
  customRow: { flexDirection: 'row', gap: 8 },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 14,
    gap: 6,
    backgroundColor: '#fff',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#666', marginTop: 8 },
  plRow: { flexDirection: 'row', justifyContent: 'space-between' },
  plLabel: { fontSize: 14, color: '#444' },
  plValue: { fontSize: 14, color: '#111' },
  plPositive: { fontSize: 14, color: '#16a34a' },
  bold: { fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ddd', marginVertical: 4 },
  emptyText: { color: '#888' },
  historyLink: { color: '#2563eb', fontSize: 14, marginTop: 8 },
});
