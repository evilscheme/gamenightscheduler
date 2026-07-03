import { NextResponse } from 'next/server';
import { requireAdmin, paginate } from '@/lib/api/admin';
import { computeTopUsers, type TopUserProfile } from '@/lib/topUsers';
import { serverError } from '@/lib/apiError';

export async function GET(): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    const [users, games, memberships, sessions, availability] = await Promise.all([
      paginate<TopUserProfile>(admin, 'users', 'id, name, email, avatar_url'),
      paginate<{ id: string; gm_id: string; name: string }>(admin, 'games', 'id, gm_id, name'),
      paginate<{ game_id: string; user_id: string }>(admin, 'game_memberships', 'game_id, user_id'),
      paginate<{ game_id: string; date: string }>(admin, 'sessions', 'game_id, date'),
      paginate<{ user_id: string }>(admin, 'availability', 'user_id'),
    ]);

    return NextResponse.json(
      computeTopUsers({ users, games, memberships, sessions, availability })
    );
  } catch (error) {
    return serverError(error, { route: '/api/admin/top-users' });
  }
}
