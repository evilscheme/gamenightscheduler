# Security Audit Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix findings 1-9 from the security penetration test report (`.context/SECURITY-AUDIT-REPORT.md`)

**Architecture:** Database-level protections (triggers, CHECK constraints, REVOKE) for findings 1, 3, 6, 7. Application-level fixes (CSP header, ICS escaping, URL validation, rate limiting) for findings 2, 4, 5, 8, 9. All schema changes go into `supabase/schema.sql` directly (per CLAUDE.md — no separate migration files).

**Tech Stack:** PostgreSQL (Supabase), Next.js 16, Vitest, Playwright

---

### Task 1: Protect `gm_id` on games table (Findings 1 & 3 — HIGH + MEDIUM)

**Files:**
- Modify: `supabase/schema.sql` (add trigger function + trigger after line ~328)
- Modify: `e2e/tests/rls/rls-hardening.spec.ts` (add new test describe block)

**Step 1: Write the E2E test**

Add a new `test.describe` block to `e2e/tests/rls/rls-hardening.spec.ts`:

```typescript
test.describe('Game gm_id Protection (protect_game_gm_id trigger)', () => {
  test('co-GM cannot steal game ownership by updating gm_id', async ({ page, request }) => {
    const ts = Date.now();

    // Create GM and game
    const gm = await createTestUser(request, {
      email: `gm-steal-${ts}@e2e.local`,
      name: 'Victim GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Steal Target Game',
      play_days: [5],
    });

    // Create co-GM
    const coGm = await createTestUser(request, {
      email: `cogm-steal-${ts}@e2e.local`,
      name: 'Attacker CoGM',
      is_gm: true,
    });
    await addPlayerToGame(game.id, coGm.id);
    const admin = getAdminClient();
    await admin
      .from('game_memberships')
      .update({ is_co_gm: true })
      .eq('game_id', game.id)
      .eq('user_id', coGm.id);

    // Login as co-GM and attempt to steal ownership
    await loginTestUser(page, {
      email: coGm.email,
      name: coGm.name,
      is_gm: true,
    });

    const result = await supabaseRestCall(page, {
      path: `/rest/v1/games?id=eq.${game.id}`,
      method: 'PATCH',
      body: { gm_id: coGm.id },
    });

    // The trigger silently resets gm_id — PATCH returns 200 with original gm_id
    expect(result.status).toBe(200);
    const rows = result.data as { gm_id: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].gm_id).toBe(gm.id);
  });

  test('GM cannot force-transfer game to arbitrary user', async ({ page, request }) => {
    const ts = Date.now();

    const gm = await createTestUser(request, {
      email: `gm-transfer-${ts}@e2e.local`,
      name: 'Transfer GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Transfer Game',
      play_days: [5],
    });

    const bystander = await createTestUser(request, {
      email: `bystander-transfer-${ts}@e2e.local`,
      name: 'Bystander',
      is_gm: true,
    });

    await loginTestUser(page, {
      email: gm.email,
      name: gm.name,
      is_gm: true,
    });

    const result = await supabaseRestCall(page, {
      path: `/rest/v1/games?id=eq.${game.id}`,
      method: 'PATCH',
      body: { gm_id: bystander.id },
    });

    expect(result.status).toBe(200);
    const rows = result.data as { gm_id: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].gm_id).toBe(gm.id);
  });

  test('service role CAN transfer game ownership (admin operations)', async ({ request }) => {
    const ts = Date.now();

    const gm = await createTestUser(request, {
      email: `gm-admin-transfer-${ts}@e2e.local`,
      name: 'Admin Transfer GM',
      is_gm: true,
    });
    const game = await createTestGame({
      gm_id: gm.id,
      name: 'Admin Transfer Game',
      play_days: [5],
    });

    const newOwner = await createTestUser(request, {
      email: `new-owner-${ts}@e2e.local`,
      name: 'New Owner',
      is_gm: true,
    });

    const admin = getAdminClient();
    const { error } = await admin
      .from('games')
      .update({ gm_id: newOwner.id })
      .eq('id', game.id);

    expect(error).toBeNull();

    const { data: dbGame } = await admin
      .from('games')
      .select('gm_id')
      .eq('id', game.id)
      .single();

    expect(dbGame?.gm_id).toBe(newOwner.id);
  });
});
```

