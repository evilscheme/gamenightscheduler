import { describe, it, expect } from "vitest";
import { fetchGamePlayDates } from "./playDates";
import { fakePostgrest } from "@/test/fakePostgrest";
import { addDays, format } from "date-fns";

describe("fetchGamePlayDates", () => {
  it("returns every play date and note, past included, past the 1000-row cap", async () => {
    // Notes on ordinary dates create rows too, so a long campaign can pass
    // 1000 rows. The current extra date sits after all the history.
    const history = Array.from({ length: 1100 }, (_, i) => ({
      game_id: "g1",
      date: format(addDays(new Date("2023-01-01T00:00:00"), i), "yyyy-MM-dd"),
      note: `note ${i}`,
    }));
    const current = { game_id: "g1", date: "2026-11-01", note: "bring snacks" };
    const otherGame = { game_id: "g2", date: "2026-11-02", note: null };
    const db = fakePostgrest({ game_play_dates: [current, ...history, otherGame] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await fetchGamePlayDates(db as any, "g1");

    expect(error).toBeNull();
    expect(data).toHaveLength(1101);
    expect(new Set(data?.map((r) => r.date)).size).toBe(1101);
    expect(data).toContainEqual(current);
    expect(data).not.toContainEqual(otherGame);
  });
});
