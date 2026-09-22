# Work Log

Append-only. Every phase gets a START before code and a FINISH after tests pass.
An orphaned START means that phase was interrupted — resume it before starting anything new.
Never edit or delete an existing entry.

## Phase 0 — Scaffold
- START: 2026-07-15T02:50:27Z — agent: claude — Beginning Phase 0.
- FINISH: 2026-07-15T02:53:52Z — agent: claude — Tests: 1 passed, 0 failed. tsc clean. Files: App.tsx, package.json, tsconfig.json, __tests__/sanity.test.ts, .gitignore, .env.example, WORKLOG.md

## Phase 1 — Supabase Project & Schema
- START: 2026-07-15T02:55:19Z — agent: claude — Beginning Phase 1.
- FINISH: 2026-07-15T03:37:15Z — agent: claude — Tests: 5 passed, 0 failed. tsc clean. Supabase project dxjwyaldmxquuztmnrsb created (us-east-1); schema + seed applied; RLS verified enabled on all 4 tables (policies: properties 1, categories 4, expenses 1, income 1); 36 system categories seeded; .env filled (gitignored). Files: supabase/schema.sql, supabase/seed_categories.sql, src/db/supabase.ts, __tests__/supabase.test.ts, jest.setup.js

## Phase 2 — Auth
- START: 2026-07-15T03:38:36Z — agent: claude — Beginning Phase 2.
- FINISH: 2026-07-15T03:43:11Z — agent: claude — Tests: 17 passed, 0 failed. tsc clean. Live signup E2E verified (session returned, autoconfirm on, throwaway user cleaned up). Files: app/_layout.tsx, app/(auth)/sign-in.tsx, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx, src/lib/auth-validation.ts, src/lib/auth-guard.ts, src/components/session-provider.tsx, __tests__/auth-validation.test.ts, __tests__/auth-guard.test.ts

## Phase 3 — Properties CRUD
- START: 2026-07-15T03:45:03Z — agent: claude — Beginning Phase 3.
- FINISH: 2026-07-15T03:49:12Z — agent: claude — Tests: 30 passed, 0 failed. tsc clean. Live E2E: insert 201, owner list 1 row, archive via UPDATE ok, anon sees 0 rows (RLS enforced), temp user cleaned up. Files: src/types/index.ts, src/lib/property-validation.ts, src/db/properties.ts, src/components/property-form.tsx, app/(tabs)/properties.tsx, app/property/new.tsx, app/property/[id].tsx, app/_layout.tsx, __tests__/property-validation.test.ts, __tests__/properties-db.test.ts

## Phase 4 — Categories
- START: 2026-07-15T03:50:00Z — agent: claude — Beginning Phase 4.
- FINISH: 2026-07-15T03:52:26Z — agent: claude — Tests: 41 passed, 0 failed. tsc clean. Live E2E: 36 system categories visible, custom create/rename/delete ok, system delete blocked by RLS (0 rows affected, row survives). Files: src/lib/categories.ts, src/db/categories.ts, app/categories.tsx, src/types/index.ts, app/_layout.tsx, app/(tabs)/index.tsx, __tests__/categories-lib.test.ts, __tests__/categories-db.test.ts

## Phase 5 — Add Expense
- START: 2026-07-15T03:53:46Z — agent: claude — Beginning Phase 5.
- FINISH: 2026-07-15T03:56:45Z — agent: claude — Tests: 60 passed, 0 failed. tsc clean. Files: src/lib/money.ts, src/lib/dates.ts, src/lib/expense-validation.ts, src/lib/add-transaction-state.ts, src/db/expenses.ts, app/(tabs)/add.tsx, src/types/index.ts, __tests__/money.test.ts, __tests__/expense-validation.test.ts, __tests__/add-transaction-state.test.ts, __tests__/expenses-db.test.ts

## Phase 6 — Add Income
- START: 2026-07-15T03:57:24Z — agent: claude — Beginning Phase 6.
- FINISH: 2026-07-15T03:59:34Z — agent: claude — Tests: 63 passed, 0 failed. tsc clean. Files: src/db/income.ts, src/components/add-transaction-form.tsx (shared expense/income form), app/(tabs)/add.tsx (segmented toggle), src/types/index.ts, __tests__/income-db.test.ts

## Phase 7 — Transaction List & Edit
- START: 2026-07-15T04:00:36Z — agent: claude — Beginning Phase 7.
- FINISH: 2026-07-15T04:06:37Z — agent: claude — Tests: 73 passed, 0 failed. tsc clean. Files: src/lib/timeline.ts, src/lib/confirm-delete.ts, src/db/expenses.ts, src/db/income.ts, app/property/[id]/index.tsx (timeline + filters + swipe-delete), app/property/[id]/edit.tsx (moved), app/transaction/[kind]/[id].tsx, app/_layout.tsx (GestureHandlerRootView), __tests__/timeline.test.ts, __tests__/confirm-delete.test.ts. Note: react-native-gesture-handler installed with --legacy-peer-deps (react-dom peer conflict), @react-native/jest-preset added for jest-expo.

