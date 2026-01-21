import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface GameWithEngagement {
  id: string;
  name: string;
  created_at: string;
  gm: { id: string; name: string; email: string } | null;
  playerCount: number;
  sessionCount: number;
  confirmedSessionCount: number;
  availabilityFillRate: number;
  lastActivity: string | null;
}

export async function GET(): Promise<Response> {
  try {
    // Verify the user is authenticated and is an admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use admin client to check if user is admin and fetch data
    const admin = createAdminClient();

    // Check if user is admin
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all games with GM info
    const { data: games, error: gamesError } = await admin
      .from('games')
      .select('id, name, created_at, play_days, scheduling_window_months, gm_id, gm:users!games_gm_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (gamesError) {
      throw gamesError;
    }

    // Fetch all memberships, sessions, and availability
    const [membershipsResult, sessionsResult, availabilityResult] = await Promise.all([
      admin.from('game_memberships').select('game_id, user_id'),
      admin.from('sessions').select('game_id, status, created_at'),
      admin.from('availability').select('game_id, user_id, updated_at'),
    ]);

    // Build lookup maps
    const membershipsByGame = new Map<string, Set<string>>();
    membershipsResult.data?.forEach((m) => {
      if (!membershipsByGame.has(m.game_id)) {
        membershipsByGame.set(m.game_id, new Set());
      }
      membershipsByGame.get(m.game_id)!.add(m.user_id);
    });

    const sessionsByGame = new Map<string, { total: number; confirmed: number; lastActivity: string | null }>();
    sessionsResult.data?.forEach((s) => {
      if (!sessionsByGame.has(s.game_id)) {
        sessionsByGame.set(s.game_id, { total: 0, confirmed: 0, lastActivity: null });
      }
      const stats = sessionsByGame.get(s.game_id)!;
      stats.total++;
      if (s.status === 'confirmed') stats.confirmed++;
      if (!stats.lastActivity || s.created_at > stats.lastActivity) {
        stats.lastActivity = s.created_at;
      }
    });

    const availabilityByGame = new Map<string, { users: Set<string>; lastActivity: string | null }>();
    availabilityResult.data?.forEach((a) => {
      if (!availabilityByGame.has(a.game_id)) {
        availabilityByGame.set(a.game_id, { users: new Set(), lastActivity: null });
      }
      const stats = availabilityByGame.get(a.game_id)!;
      stats.users.add(a.user_id);
      if (!stats.lastActivity || a.updated_at > stats.lastActivity) {
        stats.lastActivity = a.updated_at;
      }
    });

    // Build game list with engagement metrics
    const gamesWithEngagement: GameWithEngagement[] = (games ?? []).map((game) => {
      const members = membershipsByGame.get(game.id) ?? new Set();
      const totalPlayers = members.size + 1; // +1 for GM
      const sessionStats = sessionsByGame.get(game.id) ?? { total: 0, confirmed: 0, lastActivity: null };
      const availabilityStats = availabilityByGame.get(game.id) ?? { users: new Set(), lastActivity: null };

      // Fill rate: % of CURRENT players who have submitted any availability
      // Only count availability from current members (not players who left)
      const currentPlayerIds = new Set([...members, game.gm_id]);
      const currentPlayersWithAvailability = [...availabilityStats.users].filter(
        (userId) => currentPlayerIds.has(userId)
      ).length;
      const fillRate = totalPlayers > 0 ? Math.round((currentPlayersWithAvailability / totalPlayers) * 100) : 0;

      // Last activity: most recent of session or availability activity
      let lastActivity: string | null = null;
      if (sessionStats.lastActivity && availabilityStats.lastActivity) {
        lastActivity = sessionStats.lastActivity > availabilityStats.lastActivity
          ? sessionStats.lastActivity
          : availabilityStats.lastActivity;
      } else {
        lastActivity = sessionStats.lastActivity || availabilityStats.lastActivity;
      }

      // Handle gm field which may be an object or array from Supabase
      const gmData = game.gm;
      const gm = Array.isArray(gmData) ? gmData[0] ?? null : gmData;

      return {
        id: game.id,
        name: game.name,
        created_at: game.created_at,
        gm: gm as GameWithEngagement['gm'],
        playerCount: totalPlayers,
        sessionCount: sessionStats.total,
        confirmedSessionCount: sessionStats.confirmed,
        availabilityFillRate: fillRate,
        lastActivity,
      };
    });

    return NextResponse.json({ games: gamesWithEngagement });
  } catch (error) {
    console.error('Admin games error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
