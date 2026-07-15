// Data access for the categories table. RLS lets the user read system rows plus
// their own, and mutate only their own; deletion of system rows is also blocked
// client-side (canDeleteCategory) for a clear error instead of a silent no-op.
import { supabase } from './supabase';
import { canDeleteCategory } from '@/lib/categories';
import type { Category, CategoryKind } from '@/types';

/** All categories visible to the user (system + custom), stable name order. */
export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}

/** Creates a custom category owned by the signed-in user. */
export async function createCategory(name: string, kind: CategoryKind): Promise<Category> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim(), kind, user_id: userData.user.id, is_system: false })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

/** Renames a custom category (RLS rejects updates to system rows). */
export async function renameCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

/**
 * Deletes a custom category. System categories are rejected before any network
 * call — they are seeded shared data (spec §5 Phase 4).
 */
export async function deleteCategory(category: Category): Promise<void> {
  if (!canDeleteCategory(category)) {
    throw new Error('System categories cannot be deleted.');
  }
  const { error } = await supabase.from('categories').delete().eq('id', category.id);
  if (error) throw error;
}
