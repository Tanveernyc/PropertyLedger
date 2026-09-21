# App Store Listing — PropertyLedger: Rental P&L

ASC App ID `6813181506` · Bundle `com.trueorganichub.propertyledger` · v1.0.0 build 16

Everything below is copy-paste ready for App Store Connect. Claims were checked
against the actual implementation — nothing here describes a feature the app
doesn't have.

---

## Name & Subtitle

**App Name** (30 max, 26 used)
```
PropertyLedger: Rental P&L
```

**Subtitle** (30 max, 30 used)
```
Track rental income & expenses
```

---

## Promotional Text (170 max — editable without a new build)

```
Every property, every dollar, in one place. Log income and expenses in seconds, see profit and loss per property, and export a clean CSV when tax season arrives.
```

---

## Description

```
PropertyLedger keeps the books for your rental properties. Income in, expenses
out, and a profit-and-loss picture you can actually read — without a
spreadsheet and without a subscription to accounting software built for
something else.

EVERY PROPERTY, TRACKED SEPARATELY
Add as many properties as you own. Each one keeps its own income, expenses, and
running profit, so you always know which unit earns and which one drains. Sold a
property? Archive it — the records stay intact for your return.

LOG A TRANSACTION IN SECONDS
Amount, date, category, property. That's the whole flow. Add a vendor or a note
when it matters, skip them when it doesn't. Expenses and income use the same
fast form.

CATEGORIES THAT MATCH YOUR RETURN
36 built-in categories covering the expense and income lines landlords actually
file — mortgage interest, repairs, insurance, property tax, management fees,
rent, deposits, and more. Add your own when your books need something specific.

BILLS THAT SPAN A PERIOD
A school tax bill paid in September can cover the following year. PropertyLedger
records when money moved and, optionally, the period the bill covers — so your
numbers land in the right year.

PROFIT AND LOSS AT A GLANCE
A dashboard for the whole portfolio and a P&L for each property. Income,
expenses, and net, calculated in exact cents — no floating-point drift, no
rounding surprises.

SEE HOW SPENDING MOVES
Chart any category over time and compare periods, so a creeping repair bill or a
rising insurance premium shows up before it's a year-end surprise.

EXPORT FOR YOUR ACCOUNTANT
Send a clean CSV straight from the share sheet — email it, drop it in Files, or
hand it to whoever does your taxes.

YOUR DATA STAYS YOURS
Your account is yours alone. Every record is protected at the database level by
row-level security, so no other user can read your books. No ads, no analytics,
no trackers, and nothing sold to anyone.

PropertyLedger is for landlords with one property or twenty who want their
numbers straight and their tax prep boring.
```

---

## What's New (1.1)

```
Recurring income and expenses. Set up a rent payment or a monthly bill once — PropertyLedger posts it on the 1st of every month, backfills from the start month you choose, and lets you edit or delete any single month without touching the rest. Stop a rule any time; your history stays.
```

---

## Keywords (100 max, 97 used)

```
landlord,expense,income,tax,schedule e,deduction,real estate,tracker,bookkeeping,profit,cash flow
```

Deliberately omits `rental`, `property`, and `ledger` — Apple already indexes
those from the name and subtitle, so repeating them wastes the field.

---

## 1.2 - personal budgets (apply after 1.0 approval)

Do not touch App Store Connect metadata until version 1.0 is approved — editing
name/subtitle/keywords on a version under review restarts the review. Once 1.0
is live, apply the following with the 1.2 build (spec
`docs/superpowers/specs/2026-09-21-personal-budgets-design.md` §7). App Name and
Bundle ID are unchanged.

**Subtitle** (30 max, 26 used) — replaces `Track rental income & expenses`
```
Rentals & personal budgets
```

**Keywords** (100 max, 98 used) — adds `budget,savings,spending,household`;
drops `schedule e,deduction` per the spec and `real estate` to fit the limit
(Apple already indexes "rental"/"property" from the name and subtitle).
```
landlord,expense,income,tax,tracker,bookkeeping,profit,cash flow,budget,savings,spending,household
```

