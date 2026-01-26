import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GameWithGMNameResult } from '@/types';

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

    // TypeScript infers FK relations as arrays, but at runtime Supabase
    // returns single objects for one-to-one relations
    const typedGame = game as unknown as GameWithGMNameResult;

    return NextResponse.json({
      name: typedGame.name,
      description: typedGame.description,
      play_days: typedGame.play_days,
      gm_name: typedGame.gm?.name || 'Unknown',
    });
  } catch (error) {
    console.error('Preview lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
