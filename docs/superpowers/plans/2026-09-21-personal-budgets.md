# Personal Budgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a ledger be either a rental property or a personal budget - same screens, same entries and recurring rules - with budget-appropriate categories, wording, a savings-rate metric and month-first reports, without changing anything a rental-only user sees.

**Architecture:** `properties.property_type` (`'rental' | 'personal'`) already exists and is the ledger kind. One additive column `categories.scope` plus seeded personal categories; one pure module `src/lib/ledger-copy.ts` owns every user-facing noun that depends on kind; `src/lib/categories.ts` gains a scope-aware selector; `src/lib/aggregate.ts` gains month ranges and `savingsRate`. Screens swap literals for calls into those modules. No route, query-key, type or table rename.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, TypeScript, @tanstack/react-query, @supabase/supabase-js, date-fns, Jest + jest-expo. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-21-personal-budgets-design.md`

## Global Constraints

- Every file under `src/lib/` has zero React and zero network imports.
- All dates are ISO `YYYY-MM-DD` strings; money is dollars in JS backed by `numeric(12,2)`, summed in integer cents (existing `toCents`/`toDollars` in `src/lib/aggregate.ts`).
- Every `src/db/*.ts` insert stamps `user_id` from `supabase.auth.getUser()`.
- Migrations are additive only, applied to live project `dxjwyaldmxquuztmnrsb` with `PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "host=db.dxjwyaldmxquuztmnrsb.supabase.co port=5432 dbname=postgres user=postgres sslmode=require"` (env from `.env` via `set -a; source .env; set +a`), and mirrored into `supabase/schema.sql` / `supabase/seed_categories.sql`.
- A rental-only user must see identical screens and words after this change (spec §8.2). Existing test suites stay green.
- The DB, routes (`/property/[id]`), query keys (`['properties']`) and type names (`Property`, `PropertyType`) are **not** renamed (spec §3).
- Vocabulary (spec §3): rental → "Property"/"Properties"; personal → "Budget"/"Budgets"; mixed or none → "Ledgers". Party label: rental → Vendor/Source; personal → Payee/Source.
- Category scopes (spec §4.1): `'rental' | 'personal' | 'both'`, default `'rental'`; a ledger sees `scope in (its kind, 'both')`.
- `npm test` and `npx tsc --noEmit` clean at the end of every task. Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Store listing changes (spec §7) happen only after App Store version 1.0 is approved.

---

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/2026-09-22-category-scope.sql` (create) | `categories.scope` column; re-scope 17 shared system rows to `both`; insert 26 personal system rows. |
| `supabase/schema.sql`, `supabase/seed_categories.sql` (modify) | Mirror the DDL / seed. |
| `src/types/index.ts` (modify) | `CategoryScope`; `Category.scope`; `LedgerKind = PropertyType` alias. |
| `src/lib/ledger-copy.ts` (create) | `nounFor`, `partyLabel`, `collectionTitle`, `kindsOf`. |
| `src/lib/categories.ts` (modify) | `categoriesForLedger(categories, ledgerKind, entryKind)`. |
| `src/lib/add-transaction-state.ts` (modify) | `orderCategoriesByRecent` gains an optional `ledgerKind` argument. |
| `src/lib/aggregate.ts` (modify) | `thisMonthRange`, `lastMonthRange`, `savingsRate`. |
| `src/lib/dashboard.ts` (modify) | `monthPL`, `monthSavingsRate` on the model. |
| `src/db/categories.ts` (modify) | `createCategory(name, kind, scope)`. |
| `src/components/property-form.tsx` (modify) | Kind picker with labels; hide address/purchase for personal. |
| `src/components/dashboard-view.tsx` (modify) | Month line in hero; collection title. |
| `src/components/add-transaction-form.tsx`, `recurring-rule-form.tsx` (modify) | Noun/party labels by selected ledger; scope-filtered categories; `+ New` passes scope. |
| `app/(tabs)/properties.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` (modify) | Collection title; grouped list when mixed. |
| `app/(tabs)/reports.tsx` (modify) | This month / Last month presets; savings line; default preset by kinds. |
| `app/property/[id]/index.tsx`, `recurring.tsx`, `app/recurring/[id].tsx`, `app/transaction/[kind]/[id].tsx`, `app/history.tsx`, `app/_layout.tsx` (modify) | Labels through `ledger-copy`; scope-filtered category chips. |
| `app/categories.tsx` (modify) | Scope chip on the add row; sections by scope. |
| `app/onboarding.tsx` (create), `app/(tabs)/index.tsx` (modify) | First-run chooser when the user has zero ledgers. |
| `__tests__/ledger-copy.test.ts`, `categories-lib.test.ts`, `aggregate.test.ts`, `dashboard.test.tsx`, `add-transaction-state.test.ts`, `categories-db.test.ts` | Tests. |
| `README.md`, `docs/app-store-listing.md`, `WORKLOG.md` | Docs. |

---

## Task 1: Category scope - migration, seed, types

**Files:**
- Create: `supabase/migrations/2026-09-22-category-scope.sql`
- Modify: `supabase/schema.sql` (append), `supabase/seed_categories.sql` (append), `src/types/index.ts`

**Interfaces:**
- Produces: `export type CategoryScope = 'rental' | 'personal' | 'both'`; `Category.scope: CategoryScope`; `export type LedgerKind = PropertyType`.

- [ ] **Step 1: Write the migration**

```sql
-- Personal budgets (spec §4.1): categories carry a scope so a budget ledger sees
-- household categories and a rental ledger keeps its Schedule-E set. Additive.
alter table categories
  add column if not exists scope text not null default 'rental'
  check (scope in ('rental', 'personal', 'both'));

-- Shared household/property costs apply to both kinds.
update categories set scope = 'both'
 where is_system = true and name in (
  'Insurance','Water','Sewer','Garbage','Electric','Gas/Heating','Internet/Cable',
  'HOA Fees','Repairs','Maintenance','Cleaning','Supplies','Appliances',
  'Legal/Professional Fees','Bank/Loan Fees','Other Expense','Other Income');

-- Personal system categories (idempotent on name+kind+scope).
insert into categories (name, kind, is_system, scope)
select v.name, v.kind, true, 'personal'
from (values
  ('Groceries','expense'),('Dining Out','expense'),('Rent/Mortgage','expense'),
  ('Car Payment','expense'),('Car Insurance','expense'),('Fuel','expense'),
  ('Public Transit','expense'),('Phone','expense'),('Health/Medical','expense'),
  ('Childcare','expense'),('Education','expense'),('Subscriptions','expense'),
  ('Clothing','expense'),('Personal Care','expense'),('Entertainment','expense'),
  ('Gifts','expense'),('Travel','expense'),('Charity','expense'),
  ('Debt Payment','expense'),('Savings Transfer','expense'),
  ('Salary','income'),('Bonus','income'),('Freelance','income'),
  ('Interest/Dividends','income'),('Refund','income'),('Gift Received','income')
) as v(name, kind)
where not exists (
  select 1 from categories c
   where c.is_system = true and c.name = v.name and c.kind = v.kind and c.scope = 'personal');
```

- [ ] **Step 2: Mirror into `supabase/schema.sql` and `supabase/seed_categories.sql`**

Append to `schema.sql` a `-- CATEGORY SCOPE (personal budgets)` section with the `alter table … add column … check (…)` statement only. Append to `seed_categories.sql` a `-- Personal budget categories` section containing the `update … set scope = 'both'` statement and a plain `insert into categories (name, kind, is_system, scope) values (…)` list of the same 26 rows (the seed file is run once on a fresh project, so no `where not exists` there).

- [ ] **Step 3: Apply live and verify**

```bash
cd /Users/riyad/OrganicHub/propertyledger && set -a && source .env && set +a
P='host=db.dxjwyaldmxquuztmnrsb.supabase.co port=5432 dbname=postgres user=postgres sslmode=require'
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$P" -Atc "select count(*) from categories where is_system;"   # expect 36
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$P" -v ON_ERROR_STOP=1 -f supabase/migrations/2026-09-22-category-scope.sql
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$P" -Atc "select scope, count(*) from categories where is_system group by 1 order by 1;"
```
Expected after: `both|17`, `personal|26`, `rental|19` (36 + 26 = 62 system rows). Run the migration a second time: counts unchanged (idempotent).

- [ ] **Step 4: Types**

In `src/types/index.ts`, after `export type PropertyType = 'rental' | 'personal';` add:
```typescript
/** Same values as PropertyType; the name says what the app means by it now. */
export type LedgerKind = PropertyType;

