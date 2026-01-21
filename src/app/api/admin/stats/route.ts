import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Use admin client to check if user is admin and fetch stats
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

    // Fetch all stats in parallel
    const [
      usersResult,
      gamesResult,
      sessionsResult,
      recentUsersResult,
      recentGamesResult,
    ] = await Promise.all([
      admin.from('users').select('id', { count: 'exact', head: true }),
      admin.from('games').select('id', { count: 'exact', head: true }),
      admin.from('sessions').select('status'),
      admin.from('users').select('id, name, email, avatar_url, is_gm, is_admin, created_at').order('created_at', { ascending: false }).limit(10),
      admin.from('games').select('id, name, created_at, gm:users!games_gm_id_fkey(name)').order('created_at', { ascending: false }).limit(10),
    ]);

    // Count sessions by status
    const sessionsByStatus = {
      suggested: 0,
      confirmed: 0,
      cancelled: 0,
    };
    sessionsResult.data?.forEach((session) => {
      if (session.status in sessionsByStatus) {
        sessionsByStatus[session.status as keyof typeof sessionsByStatus]++;
      }
    });

    return NextResponse.json({
      totalUsers: usersResult.count ?? 0,
      totalGames: gamesResult.count ?? 0,
      totalSessions: sessionsResult.data?.length ?? 0,
      sessionsByStatus,
      recentUsers: recentUsersResult.data ?? [],
      recentGames: recentGamesResult.data ?? [],
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
