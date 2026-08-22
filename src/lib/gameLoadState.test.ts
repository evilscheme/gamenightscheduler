import { describe, it, expect } from 'vitest';
import { resolveGameLoadState } from './gameLoadState';

const base = {
  authLoading: false,
  gameLoading: false,
  gameErrored: false,
  hasGame: true,
};

describe('resolveGameLoadState', () => {
  it('reports loading while the auth session is still resolving', () => {
    expect(resolveGameLoadState({ ...base, authLoading: true, hasGame: false })).toBe('loading');
  });

  it('reports loading while the game query is in flight', () => {
    expect(resolveGameLoadState({ ...base, gameLoading: true, hasGame: false })).toBe('loading');
  });

  it('reports ready once a game has loaded', () => {
    expect(resolveGameLoadState(base)).toBe('ready');
  });

  it('reports not-found when the query succeeded but returned no game', () => {
    expect(resolveGameLoadState({ ...base, hasGame: false })).toBe('not-found');
  });

  it('reports error when the game query failed', () => {
    expect(resolveGameLoadState({ ...base, gameErrored: true, hasGame: false })).toBe('error');
  });

  // The bug this module exists to prevent: an expired token makes every
  // participant-gated query fail with 42501, which used to look identical to
  // "this game does not exist" and bounced the player to the dashboard.
  it('distinguishes a failed load from a missing game', () => {
    const failed = resolveGameLoadState({ ...base, gameErrored: true, hasGame: false });
    const missing = resolveGameLoadState({ ...base, gameErrored: false, hasGame: false });
    expect(failed).not.toBe(missing);
  });

  it('still reports loading when a retry is in flight after an error', () => {
    expect(
      resolveGameLoadState({ ...base, gameLoading: true, gameErrored: true, hasGame: false })
    ).toBe('loading');
  });
});
