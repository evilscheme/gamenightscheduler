import { User, Availability, DateSuggestion } from "@/types";

interface PlayerWithComment {
  user: User;
  comment: string | null;
}

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
      available.push({ user: player, comment: playerAvail.comment });
    } else if (playerAvail.status === "maybe") {
      maybe.push({ user: player, comment: playerAvail.comment });
    } else {
      unavailable.push({ user: player, comment: playerAvail.comment });
    }
  });

  return { available, maybe, unavailable, pending };
}

/**
 * Sort suggestions by:
 * 1. Available count (descending)
 * 2. Maybe count (descending)
 * 3. Pending count (ascending) - prefer dates where everyone has responded
 * 4. Date (ascending) - earlier dates first for ties
 */
export function sortSuggestions(
  suggestions: DateSuggestion[]
): DateSuggestion[] {
  return [...suggestions].sort((a, b) => {
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

interface CalculateSuggestionsParams {
  playDates: Date[];
  players: User[];
  availability: Availability[];
  getDayOfWeek: (date: Date) => number;
  formatDate: (date: Date) => string;
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
}: CalculateSuggestionsParams): DateSuggestion[] {
  const suggestions: DateSuggestion[] = playDates.map((date) => {
    const dateStr = formatDate(date);
    const { available, maybe, unavailable, pending } = categorizePlayers(
      players,
      availability,
      dateStr
    );

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
    };
  });

  return sortSuggestions(suggestions);
}
