import { describe, it, expect } from 'vitest';
import { isLocalSupabaseUrl } from './env';

describe('isLocalSupabaseUrl', () => {
  it('accepts exact localhost host', () => {
    expect(isLocalSupabaseUrl('http://localhost:54321')).toBe(true);
    expect(isLocalSupabaseUrl('http://127.0.0.1:54321')).toBe(true);
  });

  it('rejects lookalike hosts that merely contain "localhost"', () => {
    expect(isLocalSupabaseUrl('https://localhost.attacker.com')).toBe(false);
    expect(isLocalSupabaseUrl('https://evil-localhost.com')).toBe(false);
    expect(isLocalSupabaseUrl('https://abc.supabase.co')).toBe(false);
  });

  it('rejects empty / malformed input', () => {
    expect(isLocalSupabaseUrl('')).toBe(false);
    expect(isLocalSupabaseUrl('not a url')).toBe(false);
  });
});
