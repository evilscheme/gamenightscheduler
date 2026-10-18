import { describe, it, expect, vi } from "vitest";
import { fetchAllAvailability, fetchUserAvailability } from "./availability";
import { fakePostgrest } from "@/test/fakePostgrest";
import { addDays, format } from "date-fns";

/** Chainable Supabase mock terminating at `.range()` (paginated read). */
function makeChainMock(rangeResult: { data: unknown[]; error: unknown } = { data: [], error: null }) {
  const range = vi.fn().mockResolvedValue(rangeResult);
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range,
  };
  const from = vi.fn().mockReturnValue(builder);
  return { from, ...builder };
}

describe("fetchAllAvailability", () => {
  it("reads every player's rows for the game in a stable paginated order", async () => {
    const mock = makeChainMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchAllAvailability(mock as any, "game-1");
    expect(mock.from).toHaveBeenCalledWith("availability");
    expect(mock.eq).toHaveBeenCalledWith("game_id", "game-1");
    // Stable total order so pages don't skip/duplicate.
    expect(mock.order).toHaveBeenCalledWith("date", { ascending: true });
    expect(mock.order).toHaveBeenCalledWith("user_id", { ascending: true });
    expect(mock.range).toHaveBeenCalledWith(0, 999);
  });

  it("does NOT filter by date when no fromDate is given", async () => {
    const mock = makeChainMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchAllAvailability(mock as any, "game-1");
    expect(mock.gte).not.toHaveBeenCalled();
  });

  it("scopes to fromDate (drops stale past dates) when given", async () => {
    const mock = makeChainMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchAllAvailability(mock as any, "game-1", "2026-07-28");
    expect(mock.gte).toHaveBeenCalledWith("date", "2026-07-28");
  });

  it("stitches multiple pages together (survives the 1000-row cap)", async () => {
    // First call returns a full page of 1000, second returns the tail — the
    // exact scenario that silently truncated before pagination.
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    const page2 = [{ id: "tail-row" }];
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range,
    };
    const mock = { from: vi.fn().mockReturnValue(builder) };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await fetchAllAvailability(mock as any, "game-1", "2026-07-28");

    expect(data).toHaveLength(1001);
    expect(data?.at(-1)).toEqual({ id: "tail-row" });
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

describe("fetchUserAvailability", () => {
  /** One row per day for `count` days from `start`, for game g1 / user u1. */
  function daysFrom(start: string, count: number, extra: Record<string, unknown> = {}) {
    return Array.from({ length: count }, (_, i) => ({
      game_id: "g1",
      user_id: "u1",
      date: format(addDays(new Date(`${start}T00:00:00`), i), "yyyy-MM-dd"),
      status: "available",
      ...extra,
    }));
  }

  it("returns every in-window row even when 1000+ historical rows precede it", async () => {
    // Over three years of history, then the current window. Unbounded, the
    // first 1000 rows were all history and the window came back empty.
    const history = daysFrom("2023-01-01", 1200);
    const window = daysFrom("2026-10-17", 90, { comment: "late start", available_after: "19:00" });
    const otherUser = daysFrom("2026-10-17", 90).map((r) => ({ ...r, user_id: "u2" }));
    const db = fakePostgrest({ availability: [...history, ...window, ...otherUser] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await fetchUserAvailability(db as any, "g1", "u1", "2026-10-17", "2027-01-14");

    expect(error).toBeNull();
    expect(data).toEqual(window); // comments and time constraints intact
  });

  it("pages through a window wider than one page without duplicates", async () => {
    const rows = daysFrom("2026-01-01", 1500);
    const db = fakePostgrest({ availability: rows });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await fetchUserAvailability(db as any, "g1", "u1", "2026-01-01", "2030-12-31");

    expect(data).toHaveLength(1500);
    expect(new Set(data?.map((r) => r.date)).size).toBe(1500);
  });

  it("returns the error instead of an empty list when a read fails", async () => {
    const err = { message: "boom" };
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: err }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await fetchUserAvailability({ from: () => builder } as any, "g1", "u1", "2026-01-01", "2026-12-31");

    expect(data).toBeNull();
    expect(error).toBe(err);
  });
});
