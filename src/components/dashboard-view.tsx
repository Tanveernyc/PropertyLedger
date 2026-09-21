// Dashboard presentation (Phase 11) — pure view over DashboardModel, no data
// fetching and no router imports, so tests can render it directly (empty-state
// render is a spec §5 Phase 11 test).
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DashboardModel } from '@/lib/dashboard';
import { formatMoney } from '@/lib/money';
import type { TimelineEntry } from '@/lib/timeline';
import { colors, money, radius, type, ui } from '@/theme';

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
        <Text style={styles.netLabel}>Net this year, all properties</Text>
        <Text style={[styles.netValue, yearPL.net < 0 && styles.netNegative]}>
          {formatMoney(yearPL.net)}
        </Text>
        <View style={styles.netRow}>
          <Text style={styles.netBreakdown}>In {formatMoney(yearPL.totalIncome)}</Text>
          <Text style={styles.netBreakdown}>Out {formatMoney(yearPL.totalExpense)}</Text>
        </View>
      </View>

      <Pressable style={styles.quickAdd} onPress={onQuickAdd} accessibilityLabel="Quick add">
        <Text style={styles.quickAddText}>Add expense or income</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Properties</Text>
      {propertyCards.length === 0 ? (
        <Text style={styles.empty}>No properties yet - add one on the Properties tab.</Text>
      ) : (
        propertyCards.map((card) => (
          <Pressable
            key={card.propertyId}
            style={styles.propertyCard}
            onPress={() => onOpenProperty(card.propertyId)}
          >
            <Text style={styles.propertyName}>{card.name}</Text>
            <View style={styles.propertyNumbers}>
              <Text style={styles.propertyIn}>+{formatMoney(card.totalIncome)}</Text>
              <Text style={styles.propertyOut}>−{formatMoney(card.totalExpense)}</Text>
              <Text style={[styles.propertyNet, card.net < 0 && styles.propertyNetNegative]}>
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
  container: { padding: 16, paddingBottom: 48, gap: 10 },
  // The one loud thing on the screen: the year's bottom line, in ink on ink.
  netCard: { backgroundColor: colors.ink, borderRadius: radius.card, padding: 20, gap: 6 },
  netLabel: { color: '#B8C0D0', fontSize: 13 },
  netValue: { ...money, color: colors.card, fontSize: 36, fontWeight: '700', letterSpacing: -0.8 },
  netNegative: { color: '#F2B8B5' },
  netRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  netBreakdown: { ...money, color: '#B8C0D0', fontSize: 13, fontWeight: '500' },
  quickAdd: { ...ui.buttonSecondary },
  quickAddText: { ...ui.buttonSecondaryText, color: colors.brass },
  sectionTitle: { ...type.title, fontSize: 17, marginTop: 8 },
  empty: { ...type.hint, fontSize: 14 },
  propertyCard: { ...ui.card, padding: 14, gap: 8 },
  propertyName: { ...type.body, fontWeight: '600' },
  propertyNumbers: { flexDirection: 'row', justifyContent: 'space-between' },
  propertyIn: { ...money, color: colors.gain, fontSize: 13, fontWeight: '500' },
  propertyOut: { ...money, color: colors.slate, fontSize: 13, fontWeight: '500' },
  propertyNet: { ...money, fontSize: 13, fontWeight: '700' },
  propertyNetNegative: { color: colors.danger },
  recentRow: {
    ...ui.row,
    paddingHorizontal: 14,
    borderBottomWidth: 0,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  recentText: { flex: 1 },
  recentCategory: { ...type.body, fontWeight: '600' },
  recentMeta: { ...type.hint, fontSize: 12, marginTop: 2 },
  amountIn: { ...money, color: colors.gain },
  amountOut: { ...money },
});
