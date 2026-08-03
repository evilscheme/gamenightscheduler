import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { classifyAuthCallbackError, isAuthProvider } from '@/lib/authCallback';
import { safeCallbackUrl } from '@/lib/url';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');
  const next = safeCallbackUrl(rawNext);

  // Supabase Auth reports provider failures by redirecting here with
  // error/error_description and no code. Classify before the generic fallback
  // so /login can say what actually happened; forward the provider tag we set
  // on the way out (there is no session to infer it from), and the intended
  // destination so a retry with the other provider still lands there.
  const providerError = classifyAuthCallbackError(searchParams);
  if (providerError) {
    const provider = searchParams.get('provider');
    const params = new URLSearchParams({ error: providerError });
    if (isAuthProvider(provider)) params.set('provider', provider);
    if (rawNext) params.set('callbackUrl', next);
    return NextResponse.redirect(`${origin}/login?${params}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login page with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
