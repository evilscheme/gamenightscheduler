# Auth Status Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace repeated `isLoading || (session && !profile)` patterns across 12+ files with a single `authStatus` field derived in AuthProvider.

**Architecture:** Extract a pure `deriveAuthStatus()` function that computes one of three states (`loading`, `authenticated`, `unauthenticated`) from the existing auth state. Expose it on the context. Consumer pages switch on `authStatus` instead of combining booleans. This also fixes the infinite-spinner bug where `isLoading || session` keeps spinning forever when `fetchProfile` fails.

**Tech Stack:** React context, Vitest for unit tests

---

### Task 1: Write the unit test for `deriveAuthStatus`

**Files:**
- Create: `src/contexts/authStatus.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest';
import { deriveAuthStatus } from './authStatus';

describe('deriveAuthStatus', () => {
  it('returns loading when isLoading is true', () => {
    expect(deriveAuthStatus(true, null, null, false)).toBe('loading');
  });

  it('returns loading when isLoading is true even with profile', () => {
    expect(deriveAuthStatus(true, {} as any, {} as any, false)).toBe('loading');
  });

  it('returns loading when session exists but profile has not loaded yet', () => {
    expect(deriveAuthStatus(false, {} as any, null, false)).toBe('loading');
  });

  it('returns authenticated when profile is loaded', () => {
    expect(deriveAuthStatus(false, {} as any, {} as any, false)).toBe('authenticated');
  });

  it('returns unauthenticated when not loading and no session', () => {
    expect(deriveAuthStatus(false, null, null, false)).toBe('unauthenticated');
  });

  it('returns unauthenticated when session exists but profile failed (backendError)', () => {
    // This is the bug fix — prevents infinite spinner
    expect(deriveAuthStatus(false, {} as any, null, true)).toBe('unauthenticated');
  });

  it('returns unauthenticated when no session and backendError', () => {
    expect(deriveAuthStatus(false, null, null, true)).toBe('unauthenticated');
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/contexts/authStatus.test.ts`
Expected: FAIL — module not found

---

### Task 2: Implement `deriveAuthStatus` and add `authStatus` to AuthContext

**Files:**
- Create: `src/contexts/authStatus.ts`
- Modify: `src/contexts/AuthContext.tsx`

**Step 1: Create the `authStatus.ts` module**

```ts
import type { Session } from '@supabase/supabase-js';
import type { User } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function deriveAuthStatus(
  isLoading: boolean,
  session: Session | null,
  profile: User | null,
  backendError: boolean,
): AuthStatus {
  if (isLoading || (session && !profile && !backendError)) return 'loading';
  if (profile) return 'authenticated';
  return 'unauthenticated';
}
```

**Step 2: Add `authStatus` to `AuthContext.tsx`**

Add import at the top:
```ts
import { useMemo } from 'react';
import { deriveAuthStatus, type AuthStatus } from './authStatus';
```
(Note: `useMemo` should be added to the existing `react` import.)

Add to `AuthContextType` interface:
```ts
authStatus: AuthStatus;
```

Inside `AuthProvider`, after the state declarations, add:
```ts
const authStatus = useMemo(
  () => deriveAuthStatus(isLoading, session, profile, backendError),
  [isLoading, session, profile, backendError],
);
```

Add `authStatus` to the context provider value object.

**Step 3: Run the test to verify it passes**

Run: `npm run test:run -- src/contexts/authStatus.test.ts`
Expected: PASS — all 7 tests pass

**Step 4: Run the full test suite to verify no regressions**

Run: `npm run test:run`
Expected: All tests pass

**Step 5: Commit**

```
feat: add authStatus derived field to AuthContext
```

---

### Task 3: Update `useAuthRedirect` hook

**Files:**
- Modify: `src/hooks/useAuthRedirect.ts`

**Step 1: Update the hook**

Replace the entire hook body:

```ts
export function useAuthRedirect(options: UseAuthRedirectOptions = {}) {
  const { requireGM = false, requireAdmin = false, redirectTo = '/login' } = options;
  const { authStatus, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push(redirectTo);
    } else if (requireGM && authStatus === 'authenticated' && profile && !profile.is_gm) {
      router.push('/dashboard');
    } else if (requireAdmin && authStatus === 'authenticated' && profile && !profile.is_admin) {
      router.push('/dashboard');
    }
  }, [authStatus, profile, router, redirectTo, requireGM, requireAdmin]);
}
```

**Step 2: Run tests**

Run: `npm run test:run`
Expected: All pass

**Step 3: Commit**

```
refactor: update useAuthRedirect to use authStatus
```

---

### Task 4: Update home page and login page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/login/page.tsx`

**Step 1: Update `src/app/page.tsx`**

```tsx
export default function Home() {
  const { profile, authStatus } = useAuth();

  if (profile) {
    return <DashboardContent />;
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <SplashPage />;
}
```

**Step 2: Update `src/app/login/page.tsx`**

Change the destructuring:
```tsx
const { authStatus, signInWithGoogle, signInWithDiscord } = useAuth();
```

Update the redirect `useEffect`:
```tsx
useEffect(() => {
  if (authStatus === 'authenticated') {
    router.push(callbackUrl);
  }
}, [authStatus, router, callbackUrl]);
```

Update the loading guard:
```tsx
if (authStatus === 'loading' || authStatus === 'authenticated') {
```

**Step 3: Run tests**

Run: `npm run test:run`
Expected: All pass

**Step 4: Commit**

```
refactor: update home and login pages to use authStatus
```

---

### Task 5: Update Navbar

