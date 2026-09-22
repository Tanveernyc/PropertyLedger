// Apple wants the SHA-256 of a nonce; Supabase wants the same nonce raw, so it
// can verify Apple hashed what we claim. Both come from one call to avoid the
// classic bug of hashing a different string than the one sent on.
import * as Crypto from 'expo-crypto';

export interface NoncePair {
  /** Sent to Supabase's signInWithIdToken. */
  raw: string;
  /** Sent to Apple's signInAsync. */
  hashed: string;
}

export async function createNoncePair(): Promise<NoncePair> {
  const bytes = Crypto.getRandomBytes(16);
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}
