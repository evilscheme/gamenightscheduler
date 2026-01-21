/**
 * Format a 24-hour time string to 12-hour format with AM/PM
 * @param time - Time in "HH:MM" or "HH:MM:SS" format
 * @returns Formatted time like "2:30 PM" or empty string if null/empty
 */
export function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}
