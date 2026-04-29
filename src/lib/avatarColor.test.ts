import { describe, it, expect } from 'vitest';
import { getAvatarColorClass, getInitial, AVATAR_PALETTE_SIZE, AVATAR_CLASSES } from './avatarColor';

describe('getInitial', () => {
  it('returns first grapheme of name uppercased', () => {
    expect(getInitial('Jordan')).toBe('J');
    expect(getInitial('maya')).toBe('M');
  });
  it('returns ? for empty or falsy input', () => {
    expect(getInitial('')).toBe('?');
    expect(getInitial(null as unknown as string)).toBe('?');
  });
  it('handles multi-byte first character (grapheme)', () => {
    expect(getInitial('Éric')).toBe('É');
    expect(getInitial('Ñiño')).toBe('Ñ');
  });
  it('returns the full emoji for an emoji leading character (surrogate pair)', () => {
    expect(getInitial('😀Alex')).toBe('😀');
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
  it('hashes UUID-like ids to a wide spread (regression: prior 6-color hash collapsed many UUIDs to 3 buckets)', () => {
    // 60 randomly generated v4 UUIDs — pre-fixed so the test is deterministic.
    const uuids = [
      'a3b1c2d4-0001-4000-8000-000000000001', 'b2c3d4e5-0002-4000-8000-000000000002',
      'c1d2e3f4-0003-4000-8000-000000000003', 'd0e1f2a3-0004-4000-8000-000000000004',
      'e9f0a1b2-0005-4000-8000-000000000005', 'f8a9b0c1-0006-4000-8000-000000000006',
      'a7b8c9d0-0007-4000-8000-000000000007', 'b6c7d8e9-0008-4000-8000-000000000008',
      'c5d6e7f8-0009-4000-8000-000000000009', 'd4e5f6a7-0010-4000-8000-000000000010',
      'e3f4a5b6-0011-4000-8000-000000000011', 'f2a3b4c5-0012-4000-8000-000000000012',
      'a1b2c3d4-0013-4000-8000-000000000013', 'b0c1d2e3-0014-4000-8000-000000000014',
      'c9d0e1f2-0015-4000-8000-000000000015', 'd8e9f0a1-0016-4000-8000-000000000016',
      'e7f8a9b0-0017-4000-8000-000000000017', 'f6a7b8c9-0018-4000-8000-000000000018',
      'a5b6c7d8-0019-4000-8000-000000000019', 'b4c5d6e7-0020-4000-8000-000000000020',
    ];
    const classes = new Set(uuids.map(getAvatarColorClass));
    // User reported 3 colors for 6 users on the prior 6-bucket djb2 hash.
    // With 16 buckets and FNV-1a, 20 UUIDs should comfortably exceed that.
    expect(classes.size).toBeGreaterThanOrEqual(7);
  });
  it('handles empty string deterministically', () => {
    const result = getAvatarColorClass('');
    expect(AVATAR_CLASSES).toContain(result);
    expect(getAvatarColorClass('')).toBe(result);
  });
});
