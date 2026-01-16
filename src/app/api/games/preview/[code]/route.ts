import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Public endpoint for OG crawlers to fetch game preview data.
 * No authentication required - returns only public-safe information.
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

    const admin = createAdminClient();

    const { data: game, error: gameError } = await admin
      .from('games')
      .select('name, description, play_days, gm:users!games_gm_id_fkey(name)')
      .eq('invite_code', code)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // The gm relation returns an object (single FK relation)
    const gm = game.gm as unknown as { name: string } | null;

    return NextResponse.json({
      name: game.name,
      description: game.description,
      play_days: game.play_days,
      gm_name: gm?.name || 'Unknown',
    });
  } catch (error) {
    console.error('Preview lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
