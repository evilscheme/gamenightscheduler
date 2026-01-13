import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for D&D Scheduler E2E tests
 *
 * Key design decisions:
 * - Single worker to avoid database race conditions (tests share Supabase local instance)
 * - Chromium only for speed (can expand later)
 * - Global setup verifies Supabase is running and resets DB
 * - Web server starts Next.js dev server with local Supabase env vars
 */

// Local Supabase CLI credentials (from `supabase status`)
// Note: Use localhost instead of 127.0.0.1 to avoid CORS issues in browser
const SUPABASE_LOCAL_URL = 'http://localhost:54321';
const SUPABASE_LOCAL_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const SUPABASE_LOCAL_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

export default defineConfig({
  testDir: './e2e/tests',

  // Run tests serially to avoid DB race conditions
  fullyParallel: false,
  workers: 1,

  // Fail CI if test.only() is left in source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }]],

  // Global setup runs before all tests
  globalSetup: './e2e/global-setup.ts',

  // Shared settings for all projects
  use: {
    baseURL: 'http://localhost:3001',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on first retry
    video: 'on-first-retry',

    // Action timeout (clicks, fills, etc) - fail fast if element not found
    actionTimeout: 5000,

    // Navigation timeout
    navigationTimeout: 10000,
  },

  // Test timeout - enough for setup + assertions, but not too long
  timeout: 15000,

  // Expect timeout - time to wait for assertions
  expect: {
    timeout: 3000,
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add more browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Start Next.js dev server before running tests
  // Use port 3001 to avoid conflicts with any running dev server
  // IMPORTANT: Explicitly pass Supabase env vars to override .env.local
  // (next dev forces NODE_ENV=development which loads .env.local)
  webServer: {
    command: 'next dev --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_LOCAL_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_LOCAL_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_LOCAL_SERVICE_KEY,
    },
  },
});
