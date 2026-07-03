import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const HELPERS = [
  'is_game_participant',
  'is_game_gm_or_co_gm',
  'is_membership_co_gm',
  'count_user_games',
  'count_game_players',
  'count_future_sessions',
  'shares_game_with',
];

/**
 * Read-only RLS helpers must be STABLE (provolatile='s') so the planner
 * evaluates them once per statement instead of once per row.
 */
test('read-only RLS helpers are declared STABLE', () => {
  const list = HELPERS.map((h) => `'${h}'`).join(',');
  const out = execSync(
    `psql "${DB_URL}" -tAc "SELECT proname, provolatile FROM pg_proc ` +
      `WHERE pronamespace='public'::regnamespace AND proname IN (${list}) ORDER BY proname;"`,
    { encoding: 'utf8' }
  ).trim();
  const rows = out.split('\n').map((l) => l.split('|'));
  expect(rows).toHaveLength(HELPERS.length);
  for (const [name, vol] of rows) {
    expect(vol, `${name} should be STABLE`).toBe('s');
  }
});
