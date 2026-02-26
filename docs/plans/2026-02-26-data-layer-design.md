# Data Layer Extraction Design

## Problem

The app mixes direct Supabase queries inline in components with API routes and a single server action. The direct queries are scattered across 8 files with no shared data access layer. The game detail page alone has 21 inline Supabase operations in 1085 lines. This makes maintenance harder and creates no single place to find or modify data access patterns.

## Approach: Query Functions + Thin Hook (Approach C)

Extract all direct Supabase queries into plain async functions organized by domain entity in `src/lib/data/`. Add one hook (`useGameDetail`) for the game detail page, which needs complex state orchestration (optimistic updates, cross-state sync). Other pages call query functions directly since their state management is simple.

## Query Function Layer

### `src/lib/data/games.ts`

| Function | Params | Returns | Used by |
|---|---|---|---|
| `fetchGameWithGM` | `supabase, gameId` | `{ data: GameWithGM \| null, error }` | game detail, edit game |
| `fetchUserGmGames` | `supabase, userId` | `{ data: GameWithGM[], error }` | dashboard |
| `fetchUserGameCount` | `supabase, userId` | `{ count: number \| null, error }` | new game, navbar |
| `createGame` | `supabase, params` | `{ data: { id: string } \| null, error }` | new game |
| `updateGame` | `supabase, gameId, params` | `{ error }` | edit game |
| `deleteGame` | `supabase, gameId` | `{ error }` | game detail (via hook) |
| `regenerateInviteCode` | `supabase, gameId, newCode` | `{ error }` | game detail (via hook) |

### `src/lib/data/memberships.ts`

| Function | Params | Returns | Used by |
|---|---|---|---|
| `fetchGameMembers` | `supabase, gameId` | `{ data: MemberWithRole[], error }` | game detail (via hook) |
| `fetchUserMemberships` | `supabase, userId` | `{ data: { game_id, is_co_gm }[], error }` | dashboard |
| `fetchMembershipCount` | `supabase, gameId` | `{ count: number \| null, error }` | dashboard, navbar |
| `fetchUserOtherGames` | `supabase, userId, excludeGameId` | `{ data: { id, name }[], error }` | game detail (via hook) |
| `joinGame` | `supabase, gameId, userId` | `{ error }` | join game |
| `leaveGame` | `supabase, gameId, userId` | `{ error }` | game detail (via hook) |
| `removePlayer` | `supabase, gameId, userId` | `{ error }` | game detail (via hook) |
| `toggleCoGm` | `supabase, gameId, userId, isCoGm` | `{ error }` | game detail (via hook) |
| `checkCoGmStatus` | `supabase, gameId, userId` | `{ data: boolean, error }` | edit game |

### `src/lib/data/availability.ts`

| Function | Params | Returns | Used by |
|---|---|---|---|
| `fetchUserAvailability` | `supabase, gameId, userId` | `{ data: Availability[], error }` | game detail (via hook) |
| `fetchAllAvailability` | `supabase, gameId` | `{ data: Availability[], error }` | game detail (via hook) |
| `upsertAvailability` | `supabase, params` | `{ error }` | game detail (via hook) |
| `batchUpsertAvailability` | `supabase, rows` | `{ error }` | game detail (via hook) |

### `src/lib/data/sessions.ts`

| Function | Params | Returns | Used by |
|---|---|---|---|
| `fetchGameSessions` | `supabase, gameId` | `{ data: GameSession[], error }` | game detail (via hook), edit game |
| `confirmSession` | `supabase, params` | `{ data: GameSession \| null, error }` | game detail (via hook) |
| `cancelSession` | `supabase, gameId, date` | `{ error }` | game detail (via hook) |

### `src/lib/data/playDates.ts`

| Function | Params | Returns | Used by |
|---|---|---|---|
| `fetchGamePlayDates` | `supabase, gameId` | `{ data: GamePlayDate[], error }` | game detail (via hook) |
| `addPlayDate` | `supabase, gameId, date` | `{ data: GamePlayDate \| null, error }` | game detail (via hook) |
| `removePlayDate` | `supabase, gameId, date` | `{ error }` | game detail (via hook) |
| `updatePlayDateNote` | `supabase, gameId, date, note` | `{ error }` | game detail (via hook) |
| `upsertPlayDate` | `supabase, gameId, date, note` | `{ data: GamePlayDate \| null, error }` | game detail (via hook), edit game |

### `src/lib/data/users.ts`

| Function | Params | Returns | Used by |
|---|---|---|---|
| `updateUserProfile` | `supabase, userId, params` | `{ error }` | settings |

### `src/lib/data/index.ts`

Barrel export re-exporting all functions from the above modules.

## Hook: `useGameDetail`

### Location

`src/hooks/useGameDetail.ts`

### Interface

```ts
function useGameDetail(gameId: string, userId: string): {
  // State
  game: GameWithMembers | null;
  loading: boolean;
  refreshing: boolean;
  availability: Record<string, AvailabilityEntry>;
  allAvailability: Availability[];
  sessions: GameSession[];
  gamePlayDates: GamePlayDate[];
  otherGames: { id: string; name: string }[];

  // Actions
  refresh: () => Promise<void>;
  changeAvailability: (...) => Promise<void>;
  copyFromGame: (sourceGameId: string) => Promise<number>;
  confirmSession: (date, startTime, endTime) => Promise<{ success: boolean; error?: string }>;
  cancelSession: (date: string) => Promise<void>;
  regenerateInvite: () => Promise<void>;
  leaveGame: () => Promise<boolean>;
  removePlayer: (playerId: string) => Promise<boolean>;
  deleteGame: () => Promise<boolean>;
  toggleCoGm: (playerId: string, makeCoGm: boolean) => Promise<boolean>;
  toggleExtraDate: (date: string) => Promise<void>;
  updatePlayDateNote: (date: string, note: string | null) => Promise<void>;
}
```

### Behavior

- Calls query functions from `src/lib/data/` for all DB operations
- Manages optimistic updates with revert-on-error (same logic as current page.tsx)
- Owns loading/refreshing state
- Does NOT own: tab state, modal state, suggestions calculation, completion percentages, or any UI concerns

### What stays in the page component

- `useAuthRedirect()`, router, params, user preferences
- `useGameDetail(gameId, userId)` call
- Derived/computed values (`isGm`, `isCoGm`, `suggestions`, `playerCompletionPercentages`, `playDateEntries`, etc.) as `useMemo`
- Tab state and UI state (modals, copied flag, isLeaving, isDeleting, etc.)
- All JSX

## Per-page migration summary

| Page | Before | After |
|---|---|---|
| Game detail | 21 inline queries, ~740 lines of data logic | `useGameDetail()` hook, ~300 lines |
| Dashboard | 4 inline queries (N+1 pattern) | `fetchUserMemberships()` + `fetchUserGmGames()` + `fetchMembershipCount()` |
| New game | 3 inline queries | `fetchUserGameCount()` + `createGame()` |
| Edit game | 5 inline queries | `fetchGameWithGM()` + `checkCoGmStatus()` + `fetchGameSessions()` + `upsertPlayDate()` + `updateGame()` |
| Join game | 1 inline query | `joinGame()` |
| Settings | 1 inline query | `updateUserProfile()` |
| Navbar | 2 inline queries | `fetchMembershipCount()` + `fetchUserGameCount()` |

## What doesn't change

- API routes (admin client, different concern)
- AuthContext profile fetch (auth-adjacent)
- Dev-login server action (dev-only)
- RLS policies (no DB changes)
- Optimistic update UX (same behavior, relocated)
