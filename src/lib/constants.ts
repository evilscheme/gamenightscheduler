// Shared constants for day-of-week labels and options

export const DAY_LABELS = {
  full: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  abbrev: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
} as const;

// Day options for select inputs (value is day number 0-6, label is full name)
export const DAY_OPTIONS = DAY_LABELS.full.map((label, value) => ({ value, label }));

// Timeout values (in milliseconds)
export const TIMEOUTS = {
  AUTH_STATE_FALLBACK: 1000,
  PROFILE_FETCH: 5000,
  NOTIFICATION: 2000,
} as const;

// Default session times
export const SESSION_DEFAULTS = {
  START_TIME: '18:00',
  END_TIME: '22:00',
} as const;

// Usage limits to prevent abuse
export const USAGE_LIMITS = {
  MAX_GAMES_PER_USER: 20,
  MAX_PLAYERS_PER_GAME: 50,
  MAX_FUTURE_SESSIONS_PER_GAME: 100,
} as const;

// Text field length limits
export const TEXT_LIMITS = {
  GAME_NAME: 100,
  GAME_DESCRIPTION: 1000,
  USER_DISPLAY_NAME: 50,
} as const;
