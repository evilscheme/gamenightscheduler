# Data Layer Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all inline Supabase queries from components into a shared data layer (`src/lib/data/`) and a `useGameDetail` hook, improving maintainability without changing behavior.

**Architecture:** Plain async query functions organized by domain entity, consumed directly by simple pages and via a `useGameDetail` hook by the game detail page. All functions accept a Supabase client as the first parameter.

**Tech Stack:** TypeScript, Supabase JS client (`SupabaseClient` from `@supabase/supabase-js`), React hooks, Vitest

**Design doc:** `docs/plans/2026-02-26-data-layer-design.md`

---

### Task 1: Create `src/lib/data/games.ts`

**Files:**
- Create: `src/lib/data/games.ts`

**Step 1: Create the query functions**

Extract game-related queries from these source locations:
- `src/app/games/[id]/page.tsx:128-132` — `fetchGameWithGM`
- `src/components/dashboard/DashboardContent.tsx:48-51` — `fetchUserGmGames`
- `src/app/games/new/page.tsx:64-67` — `fetchUserGameCount`
- `src/app/games/new/page.tsx:98-131` — `createGame`
- `src/app/games/[id]/edit/page.tsx:135-148` — `updateGame`
- `src/app/games/[id]/page.tsx:600-611` — `deleteGame`
- `src/app/games/[id]/page.tsx:545-548` — `regenerateInviteCode`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameWithGM } from '@/types';

export async function fetchGameWithGM(supabase: SupabaseClient, gameId: string) {
  return supabase
    .from('games')
    .select('*, gm:users!games_gm_id_fkey(*)')
    .eq('id', gameId)
    .single<GameWithGM>();
}

export async function fetchUserGmGames(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('games')
    .select('*, gm:users!games_gm_id_fkey(*)')
    .eq('gm_id', userId);
}

export async function fetchUserGameCount(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('gm_id', userId);
}

export async function createGame(
  supabase: SupabaseClient,
  params: {
    name: string;
    description: string | null;
    gm_id: string;
    play_days: number[];
    ad_hoc_only: boolean;
    invite_code: string;
    scheduling_window_months: number;
    default_start_time: string;
    default_end_time: string;
    timezone: string | null;
  }
) {
  const { error: insertError } = await supabase.from('games').insert(params);

  if (insertError) {
    return { data: null, error: insertError };
  }

  // Fetch the created game by invite code (can't use .select() on insert due to RLS timing)
  const { data, error } = await supabase
    .from('games')
    .select('id')
    .eq('invite_code', params.invite_code)
    .single();

  return { data, error };
}

export async function updateGame(
  supabase: SupabaseClient,
  gameId: string,
  params: {
    name: string;
    description: string | null;
    play_days: number[];
    scheduling_window_months: number;
    default_start_time: string;
    default_end_time: string;
    timezone: string | null;
    min_players_needed: number;
    ad_hoc_only: boolean;
  }
) {
  return supabase.from('games').update(params).eq('id', gameId);
}

export async function deleteGame(supabase: SupabaseClient, gameId: string) {
  return supabase.from('games').delete().eq('id', gameId);
}

export async function regenerateInviteCode(
  supabase: SupabaseClient,
  gameId: string,
  newCode: string
) {
  return supabase.from('games').update({ invite_code: newCode }).eq('id', gameId);
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors in the new file

**Step 3: Commit**

```bash
git add src/lib/data/games.ts
git commit -m "refactor: extract game query functions to data layer"
```

---

### Task 2: Create `src/lib/data/memberships.ts`

**Files:**
- Create: `src/lib/data/memberships.ts`

**Step 1: Create the query functions**

Extract from:
- `src/app/games/[id]/page.tsx:140-143` — `fetchGameMembers`
- `src/components/dashboard/DashboardContent.tsx:38-41` — `fetchUserMemberships`
- `src/components/dashboard/DashboardContent.tsx:73-76` — `fetchMembershipCount`
- `src/app/games/[id]/page.tsx:200-216` — `fetchUserOtherGames`
- `src/app/games/join/[code]/page.tsx:81-84` — `joinGame`
- `src/app/games/[id]/page.tsx:563-567` — `leaveGame`
- `src/app/games/[id]/page.tsx:580-584` — `removePlayer`
- `src/app/games/[id]/page.tsx:617-621` — `toggleCoGm`
- `src/app/games/[id]/edit/page.tsx:59-64` — `checkCoGmStatus`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberWithRole, MembershipWithUser } from '@/types';

