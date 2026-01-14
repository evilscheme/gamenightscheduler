import { checkSupabaseHealth, cleanDatabase, cleanTestUsers } from './helpers/seed';

/**
 * Global setup for Playwright E2E tests.
 *
 * Runs before all tests to ensure the environment is ready.
 *
 * Prerequisites:
 * 1. Start Supabase: npx supabase start
 * 2. Apply schema (if tables don't exist):
 *    docker exec -i supabase_db_dndscheduler psql -U postgres -d postgres < supabase/schema.sql
 */
async function globalSetup() {
  console.log('\n🔧 Running E2E test global setup...\n');

  // Check if Supabase is running
  console.log('Checking Supabase health...');
  const isHealthy = await checkSupabaseHealth();

  if (!isHealthy) {
    console.error('\n❌ Supabase is not running or not accessible!');
    console.error('\nPlease start Supabase with:');
    console.error('  npx supabase start');
    console.error('\nIf tables are missing, apply the schema:');
    console.error('  docker exec -i supabase_db_dndscheduler psql -U postgres -d postgres < supabase/schema.sql');
    console.error('');
    process.exit(1);
  }

  console.log('✓ Supabase is healthy');

  // Clean any existing test data
  console.log('Cleaning existing test data...');
  try {
    await cleanDatabase();
    await cleanTestUsers();
    console.log('✓ Test data cleaned');
  } catch (error) {
    console.warn('Warning: Failed to clean test data:', error);
    // Continue anyway - the database might be empty
  }

  console.log('\n✅ Global setup complete\n');
}

export default globalSetup;
