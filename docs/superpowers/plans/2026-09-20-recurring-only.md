# Recurring Items (recurring-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add README §4 "Recurring Items" (monthly auto-posting rules with count / until-stopped end modes, idempotent catch-up generation, edit-one-month protection) on top of the **current** `properties` / `expenses` / `income` schema — no table renames, no column drops, no data migration of existing rows.

**Architecture:** Same layers the codebase already uses — `src/types` (shapes) → `src/lib` (pure, no React/network) → `src/db` (Supabase) → `src/components` → `app/` screens. One new table `recurring_rules`; two new nullable-safe columns on both `expenses` and `income` (`recurring_id`, `is_edited`). The engine is one pure function `generateDueEntries(rule, existingDates, today)`; a thin `syncRecurringEntries()` in `src/db/recurring.ts` runs it for every active rule on app launch (tabs layout mount) and right after a rule is created. Generated rows are ordinary expense/income rows, so every existing screen, P&L, trend and export works on them unchanged.

**Tech Stack:** No new dependencies. Expo ~57, expo-router ~57, React Native 0.86, @supabase/supabase-js ^2.110, @tanstack/react-query ^5, date-fns ^4, Jest ^29 + jest-expo ~57, TypeScript ~6.

**Spec:** `/Users/riyad/Downloads/README (3).md` §4 (Recurring Items — Exact Behavior) and §4.5 (tests). Data-model shape adapted from §3 `recurring_rules` verbatim; the §3 `entries` unification and §3 `projects` rename are **explicitly out of scope** (decision recorded in the 2026-09-20 session: keep `address`, `property_type`, `purchase_*`, `vendor`, `source`, `period_start/end`).

## Global Constraints

- Money is `numeric(12,2)` in Postgres and a JS `number` in dollars; never sum floats without the cent-rounding already in `src/lib/aggregate.ts`.
- All dates are ISO `YYYY-MM-DD` strings across every function boundary; `Date` objects only inside `date-fns` calls in `src/lib/dates.ts`.
- Every file under `src/lib/` has zero React and zero network imports.
- Every `src/db/*.ts` insert sets `user_id` from `supabase.auth.getUser()` (schema has no default; RLS `WITH CHECK` requires it) — same pattern as `createExpense`.
- RLS enabled on `recurring_rules` with the same `auth.uid() = user_id` policy shape as `expenses`.
- `npm test` and `npx tsc --noEmit` must be clean at the end of every task.
- README §4.2: generated entries land on the **first day of the month** (`paid_on` / `received_on` = `YYYY-MM-01`), copy the rule's amount/category/notes, set `recurring_id`, `is_edited = false`.
- README §4.2: generation is idempotent (skip any month that already has an entry for that `recurring_id`), never before `start_month`, never after `stopped_on`, never beyond `occurrences` for count rules, never in a future month.
- README §4.3: editing a generated entry sets `is_edited = true`; the generator never touches existing rows (it only inserts missing months). Changing a rule's amount affects only months not yet generated.
- README §4.4: stopping sets `stopped_on = today`, `is_active = false`, keeps history. Deleting a rule keeps its entries (`on delete set null`).
- Live Supabase project `dxjwyaldmxquuztmnrsb`: the migration is **additive only** (create table, add columns, add index). Apply with the same `psql` connection string pattern used in the 2026-09-18 seed (`PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "host=db.dxjwyaldmxquuztmnrsb.supabase.co port=5432 dbname=postgres user=postgres sslmode=require"`, env from `.env`).
- Version 1.0 (build 19) is **in App Review**; do not touch `app.json` version until Task 12.
- `AGENTS.md` stays as-is. `WORKLOG.md` gets a Phase 15 START/FINISH pair (README §0.1 protocol).

---

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/2026-09-20-recurring.sql` (create) | Additive DDL: `recurring_rules`, new columns on `expenses`/`income`, indexes, RLS. |
| `supabase/schema.sql` (modify) | Keep the canonical schema in sync (append the same DDL). |
| `src/types/index.ts` (modify) | `EndMode`, `RecurringRule`, `NewRecurringRule`; `recurring_id`/`is_edited` on `Expense`, `Income`, `NewExpense`, `NewIncome`. |
| `src/lib/dates.ts` (modify) | `firstOfMonth`, `addCalendarMonths`, `monthKey`. |
| `src/lib/recurring.ts` (create) | `generateDueEntries` — the engine. Pure. |
| `src/lib/recurring-rule-validation.ts` (create) | Form validation for the new-rule screen. Pure. |
| `src/db/recurring.ts` (create) | Rule CRUD + `syncRecurringEntries()`. |
| `src/db/expenses.ts`, `src/db/income.ts` (modify) | `listExpensesForRule`, `listIncomeForRule`, `createExpenses` / `createIncomes` bulk insert. |
| `src/lib/timeline.ts` (modify) | Carry `recurring_id` onto `TimelineEntry` so lists can badge generated rows. |
| `src/components/recurring-rule-form.tsx` (create) | The new-rule form (property, category, amount, start month, end mode). |
| `app/recurring/new.tsx` (create) | Modal screen hosting the form; `?kind=expense|income&propertyId=…` params. |
| `app/property/[id]/recurring.tsx` (create) | Per-property rule list with Stop / Delete. |
| `app/property/[id]/index.tsx` (modify) | "Recurring" link in header; ↻ badge on generated rows. |
| `app/(tabs)/add.tsx` (modify) | "Repeats every month? Set up a recurring rule →" link. |
| `app/transaction/[kind]/[id].tsx` (modify) | Badge for generated entries; save sets `is_edited: true`. |
| `app/(tabs)/_layout.tsx` (modify) | Run `syncRecurringEntries()` once on mount (app launch, signed in). |
| `app/_layout.tsx` (modify) | Register the two new routes. |
| `__tests__/dates-month.test.ts`, `__tests__/recurring.test.ts`, `__tests__/recurring-rule-validation.test.ts`, `__tests__/recurring-db.test.ts`, `__tests__/timeline.test.ts` (modify) | Tests. |

---

## Task 1: Additive schema migration (live project)

**Files:**
- Create: `supabase/migrations/2026-09-20-recurring.sql`
- Modify: `supabase/schema.sql` (append)

**Interfaces:**
- Produces: table `recurring_rules`; columns `expenses.recurring_id`, `expenses.is_edited`, `income.recurring_id`, `income.is_edited`.

- [ ] **Step 1: Write the migration file**

```sql
-- Recurring Items (README §3 recurring_rules + §4 behavior), additive only.
-- Existing expenses/income rows are untouched: recurring_id stays null,
-- is_edited defaults false. Nothing is renamed or dropped.

create table if not exists recurring_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  category_id uuid not null references categories(id),
  kind        text not null check (kind in ('expense','income')),
  amount      numeric(12,2) not null check (amount > 0),
  notes       text,
  start_month date not null check (extract(day from start_month) = 1),
  end_mode    text not null check (end_mode in ('count','until_stopped')),
  occurrences int check (occurrences is null or occurrences > 0),
  stopped_on  date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  -- count rules must carry a count; until_stopped rules must not
  constraint recurring_rules_end_mode_shape check (
    (end_mode = 'count' and occurrences is not null)
    or (end_mode = 'until_stopped' and occurrences is null)
  )
);

alter table expenses
  add column if not exists recurring_id uuid references recurring_rules(id) on delete set null,
  add column if not exists is_edited boolean not null default false;

alter table income
  add column if not exists recurring_id uuid references recurring_rules(id) on delete set null,
  add column if not exists is_edited boolean not null default false;

create index if not exists recurring_rules_user_property_idx on recurring_rules (user_id, property_id);
create index if not exists expenses_recurring_idx on expenses (recurring_id) where recurring_id is not null;
create index if not exists income_recurring_idx   on income   (recurring_id) where recurring_id is not null;

alter table recurring_rules enable row level security;

create policy "own recurring" on recurring_rules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Append the same DDL to `supabase/schema.sql`**

Append a `-- RECURRING RULES (Phase 15)` section containing the exact SQL above (minus the leading comment block) so a fresh project can be created from `schema.sql` alone.

