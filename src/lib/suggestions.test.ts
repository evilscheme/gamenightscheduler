import { describe, it, expect } from "vitest";
import {
  categorizePlayers,
  sortSuggestions,
  calculateDateSuggestions,
} from "./suggestions";
import { User, Availability, DateSuggestion } from "@/types";

const makeUser = (id: string, name: string): User => ({
  id,
  name,
  email: `${id}@test.com`,
  avatar_url: null,
  is_gm: false,
  is_admin: false,
  created_at: "2025-01-01",
});

const makeAvailability = (
  userId: string,
  date: string,
  status: "available" | "unavailable" | "maybe",
  comment: string | null = null,
  available_after: string | null = null,
  available_until: string | null = null
): Availability => ({
  id: `${userId}-${date}`,
  user_id: userId,
  game_id: "game-1",
  date,
  status,
  comment,
  available_after,
  available_until,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
});

describe("categorizePlayers", () => {
  const player1 = makeUser("1", "Alice");
  const player2 = makeUser("2", "Bob");
  const player3 = makeUser("3", "Charlie");
  const player4 = makeUser("4", "Diana");

  it("categorizes all players as available", () => {
    const availability = [
      makeAvailability("1", "2025-01-20", "available"),
      makeAvailability("2", "2025-01-20", "available"),
    ];
    const result = categorizePlayers([player1, player2], availability, "2025-01-20");

    expect(result.available.length).toBe(2);
    expect(result.maybe.length).toBe(0);
    expect(result.unavailable.length).toBe(0);
    expect(result.pending.length).toBe(0);
  });

  it("categorizes all players as unavailable", () => {
    const availability = [
      makeAvailability("1", "2025-01-20", "unavailable"),
      makeAvailability("2", "2025-01-20", "unavailable"),
    ];
    const result = categorizePlayers([player1, player2], availability, "2025-01-20");

    expect(result.available.length).toBe(0);
    expect(result.unavailable.length).toBe(2);
  });

  it("categorizes mixed statuses correctly", () => {
    const availability = [
      makeAvailability("1", "2025-01-20", "available"),
      makeAvailability("2", "2025-01-20", "unavailable"),
      makeAvailability("3", "2025-01-20", "maybe"),
    ];
    const result = categorizePlayers(
      [player1, player2, player3, player4],
      availability,
      "2025-01-20"
    );

    expect(result.available.length).toBe(1);
    expect(result.available[0].user.id).toBe("1");
    expect(result.unavailable.length).toBe(1);
    expect(result.unavailable[0].user.id).toBe("2");
    expect(result.maybe.length).toBe(1);
    expect(result.maybe[0].user.id).toBe("3");
    expect(result.pending.length).toBe(1);
    expect(result.pending[0].id).toBe("4");
  });

  it("treats players with no records as pending", () => {
    const availability: Availability[] = [];
    const result = categorizePlayers([player1, player2], availability, "2025-01-20");

    expect(result.available.length).toBe(0);
    expect(result.pending.length).toBe(2);
  });

  it("returns empty arrays for empty players array", () => {
    const result = categorizePlayers([], [], "2025-01-20");

    expect(result.available.length).toBe(0);
    expect(result.maybe.length).toBe(0);
    expect(result.unavailable.length).toBe(0);
    expect(result.pending.length).toBe(0);
  });

  it("includes comments in the result", () => {
    const availability = [
      makeAvailability("1", "2025-01-20", "available", "Works for me!"),
      makeAvailability("2", "2025-01-20", "maybe", "Depends on work"),
    ];
    const result = categorizePlayers([player1, player2], availability, "2025-01-20");

    expect(result.available[0].comment).toBe("Works for me!");
    expect(result.maybe[0].comment).toBe("Depends on work");
  });

  it("includes time constraint fields in categorized players", () => {
    const availability = [
      makeAvailability("1", "2025-01-20", "available", null, "19:00:00", "23:00:00"),
      makeAvailability("2", "2025-01-20", "maybe", null, "18:00:00", null),
      makeAvailability("3", "2025-01-20", "unavailable", null, null, "21:00:00"),
    ];
    const result = categorizePlayers(
      [player1, player2, player3],
      availability,
      "2025-01-20"
    );

    expect(result.available[0].availableAfter).toBe("19:00:00");
    expect(result.available[0].availableUntil).toBe("23:00:00");
    expect(result.maybe[0].availableAfter).toBe("18:00:00");
    expect(result.maybe[0].availableUntil).toBeNull();
    expect(result.unavailable[0].availableAfter).toBeNull();
    expect(result.unavailable[0].availableUntil).toBe("21:00:00");
  });

  it("returns null time fields when availability has no time constraints", () => {
    const availability = [
      makeAvailability("1", "2025-01-20", "available"),
    ];
    const result = categorizePlayers([player1], availability, "2025-01-20");

    expect(result.available[0].availableAfter).toBeNull();
    expect(result.available[0].availableUntil).toBeNull();
  });
});

