-- Vendor (expense) / source (income) template on a recurring rule; copied onto
-- each generated entry. Additive: existing rules keep null.
alter table recurring_rules
  add column if not exists party text;
