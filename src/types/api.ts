// Shared API request/response contract types.
//
// Single source of truth for shapes that cross the route-handler <-> client
// boundary. Both sides import from here — never re-declare these locally
// (duplicated declarations drift silently; that is how the admin page ended up
// disagreeing with its route about created_at nullability).

import type { DeletionBucket, DormancyBucket, FunnelCohort, HealthBucket, PlatformCounts, ViableDate } from '@/lib/admin';

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
  healthBucket: HealthBucket;
  /** The earliest date enough players can make, when healthBucket is 'healthyViable'. */
  viableDate: ViableDate | null;
}

export interface AdminGamesResponse {
  games: GameWithEngagement[];
  /** Users and games right now, by health bucket (src/lib/admin/platformHealth.ts). */
  health: PlatformCounts;
}

// --- /api/admin/health-trends ---

/** The platform at the end of a rolling window's last day. */
export interface HealthTrendPoint {
  windowEnd: string;
  /** 'snapshot' = captured within a day; 'reconstructed' = rebuilt later from row
   *  timestamps, so it undercounts anything deleted since. Null with `counts`
   *  when no row exists for the day (before the first signup, or a missed run). */
  source: 'snapshot' | 'reconstructed' | null;
  counts: PlatformCounts | null;
}

export interface AdminHealthTrends {
  health: HealthTrendPoint[];
  funnel: FunnelCohort[];
  dormancy: DormancyBucket[];
  deletions: DeletionBucket[];
}
