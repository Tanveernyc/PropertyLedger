// Categories management screen (Phase 4): system + custom lists split by kind;
// add / rename / delete custom categories. Reached from the Dashboard.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createCategory, deleteCategory, listCategories, renameCategory } from '@/db/categories';
import { canDeleteCategory } from '@/lib/categories';
import type { Category, CategoryKind, CategoryScope } from '@/types';
import { colors, radius, type, ui } from '@/theme';

const SCOPE_CYCLE: CategoryScope[] = ['both', 'rental', 'personal'];
const SCOPE_LABELS: Record<CategoryScope, string> = {
  both: 'Both',
  rental: 'Rental',
  personal: 'Personal',
};

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CategoryKind>('expense');
  const [newScope, setNewScope] = useState<CategoryScope>('both');

  const { data, isPending, error } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] });
  const onError = (e: Error) => Alert.alert('Category error', e.message);

  const addMutation = useMutation({
    mutationFn: () => createCategory(newName, newKind, newScope),
    onSuccess: () => {
      setNewName('');
      invalidate();
    },
    onError,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameCategory(id, name),
    onSuccess: invalidate,
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
    onError,
  });

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error) return <Text style={styles.error}>{(error as Error).message}</Text>;

  const scopes: { scope: CategoryScope; label: string }[] = [
    { scope: 'both', label: 'Shared' },
    { scope: 'rental', label: 'Rental' },
    { scope: 'personal', label: 'Personal' },
  ];
  const sections = (['expense', 'income'] as const).flatMap((kind) =>
    scopes
      .map(({ scope, label }) => ({
        title: `${label} ${kind} categories`,
        data: (data ?? []).filter((c) => c.kind === kind && c.scope === scope),
      }))
      .filter((s) => s.data.length > 0)
  );

  const promptRename = (category: Category) => {
    // Alert.prompt is iOS-only; this app is iOS-first (spec §1).
    Alert.prompt('Rename category', category.name, (name) => {
      if (name && name.trim()) renameMutation.mutate({ id: category.id, name });
    });
  };

  const confirmDelete = (category: Category) => {
    Alert.alert('Delete category?', `"${category.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(category) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="New category name"
        />
        <Pressable
          style={styles.kindChip}
          onPress={() => setNewKind(newKind === 'expense' ? 'income' : 'expense')}
          accessibilityLabel="Toggle category kind"
        >
          <Text style={styles.kindChipText}>{newKind}</Text>
        </Pressable>
        <Pressable
          style={styles.kindChip}
          onPress={() =>
            setNewScope(SCOPE_CYCLE[(SCOPE_CYCLE.indexOf(newScope) + 1) % SCOPE_CYCLE.length])
          }
          accessibilityLabel="Toggle category scope"
        >
          <Text style={styles.kindChipText}>{SCOPE_LABELS[newScope]}</Text>
        </Pressable>
        <Pressable
          style={styles.addButton}
          disabled={addMutation.isPending || newName.trim().length === 0}
          onPress={() => addMutation.mutate()}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowName}>{item.name}</Text>
            {item.is_system ? (
              <Text style={styles.systemBadge}>system</Text>
            ) : (
              <View style={styles.rowActions}>
                <Pressable onPress={() => promptRename(item)}>
                  <Text style={styles.action}>Rename</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(item)} disabled={!canDeleteCategory(item)}>
                  <Text style={[styles.action, styles.deleteAction]}>Delete</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...ui.screen },
  spinner: { marginTop: 40 },
  error: { ...ui.error, padding: 16 },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    alignItems: 'center',
  },
  input: { ...ui.input, flex: 1, paddingVertical: 8 },
  kindChip: { ...ui.chipActive, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  kindChipText: { ...ui.chipTextActive },
  addButton: { backgroundColor: colors.ink, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: colors.card, fontWeight: '600' },
  sectionHeader: { ...type.label, fontWeight: '700', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  row: { ...ui.row, justifyContent: 'space-between' },
  rowName: { ...type.body },
  rowActions: { flexDirection: 'row', gap: 16 },
  action: { ...ui.link },
  deleteAction: { color: colors.danger },
  systemBadge: { fontSize: 12, color: colors.mist, fontStyle: 'italic' },
});
