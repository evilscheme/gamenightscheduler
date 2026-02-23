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
  // Timezone definitions with DST rules for ICS VTIMEZONE generation
  type TzRule = { offset: string; abbr: string; month: number; day: string };
  const timezones: Record<string, { std: TzRule; dst: TzRule }> = {
    // --- North America (US DST: 2nd Sun Mar / 1st Sun Nov) ---
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
    'America/Toronto': {
      std: { offset: '-0500', abbr: 'EST', month: 11, day: '1SU' },
      dst: { offset: '-0400', abbr: 'EDT', month: 3, day: '2SU' },
    },
    'America/Phoenix': {
      std: { offset: '-0700', abbr: 'MST', month: 1, day: '1SU' },
      dst: { offset: '-0700', abbr: 'MST', month: 1, day: '1SU' },
    },
    'Pacific/Honolulu': {
      std: { offset: '-1000', abbr: 'HST', month: 1, day: '1SU' },
      dst: { offset: '-1000', abbr: 'HST', month: 1, day: '1SU' },
    },
    'America/Anchorage': {
      std: { offset: '-0900', abbr: 'AKST', month: 11, day: '1SU' },
      dst: { offset: '-0800', abbr: 'AKDT', month: 3, day: '2SU' },
    },
    // --- Central & South America ---
    'America/Mexico_City': {
      // Mexico abolished DST in 2022
      std: { offset: '-0600', abbr: 'CST', month: 1, day: '1SU' },
      dst: { offset: '-0600', abbr: 'CST', month: 1, day: '1SU' },
    },
    'America/Bogota': {
      std: { offset: '-0500', abbr: 'COT', month: 1, day: '1SU' },
      dst: { offset: '-0500', abbr: 'COT', month: 1, day: '1SU' },
    },
    'America/Sao_Paulo': {
      // Brazil abolished DST in 2019
      std: { offset: '-0300', abbr: 'BRT', month: 1, day: '1SU' },
      dst: { offset: '-0300', abbr: 'BRT', month: 1, day: '1SU' },
    },
    'America/Argentina/Buenos_Aires': {
      std: { offset: '-0300', abbr: 'ART', month: 1, day: '1SU' },
      dst: { offset: '-0300', abbr: 'ART', month: 1, day: '1SU' },
    },
    // --- Europe (EU DST: last Sun Mar / last Sun Oct) ---
    'Europe/London': {
      std: { offset: '+0000', abbr: 'GMT', month: 10, day: '-1SU' },
      dst: { offset: '+0100', abbr: 'BST', month: 3, day: '-1SU' },
    },
    'Europe/Dublin': {
      std: { offset: '+0000', abbr: 'GMT', month: 10, day: '-1SU' },
      dst: { offset: '+0100', abbr: 'IST', month: 3, day: '-1SU' },
    },
    'Europe/Paris': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'Europe/Berlin': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'Europe/Madrid': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'Europe/Rome': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'Europe/Amsterdam': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'Europe/Stockholm': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'Europe/Warsaw': {
      std: { offset: '+0100', abbr: 'CET', month: 10, day: '-1SU' },
      dst: { offset: '+0200', abbr: 'CEST', month: 3, day: '-1SU' },
    },
    'Europe/Helsinki': {
      std: { offset: '+0200', abbr: 'EET', month: 10, day: '-1SU' },
      dst: { offset: '+0300', abbr: 'EEST', month: 3, day: '-1SU' },
    },
    'Europe/Athens': {
      std: { offset: '+0200', abbr: 'EET', month: 10, day: '-1SU' },
      dst: { offset: '+0300', abbr: 'EEST', month: 3, day: '-1SU' },
    },
    'Europe/Bucharest': {
      std: { offset: '+0200', abbr: 'EET', month: 10, day: '-1SU' },
      dst: { offset: '+0300', abbr: 'EEST', month: 3, day: '-1SU' },
    },
    'Europe/Istanbul': {
      // Turkey uses permanent +03 since 2016
      std: { offset: '+0300', abbr: 'TRT', month: 1, day: '1SU' },
      dst: { offset: '+0300', abbr: 'TRT', month: 1, day: '1SU' },
    },
    'Europe/Moscow': {
      // Russia uses permanent +03
      std: { offset: '+0300', abbr: 'MSK', month: 1, day: '1SU' },
      dst: { offset: '+0300', abbr: 'MSK', month: 1, day: '1SU' },
    },
    // --- Africa (no DST for most) ---
    'Africa/Lagos': {
      std: { offset: '+0100', abbr: 'WAT', month: 1, day: '1SU' },
      dst: { offset: '+0100', abbr: 'WAT', month: 1, day: '1SU' },
    },
    'Africa/Cairo': {
      std: { offset: '+0200', abbr: 'EET', month: 1, day: '1SU' },
      dst: { offset: '+0200', abbr: 'EET', month: 1, day: '1SU' },
    },
    'Africa/Johannesburg': {
      std: { offset: '+0200', abbr: 'SAST', month: 1, day: '1SU' },
      dst: { offset: '+0200', abbr: 'SAST', month: 1, day: '1SU' },
    },
    // --- Middle East & South Asia ---
    'Asia/Dubai': {
      std: { offset: '+0400', abbr: 'GST', month: 1, day: '1SU' },
      dst: { offset: '+0400', abbr: 'GST', month: 1, day: '1SU' },
    },
    'Asia/Karachi': {
      std: { offset: '+0500', abbr: 'PKT', month: 1, day: '1SU' },
      dst: { offset: '+0500', abbr: 'PKT', month: 1, day: '1SU' },
    },
    'Asia/Kolkata': {
      std: { offset: '+0530', abbr: 'IST', month: 1, day: '1SU' },
      dst: { offset: '+0530', abbr: 'IST', month: 1, day: '1SU' },
    },
    // --- East & Southeast Asia ---
    'Asia/Bangkok': {
      std: { offset: '+0700', abbr: 'ICT', month: 1, day: '1SU' },
      dst: { offset: '+0700', abbr: 'ICT', month: 1, day: '1SU' },
    },
    'Asia/Singapore': {
      std: { offset: '+0800', abbr: 'SGT', month: 1, day: '1SU' },
      dst: { offset: '+0800', abbr: 'SGT', month: 1, day: '1SU' },
    },
    'Asia/Hong_Kong': {
      std: { offset: '+0800', abbr: 'HKT', month: 1, day: '1SU' },
      dst: { offset: '+0800', abbr: 'HKT', month: 1, day: '1SU' },
    },
    'Asia/Shanghai': {
      std: { offset: '+0800', abbr: 'CST', month: 1, day: '1SU' },
      dst: { offset: '+0800', abbr: 'CST', month: 1, day: '1SU' },
    },
    'Asia/Seoul': {
      std: { offset: '+0900', abbr: 'KST', month: 1, day: '1SU' },
      dst: { offset: '+0900', abbr: 'KST', month: 1, day: '1SU' },
    },
    'Asia/Tokyo': {
      std: { offset: '+0900', abbr: 'JST', month: 1, day: '1SU' },
      dst: { offset: '+0900', abbr: 'JST', month: 1, day: '1SU' },
    },
    // --- Oceania ---
    'Australia/Perth': {
      std: { offset: '+0800', abbr: 'AWST', month: 1, day: '1SU' },
      dst: { offset: '+0800', abbr: 'AWST', month: 1, day: '1SU' },
    },
    'Australia/Sydney': {
      std: { offset: '+1000', abbr: 'AEST', month: 4, day: '1SU' },
      dst: { offset: '+1100', abbr: 'AEDT', month: 10, day: '1SU' },
    },
    'Pacific/Auckland': {
      std: { offset: '+1200', abbr: 'NZST', month: 4, day: '1SU' },
      dst: { offset: '+1300', abbr: 'NZDT', month: 9, day: '-1SU' },
    },
    // --- Other ---
    'UTC': {
      std: { offset: '+0000', abbr: 'UTC', month: 1, day: '1SU' },
      dst: { offset: '+0000', abbr: 'UTC', month: 1, day: '1SU' },
    },
  };

  const tz = timezones[tzid];
  if (!tz) {
    // Handle Etc/GMT offset timezones (fixed offset, no DST)
    if (tzid === 'Etc/GMT0') {
      return buildFixedOffsetVTimezone(tzid, '+0000', 'UTC');
    }
    const etcGmtMatch = tzid.match(/^Etc\/GMT([+-]\d+)$/);
    if (etcGmtMatch) {
      const etcOffset = parseInt(etcGmtMatch[1], 10);
      // Etc/GMT signs are inverted: Etc/GMT+5 = UTC-5
      const utcOffset = -etcOffset;
      const offsetStr = formatIcsOffset(utcOffset);
      const abbr = utcOffset >= 0 ? `UTC+${utcOffset}` : `UTC${utcOffset}`;
      return buildFixedOffsetVTimezone(tzid, offsetStr, abbr);
    }
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

/** Format a UTC offset in hours to ICS offset string (e.g., 5 -> "+0500", -5 -> "-0500") */
function formatIcsOffset(hours: number): string {
  const sign = hours >= 0 ? '+' : '-';
  const abs = Math.abs(hours);
  return `${sign}${String(abs).padStart(2, '0')}00`;
}

/** Build a VTIMEZONE for a fixed-offset timezone (no DST) */
function buildFixedOffsetVTimezone(tzid: string, offset: string, abbr: string): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${tzid}`,
    `X-LIC-LOCATION:${tzid}`,
    'BEGIN:STANDARD',
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    `TZNAME:${abbr}`,
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

export function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}
