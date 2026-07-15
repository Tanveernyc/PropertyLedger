// Phase 0 sanity check: proves the Jest runner (jest-expo preset) is wired up.
// Real feature tests begin in Phase 1. See README spec §5 Phase 0.
describe('test runner', () => {
  it('runs and evaluates assertions', () => {
    expect(1 + 1).toBe(2);
  });
});
