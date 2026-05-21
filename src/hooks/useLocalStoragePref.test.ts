import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalStoragePref } from './useLocalStoragePref';

const isMode = (v: unknown): v is 'a' | 'b' => v === 'a' || v === 'b';

describe('useLocalStoragePref', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns the default value on first render and after hydration when storage is empty', () => {
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
  });

  it('hydrates from localStorage when a valid value is stored', () => {
    window.localStorage.setItem('k', JSON.stringify('b'));
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('b');
  });

  it('ignores invalid stored values and uses the default', () => {
    window.localStorage.setItem('k', JSON.stringify('garbage'));
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
  });

  it('persists through the setter', () => {
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    act(() => {
      result.current[1]('b');
    });
    expect(result.current[0]).toBe('b');
    expect(window.localStorage.getItem('k')).toBe(JSON.stringify('b'));
  });

  it('does not throw when localStorage access fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useLocalStoragePref('k', 'a', isMode));
    expect(result.current[0]).toBe('a');
    spy.mockRestore();
  });
});
