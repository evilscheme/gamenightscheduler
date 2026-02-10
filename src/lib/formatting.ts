/**
 * Format a 24-hour time string to 12-hour format with AM/PM, or keep as 24h
 * @param time - Time in "HH:MM" or "HH:MM:SS" format
 * @param use24h - If true, return 24-hour format instead of 12-hour
 * @returns Formatted time like "2:30 PM" or "14:30", or empty string if null/empty
 */
export function formatTime(time: string | null, use24h: boolean = false): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  if (use24h) {
    return `${h}:${minutes}`;
  }
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

/**
 * Format a time string to compact display (e.g., "7pm", "7:30pm" or "19:00", "19:30")
 * Omits minutes when they are :00
 * @param time - Time in "HH:MM" or "HH:MM:SS" format
 * @param use24h - If true, return 24-hour format
 * @returns Compact formatted time, or empty string if null/empty
 */
export function formatTimeShort(time: string | null, use24h: boolean = false): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (use24h) {
    return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`;
  }
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${minutes}${ampm}`;
}
