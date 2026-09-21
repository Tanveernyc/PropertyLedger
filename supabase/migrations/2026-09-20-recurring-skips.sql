-- Months the user deleted from a rule; the generator treats them as already present.
alter table recurring_rules
  add column if not exists skipped_months date[] not null default '{}';
