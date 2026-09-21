// Module-resolution hooks for scripts/e2e-recurring.ts (never used by the app or jest).
//
// Lets plain Node import the real `src/db/*.ts` layer:
//   - `@/...`            → `src/...`               (tsconfig paths alias)
//   - extensionless `./x` → `./x.ts`               (Node ESM needs explicit extensions)
//   - `src/db/supabase.ts` → `scripts/e2e-recurring.supabase.mjs`
//     (the app client pulls in AsyncStorage + the RN URL polyfill, which do not run in Node)
//
// Registered with `node --import ./scripts/e2e-recurring.loader.mjs`. The hooks run on a
// separate thread, so the self-registration below is guarded by isMainThread.
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isMainThread } from 'node:worker_threads';

const SRC = new URL('../src/', import.meta.url);
const REAL_SUPABASE = new URL('db/supabase.ts', SRC).href;
const SHIM_SUPABASE = new URL('./e2e-recurring.supabase.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  let spec = specifier;
  if (spec.startsWith('@/')) spec = new URL(spec.slice(2), SRC).href;

  if (spec.startsWith('.') || spec.startsWith('file:')) {
    const url = new URL(spec, spec.startsWith('.') ? context.parentURL : undefined);
    const hasExtension = /\.[cm]?[jt]sx?$/.test(url.pathname);
    const resolved = !hasExtension && existsSync(fileURLToPath(url) + '.ts') ? url.href + '.ts' : url.href;
    if (resolved === REAL_SUPABASE) return { url: SHIM_SUPABASE, shortCircuit: true };
    if (resolved !== url.href || spec !== specifier) return { url: resolved, shortCircuit: true };
  }
  return nextResolve(spec, context);
}

if (isMainThread) register(import.meta.url);
