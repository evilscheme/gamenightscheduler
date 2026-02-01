import { User, Availability, DateSuggestion, PlayerWithComment } from "@/types";

interface CategorizedPlayers {
  available: PlayerWithComment[];
  maybe: PlayerWithComment[];
  unavailable: PlayerWithComment[];
  pending: User[];
}

/**
 * Categorize players by their availability for a specific date
 */
export function categorizePlayers(
  players: User[],
  availability: Availability[],
  date: string
): CategorizedPlayers {
  const available: PlayerWithComment[] = [];
  const maybe: PlayerWithComment[] = [];
  const unavailable: PlayerWithComment[] = [];
  const pending: User[] = [];

  players.forEach((player) => {
    const playerAvail = availability.find(
      (a) => a.user_id === player.id && a.date === date
    );

    if (!playerAvail) {
      pending.push(player);
    } else if (playerAvail.status === "available") {
      available.push({
        user: player,
        comment: playerAvail.comment,
        availableAfter: playerAvail.available_after ?? null,
        availableUntil: playerAvail.available_until ?? null,
      });
    } else if (playerAvail.status === "maybe") {
      maybe.push({
        user: player,
        comment: playerAvail.comment,
        availableAfter: playerAvail.available_after ?? null,
        availableUntil: playerAvail.available_until ?? null,
      });
    } else {
      unavailable.push({
        user: player,
        comment: playerAvail.comment,
        availableAfter: playerAvail.available_after ?? null,
        availableUntil: playerAvail.available_until ?? null,
      });
    }
  });

  return { available, maybe, unavailable, pending };
}

/**
 * Sort suggestions by:
 * 1. Meets threshold first (if threshold is set)
 * 2. Available count (descending)
 * 3. Maybe count (descending)
 * 4. Pending count (ascending) - prefer dates where everyone has responded
 * 5. Date (ascending) - earlier dates first for ties
 */
export function sortSuggestions(
  suggestions: DateSuggestion[]
): DateSuggestion[] {
  return [...suggestions].sort((a, b) => {
    // Sort by meets threshold first (dates meeting threshold come first)
    if (a.meetsThreshold !== b.meetsThreshold) {
      return a.meetsThreshold ? -1 : 1;
    }
    // Sort by available count (descending)
    if (b.availableCount !== a.availableCount) {
      return b.availableCount - a.availableCount;
    }
    // Then by maybe count (descending)
    if (b.maybeCount !== a.maybeCount) {
      return b.maybeCount - a.maybeCount;
    }
    // Then by pending count (ascending) - fewer pending is better
    if (a.pendingCount !== b.pendingCount) {
      return a.pendingCount - b.pendingCount;
    }
    // Finally by date (ascending)
    return a.date.localeCompare(b.date);
  });
}

/**
 * Sort suggestions purely by date (ascending), ignoring availability scores
 */
export function sortSuggestionsChronologically(
  suggestions: DateSuggestion[]
): DateSuggestion[] {
  return [...suggestions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

interface CalculateSuggestionsParams {
  playDates: Date[];
  players: User[];
  availability: Availability[];
  getDayOfWeek: (date: Date) => number;
  formatDate: (date: Date) => string;
  minPlayersNeeded?: number; // 0 or undefined means no minimum
}

/**
 * Calculate date suggestions from play dates and availability data
 */
export function calculateDateSuggestions({
  playDates,
  players,
  availability,
  getDayOfWeek,
  formatDate,
  minPlayersNeeded = 0,
}: CalculateSuggestionsParams): DateSuggestion[] {
  const suggestions: DateSuggestion[] = playDates.map((date) => {
    const dateStr = formatDate(date);
    const { available, maybe, unavailable, pending } = categorizePlayers(
      players,
      availability,
      dateStr
    );

    // Compute time constraints from available players
    // earliestStartTime = latest "available_after" (everyone must be free)
    // latestEndTime = earliest "available_until" (everyone must still be free)
    let earliestStartTime: string | null = null;
    let latestEndTime: string | null = null;

    for (const p of available) {
      if (p.availableAfter) {
        if (!earliestStartTime || p.availableAfter > earliestStartTime) {
          earliestStartTime = p.availableAfter;
        }
      }
      if (p.availableUntil) {
        if (!latestEndTime || p.availableUntil < latestEndTime) {
          latestEndTime = p.availableUntil;
        }
      }
    }

    // Check if this date meets the minimum player threshold
    // Only count confirmed available players (not maybe or pending)
    const meetsThreshold = minPlayersNeeded <= 0 || available.length >= minPlayersNeeded;

    return {
      date: dateStr,
      dayOfWeek: getDayOfWeek(date),
      availableCount: available.length,
      maybeCount: maybe.length,
      unavailableCount: unavailable.length,
      pendingCount: pending.length,
      totalPlayers: players.length,
      availablePlayers: available,
      maybePlayers: maybe,
      unavailablePlayers: unavailable,
      pendingPlayers: pending,
      earliestStartTime,
      latestEndTime,
      meetsThreshold,
    };
  });

  return sortSuggestions(suggestions);
}
