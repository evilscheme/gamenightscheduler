import { describe, it, expect, vi } from "vitest";
import { confirmSession, updateSession } from "./sessions";

function makeMockSupabase() {
  const upsert = vi.fn().mockReturnThis();
  const update = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn().mockReturnValue({ upsert, update, select, eq, single });
  return { from, upsert, update, select, eq, single };
}

describe("confirmSession", () => {
  it("upserts on (game_id, date) with status=confirmed and the given times", async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await confirmSession(mock as any, {
      game_id: "g1",
      date: "2026-06-14",
      start_time: "19:00",
      end_time: "22:30",
      confirmed_by: "u1",
    });
    expect(mock.from).toHaveBeenCalledWith("sessions");
    expect(mock.upsert).toHaveBeenCalledWith(
      {
        game_id: "g1",
        date: "2026-06-14",
        start_time: "19:00",
        end_time: "22:30",
        confirmed_by: "u1",
        status: "confirmed",
      },
      { onConflict: "game_id,date" },
    );
  });

  it("includes location and notes in the upsert payload when provided", async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await confirmSession(mock as any, {
      game_id: "g1",
      date: "2026-06-14",
      start_time: "19:00",
      end_time: "22:30",
      confirmed_by: "u1",
      location: "Tom's basement",
      notes: "bring dice",
    });
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "Tom's basement",
        notes: "bring dice",
      }),
      { onConflict: "game_id,date" },
    );
  });

  it("passes through null values for location and notes (used to clear them)", async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await confirmSession(mock as any, {
      game_id: "g1",
      date: "2026-06-14",
      start_time: "19:00",
      end_time: "22:30",
      confirmed_by: "u1",
      location: null,
      notes: null,
    });
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ location: null, notes: null }),
      { onConflict: "game_id,date" },
    );
  });
});

describe("updateSession", () => {
  it("calls update(patch).eq('id', sessionId).select().single()", async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateSession(mock as any, "session-abc", {
      location: "new spot",
      notes: "new notes",
      start_time: "20:00",
      end_time: "23:00",
    });
    expect(mock.from).toHaveBeenCalledWith("sessions");
    expect(mock.update).toHaveBeenCalledWith({
      location: "new spot",
      notes: "new notes",
      start_time: "20:00",
      end_time: "23:00",
    });
    expect(mock.eq).toHaveBeenCalledWith("id", "session-abc");
    expect(mock.select).toHaveBeenCalled();
    expect(mock.single).toHaveBeenCalled();
  });

  it("supports partial patches (only some fields)", async () => {
    const mock = makeMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateSession(mock as any, "session-abc", { notes: "new" });
    expect(mock.update).toHaveBeenCalledWith({ notes: "new" });
  });
});

describe("fetchUpcomingSessionsForGames", () => {
  function makeSelectMock() {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const gte = vi.fn().mockReturnValue({ order });
    const inFn = vi.fn().mockReturnValue({ gte });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    return { from, select, inFn, gte, order };
  }

  it("queries sessions for the given game IDs from the given date, ordered by date asc", async () => {
    const { fetchUpcomingSessionsForGames } = await import("./sessions");
    const mock = makeSelectMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchUpcomingSessionsForGames(mock as any, ["g1", "g2"], "2026-06-01");
    expect(mock.from).toHaveBeenCalledWith("sessions");
    expect(mock.select).toHaveBeenCalledWith("*");
    expect(mock.inFn).toHaveBeenCalledWith("game_id", ["g1", "g2"]);
    expect(mock.gte).toHaveBeenCalledWith("date", "2026-06-01");
    expect(mock.order).toHaveBeenCalledWith("date", { ascending: true });
  });

  it("returns an empty result without querying when there are no game IDs", async () => {
    const { fetchUpcomingSessionsForGames } = await import("./sessions");
    const mock = makeSelectMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchUpcomingSessionsForGames(mock as any, [], "2026-06-01");
    expect(mock.from).not.toHaveBeenCalled();
    expect(result).toEqual({ data: [], error: null });
  });
});
