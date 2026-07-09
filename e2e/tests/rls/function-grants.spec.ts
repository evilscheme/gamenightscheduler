import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// Every SECURITY DEFINER helper reachable via PostgREST RPC, with its argument
// signature. anon must hold NO EXECUTE on any of them; authenticated must.
const HELPERS: Array<[string, string]> = [
  ['count_game_players', 'uuid'],
  ['count_future_sessions', 'uuid'],
  ['count_user_games', 'uuid'],
  ['game_today', 'uuid'],
  ['is_game_participant', 'uuid, uuid'],
  ['is_game_gm_or_co_gm', 'uuid, uuid'],
  ['is_membership_co_gm', 'uuid, uuid'],
  ['shares_game_with', 'uuid'],
  ['join_game_by_invite', 'text'],
];

/**
 * The blanket `GRANT EXECUTE ON ALL FUNCTIONS ... TO anon` used to re-expose
 * the SECURITY DEFINER "oracle" helpers (and join_game_by_invite) to
 * unauthenticated callers via PostgREST RPC. anon must NOT be able to call them.
 */
test.describe('Function EXECUTE grants — anon lockdown', () => {
  const ANON_HEADERS = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };

  for (const fn of ['count_game_players', 'count_future_sessions']) {
    test(`anon cannot RPC ${fn}`, async ({ request }) => {
      const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        headers: ANON_HEADERS,
        data: { game_id_param: '00000000-0000-0000-0000-000000000000' },
      });
      // PostgREST returns 404 (not in exposed schema for this role) or 403.
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  }

  // NOTE: a behavioral REST probe of join_game_by_invite is NOT a reliable grant
  // check on its own — the function has an internal `RAISE EXCEPTION 'Not
  // authenticated'` guard, so anon gets a 4xx even if the EXECUTE grant regressed.
  // The authoritative, function-internals-independent check is the ACL test below.
  test('anon cannot RPC join_game_by_invite (behavioral smoke)', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/join_game_by_invite`, {
      headers: ANON_HEADERS,
      data: { invite_code_param: 'AAAAAAAAAA' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  // Authoritative lockdown check: query the ACL directly. This does not depend on
  // any function's internal guards or on PostgREST's error-code choices, so it
  // cannot false-pass the way the REST probes can — anon must have NO EXECUTE and
  // authenticated must have EXECUTE on every helper, including join_game_by_invite.
  test('anon holds no EXECUTE and authenticated holds EXECUTE on every helper (ACL)', () => {
    const projection = HELPERS.map(
      ([name, args]) =>
        `has_function_privilege('anon','public.${name}(${args})','EXECUTE') AS anon_${name}, ` +
        `has_function_privilege('authenticated','public.${name}(${args})','EXECUTE') AS auth_${name}`
    ).join(', ');
    const out = execSync(`psql "${DB_URL}" -tAc "SELECT ${projection};"`, {
      encoding: 'utf8',
    }).trim();
    const vals = out.split('|').map((v) => v.trim());
    expect(vals).toHaveLength(HELPERS.length * 2);
    HELPERS.forEach(([name], i) => {
      expect(vals[i * 2], `anon must NOT hold EXECUTE on ${name}`).toBe('f');
      expect(vals[i * 2 + 1], `authenticated must hold EXECUTE on ${name}`).toBe('t');
    });
  });
});

// SECURITY DEFINER functions that exist ONLY as triggers. A trigger fires via the
// table's trigger machinery, which does NOT check the invoking role's EXECUTE
// grant, so these need no grant to any client role. The blanket
// `GRANT EXECUTE ON ALL FUNCTIONS ... TO authenticated` swept them up anyway,
// leaving them listed as authenticated-callable SECURITY DEFINER RPCs (Supabase
// advisor lint 0029) for zero functional benefit. Revoking the grant removes
// them from the /rest/v1/rpc surface without affecting the triggers.
const TRIGGER_FUNCTIONS: string[] = [
  'handle_new_user',
  'protect_user_columns',
  'protect_game_gm_id',
];

test.describe('Trigger-function EXECUTE lockdown', () => {
  // Authoritative ACL check (same rationale as the helper test above: a REST
  // probe cannot verify this — PostgREST does not route trigger-returning
  // functions as RPCs at all). Neither anon NOR authenticated should hold
  // EXECUTE on a trigger-only function.
  test('no client role holds EXECUTE on any trigger-only function (ACL)', () => {
    const projection = TRIGGER_FUNCTIONS.map(
      (name) =>
        `has_function_privilege('anon','public.${name}()','EXECUTE') AS anon_${name}, ` +
        `has_function_privilege('authenticated','public.${name}()','EXECUTE') AS auth_${name}`
    ).join(', ');
    const out = execSync(`psql "${DB_URL}" -tAc "SELECT ${projection};"`, {
      encoding: 'utf8',
    }).trim();
    const vals = out.split('|').map((v) => v.trim());
    expect(vals).toHaveLength(TRIGGER_FUNCTIONS.length * 2);
    TRIGGER_FUNCTIONS.forEach((name, i) => {
      expect(vals[i * 2], `anon must NOT hold EXECUTE on ${name}`).toBe('f');
      expect(vals[i * 2 + 1], `authenticated must NOT hold EXECUTE on ${name}`).toBe('f');
    });
  });
});