**Step 2: Add the trigger to schema.sql**

In `supabase/schema.sql`, after the `prevent_membership_game_change` function (~line 301), add:

```sql
-- Prevent gm_id from being changed by authenticated users (blocks game theft by co-GMs
-- and force-transfers by GMs). Service role (auth.uid() IS NULL) can still transfer
-- ownership for admin operations like account deletion.
CREATE OR REPLACE FUNCTION public.protect_game_gm_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gm_id IS DISTINCT FROM OLD.gm_id THEN
    IF (SELECT auth.uid()) IS NOT NULL THEN
      NEW.gm_id := OLD.gm_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

After the `prevent_membership_game_id_change` trigger (~line 328), add:

```sql
-- Prevent gm_id changes on games (blocks co-GM game theft and GM force-transfers)
CREATE TRIGGER protect_game_gm_id
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_game_gm_id();
```

**Step 3: Reset local DB and run the test**

```bash
npm run db:reset
npx playwright test e2e/tests/rls/rls-hardening.spec.ts --project=chromium
```

Expected: All tests PASS, including the 3 new ones.

**Step 4: Commit**

```bash
git add supabase/schema.sql e2e/tests/rls/rls-hardening.spec.ts
git commit -m "fix: protect games.gm_id from co-GM theft and GM force-transfer

Adds a BEFORE UPDATE trigger on the games table that silently resets
gm_id to its old value when changed by an authenticated user. Service
role (admin API) can still transfer ownership for account deletion.

Closes security findings #1 (HIGH) and #3 (MEDIUM)."
```

---

### Task 2: Avatar URL validation via CHECK constraint (Finding 2 — HIGH)

**Files:**
- Modify: `supabase/schema.sql` (add CHECK constraint to users table, ~line 19)

**Step 1: Add CHECK constraint to schema.sql**

Change the `avatar_url` column in the `users` table from:

```sql
  avatar_url TEXT,
```

to:

```sql
  avatar_url TEXT CHECK (
    avatar_url IS NULL
    OR avatar_url ~ '^https://(lh3\.googleusercontent\.com|cdn\.discordapp\.com|avatars\.githubusercontent\.com)/'
  ),
```

This restricts avatar URLs to the known OAuth provider CDNs. The `handle_new_user` trigger sets avatar_url from OAuth metadata, so only legitimate provider URLs flow in. The `protect_user_columns` allowlist lets users update `avatar_url`, but the CHECK constraint ensures only valid domains are accepted.

**Step 2: Reset local DB and run existing E2E tests to confirm no regression**

```bash
npm run db:reset
npx playwright test e2e/tests/rls/rls-hardening.spec.ts --project=chromium
```

Expected: All PASS (no dev users use avatar URLs).

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "fix: restrict avatar_url to known OAuth provider domains

Adds a CHECK constraint on users.avatar_url that only allows URLs from
Google, Discord, and GitHub CDNs. Prevents tracking pixel injection
via arbitrary avatar URLs.

Closes security finding #2 (HIGH)."
```

---

### Task 3: Add Content-Security-Policy header (Finding 4 — MEDIUM)

**Files:**
- Modify: `next.config.ts`

**Step 1: Add CSP header**

Add the CSP header to the headers array in `next.config.ts`:

```typescript
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://lh3.googleusercontent.com https://cdn.discordapp.com https://avatars.githubusercontent.com data:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; '),
          },
```

Note: `'unsafe-inline'` and `'unsafe-eval'` are needed for Next.js in development. The `img-src` domains match the avatar URL CHECK constraint. `connect-src` allows Supabase API calls. `frame-ancestors 'none'` duplicates X-Frame-Options for CSP-aware browsers.

**Step 2: Test locally**

```bash
npm run dev:local
```

Navigate to http://localhost:3000 in browser, open DevTools > Console. Verify no CSP violations for normal page loads. Check the response headers include `Content-Security-Policy`.

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: add Content-Security-Policy header

