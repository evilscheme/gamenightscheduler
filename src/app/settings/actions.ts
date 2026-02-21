'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';

export interface DeletePreview {
  gmGames: {
    gameId: string;
    gameName: string;
    members: { id: string; name: string }[];
  }[];
  memberGameCount: number;
}

export type GameAction =
  | { gameId: string; action: 'delete' }
  | { gameId: string; action: 'transfer'; newGmId: string };

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getDeletePreview(): Promise<{
  success: boolean;
  data?: DeletePreview;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const admin = createAdminClient();

  // Fetch all games where user is the GM
  const { data: gmGames, error: gmGamesError } = await admin
    .from('games')
    .select('id, name')
    .eq('gm_id', user.id);

  if (gmGamesError) {
    return { success: false, error: `Failed to fetch games: ${gmGamesError.message}` };
  }

  // For each GM game, fetch members (excluding the GM themselves)
  const gmGamesWithMembers = await Promise.all(
    (gmGames || []).map(async (game) => {
      const { data: memberships } = await admin
        .from('game_memberships')
        .select('user_id, users(id, name)')
        .eq('game_id', game.id)
        .neq('user_id', user.id);

      const members = (memberships || []).map((m) => {
        const u = m.users as unknown as { id: string; name: string };
        return { id: u.id, name: u.name };
      });

      return {
        gameId: game.id,
        gameName: game.name,
        members,
      };
    })
  );

  // Count games where user is a member but not the GM
  const { count, error: memberCountError } = await admin
    .from('game_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (memberCountError) {
    return { success: false, error: `Failed to count memberships: ${memberCountError.message}` };
  }

  return {
    success: true,
    data: {
      gmGames: gmGamesWithMembers,
      memberGameCount: count || 0,
    },
  };
}

export async function deleteAccount(
  gameActions: GameAction[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const admin = createAdminClient();
  const userId = user.id;

  // Fetch all games where user is the GM
  const { data: gmGames, error: gmGamesError } = await admin
    .from('games')
    .select('id, name')
    .eq('gm_id', userId);

  if (gmGamesError) {
    return { success: false, error: `Failed to fetch games: ${gmGamesError.message}` };
  }

  // For each GM game, count members (excluding the GM)
  const gamesWithMemberCounts = await Promise.all(
    (gmGames || []).map(async (game) => {
      const { count } = await admin
        .from('game_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .neq('user_id', userId);

      return { gameId: game.id, gameName: game.name, memberCount: count || 0 };
    })
  );

  // Verify every multi-member game has a corresponding action
  const multiMemberGames = gamesWithMemberCounts.filter((g) => g.memberCount > 0);
  const actionMap = new Map(gameActions.map((a) => [a.gameId, a]));

  for (const game of multiMemberGames) {
    if (!actionMap.has(game.gameId)) {
      return {
        success: false,
        error: `Missing action for game "${game.gameName}" which has ${game.memberCount} member(s)`,
      };
    }
  }

  // Process transfer actions
  for (const gameAction of gameActions) {
    if (gameAction.action !== 'transfer') continue;

    const { gameId, newGmId } = gameAction;

    // Check if this game still belongs to the caller (idempotency)
    const { data: game } = await admin
      .from('games')
      .select('gm_id')
      .eq('id', gameId)
      .single();

    if (!game || game.gm_id !== userId) {
      // Already transferred or deleted — skip for idempotency
      continue;
    }

    // Validate the target is a current member of the game
    const { data: membership, error: membershipError } = await admin
      .from('game_memberships')
      .select('user_id')
      .eq('game_id', gameId)
      .eq('user_id', newGmId)
      .maybeSingle();

    if (membershipError) {
      return { success: false, error: `Failed to validate transfer target: ${membershipError.message}` };
    }
    if (!membership) {
      return {
        success: false,
        error: `Transfer target is not a member of the game`,
      };
    }

    // Transfer GM ownership
    const { error: transferError } = await admin
      .from('games')
      .update({ gm_id: newGmId })
      .eq('id', gameId);

    if (transferError) {
      return { success: false, error: `Failed to transfer game: ${transferError.message}` };
    }

    // Remove new GM from memberships (they're now the GM, not a member)
    await admin
      .from('game_memberships')
      .delete()
      .eq('game_id', gameId)
      .eq('user_id', newGmId);
  }

  // Delete from public.users — triggers FK cascades for remaining games, memberships, availability
  const { error: deleteUserError } = await admin
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteUserError) {
    return { success: false, error: `Failed to delete user data: ${deleteUserError.message}` };
  }

  // Delete the auth identity
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    return { success: false, error: `Failed to delete auth account: ${deleteAuthError.message}` };
  }

  return { success: true };
}
