import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Debug endpoint to check auth state.
 * DELETE THIS AFTER DEBUGGING.
 */
export async function GET(): Promise<Response> {
  try {
    const supabase = await createClient();

    // Get the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    // Try to call the debug RPC if it exists
    let rlsAuthUid = null;
    try {
      const { data } = await supabase.rpc('debug_auth_uid');
      rlsAuthUid = data;
    } catch {
      rlsAuthUid = 'debug_auth_uid function not found';
    }

    // Get profile if user exists
    let profile = null;
    if (user?.id) {
      const { data } = await supabase.from('users').select('id, email, name').eq('id', user.id).single();
      profile = data;
    }

    return NextResponse.json({
      session: session ? {
        user_id: session.user?.id,
        email: session.user?.email,
        expires_at: session.expires_at,
      } : null,
      sessionError: sessionError?.message,
      user: user ? {
        id: user.id,
        email: user.email,
      } : null,
      userError: userError?.message,
      rlsAuthUid,
      profile,
      // This is what we're sending as gm_id
      profileIdMatchesUserId: profile?.id === user?.id,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
