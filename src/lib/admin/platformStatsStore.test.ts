import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakePostgrest } from '@/test/fakePostgrest';
import type { AdminClient } from '@/lib/api/admin';
import { fetchPlatformInputs, getCachedPlatformInputs, PLATFORM_INPUTS_TTL_MS } from './platformStatsStore';

const TABLES = ['users', 'games', 'game_memberships', 'sessions', 'availability', 'game_play_dates'];

function fakeDb() {
  const fake = fakePostgrest({
    users: [{ id: 'u1', created_at: '2025-01-01T00:00:00' }],
    sessions: [{ id: 's1', game_id: 'g1', date: '2025-02-01', created_at: '2025-01-02T00:00:00', status: 'confirmed' }],
  });
  return { fake, client: fake as unknown as AdminClient };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('fetchPlatformInputs', () => {
  it('reads every input table, sessions with their status', async () => {
    const { fake, client } = fakeDb();
    const inputs = await fetchPlatformInputs(client);

    expect(fake.from.mock.calls.map((c) => c[0]).sort()).toEqual([...TABLES].sort());
    const sessionsBuilder = fake.from.mock.results[fake.from.mock.calls.findIndex((c) => c[0] === 'sessions')].value;
    expect(sessionsBuilder.select.mock.calls[0][0]).toMatch(/\bstatus\b/);
    expect(inputs.sessions).toEqual([
      { id: 's1', game_id: 'g1', date: '2025-02-01', created_at: '2025-01-02T00:00:00', status: 'confirmed' },
    ]);
  });

  it('always reads fresh, even when called concurrently (the cron and backfill rely on it)', async () => {
    const { fake, client } = fakeDb();
    await Promise.all([fetchPlatformInputs(client), fetchPlatformInputs(client)]);
    expect(fake.from).toHaveBeenCalledTimes(TABLES.length * 2);
  });
});

describe('getCachedPlatformInputs', () => {
  it('shares one read between concurrent admin routes', async () => {
    const { fake, client } = fakeDb();
    const [a, b] = await Promise.all([getCachedPlatformInputs(client), getCachedPlatformInputs(client)]);
    expect(a).toBe(b);
    expect(fake.from).toHaveBeenCalledTimes(TABLES.length);
  });

  it('keeps a read for five minutes in production only', async () => {
    expect(PLATFORM_INPUTS_TTL_MS).toBe(0); // the test runner, like `next dev`
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const prod = await import('./platformStatsStore');
    expect(prod.PLATFORM_INPUTS_TTL_MS).toBe(5 * 60 * 1000);

    const { fake, client } = fakeDb();
    const first = await prod.getCachedPlatformInputs(client);
    expect(await prod.getCachedPlatformInputs(client)).toBe(first);
    expect(fake.from).toHaveBeenCalledTimes(TABLES.length);
  });
});
