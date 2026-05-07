import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/admin';

export async function GET(): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const [
      usersResult,
      gamesResult,
      sessionsResult,
      recentUsersResult,
      recentGamesResult,
    ] = await Promise.all([
      admin.from('users').select('id', { count: 'exact', head: true }),
      admin.from('games').select('id', { count: 'exact', head: true }),
      admin.from('sessions').select('id', { count: 'exact', head: true }),
      admin.from('users').select('id, name, email, avatar_url, is_gm, is_admin, created_at').order('created_at', { ascending: false }).limit(10),
      admin.from('games').select('id, name, created_at, gm:users!games_gm_id_fkey(name)').order('created_at', { ascending: false }).limit(10),
    ]);

    return NextResponse.json({
      totalUsers: usersResult.count ?? 0,
      totalGames: gamesResult.count ?? 0,
      totalSessions: sessionsResult.count ?? 0,
      recentUsers: recentUsersResult.data ?? [],
      recentGames: recentGamesResult.data ?? [],
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
