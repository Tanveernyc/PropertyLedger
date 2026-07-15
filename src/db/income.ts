// Data access for the income table (mirror of expenses — spec §5 Phase 6).
import { supabase } from './supabase';
import type { Income, NewIncome } from '@/types';

/** Inserts an income entry for the signed-in user (RLS requires the explicit user_id). */
export async function createIncome(input: NewIncome): Promise<Income> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const { data, error } = await supabase
    .from('income')
    .insert({ ...input, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Income;
}

/** All income for a property, newest received_on first (timeline source). */
export async function listPropertyIncome(propertyId: string): Promise<Income[]> {
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .eq('property_id', propertyId)
    .order('received_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Income[];
}

/** One income entry by id (for the edit screen). */
export async function getIncome(id: string): Promise<Income> {
  const { data, error } = await supabase.from('income').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Income;
}

/** Updates editable fields on an income entry. */
export async function updateIncome(id: string, patch: Partial<NewIncome>): Promise<Income> {
  const { data, error } = await supabase
    .from('income')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Income;
}

/** Deletes an income entry. Callers must confirm first (confirmDelete, spec §5 Phase 7). */
export async function deleteIncome(id: string): Promise<void> {
  const { error } = await supabase.from('income').delete().eq('id', id);
  if (error) throw error;
}