/** Which ledger kinds a category is offered to (spec §4.1). */
export type CategoryScope = 'rental' | 'personal' | 'both';
```
and to `Category` (after `is_system`):
```typescript
  scope: CategoryScope;
```
Run `npx tsc --noEmit`; add `scope: 'rental'` to any `Category` fixture literal it flags (`__tests__/categories-lib.test.ts` `cat()` builder and any others).

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep -E 'Tests:'` - clean.
```bash
git add supabase/migrations/2026-09-22-category-scope.sql supabase/schema.sql supabase/seed_categories.sql src/types/index.ts __tests__
git commit -m "budgets: categories.scope + personal category seed"
```

---

## Task 2: `src/lib/ledger-copy.ts`

**Files:**
- Create: `src/lib/ledger-copy.ts`
- Test: `__tests__/ledger-copy.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function nounFor(kind: LedgerKind): { one: string; many: string };
  export function partyLabel(kind: LedgerKind, entryKind: CategoryKind): string;
  export function kindsOf(ledgers: Pick<Property, 'property_type' | 'is_archived'>[]): LedgerKind[]; // distinct kinds of active ledgers
  export function collectionTitle(kinds: LedgerKind[]): string;
  export function collectionNoun(kinds: LedgerKind[]): string; // singular: 'Property' | 'Budget' | 'Ledger'
  ```

- [ ] **Step 1: Write the failing tests**

```typescript
// Personal budgets - every user-facing noun that depends on ledger kind (spec §3).
import { collectionNoun, collectionTitle, kindsOf, nounFor, partyLabel } from '../src/lib/ledger-copy';

describe('nounFor', () => {
  it('rental is Property, personal is Budget', () => {
    expect(nounFor('rental')).toEqual({ one: 'Property', many: 'Properties' });
    expect(nounFor('personal')).toEqual({ one: 'Budget', many: 'Budgets' });
  });
});

describe('partyLabel', () => {
  it('rental expenses have a Vendor; personal expenses have a Payee; income is always Source', () => {
    expect(partyLabel('rental', 'expense')).toBe('Vendor');
    expect(partyLabel('personal', 'expense')).toBe('Payee');
    expect(partyLabel('rental', 'income')).toBe('Source');
    expect(partyLabel('personal', 'income')).toBe('Source');
  });
});

describe('kindsOf', () => {
  it('returns distinct kinds of active ledgers only', () => {
    expect(
      kindsOf([
        { property_type: 'rental', is_archived: false },
        { property_type: 'rental', is_archived: false },
        { property_type: 'personal', is_archived: true },
      ])
    ).toEqual(['rental']);
  });
  it('is empty with no ledgers', () => {
    expect(kindsOf([])).toEqual([]);
  });
});

describe('collectionTitle / collectionNoun', () => {
  it('all rental → Properties/Property', () => {
    expect(collectionTitle(['rental'])).toBe('Properties');
    expect(collectionNoun(['rental'])).toBe('Property');
  });
  it('all personal → Budgets/Budget', () => {
    expect(collectionTitle(['personal'])).toBe('Budgets');
    expect(collectionNoun(['personal'])).toBe('Budget');
  });
  it('mixed or none → Ledgers/Ledger', () => {
    expect(collectionTitle(['rental', 'personal'])).toBe('Ledgers');
    expect(collectionTitle([])).toBe('Ledgers');
    expect(collectionNoun([])).toBe('Ledger');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/ledger-copy.test.ts` - FAIL, cannot find module.

