/**
 * Delete a user from the system (both auth.users and public.users)
 *
 * Usage: npx tsx scripts/delete-user.ts <email-or-uuid>
 *
 * Examples:
 *   npx tsx scripts/delete-user.ts user@example.com
 *   npx tsx scripts/delete-user.ts 12345678-1234-1234-1234-123456789abc
 *
 * WARNING: This permanently deletes the user and all their data!
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const identifier = process.argv[2];

if (!identifier) {
  console.error('Usage: npx tsx scripts/delete-user.ts <email-or-uuid>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function deleteUser() {
  // Determine if identifier is UUID or email
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  let userId: string;
  let userEmail: string;

  if (isUuid) {
    // Look up user by UUID to get email for confirmation
    const { data: user, error } = await supabase.auth.admin.getUserById(identifier);
    if (error || !user.user) {
      console.error(`User not found with ID: ${identifier}`);
      process.exit(1);
    }
    userId = user.user.id;
    userEmail = user.user.email || 'unknown';
  } else {
    // Look up user by email
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('Error listing users:', error.message);
      process.exit(1);
    }
    const user = data.users.find(u => u.email === identifier);
    if (!user) {
      console.error(`User not found with email: ${identifier}`);
      process.exit(1);
    }
    userId = user.id;
    userEmail = user.email || 'unknown';
  }

  // Show what will be deleted
  console.log(`\nUser found:`);
  console.log(`  ID: ${userId}`);
  console.log(`  Email: ${userEmail}`);

  // Check for games they own (will be deleted via CASCADE)
  const { data: ownedGames } = await supabase
    .from('games')
    .select('id, name')
    .eq('gm_id', userId);

  if (ownedGames && ownedGames.length > 0) {
    console.log(`\nGames owned by this user (will be deleted):`);
    for (const game of ownedGames) {
      console.log(`  - ${game.name} (${game.id})`);
    }
  }

  // Check for game memberships (will be deleted via CASCADE)
  const { data: memberships } = await supabase
    .from('game_memberships')
    .select('game_id, games(name)')
    .eq('user_id', userId);

  if (memberships && memberships.length > 0) {
    console.log(`\nGame memberships (will be removed):`);
    for (const m of memberships) {
      const gameName = (m.games as { name: string } | null)?.name || 'Unknown';
      console.log(`  - ${gameName}`);
    }
  }

  console.log('\nWARNING: This will permanently delete this user and all their data!');

  const confirmed = await confirm('Type "yes" to confirm deletion: ');

  if (!confirmed) {
    console.log('Aborted.');
    process.exit(0);
  }

  console.log('\nDeleting user...');

  // Delete from public.users first (cascades to games, memberships, availability, sessions)
  const { error: publicDeleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (publicDeleteError) {
    console.error('Error deleting from public.users:', publicDeleteError.message);
    process.exit(1);
  }

  // Delete from auth.users
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error('Error deleting from auth.users:', deleteError.message);
    process.exit(1);
  }

  // Verify deletion
  console.log('Verifying deletion...');

  const { data: authCheck } = await supabase.auth.admin.getUserById(userId);
  const { data: publicCheck } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  const authDeleted = !authCheck.user;
  const publicDeleted = !publicCheck;

  if (authDeleted && publicDeleted) {
    console.log(`\n✓ User ${userEmail} (${userId}) has been deleted.`);
    console.log('  ✓ auth.users: deleted');
    console.log('  ✓ public.users: deleted');
  } else {
    console.error(`\n⚠ Deletion may have failed:`);
    console.error(`  auth.users: ${authDeleted ? 'deleted' : 'STILL EXISTS'}`);
    console.error(`  public.users: ${publicDeleted ? 'deleted' : 'STILL EXISTS'}`);
    process.exit(1);
  }
}

deleteUser().catch(console.error);
