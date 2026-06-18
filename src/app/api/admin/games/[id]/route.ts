import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/admin';
import {
  fetchGameWithGM,
  fetchGameMembers,
  fetchAllAvailability,
  fetchGameSessions,
  fetchGamePlayDates,
} from '@/lib/data';

/**
 * Read-only snapshot of a game for the admin peek view. Uses the service-role
 * client because the admin is typically not a participant, so RLS would hide
 * the game from a normal client. Returns the same shapes the game detail UI
 * consumes (GameWithMembers, Availability[], GameSession[], GamePlayDate[]).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const { id } = await params;

    const { data: game, error: gameError } = await fetchGameWithGM(admin, id);
    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const [membersRes, availabilityRes, sessionsRes, playDatesRes] = await Promise.all([
      fetchGameMembers(admin, id),
      fetchAllAvailability(admin, id),
      fetchGameSessions(admin, id),
      fetchGamePlayDates(admin, id),
    ]);

    return NextResponse.json({
      game: { ...game, members: membersRes.data },
      availability: availabilityRes.data ?? [],
      sessions: sessionsRes.data ?? [],
      playDates: playDatesRes.data ?? [],
    });
  } catch (error) {
    console.error('Admin game snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
