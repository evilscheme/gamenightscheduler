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

// Default timezone for new games (used when browser detection fails)
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// Common timezones for the dropdown (grouped by region)
export const TIMEZONE_OPTIONS = [
  // North America
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  // Europe
  { value: 'Europe/London', label: 'UK Time (London)' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)' },
  { value: 'Europe/Berlin', label: 'Central European Time (Berlin)' },
  // Asia/Pacific
  { value: 'Asia/Tokyo', label: 'Japan Time (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'China Time (Shanghai)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)' },
  // UTC
  { value: 'UTC', label: 'UTC' },
] as const;
