-- PropertyLedger schema — spec §3. Run once in the Supabase SQL Editor (Phase 1).
-- Money columns are numeric(12,2), never float (float sums drift). RLS on every table.

-- PROPERTIES
create table properties (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  address       text,
  property_type text not null check (property_type in ('rental','personal')),
  purchase_date date,
  purchase_price numeric(12,2),
  notes         text,
  is_archived   boolean not null default false,  -- archive instead of delete: sell a property, keep the records
  created_at    timestamptz not null default now()
);

-- EXPENSE CATEGORIES (seeded system defaults + user-created; see seed_categories.sql)
create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade, -- null = system default
  name       text not null,
  kind       text not null check (kind in ('expense','income')),
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

-- EXPENSES
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  property_id  uuid not null references properties(id) on delete cascade,
  category_id  uuid not null references categories(id),
  amount       numeric(12,2) not null check (amount > 0),
  paid_on      date not null,  -- when money left the account
  period_start date,           -- optional: what span this bill covers (e.g. 2026 school tax paid Sep 2025)
  period_end   date,
  vendor       text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- INCOME
create table income (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  category_id uuid not null references categories(id),
  amount      numeric(12,2) not null check (amount > 0),
  received_on date not null,
  source      text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Indexes for the P&L / history queries (filter by user + property/category + date)
create index on expenses (user_id, property_id, paid_on);
create index on expenses (user_id, category_id, paid_on);
create index on income   (user_id, property_id, received_on);

-- ROW LEVEL SECURITY — every table, every operation.
-- Without RLS, anyone holding the anon key can read all rows via the Data API.
alter table properties enable row level security;
alter table categories enable row level security;
alter table expenses   enable row level security;
alter table income     enable row level security;

create policy "own properties" on properties for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Categories: users see system defaults + their own; can only mutate their own.
create policy "own or system categories" on categories for select
  using (auth.uid() = user_id or is_system = true);
create policy "insert own categories" on categories for insert
  with check (auth.uid() = user_id);
create policy "update own categories" on categories for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own categories" on categories for delete
  using (auth.uid() = user_id);

create policy "own expenses" on expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own income" on income for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RECURRING RULES (Phase 15)

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

-- Months the user deleted from a rule; the generator treats them as already present.
alter table recurring_rules
  add column if not exists skipped_months date[] not null default '{}';
