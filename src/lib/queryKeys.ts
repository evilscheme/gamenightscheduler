/**
 * Central registry of React Query cache keys.
 *
 * Every useQuery/setQueryData/invalidateQueries call must build its key here so
 * that producers and invalidators can never drift apart. Keys are hierarchical:
 * invalidating a prefix (e.g. `['dashboard']`) invalidates every user's entry.
 */
export const queryKeys = {
  /** Dashboard bundle: the user's games (with member counts) + upcoming sessions. */
  dashboard: (userId: string) => ['dashboard', userId] as const,
  /** Lightweight {id, name} list of every game the user is in (GM or player). */
  myGamesLite: (userId: string) => ['myGamesLite', userId] as const,
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
} as const;
