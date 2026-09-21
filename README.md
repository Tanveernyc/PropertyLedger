# PropertyLedger

Income and expense tracking for rental properties, with month-by-month recurring bills and a year-end profit-and-loss per property. iOS app built with Expo; data lives in Supabase under row-level security.

App Store: **PropertyLedger: Rental P&L** (bundle `com.trueorganichub.propertyledger`). Version 1.1.0 in progress; see `WORKLOG.md` for the build log.

## What it does

- **Ledgers** - each one a rental property or a personal budget. Rentals carry optional address and purchase details; budgets are just a name. Both are archivable, and a mixed account sees them grouped as *Properties* and *Budgets*.
- **Entries** - expenses and income, each with a category, date, optional vendor/source, notes, and (expenses) the period a bill covers.
- **Recurring rules** - a template that posts one entry on the 1st of every month from a start month until stopped or for N months. Backfills past months on creation, catches up on every launch, never duplicates, and never overwrites a month you edited or deleted. Rules are fully editable; optionally rewrite already-posted months from a chosen month.
- **Reports** - portfolio and per-property P&L for this year / last year / all time / custom range; expenses by category.
- **History** - one category over time, by month or year, with change and % change.
- **Export** - spreadsheet-ready CSV of every entry via the share sheet.
- **Account** - email/password sign-in, in-app account deletion (App Store 5.1.1(v)).

Money is `numeric(12,2)` in Postgres and integer-cent math in the app. Dates are ISO `YYYY-MM-DD` strings end to end.

## Using the app

**First run.** Sign up with an email and password. The app asks *What do you want to track?* - *A rental property*, *My own budget*, or *Both* - and creates the first ledger(s) for you ("My first property" / "Household"). Add more later from the ledgers tab (titled **Properties**, **Budgets**, or **Ledgers** depending on what you have) → **+ Add**: pick *Rental property* or *Personal budget*, name it, save.

**Personal budgets.** A budget is a ledger with `property_type = 'personal'`; everything else (entries, recurring rules, reports, export) is the same engine. What changes is the wording and the category list: a budget is called a *Budget*, its counterparties are *Payee*/*Source* instead of *Vendor*/*Source*, and its category picker shows the personal set (Salary, Groceries, Dining Out, Fuel, Subscriptions, Phone, Rent/Mortgage, …) plus shared ones like Insurance and Repairs; rental ledgers keep the landlord set. New categories you create take the scope of the ledger you are in. The dashboard and **Reports** add a *This Month* / *Last Month* preset and a **savings rate** line (income minus expenses, as a share of income) for budgets. An account with only rental properties sees exactly the screens and words it did before.

**Log a one-off entry.** **Add** tab → choose *Expense* or *Income* → tap the property → tap a category (tap **+ New** to create one on the spot) → amount → date defaults to today → optional vendor/source, covers-period, notes → **Save**. The form keeps the property and category selected so the next entry is amount + save.

**Set up a monthly bill or rent.** On the **Add** tab tap *Repeats every month? Set up a recurring…*, or from a property tap **Recurring → + Expense rule / + Income rule**. Pick property, category, monthly amount, vendor/source, the **start month**, and whether it runs *until I stop it* or *for N months*. Save: every month from the start month through today is posted at once (the form shows how many), and each new month posts automatically when the app opens. Recurring entries show a ↻ mark.

**Change a recurring bill.** Property → **Recurring → Edit**. Change anything - amount, vendor, category, start month, end. By default only future months change. Turn on **Also update months already posted** and pick a from-month to rewrite past entries too; months you edited by hand are left alone. **Stop** ends the rule and keeps history; **Delete** removes the rule and keeps its entries.

**Fix or remove one month.** Tap the entry → edit and save (the rule will never overwrite it). To delete, open the property and swipe the row left → **Delete**; a deleted recurring month is not re-posted.

**Read the ledger.** Tap a property: filter by category chips or a date range, and tap the sort chip to switch *Oldest first* (Jan → Dec), *Newest first*, or *Largest first*.

**Reports.** *This Year / Last Year / All Time / Custom* → portfolio net, per-property net, expenses by category. **History & trends** charts one category over time to spot rising costs.

**Export.** Dashboard → **Export** → share a CSV of every entry (Files, Mail, accountant).

**Account.** Dashboard footer: Categories, Export, Support (email), Sign out, Delete account (removes everything, immediately).

## Stack

