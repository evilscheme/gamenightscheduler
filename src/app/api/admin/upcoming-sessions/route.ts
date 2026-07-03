import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, paginate } from '@/lib/api/admin';
import {
  buildUpcomingSessionRows,
  getTodayLocalDate,
  getUpcomingQueryFloor,
  type GameDisplayInfo,
} from '@/lib/upcomingSessions';
import { paginateArray } from '@/lib/pagination';
import { serverError } from '@/lib/apiError';
import type { GameSession, AdminUpcomingSessionRow } from '@/types';

// Rows per page for the "Upcoming Games" admin table.
const PAGE_SIZE = 20;

interface GameWithGmNameRow {
  id: string;
  name: string;
  timezone: string | null;
  gm: { name: string } | null;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const pageParam = Number(request.nextUrl.searchParams.get('page'));
    const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

    const nowMs = Date.now();
    const today = getTodayLocalDate();
    // Two-day buffer covers the full UTC-12..UTC+14 span; buildUpcomingSessionRows
    // then trims precisely against each game's own timezone (see DashboardContent).
    const floor = getUpcomingQueryFloor(nowMs);

    const [sessions, games] = await Promise.all([
      paginate<GameSession>(admin, 'sessions', '*', { dateColumn: 'date', cutoff: floor }),
      paginate<GameWithGmNameRow>(
        admin,
        'games',
        'id, name, timezone, gm:users!games_gm_id_fkey(name)'
      ),
    ]);

    const gameInfo = new Map<string, GameDisplayInfo & { gmName: string }>(
      games.map((g) => [
        g.id,
        { name: g.name, timezone: g.timezone, gmName: g.gm?.name ?? 'Unknown' },
      ])
    );

    const rows: AdminUpcomingSessionRow[] = buildUpcomingSessionRows(
      sessions,
      gameInfo,
      today,
      nowMs
    ).map((row) => ({
      ...row,
      gmName: gameInfo.get(row.gameId)?.gmName ?? 'Unknown',
    }));

    const { items, pageSize, total, totalPages } = paginateArray(rows, page, PAGE_SIZE);

    return NextResponse.json({
      sessions: items,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    return serverError(error, { route: '/api/admin/upcoming-sessions' });
  }
}
