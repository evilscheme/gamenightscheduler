/**
 * Decides which view the home route (`/`) should render, based on the result
 * of `supabase.auth.getClaims()` read server-side.
 *
 * - Valid session  → getClaims returns { data: { claims }, error: null }   → 'app'
 * - Expired/invalid → getClaims returns { data: null, error: <AuthError> } → 'app'
 * - No session      → getClaims returns { data: null, error: null }        → 'splash'
 *
 * We only render the public splash when there is positively no session, so a
 * returning user whose access token has expired is never flashed the marketing
 * page (the client resolves their session and shows the dashboard). Crawlers
 * send no auth cookie and therefore always land on 'splash'.
 */
export type HomeView = 'splash' | 'app';

interface ClaimsResult {
  data: { claims?: unknown } | null;
  error: unknown;
}

export function chooseHomeView(result: ClaimsResult): HomeView {
  const hasClaims = !!result.data?.claims;
  return hasClaims || result.error ? 'app' : 'splash';
}
