/// <reference types="node" />
// Live end-to-end smoke test for recurring items (README §4.2–§4.4), run by hand — never by jest or CI.
//
// Signs in as the demo reviewer with the anon key and drives the REAL src/db layer
// (createRecurringRule → syncRule → updateExpense → skipRecurringMonth → deleteRecurringRule),
// so RLS, user_id stamping, the engine, and `on delete set null` are exercised against the live project.
// scripts/e2e-recurring.loader.mjs swaps src/db/supabase.ts for a Node client and resolves `@/` imports.
//
//   set -a; source .env; set +a
//   E2E_DEMO_EMAIL=… E2E_DEMO_PASSWORD=… node --env-file=.env --import ./scripts/e2e-recurring.loader.mjs scripts/e2e-recurring.ts
//
// Every row it creates carries notes = 'e2e'; the final step deletes exactly those rows
// (the demo account's seeded screenshot data is never touched). Exits 1 on any failure.
import { supabase } from '../src/db/supabase';
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRule,
  skipRecurringMonth,
  syncRule,
} from '../src/db/recurring';
import { deleteExpense, getExpense, listExpensesForRule, updateExpense } from '../src/db/expenses';
import type { Expense } from '../src/types';

const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD;
if (!DEMO_EMAIL || !DEMO_PASSWORD) {
  console.error(
    'Usage: E2E_DEMO_EMAIL=… E2E_DEMO_PASSWORD=… node --import ./scripts/e2e-recurring.loader.mjs scripts/e2e-recurring.ts'
  );
  process.exit(2);
}
const PROPERTY_ID = '11111111-0000-0000-0000-000000000001'; // Maple Street Duplex
const CATEGORY_NAME = 'Mortgage Principal';
const AMOUNT = 611.83;
const NOTES = 'e2e';
const START_MONTH = '2026-01-01';
const OCCURRENCES = 3;
const EXPECTED_DATES = ['2026-01-01', '2026-02-01', '2026-03-01'];

let failures = 0;