Expo SDK 57 · expo-router · React Native 0.86 · TypeScript · @tanstack/react-query · @supabase/supabase-js · date-fns · victory-native (charts) · Jest + jest-expo.

## Layout

```
app/                 expo-router screens
  (auth)/sign-in     (tabs)/{index,properties,add,reports}
  property/[id]/     ledger, edit, recurring rules
  recurring/         new rule (modal), edit rule (modal)
  transaction/       edit one entry
  history, export, categories, delete-account
src/
  types/             shared row types, mirror supabase/schema.sql
  lib/               pure functions - no React, no network (money, dates, validation,
                     timeline, aggregate, recurring engine, dashboard model, export)
  db/                Supabase access; every insert stamps user_id (RLS WITH CHECK)
  components/        forms and the dashboard view
  theme.ts           colour, type scale, shared styles - the only place hex values live
supabase/
  schema.sql         canonical schema (run once on a new project)
  seed_categories.sql
  migrations/        additive migrations applied to the live project, in order
  functions/delete-account
scripts/             live e2e smoke test for recurring rules (see below)
__tests__/           Jest; pure logic and mocked DB payloads
docs/                App Store listing notes, privacy/support pages (GitHub Pages),
                     superpowers/{specs,plans} for design docs
```

## Recurring rules - exact behaviour

Implemented in `src/lib/recurring.ts` (pure) and `src/db/recurring.ts` (network).

- A rule has property, category, kind, amount, vendor/source, notes, `start_month`, and an end mode: `until_stopped` or `count` with `occurrences`.
- `generateDueEntries(rule, existingDates, today)` returns one entry per month from `start_month` through the current month, skipping any month that already has an entry for that rule (any day in the month counts) and any month in `rule.skipped_months`. Never future months, never past `stopped_on`, never beyond `occurrences`.
- Generation runs on app launch (tabs layout) and right after a rule is created or edited. One failing rule is logged and skipped so the rest still post.
- Editing a generated entry sets `is_edited = true`; the generator never touches existing rows. Deleting a generated entry records its month in `skipped_months` so it is not re-posted. Moving an entry to another month does the same for the vacated month.
- Changing a rule affects future months only, unless "Also update months already posted" is on - then posted, un-edited entries from the chosen month onward are rewritten (`applyRuleToPostedEntries`).
- Stopping sets `stopped_on` and `is_active = false`; history stays. Deleting a rule leaves its entries with `recurring_id = null`.

## Development

```bash
npm install
cp .env.example .env      # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (anon key only)
npm test                  # Jest
npx tsc --noEmit          # typecheck
npx expo start            # dev server (needs a dev client; see below)
```

Both `npm test` and `npx tsc --noEmit` must be clean before any commit.

### Simulator builds

SDK 57 needs Xcode 26 to build locally. On older Xcode, use an EAS simulator build:

```bash
npx eas-cli@latest build -p ios --profile preview-sim
```

and install the resulting `.app` with `xcrun simctl install booted <path>`. Maestro (`~/.maestro/bin`) drives the simulator for screenshots; `cliclick` cannot focus React Native text inputs.

### Live e2e for recurring rules

Exercises the real `src/db` layer against the live project as a signed-in user (RLS, user_id stamping, idempotency, edited/skipped months, rule edits). Cleans up after itself.

```bash
E2E_DEMO_EMAIL=… E2E_DEMO_PASSWORD=… node --env-file=.env --import ./scripts/e2e-recurring.loader.mjs scripts/e2e-recurring.ts
```

Credentials come from the environment. Never commit them.

### Database changes

Migrations are additive only and live in `supabase/migrations/`. Apply with psql (`SUPABASE_DB_PASSWORD` in `.env`) and mirror the DDL into `supabase/schema.sql` so a fresh project can be created from it alone. RLS is enabled on every table.

## Release

```bash
npx eas-cli@latest build -p ios --profile production --auto-submit   # build + upload to App Store Connect
```

Internal TestFlight testers receive each build automatically. App Store metadata, screenshots and review info are managed through the ASC API (see `docs/app-store-listing.md` for the copy). `docs/` is published with GitHub Pages for the privacy and support URLs; `docs/_config.yml` excludes internal docs from that build.

## Docs

- `docs/app-store-listing.md` - store copy, keywords, privacy answers, What's New.
- `docs/superpowers/specs/` - design specs (account deletion, personal budgets).
- `docs/superpowers/plans/` - implementation plans.
- `WORKLOG.md` - per-phase start/finish log with test counts.
