/**
 * Both directions of the OAuth callback contract.
 *
 * Outbound: we build the `redirectTo` URL handed to Supabase, tagging it with
 * the provider that started the flow. Inbound: Supabase reports failures by
 * redirecting back with `error` / `error_code` / `error_description` (GoTrue's
 * `redirectErrors`) instead of a `code`, preserving whatever query params the
 * redirect URL already carried — which is the only way to know which provider
 * failed. There is no session to read on the error path: the sign-in never
 * completed, so there is no user and no `app_metadata.provider`.
 *
 * Inbound errors are mapped onto a small set of stable reasons so `/login` can
 * explain what happened without echoing provider prose, which is
 * internal-facing and changes between GoTrue releases.
 */
export const AUTH_PROVIDERS = ['google', 'discord'] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: 'Google',
  discord: 'Discord',
};

export const AUTH_ERROR_REASONS = ['provider_no_email', 'access_denied', 'auth_failed'] as const;

export type AuthErrorReason = (typeof AUTH_ERROR_REASONS)[number];

export function isAuthProvider(value: string | null | undefined): value is AuthProvider {
  return !!value && value in PROVIDER_LABELS;
}

/**
 * The `provider` tag survives the round trip only while Supabase's Redirect URL
 * allowlist keeps query strings intact (the `/**` wildcard suffix — see
 * CLAUDE.md). If it is ever stripped, the messages below degrade to
 * provider-neutral copy rather than naming the wrong provider.
 */
export function buildOAuthRedirectUrl(
  origin: string,
  provider: AuthProvider,
  next?: string
): string {
  const params = new URLSearchParams({ provider });
  if (next) params.set('next', next);
  return `${origin}/auth/callback?${params}`;
}

/**
 * GoTrue raises this when the provider's profile response carried no email
 * address. Discord is the only provider that can produce it today — its API
 * types `email` as nullable even with the `email` scope granted, and unclaimed
 * accounts (joined a server via invite, never set an email) have none — but the
 * copy below reads the tagged provider instead of assuming.
 */
const NO_PROVIDER_EMAIL = /email from external provider/i;

export function classifyAuthCallbackError(params: URLSearchParams): AuthErrorReason | null {
  const error = params.get('error');
  if (!error) return null;

  if (NO_PROVIDER_EMAIL.test(params.get('error_description') ?? '')) return 'provider_no_email';
  if (error === 'access_denied') return 'access_denied';
  return 'auth_failed';
}

const STATIC_MESSAGES: Record<Exclude<AuthErrorReason, 'provider_no_email'>, string> = {
  access_denied: 'Sign-in was cancelled. You can try again whenever you are ready.',
  auth_failed: 'Something went wrong while signing you in. Please try again.',
};

function noEmailMessage(provider: string | null | undefined): string {
  const label = isAuthProvider(provider) ? PROVIDER_LABELS[provider] : null;
  const whose = label ? `Your ${label} account` : 'The account you signed in with';
  // Discord buries this behind a specific settings path, so name it. Anything
  // else gets generic guidance rather than a confidently wrong instruction.
  const fix =
    provider === 'discord'
      ? 'Add an email in Discord under Settings → My Account, then try again'
      : 'Add an email address to it, then try again';

  return `${whose} has no email address, and we need one to create your account. ${fix} — or sign in with a different provider.`;
}

export function getAuthErrorMessage(
  reason: string | null | undefined,
  provider?: string | null
): string | null {
  if (!reason) return null;
  if (reason === 'provider_no_email') return noEmailMessage(provider);
  return STATIC_MESSAGES[reason as keyof typeof STATIC_MESSAGES] ?? STATIC_MESSAGES.auth_failed;
}
