import { describe, it, expect, vi } from 'vitest';
import { findAuthUserByEmail, listAllAuthUsers } from './admin';

/** A fake auth admin API serving `total` users, 1000 per page, like GoTrue does. */
function fakeClient(total: number, error?: Error) {
  const users = Array.from({ length: total }, (_, i) => ({ id: `u${i}`, email: `user${i}@test.local` }));
  const listUsers = vi.fn(async ({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) =>
    error
      ? { data: { users: [] }, error }
      : { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null }
  );
  return { client: { auth: { admin: { listUsers } } } as never, listUsers };
}

describe('findAuthUserByEmail', () => {
  it('finds a user past the first page', async () => {
    const { client, listUsers } = fakeClient(1500);
    expect(await findAuthUserByEmail(client, 'user1200@test.local')).toMatchObject({ id: 'u1200' });
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('stops at the page that has the user', async () => {
    const { client, listUsers } = fakeClient(2500);
    await findAuthUserByEmail(client, 'user5@test.local');
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it('returns null after the last page', async () => {
    const { client } = fakeClient(1000); // exactly one full page, then an empty one
    expect(await findAuthUserByEmail(client, 'nobody@test.local')).toBeNull();
  });

  it('throws on an API error instead of reporting "not found"', async () => {
    const { client } = fakeClient(10, new Error('boom'));
    await expect(findAuthUserByEmail(client, 'user1@test.local')).rejects.toThrow('boom');
  });
});

describe('listAllAuthUsers', () => {
  it('returns every user across pages', async () => {
    const { client } = fakeClient(2001);
    expect(await listAllAuthUsers(client)).toHaveLength(2001);
  });
});