- [ ] **Step 3: Implement**

```typescript
// User-facing nouns that depend on ledger kind (spec §3). Pure; the only place
// "Property" vs "Budget" is decided, so no screen hard-codes either word.
import type { CategoryKind, LedgerKind, Property } from '@/types';

const NOUNS: Record<LedgerKind, { one: string; many: string }> = {
  rental: { one: 'Property', many: 'Properties' },
  personal: { one: 'Budget', many: 'Budgets' },
};

export function nounFor(kind: LedgerKind): { one: string; many: string } {
  return NOUNS[kind];
}

/** Who the money went to / came from. Landlords have vendors; households have payees. */
export function partyLabel(kind: LedgerKind, entryKind: CategoryKind): string {
  if (entryKind === 'income') return 'Source';
  return kind === 'personal' ? 'Payee' : 'Vendor';
}

/** Distinct kinds among the user's active (non-archived) ledgers, rental first. */
export function kindsOf(ledgers: Pick<Property, 'property_type' | 'is_archived'>[]): LedgerKind[] {
  const set = new Set(ledgers.filter((l) => !l.is_archived).map((l) => l.property_type));
  return (['rental', 'personal'] as const).filter((k) => set.has(k));
}

/** Tab / section title for the whole collection: one kind's plural, or "Ledgers" when mixed or empty. */
export function collectionTitle(kinds: LedgerKind[]): string {
  return kinds.length === 1 ? NOUNS[kinds[0]].many : 'Ledgers';
}

export function collectionNoun(kinds: LedgerKind[]): string {
  return kinds.length === 1 ? NOUNS[kinds[0]].one : 'Ledger';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/ledger-copy.test.ts` - PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ledger-copy.ts __tests__/ledger-copy.test.ts
git commit -m "budgets: ledger-copy owns Property/Budget/Ledger wording"
```

---

## Task 3: Scope-aware category selection

**Files:**
- Modify: `src/lib/categories.ts`, `src/lib/add-transaction-state.ts`, `src/db/categories.ts`
- Test: `__tests__/categories-lib.test.ts`, `__tests__/add-transaction-state.test.ts`, `__tests__/categories-db.test.ts`

**Interfaces:**
- Produces: `categoriesForLedger(categories: Category[], ledgerKind: LedgerKind, entryKind: CategoryKind): Category[]`; `orderCategoriesByRecent(categories, recentIds, kind, ledgerKind?: LedgerKind)` (when `ledgerKind` is given, filters by scope first); `createCategory(name: string, kind: CategoryKind, scope: CategoryScope = 'both'): Promise<Category>`.

- [ ] **Step 1: Failing tests**

Append to `__tests__/categories-lib.test.ts` (its `cat()` builder now includes `scope: 'rental'` from Task 1):
```typescript
describe('categoriesForLedger', () => {
  const scoped: Category[] = [
    cat({ id: 'r', name: 'Mortgage Interest', kind: 'expense', scope: 'rental' }),
    cat({ id: 'b', name: 'Electric', kind: 'expense', scope: 'both' }),
    cat({ id: 'p', name: 'Groceries', kind: 'expense', scope: 'personal' }),
    cat({ id: 'pi', name: 'Salary', kind: 'income', scope: 'personal' }),
  ];
  it('a rental ledger sees rental + both, never personal', () => {
    expect(categoriesForLedger(scoped, 'rental', 'expense').map((c) => c.id)).toEqual(['r', 'b']);
  });
  it('a personal ledger sees personal + both, never rental', () => {
    expect(categoriesForLedger(scoped, 'personal', 'expense').map((c) => c.id)).toEqual(['b', 'p']);
  });
  it('still filters by entry kind', () => {
    expect(categoriesForLedger(scoped, 'personal', 'income').map((c) => c.id)).toEqual(['pi']);
  });
});
```
Add `categoriesForLedger` to that file's import. Append to `__tests__/add-transaction-state.test.ts` (find its category fixture builder; add `scope` values as below):
```typescript
describe('orderCategoriesByRecent with a ledger kind', () => {
  it('drops out-of-scope categories before ordering, and a recent id that is out of scope is ignored', () => {
    const cats = [
      category({ id: 'r', kind: 'expense', scope: 'rental' }),
      category({ id: 'b', kind: 'expense', scope: 'both' }),
      category({ id: 'p', kind: 'expense', scope: 'personal' }),
    ];
    expect(orderCategoriesByRecent(cats, ['r', 'p'], 'expense', 'personal').map((c) => c.id)).toEqual(['p', 'b']);
  });
  it('without a ledger kind behaves exactly as before', () => {
    const cats = [category({ id: 'r', kind: 'expense', scope: 'rental' }), category({ id: 'p', kind: 'expense', scope: 'personal' })];
    expect(orderCategoriesByRecent(cats, ['p'], 'expense').map((c) => c.id)).toEqual(['p', 'r']);
  });
});
```
Append to `__tests__/categories-db.test.ts` (it already mocks `supabase.from` with a recording builder and `auth.getUser`):
```typescript
it('createCategory sends the scope, defaulting to both', async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  const builder = createBuilder({ data: { id: 'c9' }, error: null });
  mockFrom.mockReturnValue(builder);
  await createCategory('Groceries', 'expense', 'personal');
  expect(builder.calls).toContainEqual({ method: 'insert', args: [{ name: 'Groceries', kind: 'expense', user_id: 'u1', is_system: false, scope: 'personal' }] });
  await createCategory('Misc', 'expense');
  expect(builder.calls).toContainEqual({ method: 'insert', args: [{ name: 'Misc', kind: 'expense', user_id: 'u1', is_system: false, scope: 'both' }] });
});
```
(Use that file's existing builder/mock names; if it lacks a `createBuilder`, copy the one from `__tests__/recurring-db.test.ts`.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest __tests__/categories-lib.test.ts __tests__/add-transaction-state.test.ts __tests__/categories-db.test.ts` - FAIL (missing export / wrong payload).

