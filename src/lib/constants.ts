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
  BACKEND_ERROR_DEBOUNCE: 2000,
  BACKEND_HEALTH_RECHECK: 30000,
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
  PLAY_DATE_NOTE: 200,
  USER_DISPLAY_NAME: 50,
} as const;

// Default timezone for new games (used when browser detection fails)
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// Timezone groups for dropdown with <optgroup> rendering
export const TIMEZONE_GROUPS = [
  {
    label: 'North America',
    options: [
      { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
      { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
      { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
      { value: 'America/Denver', label: 'Mountain Time (Denver)' },
      { value: 'America/Chicago', label: 'Central Time (Chicago)' },
      { value: 'America/New_York', label: 'Eastern Time (New York)' },
      { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
    ],
  },
  {
    label: 'Central & South America',
    options: [
      { value: 'America/Mexico_City', label: 'Mexico City' },
      { value: 'America/Bogota', label: 'Colombia (Bogota)' },
      { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo)' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
    ],
  },
  {
    label: 'Europe',
    options: [
      { value: 'Europe/London', label: 'UK (London)' },
      { value: 'Europe/Dublin', label: 'Ireland (Dublin)' },
      { value: 'Europe/Paris', label: 'France (Paris)' },
      { value: 'Europe/Berlin', label: 'Germany (Berlin)' },
      { value: 'Europe/Madrid', label: 'Spain (Madrid)' },
      { value: 'Europe/Rome', label: 'Italy (Rome)' },
      { value: 'Europe/Amsterdam', label: 'Netherlands (Amsterdam)' },
      { value: 'Europe/Stockholm', label: 'Sweden (Stockholm)' },
      { value: 'Europe/Warsaw', label: 'Poland (Warsaw)' },
      { value: 'Europe/Helsinki', label: 'Finland (Helsinki)' },
      { value: 'Europe/Athens', label: 'Greece (Athens)' },
      { value: 'Europe/Bucharest', label: 'Romania (Bucharest)' },
      { value: 'Europe/Istanbul', label: 'Turkey (Istanbul)' },
      { value: 'Europe/Moscow', label: 'Russia (Moscow)' },
    ],
  },
  {
    label: 'Africa',
    options: [
      { value: 'Africa/Lagos', label: 'West Africa (Lagos)' },
      { value: 'Africa/Cairo', label: 'Egypt (Cairo)' },
      { value: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)' },
    ],
  },
  {
    label: 'Middle East & South Asia',
    options: [
      { value: 'Asia/Dubai', label: 'Gulf (Dubai)' },
      { value: 'Asia/Karachi', label: 'Pakistan (Karachi)' },
      { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
    ],
  },
  {
    label: 'East & Southeast Asia',
    options: [
      { value: 'Asia/Bangkok', label: 'Indochina (Bangkok)' },
      { value: 'Asia/Singapore', label: 'Singapore' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
      { value: 'Asia/Shanghai', label: 'China (Shanghai)' },
      { value: 'Asia/Seoul', label: 'South Korea (Seoul)' },
      { value: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
    ],
  },
  {
    label: 'Oceania',
    options: [
      { value: 'Australia/Perth', label: 'Western Australia (Perth)' },
      { value: 'Australia/Sydney', label: 'Eastern Australia (Sydney)' },
      { value: 'Pacific/Auckland', label: 'New Zealand (Auckland)' },
    ],
  },
  {
    label: 'Other',
    options: [
      { value: 'UTC', label: 'UTC' },
    ],
  },
  {
    label: 'UTC Offsets',
    options: [
      { value: 'Etc/GMT+11', label: 'UTC-11' },
      { value: 'Etc/GMT+10', label: 'UTC-10' },
      { value: 'Etc/GMT+9', label: 'UTC-9' },
      { value: 'Etc/GMT+8', label: 'UTC-8' },
      { value: 'Etc/GMT+7', label: 'UTC-7' },
      { value: 'Etc/GMT+6', label: 'UTC-6' },
      { value: 'Etc/GMT+5', label: 'UTC-5' },
      { value: 'Etc/GMT+4', label: 'UTC-4' },
      { value: 'Etc/GMT+3', label: 'UTC-3' },
      { value: 'Etc/GMT+2', label: 'UTC-2' },
      { value: 'Etc/GMT+1', label: 'UTC-1' },
      { value: 'Etc/GMT0', label: 'UTC+0' },
      { value: 'Etc/GMT-1', label: 'UTC+1' },
      { value: 'Etc/GMT-2', label: 'UTC+2' },
      { value: 'Etc/GMT-3', label: 'UTC+3' },
      { value: 'Etc/GMT-4', label: 'UTC+4' },
      { value: 'Etc/GMT-5', label: 'UTC+5' },
      { value: 'Etc/GMT-6', label: 'UTC+6' },
      { value: 'Etc/GMT-7', label: 'UTC+7' },
      { value: 'Etc/GMT-8', label: 'UTC+8' },
      { value: 'Etc/GMT-9', label: 'UTC+9' },
      { value: 'Etc/GMT-10', label: 'UTC+10' },
      { value: 'Etc/GMT-11', label: 'UTC+11' },
      { value: 'Etc/GMT-12', label: 'UTC+12' },
    ],
  },
] as const;

// Flat list of all timezone options (for validation and backward compat)
export const TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = TIMEZONE_GROUPS.flatMap(g => [...g.options]);

// User preference options
export const WEEK_START_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
] as const;

export const TIME_FORMAT_OPTIONS = [
  { value: '12h', label: '12-hour (2:30 PM)' },
  { value: '24h', label: '24-hour (14:30)' },
] as const;
