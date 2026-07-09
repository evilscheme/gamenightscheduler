import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUser } from './auth';

const authMocks = vi.hoisted(() => {
  const serverClient = {
    auth: {
      getUser: vi.fn(),
    },
  };
  return {
    serverClient,
    createClient: vi.fn(),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: authMocks.createClient,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.createClient.mockResolvedValue(authMocks.serverClient);
});

describe('requireUser', () => {
  it('returns 401 when there is no authenticated user', async () => {
    authMocks.serverClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await requireUser();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: 'Authentication required',
    });
  });

  it('returns 401 when the auth lookup errors', async () => {
    authMocks.serverClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'bad token' },
    });

    const result = await requireUser();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it('returns the user on success', async () => {
    const user = { id: 'user-1', email: 'a@b.c' };
    authMocks.serverClient.auth.getUser.mockResolvedValue({
      data: { user },
      error: null,
    });

    const result = await requireUser();

    expect(result).not.toBeInstanceOf(Response);
    expect((result as { user: typeof user }).user).toEqual(user);
  });
});
