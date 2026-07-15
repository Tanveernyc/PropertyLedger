// Phase 2 tests — sign-in form validation (spec §5 Phase 2):
// empty email rejected, malformed email rejected, password < 6 rejected.
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
  validateSignIn,
} from '../src/lib/auth-validation';

describe('validateEmail', () => {
  it('rejects an empty email', () => {
    expect(validateEmail('')).toBeDefined();
    expect(validateEmail('   ')).toBeDefined(); // whitespace-only is still empty
  });

  it('rejects malformed emails', () => {
    for (const bad of ['plainaddress', 'missing@tld', '@nouser.com', 'two words@x.com', 'a@b@c.com']) {
      expect(validateEmail(bad)).toBeDefined();
    }
  });

  it('accepts a well-formed email', () => {
    expect(validateEmail('owner@example.com')).toBeUndefined();
    expect(validateEmail('  owner@example.com  ')).toBeUndefined(); // trims padding
  });
});

describe('validatePassword', () => {
  it('rejects an empty password', () => {
    expect(validatePassword('')).toBeDefined();
  });

  it(`rejects passwords shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(validatePassword('12345')).toBeDefined();
  });

  it(`accepts passwords of ${MIN_PASSWORD_LENGTH}+ characters`, () => {
    expect(validatePassword('123456')).toBeUndefined();
    expect(validatePassword('a-long-passphrase')).toBeUndefined();
  });
});

describe('validateSignIn', () => {
  it('reports both field errors together', () => {
    const result = validateSignIn('', 'abc');
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
    expect(result.errors.password).toBeDefined();
  });

  it('is valid with a good email and password, with no errors attached', () => {
    const result = validateSignIn('owner@example.com', 'secret-pass');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
