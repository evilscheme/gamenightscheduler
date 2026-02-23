import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiter (per-IP, per-path-prefix)
// Resets on server restart — adequate for single-instance deployments.
// For multi-instance, use CDN/proxy-level rate limiting instead.

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS: Record<string, number> = {
  '/api/games/preview': 30,
  '/api/games/calendar': 30,
  '/api/': 60,
};

const hitCounts = new Map<string, { count: number; resetAt: number }>();

function getRateLimit(pathname: string): number {
  for (const [prefix, limit] of Object.entries(MAX_REQUESTS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return 120; // default
}

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = hitCounts.get(key);

  if (!entry || now >= entry.resetAt) {
    hitCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > limit;
}

// Periodically clean stale entries (every 1000 requests)
let cleanupCounter = 0;
function maybeCleanup() {
  if (++cleanupCounter % 1000 !== 0) return;
  const now = Date.now();
  for (const [key, entry] of hitCounts) {
    if (now >= entry.resetAt) hitCounts.delete(key);
  }
}

export function middleware(request: NextRequest) {
  // Skip rate limiting in test/development (E2E tests hammer APIs rapidly)
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  // Only rate-limit API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const limit = getRateLimit(request.nextUrl.pathname);
  const key = `${ip}:${request.nextUrl.pathname.split('/').slice(0, 4).join('/')}`;

  maybeCleanup();

  if (isRateLimited(key, limit)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
