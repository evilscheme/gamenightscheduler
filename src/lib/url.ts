/**
 * Sanitize a callback URL to prevent open-redirect attacks.
 * Only allows relative paths (starting with `/`) that are not
 * protocol-relative (`//`) or backslash-relative (`/\`), both of
 * which browsers resolve to external hosts.
 */
export function safeCallbackUrl(raw: string | null, fallback = '/dashboard'): string {
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    return raw;
  }
  return fallback;
}
