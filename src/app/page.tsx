import { createClient } from '@/lib/supabase/server';
import { chooseHomeView, type HomeView } from '@/lib/homeView';
import { SplashPage } from '@/components/splash/SplashPage';
import { HomeApp } from '@/components/home/HomeApp';

// This route reads auth cookies and renders differently per request, so it is
// always dynamically rendered. Declaring it explicitly also prevents Next.js's
// build-time prerender attempt from tripping the page's getClaims try/catch.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fail safe toward the authenticated path: if reading the session throws
  // unexpectedly, render the client gate (which resolves auth) rather than
  // exposing a logged-in user to the public splash. `view` stays 'app' on error.
  let view: HomeView = 'app';
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getClaims();
    view = chooseHomeView(result);
  } catch (err) {
    // Surface unexpected failures in server logs so a consistently broken
    // getClaims() path (e.g. missing env, library regression) is observable
    // rather than silently degrading the logged-out/SEO render to HomeApp.
    console.error('[home] getClaims threw unexpectedly; falling back to HomeApp:', err);
  }

  if (view === 'splash') {
    // Logged-out visitors and crawlers (no auth cookie) get fully
    // server-rendered marketing HTML.
    return <SplashPage />;
  }

  return <HomeApp />;
}
