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
import { canDeleteCategory, splitCategoriesByKind } from '@/lib/categories';
import type { Category, CategoryKind } from '@/types';

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CategoryKind>('expense');

  const { data, isPending, error } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] });
  const onError = (e: Error) => Alert.alert('Category error', e.message);

  const addMutation = useMutation({
    mutationFn: () => createCategory(newName, newKind),
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

  const byKind = splitCategoriesByKind(data ?? []);
  const sections = [
    { title: 'Expense categories', data: byKind.expense },
    { title: 'Income categories', data: byKind.income },
  ];

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
  container: { flex: 1, backgroundColor: '#fff' },
  spinner: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16 },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kindChip: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  kindChipText: { color: '#2563eb', fontSize: 13 },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    backgroundColor: '#f6f6f6',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowName: { fontSize: 15 },
  rowActions: { flexDirection: 'row', gap: 16 },
  action: { color: '#2563eb', fontSize: 14 },
  deleteAction: { color: '#c0392b' },
  systemBadge: { fontSize: 12, color: '#999', fontStyle: 'italic' },
});
