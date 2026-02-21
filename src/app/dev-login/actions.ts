'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';

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
};

function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return url.includes('localhost') || url.includes('127.0.0.1');
}

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
  const admin = createAdminClient();

  // Create or find the user
  let userId: string;

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: devUser.email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: devUser.name },
  });

  if (createError) {
    if (createError.message?.includes('already')) {
      // User exists — find them and update password
      const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = existingUsers?.users.find((u) => u.email === devUser.email);
      if (!existing) {
        return { success: false, error: 'User exists but could not be found' };
      }
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password: testPassword });
    } else {
      return { success: false, error: `Failed to create user: ${createError.message}` };
    }
  } else {
    userId = newUser.user!.id;
  }

  // Upsert profile (handles case where public.users row was wiped by db:reset)
  await admin
    .from('users')
    .upsert({ id: userId, email: devUser.email, name: devUser.name, is_gm: devUser.is_gm, is_admin: devUser.is_admin })
    .eq('id', userId);

  // Sign in and set session cookies
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

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: devUser.email,
    password: testPassword,
  });

  if (signInError) {
    return { success: false, error: `Failed to sign in: ${signInError.message}` };
  }

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
