import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Fetches game details by invite code.
 * Uses admin client to bypass RLS since users need to see game details
 * before joining (when they're not yet members).
 *
 * Requires authentication - returns 401 if not logged in.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }

    // Verify the user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS and fetch game by invite code
    const admin = createAdminClient();

    const { data: game, error: gameError } = await admin
      .from('games')
      .select('id, name, description, gm_id, play_days, gm:users!games_gm_id_fkey(id, name, avatar_url)')
      .eq('invite_code', code)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member or GM
    let isMember = false;
    let isGm = game.gm_id === user.id;

    if (!isGm) {
      const { data: membership } = await admin
        .from('game_memberships')
        .select('id')
        .eq('game_id', game.id)
        .eq('user_id', user.id)
        .single();

      isMember = !!membership;
    }

    return NextResponse.json({
      game: {
        id: game.id,
        name: game.name,
        description: game.description,
        play_days: game.play_days,
        gm: game.gm,
      },
      isMember: isMember || isGm,
    });
  } catch (error) {
    console.error('Invite lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
