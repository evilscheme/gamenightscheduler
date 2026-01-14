/**
 * Generate an ICS (iCalendar) file content for calendar export
 */

interface CalendarEvent {
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM or HH:MM:SS
  endTime?: string; // HH:MM or HH:MM:SS
  title: string;
  description?: string;
  location?: string;
}

export function generateICS(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quest Calendar//D&D Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event, index) => {
    const dateStr = event.date.replace(/-/g, '');
    const uid = `${dateStr}-${index}@questcalendar.app`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);

    // Use timed event if start/end times provided, otherwise all-day
    if (event.startTime && event.endTime) {
      const startTimeStr = event.startTime.replace(/:/g, '').slice(0, 6).padEnd(6, '0');
      const endTimeStr = event.endTime.replace(/:/g, '').slice(0, 6).padEnd(6, '0');
      lines.push(`DTSTART:${dateStr}T${startTimeStr}`);
      lines.push(`DTEND:${dateStr}T${endTimeStr}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
      lines.push(`DTEND;VALUE=DATE:${dateStr}`);
    }

    lines.push(`SUMMARY:${escapeICS(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
