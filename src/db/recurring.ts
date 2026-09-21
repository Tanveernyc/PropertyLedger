// Data access for recurring_rules + the network wrapper around the pure engine.
// syncRecurringEntries() is the only place generated rows are inserted; it runs
// on app launch (tabs layout) and right after a rule is created (README §4.2).
import { supabase } from './supabase';
import { createExpenses, listExpensesForRule } from './expenses';
import { createIncomes, listIncomeForRule } from './income';
import { firstOfMonth, todayISO } from '@/lib/dates';
import { generateDueEntries } from '@/lib/recurring';
import type { NewRecurringRule, RecurringRule } from '@/types';

/** Inserts a rule for the signed-in user (RLS requires the explicit user_id). */
export async function createRecurringRule(input: NewRecurringRule): Promise<RecurringRule> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({ ...input, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

/** All rules (active and stopped), newest first; optionally for one property. */
export async function listRecurringRules(propertyId?: string): Promise<RecurringRule[]> {
  // .eq() lives on the filter builder, so apply it before .order() (a transform).
  let query = supabase.from('recurring_rules').select('*');
  if (propertyId) query = query.eq('property_id', propertyId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecurringRule[];
}

/** One rule by id. */
export async function getRecurringRule(id: string): Promise<RecurringRule> {
  const { data, error } = await supabase.from('recurring_rules').select('*').eq('id', id).single();
  if (error) throw error;
  return data as RecurringRule;
}

/** Fields a user may change on a rule. Affects months not yet generated (README §4.3)
 *  unless the caller also runs applyRuleToPostedEntries. */
export type RecurringRulePatch = Partial<
  Pick<
    NewRecurringRule,
    'amount' | 'notes' | 'party' | 'category_id' | 'property_id' | 'start_month' | 'end_mode' | 'occurrences'
  >
>;

export async function updateRecurringRule(id: string, patch: RecurringRulePatch): Promise<RecurringRule> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

/** README §4.4: stopped_on = today, is_active = false. Past entries are kept. */
export async function stopRecurringRule(id: string, today: string = todayISO()): Promise<RecurringRule> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .update({ stopped_on: today, is_active: false })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

/** Deletes the rule; generated rows survive via `on delete set null` (README §4.4). Confirm first. */
export async function deleteRecurringRule(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_rules').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Records that the user deleted a generated month so the engine never re-posts it
 * (README §4.3). Callers pass the deleted row's paid_on / received_on; any day in
 * the month is fine. Idempotent: re-adding an already-skipped month is a no-op.
 */
export async function skipRecurringMonth(ruleId: string, dateIso: string): Promise<RecurringRule> {
  const rule = await getRecurringRule(ruleId);
  const month = firstOfMonth(dateIso);
  if (rule.skipped_months.includes(month)) return rule;
  const { data, error } = await supabase
    .from('recurring_rules')
    .update({ skipped_months: [...rule.skipped_months, month] })
    .eq('id', ruleId)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringRule;
}

/** Generates and inserts every missing month for one rule. Returns rows inserted. */
export async function syncRule(rule: RecurringRule, today: string = todayISO()): Promise<number> {
  if (rule.kind === 'expense') {
    const existing = await listExpensesForRule(rule.id);
    const due = generateDueEntries(
      rule,
      [...existing.map((e) => e.paid_on), ...rule.skipped_months],
      today
    );
    const inserted = await createExpenses(
      due.map((d) => ({
        property_id: d.property_id,
        category_id: d.category_id,
        amount: d.amount,
        notes: d.notes,
        vendor: d.party,
        paid_on: d.date,
        recurring_id: d.recurring_id,
        is_edited: false,
      }))
    );
    return inserted.length;
  }
  const existing = await listIncomeForRule(rule.id);
  const due = generateDueEntries(
    rule,
    [...existing.map((i) => i.received_on), ...rule.skipped_months],
    today
  );
  const inserted = await createIncomes(
    due.map((d) => ({
      property_id: d.property_id,
      category_id: d.category_id,
      amount: d.amount,
      notes: d.notes,
      source: d.party,
      received_on: d.date,
      recurring_id: d.recurring_id,
      is_edited: false,
    }))
  );
  return inserted.length;
}

/** Catch-up for every active rule the user owns. Returns total rows inserted.
 *  A rule that fails is logged and skipped so the rest still post; it is retried on the next launch. */
export async function syncRecurringEntries(today: string = todayISO()): Promise<number> {
  const { data, error } = await supabase.from('recurring_rules').select('*').eq('is_active', true);
  if (error) throw error;
  let total = 0;
  for (const rule of (data ?? []) as RecurringRule[]) {
    try {
      total += await syncRule(rule, today);
    } catch (e) {
      console.warn(`recurring sync failed for rule ${rule.id}`, (e as Error).message);
    }
  }
  return total;
}

/**
 * Pushes the rule's current amount / vendor-or-source / notes / category onto the
 * entries it already generated, from `fromDate`'s month onward. Rows the user
 * edited by hand (is_edited) are never touched. Property is deliberately not
 * moved: relocating posted history is a different operation. Returns rows updated.
 */
export async function applyRuleToPostedEntries(rule: RecurringRule, fromDate: string): Promise<number> {
  const fromMonth = firstOfMonth(fromDate);
  const table = rule.kind === 'expense' ? 'expenses' : 'income';
  const dateColumn = rule.kind === 'expense' ? 'paid_on' : 'received_on';
  const patch =
    rule.kind === 'expense'
      ? { amount: rule.amount, vendor: rule.party, notes: rule.notes, category_id: rule.category_id }
      : { amount: rule.amount, source: rule.party, notes: rule.notes, category_id: rule.category_id };
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq('recurring_id', rule.id)
    .eq('is_edited', false)
    .gte(dateColumn, fromMonth)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}
