// Database types

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_gm: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Game {
  id: string;
  name: string;
  description: string | null;
  gm_id: string;
  play_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  special_play_dates: string[]; // ISO date strings (YYYY-MM-DD)
  invite_code: string;
  scheduling_window_months: number;
  default_start_time: string | null; // HH:MM:SS format
  default_end_time: string | null; // HH:MM:SS format
  created_at: string;
}

export type AvailabilityStatus = 'available' | 'unavailable' | 'maybe';

export interface Availability {
  id: string;
  user_id: string;
  game_id: string;
  date: string; // ISO date string
  status: AvailabilityStatus;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

// Note: Sessions are always created as 'confirmed' and cancelled by deletion.
// The 'suggested' and 'cancelled' values existed historically but were never used.
export type SessionStatus = 'confirmed';

export interface GameSession {
  id: string;
  game_id: string;
  date: string; // ISO date string
  start_time: string | null; // HH:MM:SS format
  end_time: string | null; // HH:MM:SS format
  status: SessionStatus;
  confirmed_by: string | null;
  created_at: string;
}

// Extended types with relations

export interface GameWithGM extends Game {
  gm: User;
}

export interface MemberWithRole extends User {
  is_co_gm: boolean;
}

export interface GameWithMembers extends Game {
  gm: User;
  members: MemberWithRole[];
}

// Supabase query result types for relations
// These help document expected shapes when querying with joins.
// Note: TypeScript infers FK relations as arrays, but at runtime Supabase
// returns single objects for one-to-one relations. We use type assertions
// in the route files to handle this mismatch.

/** Result type for game queries that select only GM name via relation */
export interface GameWithGMNameResult {
  name: string;
  description: string | null;
  play_days: number[];
  gm: { name: string } | null;
}

/** Result type for game_memberships query with nested user */
export interface MembershipWithUser {
  user_id: string;
  is_co_gm: boolean;
  users: User | null;
}

// Scheduling types

export interface PlayerWithComment {
  user: User;
  comment: string | null;
}

export interface DateSuggestion {
  date: string;
  dayOfWeek: number;
  availableCount: number;
  maybeCount: number;
  unavailableCount: number;
  pendingCount: number;
  totalPlayers: number;
  availablePlayers: PlayerWithComment[];
  maybePlayers: PlayerWithComment[];
  unavailablePlayers: PlayerWithComment[];
  pendingPlayers: User[];
}