- [ ] **Step 3: Implement**

`src/lib/categories.ts` - append:
```typescript
/** Categories a ledger of `ledgerKind` may use for `entryKind` entries (spec §4.1). */
export function categoriesForLedger(
  categories: Category[],
  ledgerKind: LedgerKind,
  entryKind: CategoryKind
): Category[] {
  return categories.filter(
    (c) => c.kind === entryKind && (c.scope === 'both' || c.scope === ledgerKind)
  );
}
```
(import `LedgerKind` from `@/types`.)

`src/lib/add-transaction-state.ts` - change the signature and first line:
```typescript
export function orderCategoriesByRecent(
  categories: Category[],
  recentIds: string[],
  kind: CategoryKind,
  ledgerKind?: LedgerKind
): Category[] {
  const ofKind = ledgerKind
    ? categoriesForLedger(categories, ledgerKind, kind)
    : categories.filter((c) => c.kind === kind);
```
(import `categoriesForLedger` from `./categories` and `LedgerKind` from `@/types`; the rest of the function is unchanged.)

`src/db/categories.ts`:
```typescript
export async function createCategory(
  name: string,
  kind: CategoryKind,
  scope: CategoryScope = 'both'
): Promise<Category> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not signed in.');
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim(), kind, user_id: userData.user.id, is_system: false, scope })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}
```

- [ ] **Step 4: Run to verify they pass; full suite; commit**

Run: `npx jest __tests__/categories-lib.test.ts __tests__/add-transaction-state.test.ts __tests__/categories-db.test.ts && npx tsc --noEmit && npm test -- --silent 2>&1 | grep Tests:`
```bash
git add src/lib/categories.ts src/lib/add-transaction-state.ts src/db/categories.ts __tests__
git commit -m "budgets: scope-aware category selection; createCategory takes a scope"
```

---

## Task 4: Month ranges and savings rate

**Files:**
- Modify: `src/lib/aggregate.ts`, `src/lib/dashboard.ts`
- Test: `__tests__/aggregate.test.ts`, `__tests__/dashboard.test.tsx`

**Interfaces:**
- Produces: `thisMonthRange(todayIso): DateRange`, `lastMonthRange(todayIso): DateRange`, `savingsRate(pl: PL): number | null` (fraction, e.g. `0.18`; `null` when `totalIncome <= 0`); `DashboardModel.monthPL: PL`, `DashboardModel.monthSavingsRate: number | null`.

- [ ] **Step 1: Failing tests**

Append to `__tests__/aggregate.test.ts` (import the three new names):
```typescript
describe('month presets', () => {
  it('thisMonthRange covers the 1st through the last day of the month', () => {
    expect(thisMonthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(thisMonthRange('2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(thisMonthRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
  it('lastMonthRange rolls over the year boundary', () => {
    expect(lastMonthRange('2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(lastMonthRange('2026-03-01')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('savingsRate', () => {
  it('is net over income, exact for cents', () => {
    expect(savingsRate({ totalIncome: 5000, totalExpense: 4100, net: 900 })).toBeCloseTo(0.18, 10);
  });
  it('is negative when overspending', () => {
    expect(savingsRate({ totalIncome: 1000, totalExpense: 1250, net: -250 })).toBeCloseTo(-0.25, 10);
  });
  it('is null with no income (nothing to save from)', () => {
    expect(savingsRate({ totalIncome: 0, totalExpense: 300, net: -300 })).toBeNull();
  });
});
```
Append to `__tests__/dashboard.test.tsx` inside `describe('buildDashboardModel')` (use its existing `expense()`/`income()`/`TODAY` helpers; `TODAY` is `'2026-07-15'` there - check and adapt the dates):
```typescript
  it('month figures cover only the current month and carry a savings rate', () => {
    const model = buildDashboardModel(
      [],
      [expense({ id: 'e-this', amount: 400, paid_on: '2026-07-02' }), expense({ id: 'e-last', amount: 999, paid_on: '2026-06-30' })],
      [income({ id: 'i-this', amount: 1000, received_on: '2026-07-01' })],
      TODAY
    );
    expect(model.monthPL).toEqual({ totalIncome: 1000, totalExpense: 400, net: 600 });
    expect(model.monthSavingsRate).toBeCloseTo(0.6, 10);
  });
  it('month savings rate is null when the month has no income', () => {
    const model = buildDashboardModel([], [expense({ id: 'e', amount: 10, paid_on: '2026-07-02' })], [], TODAY);
    expect(model.monthSavingsRate).toBeNull();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest __tests__/aggregate.test.ts __tests__/dashboard.test.tsx` - FAIL.

- [ ] **Step 3: Implement**

`src/lib/aggregate.ts` - append (add `import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';` at the top; `date-fns` is already a dependency and `src/lib/dates.ts` uses the same functions):
```typescript
/** Preset: This Month - the 1st through the last day of today's month. */
export function thisMonthRange(todayIso: string): DateRange {
  const d = parseISO(todayIso);
  return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') };
}

/** Preset: Last Month. */
export function lastMonthRange(todayIso: string): DateRange {
  const d = addMonths(parseISO(todayIso), -1);
  return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') };
}

/**
 * Net as a fraction of income: the one number a household tracks (spec §6).
 * Null when there is no income - a rate of "saved -∞%" helps nobody.
 */
export function savingsRate(pl: PL): number | null {
  if (pl.totalIncome <= 0) return null;
  return toCents(pl.net) / toCents(pl.totalIncome);
}
```

