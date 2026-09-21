// Reports tab (Phase 8): portfolio-wide and per-property P&L for
// This Year / Last Year / All Time / Custom, plus expense-by-category totals.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { listAllExpenses } from '@/db/expenses';
import { listAllIncome } from '@/db/income';
import { listProperties } from '@/db/properties';
import {
  calcByCategory,
  calcPL,
  calcPLByProperty,
  lastMonthRange,
  lastYearRange,
  savingsRate,
  thisMonthRange,
  thisYearRange,
  type DateRange,
} from '@/lib/aggregate';
import { todayISO } from '@/lib/dates';
import { collectionNoun, kindsOf } from '@/lib/ledger-copy';
import { formatMoney } from '@/lib/money';
import { colors, money, type, ui } from '@/theme';

type Preset = 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'all-time' | 'custom';

export default function ReportsScreen() {
  const [preset, setPreset] = useState<Preset>('this-year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const defaultedRef = useRef(false);

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: true }],
    queryFn: () => listProperties({ includeArchived: true }),
  });
  const { data: expenses } = useQuery({ queryKey: ['expenses', 'all'], queryFn: listAllExpenses });
  const { data: income } = useQuery({ queryKey: ['income', 'all'], queryFn: listAllIncome });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  // Kind-aware default (spec §8.2): personal-only users land on This Month;
  // rental-only (and mixed) users keep This Year. Runs once, after properties load.
  useEffect(() => {
    if (defaultedRef.current || !properties) return;
    defaultedRef.current = true;
    const kinds = kindsOf(properties);
    if (kinds.length === 1 && kinds[0] === 'personal') {
      setPreset('this-month');
    }
  }, [properties]);

  const range: DateRange = useMemo(() => {
    switch (preset) {
      case 'this-month':
        return thisMonthRange(todayISO());
      case 'last-month':
        return lastMonthRange(todayISO());
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
  const rate = savingsRate(portfolio);
  const portfolioIsPersonal = kindsOf(properties ?? []).includes('personal');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.presets}>
        {(
          [
            ['this-month', 'This Month'],
            ['last-month', 'Last Month'],
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
        {portfolioIsPersonal ? (
          <>
            <PLRow label="Saved" value={portfolio.net} positive={portfolio.net >= 0} bold={false} />
            {rate !== null ? (
              <Text style={styles.savingsRate}>
                {rate >= 0 ? 'Savings rate' : 'Overspent by'} {Math.abs(Math.round(rate * 100))}% of
                income
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>By {collectionNoun(kindsOf(properties ?? [])).toLowerCase()}</Text>
      {perProperty.map((p) => {
        const isPersonal = properties?.find((pr) => pr.id === p.propertyId)?.property_type === 'personal';
        const cardRate = savingsRate(p);
        return (
          <View key={p.propertyId} style={styles.card}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <PLRow label="Income" value={p.totalIncome} positive />
            <PLRow label="Expenses" value={p.totalExpense} />
            <View style={styles.divider} />
            <PLRow label="Net" value={p.net} positive={p.net >= 0} bold />
            {isPersonal ? (
              <>
                <PLRow label="Saved" value={p.net} positive={p.net >= 0} bold={false} />
                {cardRate !== null ? (
                  <Text style={styles.savingsRate}>
                    {cardRate >= 0 ? 'Savings rate' : 'Overspent by'}{' '}
                    {Math.abs(Math.round(cardRate * 100))}% of income
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      <Link href="/history" style={styles.historyLink}>
        History &amp; trends - “did my insurance go up?” →
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
  presetChip: { ...ui.chip },
  presetChipActive: { ...ui.chipActive },
  presetText: { ...ui.chipText },
  presetTextActive: { ...ui.chipTextActive },
  customRow: { flexDirection: 'row', gap: 8 },
  dateInput: { ...ui.input, flex: 1, fontSize: 14 },
  card: { ...ui.card, padding: 14, gap: 6 },
  cardTitle: { ...type.body, fontWeight: '700', marginBottom: 4 },
  sectionTitle: { ...type.title, fontSize: 17, marginTop: 8 },
  plRow: { flexDirection: 'row', justifyContent: 'space-between' },
  plLabel: { ...type.label, fontSize: 14 },
  plValue: { ...money, fontSize: 14, fontWeight: '500' },
  plPositive: { ...money, fontSize: 14, fontWeight: '500', color: colors.gain },
  bold: { fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 4 },
  emptyText: { ...type.hint },
  historyLink: { ...ui.link, marginTop: 8 },
  savingsRate: { ...type.hint, textAlign: 'right' },
});
