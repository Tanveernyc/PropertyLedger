import { shouldOnboard } from '@/lib/onboarding';
import type { Property } from '@/types';

const row = { id: 'p1', name: 'Home', property_type: 'rental', is_archived: false } as Property;

describe('shouldOnboard', () => {
  it('is false while the list is still unknown', () => {
    expect(shouldOnboard(undefined, false)).toBe(false);
    expect(shouldOnboard(undefined, true)).toBe(false);
  });

  it('is false for an empty cached list that is being refetched', () => {
    expect(shouldOnboard([], true)).toBe(false);
  });

  it('is true for a settled empty list', () => {
    expect(shouldOnboard([], false)).toBe(true);
  });

  it('is false once any ledger exists', () => {
    expect(shouldOnboard([row], false)).toBe(false);
    expect(shouldOnboard([row], true)).toBe(false);
  });
});