`src/lib/dashboard.ts`:
```typescript
export interface DashboardModel {
  /** Portfolio P&L for the current calendar year. */
  yearPL: PL;
  /** Portfolio P&L for the current month - the household view. */
  monthPL: PL;
  /** monthPL.net ÷ monthPL.totalIncome, or null when the month has no income. */
  monthSavingsRate: number | null;
  /** This-year mini P&L per active (non-archived) property. */
  propertyCards: PropertyPL[];
  /** The five most recent transactions across all properties. */
  recent: TimelineEntry[];
}

export function buildDashboardModel(
  properties: Property[],
  expenses: Expense[],
  income: Income[],
  todayIso: string
): DashboardModel {
  const range = thisYearRange(todayIso);
  const monthPL = calcPL(expenses, income, thisMonthRange(todayIso));
  const activeProperties = properties.filter((p) => !p.is_archived);
  return {
    yearPL: calcPL(expenses, income, range),
    monthPL,
    monthSavingsRate: savingsRate(monthPL),
    propertyCards: calcPLByProperty(activeProperties, expenses, income, range),
    recent: buildTimeline(expenses, income).slice(0, RECENT_COUNT),
  };
}
```
(add `savingsRate, thisMonthRange` to the `./aggregate` import.)

- [ ] **Step 4: Run to verify they pass; commit**

Run: `npx jest __tests__/aggregate.test.ts __tests__/dashboard.test.tsx && npx tsc --noEmit`
```bash
git add src/lib/aggregate.ts src/lib/dashboard.ts __tests__/aggregate.test.ts __tests__/dashboard.test.tsx
git commit -m "budgets: month ranges, savings rate, month figures on the dashboard model"
```

---

## Task 5: Ledger form - kind picker with labels, personal hides property fields

**Files:**
- Modify: `src/components/property-form.tsx`, `app/property/new.tsx`, `app/property/[id]/edit.tsx`, `app/_layout.tsx:39-41`

**Interfaces:**
- Consumes: `nounFor` (Task 2).

- [ ] **Step 1: Kind picker**

In `src/components/property-form.tsx` replace the `Type *` block with:
```tsx
      <Text style={styles.label}>What is this ledger for? *</Text>
      <ScrollView horizontal contentContainerStyle={styles.typeRow}>
        {(
          [
            ['rental', 'Rental property'],
            ['personal', 'Personal budget'],
          ] as const
        ).map(([type, label]) => (
          <Pressable
            key={type}
            style={[styles.typeChip, propertyType === type && styles.typeChipActive]}
            onPress={() => setPropertyType(type)}
          >
            <Text style={propertyType === type ? styles.typeChipTextActive : styles.typeChipText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {errors.property_type ? <Text style={styles.error}>{errors.property_type}</Text> : null}
```
Move this block **above** the Name field, and make the Name placeholder depend on kind: `placeholder={propertyType === 'personal' ? 'e.g. Household' : 'e.g. 12 Maple St'}` and `accessibilityLabel={`${nounFor(propertyType).one} name`}`.

- [ ] **Step 2: Hide address / purchase fields for personal**

Wrap the Address, Purchase date and Purchase price fields (labels + inputs + `errors.price`) in `{propertyType === 'rental' ? ( <> … </> ) : null}`. In `submit`, keep the payload shape but send nulls for personal:
```typescript
    const isRental = propertyType === 'rental';
    onSubmit({
      name: name.trim(),
      property_type: propertyType,
      address: isRental ? address.trim() || null : null,
      purchase_date: isRental ? purchaseDate.trim() || null : null,
      purchase_price: isRental ? price ?? null : null,
      notes: notes.trim() || null,
    });
```
and only add the price error when `isRental`.

- [ ] **Step 3: Button and titles**

- `app/property/new.tsx`: `submitLabel="Create"` (the kind picker already says what).
- `app/property/[id]/edit.tsx`: the archive button text becomes `` `${property.is_archived ? 'Unarchive' : 'Archive'} ${nounFor(property.property_type).one}` ``.
- `app/_layout.tsx`: titles `'New Property'` → `'New Ledger'`, `'Property'` → `'Ledger'`, `'Edit Property'` → `'Edit Ledger'` (each of those screens sets its own `Stack.Screen` title with the real name/kind, so these are fallbacks only).

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep Tests:`
```bash
git add src/components/property-form.tsx app/property/new.tsx 'app/property/[id]/edit.tsx' app/_layout.tsx
git commit -m "budgets: ledger form picks rental vs personal; budgets hide property-only fields"
```

---

## Task 6: Collection titles and grouped list (tabs, dashboard, properties)

**Files:**
- Modify: `app/(tabs)/_layout.tsx`, `app/(tabs)/properties.tsx`, `src/components/dashboard-view.tsx`, `app/(tabs)/index.tsx`
- Test: `__tests__/dashboard.test.tsx`

**Interfaces:**
- Consumes: `kindsOf`, `collectionTitle`, `nounFor` (Task 2); `DashboardModel.monthPL/monthSavingsRate` (Task 4).
- Produces: `DashboardView` gains prop `collectionTitle: string`.

- [ ] **Step 1: Failing render test**

In `__tests__/dashboard.test.tsx`, both `DashboardView` renders gain `collectionTitle="Ledgers"`; add to the populated test: `expect(getByText(/This month/)).toBeTruthy();` and to the empty test: `expect(getByText(/No ledgers yet/i)).toBeTruthy();` (replacing the `/No properties yet/` assertion).

- [ ] **Step 2: Tab bar title**

`app/(tabs)/_layout.tsx`: the Properties tab title must follow the user's ledgers. Add a query and derive the label:
```tsx
import { useQuery } from '@tanstack/react-query';
import { listProperties } from '@/db/properties';
import { collectionTitle, kindsOf } from '@/lib/ledger-copy';
…
  const { data: ledgers } = useQuery({
    queryKey: ['properties', { includeArchived: false }],
    queryFn: () => listProperties(),
  });
  const ledgersTitle = collectionTitle(kindsOf(ledgers ?? []));
…
      <Tabs.Screen
        name="properties"
        options={{ title: ledgersTitle, tabBarIcon: tabIcon('home-outline', 'home') }}
      />
```

- [ ] **Step 3: Ledgers tab**

`app/(tabs)/properties.tsx`:
- `<Stack.Screen options={{ title }} />` is not used here (tabs header) - instead the tab header title comes from Step 2.
- Replace the `FlatList` with a `SectionList` when kinds are mixed. Build sections:
```tsx
  const kinds = kindsOf(data ?? []);
  const sections =
    kinds.length > 1
      ? (['rental', 'personal'] as const).map((k) => ({
          title: nounFor(k).many,
          data: (data ?? []).filter((p) => p.property_type === k),
        }))
      : [{ title: '', data: data ?? [] }];
