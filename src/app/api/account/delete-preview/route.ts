import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OwnedGameMember {
  id: string;
  name: string;
}

export interface OwnedGame {
  id: string;
  name: string;
  members: OwnedGameMember[];
}

export interface PlayerMembershipGame {
  id: string;
  name: string;
}

export interface DeletePreview {
  ownedGames: OwnedGame[];
  playerMembershipCount: number;
  playerMembershipGames: PlayerMembershipGame[];
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch owned games with their members (excluding the GM themselves)
  const { data: ownedGames, error: gamesError } = await admin
    .from('games')
    .select('id, name, game_memberships(user_id, users(id, name))')
    .eq('gm_id', user.id)
    .order('name');

  if (gamesError) {
    console.error('delete-preview: failed to fetch owned games', gamesError);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }

  // Fetch player memberships with game names
  const { data: membershipRows, error: membershipError } = await admin
    .from('game_memberships')
    .select('game_id, games(id, name)')
    .eq('user_id', user.id);

  if (membershipError) {
    console.error('delete-preview: failed to fetch membership data', membershipError);
    return NextResponse.json({ error: 'Failed to fetch membership data' }, { status: 500 });
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