function check(step: string, ok: boolean, detail: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step} — ${detail}`);
}

function byDate(rows: Expense[]): Expense[] {
  return [...rows].sort((a, b) => a.paid_on.localeCompare(b.paid_on));
}

function summarize(rows: Expense[]): string {
  return byDate(rows)
    .map((r) => `${r.paid_on}:${r.amount}${r.is_edited ? '*' : ''}`)
    .join(', ');
}

async function countE2eRows(userId: string, table: 'expenses' | 'income'): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('notes', NOTES);
  if (error) throw error;
  return count ?? 0;
}

async function main(): Promise<void> {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (authErr) throw authErr;
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw userErr ?? new Error('no user');
  const userId = userData.user.id;
  console.log(`signed in as ${DEMO_EMAIL} (${userId})`);

  const before = await countE2eRows(userId, 'expenses');
  check('0. precondition', before === 0, `${before} pre-existing expenses with notes='e2e' (cleanup will remove any)`);

  const { data: cat, error: catErr } = await supabase
    .from('categories')
    .select('id')
    .eq('name', CATEGORY_NAME)
    .eq('kind', 'expense')
    .single();
  if (catErr) throw catErr;

  let ruleId: string | null = null;
  const survivingIds: string[] = [];
  try {
    // a. create rule → sync → exactly 3 rows, first-of-month dates, is_edited=false
    const rule = await createRecurringRule({
      property_id: PROPERTY_ID,
      category_id: cat.id,
      kind: 'expense',
      amount: AMOUNT,
      notes: NOTES,
      start_month: START_MONTH,
      end_mode: 'count',
      occurrences: OCCURRENCES,
    });
    ruleId = rule.id;
    check('a1. createRecurringRule', rule.user_id === userId && rule.skipped_months.length === 0, `rule ${rule.id} user_id stamped, skipped_months=[]`);

    const insertedA = await syncRule(rule);
    let rows = await listExpensesForRule(rule.id);
    const datesA = byDate(rows).map((r) => r.paid_on);
    check(
      'a2. first sync',
      insertedA === 3 &&
        rows.length === 3 &&
        JSON.stringify(datesA) === JSON.stringify(EXPECTED_DATES) &&
        rows.every((r) => r.is_edited === false && Number(r.amount) === AMOUNT && r.user_id === userId && r.notes === NOTES),
      `inserted ${insertedA}; rows: ${summarize(rows)}`
    );

    // b. sync again → 0 inserted, still 3
    const insertedB = await syncRule(rule);
    rows = await listExpensesForRule(rule.id);
    check('b. idempotent re-sync', insertedB === 0 && rows.length === 3, `inserted ${insertedB}; ${rows.length} rows`);

    // c. edit February → sync → still 3, Feb = 700, is_edited = true
    const feb = rows.find((r) => r.paid_on === '2026-02-01');
    if (!feb) throw new Error('February row missing');
    await updateExpense(feb.id, { amount: 700, is_edited: true });
    const insertedC = await syncRule(rule);
    rows = await listExpensesForRule(rule.id);
    const febAfter = rows.find((r) => r.paid_on === '2026-02-01');
    check(
      'c. edited row survives sync',
      insertedC === 0 && rows.length === 3 && Number(febAfter?.amount) === 700 && febAfter?.is_edited === true,
      `inserted ${insertedC}; rows: ${summarize(rows)} (* = is_edited)`
    );

    // d. skip March + delete the March row → sync → still 2, March not re-posted
    const mar = rows.find((r) => r.paid_on === '2026-03-01');
    if (!mar) throw new Error('March row missing');
    const skipped = await skipRecurringMonth(rule.id, '2026-03-15'); // any day in the month
    await deleteExpense(mar.id);
    const fresh = await getRecurringRule(rule.id);
    const insertedD = await syncRule(fresh);
    rows = await listExpensesForRule(rule.id);
    check(
      'd. skipped month stays deleted',
      JSON.stringify(skipped.skipped_months) === JSON.stringify(['2026-03-01']) &&
        insertedD === 0 &&
        rows.length === 2 &&
        !rows.some((r) => r.paid_on === '2026-03-01'),
      `skipped_months=${JSON.stringify(fresh.skipped_months)}; inserted ${insertedD}; rows: ${summarize(rows)}`
    );
    survivingIds.push(...rows.map((r) => r.id));

    // e. delete the rule → the 2 rows remain with recurring_id = null
    await deleteRecurringRule(rule.id);
    ruleId = null;
    const { data: gone } = await supabase.from('recurring_rules').select('id').eq('id', rule.id);
    const survivors = await Promise.all(survivingIds.map((id) => getExpense(id)));
    check(
      'e. delete rule keeps entries',
      (gone ?? []).length === 0 && survivors.length === 2 && survivors.every((r) => r.recurring_id === null),
      `rule rows left: ${(gone ?? []).length}; survivors: ${summarize(survivors)} recurring_id=[${survivors.map((r) => String(r.recurring_id)).join(', ')}]`
    );
  } finally {
    // f. cleanup — only rows tagged notes='e2e' for the demo user, through the signed-in (RLS-scoped) client.
    if (ruleId) await supabase.from('recurring_rules').delete().eq('id', ruleId).eq('notes', NOTES);
    const { data: deleted, error: delErr } = await supabase
      .from('expenses')
      .delete()
      .eq('user_id', userId)
      .eq('notes', NOTES)
      .select('id');
    if (delErr) throw delErr;
    await supabase.from('recurring_rules').delete().eq('user_id', userId).eq('notes', NOTES);
    const afterExpenses = await countE2eRows(userId, 'expenses');
    const afterIncome = await countE2eRows(userId, 'income');
    const { count: afterRules } = await supabase
      .from('recurring_rules')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('notes', NOTES);
    check(
      'f. cleanup',
      afterExpenses === 0 && afterIncome === 0 && (afterRules ?? 0) === 0,
      `deleted ${(deleted ?? []).length} expenses; remaining notes='e2e' → expenses ${afterExpenses}, income ${afterIncome}, recurring_rules ${afterRules ?? 0}`
    );
    await supabase.auth.signOut();
  }
}

main()
  .then(() => {
    console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((e: unknown) => {
    console.error('FAIL  unexpected error —', e instanceof Error ? e.message : e);
    process.exit(1);
  });
