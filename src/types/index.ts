// Shared domain types — mirror the Postgres schema in supabase/schema.sql.
// Dates are ISO strings (YYYY-MM-DD); money is a number in dollars backed by numeric(12,2).

export type PropertyType = 'rental' | 'personal';

/** A row in the properties table. */
export interface Property {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  property_type: PropertyType;
  purchase_date: string | null;
  purchase_price: number | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
}

/** Which ledger a category belongs to. */
export type CategoryKind = 'expense' | 'income';

/** A row in the categories table. System rows (user_id null) are seeded and undeletable. */
export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  kind: CategoryKind;
  is_system: boolean;
  created_at: string;
}

/** A row in the expenses table. */
export interface Expense {
  id: string;
  user_id: string;
  property_id: string;
  category_id: string;
  amount: number;
  paid_on: string;
  period_start: string | null;
  period_end: string | null;
  vendor: string | null;
  notes: string | null;
  created_at: string;
}

/** Client-supplied fields when creating an expense. */
export interface NewExpense {
  property_id: string;
  category_id: string;
  amount: number;
  paid_on: string;
  period_start?: string | null;
  period_end?: string | null;
  vendor?: string | null;
  notes?: string | null;
}

/** A row in the income table. */
export interface Income {
  id: string;
  user_id: string;
  property_id: string;
  category_id: string;
  amount: number;
  received_on: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

/** Client-supplied fields when creating an income entry. */
export interface NewIncome {
  property_id: string;
  category_id: string;
  amount: number;
  received_on: string;
  source?: string | null;
  notes?: string | null;
}

/** Client-supplied fields when creating a property (id/user_id/created_at are server-side). */
export interface NewProperty {
  name: string;
  property_type: PropertyType;
  address?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  notes?: string | null;
}
