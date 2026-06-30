import type { GameSession } from "@/types";
import { formatTimeShort } from "./formatting";

export interface OtherGameSessionInfo {
  gameId: string;
  gameName: string;
  startTime: string | null;
  endTime: string | null;
}

/**
 * Group another-game confirmed sessions by date for overlay on a game's calendar.
 *
 * Dates are compared as plain `yyyy-MM-dd` strings (how sessions are stored), so
 * no timezone conversion is needed. Only `confirmed` sessions on or after
 * `fromDate` are kept. Each date's infos are sorted by game name for stable order.
 */
export function buildOtherGameSessionMap(
  sessions: GameSession[],
  gameNameById: Map<string, string>,
  fromDate: string,
): Map<string, OtherGameSessionInfo[]> {
  const map = new Map<string, OtherGameSessionInfo[]>();

  for (const s of sessions) {
    if (s.status !== "confirmed") continue;
    if (s.date < fromDate) continue;

    const info: OtherGameSessionInfo = {
      gameId: s.game_id,
      gameName: gameNameById.get(s.game_id) ?? "Another game",
      startTime: s.start_time,
      endTime: s.end_time,
    };
    const existing = map.get(s.date);
    if (existing) existing.push(info);
    else map.set(s.date, [info]);
  }

  for (const infos of map.values()) {
    infos.sort((a, b) => a.gameName.localeCompare(b.gameName));
  }
  return map;
}

/**
 * Human-readable time window for an other-game session — e.g. "7pm–10pm",
 * "from 7pm", "until 10pm", or "" when the session has no times set.
 */
export function formatSessionTimeWindow(
  startTime: string | null,
  endTime: string | null,
  use24h: boolean,
): string {
  const start = formatTimeShort(startTime, use24h);
  const end = formatTimeShort(endTime, use24h);
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return "";
}
