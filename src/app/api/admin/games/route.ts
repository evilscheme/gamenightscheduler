import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePlayerCompletionPercentages } from '@/lib/availability';

const PAGE_SIZE = 1000;

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
      .select('id, name, created_at, play_days, scheduling_window_months, special_play_dates, gm_id, gm:users!games_gm_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (gamesError) {
      throw gamesError;
    }

    // Fetch all memberships, sessions, and availability
    // Paginate to avoid Supabase's default 1000-row limit silently truncating results
    async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
      const all: T[] = [];
      let offset = 0;
      for (;;) {
        const { data } = await admin.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        all.push(...(data as T[]));
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return all;
    }

    const [memberships, sessions, availabilityRecords] = await Promise.all([
      fetchAllRows<{ game_id: string; user_id: string }>('game_memberships', 'game_id, user_id'),
      fetchAllRows<{ game_id: string; status: string; created_at: string }>('sessions', 'game_id, status, created_at'),
      fetchAllRows<{ game_id: string; user_id: string; date: string; updated_at: string }>('availability', 'game_id, user_id, date, updated_at'),
    ]);

    // Build lookup maps
    const membershipsByGame = new Map<string, Set<string>>();
    for (const m of memberships) {
      if (!membershipsByGame.has(m.game_id)) {
        membershipsByGame.set(m.game_id, new Set());
      }
      membershipsByGame.get(m.game_id)!.add(m.user_id);
    }

    const sessionsByGame = new Map<string, { total: number; confirmed: number; lastActivity: string | null }>();
    for (const s of sessions) {
      if (!sessionsByGame.has(s.game_id)) {
        sessionsByGame.set(s.game_id, { total: 0, confirmed: 0, lastActivity: null });
      }
      const stats = sessionsByGame.get(s.game_id)!;
      stats.total++;
      if (s.status === 'confirmed') stats.confirmed++;
      if (!stats.lastActivity || s.created_at > stats.lastActivity) {
        stats.lastActivity = s.created_at;
      }
    }

    const availabilityByGame = new Map<string, { records: Array<{ user_id: string; date: string }>; lastActivity: string | null }>();
    for (const a of availabilityRecords) {
      if (!availabilityByGame.has(a.game_id)) {
        availabilityByGame.set(a.game_id, { records: [], lastActivity: null });
      }
      const stats = availabilityByGame.get(a.game_id)!;
      stats.records.push({ user_id: a.user_id, date: a.date });
      if (!stats.lastActivity || a.updated_at > stats.lastActivity) {
        stats.lastActivity = a.updated_at;
      }
    }

    // Build game list with engagement metrics
    const gamesWithEngagement: GameWithEngagement[] = (games ?? []).map((game) => {
      const members = membershipsByGame.get(game.id) ?? new Set();
      const totalPlayers = members.size + 1; // +1 for GM
      const sessionStats = sessionsByGame.get(game.id) ?? { total: 0, confirmed: 0, lastActivity: null };
      const availabilityStats = availabilityByGame.get(game.id) ?? { records: [], lastActivity: null };

      // Fill rate: average completion percentage across all current players
      // Each player's rate = (dates they've filled in) / (total play dates in window)
      const currentPlayerIds = [...members, game.gm_id];
      const currentPlayerRecords = availabilityStats.records.filter(
        (r) => currentPlayerIds.includes(r.user_id)
      );
      const completionPercentages = calculatePlayerCompletionPercentages({
        playerIds: currentPlayerIds,
        playDays: game.play_days ?? [],
        schedulingWindowMonths: game.scheduling_window_months ?? 2,
        specialPlayDates: (game.special_play_dates ?? []).map((d: string) => d.substring(0, 10)),
        availabilityRecords: currentPlayerRecords,
      });
      const percentageValues = Object.values(completionPercentages);
      const fillRate = percentageValues.length > 0
        ? Math.round(percentageValues.reduce((sum, p) => sum + p, 0) / percentageValues.length)
        : 0;

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
