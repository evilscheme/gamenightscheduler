import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// Identity/participation helpers are evaluated per-row in SELECT/UPDATE/DELETE
// USING clauses over multi-row scans. Their boolean answer does not depend on
// rows being inserted in the same statement, so STABLE is both a real
// performance win (evaluate once per game_id instead of once per row) and safe.
const STABLE_HELPERS = [
  'is_game_participant',
  'is_game_gm_or_co_gm',
  'is_membership_co_gm',
  'shares_game_with',
];

// Count-based limit helpers are used in INSERT ... WITH CHECK cap guards. They
// MUST stay VOLATILE: a STABLE count is evaluated once per statement against the
// statement-start snapshot, so a single multi-row INSERT (e.g. a PostgREST array
// insert sent directly by an authenticated user) sees the same pre-insert count
// for every row and slips past the cap. VOLATILE re-evaluates per row and sees
// the rows accumulating, so the cap holds. See usage-limits-bulk.spec.ts for the
// behavioral proof.
const VOLATILE_HELPERS = [
  'count_user_games',
  'count_game_players',
  'count_future_sessions',
];

function volatilityOf(names: string[]): Map<string, string> {
  const list = names.map((h) => `'${h}'`).join(',');
  const out = execSync(
    `psql "${DB_URL}" -tAc "SELECT proname, provolatile FROM pg_proc ` +
      `WHERE pronamespace='public'::regnamespace AND proname IN (${list}) ORDER BY proname;"`,
    { encoding: 'utf8' }
  ).trim();
  return new Map(
    out.split('\n').map((line) => {
      const [name, vol] = line.split('|');
      return [name, vol] as [string, string];
    })
  );
}

test.describe('RLS helper volatility', () => {
  test('identity helpers are STABLE (per-statement eval, safe for boolean checks)', () => {
    const vol = volatilityOf(STABLE_HELPERS);
    expect(vol.size).toBe(STABLE_HELPERS.length);
    for (const name of STABLE_HELPERS) {
      expect(vol.get(name), `${name} should be STABLE`).toBe('s');
    }
  });

  test('count-based limit helpers are VOLATILE (so bulk inserts cannot bypass caps)', () => {
    const vol = volatilityOf(VOLATILE_HELPERS);
    expect(vol.size).toBe(VOLATILE_HELPERS.length);
    for (const name of VOLATILE_HELPERS) {
      expect(vol.get(name), `${name} must be VOLATILE to prevent cap bypass`).toBe('v');
    }
  });
});
