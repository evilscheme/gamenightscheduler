/**
 * Shared constants for E2E tests
 */

// Assertion timeouts (for expect().toBeVisible, etc.)
export const TEST_TIMEOUTS = {
  /** Default assertion timeout - use for most visibility checks */
  DEFAULT: 10000,
  /** Short timeout - use when element should appear quickly */
  SHORT: 5000,
  /** Long timeout - use for initial page loads with auth */
  LONG: 15000,
} as const;
