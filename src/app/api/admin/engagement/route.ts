import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { startOfWeek, subWeeks, format } from 'date-fns';

const PAGE_SIZE = 1000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const VALID_WEEKS = [8, 12, 26] as const;

// Simple in-memory cache keyed by weeks param
const cache = new Map<string, { data: unknown; timestamp: number }>();

interface WeekBucket {
  week: string; // ISO date string for the Monday of that week
  newUsers: number;
  newGames: number;
  sessionsConfirmed: number;
  activeUsers: number;
}

export async function GET(request: NextRequest): Promise<Response> {
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

    // Parse weeks param
    const weeksParam = request.nextUrl.searchParams.get('weeks');
    const weeks = weeksParam === 'all'
      ? null
      : VALID_WEEKS.includes(Number(weeksParam) as typeof VALID_WEEKS[number])
        ? Number(weeksParam)
        : 12;

    // Check cache
    const cacheKey = String(weeks ?? 'all');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const cutoffDate = weeks
      ? format(subWeeks(currentWeekStart, weeks), 'yyyy-MM-dd')
      : null;

    // Fetch raw data with optional date cutoff
    async function fetchAllRows<T>(table: string, columns: string, dateColumn?: string): Promise<T[]> {
      const all: T[] = [];
      let offset = 0;
      for (;;) {
        let query = admin.from(table).select(columns);
        if (cutoffDate && dateColumn) {
          query = query.gte(dateColumn, cutoffDate);
        }
        const { data } = await query.range(offset, offset + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        all.push(...(data as T[]));
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return all;
    }

    const [users, games, sessions, availability] = await Promise.all([
      fetchAllRows<{ created_at: string }>('users', 'created_at', 'created_at'),
      fetchAllRows<{ created_at: string }>('games', 'created_at', 'created_at'),
      fetchAllRows<{ created_at: string; status: string }>('sessions', 'created_at, status', 'created_at'),
      fetchAllRows<{ user_id: string; updated_at: string }>('availability', 'user_id, updated_at', 'updated_at'),
    ]);

    // Build week buckets
    const bucketMap = new Map<string, WeekBucket>();

    function getWeekKey(dateStr: string): string {
      const weekStart = startOfWeek(new Date(dateStr), { weekStartsOn: 1 });
      return format(weekStart, 'yyyy-MM-dd');
    }

    function ensureBucket(weekKey: string): WeekBucket {
      if (!bucketMap.has(weekKey)) {
        bucketMap.set(weekKey, {
          week: weekKey,
          newUsers: 0,
          newGames: 0,
          sessionsConfirmed: 0,
          activeUsers: 0,
        });
      }
      return bucketMap.get(weekKey)!;
    }

    // Bucket users
    for (const u of users) {
      ensureBucket(getWeekKey(u.created_at)).newUsers++;
    }

    // Bucket games
    for (const g of games) {
      ensureBucket(getWeekKey(g.created_at)).newGames++;
    }

    // Bucket sessions (only confirmed)
    for (const s of sessions) {
      if (s.status === 'confirmed') {
        ensureBucket(getWeekKey(s.created_at)).sessionsConfirmed++;
      }
    }

    // Bucket active users (distinct per week)
    const activeUsersByWeek = new Map<string, Set<string>>();
    for (const a of availability) {
      const weekKey = getWeekKey(a.updated_at);
      if (!activeUsersByWeek.has(weekKey)) {
        activeUsersByWeek.set(weekKey, new Set());
      }
      activeUsersByWeek.get(weekKey)!.add(a.user_id);
    }
    for (const [weekKey, userSet] of activeUsersByWeek) {
      ensureBucket(weekKey).activeUsers = userSet.size;
    }

    // Sort buckets chronologically
    const weeklyData = [...bucketMap.values()].sort((a, b) =>
      a.week.localeCompare(b.week)
    );

    const responseData = { weeklyData };
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Admin engagement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
