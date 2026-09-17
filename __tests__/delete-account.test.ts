// Phase 13 tests — the type-to-confirm check guarding permanent account deletion.
import { isDeleteConfirmed } from '../src/lib/delete-account';

describe('isDeleteConfirmed', () => {
  it('accepts the exact word', () => {
    expect(isDeleteConfirmed('DELETE')).toBe(true);
  });

  it('accepts lowercase so phone autocapitalization does not fight the user', () => {
    expect(isDeleteConfirmed('delete')).toBe(true);
    expect(isDeleteConfirmed('Delete')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isDeleteConfirmed('  DELETE  ')).toBe(true);
  });

  it('rejects an empty or whitespace-only field', () => {
    expect(isDeleteConfirmed('')).toBe(false);
    expect(isDeleteConfirmed('   ')).toBe(false);
  });

  it('rejects a partial word', () => {
    expect(isDeleteConfirmed('DELE')).toBe(false);
  });

  it('rejects a string that merely contains the word', () => {
    expect(isDeleteConfirmed('DELETE ME')).toBe(false);
    expect(isDeleteConfirmed('undelete')).toBe(false);
  });
});
