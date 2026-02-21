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

export interface DeletePreview {
  ownedGames: OwnedGame[];
  playerMembershipCount: number;
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

  // Count player memberships in games the user doesn't own
  const { count: membershipCount, error: membershipError } = await admin
    .from('game_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (membershipError) {
    console.error('delete-preview: failed to fetch membership count', membershipError);
    return NextResponse.json({ error: 'Failed to fetch membership data' }, { status: 500 });
  }

  const preview: DeletePreview = {
    ownedGames: (ownedGames ?? []).map((game) => ({
      id: game.id,
      name: game.name,
      members: (game.game_memberships ?? []).map((m) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users;
        return { id: m.user_id, name: (u as { id: string; name: string } | null)?.name ?? 'Unknown' };
      }),
    })),
    playerMembershipCount: membershipCount ?? 0,
  };

  return NextResponse.json(preview);
}
