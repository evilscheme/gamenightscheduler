import { isSupabaseRunning, resetDatabaseSchema, cleanTestUsers } from './helpers/seed';

/**
 * Global setup for Playwright E2E tests.
 *
 * Runs before all tests to ensure the environment is ready.
 * Automatically resets the database schema to ensure a fresh, known-good state.
 *
 * Prerequisites:
 * 1. Start Supabase: npx supabase start
 */
async function globalSetup() {
  console.log('\n🔧 Running E2E test global setup...\n');

  // Check if Supabase Docker container is running
  console.log('Checking Supabase status...');
  if (!isSupabaseRunning()) {
    console.error('\n❌ Supabase is not running!');
    console.error('\nPlease start Supabase with:');
    console.error('  npx supabase start\n');
    process.exit(1);
  }
  console.log('✓ Supabase is running');

  // Reset database schema (drop tables, apply fresh schema.sql)
  console.log('Resetting database schema...');
  try {
    resetDatabaseSchema();
    console.log('✓ Database schema reset');
  } catch (error) {
    console.error('\n❌ Failed to reset database schema!');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Clean test auth users from previous runs
  console.log('Cleaning test users...');
  try {
    await cleanTestUsers();
    console.log('✓ Test users cleaned');
  } catch (error) {
    console.warn('Warning: Failed to clean test users:', error);
    // Continue anyway - might be first run
  }

  console.log('\n✅ Global setup complete\n');
}

export default globalSetup;
