// Export screen (Phase 10) — "Export CSV": writes a CSV of every transaction and
// hands it to the native share sheet. This is the escape hatch that keeps the
// data portable (spec §5 Phase 10).
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { listAllExpenses } from '@/db/expenses';
import { listAllIncome } from '@/db/income';
import { listProperties } from '@/db/properties';
import { buildTransactionsCsv } from '@/lib/export';

export default function ExportScreen() {
  const [busy, setBusy] = useState(false);

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: true }],
    queryFn: () => listProperties({ includeArchived: true }),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const { data: expenses } = useQuery({ queryKey: ['expenses', 'all'], queryFn: listAllExpenses });
  const { data: income } = useQuery({ queryKey: ['income', 'all'], queryFn: listAllIncome });

  const ready = properties && categories && expenses && income;

  const exportAll = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const tables = { properties, categories, expenses, income };
      const stamp = new Date().toISOString().slice(0, 10);

      // Write the file to the app cache, then hand it to the share sheet.
      const csvFile = new File(Paths.cache, `propertyledger-transactions-${stamp}.csv`);
      csvFile.write(buildTransactionsCsv(tables));
      await Sharing.shareAsync(csvFile.uri, { mimeType: 'text/csv' });
    } catch (e) {
      Alert.alert('Export failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Export to CSV</Text>
      <Text style={styles.body}>
        Creates a spreadsheet-ready CSV of every income and expense entry across all
        your properties and opens the share sheet. Email it, save it to Files, or hand
        it to your accountant - your data is never locked in.
      </Text>
      <Pressable style={styles.button} onPress={exportAll} disabled={!ready || busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Export CSV</Text>
        )}
      </Pressable>
      {!ready ? <Text style={styles.loading}>Loading data…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#fff' },
  heading: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 14, color: '#555', lineHeight: 20 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loading: { color: '#888', textAlign: 'center' },
});
