import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/api/auth';
import { serverError } from '@/lib/apiError';

import type { PlayerMembershipGame, DeletePreview } from '@/types/api';

export async function GET(): Promise<Response> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const admin = createAdminClient();

  // Fetch owned games with their members (excluding the GM themselves)
  const { data: ownedGames, error: gamesError } = await admin
    .from('games')
    .select('id, name, game_memberships(user_id, users(id, name))')
    .eq('gm_id', user.id)
    .order('name');

  if (gamesError) {
    return serverError(gamesError, { route: 'account/delete-preview', step: 'fetch-owned-games' });
  }

  // Fetch player memberships with game names
  const { data: membershipRows, error: membershipError } = await admin
    .from('game_memberships')
    .select('game_id, games(id, name)')
    .eq('user_id', user.id);

  if (membershipError) {
    return serverError(membershipError, { route: 'account/delete-preview', step: 'fetch-memberships' });
  }

  const playerMembershipGames: PlayerMembershipGame[] = (membershipRows ?? []).map((row) => {
    const g = Array.isArray(row.games) ? row.games[0] : row.games;
    return {
      id: row.game_id,
      name: (g as { id: string; name: string } | null)?.name ?? 'Unknown',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const preview: DeletePreview = {
    ownedGames: (ownedGames ?? []).map((game) => ({
      id: game.id,
      name: game.name,
      members: (game.game_memberships ?? []).map((m) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users;
        return { id: m.user_id, name: (u as { id: string; name: string } | null)?.name ?? 'Unknown' };
      }),
    })),
    playerMembershipCount: playerMembershipGames.length,
    playerMembershipGames,
  };

  return NextResponse.json(preview);
}
