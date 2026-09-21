// Properties tab (Phase 3): list with archived toggle, links to create and edit.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { listProperties } from '@/db/properties';
import type { Property } from '@/types';
import { colors, radius, type, ui } from '@/theme';
import { useState } from 'react';

export default function PropertiesScreen() {
  const [showArchived, setShowArchived] = useState(false);

  // Query key includes the toggle so both views cache independently.
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['properties', { includeArchived: showArchived }],
    queryFn: () => listProperties({ includeArchived: showArchived }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show archived</Text>
          <Switch value={showArchived} onValueChange={setShowArchived} />
        </View>
        <Link href="/property/new" asChild>
          <Pressable style={styles.addButton} accessibilityLabel="Add property">
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </Link>
      </View>

      {error ? <Text style={styles.error}>{(error as Error).message}</Text> : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={data ?? []}
        keyExtractor={(item) => item.id}
        refreshing={isPending}
        onRefresh={refetch}
        ListEmptyComponent={
          isPending ? null : (
            <Text style={styles.empty}>
              {showArchived ? 'No properties yet.' : 'No active properties. Add one to start.'}
            </Text>
          )
        }
        renderItem={({ item }) => <PropertyRow property={item} />}
      />
    </View>
  );
}

function PropertyRow({ property }: { property: Property }) {
  return (
    <Link href={{ pathname: '/property/[id]', params: { id: property.id } }} asChild>
      <Pressable style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowName}>{property.name}</Text>
          <Text style={styles.rowMeta}>
            {property.property_type}
            {property.address ? ` · ${property.address}` : ''}
          </Text>
        </View>
        {property.is_archived ? <Text style={styles.archivedBadge}>archived</Text> : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { ...ui.screen },
  // Cards sit on the paper background; bottom clearance for the home indicator.
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { ...type.label, fontSize: 14 },
  addButton: { backgroundColor: colors.ink, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: colors.card, fontWeight: '600' },
  row: { ...ui.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowText: { flex: 1 },
  rowName: { ...type.body, fontSize: 16, fontWeight: '600' },
  rowMeta: { ...type.hint, marginTop: 2 },
  archivedBadge: { fontSize: 12, color: colors.mist, fontStyle: 'italic' },
  empty: { ...ui.empty, paddingHorizontal: 24 },
  error: { ...ui.error, padding: 12 },
});
