// User-facing nouns that depend on ledger kind (spec §3). Pure; the only place
// "Property" vs "Budget" is decided, so no screen hard-codes either word.
import type { CategoryKind, LedgerKind, Property } from '@/types';

const NOUNS: Record<LedgerKind, { one: string; many: string }> = {
  rental: { one: 'Property', many: 'Properties' },
  personal: { one: 'Budget', many: 'Budgets' },
};

export function nounFor(kind: LedgerKind): { one: string; many: string } {
  return NOUNS[kind];
}

/** Who the money went to / came from. Landlords have vendors; households have payees. */
export function partyLabel(kind: LedgerKind, entryKind: CategoryKind): string {
  if (entryKind === 'income') return 'Source';
  return kind === 'personal' ? 'Payee' : 'Vendor';
}

/** Distinct kinds among the user's active (non-archived) ledgers, rental first. */
export function kindsOf(ledgers: Pick<Property, 'property_type' | 'is_archived'>[]): LedgerKind[] {
  const set = new Set(ledgers.filter((l) => !l.is_archived).map((l) => l.property_type));
  return (['rental', 'personal'] as const).filter((k) => set.has(k));
}

/** Tab / section title for the whole collection: one kind's plural, or "Ledgers" when mixed or empty. */
export function collectionTitle(kinds: LedgerKind[]): string {
  return kinds.length === 1 ? NOUNS[kinds[0]].many : 'Ledgers';
}

export function collectionNoun(kinds: LedgerKind[]): string {
  return kinds.length === 1 ? NOUNS[kinds[0]].one : 'Ledger';
}