describe("sortSuggestions", () => {
  const makeSuggestion = (
    date: string,
    available: number,
    maybe: number,
    unavailable: number,
    pending: number
  ): DateSuggestion => ({
    date,
    dayOfWeek: 5, // Friday
    availableCount: available,
    maybeCount: maybe,
    unavailableCount: unavailable,
    pendingCount: pending,
    totalPlayers: available + maybe + unavailable + pending,
    availablePlayers: [],
    maybePlayers: [],
    unavailablePlayers: [],
    pendingPlayers: [],
    earliestStartTime: null,
    latestEndTime: null,
  });

  it("sorts by available count (descending)", () => {
    const suggestions = [
      makeSuggestion("2025-01-20", 2, 0, 0, 0),
      makeSuggestion("2025-01-21", 4, 0, 0, 0),
      makeSuggestion("2025-01-22", 1, 0, 0, 0),
    ];

    const sorted = sortSuggestions(suggestions);

    expect(sorted[0].date).toBe("2025-01-21"); // 4 available
    expect(sorted[1].date).toBe("2025-01-20"); // 2 available
    expect(sorted[2].date).toBe("2025-01-22"); // 1 available
  });

  it("tie-breaks by maybe count (descending)", () => {
    const suggestions = [
      makeSuggestion("2025-01-20", 2, 1, 0, 0),
      makeSuggestion("2025-01-21", 2, 3, 0, 0),
      makeSuggestion("2025-01-22", 2, 0, 0, 0),
    ];

    const sorted = sortSuggestions(suggestions);

    expect(sorted[0].date).toBe("2025-01-21"); // 3 maybe
    expect(sorted[1].date).toBe("2025-01-20"); // 1 maybe
    expect(sorted[2].date).toBe("2025-01-22"); // 0 maybe
  });

  it("tie-breaks by pending count (ascending)", () => {
    const suggestions = [
      makeSuggestion("2025-01-20", 2, 1, 0, 2),
      makeSuggestion("2025-01-21", 2, 1, 0, 0),
      makeSuggestion("2025-01-22", 2, 1, 0, 1),
    ];

    const sorted = sortSuggestions(suggestions);

    expect(sorted[0].date).toBe("2025-01-21"); // 0 pending
    expect(sorted[1].date).toBe("2025-01-22"); // 1 pending
    expect(sorted[2].date).toBe("2025-01-20"); // 2 pending
  });

  it("final tie-breaks by date (ascending)", () => {
    const suggestions = [
      makeSuggestion("2025-01-22", 2, 1, 0, 1),
      makeSuggestion("2025-01-20", 2, 1, 0, 1),
      makeSuggestion("2025-01-21", 2, 1, 0, 1),
    ];

    const sorted = sortSuggestions(suggestions);

    expect(sorted[0].date).toBe("2025-01-20");
    expect(sorted[1].date).toBe("2025-01-21");
    expect(sorted[2].date).toBe("2025-01-22");
  });

  it("handles single item array", () => {
    const suggestions = [makeSuggestion("2025-01-20", 2, 1, 0, 0)];
    const sorted = sortSuggestions(suggestions);

    expect(sorted.length).toBe(1);
    expect(sorted[0].date).toBe("2025-01-20");
  });

  it("handles empty array", () => {
    const sorted = sortSuggestions([]);
    expect(sorted.length).toBe(0);
  });

  it("does not mutate original array", () => {
    const suggestions = [
      makeSuggestion("2025-01-22", 1, 0, 0, 0),
      makeSuggestion("2025-01-20", 3, 0, 0, 0),
    ];
    const originalFirst = suggestions[0].date;

    sortSuggestions(suggestions);

    expect(suggestions[0].date).toBe(originalFirst);
  });
});