**Files:**
- Modify: `src/components/layout/Navbar.tsx`

**Step 1: Update Navbar**

Change the destructuring at line 159:
```tsx
const { profile, authStatus, signOut } = useAuth();
```

Replace the ternary at line 225:
```tsx
{authStatus === 'loading' ? (
  <div className="h-8 w-8 animate-pulse bg-muted rounded-full shrink-0" />
) : profile ? (
```

**Step 2: Commit**

```
refactor: update Navbar to use authStatus
```

---

### Task 6: Update protected pages with simple loading guards

These pages all use `if (isLoading || (session && !profile))` → `if (authStatus === 'loading')`.

**Files:**
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/games/new/page.tsx`
- Modify: `src/app/admin/page.tsx`

**Step 1: Update `src/app/settings/page.tsx`**

Change destructuring:
```tsx
const { profile, authStatus, refreshProfile } = useAuth();
```

Change loading guard (line 87):
```tsx
if (authStatus === 'loading') {
```

Remove the comment above it.

**Step 2: Update `src/app/games/new/page.tsx`**

Change destructuring:
```tsx
const { profile, authStatus } = useAuth();
```

Change loading guard (line 135):
```tsx
if (authStatus === 'loading') {
```

Remove the comment above it.

**Step 3: Update `src/app/admin/page.tsx`**

Change destructuring:
```tsx
const { authStatus, profile } = useAuth();
```

Change loading guard (line 86):
```tsx
if (authStatus === 'loading') {
```

Note: this file aliases `isLoading` as `authLoading` — remove that alias and use `authStatus` directly. The local `loading` state (for admin data) stays as-is.

**Step 4: Commit**

```
refactor: update settings, new game, and admin pages to use authStatus
```

---

### Task 7: Update pages with combined auth + data loading guards

These pages combine auth loading with local data loading: `if (isLoading || loading || (session && !profile))` → `if (authStatus === 'loading' || loading)`.

**Files:**
- Modify: `src/components/dashboard/DashboardContent.tsx`
- Modify: `src/app/games/[id]/page.tsx`
- Modify: `src/app/games/[id]/edit/page.tsx`
- Modify: `src/app/games/join/[code]/page.tsx`

**Step 1: Update `src/components/dashboard/DashboardContent.tsx`**

Change destructuring:
```tsx
const { profile, authStatus } = useAuth();
```

Change the `useEffect` condition (line 92):
```tsx
} else if (authStatus !== 'loading') {
```

Change `useEffect` deps:
```tsx
}, [profile?.id, authStatus]);
```

Change loading guard (line 100):
```tsx
if (authStatus === 'loading' || loading) {
```

**Step 2: Update `src/app/games/[id]/page.tsx`**

Change destructuring:
```tsx
const { profile, authStatus } = useAuth();
```

Change loading guard (line 743):
```tsx
if (authStatus === 'loading' || loading) {
```

Also check for any `useAuthRedirect` call — it uses one, so the redirect is already handled.

**Step 3: Update `src/app/games/[id]/edit/page.tsx`**

Change destructuring:
```tsx
const { profile, authStatus } = useAuth();
```

Change loading guard (line 159):
```tsx
if (authStatus === 'loading' || loading) {
```

**Step 4: Update `src/app/games/join/[code]/page.tsx`**

Change destructuring:
```tsx
const { profile, authStatus } = useAuth();
```

Change the redirect `useEffect` (line 39):
```tsx
if (authStatus === 'unauthenticated') {
  router.push(`/login?callbackUrl=/games/join/${code}`);
}
```

Change `useEffect` deps:
```tsx
}, [authStatus, router, code]);
```

Change loading guard (line 102):
```tsx
if (authStatus === 'loading' || loading) {
```

**Step 5: Commit**

```
refactor: update game pages and dashboard to use authStatus
```

---

### Task 8: Update remaining consumers

**Files:**
- Modify: `src/app/settings/delete-account/page.tsx`
- Modify: `src/app/dev-login/client.tsx`

**Step 1: Update `src/app/settings/delete-account/page.tsx`**

Change destructuring:
```tsx
const { authStatus, signOut } = useAuth();
```

Change the `useEffect` guard (line 54):
```tsx
if (authStatus !== 'authenticated') return;
```

Change `useEffect` deps:
```tsx
}, [authStatus, step]);
```

Change loading guard (line 145):
```tsx
if (authStatus === 'loading' || step === 'loading') {
```

**Step 2: Update `src/app/dev-login/client.tsx`**

Change destructuring:
```tsx
const { session, profile, authStatus } = useAuth();
```

Note: dev-login still needs `session` (for `session.user.email` display at line 83) and `profile` (for display name). Change the loading guard (line 70):
```tsx
{authStatus === 'loading' ? (
```

**Step 3: Run the full test suite**

Run: `npm run test:run`
Expected: All pass

**Step 4: Run the build to verify no type errors**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```
refactor: update delete-account and dev-login to use authStatus
```

---

### Task 9: Verify the app works locally

**Step 1: Start the local dev server**

Run: `npm run dev:local`

**Step 2: Verify with dev-login**

Navigate to http://localhost:3000/dev-login and test:
1. Login as Dev GM — verify dashboard loads without flash
2. Navigate to / — verify no splash page flash
3. Navigate to /settings — verify settings load
4. Sign out — verify redirect to splash page
5. Navigate to /login — verify login form shows

**Step 3: Check mobile viewport**

Resize browser to mobile width and verify:
1. Navbar shows skeleton during loading, not unauthenticated state
2. Pages render correctly at mobile breakpoints
