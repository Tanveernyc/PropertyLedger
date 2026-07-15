// Category list helpers — pure functions, no React, no network (spec §4 rule).
// Phase 4 tests: expense/income lists filter by kind correctly.
import type { Category, CategoryKind } from '@/types';

/** Only categories of the given kind (expense pickers must never show income rows). */
export function filterCategoriesByKind(categories: Category[], kind: CategoryKind): Category[] {
  return categories.filter((category) => category.kind === kind);
}

/** Splits one fetched list into the two sections the categories screen renders. */
export function splitCategoriesByKind(
  categories: Category[]
): Record<CategoryKind, Category[]> {
  return {
    expense: filterCategoriesByKind(categories, 'expense'),
    income: filterCategoriesByKind(categories, 'income'),
  };
}

/** System categories are seeded data shared by design — they can never be deleted. */
export function canDeleteCategory(category: Category): boolean {
  return !category.is_system;
}
