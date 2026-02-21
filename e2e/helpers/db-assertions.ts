/**
 * Shared database assertion helpers for E2E tests.
 *
 * These query the database directly via the admin client to verify
 * that operations (like account deletion) produced the expected state.
 */

import { getAdminClient } from './seed';

export async function userExistsInDb(userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle();
  return data !== null;
}

export async function authUserExistsInDb(userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user !== null;
}

export async function gameExistsInDb(gameId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin.from('games').select('id').eq('id', gameId).maybeSingle();
  return data !== null;
}

export async function gameMembershipsForUser(userId: string): Promise<number> {
  const admin = getAdminClient();
  const { count } = await admin
    .from('game_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

export async function availabilityRowsForUser(userId: string): Promise<number> {
  const admin = getAdminClient();
  const { count } = await admin
    .from('availability')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

export async function getGameGmId(gameId: string): Promise<string | null> {
  const admin = getAdminClient();
  const { data } = await admin.from('games').select('gm_id').eq('id', gameId).maybeSingle();
  return data?.gm_id ?? null;
}

export async function membershipExistsInGame(gameId: string, userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('game_memberships')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .maybeSingle();
  return data !== null;
}

export async function sessionsInGame(gameId: string): Promise<number> {
  const admin = getAdminClient();
  const { count } = await admin
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId);
  return count ?? 0;
}

export async function sessionConfirmedByForGame(gameId: string): Promise<string | null> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('sessions')
    .select('confirmed_by')
    .eq('game_id', gameId)
    .maybeSingle();
  return data?.confirmed_by ?? null;
}

export async function availabilityRowsInGame(gameId: string, userId: string): Promise<number> {
  const admin = getAdminClient();
  const { count } = await admin
    .from('availability')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .eq('user_id', userId);
  return count ?? 0;
}
