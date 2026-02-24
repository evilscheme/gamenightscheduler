# Auth Status Refactor Design

## Problem

Every page that needs auth-gated rendering manually combines `isLoading`, `session`, `profile`, and `backendError` from `useAuth()` to derive the same four states. This is error-prone (the current `isLoading || session` pattern causes an infinite spinner when profile fetch fails) and repetitive (13 files destructure `isLoading`, 11 use `session`).

## Solution

Add a derived `authStatus` field to `AuthContext`, computed once in `AuthProvider`.

```tsx
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
```

### Derivation Logic

Computed via `useMemo` in AuthProvider:

- **`loading`** — `isLoading` is true, OR session exists but profile hasn't resolved yet and no backend error
- **`authenticated`** — `profile` is non-null (implies session exists)
- **`error`** — `backendError` is true and not loading
- **`unauthenticated`** — none of the above (no session, not loading, no error)

### Consumer Changes

Pages switch from multi-boolean checks to a single status:

```tsx
// Before (page.tsx)
const { profile, session, isLoading } = useAuth();
if (profile) return <DashboardContent />;
if (isLoading || session) return <LoadingSpinner />;
return <SplashPage />;

// After
const { profile, authStatus } = useAuth();
if (profile) return <DashboardContent />;
if (authStatus === 'loading') return <LoadingSpinner />;
return <SplashPage />;
```

### `useAuthRedirect` Simplification

```tsx
// Before
if (!isLoading && !session) router.push(redirectTo);

// After
if (authStatus === 'unauthenticated') router.push(redirectTo);
```

### What Stays

`isLoading`, `session`, `profile`, `backendError`, and `user` remain on the context for components that need raw state (e.g., `StatusBanner` reads `backendError` directly, `Navbar` needs `profile` for avatar display, `login/page.tsx` needs `signInWithGoogle`/`signInWithDiscord`).

## Files to Modify

1. `src/contexts/AuthContext.tsx` — Add `AuthStatus` type, `authStatus` field, `useMemo` derivation
2. `src/app/page.tsx` — Use `authStatus` instead of `isLoading || session`
3. `src/app/login/page.tsx` — Use `authStatus` instead of `isLoading || session`
4. `src/components/layout/Navbar.tsx` — Use `authStatus` for skeleton state
5. `src/hooks/useAuthRedirect.ts` — Switch to `authStatus`
6. All pages using `useAuthRedirect` pattern directly — Simplify guards (games pages, settings, admin, etc.)
