import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeDashboardGames, fetchDashboardData, type GameWithGMAndCounts } from "./dashboardData";
import type { User, GameSession } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchUserMemberships,
  fetchUserGmGames,
  fetchGamesWithGMByIds,
  fetchUpcomingSessionsForGames,
} from "@/lib/data";

vi.mock("@/lib/data", () => ({
  fetchUserMemberships: vi.fn(),
  fetchUserGmGames: vi.fn(),
  fetchGamesWithGMByIds: vi.fn(),
  fetchUpcomingSessionsForGames: vi.fn(),
}));

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

type MembershipsResult = Awaited<ReturnType<typeof fetchUserMemberships>>;
type GmGamesResult = Awaited<ReturnType<typeof fetchUserGmGames>>;
type MemberGamesResult = Awaited<ReturnType<typeof fetchGamesWithGMByIds>>;
type SessionsResult = Awaited<ReturnType<typeof fetchUpcomingSessionsForGames>>;

describe("fetchDashboardData", () => {
  const supabase = {} as unknown as SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges gm and member games (gm first), excludes already-gm-owned ids from the member-games fetch, and unions ids for the sessions fetch", async () => {
    const gmGame = makeGame({ id: "g1", name: "GM Game", game_memberships: [{ count: 2 }] });
    const memberGame = makeGame({ id: "m2", name: "Member Game", game_memberships: [{ count: 1 }] });
    const session = { id: "s1", game_id: "g1" } as GameSession;

    vi.mocked(fetchUserMemberships).mockResolvedValue({
      data: [
        { game_id: "g1", is_co_gm: false }, // already GM-owned; must be filtered out below
        { game_id: "m2", is_co_gm: true },
      ],
      error: null,
    } as unknown as MembershipsResult);
    vi.mocked(fetchUserGmGames).mockResolvedValue({
      data: [gmGame],
      error: null,
    } as unknown as GmGamesResult);
    vi.mocked(fetchGamesWithGMByIds).mockResolvedValue({
      data: [memberGame],
      error: null,
    } as unknown as MemberGamesResult);
    vi.mocked(fetchUpcomingSessionsForGames).mockResolvedValue({
      data: [session],
      error: null,
    } as unknown as SessionsResult);

    const result = await fetchDashboardData(supabase, "user-1");

    expect(result.games.map((g) => g.id)).toEqual(["g1", "m2"]);
    expect(result.games[0].member_count).toBe(3); // 2 + 1
    expect(result.games[0].is_co_gm).toBe(false);
    expect(result.games[1].member_count).toBe(2); // 1 + 1
    expect(result.games[1].is_co_gm).toBe(true);
    expect(result.upcoming).toEqual([session]);

    // Only the member id NOT already gm-owned ("g1" is filtered out) is resolved.
    expect(fetchGamesWithGMByIds).toHaveBeenCalledTimes(1);
    expect(fetchGamesWithGMByIds).toHaveBeenCalledWith(supabase, ["m2"]);
    // Sessions are fetched across the full union of gm + member ids.
    expect(fetchUpcomingSessionsForGames).toHaveBeenCalledWith(
      supabase,
      ["g1", "m2"],
      expect.any(String),
    );
  });

  it("does not call fetchGamesWithGMByIds when the user has no memberships, and still returns gm games plus upcoming sessions", async () => {
    const gmGame = makeGame({ id: "g1", name: "GM Game" });
    const session = { id: "s1", game_id: "g1" } as GameSession;

    vi.mocked(fetchUserMemberships).mockResolvedValue({
      data: [],
      error: null,
    } as unknown as MembershipsResult);
    vi.mocked(fetchUserGmGames).mockResolvedValue({
      data: [gmGame],
      error: null,
    } as unknown as GmGamesResult);
    vi.mocked(fetchUpcomingSessionsForGames).mockResolvedValue({
      data: [session],
      error: null,
    } as unknown as SessionsResult);

    const result = await fetchDashboardData(supabase, "user-1");

    expect(fetchGamesWithGMByIds).not.toHaveBeenCalled();
    expect(result.games.map((g) => g.id)).toEqual(["g1"]);
    expect(result.upcoming).toEqual([session]);
    expect(fetchUpcomingSessionsForGames).toHaveBeenCalledWith(
      supabase,
      ["g1"],
      expect.any(String),
    );
  });

  it("logs the error and returns an empty upcoming list when the sessions fetch fails, while still returning games", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const gmGame = makeGame({ id: "g1", name: "GM Game" });
    const sessionsError = { message: "boom" };

    vi.mocked(fetchUserMemberships).mockResolvedValue({
      data: [],
      error: null,
    } as unknown as MembershipsResult);
    vi.mocked(fetchUserGmGames).mockResolvedValue({
      data: [gmGame],
      error: null,
    } as unknown as GmGamesResult);
    vi.mocked(fetchUpcomingSessionsForGames).mockResolvedValue({
      data: null,
      error: sessionsError,
    } as unknown as SessionsResult);

    const result = await fetchDashboardData(supabase, "user-1");

    expect(result.upcoming).toEqual([]);
    expect(result.games.map((g) => g.id)).toEqual(["g1"]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[UpcomingSessions] failed to fetch upcoming sessions:",
      sessionsError,
    );

    consoleErrorSpy.mockRestore();
  });

  it("returns a plausible fetchedAtMs (number) and fetchedToday (YYYY-MM-DD string)", async () => {
    vi.mocked(fetchUserMemberships).mockResolvedValue({
      data: [],
      error: null,
    } as unknown as MembershipsResult);
    vi.mocked(fetchUserGmGames).mockResolvedValue({
      data: [],
      error: null,
    } as unknown as GmGamesResult);
    vi.mocked(fetchUpcomingSessionsForGames).mockResolvedValue({
      data: [],
      error: null,
    } as unknown as SessionsResult);

    const before = Date.now();
    const result = await fetchDashboardData(supabase, "user-1");
    const after = Date.now();

    expect(typeof result.fetchedAtMs).toBe("number");
    expect(result.fetchedAtMs).toBeGreaterThanOrEqual(before);
    expect(result.fetchedAtMs).toBeLessThanOrEqual(after);
    expect(result.fetchedToday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
