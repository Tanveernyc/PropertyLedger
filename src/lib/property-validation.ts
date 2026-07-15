// Property form validation — pure functions, no React, no network (spec §4 rule).
// Phase 3 tests: name required; property_type must be rental|personal.
import type { PropertyType } from '@/types';

export const PROPERTY_TYPES: readonly PropertyType[] = ['rental', 'personal'] as const;

/** Type guard used by validation and by screens rendering the type picker. */
export function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

export interface PropertyValidation {
  valid: boolean;
  errors: { name?: string; property_type?: string };
}

/** Validates the create/edit form. Only name and type have hard rules (schema checks). */
export function validateProperty(input: { name: string; property_type: string }): PropertyValidation {
  const errors: PropertyValidation['errors'] = {};
  if (input.name.trim().length === 0) errors.name = 'Name is required.';
  if (!isPropertyType(input.property_type)) {
    errors.property_type = 'Type must be rental or personal.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Parses the purchase-price text field: '' → null (price is optional),
 * otherwise must be a positive number. Returns undefined on invalid input.
 */
export function parsePriceInput(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}
