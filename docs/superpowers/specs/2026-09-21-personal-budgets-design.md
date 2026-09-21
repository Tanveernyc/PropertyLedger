# Personal budgets in PropertyLedger — design

**Date:** 2026-09-21
**Status:** draft for review
**Decisions taken in brainstorming:** one table with a kind per ledger; savings rate as the personal metric; keep the PropertyLedger name and widen the subtitle.

## 1. Goal

Let one person use the app for both a rental portfolio and their own household money. A landlord loses nothing; a non-landlord never sees the word "property". Everything that already works (one-off entries, recurring rules, editing, history, CSV export) works identically for a personal budget.

## 2. What exists today

- `properties.property_type` is already `'rental' | 'personal'` (check constraint in `supabase/schema.sql`). The form offers both. Nothing else in the app reads it except the list row's meta line.
- Categories are 36 global system rows (`is_system = true`, `user_id null`), all landlord vocabulary, shown to every ledger.
- Every screen says Property / Properties; Reports and Dashboard are year-first.
- Money math (`src/lib/aggregate.ts`, `src/lib/dashboard.ts`) is ledger-agnostic already.

## 3. Vocabulary

A row in `properties` is a **ledger**. Its `property_type` is its **kind**:

| kind | user-facing noun | plural | example |
|---|---|---|---|
| `rental` | Property | Properties | Maple Street Duplex |
| `personal` | Budget | Budgets | Household, Car, Kids |

One pure module owns every word that changes: `src/lib/ledger-copy.ts`

```ts
export type LedgerKind = 'rental' | 'personal';
export function nounFor(kind: LedgerKind): { one: string; many: string } // Property/Properties, Budget/Budgets
export function partyLabel(kind: LedgerKind, entryKind: 'expense' | 'income'): string // Vendor/Source for rental; Payee/Source for personal
export function collectionTitle(kinds: LedgerKind[]): string // 'Properties' | 'Budgets' | 'Ledgers' (mixed) | 'Ledgers' (none yet)
```

Rule: the tab label, dashboard section title and empty-state copy use `collectionTitle` over the user's active ledgers; every screen scoped to one ledger uses that ledger's own kind. The DB, routes (`/property/[id]`), query keys and type names are **not** renamed — this spec changes what the user reads, not the code's nouns.

## 4. Data model (additive only)

### 4.1 Category scope

```sql
alter table categories
  add column if not exists scope text not null default 'rental'
  check (scope in ('rental', 'personal', 'both'));
```

- Existing 36 system rows: `'rental'`, except these become `'both'`: Insurance, Water, Sewer, Garbage, Electric, Gas/Heating, Internet/Cable, HOA Fees, Repairs, Maintenance, Cleaning, Supplies, Appliances, Legal/Professional Fees, Bank/Loan Fees, Other Expense, Other Income.
- New personal system rows (`is_system = true`, `scope = 'personal'`):
  - expense: Groceries, Dining Out, Rent/Mortgage, Car Payment, Car Insurance, Fuel, Public Transit, Phone, Health/Medical, Childcare, Education, Subscriptions, Clothing, Personal Care, Entertainment, Gifts, Travel, Charity, Debt Payment, Savings Transfer
  - income: Salary, Bonus, Freelance, Interest/Dividends, Refund, Gift Received
- User-created categories take the scope of the ledger they were created from (Add form) or the kind chosen on the Categories screen; default `'both'` when created without context.
- Pure selector: `categoriesForLedger(categories, ledgerKind, entryKind)` in `src/lib/categories.ts` returns `scope in (ledgerKind, 'both')`, then the existing recent-first ordering applies.
- The category chips on Add / Recurring / History / Property ledger filter use this selector with the **selected ledger's** kind. Changing the selected ledger re-filters; a selected category that no longer applies is cleared.

### 4.2 No other schema change

`properties.address`, `purchase_date`, `purchase_price` stay; they are simply hidden in the form when kind is `personal`. Entries, recurring rules, `party` — unchanged.

## 5. Screens

| Screen | Change |
|---|---|
| **Onboarding** (new, `app/onboarding.tsx`) | Shown once when a signed-in user has zero ledgers: "What do you want to track?" → *A rental property* / *My own budget* / *Both*. Creates the first ledger(s) with a default name ("My first property" / "Household") and routes to it. Replaces today's empty Properties tab as the first thing a new user sees. |
| **Ledger form** (`property-form.tsx`) | Kind picker first ("Rental property" / "Personal budget"). For personal: only Name and Notes; address/purchase fields hidden. Existing rows editable as before. |
| **Ledgers tab** (`(tabs)/properties.tsx`) | Title from `collectionTitle`. When kinds are mixed, two sections with headers "Properties" and "Budgets". Row meta shows "personal" → "budget". |
| **Dashboard** | Hero card gains a second line for the current month: "This month: +$1,240 · saved 18%" (savings rate = net ÷ income; omitted when income is 0). Section title from `collectionTitle`. Per-ledger cards unchanged. |
| **Ledger detail / recurring / add / edit forms** | Labels: "Property *" → `nounFor(kind).one`; Vendor → `partyLabel`. No layout change. |
| **Reports** | Presets gain **This month** and **Last month** (before This Year). A "Savings" line (rate) appears under Net for personal ledgers and for the portfolio when at least one personal ledger exists. Default preset: `this-month` when all active ledgers are personal, else `this-year`. |
| **History** | Label "Property" → `collectionTitle`-aware singular. |
| **Categories screen** | Add row gains a scope chip (Rental / Personal / Both). List grouped by scope. |
| **Sign-in** | Subtitle "Sign in to your ledger" stays. |

Wording change is mechanical: every literal in the table in §3 goes through `ledger-copy.ts`; no screen keeps a hard-coded "Property".

## 6. Math

Add to `src/lib/aggregate.ts` (pure, tested):

```ts
export function savingsRate(pl: PL): number | null   // net / income, null when income <= 0
export function thisMonthRange(todayIso: string): DateRange
export function lastMonthRange(todayIso: string): DateRange
```

`buildDashboardModel` returns an extra `monthPL: PL` and `monthSavingsRate: number | null`.

## 7. Store listing (after 1.0 approval)

- Subtitle: `Rentals & personal budgets` (26 chars).
- Keywords: add `budget,savings,spending,household`; drop `schedule e,deduction` if over 100.
- Description: new first paragraph positioning both uses; screenshots add one "Household budget" dashboard shot.
- Name unchanged. Bundle ID unchanged.

## 8. Migration & rollout

1. Additive migration (scope column + personal seed rows) applied live with the existing psql pattern; verified by row counts.
2. App ships behind nothing — existing landlords see the same screens with the same words because all their ledgers are `rental`.
3. Demo account gets a "Household" budget with ~15 entries for the new screenshot.

## 9. Testing

- Pure: `ledger-copy` (every kind combination), `categoriesForLedger` (scope filter + recent ordering), `savingsRate` (null on zero/negative income, rounding), month ranges (year boundary), `buildDashboardModel` month fields.
- Existing suites must stay green untouched (no behaviour change for rental-only data).
- Live: extend `scripts/e2e-recurring.ts` with a personal-ledger rule to prove categories/recurring are kind-agnostic.

## 10. Out of scope (deliberately)

Spending targets per category, multi-currency, shared budgets between users, moving entries between ledgers, renaming the app.
