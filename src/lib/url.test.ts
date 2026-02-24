import { describe, it, expect } from 'vitest';
import { safeCallbackUrl } from './url';

describe('safeCallbackUrl', () => {
  it('allows simple relative paths', () => {
    expect(safeCallbackUrl('/dashboard')).toBe('/dashboard');
    expect(safeCallbackUrl('/games/abc')).toBe('/games/abc');
    expect(safeCallbackUrl('/settings')).toBe('/settings');
  });

  it('allows paths with query parameters', () => {
    expect(safeCallbackUrl('/games?tab=sessions')).toBe('/games?tab=sessions');
  });

  it('returns fallback for null input', () => {
    expect(safeCallbackUrl(null)).toBe('/dashboard');
  });

  it('returns fallback for empty string', () => {
    expect(safeCallbackUrl('')).toBe('/dashboard');
  });

  it('blocks protocol-relative URLs (//)', () => {
    expect(safeCallbackUrl('//evil.com')).toBe('/dashboard');
    expect(safeCallbackUrl('//evil.com/phish')).toBe('/dashboard');
  });

  it('blocks backslash-relative URLs (/\\)', () => {
    expect(safeCallbackUrl('/\\evil.com')).toBe('/dashboard');
    expect(safeCallbackUrl('/\\evil.com/phish')).toBe('/dashboard');
  });

  it('blocks absolute URLs', () => {
    expect(safeCallbackUrl('https://evil.com')).toBe('/dashboard');
    expect(safeCallbackUrl('http://evil.com')).toBe('/dashboard');
  });

  it('blocks non-path strings', () => {
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/dashboard');
    expect(safeCallbackUrl('data:text/html,<h1>hi</h1>')).toBe('/dashboard');
  });

  it('uses custom fallback when provided', () => {
    expect(safeCallbackUrl(null, '/home')).toBe('/home');
    expect(safeCallbackUrl('//evil.com', '/home')).toBe('/home');
  });
});
