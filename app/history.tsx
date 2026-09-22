// History & Trends screen (Phase 9) — pick property + category, see a line chart
// and a period table: total, change, % change. Math lives in calcCategoryTrend.
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { listCategories } from '@/db/categories';
import { listPropertyExpenses } from '@/db/expenses';
import { listProperties } from '@/db/properties';
import { calcCategoryTrend } from '@/lib/aggregate';
import { categoriesForLedger } from '@/lib/categories';
import { collectionNoun, kindsOf } from '@/lib/ledger-copy';
import { formatMoney } from '@/lib/money';
import { colors, money, ui } from '@/theme';

export default function HistoryScreen() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'year' | 'month'>('year');

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: true }],
    queryFn: () => listProperties({ includeArchived: true }),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const { data: expenses } = useQuery({
    queryKey: ['expenses', { propertyId }],
    queryFn: () => listPropertyExpenses(propertyId!),
    enabled: !!propertyId,
  });

  const selected = (properties ?? []).find((p) => p.id === propertyId);
  const expenseCategories = categoriesForLedger(categories ?? [], selected?.property_type ?? 'rental', 'expense');

  const trend = useMemo(
    () => (categoryId ? calcCategoryTrend(expenses ?? [], categoryId, groupBy) : []),
    [expenses, categoryId, groupBy]
  );

  // Chart wants numeric x; keep the period label alongside for the table.
  const chartData = trend.map((point, index) => ({ x: index, y: point.total }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>{collectionNoun(kindsOf(properties ?? []))}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {(properties ?? []).map((p) => (
          <Pressable
            key={p.id}
            style={[styles.chip, propertyId === p.id && styles.chipActive]}
            onPress={() => setPropertyId(p.id)}
          >
            <Text style={propertyId === p.id ? styles.chipTextActive : styles.chipText}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Expense category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {expenseCategories.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipActive]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={categoryId === c.id ? styles.chipTextActive : styles.chipText}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.groupByRow}>
        {(['year', 'month'] as const).map((g) => (
          <Pressable
            key={g}
            style={[styles.chip, groupBy === g && styles.chipActive]}
            onPress={() => setGroupBy(g)}
          >
            <Text style={groupBy === g ? styles.chipTextActive : styles.chipText}>
              By {g}
            </Text>
          </Pressable>
        ))}
      </View>

      {trend.length === 0 ? (
        <Text style={styles.empty}>
          {propertyId && categoryId
            ? 'No expenses for this category yet.'
            : `Pick a ${collectionNoun(kindsOf(properties ?? [])).toLowerCase()} and a category to see the trend.`}
        </Text>
      ) : (
        <>
          {/* Line chart needs 2+ points to draw a line */}
          {chartData.length >= 2 ? (
            <View style={styles.chartBox}>
              <CartesianChart data={chartData} xKey="x" yKeys={['y']}>
                {({ points }) => <Line points={points.y} color={colors.brass} strokeWidth={3} />}
              </CartesianChart>
            </View>
          ) : null}

          {/* Period table: period / amount / change / % change */}
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <Text style={[styles.cell, styles.headText]}>Period</Text>
              <Text style={[styles.cellRight, styles.headText]}>Total</Text>
              <Text style={[styles.cellRight, styles.headText]}>Change</Text>
              <Text style={[styles.cellRight, styles.headText]}>%</Text>
            </View>
            {trend.map((point) => (
              <View key={point.period} style={styles.tableRow}>
                <Text style={styles.cell}>{point.period}</Text>
                <Text style={styles.cellRight}>{formatMoney(point.total)}</Text>
                <Text style={[styles.cellRight, changeStyle(point.changeFromPrev)]}>
                  {point.changeFromPrev === null ? '-' : formatMoney(point.changeFromPrev)}
                </Text>
                <Text style={[styles.cellRight, changeStyle(point.changeFromPrev)]}>
                  {point.pctChangeFromPrev === null
                    ? '-'
                    : `${point.pctChangeFromPrev >= 0 ? '+' : ''}${point.pctChangeFromPrev.toFixed(1)}%`}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// Increases are red (costs went up), decreases green.
function changeStyle(change: number | null) {
  if (change === null) return undefined;
  return change > 0 ? styles.up : styles.down;
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 6 },
  label: { ...ui.label, marginTop: 8 },
  chipRow: { gap: 6, paddingVertical: 6 },
  groupByRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: { ...ui.chip },
  chipActive: { ...ui.chipActive },
  chipText: { ...ui.chipText },
  chipTextActive: { ...ui.chipTextActive },
  empty: { ...ui.empty, marginTop: 32 },
  chartBox: { height: 220, marginTop: 12 },
  table: { ...ui.card, marginTop: 12, overflow: 'hidden' },
  tableHead: { backgroundColor: colors.paper },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headText: { fontWeight: '700', color: colors.slate },
  cell: { flex: 1.2, fontSize: 13, color: colors.ink },
  cellRight: { ...money, flex: 1, fontSize: 13, fontWeight: '500', textAlign: 'right' },
  up: { color: colors.danger },
  down: { color: colors.gain },
});
