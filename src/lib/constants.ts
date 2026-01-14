// Shared constants for day-of-week labels and options

export const DAY_LABELS = {
  full: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  abbrev: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
} as const;

// Day options for select inputs (value is day number 0-6, label is full name)
export const DAY_OPTIONS = DAY_LABELS.full.map((label, value) => ({ value, label }));
