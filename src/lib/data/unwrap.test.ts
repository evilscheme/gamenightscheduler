import { describe, it, expect } from 'vitest';
import { unwrapList, requireLoaded } from './unwrap';

describe('unwrapList', () => {
  it('returns the rows on success', () => {
    expect(unwrapList({ data: [1, 2], error: null })).toEqual([1, 2]);
  });

  it('returns an empty list when a successful read has null data', () => {
    expect(unwrapList({ data: null, error: null })).toEqual([]);
  });

  it('throws with the error message instead of returning an empty list', () => {
    expect(() =>
      unwrapList({ data: null, error: { message: 'permission denied' } }),
    ).toThrow('permission denied');
  });

  it('throws even when partial data accompanies the error', () => {
    expect(() => unwrapList({ data: [1], error: { message: 'boom' } })).toThrow('boom');
  });

  it('falls back to a generic message when the error has none', () => {
    expect(() => unwrapList({ data: null, error: {} })).toThrow('Request failed');
  });
});

describe('requireLoaded', () => {
  it('passes when every source is loaded', () => {
    expect(() =>
      requireLoaded([
        { name: 'availability', loaded: true },
        { name: 'sessions', loaded: true },
      ]),
    ).not.toThrow();
  });

  it('passes with no sources', () => {
    expect(() => requireLoaded([])).not.toThrow();
  });

  it('throws naming only the sources that are not loaded', () => {
    expect(() =>
      requireLoaded([
        { name: 'availability', loaded: true },
        { name: 'sessions', loaded: false },
      ]),
    ).toThrow(/sessions.*nothing was changed/);
  });

  it('names every missing source', () => {
    expect(() =>
      requireLoaded([
        { name: 'availability', loaded: false },
        { name: 'defaults', loaded: false },
      ]),
    ).toThrow(/availability and defaults/);
  });
});
