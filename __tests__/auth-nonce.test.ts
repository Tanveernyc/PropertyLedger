// The Apple flow needs two forms of one nonce: the hash goes to Apple, the raw
// value goes to Supabase. Getting them the wrong way round fails at the server.
import { createNoncePair } from '../src/lib/auth-nonce';

describe('createNoncePair', () => {
  it('returns a raw nonce and its SHA-256 hex hash', async () => {
    const { raw, hashed } = await createNoncePair();
    expect(raw).toMatch(/^[0-9a-f]{32}$/);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toBe(raw);
  });

  it('is different every call', async () => {
    const a = await createNoncePair();
    const b = await createNoncePair();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hashed).not.toBe(b.hashed);
  });

  it('hashes the raw value it returns, not something else', async () => {
    const { raw, hashed } = await createNoncePair();
    const again = await require('expo-crypto').digestStringAsync('SHA-256', raw);
    expect(hashed).toBe(again);
  });
});
