// Personal budgets - every user-facing noun that depends on ledger kind (spec §3).
import { collectionNoun, collectionTitle, kindsOf, nounFor, partyLabel } from '../src/lib/ledger-copy';

describe('nounFor', () => {
  it('rental is Property, personal is Budget', () => {
    expect(nounFor('rental')).toEqual({ one: 'Property', many: 'Properties' });
    expect(nounFor('personal')).toEqual({ one: 'Budget', many: 'Budgets' });
  });
});

describe('partyLabel', () => {
  it('rental expenses have a Vendor; personal expenses have a Payee; income is always Source', () => {
    expect(partyLabel('rental', 'expense')).toBe('Vendor');
    expect(partyLabel('personal', 'expense')).toBe('Payee');
    expect(partyLabel('rental', 'income')).toBe('Source');
    expect(partyLabel('personal', 'income')).toBe('Source');
  });
});

describe('kindsOf', () => {
  it('returns distinct kinds of active ledgers only', () => {
    expect(
      kindsOf([
        { property_type: 'rental', is_archived: false },
        { property_type: 'rental', is_archived: false },
        { property_type: 'personal', is_archived: true },
      ])
    ).toEqual(['rental']);
  });
  it('is empty with no ledgers', () => {
    expect(kindsOf([])).toEqual([]);
  });
});

describe('collectionTitle / collectionNoun', () => {
  it('all rental → Properties/Property', () => {
    expect(collectionTitle(['rental'])).toBe('Properties');
    expect(collectionNoun(['rental'])).toBe('Property');
  });
  it('all personal → Budgets/Budget', () => {
    expect(collectionTitle(['personal'])).toBe('Budgets');
    expect(collectionNoun(['personal'])).toBe('Budget');
  });
  it('mixed or none → Ledgers/Ledger', () => {
    expect(collectionTitle(['rental', 'personal'])).toBe('Ledgers');
    expect(collectionTitle([])).toBe('Ledgers');
    expect(collectionNoun([])).toBe('Ledger');
  });
});
