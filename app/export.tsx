// Export screen (Phase 10) — "Export All Data": writes a JSON of every table and
// a CSV of transactions, then hands both to the native share sheet. This is the
// escape hatch that keeps the data portable (spec §5 Phase 10).
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { listAllExpenses } from '@/db/expenses';
import { listAllIncome } from '@/db/income';
import { listProperties } from '@/db/properties';
import { buildExportJson, buildTransactionsCsv } from '@/lib/export';

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

      // Write both files to the app cache, then share them one after the other
      // (the iOS share sheet takes one payload at a time).
      const jsonFile = new File(Paths.cache, `propertyledger-export-${stamp}.json`);
      jsonFile.write(JSON.stringify(buildExportJson(tables, new Date().toISOString()), null, 2));

      const csvFile = new File(Paths.cache, `propertyledger-transactions-${stamp}.csv`);
      csvFile.write(buildTransactionsCsv(tables));

      await Sharing.shareAsync(jsonFile.uri, { mimeType: 'application/json' });
      await Sharing.shareAsync(csvFile.uri, { mimeType: 'text/csv' });
    } catch (e) {
      Alert.alert('Export failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Export All Data</Text>
      <Text style={styles.body}>
        Produces two files via the share sheet: a JSON snapshot of every table
        (properties, categories, expenses, income) and a spreadsheet-ready CSV of
        all transactions. Save them anywhere — your data is never locked in.
      </Text>
      <Pressable style={styles.button} onPress={exportAll} disabled={!ready || busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Export All Data</Text>
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