## Phase 8 — P&L Calculations
- START: 2026-07-15T04:07:25Z — agent: claude — Beginning Phase 8.
- FINISH: 2026-07-15T04:09:43Z — agent: claude — Tests: 88 passed, 0 failed. tsc clean. Cents-based math (float-drift test included). Files: src/lib/aggregate.ts, app/(tabs)/reports.tsx, app/(tabs)/_layout.tsx, src/db/expenses.ts (listAllExpenses), src/db/income.ts (listAllIncome), __tests__/aggregate.test.ts

## Phase 9 — History & Trends
- START: 2026-07-15T04:10:41Z — agent: claude — Beginning Phase 9.
- FINISH: 2026-07-15T13:31:10Z — agent: claude — Tests: 97 passed, 0 failed. tsc clean. Files: src/lib/aggregate.ts (calcCategoryTrend), app/history.tsx (chart + period table), app/(tabs)/reports.tsx (link), app/_layout.tsx, __tests__/trend.test.ts. Note: react-native-reanimated + @shopify/react-native-skia installed as victory-native peers.

## Phase 10 — Export
- START: 2026-07-15T13:31:59Z — agent: claude — Beginning Phase 10.
- FINISH: 2026-07-15T13:34:44Z — agent: claude — Tests: 103 passed, 0 failed. tsc clean. Files: src/lib/export.ts, app/export.tsx (share sheet), src/lib/timeline.ts (property_id on entries), app/_layout.tsx, app/(tabs)/index.tsx, __tests__/export.test.ts. Deps: expo-file-system, expo-sharing.

## Phase 11 — Dashboard
- START: 2026-07-15T13:35:34Z — agent: claude — Beginning Phase 11.
- FINISH: 2026-07-15T13:40:44Z — agent: claude — Tests: 109 passed, 0 failed. tsc clean. Files: src/lib/dashboard.ts, src/components/dashboard-view.tsx, app/(tabs)/index.tsx (real dashboard), __tests__/dashboard.test.tsx (model + render tests). Dev dep: test-renderer (RNTL v14 peer).

## Phase 12 — Ship
- START: 2026-07-15T13:41:49Z — agent: claude — Beginning Phase 12.

## Phase 13 — Account Deletion
- START: 2026-09-17T20:58:00Z — agent: claude — Beginning Phase 13. Required by App Store Review Guideline 5.1.1(v): the app offered account creation but no in-app deletion, blocking submission for review.
- FINISH: 2026-09-17T21:49:32Z — agent: claude — Tests: 126 passed, 0 failed (22 suites). tsc clean. Live E2E verified against project dxjwyaldmxquuztmnrsb: throwaway user + property + expense created, edge function returned {"ok":true}, subsequent sign-in rejected ("Invalid login credentials"), 0 rows visible to anon — cascade confirmed. Unauthenticated POST to the function returns 401. Files: src/lib/delete-account.ts, src/db/account.ts, app/delete-account.tsx, supabase/functions/delete-account/index.ts (deployed), app/_layout.tsx (route), app/(tabs)/index.tsx (entry link), tsconfig.json (exclude Deno fn + restore expo base entries), __tests__/delete-account.test.ts, __tests__/account-db.test.ts, __tests__/delete-account-screen.test.tsx. Spec: docs/superpowers/specs/2026-09-17-account-deletion-design.md. Plan: docs/superpowers/plans/2026-09-17-account-deletion.md. Note: manual on-device walkthrough (plan Task 4 Step 9) not yet performed; the feature is covered by unit, mocked, and live end-to-end verification but has not been tapped through in a simulator.

