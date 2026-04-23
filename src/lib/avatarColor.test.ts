import { describe, it, expect } from 'vitest';
import { getAvatarColorClass, getInitial, AVATAR_PALETTE_SIZE } from './avatarColor';

describe('getInitial', () => {
  it('returns first grapheme of name uppercased', () => {
    expect(getInitial('Jordan')).toBe('J');
    expect(getInitial('maya')).toBe('M');
  });
  it('returns ? for empty or falsy input', () => {
    expect(getInitial('')).toBe('?');
    expect(getInitial(null as unknown as string)).toBe('?');
  });
});

describe('getAvatarColorClass', () => {
  it('returns the same class for the same id', () => {
    expect(getAvatarColorClass('user-a')).toBe(getAvatarColorClass('user-a'));
  });
  it('returns one of AVATAR_PALETTE_SIZE semantic classes', () => {
    const cls = getAvatarColorClass('whatever');
    expect(cls).toMatch(/^bg-avatar-/);
  });
  it('spreads across palette for different ids', () => {
    const classes = new Set(
      Array.from({ length: 20 }, (_, i) => getAvatarColorClass(`u${i}`))
    );
    expect(classes.size).toBeGreaterThan(1);
    expect(classes.size).toBeLessThanOrEqual(AVATAR_PALETTE_SIZE);
  });
});
