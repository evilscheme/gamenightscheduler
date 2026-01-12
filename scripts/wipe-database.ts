/**
 * Wipe all data from database tables (keeps schema intact)
 *
 * Usage: npx tsx scripts/wipe-database.ts
 *
 * WARNING: This permanently deletes all data!
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function wipeDatabase() {
  console.log('WARNING: This will delete ALL data from the database!');
  console.log('Press Ctrl+C within 3 seconds to cancel...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Wiping database...\n');

  // Tables in order from dependent to parent
  const tables = ['sessions', 'availability', 'game_memberships', 'games', 'users'];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error(`Error wiping ${table}:`, error.message);
    } else {
      console.log(`✓ Wiped ${table}`);
    }
  }

  console.log('\nVerifying tables are empty...\n');

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`Error checking ${table}:`, error.message);
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }

  console.log('\nDatabase wipe complete!');
}

wipeDatabase().catch(console.error);
