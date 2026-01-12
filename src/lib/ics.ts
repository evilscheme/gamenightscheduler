/**
 * Generate an ICS (iCalendar) file content for calendar export
 */

interface CalendarEvent {
  date: string; // YYYY-MM-DD
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
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    lines.push(`DTEND;VALUE=DATE:${dateStr}`);
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

/**
 * Generate a Google Calendar URL for adding an event
 */
export function generateGoogleCalendarURL(event: CalendarEvent): string {
  const baseURL = 'https://calendar.google.com/calendar/render';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${event.date.replace(/-/g, '')}/${event.date.replace(/-/g, '')}`,
  });

  if (event.description) {
    params.set('details', event.description);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  return `${baseURL}?${params.toString()}`;
}