describe("calculateDateSuggestions", () => {
  const player1 = makeUser("1", "Alice");
  const player2 = makeUser("2", "Bob");
  const players = [player1, player2];

  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  const getDayOfWeek = (date: Date) => date.getDay();

  it("calculates suggestions for play dates", () => {
    const playDates = [
      new Date("2025-01-20"),
      new Date("2025-01-21"),
    ];
    const availability = [
      makeAvailability("1", "2025-01-20", "available"),
      makeAvailability("2", "2025-01-20", "available"),
      makeAvailability("1", "2025-01-21", "unavailable"),
    ];

    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability,
      getDayOfWeek,
      formatDate,
    });

    // 2025-01-20 has 2 available, 2025-01-21 has 1 unavailable and 1 pending
    expect(suggestions[0].date).toBe("2025-01-20");
    expect(suggestions[0].availableCount).toBe(2);
    expect(suggestions[1].date).toBe("2025-01-21");
    expect(suggestions[1].unavailableCount).toBe(1);
    expect(suggestions[1].pendingCount).toBe(1);
  });

  it("sets totalPlayers correctly", () => {
    const playDates = [new Date("2025-01-20")];
    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability: [],
      getDayOfWeek,
      formatDate,
    });

    expect(suggestions[0].totalPlayers).toBe(2);
  });

  it("sets dayOfWeek correctly", () => {
    const playDates = [
      new Date("2025-01-20T12:00:00"), // Monday
      new Date("2025-01-24T12:00:00"), // Friday
    ];
    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability: [],
      getDayOfWeek,
      formatDate,
    });

    // Suggestions are sorted by date after other criteria are equal
    // First date should be 2025-01-20 (Monday)
    const mondaySuggestion = suggestions.find(s => s.date === "2025-01-20");
    const fridaySuggestion = suggestions.find(s => s.date === "2025-01-24");

    expect(mondaySuggestion?.dayOfWeek).toBe(1); // Monday
    expect(fridaySuggestion?.dayOfWeek).toBe(5); // Friday
  });

  it("returns empty array for empty play dates", () => {
    const suggestions = calculateDateSuggestions({
      playDates: [],
      players,
      availability: [],
      getDayOfWeek,
      formatDate,
    });

    expect(suggestions.length).toBe(0);
  });

  it("computes earliestStartTime as latest available_after among available players", () => {
    const playDates = [new Date("2025-01-20")];
    const availability = [
      makeAvailability("1", "2025-01-20", "available", null, "17:00:00", null),
      makeAvailability("2", "2025-01-20", "available", null, "19:00:00", null),
    ];

    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability,
      getDayOfWeek,
      formatDate,
    });

    // Latest available_after = 19:00 (everyone must be free)
    expect(suggestions[0].earliestStartTime).toBe("19:00:00");
  });

  it("computes latestEndTime as earliest available_until among available players", () => {
    const playDates = [new Date("2025-01-20")];
    const availability = [
      makeAvailability("1", "2025-01-20", "available", null, null, "22:00:00"),
      makeAvailability("2", "2025-01-20", "available", null, null, "21:00:00"),
    ];

    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability,
      getDayOfWeek,
      formatDate,
    });

    // Earliest available_until = 21:00 (everyone must still be free)
    expect(suggestions[0].latestEndTime).toBe("21:00:00");
  });

  it("returns null time constraints when no players have time fields", () => {
    const playDates = [new Date("2025-01-20")];
    const availability = [
      makeAvailability("1", "2025-01-20", "available"),
      makeAvailability("2", "2025-01-20", "available"),
    ];

    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability,
      getDayOfWeek,
      formatDate,
    });

    expect(suggestions[0].earliestStartTime).toBeNull();
    expect(suggestions[0].latestEndTime).toBeNull();
  });

  it("only considers available players for time constraints, not maybe or unavailable", () => {
    const playDates = [new Date("2025-01-20")];
    const availability = [
      makeAvailability("1", "2025-01-20", "available", null, "18:00:00", null),
      makeAvailability("2", "2025-01-20", "maybe", null, "21:00:00", null),
    ];

    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability,
      getDayOfWeek,
      formatDate,
    });

    // Only player1 is available, so their time is the constraint
    expect(suggestions[0].earliestStartTime).toBe("18:00:00");
  });

  it("handles mixed time constraints (some players have after, some have until)", () => {
    const playDates = [new Date("2025-01-20")];
    const availability = [
      makeAvailability("1", "2025-01-20", "available", null, "19:00:00", null),
      makeAvailability("2", "2025-01-20", "available", null, null, "22:00:00"),
    ];

    const suggestions = calculateDateSuggestions({
      playDates,
      players,
      availability,
      getDayOfWeek,
      formatDate,
    });

    expect(suggestions[0].earliestStartTime).toBe("19:00:00");
    expect(suggestions[0].latestEndTime).toBe("22:00:00");
  });
});