export async function fetchGameMembers(supabase: SupabaseClient, gameId: string) {
  const { data: memberships, error } = await supabase
    .from('game_memberships')
    .select('user_id, is_co_gm, users(*)')
    .eq('game_id', gameId);

  if (error) return { data: [] as MemberWithRole[], error };

  const typedMemberships = memberships as MembershipWithUser[] | null;
  const members: MemberWithRole[] =
    typedMemberships
      ?.filter((m) => m.users !== null)
      .map((m) => ({
        ...m.users!,
        is_co_gm: m.is_co_gm,
      })) || [];

  return { data: members, error: null };
}

export async function fetchUserMemberships(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('game_memberships')
    .select('game_id, is_co_gm')
    .eq('user_id', userId);
}

export async function fetchMembershipCount(supabase: SupabaseClient, gameId: string) {
  return supabase
    .from('game_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId);
}

export async function fetchUserOtherGames(
  supabase: SupabaseClient,
  userId: string,
  excludeGameId: string
) {
  const { data: memberGames } = await supabase
    .from('game_memberships')
    .select('game_id, games(id, name)')
    .eq('user_id', userId);

  const { data: gmGames } = await supabase
    .from('games')
    .select('id, name')
    .eq('gm_id', userId);

  const gameMap = new Map<string, string>();
  gmGames?.forEach((g) => gameMap.set(g.id, g.name));
  memberGames?.forEach((m) => {
    const g = m.games as unknown as { id: string; name: string } | null;
    if (g) gameMap.set(g.id, g.name);
  });
  gameMap.delete(excludeGameId);

  return Array.from(gameMap.entries()).map(([id, name]) => ({ id, name }));
}

export async function joinGame(supabase: SupabaseClient, gameId: string, userId: string) {
  return supabase.from('game_memberships').insert({ game_id: gameId, user_id: userId });
}

export async function leaveGame(supabase: SupabaseClient, gameId: string, userId: string) {
  return supabase
    .from('game_memberships')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

export async function removePlayer(supabase: SupabaseClient, gameId: string, userId: string) {
  return supabase
    .from('game_memberships')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

export async function toggleCoGm(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  isCoGm: boolean
) {
  return supabase
    .from('game_memberships')
    .update({ is_co_gm: isCoGm })
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

export async function checkCoGmStatus(
  supabase: SupabaseClient,
  gameId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('game_memberships')
    .select('is_co_gm')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single();

  return { data: data?.is_co_gm ?? false, error };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/data/memberships.ts
git commit -m "refactor: extract membership query functions to data layer"
```

---

### Task 3: Create `src/lib/data/availability.ts`

**Files:**
- Create: `src/lib/data/availability.ts`

**Step 1: Create the query functions**

Extract from:
- `src/app/games/[id]/page.tsx:157-161` — `fetchUserAvailability`
- `src/app/games/[id]/page.tsx:175-178` — `fetchAllAvailability`
- `src/app/games/[id]/page.tsx:290-301` — `upsertAvailability`
- `src/app/games/[id]/page.tsx:410-412` — `batchUpsertAvailability`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AvailabilityStatus } from '@/types';

export async function fetchUserAvailability(
  supabase: SupabaseClient,
  gameId: string,
  userId: string
) {
  return supabase
    .from('availability')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', userId);
}

export async function fetchAllAvailability(supabase: SupabaseClient, gameId: string) {
  return supabase.from('availability').select('*').eq('game_id', gameId);
}

export async function upsertAvailability(
  supabase: SupabaseClient,
  params: {
    user_id: string;
    game_id: string;
    date: string;
    status: AvailabilityStatus;
    comment: string | null;
    available_after: string | null;
    available_until: string | null;
  }
) {
  return supabase
    .from('availability')
    .upsert(params, { onConflict: 'user_id,game_id,date' });
}

export async function batchUpsertAvailability(
  supabase: SupabaseClient,
  rows: {
    user_id: string;
    game_id: string;
    date: string;
    status: AvailabilityStatus;
    comment: string | null;
    available_after: string | null;
    available_until: string | null;
  }[]
) {
  return supabase
    .from('availability')
    .upsert(rows, { onConflict: 'user_id,game_id,date' });
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/data/availability.ts
git commit -m "refactor: extract availability query functions to data layer"
```

---

### Task 4: Create `src/lib/data/sessions.ts`

**Files:**
- Create: `src/lib/data/sessions.ts`

**Step 1: Create the query functions**

Extract from:
- `src/app/games/[id]/page.tsx:183-187` — `fetchGameSessions`
- `src/app/games/[id]/page.tsx:473-487` — `confirmSession`
- `src/app/games/[id]/page.tsx:516-520` — `cancelSession`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameSession } from '@/types';

export async function fetchGameSessions(supabase: SupabaseClient, gameId: string) {
  return supabase
    .from('sessions')
    .select('*')
    .eq('game_id', gameId)
    .order('date', { ascending: true });
}

export async function confirmSession(
  supabase: SupabaseClient,
  params: {
    game_id: string;
    date: string;
    start_time: string;
    end_time: string;
    confirmed_by: string;
  }
) {
  return supabase
    .from('sessions')
    .upsert(
      { ...params, status: 'confirmed' as const },
      { onConflict: 'game_id,date' }
    )
    .select()
    .single<GameSession>();
}

export async function cancelSession(
  supabase: SupabaseClient,
  gameId: string,
  date: string
) {
  return supabase.from('sessions').delete().eq('game_id', gameId).eq('date', date);
}

export async function fetchFutureSessions(
  supabase: SupabaseClient,
  gameId: string,
  fromDate: string
) {
  return supabase
    .from('sessions')
    .select('date')
    .eq('game_id', gameId)
    .gte('date', fromDate);
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/data/sessions.ts
git commit -m "refactor: extract session query functions to data layer"
```

---

### Task 5: Create `src/lib/data/playDates.ts`

**Files:**
- Create: `src/lib/data/playDates.ts`

**Step 1: Create the query functions**

Extract from:
- `src/app/games/[id]/page.tsx:192-195` — `fetchGamePlayDates`
- `src/app/games/[id]/page.tsx:671-675` — `addPlayDate`
- `src/app/games/[id]/page.tsx:647-650` — `removePlayDate`
- `src/app/games/[id]/page.tsx:701-705` — `updatePlayDateNote`
- `src/app/games/[id]/page.tsx:721-728` — `upsertPlayDate`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GamePlayDate } from '@/types';

export async function fetchGamePlayDates(supabase: SupabaseClient, gameId: string) {
  return supabase.from('game_play_dates').select('*').eq('game_id', gameId);
}

export async function addPlayDate(
  supabase: SupabaseClient,
  gameId: string,
  date: string
) {
  return supabase
    .from('game_play_dates')
    .insert({ game_id: gameId, date, note: null })
    .select()
    .single<GamePlayDate>();
}

export async function removePlayDate(
  supabase: SupabaseClient,
  gameId: string,
  date: string
) {
  return supabase
    .from('game_play_dates')
    .delete()
    .eq('game_id', gameId)
    .eq('date', date);
}

export async function updatePlayDateNote(
  supabase: SupabaseClient,
  gameId: string,
  date: string,
  note: string | null
) {
  return supabase
    .from('game_play_dates')
    .update({ note })
    .eq('game_id', gameId)
    .eq('date', date);
}

export async function upsertPlayDate(
  supabase: SupabaseClient,
  gameId: string,
  date: string,
  note: string | null
) {
  return supabase
    .from('game_play_dates')
    .upsert({ game_id: gameId, date, note }, { onConflict: 'game_id,date' })
    .select()
    .single<GamePlayDate>();
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/data/playDates.ts
git commit -m "refactor: extract play date query functions to data layer"
```

---

### Task 6: Create `src/lib/data/users.ts` and barrel export

**Files:**
- Create: `src/lib/data/users.ts`
- Create: `src/lib/data/index.ts`

**Step 1: Create users.ts**

Extract from `src/app/settings/page.tsx:60-68`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function updateUserProfile(
  supabase: SupabaseClient,
  userId: string,
  params: {
    name: string;
    timezone: string | null;
    week_start_day: number;
    time_format: string;
  }
) {
  return supabase.from('users').update(params).eq('id', userId);
}
```

**Step 2: Create barrel export**

```ts
export * from './games';
export * from './memberships';
export * from './availability';
export * from './sessions';
export * from './playDates';
export * from './users';
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/data/
git commit -m "refactor: add users queries and barrel export for data layer"
```

---

### Task 7: Create `src/hooks/useGameDetail.ts`

**Files:**
- Create: `src/hooks/useGameDetail.ts`

This is the largest task. Extract all state management and data operations from `src/app/games/[id]/page.tsx` into a custom hook.

**Step 1: Create the hook**

The hook should:
1. Import query functions from `@/lib/data`
2. Own the state: `game`, `loading`, `refreshing`, `availability`, `allAvailability`, `sessions`, `gamePlayDates`, `otherGames`
3. Implement `fetchData` using query functions (same as `page.tsx:124-223`)
4. Implement all mutation handlers with optimistic updates (same logic as `page.tsx:270-740`)
5. Accept `gameId` and `userId` as parameters
6. Return state + action functions

The hook body is a mechanical extraction — move the following from `page.tsx` into the hook:
- State declarations (lines 55-76, excluding UI-only state like `activeTab`, `copied`, modal flags)
- `fetchData` callback (lines 124-223), replacing inline queries with data layer calls
- `handleRefresh` (lines 231-235)
- `handleAvailabilityChange` (lines 270-343)
- `handleCopyFromGame` (lines 346-443)
- `handleConfirmSession` (lines 446-511)
- `handleCancelSession` (lines 513-525)
- `handleRegenerateInvite` (lines 535-557, but remove `isRegenerating`/`setShowRegenerateConfirm` — those are UI state that stays in the page)
- `handleLeaveGame` (lines 559-575, but return success boolean instead of calling `router.push`)
- `handleRemovePlayer` (lines 577-598)
- `handleDeleteGame` (lines 600-612, return success boolean)
- `handleToggleCoGm` (lines 614-634)
- `handleToggleExtraDate` (lines 636-687)
- `handleUpdatePlayDateNote` (lines 689-740)

Key changes vs. the original code:
- Replace inline `supabase.from(...)` calls with data layer function calls
- Navigation side effects (`router.push`) stay in the page component. Mutation functions return `boolean` or `{ success, error }` so the page can decide what to do.
- UI state (modal flags, `isLeaving`, `isDeleting`, `isRegenerating`, `copied`) stays in the page component.

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/hooks/useGameDetail.ts
git commit -m "refactor: create useGameDetail hook with data layer queries"
```

---

### Task 8: Migrate game detail page to use `useGameDetail`

**Files:**
- Modify: `src/app/games/[id]/page.tsx`

**Step 1: Replace inline data logic with hook**

1. Remove `createClient` import and `supabase` instantiation
2. Remove all state declarations that moved to the hook
3. Add `const { game, loading, ... } = useGameDetail(gameId, profile?.id ?? '')` after `useAuthRedirect()`
4. Keep: `activeTab`, `copied`, `playerToRemove`, `showLeaveConfirm`, `isLeaving`, `showDeleteConfirm`, `isDeleting`, `showRegenerateConfirm`, `isRegenerating`, `showLeaveConfirm` state
5. Keep: all `useMemo` derivations (`playDateEntries`, `extraDateStrings`, `playDateNotes`, `playerCompletionPercentages`, suggestions `useEffect`)
6. Wrap mutation calls from the hook with the remaining UI state management. For example:

```ts
// Before (all inline):
const handleDeleteGame = async () => {
  setIsDeleting(true);
  const { error } = await supabase.from('games').delete().eq('id', gameId);
  if (!error) { router.push('/dashboard'); }
  else { setIsDeleting(false); setShowDeleteConfirm(false); }
};

// After (hook + page):
const handleDeleteGame = async () => {
  setIsDeleting(true);
  const success = await deleteGame();  // from hook
  if (success) { router.push('/dashboard'); }
  else { setIsDeleting(false); setShowDeleteConfirm(false); }
};
```

7. Remove `fetchData`, `handleRefresh` (use `refresh` from hook)
8. Keep all JSX unchanged

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Verify app works**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/games/[id]/page.tsx
git commit -m "refactor: migrate game detail page to useGameDetail hook"
```

---

### Task 9: Migrate dashboard to use data layer

**Files:**
- Modify: `src/components/dashboard/DashboardContent.tsx`

**Step 1: Replace inline queries**

Replace the `fetchGames` function body (lines 30-88) with calls to:
- `fetchUserMemberships(supabase, profile.id)`
- `fetchUserGmGames(supabase, profile.id)`
- `fetchMembershipCount(supabase, game.id)` (in the Promise.all loop)

Import from `@/lib/data`. Keep `createClient` import since this page uses the client directly (no hook needed).

**Step 2: Verify it compiles and builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardContent.tsx
git commit -m "refactor: migrate dashboard to data layer queries"
```

---

### Task 10: Migrate new game page to use data layer

**Files:**
- Modify: `src/app/games/new/page.tsx`

**Step 1: Replace inline queries**

Replace:
- Game count query (lines 64-67) with `fetchUserGameCount(supabase, profile.id)`
- Game creation (lines 98-131) with `createGame(supabase, params)`

**Step 2: Verify it compiles and builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/games/new/page.tsx
git commit -m "refactor: migrate new game page to data layer queries"
```

---

### Task 11: Migrate edit game page to use data layer

**Files:**
- Modify: `src/app/games/[id]/edit/page.tsx`

**Step 1: Replace inline queries**

Replace:
- Game fetch (lines 43-47) with `fetchGameWithGM(supabase, gameId)` (note: edit page only uses `Game` fields, not the GM, but this is fine)
- Co-GM check (lines 59-64) with `checkCoGmStatus(supabase, gameId, profile.id)`
- Future sessions fetch (lines 116-120) with `fetchFutureSessions(supabase, gameId, today)`
- Play date upsert (line 127) with `upsertPlayDate(supabase, gameId, date, null)`
- Game update (lines 135-148) with `updateGame(supabase, gameId, params)`

Note: Edit page fetches `select('*')` not `select('*, gm:...')`. Either use `fetchGameWithGM` and ignore the GM field, or keep the simpler query inline. Prefer using `fetchGameWithGM` for consistency — the extra join is negligible.

**Step 2: Verify it compiles and builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/games/[id]/edit/page.tsx
git commit -m "refactor: migrate edit game page to data layer queries"
```

---

### Task 12: Migrate join, settings, and navbar to use data layer

**Files:**
- Modify: `src/app/games/join/[code]/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/components/layout/Navbar.tsx`

**Step 1: Migrate join page**

Replace the membership insert (line 81-84) with `joinGame(supabase, game.id, profile.id)`.

**Step 2: Migrate settings page**

Replace the user update (lines 60-68) with `updateUserProfile(supabase, profile.id, params)`.

**Step 3: Migrate navbar**

Replace the two count queries (lines 169-171 area) with `fetchMembershipCount(supabase, gameId)` and `fetchUserGameCount(supabase, profile.id)`. Note: Navbar currently runs two separate count queries. Replace with the data layer equivalents.

**Step 4: Verify it compiles and builds**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/games/join/[code]/page.tsx src/app/settings/page.tsx src/components/layout/Navbar.tsx
git commit -m "refactor: migrate join, settings, and navbar to data layer queries"
```

---

### Task 13: Run full test suite and verify

**Files:**
- No changes

**Step 1: Run unit tests**

Run: `npm run test:run`
Expected: All existing tests pass (this is a pure refactor — no behavior changes)

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build, no errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors (may need to add eslint-disable for supabase in hook deps)

**Step 4: Run E2E tests (if available)**

Run: `npx playwright test --project=chromium`
Expected: All existing E2E tests pass

---

### Task 14: Clean up unused imports

**Files:**
- Modify: any files with unused `createClient` imports after migration

**Step 1: Check for unused imports**

After all migrations, the game detail page should no longer import `createClient` from `@/lib/supabase/client`. Verify and remove any unused imports across all migrated files.

**Step 2: Final lint check**

Run: `npm run lint`

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: clean up unused imports after data layer migration"
```
