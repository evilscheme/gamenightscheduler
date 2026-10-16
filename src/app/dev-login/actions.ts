'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient, findAuthUserByEmail } from '@/lib/supabase/admin';
import { isLocalSupabase } from '@/lib/supabase/env';

interface DevUser {
  email: string;
  name: string;
  is_gm: boolean;
  is_admin: boolean;
}

const DEV_USERS: Record<string, DevUser> = {
  gm: { email: 'dev-gm@dev.local', name: 'Dev GM', is_gm: true, is_admin: false },
  player1: { email: 'dev-player1@dev.local', name: 'Dev Player 1', is_gm: true, is_admin: false },
  player2: { email: 'dev-player2@dev.local', name: 'Dev Player 2', is_gm: true, is_admin: false },
  admin: { email: 'dev-admin@dev.local', name: 'Dev Admin', is_gm: true, is_admin: true },
  // Themed DM host for marketing screenshots; owns the seeded "Curse of Strahd" showcase game
  // (see scripts/seed-showcase.ts). Name must match the seeded account so login re-upserts the same name.
  showcase: { email: 'dev-showcase@dev.local', name: 'Withers', is_gm: true, is_admin: false },
};

export async function loginAsDevUser(persona: string): Promise<{ success: boolean; error?: string; user?: DevUser }> {
  if (process.env.NODE_ENV !== 'development') {
    return { success: false, error: 'Dev login is only available in development' };
  }

  if (!isLocalSupabase()) {
    return { success: false, error: 'Dev login only works with local Supabase (localhost). Use npm run dev:local.' };
  }

  const devUser = DEV_USERS[persona];
  if (!devUser) {
    return { success: false, error: 'Unknown persona' };
  }

  const testPassword = 'dev-password-123!';
  const credentials = { email: devUser.email, password: testPassword };
  const admin = createAdminClient();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Try the known password first. Setting it unconditionally (as this used to)
  // revoked every session the persona had — GoTrue deletes them on any admin
  // password change, even to the same value — so each login signed out every
  // other browser, tab or Playwright context logged in as the same persona.
  let { data: signIn, error: signInError } = await supabase.auth.signInWithPassword(credentials);

  if (signInError) {
    // No such user yet, or one created elsewhere with a different password.
    const { error: createError } = await admin.auth.admin.createUser({
      ...credentials,
      email_confirm: true,
      user_metadata: { full_name: devUser.name },
    });

    if (createError) {
      if (!createError.message?.includes('already')) {
        return { success: false, error: `Failed to create user: ${createError.message}` };
      }
      // Exists with another password — reset it. The only path that revokes sessions.
      const existing = await findAuthUserByEmail(admin, devUser.email);
      if (!existing) {
        return { success: false, error: 'User exists but could not be found' };
      }
      await admin.auth.admin.updateUserById(existing.id, { password: testPassword });
    }

    ({ data: signIn, error: signInError } = await supabase.auth.signInWithPassword(credentials));
    if (signInError) {
      return { success: false, error: `Failed to sign in: ${signInError.message}` };
    }
  }

  // Upsert profile (handles case where public.users row was wiped by db:reset)
  const userId = signIn.user!.id;
  await admin
    .from('users')
    .upsert({ id: userId, email: devUser.email, name: devUser.name, is_gm: devUser.is_gm, is_admin: devUser.is_admin })
    .eq('id', userId);

  return { success: true, user: devUser };
}

export async function signOutDevUser(): Promise<{ success: boolean; error?: string }> {
  if (process.env.NODE_ENV !== 'development') {
    return { success: false, error: 'Dev login is only available in development' };
  }

  if (!isLocalSupabase()) {
    return { success: false, error: 'Dev login only works with local Supabase (localhost). Use npm run dev:local.' };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();
  return { success: true };
}
