import { describe, it, expect } from "vitest";
import { mergeDashboardGames, type GameWithGMAndCounts } from "./dashboardData";
import type { User } from "@/types";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "gm-1",
  email: "gm@example.com",
  name: "GM Name",
  avatar_url: null,
  is_gm: true,
  is_admin: false,
  timezone: null,
  week_start_day: 0,
  time_format: "12h",
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

/** Helper: build a GameWithGMAndCounts fixture with sensible defaults, overriding as needed. */
function makeGame(
  overrides: Partial<GameWithGMAndCounts> & { id: string }
): GameWithGMAndCounts {
  return {
    name: "Test Game",
    description: null,
    gm_id: "gm-1",
    play_days: [],
    invite_code: "abc123",
    scheduling_window_months: 1,
    default_start_time: null,
    default_end_time: null,
    timezone: null,
    min_players_needed: 0,
    ad_hoc_only: false,
    campaign_start_date: null,
    campaign_end_date: null,
    created_at: "2026-01-01T00:00:00Z",
    gm: makeUser(),
    ...overrides,
  };
}

describe("mergeDashboardGames", () => {
  it("dedupes a game appearing in both lists, keeping the GM-list entry and order", () => {
    const gmEntry = makeGame({ id: "g1", name: "From GM list", game_memberships: [{ count: 2 }] });
    const memberEntry = makeGame({
      id: "g1",
      name: "From member list",
      game_memberships: [{ count: 99 }],
    });
    const gmOnly = makeGame({ id: "g2", name: "GM only" });

    const result = mergeDashboardGames({
      gmGames: [gmEntry, gmOnly],
      memberGames: [memberEntry],
      memberships: [],
    });

    // GM games first, in order; the duplicate keeps its GM-list position (before g2).
    expect(result.map((g) => g.id)).toEqual(["g1", "g2"]);
    // The GM-list entry's content wins over the member-list entry for the same id.
    expect(result[0].name).toBe("From GM list");
    expect(result[0].member_count).toBe(3); // 2 + 1, not 99 + 1
  });

  it("computes member_count as the embedded count plus one for the GM", () => {
    const game = makeGame({ id: "g1", game_memberships: [{ count: 4 }] });

    const result = mergeDashboardGames({ gmGames: [game], memberGames: [], memberships: [] });

    expect(result[0].member_count).toBe(5);
  });

  it("defaults member_count to 1 when the game_memberships embed is missing or empty", () => {
    const missingEmbed = makeGame({ id: "g1" });
    const emptyEmbed = makeGame({ id: "g2", game_memberships: [] });

    const result = mergeDashboardGames({
      gmGames: [missingEmbed, emptyEmbed],
      memberGames: [],
      memberships: [],
    });

    expect(result.find((g) => g.id === "g1")?.member_count).toBe(1);
    expect(result.find((g) => g.id === "g2")?.member_count).toBe(1);
  });

  it("marks is_co_gm true only for games with a co-GM membership row", () => {
    const coGmGame = makeGame({ id: "g1" });
    const playerGame = makeGame({ id: "g2" });

    const result = mergeDashboardGames({
      gmGames: [],
      memberGames: [coGmGame, playerGame],
      memberships: [
        { game_id: "g1", is_co_gm: true },
        { game_id: "g2", is_co_gm: false },
      ],
    });

    expect(result.find((g) => g.id === "g1")?.is_co_gm).toBe(true);
    expect(result.find((g) => g.id === "g2")?.is_co_gm).toBe(false);
  });

  it("strips the game_memberships embed key from the returned rows", () => {
    const game = makeGame({ id: "g1", game_memberships: [{ count: 1 }] });

    const result = mergeDashboardGames({ gmGames: [game], memberGames: [], memberships: [] });

    expect(result[0]).not.toHaveProperty("game_memberships");
  });
});