- [ ] **Step 3: Apply to the live project and verify**

```bash
cd /Users/riyad/OrganicHub/propertyledger && set -a && source .env && set +a
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "host=db.dxjwyaldmxquuztmnrsb.supabase.co port=5432 dbname=postgres user=postgres sslmode=require" \
  -v ON_ERROR_STOP=1 -f supabase/migrations/2026-09-20-recurring.sql
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "host=db.dxjwyaldmxquuztmnrsb.supabase.co port=5432 dbname=postgres user=postgres sslmode=require" -Atc "
select column_name, table_name from information_schema.columns
 where table_name in ('expenses','income') and column_name in ('recurring_id','is_edited') order by 2,1;
select count(*) from recurring_rules;
select relrowsecurity from pg_class where relname='recurring_rules';"
```
Expected: four column rows, `0`, `t`. Existing row counts in `expenses`/`income` unchanged (spot-check: `select count(*) from expenses;` before and after).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-09-20-recurring.sql supabase/schema.sql
git commit -m "phase-15: recurring_rules table + recurring_id/is_edited on expenses and income"
```

---

## Task 2: Types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `EndMode`, `RecurringRule`, `NewRecurringRule`; `Expense`/`Income` gain `recurring_id: string | null` and `is_edited: boolean`; `NewExpense`/`NewIncome` gain optional `recurring_id?: string | null`, `is_edited?: boolean`.

- [ ] **Step 1: Add the recurring types and extend the row types**

Add to the `Expense` interface (after `notes`):
```typescript
  /** Set when this row was generated by a recurring rule; null for manual entries. */
  recurring_id: string | null;
  /** True once the user edits a generated row — the generator never touches it again. */
  is_edited: boolean;
```
Add to `NewExpense` (after `notes`):
```typescript
  recurring_id?: string | null;
  is_edited?: boolean;
```
Make the identical two additions to `Income` and `NewIncome`.

Append at the end of the file:
```typescript
/** How a recurring rule ends (README §4.1). */
export type EndMode = 'count' | 'until_stopped';

/** A row in the recurring_rules table — the template that spawns one entry per month. */
export interface RecurringRule {
  id: string;
  user_id: string;
  property_id: string;
  category_id: string;
  kind: CategoryKind;
  amount: number;
  notes: string | null;
  /** First day of the first month, e.g. '2026-01-01'. */
  start_month: string;
  end_mode: EndMode;
  /** Required when end_mode === 'count'; null otherwise. */
  occurrences: number | null;
  /** Set when an until_stopped rule is stopped (README §4.4). */
  stopped_on: string | null;
  is_active: boolean;
  created_at: string;
}

/** Client-supplied fields when creating a rule (id/user_id/created_at/stopped_on/is_active are server-side). */
export interface NewRecurringRule {
  property_id: string;
  category_id: string;
  kind: CategoryKind;
  amount: number;
  notes?: string | null;
  start_month: string;
  end_mode: EndMode;
  occurrences?: number | null;
}
```

- [ ] **Step 2: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | tail -4`
Expected: tsc clean. Tests: any existing test that builds an `Expense`/`Income` literal without the two new fields will now fail typecheck inside jest-expo (ts-jest is not used — babel strips types, so tests still **pass**; `tsc` covers `__tests__` only if `tsconfig.json` includes them). If `tsc` reports missing properties in `__tests__/*.ts` fixtures, add `recurring_id: null, is_edited: false` to those fixture objects — do not loosen the types.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts __tests__
git commit -m "phase-15: RecurringRule types; recurring_id/is_edited on Expense and Income"
```

---

## Task 3: Month helpers in `src/lib/dates.ts`

**Files:**
- Modify: `src/lib/dates.ts`
- Test: `__tests__/dates-month.test.ts`

**Interfaces:**
- Produces: `firstOfMonth(iso: string): string`, `addCalendarMonths(firstOfMonthIso: string, n: number): string`, `monthKey(iso: string): string` (`'YYYY-MM'`).

- [ ] **Step 1: Write the failing test**

```typescript
// Phase 15 tests — month arithmetic used by the recurring engine (README §4.2).
import { addCalendarMonths, firstOfMonth, monthKey } from '../src/lib/dates';

describe('firstOfMonth', () => {
  it('snaps any date to the first of its month', () => {
    expect(firstOfMonth('2026-09-18')).toBe('2026-09-01');
    expect(firstOfMonth('2026-09-01')).toBe('2026-09-01');
    expect(firstOfMonth('2024-02-29')).toBe('2024-02-01');
  });
});

describe('addCalendarMonths', () => {
  it('adds whole months to a first-of-month date', () => {
    expect(addCalendarMonths('2026-01-01', 0)).toBe('2026-01-01');
    expect(addCalendarMonths('2026-01-01', 1)).toBe('2026-02-01');
    expect(addCalendarMonths('2026-01-01', 11)).toBe('2026-12-01');
  });
  it('rolls over the year boundary', () => {
    expect(addCalendarMonths('2026-11-01', 2)).toBe('2027-01-01');
    expect(addCalendarMonths('2026-12-01', 13)).toBe('2028-01-01');
  });
});

