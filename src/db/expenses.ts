// Data access for the expenses table.
import { supabase } from './supabase';
import type { Expense, NewExpense } from '@/types';

/** Inserts an expense for the signed-in user (RLS requires the explicit user_id). */
export async function createExpense(input: NewExpense): Promise<Expense> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...input, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

/** All expenses for a property, newest paid_on first (timeline source). */
export async function listPropertyExpenses(propertyId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('property_id', propertyId)
    .order('paid_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

/** One expense by id (for the edit screen). */
export async function getExpense(id: string): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Expense;
}

/** Updates editable fields on an expense. */
export async function updateExpense(id: string, patch: Partial<NewExpense>): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

/** Deletes an expense. Callers must confirm first (confirmDelete, spec §5 Phase 7). */
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}
