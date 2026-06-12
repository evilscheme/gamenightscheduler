import { describe, it, expect } from "vitest";
import { computeTopUsers, type TopUserProfile } from "./topUsers";

function user(id: string, name = `User ${id}`): TopUserProfile {
  return { id, name, email: `${id}@test.local`, avatar_url: null };
}

describe("computeTopUsers", () => {
  const today = "2026-06-11";

  it("returns empty lists when there is no data", () => {
    const result = computeTopUsers(
      { users: [], games: [], memberships: [], sessions: [], availability: [] },
      { today }
    );
    expect(result.topGms).toEqual([]);
    expect(result.topPlayers).toEqual([]);
  });

  it("aggregates GM metrics across owned games", () => {
    const result = computeTopUsers(
      {
        users: [user("gm1"), user("p1"), user("p2")],
        games: [
          { id: "g1", gm_id: "gm1", name: "Game g1" },
          { id: "g2", gm_id: "gm1", name: "Game g2" },
        ],
        memberships: [
          { game_id: "g1", user_id: "p1" },
          { game_id: "g1", user_id: "p2" },
          { game_id: "g2", user_id: "p1" }, // p1 in both games → counted once
        ],
        sessions: [
          { game_id: "g1", date: "2026-01-10" }, // past
          { game_id: "g1", date: "2026-07-01" }, // upcoming
          { game_id: "g2", date: "2026-06-11" }, // today counts as upcoming
        ],
        availability: [],
      },
      { today }
    );

    expect(result.topGms).toHaveLength(1);
    expect(result.topGms[0]).toMatchObject({
      gamesOwned: 2,
      sessionsBooked: 3,
      upcomingSessions: 2,
      playersHosted: 2,
    });
    expect(result.topGms[0].user.id).toBe("gm1");
    expect(result.topGms[0].games).toEqual([
      { id: "g1", name: "Game g1" },
      { id: "g2", name: "Game g2" },
    ]);
  });

  it("aggregates player metrics from memberships, sessions, and availability", () => {
    const result = computeTopUsers(
      {
        users: [user("gm1"), user("p1")],
        games: [{ id: "g1", gm_id: "gm1", name: "Game g1" }],
        memberships: [{ game_id: "g1", user_id: "p1" }],
        sessions: [
          { game_id: "g1", date: "2026-01-10" },
          { game_id: "g1", date: "2026-07-01" },
        ],
        availability: [{ user_id: "p1" }, { user_id: "p1" }, { user_id: "gm1" }],
      },
      { today }
    );

    expect(result.topPlayers).toHaveLength(1);
    expect(result.topPlayers[0]).toMatchObject({
      gamesJoined: 1,
      sessionsScheduled: 2,
      datesMarked: 2,
    });
    expect(result.topPlayers[0].user.id).toBe("p1");
    expect(result.topPlayers[0].games).toEqual([{ id: "g1", name: "Game g1" }]);
  });

  it("excludes users with no owned games from GMs and no memberships from players", () => {
    const result = computeTopUsers(
      {
        users: [user("gm1"), user("p1"), user("bystander")],
        games: [{ id: "g1", gm_id: "gm1", name: "Game g1" }],
        memberships: [{ game_id: "g1", user_id: "p1" }],
        sessions: [],
        availability: [{ user_id: "bystander" }],
      },
      { today }
    );

    expect(result.topGms.map((e) => e.user.id)).toEqual(["gm1"]);
    expect(result.topPlayers.map((e) => e.user.id)).toEqual(["p1"]);
  });

  it("ranks GMs by sessions booked, then games owned, then name", () => {
    const result = computeTopUsers(
      {
        users: [user("a", "Alice"), user("b", "Bob"), user("c", "Carol")],
        games: [
          { id: "g1", gm_id: "a", name: "Game g1" },
          { id: "g2", gm_id: "b", name: "Game g2" },
          { id: "g3", gm_id: "b", name: "Game g3" },
          { id: "g4", gm_id: "c", name: "Game g4" },
        ],
        memberships: [],
        sessions: [
          { game_id: "g1", date: "2026-01-01" },
          { game_id: "g2", date: "2026-01-01" },
          { game_id: "g4", date: "2026-01-01" },
        ],
        availability: [],
      },
      { today }
    );

    // All have 1 session; Bob owns 2 games; Alice beats Carol alphabetically
    expect(result.topGms.map((e) => e.user.id)).toEqual(["b", "a", "c"]);
  });

  it("ranks players by sessions scheduled, then games joined", () => {
    const result = computeTopUsers(
      {
        users: [user("gm"), user("p1"), user("p2")],
        games: [
          { id: "g1", gm_id: "gm", name: "Game g1" },
          { id: "g2", gm_id: "gm", name: "Game g2" },
        ],
        memberships: [
          { game_id: "g1", user_id: "p1" },
          { game_id: "g1", user_id: "p2" },
          { game_id: "g2", user_id: "p2" },
        ],
        sessions: [{ game_id: "g1", date: "2026-01-01" }],
        availability: [],
      },
      { today }
    );

    // Both have 1 session via g1, but p2 joined 2 games
    expect(result.topPlayers.map((e) => e.user.id)).toEqual(["p2", "p1"]);
  });

  it("caps each list at the limit", () => {
    const users = Array.from({ length: 15 }, (_, i) => user(`u${i}`));
    const games = users.map((u, i) => ({ id: `g${i}`, gm_id: u.id, name: `Game g${i}` }));
    const result = computeTopUsers(
      { users, games, memberships: [], sessions: [], availability: [] },
      { today, limit: 10 }
    );
    expect(result.topGms).toHaveLength(10);
  });

  it("ignores rows referencing unknown users or games", () => {
    const result = computeTopUsers(
      {
        users: [user("gm1")],
        games: [
          { id: "g1", gm_id: "gm1", name: "Game g1" },
          { id: "g2", gm_id: "ghost-gm", name: "Game g2" },
        ],
        memberships: [
          { game_id: "g1", user_id: "ghost-player" },
          { game_id: "ghost-game", user_id: "gm1" },
        ],
        sessions: [],
        availability: [],
      },
      { today }
    );

    expect(result.topGms.map((e) => e.user.id)).toEqual(["gm1"]);
    // A membership row with an unknown user id still counts toward playersHosted
    // (the GM hosted that seat), but the unknown user gets no player entry.
    expect(result.topGms[0].playersHosted).toBe(1);
    expect(result.topPlayers).toEqual([]);
  });
});
