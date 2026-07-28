import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalStoragePref } from './useLocalStoragePref';

const isMode = (v: unknown): v is 'a' | 'b' => v === 'a' || v === 'b';
const isPositiveNumber = (v: unknown): v is number =>
  typeof v === 'number' && v > 0;

describe('useLocalStoragePref', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns the default value on first render and after hydration when storage is empty', () => {
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
  });

  it('hydrates from a bare (legacy) string value', () => {
    window.localStorage.setItem('k', 'b');
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('b');
  });

  it('hydrates from a JSON-quoted string value (forward compatible)', () => {
    window.localStorage.setItem('k', JSON.stringify('b'));
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('b');
  });

  it('ignores invalid stored values and uses the default', () => {
    window.localStorage.setItem('k', 'garbage');
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
  });

  it('persists strings raw (no JSON quoting)', () => {
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    act(() => {
      result.current[1]('b');
    });
    expect(result.current[0]).toBe('b');
    expect(window.localStorage.getItem('k')).toBe('b');
  });

  it('JSON-encodes non-string values on write and decodes them on read', () => {
    const { result } = renderHook(() => useLocalStoragePref('n', 1, isPositiveNumber));
    act(() => {
      result.current[1](42);
    });
    expect(result.current[0]).toBe(42);
    expect(window.localStorage.getItem('n')).toBe('42');

    // A fresh render reads the JSON-encoded number back.
    const { result: next } = renderHook(() => useLocalStoragePref('n', 1, isPositiveNumber));
    expect(next.current[0]).toBe(42);
  });

  it('does not throw when localStorage access fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
    spy.mockRestore();
  });

  // Each test below uses a distinct key: the hook's in-memory fallback layer is
  // module-scoped and intentionally outlives a single component.

  it('picks up a write made in another tab (storage event)', () => {
    const { result } = renderHook(() => useLocalStoragePref('x-tab', 'a', isMode));
    expect(result.current[0]).toBe('a');

    act(() => {
      window.localStorage.setItem('x-tab', 'b');
      window.dispatchEvent(new StorageEvent('storage', { key: 'x-tab' }));
    });
    expect(result.current[0]).toBe('b');
  });

  it('falls back to the default when another tab clears the whole store', () => {
    window.localStorage.setItem('x-clear', 'b');
    const { result } = renderHook(() => useLocalStoragePref('x-clear', 'a', isMode));
    expect(result.current[0]).toBe('b');

    act(() => {
      window.localStorage.clear();
      // A null key means "entire store cleared".
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(result.current[0]).toBe('a');
  });

  it('keeps two instances of the same key in sync within one tab', () => {
    const first = renderHook(() => useLocalStoragePref('x-shared', 'a', isMode));
    const second = renderHook(() => useLocalStoragePref('x-shared', 'a', isMode));

    act(() => {
      first.result.current[1]('b');
    });
    expect(first.result.current[0]).toBe('b');
    expect(second.result.current[0]).toBe('b');
  });

  it('still reflects the new value when the storage write fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { result } = renderHook(() => useLocalStoragePref('x-quota', 'a', isMode));

    act(() => {
      result.current[1]('b');
    });
    expect(result.current[0]).toBe('b');
    spy.mockRestore();
  });
});