```
Render with `SectionList` (`renderSectionHeader` returns `null` when `section.title === ''`, else a `Text` with `styles.sectionHeader = { ...type.title, fontSize: 17, marginTop: 8 }`). Keep `refreshing`, `onRefresh`, `ListEmptyComponent`, `contentContainerStyle`.
- Empty copy: `` `No active ${collectionTitle(kinds).toLowerCase()}. Add one to start.` `` and `'Nothing here yet.'` for the archived view.
- Row meta: `{property.property_type === 'personal' ? 'budget' : 'rental'}` plus the address suffix as now.
- The `+ Add` button label stays.

- [ ] **Step 4: Dashboard**

`src/components/dashboard-view.tsx`:
- Add prop `collectionTitle: string`; use it for the section title and the empty copy `` `No ${collectionTitle.toLowerCase()} yet - add one on the ${collectionTitle} tab.` ``.
- In the hero card, after `netRow`, add a month line:
```tsx
        <Text style={styles.netMonth}>
          This month {formatMoney(monthPL.net)}
          {monthSavingsRate !== null ? ` · ${monthSavingsRate >= 0 ? 'saved' : 'over by'} ${Math.abs(Math.round(monthSavingsRate * 100))}%` : ''}
        </Text>
```
with `netMonth: { ...money, color: '#B8C0D0', fontSize: 13, fontWeight: '500', marginTop: 6 }` and destructure `monthPL, monthSavingsRate` from `model`.

`app/(tabs)/index.tsx`: pass `collectionTitle={collectionTitle(kindsOf(properties ?? []))}`.

- [ ] **Step 5: Verify + commit**

Run: `npx jest __tests__/dashboard.test.tsx && npx tsc --noEmit && npm test -- --silent 2>&1 | grep Tests:`
```bash
git add 'app/(tabs)/_layout.tsx' 'app/(tabs)/properties.tsx' src/components/dashboard-view.tsx 'app/(tabs)/index.tsx' __tests__/dashboard.test.tsx
git commit -m "budgets: Properties/Budgets/Ledgers titles, grouped list, month line on the dashboard"
```

---

## Task 7: Forms and ledger screens speak the selected ledger's language

**Files:**
- Modify: `src/components/add-transaction-form.tsx`, `src/components/recurring-rule-form.tsx`, `app/recurring/[id].tsx`, `app/transaction/[kind]/[id].tsx`, `app/property/[id]/index.tsx`, `app/property/[id]/recurring.tsx`, `app/history.tsx`

**Interfaces:**
- Consumes: `nounFor`, `partyLabel`, `collectionNoun`, `kindsOf` (Task 2); `orderCategoriesByRecent(..., ledgerKind)` and `categoriesForLedger` (Task 3); `createCategory(name, kind, scope)` (Task 3).

- [ ] **Step 1: Add form**

`src/components/add-transaction-form.tsx`:
- Derive the selected ledger: `const selectedLedger = (properties ?? []).find((p) => p.id === state.propertyId); const ledgerKind = selectedLedger?.property_type;`
- `const kindCategories = orderCategoriesByRecent(categories ?? [], recentCategoryIds, kind, ledgerKind);`
- Labels: `` `${collectionNoun(kindsOf(properties ?? [])) } *` `` for the ledger chips; `partyLabel(ledgerKind ?? 'rental', kind)` for the party field (replacing the `partyLabel` const that currently reads `isExpense ? 'Vendor' : 'Source'`) and its placeholder `ledgerKind === 'personal' ? 'e.g. Trader Joe\'s' : 'e.g. Allstate'`.
- `+ New` creates with the ledger's scope: `createCategory(name, kind, ledgerKind ?? 'both')`.
- When the property changes and the selected category is no longer in `kindCategories`, clear it: add
```tsx
  useEffect(() => {
    if (state.categoryId && !kindCategories.some((c) => c.id === state.categoryId)) set({ categoryId: null });
  }, [state.propertyId]); // eslint-disable-line react-hooks/exhaustive-deps
```
- The "Covers period" fields are property-tax semantics; hide them when `ledgerKind === 'personal'` (wrap in `{isExpense && ledgerKind !== 'personal' ? … : null}`), and pass `undefined` for `periodStart/End` to the validator in that case.

- [ ] **Step 2: Recurring rule form + edit rule**

`src/components/recurring-rule-form.tsx` and `app/recurring/[id].tsx`: same pattern - `ledgerKind` from the selected property, `orderCategoriesByRecent(categories ?? [], [], kind, ledgerKind)`, label `` `${collectionNoun(kindsOf(properties ?? []))} *` ``, party label `partyLabel(ledgerKind ?? 'rental', kind)` and placeholder as in Step 1, clear category when it drops out of scope.

- [ ] **Step 3: Edit transaction**

`app/transaction/[kind]/[id].tsx`: fetch the entry's ledger (`useQuery({ queryKey: ['property', transaction?.property_id], queryFn: () => getProperty(transaction!.property_id), enabled: !!transaction })`) and use `partyLabel(property?.property_type ?? 'rental', kind)` for the party label; hide "Covers period" when the ledger is personal.

- [ ] **Step 4: Ledger detail, recurring list, history**

- `app/property/[id]/index.tsx`: category filter chips use `categoriesForLedger`-aware lists: replace `(categories ?? []).map(...)` with `(categories ?? []).filter((c) => c.scope === 'both' || c.scope === property?.property_type)`; fallback title `nounFor(property?.property_type ?? 'rental').one`.
- `app/property/[id]/recurring.tsx`: no label changes needed beyond the title fallback.
- `app/history.tsx`: label `'Property'` → `collectionNoun(kindsOf(properties ?? []))`; empty copy `` `Pick a ${collectionNoun(kindsOf(properties ?? [])).toLowerCase()} and a category to see the trend.` ``; the expense-category chips filter by the selected ledger's scope (`categoriesForLedger(categories ?? [], selected?.property_type ?? 'rental', 'expense')`).

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep Tests:`. Grep guard: `grep -rn "'Property \*'\|>Property<\|Vendor'" app src --include='*.tsx'` must return nothing outside `ledger-copy.ts`.
```bash
git add src/components app/recurring 'app/transaction/[kind]/[id].tsx' 'app/property/[id]' app/history.tsx
git commit -m "budgets: forms and ledger screens use the selected ledger's nouns and categories"
```

