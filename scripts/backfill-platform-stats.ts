/**
 * One-off: rebuild platform_daily_stats for every day since the first signup.
 *
 * Usage:
 *   npm run db:backfill-stats          # production (.env.local)
 *   npm run db:backfill-stats:local    # local Supabase (.env.local.supabase)
 *
 * Only fills days that have no row, so it never touches a live snapshot and is
 * safe to re-run. Days before the daily cron started are rebuilt from row
 * timestamps and stored as 'reconstructed' (approximate: anything deleted since
 * is missing). The admin charts read the table and never write it, so until this
 * has run they show history only from the cron's first run.
 *
 * The npm scripts pin TZ=UTC: a "day" ends at local midnight, and the cron runs
 * on Vercel in UTC. Without it, a laptop backfill would draw day boundaries in
 * the laptop's zone, and its "yesterday" snapshot could be a different day than
 * the cron's.
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import { fillMissingDailyStats } from '../src/lib/admin/platformStatsStore';
import type { Database } from '../src/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const admin = createClient<Database>(supabaseUrl!, supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Target: ${supabaseUrl}`);
  if (!(await confirm('Backfill platform_daily_stats on this database? Type "yes" to continue: '))) {
    console.log('Aborted.');
    return;
  }

  const started = Date.now();
  const { written, skipped } = await fillMissingDailyStats(admin, new Date());
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (written.length === 0) {
    console.log(`Nothing to do — ${skipped} day(s) already recorded. (${seconds}s)`);
    return;
  }
  console.log(
    `Wrote ${written.length} day(s), ${written[0]} → ${written[written.length - 1]}; ` +
      `${skipped} already recorded. (${seconds}s)`
  );
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
