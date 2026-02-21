import { getAdminClient } from './seed';

/**
 * DB assertion helpers for E2E tests.
 * Use the admin client (service role key) to verify database state.
 */

export async function gameExistsInDb(gameId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.from('games').select('id').eq('id', gameId).maybeSingle();
  return data !== null;
}

export async function getGameGmId(gameId: string): Promise<string | null> {
  const admin = getAdminClient();
  const { data } = await admin.from('games').select('gm_id').eq('id', gameId).maybeSingle();
  return data?.gm_id ?? null;
}

export async function availabilityRowsForUser(userId: string): Promise<number> {
  const admin = getAdminClient();
  const { count } = await admin
    .from('availability')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

export async function membershipRowsForUser(userId: string): Promise<number> {
  const admin = getAdminClient();
  const { count } = await admin
    .from('game_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

export async function userExistsInDb(userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle();
  return data !== null;
}

export async function sessionConfirmedByForGame(
  gameId: string
): Promise<(string | null)[]> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('sessions')
    .select('confirmed_by')
    .eq('game_id', gameId);
  return (data ?? []).map((s) => s.confirmed_by);
}
