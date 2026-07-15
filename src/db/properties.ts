// Data access for the properties table. Screens never talk to supabase directly
// for property data — they go through these functions (tested with a mocked client).
import { supabase } from './supabase';
import type { NewProperty, Property } from '@/types';

/**
 * Lists properties (name order). Archived rows are excluded unless explicitly
 * requested — archiving hides a sold property without losing its history.
 */
export async function listProperties(
  opts: { includeArchived?: boolean } = {}
): Promise<Property[]> {
  let query = supabase.from('properties').select('*').order('name');
  if (!opts.includeArchived) query = query.eq('is_archived', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Property[];
}

/** Fetches one property by id (RLS guarantees it belongs to the signed-in user). */
export async function getProperty(id: string): Promise<Property> {
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Property;
}

/**
 * Creates a property for the signed-in user. user_id is set explicitly because
 * the schema has no default and the RLS WITH CHECK requires auth.uid() = user_id.
 */
export async function createProperty(input: NewProperty): Promise<Property> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const { data, error } = await supabase
    .from('properties')
    .insert({ ...input, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Property;
}

/** Updates editable fields on a property. */
export async function updateProperty(
  id: string,
  patch: Partial<NewProperty>
): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Property;
}

/**
 * Archives/unarchives a property. This is an UPDATE of is_archived — properties
 * are never deleted (sell a property, keep the records; spec §3 design note).
 */
export async function setPropertyArchived(id: string, archived: boolean): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .update({ is_archived: archived })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Property;
}
