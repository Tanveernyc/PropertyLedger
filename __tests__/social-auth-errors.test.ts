// A user who backs out of the Apple or Google sheet has not hit an error, and
// must not be shown one. Everything else must say something.
import { classifyProviderError } from '../src/lib/social-auth-errors';

describe('classifyProviderError', () => {
  it('treats an Apple cancellation as cancelled', () => {
    expect(classifyProviderError({ code: 'ERR_REQUEST_CANCELED' })).toEqual({ kind: 'cancelled' });
  });

  it('treats a Google cancellation as cancelled', () => {
    expect(classifyProviderError({ code: 'SIGN_IN_CANCELLED' })).toEqual({ kind: 'cancelled' });
    expect(classifyProviderError({ code: '-5' })).toEqual({ kind: 'cancelled' });
  });

  it('passes a real error message through', () => {
    expect(classifyProviderError(new Error('network down'))).toEqual({
      kind: 'error',
      message: 'network down',
    });
  });

  it('never returns an empty message', () => {
    for (const weird of [undefined, null, {}, '', 0]) {
      const out = classifyProviderError(weird);
      expect(out.kind).toBe('error');
      if (out.kind === 'error') expect(out.message.length).toBeGreaterThan(0);
    }
  });
});
