// Add tab — expense (Phase 5) and income (Phase 6) rapid entry behind one toggle.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AddTransactionForm } from '@/components/add-transaction-form';
import type { CategoryKind } from '@/types';

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
      {/* key remounts the form on switch so per-kind state starts clean */}
      <AddTransactionForm key={kind} kind={kind} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  segment: {
    flexDirection: 'row',
    margin: 12,
    borderRadius: 8,
    backgroundColor: '#eee',
    padding: 3,
  },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  segmentButtonActive: { backgroundColor: '#fff' },
  segmentText: { color: '#666' },
  segmentTextActive: { color: '#111', fontWeight: '600' },
});
