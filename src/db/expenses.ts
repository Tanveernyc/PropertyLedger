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
