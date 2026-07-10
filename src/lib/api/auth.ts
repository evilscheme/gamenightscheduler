import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Verifies the request is from an authenticated user.
 * Returns either the user (on success) or a NextResponse (on failure).
 *
 * Usage:
 *   const result = await requireUser();
 *   if (result instanceof NextResponse) return result;
 *   const { user } = result;
 */
export async function requireUser(): Promise<{ user: User } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  return { user };
}
