import { createAdminClient } from '@/lib/supabase/admin';
import { generateICS } from '@/lib/ics';
import type { Game, GameSession } from '@/types';

/**
 * Public endpoint for calendar subscription feeds.
 * Returns an ICS file with confirmed game sessions.
 * Calendar clients can subscribe to this URL to get automatic updates.
 *
 * URL format: /api/games/calendar/[inviteCode]
 * Webcal URL: webcal://hostname/api/games/calendar/[inviteCode]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  try {
    const { code } = await params;

    if (!code) {
      return new Response('Invite code is required', { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch game by invite code
    const { data: game, error: gameError } = await admin
      .from('games')
      .select('id, name, description, default_start_time, default_end_time')
      .eq('invite_code', code)
      .single();

    if (gameError || !game) {
      return new Response('Game not found', { status: 404 });
    }

    const typedGame = game as Pick<Game, 'id' | 'name' | 'description' | 'default_start_time' | 'default_end_time'>;

    // Fetch confirmed sessions for this game
    const { data: sessions, error: sessionsError } = await admin
      .from('sessions')
      .select('id, date, start_time, end_time, status')
      .eq('game_id', typedGame.id)
      .eq('status', 'confirmed')
      .order('date', { ascending: true });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return new Response('Error fetching sessions', { status: 500 });
    }

    const typedSessions = (sessions || []) as Pick<GameSession, 'id' | 'date' | 'start_time' | 'end_time' | 'status'>[];

    // Convert sessions to calendar events
    const events = typedSessions.map((session) => ({
      date: session.date,
      startTime: session.start_time || typedGame.default_start_time || undefined,
      endTime: session.end_time || typedGame.default_end_time || undefined,
      title: typedGame.name,
      description: typedGame.description || undefined,
    }));

    // Generate ICS content
    const icsContent = generateICS(events);

    // Return ICS file with proper headers for calendar subscription
    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${typedGame.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
        // Cache for 5 minutes to allow calendar clients to refresh
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Calendar feed error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