## Phase 15 — Recurring Items
- START: 2026-09-21T04:35:56Z — agent: claude — Beginning Phase 15 (README §4, recurring-only plan docs/superpowers/plans/2026-09-20-recurring-only.md).
- FINISH: 2026-09-21T04:38:37Z — agent: claude — Tests: 170 passed, 0 failed (26 suites; 22 + 4 new: dates-month, recurring, recurring-rule-validation, recurring-db). tsc clean. Live E2E verified against project dxjwyaldmxquuztmnrsb through the real src/db layer (scripts/e2e-recurring.ts, signed in as the demo reviewer with the anon key so RLS + getUser() were exercised): count-3 Mortgage Principal rule from 2026-01 → first sync inserted exactly 3 rows dated 2026-01-01/02-01/03-01, is_edited=false; re-sync inserted 0 (idempotent); February edited to 700 with is_edited=true survived a sync untouched; skipRecurringMonth(2026-03) + row delete → sync did not re-post March (2 rows); deleteRecurringRule left both rows with recurring_id=null (on delete set null); cleanup removed exactly the notes='e2e' rows — 0 remain in expenses/income/recurring_rules (psql cross-check), demo screenshot data untouched. Version bumped to 1.1.0; What's New (1.1) added to docs/app-store-listing.md. Files: supabase/migrations/2026-09-20-recurring.sql, supabase/migrations/2026-09-20-recurring-skips.sql, supabase/schema.sql, src/types/index.ts, src/lib/dates.ts, src/lib/recurring.ts, src/lib/recurring-rule-validation.ts, src/lib/timeline.ts, src/db/recurring.ts, src/db/expenses.ts, src/db/income.ts, src/components/recurring-rule-form.tsx, app/recurring/new.tsx, app/property/[id]/recurring.tsx, app/property/[id]/index.tsx, app/transaction/[kind]/[id].tsx, app/(tabs)/add.tsx, app/(tabs)/_layout.tsx, app/_layout.tsx, __tests__/dates-month.test.ts, __tests__/recurring.test.ts, __tests__/recurring-rule-validation.test.ts, __tests__/recurring-db.test.ts, scripts/e2e-recurring.ts (+ .loader.mjs, .supabase.mjs), app.json, docs/app-store-listing.md. Plan: docs/superpowers/plans/2026-09-20-recurring-only.md. Note: on-device walkthrough deferred to the 1.1 TestFlight build.

## Phase 16 — Personal Budgets
- START: 2026-09-21T19:32:20Z — agent: claude — Beginning Phase 16 (spec docs/superpowers/specs/2026-09-21-personal-budgets-design.md; a ledger is a rental property or a personal budget, same engine, different words and categories).
- FINISH: 2026-09-21T23:58:15Z — agent: claude — Tests: 202 passed, 0 failed (27 suites; 26 + 1 new: ledger-copy). tsc clean. Live migration applied to project dxjwyaldmxquuztmnrsb: categories.scope ('rental'|'personal'|'both', default 'rental'), 17 shared system rows → 'both', 26 personal system rows seeded; rental-only accounts see identical screens (spec §8.2). Live E2E extended (scripts/e2e-recurring.ts step a3): a personal ledger 'e2e Household' + count-2 Groceries (scope=personal) rule → sync posted exactly 2 rows on it; cleanup removed the rule, its notes='e2e' expenses and the ledger — 0 remain (ALL PASS, 10 checks). Demo account seeded with a 'Household' personal ledger: 20 expenses + 2 Salary income across 2026-08/2026-09 (psql; other three ledgers untouched: 26 expenses / 30 income before and after). Files: supabase/migrations/2026-09-22-category-scope.sql, supabase/schema.sql, supabase/seed_categories.sql, src/types/index.ts, src/lib/ledger-copy.ts, src/lib/categories.ts, src/lib/aggregate.ts, src/lib/dashboard.ts, src/lib/add-transaction-state.ts, src/db/categories.ts, src/components/property-form.tsx, src/components/add-transaction-form.tsx, src/components/recurring-rule-form.tsx, src/components/dashboard-view.tsx, app/onboarding.tsx, app/_layout.tsx, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx, app/(tabs)/properties.tsx, app/(tabs)/reports.tsx, app/categories.tsx, app/history.tsx, app/property/new.tsx, app/property/[id]/edit.tsx, app/property/[id]/index.tsx, app/property/[id]/recurring.tsx, app/recurring/[id].tsx, app/transaction/[kind]/[id].tsx, __tests__/ledger-copy.test.ts (+ updated categories-lib, categories-db, aggregate, dashboard, export, add-transaction-state tests), scripts/e2e-recurring.ts, README.md, docs/app-store-listing.md (1.2 section: subtitle "Rentals & personal budgets", keywords, description opening, What's New, screenshot 7 = Household dashboard — apply only after 1.0 approval). Note: on-device walkthrough of the onboarding chooser deferred to the next TestFlight build.
- RULINGS (controller decisions during Phase 16, in order): (1) rental-only wording constraint beats plan placeholder text - recurring forms keep "e.g. KeyBank"; (2) edit-rule clear-category effect runs only after properties+categories load (plan pattern raced and wiped a valid category); (3) Reports "Saved" row removed, savings-rate line kept; (4) onboarding: refetchType 'all' + !isFetching guard + skip-if-name-exists, fixing a redirect loop that duplicated ledgers; (5) pre-existing user categories re-scoped to 'both' via live SQL; (6) kind switch hides address/purchase instead of nulling; (7) store keywords drop "real estate" to fit 100 chars - confirm at release; (8) edit-ledger button "Save Property/Budget" accepted over "Save Changes". Deferred to 1.2.x: Categories screen shows the Personal group to rental-only users; tab title flashes "Ledgers" before load; unused splitCategoriesByKind; period fields typed on a rental then hidden by switching ledger are saved unvalidated; extra tests for lastMonthRange day-clamp and savingsRate float drift.
