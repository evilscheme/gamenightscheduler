// Shared API request/response contract types.
//
// Single source of truth for shapes that cross the route-handler <-> client
// boundary. Both sides import from here — never re-declare these locally
// (duplicated declarations drift silently; that is how the admin page ended up
// disagreeing with its route about created_at nullability).

import type { HealthBreakdown, HealthGrade } from '@/lib/gameHealth';

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
  lastActivity: string | null;
  healthScore: number;
  healthGrade: HealthGrade;
  healthLabel: string;
  healthBreakdown: HealthBreakdown;
}
