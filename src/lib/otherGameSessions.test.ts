import { describe, it, expect } from "vitest";
import { buildOtherGameSessionMap } from "./otherGameSessions";
import type { GameSession } from "@/types";

const makeSession = (over: Partial<GameSession>): GameSession => ({
  id: "s",
  game_id: "g",
  date: "2026-07-04",
  start_time: "19:00:00",
  end_time: "22:00:00",
  status: "confirmed",
  confirmed_by: "u1",
  location: null,
  notes: null,
  created_at: "2026-06-01T00:00:00Z",
  ...over,
});

const names = new Map([
  ["gB", "Curse of Strahd"],
  ["gC", "Dragon Heist"],
]);

describe("buildOtherGameSessionMap", () => {
  it("keeps only confirmed sessions on/after fromDate, keyed by date", () => {
    const sessions = [
      makeSession({ id: "1", game_id: "gB", date: "2026-07-04" }),
      makeSession({ id: "2", game_id: "gB", date: "2026-05-01" }), // past → drop
      makeSession({ id: "3", game_id: "gC", date: "2026-08-01", status: "cancelled" as GameSession["status"] }), // not confirmed → drop
    ];
    const map = buildOtherGameSessionMap(sessions, names, "2026-06-26");
    expect([...map.keys()]).toEqual(["2026-07-04"]);
    expect(map.get("2026-07-04")).toEqual([
      { gameId: "gB", gameName: "Curse of Strahd", startTime: "19:00:00", endTime: "22:00:00" },
    ]);
  });

  it("groups multiple games on the same date, sorted by game name", () => {
    const sessions = [
      makeSession({ id: "1", game_id: "gC", date: "2026-07-04" }),
      makeSession({ id: "2", game_id: "gB", date: "2026-07-04" }),
    ];
    const map = buildOtherGameSessionMap(sessions, names, "2026-06-26");
    expect(map.get("2026-07-04")!.map((i) => i.gameName)).toEqual([
      "Curse of Strahd",
      "Dragon Heist",
    ]);
  });

  it("falls back to 'Another game' when the name is unknown", () => {
    const sessions = [makeSession({ id: "1", game_id: "gX", date: "2026-07-04" })];
    const map = buildOtherGameSessionMap(sessions, names, "2026-06-26");
    expect(map.get("2026-07-04")![0].gameName).toBe("Another game");
  });

  it("includes the fromDate itself (boundary is inclusive)", () => {
    const sessions = [makeSession({ id: "1", game_id: "gB", date: "2026-06-26" })];
    const map = buildOtherGameSessionMap(sessions, names, "2026-06-26");
    expect(map.has("2026-06-26")).toBe(true);
  });
});