describe('monthKey', () => {
  it('returns YYYY-MM for any date in the month', () => {
    expect(monthKey('2026-09-18')).toBe('2026-09');
    expect(monthKey('2026-09-01')).toBe('2026-09');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/dates-month.test.ts`
Expected: FAIL — `firstOfMonth is not a function` (or import error).

- [ ] **Step 3: Implement**

Append to `src/lib/dates.ts` (add `addMonths, startOfMonth` to the existing `date-fns` import):
```typescript
/** Snaps a date to the first of its month: '2026-09-18' → '2026-09-01'. */
export function firstOfMonth(iso: string): string {
  return format(startOfMonth(parseISO(iso)), 'yyyy-MM-dd');
}

/** Adds n calendar months to a first-of-month date; n may be 0. Year rollover handled by date-fns. */
export function addCalendarMonths(firstOfMonthIso: string, n: number): string {
  return format(addMonths(parseISO(firstOfMonthIso), n), 'yyyy-MM-dd');
}

/** 'YYYY-MM' bucket key — the recurring engine's idempotency unit (README §4.2). */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/dates-month.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts __tests__/dates-month.test.ts
git commit -m "phase-15: firstOfMonth/addCalendarMonths/monthKey"
```

---

## Task 4: `src/lib/recurring.ts` — the generation engine (README §4.2–4.5; test hardest)

**Files:**
- Create: `src/lib/recurring.ts`
- Test: `__tests__/recurring.test.ts`

**Interfaces:**
- Consumes: `firstOfMonth`, `addCalendarMonths`, `monthKey` (Task 3); `RecurringRule` (Task 2).
- Produces:
  ```typescript
  export interface GeneratedEntry {
    recurring_id: string;
    property_id: string;
    category_id: string;
    kind: CategoryKind;
    amount: number;
    notes: string | null;
    /** First day of the month this entry represents. */
    date: string;
  }
  export function generateDueEntries(rule: RecurringRule, existingDates: string[], today: string): GeneratedEntry[];
  ```
  `existingDates` = the `paid_on`/`received_on` of every row already carrying this `recurring_id` (edited or not). The function is pure and never mutates inputs.

- [ ] **Step 1: Write the failing tests (one per README §4.5 bullet, plus edge cases)**

```typescript
// Phase 15 tests — README §4.5 "Tests for recurring (test this hardest)".
import { generateDueEntries } from '../src/lib/recurring';
import type { RecurringRule } from '../src/types';

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r1',
    user_id: 'u1',
    property_id: 'p1',
    category_id: 'c1',
    kind: 'expense',
    amount: 1500,
    notes: 'mortgage',
    start_month: '2026-01-01',
    end_mode: 'until_stopped',
    occurrences: null,
    stopped_on: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
const dates = (entries: { date: string }[]) => entries.map((e) => e.date);

describe('generateDueEntries', () => {
  it('count rule for 3 months starting Jan generates exactly Jan, Feb, Mar — no more', () => {
    const r = rule({ end_mode: 'count', occurrences: 3 });
    expect(dates(generateDueEntries(r, [], '2026-09-18'))).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('until_stopped rule generates one entry per month up to the current month, none in the future', () => {
    expect(dates(generateDueEntries(rule(), [], '2026-04-15'))).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
    ]);
  });

  it('running generation twice produces no duplicates (idempotent)', () => {
    const first = generateDueEntries(rule(), [], '2026-03-10');
    const second = generateDueEntries(rule(), dates(first), '2026-03-10');
    expect(second).toEqual([]);
  });

  it('an existing (possibly edited) month is skipped regardless of its exact day', () => {
    // User moved February's entry to the 5th; that month still counts as present.
    const out = generateDueEntries(rule(), ['2026-01-01', '2026-02-05'], '2026-03-10');
    expect(dates(out)).toEqual(['2026-03-01']);
  });

  it('changing the rule amount only affects months not yet generated', () => {
    const jan = generateDueEntries(rule({ amount: 1500 }), [], '2026-01-31');
    expect(jan[0].amount).toBe(1500);
    const feb = generateDueEntries(rule({ amount: 1600 }), dates(jan), '2026-02-28');
    expect(feb).toHaveLength(1);
    expect(feb[0]).toMatchObject({ date: '2026-02-01', amount: 1600 });
  });

  it('stopping mid-year: months before stopped_on remain, none after', () => {
    const r = rule({ stopped_on: '2026-05-20', is_active: false });
    // The stopped month itself (May) is still generated if it was due; June+ never.
    expect(dates(generateDueEntries(r, [], '2026-09-18'))).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01',
    ]);
  });

  it('start month in the future generates nothing yet', () => {
    expect(generateDueEntries(rule({ start_month: '2026-11-01' }), [], '2026-09-18')).toEqual([]);
  });

  it('start month equal to the current month generates exactly that month', () => {
    expect(dates(generateDueEntries(rule({ start_month: '2026-09-01' }), [], '2026-09-18'))).toEqual(['2026-09-01']);
  });

  it('count rule never exceeds occurrences even with a large gap to today', () => {
    const r = rule({ end_mode: 'count', occurrences: 12, start_month: '2024-01-01' });
    const out = generateDueEntries(r, [], '2026-09-18');
    expect(out).toHaveLength(12);
    expect(out[11].date).toBe('2024-12-01');
  });

  it('count rule with some months already present only fills the missing ones within the count', () => {
    const r = rule({ end_mode: 'count', occurrences: 3 });
    expect(dates(generateDueEntries(r, ['2026-02-01'], '2026-09-18'))).toEqual(['2026-01-01', '2026-03-01']);
  });

  it('copies rule fields onto every generated entry', () => {
    const [e] = generateDueEntries(rule({ kind: 'income', amount: 2150, notes: 'Unit A rent' }), [], '2026-01-15');
    expect(e).toEqual({
      recurring_id: 'r1',
      property_id: 'p1',
      category_id: 'c1',
      kind: 'income',
      amount: 2150,
      notes: 'Unit A rent',
      date: '2026-01-01',
    });
  });

  it('does not mutate its inputs', () => {
    const r = rule();
    const existing = ['2026-01-01'];
    const snapshotRule = JSON.stringify(r);
    generateDueEntries(r, existing, '2026-03-01');
    expect(JSON.stringify(r)).toBe(snapshotRule);
    expect(existing).toEqual(['2026-01-01']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/recurring.test.ts`
Expected: FAIL — cannot find module `../src/lib/recurring`.

- [ ] **Step 3: Implement**

```typescript
// Recurring generation engine — pure, no React, no network (README §4.2–§4.4).
// Walks calendar months from the rule's start_month up to the month containing
// `today`, and returns one GeneratedEntry per month that has no entry yet.
// The caller (src/db/recurring.ts) inserts them; this function never touches
// existing rows, which is what protects is_edited entries (README §4.3).
import type { CategoryKind, RecurringRule } from '@/types';
import { addCalendarMonths, firstOfMonth, monthKey } from './dates';

export interface GeneratedEntry {
  recurring_id: string;
  property_id: string;
  category_id: string;
  kind: CategoryKind;
  amount: number;
  notes: string | null;
  /** First day of the month this entry represents (paid_on / received_on). */
  date: string;
}

/**
 * Entries that should exist for `rule` as of `today` but don't yet.
 * `existingDates` are the dates of rows already linked to this rule (any day in
 * the month counts — the month is the idempotency unit, README §4.2).
 */
export function generateDueEntries(
  rule: RecurringRule,
  existingDates: string[],
  today: string
): GeneratedEntry[] {
  const currentMonth = firstOfMonth(today);
  // Last month that may ever be generated: the current month, capped by stopped_on.
  const lastAllowed = rule.stopped_on
    ? minIso(currentMonth, firstOfMonth(rule.stopped_on))
    : currentMonth;

  const existingMonths = new Set(existingDates.map(monthKey));
  const out: GeneratedEntry[] = [];

  // Count rules: exactly `occurrences` months from start_month. Until-stopped: unbounded.
  const maxMonths = rule.end_mode === 'count' ? (rule.occurrences ?? 0) : Number.POSITIVE_INFINITY;

  for (let i = 0; i < maxMonths; i++) {
    const month = addCalendarMonths(rule.start_month, i);
    if (month > lastAllowed) break; // never into the future or past stopped_on
    if (existingMonths.has(monthKey(month))) continue; // idempotent
    out.push({
      recurring_id: rule.id,
      property_id: rule.property_id,
      category_id: rule.category_id,
      kind: rule.kind,
      amount: rule.amount,
      notes: rule.notes,
      date: month,
    });
  }
  return out;
}

/** ISO date strings compare correctly as plain strings. */
function minIso(a: string, b: string): string {
  return a < b ? a : b;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/recurring.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurring.ts __tests__/recurring.test.ts
git commit -m "phase-15: generateDueEntries recurring engine with README §4.5 tests"
```

---

## Task 5: `src/lib/recurring-rule-validation.ts`

**Files:**
- Create: `src/lib/recurring-rule-validation.ts`
- Test: `__tests__/recurring-rule-validation.test.ts`

**Interfaces:**
- Consumes: `parseAmountInput` (`src/lib/money.ts`), `isValidISODate` (`src/lib/dates.ts`), `EndMode` (Task 2).
- Produces:
  ```typescript
  export interface RecurringRuleFormInput {
    propertyId: string | null;
    categoryId: string | null;
    amountText: string;
    /** 'YYYY-MM' as typed by the user. */
    startMonthText: string;
    endMode: EndMode;
    occurrencesText: string;
  }
  export interface RecurringRuleValidation {
    valid: boolean;
    amount?: number;
    /** 'YYYY-MM-01' — only when startMonthText is valid. */
    startMonth?: string;
    /** Parsed count — only when endMode === 'count' and valid. */
    occurrences?: number;
    errors: { property?: string; category?: string; amount?: string; startMonth?: string; occurrences?: string };
  }
  export function validateRecurringRuleForm(input: RecurringRuleFormInput): RecurringRuleValidation;
  ```

- [ ] **Step 1: Write the failing tests**

```typescript
// Phase 15 tests — new recurring rule form validation.
import { validateRecurringRuleForm } from '../src/lib/recurring-rule-validation';

const valid = {
  propertyId: 'p1',
  categoryId: 'c1',
  amountText: '1500',
  startMonthText: '2026-01',
  endMode: 'until_stopped' as const,
  occurrencesText: '',
};

describe('validateRecurringRuleForm', () => {
  it('accepts an until_stopped rule and normalizes the start month to the 1st', () => {
    const r = validateRecurringRuleForm(valid);
    expect(r.valid).toBe(true);
    expect(r.amount).toBe(1500);
    expect(r.startMonth).toBe('2026-01-01');
    expect(r.occurrences).toBeUndefined();
  });

  it('accepts a count rule with a positive integer count', () => {
    const r = validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '12' });
    expect(r.valid).toBe(true);
    expect(r.occurrences).toBe(12);
  });

  it('requires property and category', () => {
    const r = validateRecurringRuleForm({ ...valid, propertyId: null, categoryId: null });
    expect(r.valid).toBe(false);
    expect(r.errors.property).toBeDefined();
    expect(r.errors.category).toBeDefined();
  });

  it('rejects a non-positive or 3-decimal amount', () => {
    expect(validateRecurringRuleForm({ ...valid, amountText: '0' }).errors.amount).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, amountText: '1.234' }).errors.amount).toBeDefined();
  });

  it('rejects a malformed or impossible start month', () => {
    expect(validateRecurringRuleForm({ ...valid, startMonthText: '2026-1' }).errors.startMonth).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, startMonthText: '2026-13' }).errors.startMonth).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, startMonthText: '' }).errors.startMonth).toBeDefined();
  });

  it('count mode requires a positive integer count', () => {
    expect(validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '' }).errors.occurrences).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '0' }).errors.occurrences).toBeDefined();
    expect(validateRecurringRuleForm({ ...valid, endMode: 'count', occurrencesText: '2.5' }).errors.occurrences).toBeDefined();
  });

  it('ignores occurrencesText when endMode is until_stopped', () => {
    const r = validateRecurringRuleForm({ ...valid, occurrencesText: 'garbage' });
    expect(r.valid).toBe(true);
    expect(r.errors.occurrences).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/recurring-rule-validation.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```typescript
// New-recurring-rule form validation — pure functions (README §4.1 fields).
import type { EndMode } from '@/types';
import { isValidISODate } from './dates';
import { parseAmountInput } from './money';

export interface RecurringRuleFormInput {
  propertyId: string | null;
  categoryId: string | null;
  amountText: string;
  /** 'YYYY-MM' as typed by the user. */
  startMonthText: string;
  endMode: EndMode;
  occurrencesText: string;
}

export interface RecurringRuleValidation {
  valid: boolean;
  amount?: number;
  /** 'YYYY-MM-01' — only when startMonthText is valid. */
  startMonth?: string;
  /** Parsed count — only when endMode === 'count' and valid. */
  occurrences?: number;
  errors: {
    property?: string;
    category?: string;
    amount?: string;
    startMonth?: string;
    occurrences?: string;
  };
}

export function validateRecurringRuleForm(input: RecurringRuleFormInput): RecurringRuleValidation {
  const errors: RecurringRuleValidation['errors'] = {};

  if (!input.propertyId) errors.property = 'Pick a property.';
  if (!input.categoryId) errors.category = 'Pick a category.';

  const amount = parseAmountInput(input.amountText);
  if (amount === undefined) {
    errors.amount = 'Amount must be a positive number with at most 2 decimal places.';
  }

  const monthText = input.startMonthText.trim();
  let startMonth: string | undefined;
  if (!/^\d{4}-\d{2}$/.test(monthText) || !isValidISODate(`${monthText}-01`)) {
    errors.startMonth = 'Start month must be YYYY-MM.';
  } else {
    startMonth = `${monthText}-01`;
  }

  let occurrences: number | undefined;
  if (input.endMode === 'count') {
    const text = input.occurrencesText.trim();
    if (!/^\d+$/.test(text) || Number(text) < 1) {
      errors.occurrences = 'Number of months must be a whole number of 1 or more.';
    } else {
      occurrences = Number(text);
    }
  }

  const valid = Object.keys(errors).length === 0;
  return valid ? { valid, amount, startMonth, occurrences, errors } : { valid, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/recurring-rule-validation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurring-rule-validation.ts __tests__/recurring-rule-validation.test.ts
git commit -m "phase-15: recurring rule form validation"
```

---

## Task 6: DB helpers on expenses/income + `src/db/recurring.ts`

**Files:**
- Modify: `src/db/expenses.ts`, `src/db/income.ts`
- Create: `src/db/recurring.ts`
- Test: `__tests__/recurring-db.test.ts`

**Interfaces:**
- Consumes: `generateDueEntries`, `GeneratedEntry` (Task 4); `todayISO` (`src/lib/dates.ts`); types (Task 2).
- Produces:
  - `src/db/expenses.ts`: `listExpensesForRule(recurringId: string): Promise<Expense[]>`, `createExpenses(inputs: NewExpense[]): Promise<Expense[]>` (bulk insert, sets `user_id` on each; returns `[]` for empty input without hitting the network).
  - `src/db/income.ts`: `listIncomeForRule(recurringId: string): Promise<Income[]>`, `createIncomes(inputs: NewIncome[]): Promise<Income[]>` — same contract.
  - `src/db/recurring.ts`:
    ```typescript
    export async function createRecurringRule(input: NewRecurringRule): Promise<RecurringRule>;
    export async function listRecurringRules(propertyId?: string): Promise<RecurringRule[]>; // newest first, all rules incl. stopped
    export async function getRecurringRule(id: string): Promise<RecurringRule>;
    export async function updateRecurringRule(id: string, patch: Pick<Partial<NewRecurringRule>, 'amount' | 'notes'>): Promise<RecurringRule>;
    export async function stopRecurringRule(id: string, today?: string): Promise<RecurringRule>; // stopped_on = today, is_active = false
    export async function deleteRecurringRule(id: string): Promise<void>;
    /** Runs generation for one rule; returns how many rows were inserted. */
    export async function syncRule(rule: RecurringRule, today?: string): Promise<number>;
    /** Runs generation for every active rule the user owns; returns total rows inserted. */
    export async function syncRecurringEntries(today?: string): Promise<number>;
    ```

- [ ] **Step 1: Write the failing tests**

```typescript
// Phase 15 tests — recurring rule CRUD payloads and the sync wrapper.
jest.mock('../src/db/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

import { supabase } from '../src/db/supabase';
import { createExpenses, listExpensesForRule } from '../src/db/expenses';
import { createIncomes } from '../src/db/income';
import {
  createRecurringRule,
  stopRecurringRule,
  syncRecurringEntries,
  syncRule,
} from '../src/db/recurring';
import type { RecurringRule } from '../src/types';

const mockFrom = supabase.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

/** Chainable, awaitable postgrest-builder stand-in that records every call. */
function createBuilder(result: { data: unknown; error: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = { calls };
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result));
  return builder;
}

const baseRule: RecurringRule = {
  id: 'r1', user_id: 'u1', property_id: 'p1', category_id: 'c1', kind: 'expense',
  amount: 1500, notes: null, start_month: '2026-01-01', end_mode: 'until_stopped',
  occurrences: null, stopped_on: null, is_active: true, created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('createRecurringRule', () => {
  it('inserts the payload with the signed-in user id', async () => {
    const builder = createBuilder({ data: baseRule, error: null });
    mockFrom.mockReturnValue(builder);
    await createRecurringRule({
      property_id: 'p1', category_id: 'c1', kind: 'expense', amount: 1500,
      start_month: '2026-01-01', end_mode: 'until_stopped', occurrences: null,
    });
    expect(mockFrom).toHaveBeenCalledWith('recurring_rules');
    expect(builder.calls).toContainEqual({
      method: 'insert',
      args: [{
        property_id: 'p1', category_id: 'c1', kind: 'expense', amount: 1500,
        start_month: '2026-01-01', end_mode: 'until_stopped', occurrences: null, user_id: 'u1',
      }],
    });
  });

  it('throws when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createRecurringRule({
      property_id: 'p1', category_id: 'c1', kind: 'expense', amount: 1,
      start_month: '2026-01-01', end_mode: 'until_stopped',
    })).rejects.toThrow('Not signed in.');
  });
});

describe('stopRecurringRule', () => {
  it('sets stopped_on to today and is_active false (README §4.4)', async () => {
    const builder = createBuilder({ data: { ...baseRule, is_active: false }, error: null });
    mockFrom.mockReturnValue(builder);
    await stopRecurringRule('r1', '2026-09-18');
    expect(builder.calls).toContainEqual({ method: 'update', args: [{ stopped_on: '2026-09-18', is_active: false }] });
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['id', 'r1'] });
  });
});

describe('createExpenses / createIncomes (bulk)', () => {
  it('returns [] and does not touch the network for an empty list', async () => {
    expect(await createExpenses([])).toEqual([]);
    expect(await createIncomes([])).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('stamps user_id on every row', async () => {
    const builder = createBuilder({ data: [{ id: 'e1' }, { id: 'e2' }], error: null });
    mockFrom.mockReturnValue(builder);
    await createExpenses([
      { property_id: 'p1', category_id: 'c1', amount: 1, paid_on: '2026-01-01', recurring_id: 'r1', is_edited: false },
      { property_id: 'p1', category_id: 'c1', amount: 1, paid_on: '2026-02-01', recurring_id: 'r1', is_edited: false },
    ]);
    const insert = builder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0]).toHaveLength(2);
    expect(insert.args[0].every((row: { user_id: string }) => row.user_id === 'u1')).toBe(true);
  });
});

describe('listExpensesForRule', () => {
  it('filters by recurring_id', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);
    await listExpensesForRule('r1');
    expect(mockFrom).toHaveBeenCalledWith('expenses');
    expect(builder.calls).toContainEqual({ method: 'eq', args: ['recurring_id', 'r1'] });
  });
});

describe('syncRule', () => {
  it('inserts only the missing months as expense rows dated the 1st', async () => {
    // First call: existing rows for the rule (Jan present). Second call: the insert.
    const listBuilder = createBuilder({ data: [{ id: 'e1', paid_on: '2026-01-01' }], error: null });
    const insertBuilder = createBuilder({ data: [{ id: 'e2' }, { id: 'e3' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder).mockReturnValueOnce(insertBuilder);

    const inserted = await syncRule(baseRule, '2026-03-15');

    expect(inserted).toBe(2);
    const insert = insertBuilder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0]).toEqual([
      { property_id: 'p1', category_id: 'c1', amount: 1500, notes: null, paid_on: '2026-02-01', recurring_id: 'r1', is_edited: false, user_id: 'u1' },
      { property_id: 'p1', category_id: 'c1', amount: 1500, notes: null, paid_on: '2026-03-01', recurring_id: 'r1', is_edited: false, user_id: 'u1' },
    ]);
  });

  it('uses received_on and the income table for income rules', async () => {
    const listBuilder = createBuilder({ data: [], error: null });
    const insertBuilder = createBuilder({ data: [{ id: 'i1' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder).mockReturnValueOnce(insertBuilder);

    await syncRule({ ...baseRule, kind: 'income', start_month: '2026-03-01' }, '2026-03-15');

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'income');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'income');
    const insert = insertBuilder.calls.find((c: { method: string }) => c.method === 'insert');
    expect(insert.args[0][0]).toMatchObject({ received_on: '2026-03-01', recurring_id: 'r1' });
  });

  it('does nothing when every month already exists', async () => {
    const listBuilder = createBuilder({ data: [{ id: 'e1', paid_on: '2026-01-01' }], error: null });
    mockFrom.mockReturnValueOnce(listBuilder);
    expect(await syncRule(baseRule, '2026-01-20')).toBe(0);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe('syncRecurringEntries', () => {
  it('loads active rules and syncs each, summing inserted rows', async () => {
    const rulesBuilder = createBuilder({ data: [baseRule, { ...baseRule, id: 'r2', kind: 'income' }], error: null });
    const list1 = createBuilder({ data: [], error: null });
    const ins1 = createBuilder({ data: [{ id: 'e1' }], error: null });
    const list2 = createBuilder({ data: [], error: null });
    const ins2 = createBuilder({ data: [{ id: 'i1' }], error: null });
    mockFrom
      .mockReturnValueOnce(rulesBuilder)
      .mockReturnValueOnce(list1).mockReturnValueOnce(ins1)
      .mockReturnValueOnce(list2).mockReturnValueOnce(ins2);

    const total = await syncRecurringEntries('2026-01-20');

    expect(total).toBe(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'recurring_rules');
    expect(rulesBuilder.calls).toContainEqual({ method: 'eq', args: ['is_active', true] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/recurring-db.test.ts`
Expected: FAIL — cannot find module `../src/db/recurring` / `createExpenses is not a function`.

- [ ] **Step 3: Add the helpers to `src/db/expenses.ts`**

Append:
```typescript
/** Rows generated by (still linked to) a recurring rule — the engine's idempotency input. */
export async function listExpensesForRule(recurringId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('recurring_id', recurringId)
    .order('paid_on', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

/** Bulk insert (recurring catch-up). Empty input is a no-op with no network call. */
export async function createExpenses(inputs: NewExpense[]): Promise<Expense[]> {
  if (inputs.length === 0) return [];
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const userId = userData.user.id;
  const { data, error } = await supabase
    .from('expenses')
    .insert(inputs.map((input) => ({ ...input, user_id: userId })))
    .select();
  if (error) throw error;
  return (data ?? []) as Expense[];
}
```

- [ ] **Step 4: Add the mirror helpers to `src/db/income.ts`**

Append (table `income`, column `received_on`, types `Income`/`NewIncome`, names `listIncomeForRule` / `createIncomes`):
```typescript
/** Rows generated by (still linked to) a recurring rule — the engine's idempotency input. */
export async function listIncomeForRule(recurringId: string): Promise<Income[]> {
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .eq('recurring_id', recurringId)
    .order('received_on', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Income[];
}

/** Bulk insert (recurring catch-up). Empty input is a no-op with no network call. */
export async function createIncomes(inputs: NewIncome[]): Promise<Income[]> {
  if (inputs.length === 0) return [];
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const userId = userData.user.id;
  const { data, error } = await supabase
    .from('income')
    .insert(inputs.map((input) => ({ ...input, user_id: userId })))
    .select();
  if (error) throw error;
  return (data ?? []) as Income[];
}
```

- [ ] **Step 5: Create `src/db/recurring.ts`**

```typescript
// Data access for recurring_rules + the network wrapper around the pure engine.
// syncRecurringEntries() is the only place generated rows are inserted; it runs
// on app launch (tabs layout) and right after a rule is created (README §4.2).
import { supabase } from './supabase';
import { createExpenses, listExpensesForRule } from './expenses';
import { createIncomes, listIncomeForRule } from './income';
import { todayISO } from '@/lib/dates';
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

/** Amount/notes only — affects months not yet generated (README §4.3). */
export async function updateRecurringRule(
  id: string,
  patch: Pick<Partial<NewRecurringRule>, 'amount' | 'notes'>
): Promise<RecurringRule> {
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

/** Generates and inserts every missing month for one rule. Returns rows inserted. */
export async function syncRule(rule: RecurringRule, today: string = todayISO()): Promise<number> {
  if (rule.kind === 'expense') {
    const existing = await listExpensesForRule(rule.id);
    const due = generateDueEntries(rule, existing.map((e) => e.paid_on), today);
    const inserted = await createExpenses(
      due.map((d) => ({
        property_id: d.property_id,
        category_id: d.category_id,
        amount: d.amount,
        notes: d.notes,
        paid_on: d.date,
        recurring_id: d.recurring_id,
        is_edited: false,
      }))
    );
    return inserted.length;
  }
  const existing = await listIncomeForRule(rule.id);
  const due = generateDueEntries(rule, existing.map((i) => i.received_on), today);
  const inserted = await createIncomes(
    due.map((d) => ({
      property_id: d.property_id,
      category_id: d.category_id,
      amount: d.amount,
      notes: d.notes,
      received_on: d.date,
      recurring_id: d.recurring_id,
      is_edited: false,
    }))
  );
  return inserted.length;
}

/** Catch-up for every active rule the user owns. Returns total rows inserted. */
export async function syncRecurringEntries(today: string = todayISO()): Promise<number> {
  const { data, error } = await supabase.from('recurring_rules').select('*').eq('is_active', true);
  if (error) throw error;
  let total = 0;
  for (const rule of (data ?? []) as RecurringRule[]) {
    total += await syncRule(rule, today);
  }
  return total;
}
```

Note on `listRecurringRules`: the mocked builder in tests returns itself from every method, so the reassignment works there too.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest __tests__/recurring-db.test.ts __tests__/expenses-db.test.ts __tests__/income-db.test.ts`
Expected: PASS. (The existing `expenses-db` / `income-db` suites must still pass untouched.)

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add src/db/expenses.ts src/db/income.ts src/db/recurring.ts __tests__/recurring-db.test.ts
git commit -m "phase-15: recurring rule CRUD, bulk inserts, syncRecurringEntries"
```

---

## Task 7: Timeline carries `recurring_id`

**Files:**
- Modify: `src/lib/timeline.ts`
- Test: `__tests__/timeline.test.ts` (extend)

**Interfaces:**
- Produces: `TimelineEntry.recurring_id: string | null` — set from `expense.recurring_id` / `income.recurring_id` in `expenseToEntry` / `incomeToEntry`.

- [ ] **Step 1: Add a failing test to `__tests__/timeline.test.ts`**

Find the existing fixture builders in that file (they construct `Expense`/`Income` objects — after Task 2 they already include `recurring_id: null, is_edited: false`). Append:
```typescript
describe('recurring linkage on timeline entries', () => {
  it('copies recurring_id from expenses and income rows', () => {
    const expense = { ...baseExpense, recurring_id: 'r1' };
    const income = { ...baseIncome, recurring_id: 'r2' };
    const [a, b] = buildTimeline([expense], [income]);
    expect([a.recurring_id, b.recurring_id].sort()).toEqual(['r1', 'r2']);
  });
  it('is null for manual entries', () => {
    expect(buildTimeline([baseExpense], [])[0].recurring_id).toBeNull();
  });
});
```
Use whatever the file's existing fixture names are in place of `baseExpense` / `baseIncome` (read the file first; if it only has inline literals, extract one expense and one income literal into `const baseExpense` / `const baseIncome` at the top of the file).

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/timeline.test.ts`
Expected: FAIL — `recurring_id` undefined.

- [ ] **Step 3: Implement**

In `src/lib/timeline.ts`, add to `TimelineEntry` after `notes`:
```typescript
  /** Set when the row was generated by a recurring rule (shown as a ↻ badge). */
  recurring_id: string | null;
```
and in `expenseToEntry` add `recurring_id: expense.recurring_id,`; in `incomeToEntry` add `recurring_id: income.recurring_id,`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/timeline.test.ts __tests__/dashboard.test.tsx __tests__/export.test.ts`
Expected: PASS. If `dashboard.test.tsx` or `export.test.ts` build `TimelineEntry` literals directly, add `recurring_id: null` to them.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts __tests__
git commit -m "phase-15: timeline entries carry recurring_id"
```

---

## Task 8: `src/components/recurring-rule-form.tsx` + `app/recurring/new.tsx`

**Files:**
- Create: `src/components/recurring-rule-form.tsx`
- Create: `app/recurring/new.tsx`
- Modify: `app/_layout.tsx` (register route)

**Interfaces:**
- Consumes: `validateRecurringRuleForm` (Task 5), `createRecurringRule`, `syncRule` (Task 6), `listProperties`, `listCategories`, `orderCategoriesByRecent` (existing), `monthKey` (Task 3).
- Produces: `<RecurringRuleForm kind={CategoryKind} initialPropertyId?: string onSaved: () => void />`; route `/recurring/new?kind=expense|income&propertyId=…`.

- [ ] **Step 1: Write the form component**

```tsx
// New recurring rule (README §4.1): property, category, amount, start month,
// end condition. On save: insert the rule, then immediately sync it so the
// first month(s) appear right away (README §4.2 "right after a rule is created").
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { listProperties } from '@/db/properties';
import { createRecurringRule, syncRule } from '@/db/recurring';
import { orderCategoriesByRecent } from '@/lib/add-transaction-state';
import { monthKey, todayISO } from '@/lib/dates';
import {
  validateRecurringRuleForm,
  type RecurringRuleValidation,
} from '@/lib/recurring-rule-validation';
import type { CategoryKind, EndMode } from '@/types';

interface Props {
  kind: CategoryKind;
  initialPropertyId?: string;
  onSaved: () => void;
}

export function RecurringRuleForm({ kind, initialPropertyId, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [startMonthText, setStartMonthText] = useState(monthKey(todayISO()));
  const [endMode, setEndMode] = useState<EndMode>('until_stopped');
  const [occurrencesText, setOccurrencesText] = useState('12');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<RecurringRuleValidation['errors']>({});

  const isExpense = kind === 'expense';

  const { data: properties } = useQuery({
    queryKey: ['properties', { includeArchived: false }],
    queryFn: () => listProperties(),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const kindCategories = orderCategoriesByRecent(categories ?? [], [], kind);

  // Default to the only/first property when none was passed in.
  useEffect(() => {
    if (!propertyId && properties?.length) setPropertyId(properties[0].id);
  }, [properties, propertyId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validation = validateRecurringRuleForm({
        propertyId,
        categoryId,
        amountText,
        startMonthText,
        endMode,
        occurrencesText,
      });
      setErrors(validation.errors);
      if (!validation.valid || validation.amount === undefined || !validation.startMonth) {
        throw Object.assign(new Error('validation'), { silent: true });
      }
      const rule = await createRecurringRule({
        property_id: propertyId!,
        category_id: categoryId!,
        kind,
        amount: validation.amount,
        notes: notes.trim() || null,
        start_month: validation.startMonth,
        end_mode: endMode,
        occurrences: endMode === 'count' ? validation.occurrences! : null,
      });
      return syncRule(rule);
    },
    onSuccess: (inserted) => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: [isExpense ? 'expenses' : 'income'] });
      Alert.alert(
        'Recurring rule saved',
        inserted === 1 ? '1 entry was posted.' : `${inserted} entries were posted.`,
        [{ text: 'OK', onPress: onSaved }]
      );
    },
    onError: (e: Error & { silent?: boolean }) => {
      if (!e.silent) Alert.alert('Could not save rule', e.message);
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.help}>
        Posts one {kind} on the 1st of every month, starting from the month you pick — including
        past months up to today. You can edit or delete any single month afterwards.
      </Text>

      <Text style={styles.label}>Property *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipStrip}>
        {(properties ?? []).map((p) => (
          <Chip key={p.id} label={p.name} active={propertyId === p.id} onPress={() => setPropertyId(p.id)} />
        ))}
      </ScrollView>
      {errors.property ? <Text style={styles.error}>{errors.property}</Text> : null}

      <Text style={styles.label}>Category *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipStrip}>
        {kindCategories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>
      {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

      <Text style={styles.label}>Amount ($) each month *</Text>
      <TextInput
        style={[styles.input, styles.amountInput]}
        value={amountText}
        onChangeText={setAmountText}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />
      {errors.amount ? <Text style={styles.error}>{errors.amount}</Text> : null}

      <Text style={styles.label}>Start month *</Text>
      <TextInput
        style={styles.input}
        value={startMonthText}
        onChangeText={setStartMonthText}
        placeholder="YYYY-MM"
        autoCapitalize="none"
      />
      {errors.startMonth ? <Text style={styles.error}>{errors.startMonth}</Text> : null}

      <Text style={styles.label}>Ends *</Text>
      <View style={styles.segment}>
        {(
          [
            ['until_stopped', 'Until I stop it'],
            ['count', 'After N months'],
          ] as const
        ).map(([mode, label]) => (
          <Pressable
            key={mode}
            style={[styles.segmentButton, endMode === mode && styles.segmentButtonActive]}
            onPress={() => setEndMode(mode)}
          >
            <Text style={endMode === mode ? styles.segmentTextActive : styles.segmentText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {endMode === 'count' ? (
        <>
          <Text style={styles.label}>Number of months *</Text>
          <TextInput
            style={styles.input}
            value={occurrencesText}
            onChangeText={setOccurrencesText}
            keyboardType="number-pad"
          />
          {errors.occurrences ? <Text style={styles.error}>{errors.occurrences}</Text> : null}
        </>
      ) : null}

      <Text style={styles.label}>Notes</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="optional" />

      <Pressable style={styles.saveButton} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Text style={styles.saveButtonText}>{saveMutation.isPending ? 'Saving…' : 'Save Recurring Rule'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  help: { color: '#555', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  label: { fontSize: 13, color: '#555', marginTop: 12, marginBottom: 4 },
  chipStrip: { flexGrow: 0, flexShrink: 0 },
  chipRow: { gap: 6, paddingVertical: 4 },
  chip: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#2563eb', fontSize: 13 },
  chipTextActive: { color: '#fff', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  amountInput: { fontSize: 22, fontWeight: '600' },
  segment: { flexDirection: 'row', borderRadius: 8, backgroundColor: '#eee', padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  segmentButtonActive: { backgroundColor: '#fff' },
  segmentText: { color: '#666', fontSize: 14 },
  segmentTextActive: { color: '#111', fontSize: 14, fontWeight: '600' },
  saveButton: { marginTop: 20, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c0392b', fontSize: 12, marginTop: 4 },
});
```

- [ ] **Step 2: Write the screen**

`app/recurring/new.tsx`:
```tsx
// Modal: create a recurring rule. Reached from the Add tab ("Repeats every month?")
// and from a property's Recurring list. Params: kind (default expense), propertyId.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { RecurringRuleForm } from '@/components/recurring-rule-form';
import type { CategoryKind } from '@/types';

export default function NewRecurringRuleScreen() {
  const { kind, propertyId } = useLocalSearchParams<{ kind?: CategoryKind; propertyId?: string }>();
  const resolvedKind: CategoryKind = kind === 'income' ? 'income' : 'expense';
  return (
    <>
      <Stack.Screen options={{ title: resolvedKind === 'expense' ? 'Recurring Expense' : 'Recurring Income' }} />
      <RecurringRuleForm kind={resolvedKind} initialPropertyId={propertyId} onSaved={() => router.back()} />
    </>
  );
}
```

- [ ] **Step 3: Register the route in `app/_layout.tsx`**

Inside the signed-in `Stack.Protected`, after the `delete-account` screen:
```tsx
        <Stack.Screen name="recurring/new" options={{ title: 'Recurring', presentation: 'modal' }} />
```

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | tail -4`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/recurring-rule-form.tsx app/recurring/new.tsx app/_layout.tsx
git commit -m "phase-15: recurring rule form + /recurring/new modal"
```

---

## Task 9: Entry points — Add tab link, property "Recurring" list screen with Stop/Delete

**Files:**
- Modify: `app/(tabs)/add.tsx`
- Create: `app/property/[id]/recurring.tsx`
- Modify: `app/property/[id]/index.tsx` (header link + ↻ badge)
- Modify: `app/_layout.tsx` (register route)

**Interfaces:**
- Consumes: `listRecurringRules`, `stopRecurringRule`, `deleteRecurringRule` (Task 6); `confirmDelete` (existing); `TimelineEntry.recurring_id` (Task 7).

- [ ] **Step 1: Add tab link**

In `app/(tabs)/add.tsx`, import `Link` from `expo-router` and add below the segment control (before `<AddTransactionForm …/>`):
```tsx
      <Link
        href={{ pathname: '/recurring/new', params: { kind } }}
        style={styles.recurringLink}
      >
        Repeats every month? Set up a recurring {kind} →
      </Link>
```
and to `styles`:
```typescript
  recurringLink: { color: '#2563eb', fontSize: 13, textAlign: 'center', marginBottom: 4 },
```

- [ ] **Step 2: Property recurring list screen**

`app/property/[id]/recurring.tsx`:
```tsx
// Per-property recurring rules: active and stopped, with Stop (README §4.4) and
// Delete (history kept via on delete set null). New rule → /recurring/new modal.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { listCategories } from '@/db/categories';
import { getProperty } from '@/db/properties';
import { deleteRecurringRule, listRecurringRules, stopRecurringRule } from '@/db/recurring';
import { confirmDelete } from '@/lib/confirm-delete';
import { monthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { RecurringRule } from '@/types';

export default function PropertyRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: property } = useQuery({ queryKey: ['property', id], queryFn: () => getProperty(id) });
  const { data: rules, isPending } = useQuery({
    queryKey: ['recurring', { propertyId: id }],
    queryFn: () => listRecurringRules(id),
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
  };
  const stopMutation = useMutation({
    mutationFn: (ruleId: string) => stopRecurringRule(ruleId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not stop rule', e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteRecurringRule(ruleId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not delete rule', e.message),
  });

  const categoryName = (catId: string) => categories?.find((c) => c.id === catId)?.name ?? 'Unknown';
  const endsLabel = (r: RecurringRule) =>
    r.end_mode === 'count' ? `for ${r.occurrences} months` : r.stopped_on ? `stopped ${r.stopped_on}` : 'until stopped';

  const onStop = (r: RecurringRule) =>
    Alert.alert('Stop this rule?', 'No more months will be posted. Past entries are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => stopMutation.mutate(r.id) },
    ]);
  const onDelete = (r: RecurringRule) =>
    confirmDelete(
      'Delete this rule?',
      'Entries already posted stay in your ledger and still count toward totals.',
      () => deleteMutation.mutate(r.id)
    );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${property?.name ?? 'Property'} · Recurring` }} />
      <View style={styles.header}>
        <Link href={{ pathname: '/recurring/new', params: { kind: 'expense', propertyId: id } }} style={styles.link}>
          + Expense rule
        </Link>
        <Link href={{ pathname: '/recurring/new', params: { kind: 'income', propertyId: id } }} style={styles.link}>
          + Income rule
        </Link>
      </View>
      {isPending ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={rules}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<Text style={styles.empty}>No recurring rules for this property yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.row, !item.is_active && styles.rowInactive]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  {categoryName(item.category_id)} · {item.kind === 'income' ? '+' : '−'}
                  {formatMoney(item.amount)}/mo
                </Text>
                <Text style={styles.rowMeta}>
                  from {monthKey(item.start_month)} · {endsLabel(item)}
                  {item.notes ? ` · ${item.notes}` : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                {item.is_active && item.end_mode === 'until_stopped' ? (
                  <Pressable onPress={() => onStop(item)}>
                    <Text style={styles.stop}>Stop</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => onDelete(item)}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 16, paddingVertical: 10 },
  link: { color: '#2563eb', fontSize: 14 },
  spinner: { marginTop: 32 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowInactive: { opacity: 0.55 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 14 },
  stop: { color: '#b45309', fontSize: 14 },
  delete: { color: '#dc2626', fontSize: 14 },
});
```

- [ ] **Step 3: Property detail — link + badge**

In `app/property/[id]/index.tsx`:
- In the header `View` (the one holding "Edit details"), add before the existing `Link`:
```tsx
        <Link href={{ pathname: '/property/[id]/recurring', params: { id } }} asChild>
          <Pressable>
            <Text style={styles.editLink}>Recurring</Text>
          </Pressable>
        </Link>
```
  and change `header` style to `{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 16, paddingTop: 8 }`.
- In the row render, change the category line to badge generated rows:
```tsx
                  <Text style={styles.rowCategory}>
                    {item.recurring_id ? '↻ ' : ''}
                    {categoryName(item.category_id)}
                  </Text>
```

- [ ] **Step 4: Register the route**

`app/_layout.tsx`, after `property/[id]/edit`:
```tsx
        <Stack.Screen name="property/[id]/recurring" options={{ title: 'Recurring' }} />
```

- [ ] **Step 5: Typecheck + suite + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | tail -4`
```bash
git add 'app/(tabs)/add.tsx' 'app/property/[id]/recurring.tsx' 'app/property/[id]/index.tsx' app/_layout.tsx
git commit -m "phase-15: recurring entry points — Add tab link, property rule list with Stop/Delete, ↻ badge"
```

---

## Task 10: Edit screen — generated-entry badge and `is_edited` (README §4.3)

**Files:**
- Modify: `app/transaction/[kind]/[id].tsx`

**Interfaces:**
- Consumes: `Expense.recurring_id` / `Income.recurring_id` (Task 2).

- [ ] **Step 1: Set `is_edited` on save**

In `saveMutation.mutationFn`, both `updateExpense(...)` and `updateIncome(...)` calls get one more field:
```typescript
          is_edited: transaction?.recurring_id ? true : undefined,
```
(`undefined` keys are dropped by supabase-js, so manual entries are unaffected.)

- [ ] **Step 2: Badge**

Directly under `<Stack.Screen …/>` in the JSX, add:
```tsx
      {transaction?.recurring_id ? (
        <Text style={styles.recurringNote}>
          ↻ Posted by a monthly rule. Changes here apply to this month only; the rule keeps posting
          future months at its own amount.
        </Text>
      ) : null}
```
and to `styles`:
```typescript
  recurringNote: { color: '#555', fontSize: 12, marginBottom: 8, lineHeight: 16 },
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add 'app/transaction/[kind]/[id].tsx'
git commit -m "phase-15: editing a generated entry flags is_edited and explains the rule linkage"
```

---

## Task 11: Launch-time catch-up sync (README §4.2 "when the app opens")

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `syncRecurringEntries` (Task 6).

- [ ] **Step 1: Run the sync once when the signed-in tab group mounts**

Replace `app/(tabs)/_layout.tsx` with:
```tsx
// Tab group layout. Mounting this group means the user is signed in (root layout
// guards it), so it is also where the recurring catch-up runs once per launch
// (README §4.2): post any months that became due since the app last opened.
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { syncRecurringEntries } from '@/db/recurring';

export default function TabsLayout() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    syncRecurringEntries()
      .then((inserted) => {
        if (cancelled || inserted === 0) return;
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['income'] });
      })
      .catch((e: Error) => console.warn('recurring sync failed', e.message));
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="properties" options={{ title: 'Properties' }} />
      <Tabs.Screen name="add" options={{ title: 'Add' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
    </Tabs>
  );
}
```
A failed sync must never block the UI — it logs and the next launch retries (generation is idempotent, so retries are safe).

- [ ] **Step 2: Typecheck + suite + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | tail -4`
```bash
git add 'app/(tabs)/_layout.tsx'
git commit -m "phase-15: run recurring catch-up on launch"
```

---

## Task 12: Live end-to-end verification, version bump, WORKLOG

**Files:**
- Modify: `WORKLOG.md`, `app.json` (`expo.version` → `1.1.0`), `docs/app-store-listing.md` (What's New)

- [ ] **Step 1: WORKLOG START line**

Append to `WORKLOG.md`:
```
## Phase 15 — Recurring Items
- START: <UTC timestamp> — agent: claude — Beginning Phase 15 (README §4, recurring-only plan docs/superpowers/plans/2026-09-20-recurring-only.md).
```

- [ ] **Step 2: Live verification against the demo account (psql, bypasses RLS)**

Create a rule for the demo user and run the sync **through the app code path** using a small node script that signs in as the demo account with the anon key, so RLS and `getUser()` are exercised for real. Demo credentials come from the environment; never commit them.

```bash
cd /Users/riyad/OrganicHub/propertyledger && set -a && source .env && set +a
cat > /tmp/recurring-e2e.mjs <<'EOF'
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({ email: process.env.E2E_DEMO_EMAIL, password: process.env.E2E_DEMO_PASSWORD });
if (authErr) throw authErr;
const { data: user } = await sb.auth.getUser();
const { data: cat } = await sb.from('categories').select('id').eq('name', 'Mortgage Principal').single();
const { data: rule, error } = await sb.from('recurring_rules').insert({
  user_id: user.user.id, property_id: '11111111-0000-0000-0000-000000000001', category_id: cat.id,
  kind: 'expense', amount: 611.83, notes: 'e2e', start_month: '2026-01-01', end_mode: 'count', occurrences: 3,
}).select().single();
if (error) throw error;
console.log('rule', rule.id);
EOF
node /tmp/recurring-e2e.mjs
```
Then launch the app on the simulator (build from Task 13 of this plan, or `npx expo start` with the dev client if available), sign in as the demo account, and confirm on Maple Street Duplex:
- Exactly 3 new `↻ Mortgage Principal −$611.83` rows dated 2026-01-01, 2026-02-01, 2026-03-01.
- Kill and relaunch the app: still exactly 3 (idempotent).
- Edit the February one to 700 → save; relaunch: still 3, February shows 700; `select is_edited from expenses where recurring_id='<rule>' and paid_on='2026-02-01'` → `t`.
- Property → Recurring → Delete the rule; the 3 rows remain (`recurring_id` now null).

Clean up the e2e rows so the demo account matches the submitted screenshots:
```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "host=db.dxjwyaldmxquuztmnrsb.supabase.co port=5432 dbname=postgres user=postgres sslmode=require" -c \
 "delete from expenses where notes = 'e2e' and user_id = 'a4575095-3ad1-4d02-9ead-11d6f605274c';"
```

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit && npm test 2>&1 | grep -E 'Tests:|Suites:'`
Expected: 0 failures; suite count = previous 22 + 4 new (dates-month, recurring, recurring-rule-validation, recurring-db).

- [ ] **Step 4: Version + listing**

- `app.json`: `"version": "1.1.0"`.
- `docs/app-store-listing.md`: add a `## What's New (1.1)` section:
  ```
  Recurring income and expenses. Set up a rent payment or a monthly bill once — PropertyLedger posts it on the 1st of every month, backfills from the start month you choose, and lets you edit or delete any single month without touching the rest. Stop a rule any time; your history stays.
  ```

- [ ] **Step 5: WORKLOG FINISH line + commit**

Append the FINISH line in the same format as Phase 13 (test counts, tsc clean, files touched, the live e2e results from Step 2).
```bash
git add WORKLOG.md app.json docs/app-store-listing.md
git commit -m "phase-15: recurring items — verified live; version 1.1.0"
```

---

## Task 13: Ship 1.1 (only after 1.0 is approved)

**Files:** none in-repo.

- [ ] **Step 1: Confirm 1.0 is approved / released** — do not create version 1.1 in App Store Connect while 1.0 is still `WAITING_FOR_REVIEW` / `IN_REVIEW`; Apple allows only one version in flight.

- [ ] **Step 2: Build + submit**

```bash
npx eas-cli@latest build -p ios --profile production --auto-submit --non-interactive --no-wait
```

- [ ] **Step 3: Version 1.1 in ASC** — create the 1.1 version, paste the What's New text, attach the new build, reuse the existing screenshots (add a 7th of the Recurring rule form if desired), submit. The review-info demo account still applies.

---

## Self-review against README §4

| README requirement | Task |
|---|---|
| §4.1 fields: project, category, kind, amount, start month, end condition (count N / until stopped) | 1 (schema), 2 (types), 5 (validation), 8 (form) |
| §4.2 pure `generateDueEntries(rule, today)` — start_month → current month, never future | 4 |
| §4.2 runs on app open (catch-up) | 11 |
| §4.2 runs right after rule creation | 8 (`syncRule` in `saveMutation`) |
| §4.2 entry copies amount/category, `occurred_on` = 1st of month, `recurring_id`, `is_edited=false` | 4, 6 |
| §4.2 idempotent, month-level check, "open five times → no copies" | 4 tests 3–4, 12 step 2 |
| §4.2 never before start_month / after stopped_on / beyond occurrences / future | 4 |
| §4.3 editing sets `is_edited=true`; generator never touches it | 10; 4 (generator only inserts) |
| §4.3 rule amount change affects only future months | 4 test 5; 6 (`updateRecurringRule`) |
| §4.4 count rules end themselves | 4 |
| §4.4 Stop → `stopped_on=today`, `is_active=false`, history kept | 6, 9 |
| §4.4 deleting rule keeps entries (`on delete set null`) | 1, 9 |
| §4.5 all eight test bullets | 4 (tests 1–7, 9) |
| §3 `recurring_rules` DDL + RLS | 1 |

Out of scope by decision (not gaps): §3 `projects` rename, §3 unified `entries` table, §1 "Project" wording.