**Description** — new first paragraph, replacing the current opening paragraph;
the rest of the description stays as is.
```
PropertyLedger keeps the books for your rental properties — and, if you like,
for your own household too. Each ledger is either a rental property or a
personal budget: rentals get income, expenses, and a profit-and-loss picture
you can actually read; budgets get the same fast entry, monthly totals, and a
savings rate. No spreadsheet, no subscription to accounting software built for
something else.
```

**What's New (1.2)**
```
Personal budgets. Alongside your rental properties you can now keep a household budget — same quick entry, recurring bills, and reports, with a This Month view and your savings rate. Categories are tailored to each ledger: landlord categories for rentals, everyday ones for budgets.
```

**Screenshots** — add one shot as screenshot 7: the **Household** budget
dashboard from the demo account (`demo.reviewer@…`), which is seeded with a
personal ledger named "Household" (salary, groceries, dining out, fuel,
subscriptions, phone, rent across the current and previous month). Take it at
release time so the month totals match the release month.

---

## URLs

| Field | Value |
|---|---|
| Privacy Policy URL (required) | `https://tanveernyc.github.io/PropertyLedger/privacy.html` |
| Support URL (required) | needs a real page — see Open Items |
| Marketing URL (optional) | leave blank |

---

## App Privacy — nutrition label answers

Verified against `supabase/schema.sql`, `app/(auth)/sign-in.tsx`, and the full
dependency list. There are **no analytics, advertising, or crash-reporting SDKs**
in the project.

**"Do you or your third-party partners collect data from this app?" → Yes**

For every row below: purpose is **App Functionality** only, data **is** linked to
the user's identity, and data is **not** used for tracking.

| Category | Data Type | Why it applies |
|---|---|---|
| Contact Info | Email Address | Supabase Auth sign-up / sign-in |
| Contact Info | Physical Address | `properties.address` — optional property address |
| Financial Info | Other Financial Info | `expenses.amount`, `income.amount`, `properties.purchase_price` |
| User Content | Other User Content | property names, notes, vendor, source fields |
| Identifiers | User ID | `user_id` on every row (Supabase auth UUID) |

**Explicitly NOT collected** — answer No to all: Location (the app never reads
device location; a typed address is Contact Info, not Location), Health &
Fitness, Payment Info (no card data — the app records amounts, it doesn't
process payments), Contacts, Browsing History, Search History, Purchases,
Usage Data, Diagnostics, Sensitive Info, Other Data.

**Tracking question → No.** Nothing is shared with data brokers or ad networks,
and there is no ATT prompt because there is nothing to track.

---

## Other App Store Connect fields

- **Age Rating:** 4+ — no objectionable content of any kind
- **Category:** Primary `Finance`, Secondary `Business`
- **Copyright:** `2026 True Organic Hub LLC`
- **Mac availability:** UNCHECK "available on Mac with Apple silicon" — this is
  what produced warning ITMS-90863 on the build 16 delivery
- **Sign-in required for review:** yes — Apple needs a demo account (see Open Items)

---

## Open Items — these block "Submit for Review"

1. **In-app account deletion is missing.** Guideline 5.1.1(v) requires any app
   offering account creation to let users start account deletion from inside the
   app. `app/(tabs)/index.tsx:54` has Sign out only; there is no delete path
   anywhere in `app/`. This is a frequent, near-automatic rejection. Needs a
   "Delete account" action plus a Supabase-side delete (the schema already
   cascades: `on delete cascade` from `auth.users` clears properties, categories,
   expenses, and income).

2. **Demo account for App Review.** Reviewers hit the sign-in wall immediately.
   Create a throwaway account seeded with two properties and a handful of
   transactions, then put the credentials in App Review Information. An empty
   account gets rejected as "incomplete."

3. **Screenshots.** `app.json` sets `ios.supportsTablet: true`, so Apple requires
   **iPad screenshots in addition to iPhone**. Either produce both sets, or set
   `supportsTablet: false` and rebuild to drop the requirement. iPhone 6.9" is
   mandatory; iPad 13" is mandatory while tablet support is on.

4. **Support URL.** A privacy policy alone won't satisfy this. Simplest fix: add
   a `docs/support.html` page next to the privacy page — same GitHub Pages site,
   already live — with a contact email.
