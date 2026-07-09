import { describe, it, expect, vi } from 'vitest';
import { fetchGameName, fetchGameInviteMetaByCode } from './games';

function makeMockSupabase() {
  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, select, eq, single };
}

describe('fetchGameName', () => {
  it('selects only the name of the given game', async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchGameName(mock as any, 'game-1');
    expect(mock.from).toHaveBeenCalledWith('games');
    expect(mock.select).toHaveBeenCalledWith('name');
    expect(mock.eq).toHaveBeenCalledWith('id', 'game-1');
    expect(mock.single).toHaveBeenCalled();
  });
});

describe('fetchGameInviteMetaByCode', () => {
  it('selects the invite-preview shape by invite code', async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchGameInviteMetaByCode(mock as any, 'ABC123');
    expect(mock.from).toHaveBeenCalledWith('games');
    expect(mock.select).toHaveBeenCalledWith(
      'name, description, play_days, gm:users!games_gm_id_fkey(name)'
    );
    expect(mock.eq).toHaveBeenCalledWith('invite_code', 'ABC123');
    expect(mock.single).toHaveBeenCalled();
  });
});
