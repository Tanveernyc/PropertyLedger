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
