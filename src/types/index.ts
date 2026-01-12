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

export interface GameMembership {
  id: string;
  game_id: string;
  user_id: string;
  joined_at: string;
}

export interface Availability {
  id: string;
  user_id: string;
  game_id: string;
  date: string; // ISO date string
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = 'suggested' | 'confirmed' | 'cancelled';

export interface GameSession {
  id: string;
  game_id: string;
  date: string; // ISO date string
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

export interface AvailabilityWithUser extends Availability {
  user: User;
}

// Form types

export interface CreateGameInput {
  name: string;
  description?: string;
  play_days: number[];
  scheduling_window_months: number;
}

export interface UpdateAvailabilityInput {
  game_id: string;
  dates: { date: string; is_available: boolean }[];
}

// Scheduling types

export interface DateSuggestion {
  date: string;
  dayOfWeek: number;
  availableCount: number;
  totalPlayers: number;
  availablePlayers: User[];
  unavailablePlayers: User[];
}
