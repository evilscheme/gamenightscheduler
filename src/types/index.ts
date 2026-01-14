// Database types

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_gm: boolean;
  created_at: string;
}

export interface Game {
  id: string;
  name: string;
  description: string | null;
  gm_id: string;
  play_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  invite_code: string;
  scheduling_window_months: number;
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

export type SessionStatus = 'suggested' | 'confirmed' | 'cancelled';

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

export interface GameWithMembers extends Game {
  gm: User;
  members: User[];
}

// Form types

export interface CreateGameInput {
  name: string;
  description?: string;
  play_days: number[];
  scheduling_window_months: number;
}

// Scheduling types

export interface DateSuggestion {
  date: string;
  dayOfWeek: number;
  availableCount: number;
  maybeCount: number;
  unavailableCount: number;
  pendingCount: number;
  totalPlayers: number;
  availablePlayers: User[];
  maybePlayers: { user: User; comment: string | null }[];
  unavailablePlayers: User[];
  pendingPlayers: User[];
}
