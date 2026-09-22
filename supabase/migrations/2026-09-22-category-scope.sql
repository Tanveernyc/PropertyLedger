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

-- User-created categories predate scopes; make them visible to every ledger kind.
update categories set scope = 'both' where is_system = false and scope = 'rental';
