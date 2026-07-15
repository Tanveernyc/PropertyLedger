// Export builders — pure functions, no React, no network (spec §4 rule).
// Phase 10: the escape hatch. JSON of every table + CSV of transactions so the
// free tier can never hold the data hostage (spec §5 Phase 10).
import type { Category, Expense, Income, Property } from '@/types';
import { buildTimeline } from './timeline';

export interface ExportTables {
  properties: Property[];
  categories: Category[];
  expenses: Expense[];
  income: Income[];
}

export interface ExportBundle extends ExportTables {
  /** Format marker + timestamp so a future import knows what it is reading. */
  format: 'propertyledger-export';
  version: 1;
  exported_at: string;
}

/** Full-database JSON export; empty tables stay as valid empty arrays. */
export function buildExportJson(tables: ExportTables, exportedAt: string): ExportBundle {
  return {
    format: 'propertyledger-export',
    version: 1,
    exported_at: exportedAt,
    properties: tables.properties,
    categories: tables.categories,
    expenses: tables.expenses,
    income: tables.income,
  };
}

/**
 * RFC 4180 CSV escaping: a field containing a comma, double quote, or newline
 * is wrapped in quotes, with inner quotes doubled (spec §5 Phase 10 test).
 */
export function csvEscape(field: string | number | null): string {
  if (field === null || field === undefined) return '';
  const text = String(field);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const TRANSACTIONS_CSV_HEADER =
  'type,date,amount,property,category,party,period_start,period_end,notes';

/**
 * One CSV of all transactions (expenses + income interleaved, newest first).
 * Property/category ids are resolved to names for spreadsheet readability.
 */
export function buildTransactionsCsv(tables: ExportTables): string {
  const propertyName = new Map(tables.properties.map((p) => [p.id, p.name]));
  const categoryName = new Map(tables.categories.map((c) => [c.id, c.name]));
  const expenseById = new Map(tables.expenses.map((e) => [e.id, e]));

  const rows = buildTimeline(tables.expenses, tables.income).map((entry) => {
    const expense = entry.kind === 'expense' ? expenseById.get(entry.id) : undefined;
    return [
      entry.kind,
      entry.date,
      entry.amount.toFixed(2),
      csvEscape(propertyName.get(entry.property_id) ?? ''),
      csvEscape(categoryName.get(entry.category_id) ?? ''),
      csvEscape(entry.party),
      expense?.period_start ?? '',
      expense?.period_end ?? '',
      csvEscape(entry.notes),
    ].join(',');
  });

  return [TRANSACTIONS_CSV_HEADER, ...rows].join('\n');
}
