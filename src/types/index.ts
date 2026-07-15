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

/** Client-supplied fields when creating a property (id/user_id/created_at are server-side). */
export interface NewProperty {
  name: string;
  property_type: PropertyType;
  address?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  notes?: string | null;
}
