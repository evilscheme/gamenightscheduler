import { NextResponse } from 'next/server';
import { requireAdmin, paginate } from '@/lib/api/admin';
import { calculateGameFillRate } from '@/lib/availability';
import { calculateGameHealth, type HealthBreakdown, type HealthGrade } from '@/lib/gameHealth';
import { serverError } from '@/lib/apiError';

interface GameWithEngagement {
  id: string;
  name: string;
  created_at: string;
  gm: { id: string; name: string; email: string } | null;
  playerCount: number;
  sessionCount: number;
  futureSessionCount: number;
  availabilityFillRate: number;
  lastActivity: string | null;
  healthScore: number;
  healthGrade: HealthGrade;
  healthLabel: string;
  healthBreakdown: HealthBreakdown;
}

export async function GET(): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const { data: games, error: gamesError } = await admin
      .from('games')
      .select('id, name, created_at, play_days, scheduling_window_months, campaign_start_date, campaign_end_date, gm_id, gm:users!games_gm_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (gamesError) {
      throw gamesError;
    }

    const [memberships, sessions, availabilityRecords, gamePlayDates] = await Promise.all([
      paginate<{ game_id: string; user_id: string }>(admin, 'game_memberships', 'game_id, user_id'),
      paginate<{ game_id: string; created_at: string; date: string }>(admin, 'sessions', 'game_id, created_at, date'),
      paginate<{ game_id: string; user_id: string; date: string; updated_at: string }>(admin, 'availability', 'game_id, user_id, date, updated_at'),
      paginate<{ game_id: string; date: string }>(admin, 'game_play_dates', 'game_id, date'),
    ]);

    // Build lookup maps
    const membershipsByGame = new Map<string, Set<string>>();
    for (const m of memberships) {
      if (!membershipsByGame.has(m.game_id)) {
        membershipsByGame.set(m.game_id, new Set());
      }
      membershipsByGame.get(m.game_id)!.add(m.user_id);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const sessionsByGame = new Map<string, { total: number; future: number; lastActivity: string | null }>();
    for (const s of sessions) {
      if (!sessionsByGame.has(s.game_id)) {
        sessionsByGame.set(s.game_id, { total: 0, future: 0, lastActivity: null });
      }
      const stats = sessionsByGame.get(s.game_id)!;
      stats.total++;
      if (s.date >= todayStr) stats.future++;
      if (!stats.lastActivity || s.created_at > stats.lastActivity) {
        stats.lastActivity = s.created_at;
      }
    }

    const playDatesByGame = new Map<string, string[]>();
    for (const pd of gamePlayDates) {
      if (!playDatesByGame.has(pd.game_id)) {
        playDatesByGame.set(pd.game_id, []);
      }
      playDatesByGame.get(pd.game_id)!.push(pd.date.substring(0, 10));
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
      const sessionStats = sessionsByGame.get(game.id) ?? { total: 0, future: 0, lastActivity: null };
      const availabilityStats = availabilityByGame.get(game.id) ?? { records: [], lastActivity: null };

      // Fill rate: average completion percentage across all current players.
      // Each player's rate = (dates they've filled in) / (total play dates in
      // the campaign-bounded scheduling window).
      const currentPlayerIds = [...members, game.gm_id];
      const currentPlayerRecords = availabilityStats.records.filter(
        (r) => currentPlayerIds.includes(r.user_id)
      );
      const allSpecialDates = playDatesByGame.get(game.id) ?? [];

      const fillRate = calculateGameFillRate({
        playerIds: currentPlayerIds,
        playDays: game.play_days ?? [],
        schedulingWindowMonths: game.scheduling_window_months ?? 2,
        campaignStartDate: game.campaign_start_date ?? null,
        campaignEndDate: game.campaign_end_date ?? null,
        extraPlayDates: allSpecialDates,
        availabilityRecords: currentPlayerRecords,
      });

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

      // Calculate health score
      const health = calculateGameHealth({
        playerCount: totalPlayers,
        futureSessionCount: sessionStats.future,
        availabilityFillRate: fillRate,
        lastActivity,
        createdAt: game.created_at,
      });

      return {
        id: game.id,
        name: game.name,
        created_at: game.created_at,
        gm: gm as GameWithEngagement['gm'],
        playerCount: totalPlayers,
        sessionCount: sessionStats.total,
        futureSessionCount: sessionStats.future,
        availabilityFillRate: fillRate,
        lastActivity,
        healthScore: health.score,
        healthGrade: health.grade,
        healthLabel: health.label,
        healthBreakdown: health.breakdown,
      };
    });

    return NextResponse.json({ games: gamesWithEngagement });
  } catch (error) {
    return serverError(error, { route: '/api/admin/games' });
  }
}