---

## Task 8: Reports - month presets, savings line, kind-aware default

**Files:**
- Modify: `app/(tabs)/reports.tsx`

**Interfaces:**
- Consumes: `thisMonthRange`, `lastMonthRange`, `savingsRate` (Task 4); `kindsOf`, `collectionTitle` (Task 2).

- [ ] **Step 1: Presets**

```tsx
type Preset = 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'all-time' | 'custom';
```
Default: `useState<Preset>('this-year')` becomes an effect-set default - initialise to `'this-year'`, then once `properties` load, if every active ledger is personal set `'this-month'` (guard with a `useRef` so it only runs once). Preset chips in order: This Month, Last Month, This Year, Last Year, All Time, Custom. Range switch gains:
```tsx
      case 'this-month':
        return thisMonthRange(todayISO());
      case 'last-month':
        return lastMonthRange(todayISO());
```

- [ ] **Step 2: Savings line**

After the portfolio `Net` row, when `kindsOf(properties ?? []).includes('personal')`:
```tsx
          <PLRow label="Saved" value={portfolio.net} positive={portfolio.net >= 0} bold={false} />
          {savingsRate(portfolio) !== null ? (
            <Text style={styles.savingsRate}>
              {savingsRate(portfolio)! >= 0 ? 'Savings rate' : 'Overspent by'} {Math.abs(Math.round(savingsRate(portfolio)! * 100))}% of income
            </Text>
          ) : null}
```
(compute `const rate = savingsRate(portfolio)` once above the JSX instead of calling it three times.) Per-ledger cards: same line for cards whose ledger is personal (look up `properties.find(p => p.id === card.propertyId)?.property_type`). Style `savingsRate: { ...type.hint, textAlign: 'right' }`.

- [ ] **Step 3: Section title**

`'By property'` → `` `By ${collectionNoun(kindsOf(properties ?? [])).toLowerCase()}` ``.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep Tests:`
```bash
git add 'app/(tabs)/reports.tsx'
git commit -m "budgets: month presets, savings rate, kind-aware default on Reports"
```

---

## Task 9: Categories screen - scope on add, sections by scope

**Files:**
- Modify: `app/categories.tsx`

**Interfaces:**
- Consumes: `createCategory(name, kind, scope)` (Task 3), `CategoryScope` (Task 1).

- [ ] **Step 1: Add row**

Add `const [newScope, setNewScope] = useState<CategoryScope>('both');` and a second chip next to the kind chip that cycles `both → rental → personal` with labels `Both / Rental / Personal`. `addMutation.mutationFn: () => createCategory(newName, newKind, newScope)`.

- [ ] **Step 2: Sections**

Replace the two sections with six, skipping empty ones:
```tsx
  const scopes: { scope: CategoryScope; label: string }[] = [
    { scope: 'both', label: 'Shared' },
    { scope: 'rental', label: 'Rental' },
    { scope: 'personal', label: 'Personal' },
  ];
  const sections = (['expense', 'income'] as const).flatMap((kind) =>
    scopes
      .map(({ scope, label }) => ({
        title: `${label} ${kind} categories`,
        data: (data ?? []).filter((c) => c.kind === kind && c.scope === scope),
      }))
      .filter((s) => s.data.length > 0)
  );
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep Tests:`
```bash
git add app/categories.tsx
git commit -m "budgets: categories screen shows scope and sets it on new categories"
```

---

## Task 10: First-run onboarding

**Files:**
- Create: `app/onboarding.tsx`
- Modify: `app/_layout.tsx` (register), `app/(tabs)/index.tsx` (redirect when zero ledgers)

**Interfaces:**
- Consumes: `createProperty` (`src/db/properties.ts`, takes `NewProperty`), `listProperties`.

- [ ] **Step 1: Screen**

```tsx
// First run: a signed-in user with no ledgers picks what to track. Creates the
// ledger(s) with a sensible default name and lands on the Ledgers tab.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { createProperty } from '@/db/properties';
import type { NewProperty } from '@/types';
import { colors, type, ui } from '@/theme';

const CHOICES: { key: string; title: string; body: string; ledgers: NewProperty[] }[] = [
  {
    key: 'rental',
    title: 'A rental property',
    body: 'Track rent, taxes, repairs and the year-end profit for each property.',
    ledgers: [{ name: 'My first property', property_type: 'rental' }],
  },
  {
    key: 'personal',
    title: 'My own budget',
    body: 'Log income and spending, set up monthly bills, and watch your savings rate.',
    ledgers: [{ name: 'Household', property_type: 'personal' }],
  },
  {
    key: 'both',
    title: 'Both',
    body: 'A property ledger and a household budget, side by side.',
    ledgers: [
      { name: 'My first property', property_type: 'rental' },
      { name: 'Household', property_type: 'personal' },
    ],
  },
];

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (ledgers: NewProperty[]) => {
      for (const l of ledgers) await createProperty(l);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.replace('/(tabs)/properties');
    },
    onError: (e: Error) => Alert.alert('Could not set up', e.message),
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Welcome', headerBackVisible: false }} />
      <Text style={styles.heading}>What do you want to track?</Text>
      <Text style={styles.sub}>You can add more ledgers any time. Names can be changed later.</Text>
      {CHOICES.map((c) => (
        <Pressable
          key={c.key}
          style={styles.choice}
          onPress={() => mutation.mutate(c.ledgers)}
          disabled={mutation.isPending}
          accessibilityRole="button"
        >
          <Text style={styles.choiceTitle}>{c.title}</Text>
          <Text style={styles.choiceBody}>{c.body}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...ui.screen, padding: 20, gap: 12 },
  heading: { ...type.display, marginTop: 12 },
  sub: { ...type.label, marginBottom: 8 },
  choice: { ...ui.card, padding: 16, gap: 4 },
  choiceTitle: { ...type.body, fontSize: 17, fontWeight: '700' },
  choiceBody: { ...type.label, lineHeight: 18 },
});
```

- [ ] **Step 2: Register and redirect**

`app/_layout.tsx`: inside the signed-in group add `<Stack.Screen name="onboarding" options={{ title: 'Welcome', headerBackButtonDisplayMode: 'minimal', gestureEnabled: false }} />`.

`app/(tabs)/index.tsx`: after the properties query resolves with zero rows (including archived - it already queries `includeArchived: true`), redirect once:
```tsx
  const properties = …; // existing query
  useEffect(() => {
    if (properties && properties.length === 0) router.replace('/onboarding');
  }, [properties]);
