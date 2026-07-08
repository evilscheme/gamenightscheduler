import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberWithRole, MembershipWithUser } from '@/types';

export async function fetchGameMembers(supabase: SupabaseClient, gameId: string) {
  const { data: memberships, error } = await supabase
    .from('game_memberships')
    .select('user_id, is_co_gm, users(*)')
    .eq('game_id', gameId);

  if (error) return { data: [] as MemberWithRole[], error };

  const typedMemberships = memberships as unknown as MembershipWithUser[] | null;
  const members: MemberWithRole[] =
    typedMemberships
      ?.filter((m) => m.users !== null)
      .map((m) => ({
        ...m.users!,
        is_co_gm: m.is_co_gm,
      })) || [];

  return { data: members, error: null };
}

export async function fetchUserMemberships(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('game_memberships')
    .select('game_id, is_co_gm')
    .eq('user_id', userId);
}

/**
 * Every game the user participates in (as GM or member), as {id, name} pairs.
 * Callers filter out the current game themselves so the result is cacheable
 * per user rather than per (user, game) pair.
 */
export async function fetchMyGamesLite(supabase: SupabaseClient, userId: string) {
  const [memberRes, gmRes] = await Promise.all([
    supabase.from('game_memberships').select('game_id, games(id, name)').eq('user_id', userId),
    supabase.from('games').select('id, name').eq('gm_id', userId),
  ]);

  const gameMap = new Map<string, string>();
  gmRes.data?.forEach((g) => gameMap.set(g.id, g.name));
  memberRes.data?.forEach((m) => {
    const g = m.games as unknown as { id: string; name: string } | null;
    if (g) gameMap.set(g.id, g.name);
  });

  return Array.from(gameMap.entries()).map(([id, name]) => ({ id, name }));
}

/**
 * Join a game via its invite code. Goes through the join_game_by_invite RPC
 * (SECURITY DEFINER) rather than a direct game_memberships insert: the database
 * has no direct INSERT policy, so this is the only sanctioned join path. The RPC
 * verifies the invite code, enforces the player cap, and always joins as a
 * regular player (never co-GM). Returns the joined game's id in `data`.
 */
export async function joinGame(supabase: SupabaseClient, inviteCode: string) {
  return supabase.rpc('join_game_by_invite', { invite_code_param: inviteCode });
}

export async function leaveGame(supabase: SupabaseClient, gameId: string, userId: string) {
  return supabase
    .from('game_memberships')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

// Same operation as leaveGame, but semantically distinct (GM removing a player vs. player leaving)
export const removePlayer = leaveGame;

export async function toggleCoGm(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  isCoGm: boolean
) {
  return supabase
    .from('game_memberships')
    .update({ is_co_gm: isCoGm })
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

export async function checkCoGmStatus(
  supabase: SupabaseClient,
  gameId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('game_memberships')
    .select('is_co_gm')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single();

  return { data: data?.is_co_gm ?? false, error };
}
