import { NextResponse } from 'next/server';
import { requireAdmin, paginate } from '@/lib/api/admin';
import { computeTopUsers, type TopUserProfile } from '@/lib/admin';
import { getCachedPlatformInputs } from '@/lib/admin/platformStatsStore';
import { serverError } from '@/lib/apiError';

export async function GET(): Promise<Response> {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;
    const { admin } = result;

    // The big tables (memberships, sessions, availability) come from the shared
    // read the Overview tab already made; only names and avatars are read here.
    const [users, games, inputs] = await Promise.all([
      paginate<TopUserProfile>(admin, 'users', 'id, name, email, avatar_url'),
      paginate<{ id: string; gm_id: string; name: string }>(admin, 'games', 'id, gm_id, name'),
      getCachedPlatformInputs(admin),
    ]);
    const { memberships, sessions, availability } = inputs;

    return NextResponse.json(
      computeTopUsers({ users, games, memberships, sessions, availability })
    );
  } catch (error) {
    return serverError(error, { route: '/api/admin/top-users' });
  }
}
