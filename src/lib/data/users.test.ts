import { describe, it, expect, vi } from 'vitest';
import { fetchUserProfile } from './users';

function makeMockSupabase() {
  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, eq, single };
}

describe('fetchUserProfile', () => {
  it('selects the full profile row for the given user', async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchUserProfile(mock as any, 'user-1');
    expect(mock.from).toHaveBeenCalledWith('users');
    expect(mock.select).toHaveBeenCalledWith('*');
    expect(mock.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(mock.single).toHaveBeenCalled();
  });
});
