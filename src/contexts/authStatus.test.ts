import { describe, it, expect } from 'vitest';
import { deriveAuthStatus } from './authStatus';

describe('deriveAuthStatus', () => {
  it('returns loading when isLoading is true', () => {
    expect(deriveAuthStatus(true, null, null, false)).toBe('loading');
  });

  it('returns loading when isLoading is true even with profile', () => {
    expect(deriveAuthStatus(true, {} as any, {} as any, false)).toBe('loading');
  });

  it('returns loading when session exists but profile has not loaded yet', () => {
    expect(deriveAuthStatus(false, {} as any, null, false)).toBe('loading');
  });

  it('returns authenticated when profile is loaded', () => {
    expect(deriveAuthStatus(false, {} as any, {} as any, false)).toBe('authenticated');
  });

  it('returns unauthenticated when not loading and no session', () => {
    expect(deriveAuthStatus(false, null, null, false)).toBe('unauthenticated');
  });

  it('returns unauthenticated when session exists but profile failed (backendError)', () => {
    expect(deriveAuthStatus(false, {} as any, null, true)).toBe('unauthenticated');
  });

  it('returns unauthenticated when no session and backendError', () => {
    expect(deriveAuthStatus(false, null, null, true)).toBe('unauthenticated');
  });
});
