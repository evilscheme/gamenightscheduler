import type { QueryClient } from '@tanstack/react-query';

/**
 * Central registry of React Query cache keys.
 *
 * Every useQuery/setQueryData/invalidateQueries call must build its key here so
 * that producers and invalidators can never drift apart. Keys are hierarchical:
 * invalidating a prefix (e.g. `queryKeys.dashboardAll`) invalidates every
 * user's entry — prefixes are exported from here too, never written inline.
 */
export const queryKeys = {
  /** Dashboard bundle: the user's games (with member counts) + upcoming sessions. */
  dashboard: (userId: string) => ['dashboard', userId] as const,
  /** Prefix matching every user's dashboard entry (for invalidation). */
  dashboardAll: ['dashboard'] as const,
  /** Lightweight {id, name} list of every game the user is in (GM or player). */
  myGamesLite: (userId: string) => ['myGamesLite', userId] as const,
  /** Prefix matching every user's my-games list (for invalidation). */
  myGamesLiteAll: ['myGamesLite'] as const,
  /** A single game with GM profile and member list. */
  game: (gameId: string) => ['game', gameId] as const,
  /** All availability rows for a game (every player). */
  availability: (gameId: string) => ['availability', gameId] as const,
  /** All sessions for a game. */
  sessions: (gameId: string) => ['sessions', gameId] as const,
  /** Special play dates for a game. */
  playDates: (gameId: string) => ['playDates', gameId] as const,
  /** The user's weekly default availability rows. */
  userDefaults: (userId: string) => ['userDefaults', userId] as const,
  /** Upcoming sessions across a set of games (order-insensitive). */
  otherGameSessions: (gameIds: string[]) =>
    ['otherGameSessions', [...gameIds].sort().join('|')] as const,
  /** How many games the user hosts (drives the 20-game limit gate). */
  userGameCount: (userId: string) => ['userGameCount', userId] as const,
  /** Prefix matching every user's game count (for invalidation). */
  userGameCountAll: ['userGameCount'] as const,
  /** Invite-code preview for the join page. */
  gameInvite: (code: string) => ['gameInvite', code] as const,

  // ── Admin ────────────────────────────────────────────────
  // Admin reads are a separate namespace on purpose: they return
  // admin-shaped payloads (e.g. GameSnapshot) that must never share a key
  // with the player-facing equivalents above, or the two would clobber each
  // other whenever an admin views a game they also play in.

  /** Admin engagement analytics for a rolling window ('8' | '12' | '26' | 'all'). */
  adminEngagement: (weeks: string) => ['adminEngagement', weeks] as const,
  /** Platform-wide admin counters. */
  adminStats: () => ['adminStats'] as const,
  /** Admin list of every game with health grades. */
  adminGames: () => ['adminGames'] as const,
  /** Admin top-users leaderboard. */
  adminTopUsers: () => ['adminTopUsers'] as const,
  /** One page of the admin upcoming-sessions table. */
  // The viewer's timezone is part of the key because the route derives each
  // row's Today/Tomorrow badge from it — same page, different tz, different data.
  adminUpcomingSessions: (page: number, timezone: string | null) =>
    ['adminUpcomingSessions', page, timezone] as const,
  /** Full admin snapshot of a single game (NOT the same shape as `game`). */
  adminGame: (gameId: string) => ['adminGame', gameId] as const,
} as const;

/**
 * Invalidate every cached view of "which games am I in" — the dashboard bundle,
 * the my-games list, and the hosted-game count behind the usage limit. Call
 * after any mutation that changes game membership or a game's
 * existence/summary fields (create, join, leave, delete, edit, member removal,
 * session changes shown on the dashboard).
 */
export function invalidateGamesLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll });
  queryClient.invalidateQueries({ queryKey: queryKeys.myGamesLiteAll });
  queryClient.invalidateQueries({ queryKey: queryKeys.userGameCountAll });
}
