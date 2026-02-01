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
  timezone?: string; // IANA timezone identifier (e.g., 'America/Los_Angeles')
}

/**
 * Generate VTIMEZONE component for a given timezone.
 * Calendar apps require VTIMEZONE definitions when TZID is used in DTSTART/DTEND.
 */
function generateVTimezone(tzid: string): string[] {
  // Common US timezone definitions with DST rules
  const timezones: Record<string, { std: { offset: string; abbr: string; month: number; day: string }; dst: { offset: string; abbr: string; month: number; day: string } }> = {
    'America/Los_Angeles': {
      std: { offset: '-0800', abbr: 'PST', month: 11, day: '1SU' },
      dst: { offset: '-0700', abbr: 'PDT', month: 3, day: '2SU' },
    },
    'America/Denver': {
      std: { offset: '-0700', abbr: 'MST', month: 11, day: '1SU' },
      dst: { offset: '-0600', abbr: 'MDT', month: 3, day: '2SU' },
    },
    'America/Chicago': {
      std: { offset: '-0600', abbr: 'CST', month: 11, day: '1SU' },
      dst: { offset: '-0500', abbr: 'CDT', month: 3, day: '2SU' },
    },
    'America/New_York': {
      std: { offset: '-0500', abbr: 'EST', month: 11, day: '1SU' },
      dst: { offset: '-0400', abbr: 'EDT', month: 3, day: '2SU' },
    },
    'America/Phoenix': {
      // Arizona doesn't observe DST
      std: { offset: '-0700', abbr: 'MST', month: 1, day: '1SU' },
      dst: { offset: '-0700', abbr: 'MST', month: 1, day: '1SU' },
    },
    'Pacific/Honolulu': {
      // Hawaii doesn't observe DST
      std: { offset: '-1000', abbr: 'HST', month: 1, day: '1SU' },
      dst: { offset: '-1000', abbr: 'HST', month: 1, day: '1SU' },
    },
    'America/Anchorage': {
      std: { offset: '-0900', abbr: 'AKST', month: 11, day: '1SU' },
      dst: { offset: '-0800', abbr: 'AKDT', month: 3, day: '2SU' },
    },
    'Europe/London': {
      std: { offset: '+0000', abbr: 'GMT', month: 10, day: '-1SU' },
      dst: { offset: '+0100', abbr: 'BST', month: 3, day: '-1SU' },
    },
    'Europe/Paris': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'UTC': {
      std: { offset: '+0000', abbr: 'UTC', month: 1, day: '1SU' },
      dst: { offset: '+0000', abbr: 'UTC', month: 1, day: '1SU' },
    },
  };

  const tz = timezones[tzid];
  if (!tz) {
    // Unknown timezone - return empty (events will use floating time interpretation)
    return [];
  }

  const lines: string[] = [
    'BEGIN:VTIMEZONE',
    `TZID:${tzid}`,
    `X-LIC-LOCATION:${tzid}`,
  ];

  // Add DAYLIGHT component (DST)
  if (tz.dst.offset !== tz.std.offset) {
    const dstOffsetFrom = tz.std.offset;
    lines.push(
      'BEGIN:DAYLIGHT',
      `TZOFFSETFROM:${dstOffsetFrom}`,
      `TZOFFSETTO:${tz.dst.offset}`,
      `TZNAME:${tz.dst.abbr}`,
      `DTSTART:19700101T020000`,
      `RRULE:FREQ=YEARLY;BYMONTH=${tz.dst.month};BYDAY=${tz.dst.day}`,
      'END:DAYLIGHT',
    );
  }

  // Add STANDARD component
  const stdOffsetFrom = tz.dst.offset !== tz.std.offset ? tz.dst.offset : tz.std.offset;
  lines.push(
    'BEGIN:STANDARD',
    `TZOFFSETFROM:${stdOffsetFrom}`,
    `TZOFFSETTO:${tz.std.offset}`,
    `TZNAME:${tz.std.abbr}`,
    `DTSTART:19700101T020000`,
    `RRULE:FREQ=YEARLY;BYMONTH=${tz.std.month};BYDAY=${tz.std.day}`,
    'END:STANDARD',
  );

  lines.push('END:VTIMEZONE');

  return lines;
}

export function generateICS(events: CalendarEvent[]): string {
  // Collect unique timezones used by events
  const timezones = new Set<string>();
  events.forEach((event) => {
    if (event.timezone && event.startTime && event.endTime) {
      timezones.add(event.timezone);
    }
  });

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Can We Play//Game Night Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  // Add VTIMEZONE components for all used timezones
  timezones.forEach((tz) => {
    lines.push(...generateVTimezone(tz));
  });

  events.forEach((event, index) => {
    const dateStr = event.date.replace(/-/g, '');
    const uid = `${dateStr}-${index}@canweplay.games`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);

    // Use timed event if start/end times provided, otherwise all-day
    if (event.startTime && event.endTime) {
      const startTimeStr = event.startTime.replace(/:/g, '').slice(0, 6).padEnd(6, '0');
      const endTimeStr = event.endTime.replace(/:/g, '').slice(0, 6).padEnd(6, '0');

      // Include TZID if timezone is provided
      if (event.timezone) {
        lines.push(`DTSTART;TZID=${event.timezone}:${dateStr}T${startTimeStr}`);
        lines.push(`DTEND;TZID=${event.timezone}:${dateStr}T${endTimeStr}`);
      } else {
        // Floating time (no timezone) - interpreted in viewer's local timezone
        lines.push(`DTSTART:${dateStr}T${startTimeStr}`);
        lines.push(`DTEND:${dateStr}T${endTimeStr}`);
      }
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

export function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
