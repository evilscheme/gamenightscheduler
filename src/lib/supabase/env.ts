/**
 * Whether a Supabase URL points at a local dev instance. Parses the hostname
 * and compares it exactly — substring checks let `localhost.attacker.com` pass.
 */
export function isLocalSupabaseUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function isLocalSupabase(): boolean {
  return isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
}
