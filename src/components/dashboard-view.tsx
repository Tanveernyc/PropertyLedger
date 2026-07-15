// Dashboard presentation (Phase 11) — pure view over DashboardModel, no data
// fetching and no router imports, so tests can render it directly (empty-state
// render is a spec §5 Phase 11 test).
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DashboardModel } from '@/lib/dashboard';
import { formatMoney } from '@/lib/money';
import type { TimelineEntry } from '@/lib/timeline';

interface Props {
  model: DashboardModel;
  /** category_id → display name (falls back to the id when unknown). */
  categoryNames: Map<string, string>;
  onQuickAdd: () => void;
  onOpenProperty: (propertyId: string) => void;
  onOpenTransaction: (entry: TimelineEntry) => void;
}

export function DashboardView({
  model,
  categoryNames,
  onQuickAdd,
  onOpenProperty,
  onOpenTransaction,
}: Props) {
  const { yearPL, propertyCards, recent } = model;

  return (
    <ScrollView contentContainerStyle={styles.container} testID="dashboard">
      {/* Portfolio net this year */}
      <View style={styles.netCard}>
        <Text style={styles.netLabel}>Portfolio net · this year</Text>
        <Text style={[styles.netValue, yearPL.net < 0 && styles.netNegative]}>
          {formatMoney(yearPL.net)}
        </Text>
        <Text style={styles.netBreakdown}>
          {formatMoney(yearPL.totalIncome)} in · {formatMoney(yearPL.totalExpense)} out
        </Text>
      </View>

      <Pressable style={styles.quickAdd} onPress={onQuickAdd} accessibilityLabel="Quick add">
        <Text style={styles.quickAddText}>＋ Add expense or income</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Properties</Text>
      {propertyCards.length === 0 ? (
        <Text style={styles.empty}>No properties yet — add one on the Properties tab.</Text>
      ) : (
        propertyCards.map((card) => (
          <Pressable
            key={card.propertyId}
            style={styles.propertyCard}
            onPress={() => onOpenProperty(card.propertyId)}
          >
            <Text style={styles.propertyName}>{card.name}</Text>
            <View style={styles.propertyNumbers}>
              <Text style={styles.propertyIn}>{formatMoney(card.totalIncome)}</Text>
              <Text style={styles.propertyOut}>−{formatMoney(card.totalExpense)}</Text>
              <Text style={[styles.propertyNet, card.net < 0 && styles.netNegative]}>
                {formatMoney(card.net)}
              </Text>
            </View>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionTitle}>Recent activity</Text>
      {recent.length === 0 ? (
        <Text style={styles.empty}>No transactions yet.</Text>
      ) : (
        recent.map((entry) => (
          <Pressable
            key={`${entry.kind}-${entry.id}`}
            style={styles.recentRow}
            onPress={() => onOpenTransaction(entry)}
          >
            <View style={styles.recentText}>
              <Text style={styles.recentCategory}>
                {categoryNames.get(entry.category_id) ?? entry.category_id}
              </Text>
              <Text style={styles.recentMeta}>
                {entry.date}
                {entry.party ? ` · ${entry.party}` : ''}
              </Text>
            </View>
            <Text style={entry.kind === 'income' ? styles.amountIn : styles.amountOut}>
              {entry.kind === 'income' ? '+' : '−'}
              {formatMoney(entry.amount)}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 8 },
  netCard: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 18,
    gap: 4,
  },
  netLabel: { color: '#dbeafe', fontSize: 13 },
  netValue: { color: '#fff', fontSize: 32, fontWeight: '700' },
  netNegative: { color: '#fecaca' },
  netBreakdown: { color: '#dbeafe', fontSize: 13 },
  quickAdd: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickAddText: { color: '#2563eb', fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#666', marginTop: 10 },
  empty: { color: '#888', fontSize: 14 },
  propertyCard: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    backgroundColor: '#fff',
  },
  propertyName: { fontSize: 15, fontWeight: '600' },
  propertyNumbers: { flexDirection: 'row', justifyContent: 'space-between' },
  propertyIn: { color: '#16a34a', fontSize: 13 },
  propertyOut: { color: '#666', fontSize: 13 },
  propertyNet: { fontWeight: '700', fontSize: 13, color: '#111' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  recentText: { flex: 1 },
  recentCategory: { fontSize: 14, fontWeight: '600' },
  recentMeta: { fontSize: 12, color: '#777', marginTop: 2 },
  amountIn: { color: '#16a34a', fontWeight: '600' },
  amountOut: { color: '#111', fontWeight: '600' },
});
