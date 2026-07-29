import { describe, it, expect, vi } from "vitest";
import { fetchAllAvailability } from "./availability";

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
