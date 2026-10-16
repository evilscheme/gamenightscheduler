// Shared API request/response contract types.
//
// Single source of truth for shapes that cross the route-handler <-> client
// boundary. Both sides import from here — never re-declare these locally
// (duplicated declarations drift silently; that is how the admin page ended up
// disagreeing with its route about created_at nullability).

import type { DeletionBucket, DormancyBucket, FunnelCohort, GameState, HealthyBy, ViableDate } from '@/lib/admin';

// --- /api/account/delete-preview ---

export interface OwnedGameMember {
  id: string;
  name: string;
}

export interface OwnedGame {
  id: string;
  name: string;
  members: OwnedGameMember[];
}

export interface PlayerMembershipGame {
  id: string;
  name: string;
}

export interface DeletePreview {
  ownedGames: OwnedGame[];
  playerMembershipCount: number;
  playerMembershipGames: PlayerMembershipGame[];
}

// --- /api/admin/stats ---

export interface AdminStats {
  totalUsers: number;
  totalGames: number;
  totalSessions: number;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    is_gm: boolean;
    is_admin: boolean;
    created_at: string;
  }>;
  recentGames: Array<{
    id: string;
    name: string;
    created_at: string;
    gm: { name: string } | null;
  }>;
}

// --- /api/admin/games ---

export interface GameWithEngagement {
  id: string;
  name: string;
  created_at: string | null;
  gm: { id: string; name: string; email: string } | null;
  playerCount: number;
  sessionCount: number;
  futureSessionCount: number;
  availabilityFillRate: number;
  /** Latest activity of any kind: a join, booking, availability, extra date. */
  lastActivity: string | null;
  /** Right now, by the same rules as the platform-health charts. */
  healthState: GameState;
  /** What made it healthy, when it is. */
  healthyBy: HealthyBy | null;
  /** The earliest date enough players can make, when healthyBy is 'viableDate'. */
  viableDate: ViableDate | null;
}

/** Users right now by health state (see src/lib/admin/platformHealth.ts).
 *  Churned users are total minus the three states. */
export interface UserHealthCounts {
  total: number;
  /** Healthy = booked + viable (see HealthyBy). */
  healthyBooked: number;
  healthyViable: number;
  gettingGoing: number;
  unhealthy: number;
}

export interface AdminGamesResponse {
  games: GameWithEngagement[];
  users: UserHealthCounts;
}

// --- /api/admin/health-trends ---

/** Platform state at the end of a rolling window's last day. Null fields mean no
 *  row exists for that day (before the first signup). */
export interface HealthTrendPoint {
  windowEnd: string;
  /** 'snapshot' = captured within a day; 'reconstructed' = rebuilt later from row
   *  timestamps, so it undercounts anything deleted since. */
  source: 'snapshot' | 'reconstructed' | null;
  /** States as defined in src/lib/admin/platformHealth.ts. Churned users and
   *  dormant games are total minus the three states. */
  totalUsers: number | null;
  /** Healthy = booked + viable (see HealthyBy). */
  healthyBookedUsers: number | null;
  healthyViableUsers: number | null;
  gettingGoingUsers: number | null;
  unhealthyUsers: number | null;
  totalGames: number | null;
  healthyBookedGames: number | null;
  healthyViableGames: number | null;
  gettingGoingGames: number | null;
  unhealthyGames: number | null;
}

export interface AdminHealthTrends {
  health: HealthTrendPoint[];
  funnel: FunnelCohort[];
  dormancy: DormancyBucket[];
  deletions: DeletionBucket[];
}