Adds CSP with restricted img-src (OAuth provider CDNs only),
connect-src (self + Supabase), and frame-ancestors none.
Defense-in-depth against XSS vectors.

Closes security finding #4 (MEDIUM)."
```

---

### Task 4: Fix ICS CRLF injection (Finding 5 — MEDIUM)

**Files:**
- Modify: `src/lib/ics.ts:349-354` (fix `escapeICS` function)
- Modify: `src/lib/ics.test.ts` (add CRLF test cases)

**Step 1: Write the failing tests**

Add to the `escapeICS` describe block in `src/lib/ics.test.ts`:

```typescript
  it("escapes carriage returns", () => {
    expect(escapeICS("line1\rline2")).toBe("line1\\nline2");
  });

  it("escapes CRLF sequences", () => {
    expect(escapeICS("line1\r\nline2")).toBe("line1\\nline2");
  });

  it("escapes mixed line endings", () => {
    expect(escapeICS("a\r\nb\nc\rd")).toBe("a\\nb\\nc\\nd");
  });
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:run -- src/lib/ics.test.ts
```

Expected: 3 new tests FAIL (carriage returns not being escaped).

**Step 3: Fix escapeICS**

In `src/lib/ics.ts`, change the `escapeICS` function from:

```typescript
export function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
```

to:

```typescript
export function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}
```

Order matters: `\r\n` must be replaced before `\r` and `\n` individually.

**Step 4: Run tests to verify they pass**

```bash
npm run test:run -- src/lib/ics.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/ics.ts src/lib/ics.test.ts
git commit -m "fix: escape carriage returns in ICS output

The escapeICS function now handles \r\n and \r in addition to \n,
preventing CRLF injection of arbitrary ICS properties via game names.

Closes security finding #5 (MEDIUM)."
```

---

### Task 5: Add availability comment length limit (Finding 6 — MEDIUM)

**Files:**
- Modify: `supabase/schema.sql:65` (add CHECK constraint)
- Modify: `src/lib/constants.ts:35-40` (add AVAILABILITY_COMMENT limit)
- Modify: `src/components/calendar/AvailabilityCalendar.tsx:~1068` (add maxLength to input)

**Step 1: Add CHECK constraint to schema.sql**

Change line 65 from:

```sql
  comment TEXT,
```

to:

```sql
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
```

**Step 2: Add constant to TEXT_LIMITS**

In `src/lib/constants.ts`, add `AVAILABILITY_COMMENT: 500` to `TEXT_LIMITS`:

```typescript
export const TEXT_LIMITS = {
  GAME_NAME: 100,
  GAME_DESCRIPTION: 1000,
  PLAY_DATE_NOTE: 200,
  USER_DISPLAY_NAME: 50,
  AVAILABILITY_COMMENT: 500,
} as const;
```

**Step 3: Add maxLength to the input**

In `src/components/calendar/AvailabilityCalendar.tsx`, find the availability note `<input>` (~line 1068) and add `maxLength`:

```typescript
                <input
                  id="availability-note"
                  type="text"
                  value={commentText}
                  onChange={(e) => onCommentChange(e.target.value)}
                  placeholder="e.g., Depends on work schedule"
                  maxLength={500}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
```

**Step 4: Reset DB and run tests**

```bash
npm run db:reset
npm run test:run -- src/lib/constants.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add supabase/schema.sql src/lib/constants.ts src/components/calendar/AvailabilityCalendar.tsx
git commit -m "fix: add 500-char length limit on availability comments

Adds CHECK constraint in DB and maxLength on the input field to prevent
storage abuse via multi-megabyte comments.