```
(`router` is already imported there.)

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npm test -- --silent 2>&1 | grep Tests:`
```bash
git add app/onboarding.tsx app/_layout.tsx 'app/(tabs)/index.tsx'
git commit -m "budgets: first-run chooser creates the first ledger(s)"
```

---

## Task 11: Live e2e for a personal ledger, demo data, docs

**Files:**
- Modify: `scripts/e2e-recurring.ts`, `README.md`, `docs/app-store-listing.md`, `WORKLOG.md`

- [ ] **Step 1: e2e**

In `scripts/e2e-recurring.ts` add, after step `a2`, a step `a3. personal ledger rule uses a personal category`:
```ts
    // a3. a personal budget can run the same engine with a personal-scope category.
    const { data: household } = await sb.from('properties')
      .insert({ user_id: userId, name: 'e2e Household', property_type: 'personal' }).select().single();
    const { data: groceries } = await sb.from('categories').select('id')
      .eq('name', 'Groceries').eq('scope', 'personal').single();
    const prule = await createRecurringRule({
      property_id: household!.id, category_id: groceries!.id, kind: 'expense', amount: 450,
      notes: 'e2e', start_month: '2026-01-01', end_mode: 'count', occurrences: 2,
    });
    const pInserted = await syncRule(prule, '2026-09-18');
    check('a3. personal ledger rule posts', pInserted === 2, `inserted ${pInserted} on Household`);
```
(`sb` is the signed-in client the script already creates; adapt the name.) In cleanup, also delete the rule by id, its `notes='e2e'` expenses, and `properties where name='e2e Household' and user_id=<demo>`. Run: `E2E_DEMO_EMAIL=… E2E_DEMO_PASSWORD=… node --env-file=.env --import ./scripts/e2e-recurring.loader.mjs scripts/e2e-recurring.ts` → `ALL PASS`.

- [ ] **Step 2: Demo data for the store screenshot**

With psql as in Task 1, for user `a4575095-3ad1-4d02-9ead-11d6f605274c`: insert one `properties` row `('Household', 'personal')` and ~15 entries for the current and previous month using personal-scope categories (Salary 5200 on the 1st; Groceries 4× ~120; Dining Out 3×; Fuel 2×; Subscriptions 2×; Phone 85; Rent/Mortgage 1850). Verify counts, then note in `docs/app-store-listing.md` that screenshot 7 is the Household dashboard (taken at release time).

- [ ] **Step 3: Docs**

- `README.md`: in "What it does" change the Properties bullet to "**Ledgers** - each one a rental property or a personal budget…"; add a "Personal budgets" paragraph under "Using the app" (first-run chooser, Budget wording, personal categories, This Month preset, savings rate).
- `docs/app-store-listing.md`: add a "1.2 - personal budgets" section with subtitle `Rentals & personal budgets`, the keyword changes from spec §7, and a new first paragraph for the description. Mark it "apply after 1.0 approval".
- `WORKLOG.md`: Phase 16 START/FINISH lines in the existing format, with test counts.

- [ ] **Step 4: Full verification + commit**

Run: `npx tsc --noEmit && npm test 2>&1 | grep -E 'Tests:|Suites:'` - 0 failures; suites = previous + 1 (`ledger-copy`).
```bash
git add scripts/e2e-recurring.ts README.md docs/app-store-listing.md WORKLOG.md
git commit -m "budgets: personal-ledger e2e, demo data note, docs"
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §3 vocabulary, `ledger-copy.ts` API, rule for collection vs per-ledger nouns | 2, 6, 7 |
| §4.1 scope column, 17 → both, 26 personal rows, user category scope, `categoriesForLedger`, chips re-filter and clear | 1, 3, 7, 9 |
| §4.2 no other schema change; address/purchase hidden for personal | 5 |
| §5 onboarding | 10 |
| §5 ledger form kind picker | 5 |
| §5 ledgers tab title + grouped sections + row meta | 6 |
| §5 dashboard month line + savings rate + section title | 4, 6 |
| §5 forms and detail screens labels / party label | 7 |
| §5 reports presets, savings line, default preset | 8 |
| §5 history label + scoped chips | 7 |
| §5 categories screen scope chip + grouping | 9 |
| §6 `savingsRate`, month ranges, dashboard model fields | 4 |
| §7 store listing (post-approval) | 11 (docs only; ASC change is a release step) |
| §8 migration live, rental-only unchanged, demo Household | 1, 11 |
| §9 tests (pure + existing green + e2e) | 2, 3, 4, 6, 11 |

Type consistency check: `LedgerKind` (Task 1) is used by Tasks 2, 3, 7; `categoriesForLedger(categories, ledgerKind, entryKind)` argument order is the same in Tasks 3 and 7; `DashboardModel.monthPL / monthSavingsRate` names match between Tasks 4 and 6; `createCategory(name, kind, scope)` matches Tasks 3, 7, 9; `collectionNoun` is defined in Task 2 and used in 7 and 8.
