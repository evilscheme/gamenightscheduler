import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// For server-side operations that need to bypass RLS
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

const USERS_PAGE_SIZE = 1000;

/** Any client with the auth admin API — scripts build theirs without the Database type. */
type AuthAdminClient = { auth: { admin: Pick<SupabaseClient['auth']['admin'], 'listUsers'> } };

/**
 * Every auth user, a page at a time. The admin API has no email filter and pages
 * its results, so code that reads only one page silently misses everyone past
 * it — local databases that accumulate test users cross 1000 quickly, and prod
 * is past it. Throws on API errors rather than letting them read as "no users".
 */
async function* authUserPages(client: AuthAdminClient) {
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) throw error;
    yield data.users;
    if (data.users.length < USERS_PAGE_SIZE) return;
  }
}

/** The auth user with this email, or null. Stops at the first page that has them. */
export async function findAuthUserByEmail(client: AuthAdminClient, email: string) {
  for await (const users of authUserPages(client)) {
    const user = users.find((u) => u.email === email);
    if (user) return user;
  }
  return null;
}

/** Every auth user. Read them all before deleting any: deleting mid-scan shifts the pages. */
export async function listAllAuthUsers(client: AuthAdminClient) {
  const all = [];
  for await (const users of authUserPages(client)) all.push(...users);
  return all;
}
