// Add tab — expense (Phase 5) and income (Phase 6) rapid entry behind one toggle.
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AddTransactionForm } from '@/components/add-transaction-form';
import type { CategoryKind } from '@/types';
import { colors, radius, ui } from '@/theme';

export default function AddScreen() {
  const [kind, setKind] = useState<CategoryKind>('expense');

  return (
    <View style={styles.container}>
      <View style={styles.segment}>
        {(['expense', 'income'] as const).map((k) => (
          <Pressable
            key={k}
            style={[styles.segmentButton, kind === k && styles.segmentButtonActive]}
            onPress={() => setKind(k)}
          >
            <Text style={kind === k ? styles.segmentTextActive : styles.segmentText}>
              {k === 'expense' ? 'Expense' : 'Income'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Link
        href={{ pathname: '/recurring/new', params: { kind } }}
        style={styles.recurringLink}
      >
        Repeats every month? Set up a recurring {kind} →
      </Link>
      {/* key remounts the form on switch so per-kind state starts clean */}
      <AddTransactionForm key={kind} kind={kind} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...ui.screen },
  segment: { flexDirection: 'row', margin: 12, borderRadius: radius.control, backgroundColor: colors.line, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentButtonActive: { backgroundColor: colors.card },
  segmentText: { color: colors.slate },
  segmentTextActive: { color: colors.ink, fontWeight: '600' },
  recurringLink: { ...ui.link, fontSize: 13, textAlign: 'center', marginBottom: 4 },
});
