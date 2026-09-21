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
