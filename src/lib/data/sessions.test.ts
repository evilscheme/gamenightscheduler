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