Closes security finding #6 (MEDIUM)."
```

---

### Task 6: Revoke direct SECURITY DEFINER function access (Finding 7 — LOW)

**Files:**
- Modify: `supabase/schema.sql` (add REVOKE statements after function definitions)

**Step 1: Add REVOKE statements to schema.sql**

After all function definitions (after the `protect_user_columns` function, before the Triggers section ~line 303), add:

```sql
-- Revoke direct execution of helper functions from authenticated users.
-- These functions are SECURITY DEFINER and bypass RLS, but they're only
-- needed within RLS policy evaluation (which runs as the table owner).
-- Revoking prevents authenticated users from calling them directly to
-- enumerate metadata about other users' games.
REVOKE EXECUTE ON FUNCTION public.count_user_games(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.count_game_players(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.count_future_sessions(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_game_participant(UUID, UUID) FROM authenticated;
```

**Step 2: Reset DB and run E2E tests to verify no regression**

```bash
npm run db:reset
npx playwright test e2e/tests/rls/ --project=chromium
```

Expected: All PASS. RLS policies still work because they evaluate as the table owner, not as the authenticated user.

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "fix: revoke direct execution of SECURITY DEFINER helpers

Prevents authenticated users from calling count_user_games,
count_game_players, count_future_sessions, and is_game_participant
directly to enumerate metadata about other users' games. RLS policies
still work because they evaluate as the table owner.

Closes security finding #7 (LOW)."
```

---

### Task 7: Fix login page open redirect (Finding 8 — LOW)

**Files:**
- Modify: `src/app/login/page.tsx:14`

**Step 1: Fix callbackUrl validation**

Change line 14 from:

```typescript
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
```

to:

```typescript
  const raw = searchParams.get('callbackUrl') || '/dashboard';
  const callbackUrl = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
```

**Step 2: Fix dev-login callbackUrl validation (Finding 11 bonus)**

In `src/app/dev-login/client.tsx:19-20`, change:

```typescript
  const rawCallback = searchParams.get('callbackUrl') || '/dashboard';
  const callbackUrl = rawCallback.startsWith('/') ? rawCallback : '/dashboard';
```

to:

```typescript
  const rawCallback = searchParams.get('callbackUrl') || '/dashboard';
  const callbackUrl = rawCallback.startsWith('/') && !rawCallback.startsWith('//') ? rawCallback : '/dashboard';
```

**Step 3: Commit**

```bash
git add src/app/login/page.tsx src/app/dev-login/client.tsx
git commit -m "fix: validate callbackUrl on login and dev-login pages

Adds startsWith('//') check to prevent protocol-relative URL open
redirects, matching the auth callback's existing validation pattern.

Closes security findings #8 (LOW) and #11 (LOW)."
```

---

### Task 8: Add rate limiting via Next.js middleware (Finding 9 — LOW)

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create middleware with rate limiting**

Create `src/middleware.ts` with in-memory token-bucket rate limiting for the unauthenticated endpoints:

```typescript
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
```

**Step 2: Test locally**

```bash
npm run dev:local
```

Make rapid requests to `http://localhost:3000/api/games/preview/nonexistent` and verify 429 after 30 requests within a minute.

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add API rate limiting via Next.js middleware

In-memory token-bucket rate limiter: 30 req/min for unauthenticated
preview/calendar endpoints, 60 req/min for other API routes.

Closes security finding #9 (LOW)."
```

---

### Task 9: Run full test suite and verify

**Step 1: Run unit tests**

```bash
npm run test:run
```

Expected: All PASS.

**Step 2: Reset DB and run all E2E tests**

```bash
npm run db:reset
npx playwright test --project=chromium
```

Expected: All PASS.

**Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

---

## Summary of Changes

| Task | Finding(s) | Severity | File(s) |
|------|-----------|----------|---------|
| 1 | #1, #3 | HIGH, MEDIUM | `schema.sql`, `rls-hardening.spec.ts` |
| 2 | #2 | HIGH | `schema.sql` |
| 3 | #4 | MEDIUM | `next.config.ts` |
| 4 | #5 | MEDIUM | `ics.ts`, `ics.test.ts` |
| 5 | #6 | MEDIUM | `schema.sql`, `constants.ts`, `AvailabilityCalendar.tsx` |
| 6 | #7 | LOW | `schema.sql` |
| 7 | #8, #11 | LOW, LOW | `login/page.tsx`, `dev-login/client.tsx` |
| 8 | #9 | LOW | `middleware.ts` (new) |
| 9 | — | — | Full test suite verification |
