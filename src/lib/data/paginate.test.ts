import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchAllByKey, fetchAllPages, PAGE_SIZE, uuidSplitPoints, type KeyBounds } from "./paginate";
import type { PostgrestError } from "@supabase/supabase-js";

/** A buildPage backed by an in-memory array that honors the requested range. */
function pagerOver(rows: number[]) {
  const buildPage = vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, to + 1),
    error: null as PostgrestError | null,
  }));
  return buildPage;
}

describe("fetchAllPages", () => {
  it("stitches every row together across multiple pages", async () => {
    const rows = Array.from({ length: PAGE_SIZE * 2 + 37 }, (_, i) => i);
    const buildPage = pagerOver(rows);

    const { data, error } = await fetchAllPages<number>(buildPage);

    expect(error).toBeNull();
    expect(data).toEqual(rows); // all 2037 rows, not just the first 1000
    // 3 full-or-short pages: [0..999], [1000..1999], [2000..2036]
    expect(buildPage).toHaveBeenCalledTimes(3);
    expect(buildPage).toHaveBeenNthCalledWith(1, 0, PAGE_SIZE - 1);
    expect(buildPage).toHaveBeenNthCalledWith(2, PAGE_SIZE, PAGE_SIZE * 2 - 1);
    expect(buildPage).toHaveBeenNthCalledWith(3, PAGE_SIZE * 2, PAGE_SIZE * 3 - 1);
  });

  it("stops after a single short page without asking for another", async () => {
    const buildPage = pagerOver([1, 2, 3]);

    const { data } = await fetchAllPages<number>(buildPage);

    expect(data).toEqual([1, 2, 3]);
    expect(buildPage).toHaveBeenCalledTimes(1);
  });

  it("makes a second request when the first page is exactly full, then stops on the empty page", async () => {
    const rows = Array.from({ length: PAGE_SIZE }, (_, i) => i);
    const buildPage = pagerOver(rows);

    const { data } = await fetchAllPages<number>(buildPage);

    expect(data).toEqual(rows);
    // Exactly-full first page is indistinguishable from "more remain", so we
    // must fetch again; the second (empty) page ends the loop.
    expect(buildPage).toHaveBeenCalledTimes(2);
  });

  it("returns empty data (never null) when there are no rows", async () => {
    const buildPage = pagerOver([]);

    const { data, error } = await fetchAllPages<number>(buildPage);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("propagates an error and stops paging immediately", async () => {
    const err = { message: "boom" } as PostgrestError;
    const buildPage = vi.fn(async () => ({ data: null, error: err }));

    const { data, error } = await fetchAllPages<number>(buildPage);

    expect(data).toBeNull();
    expect(error).toBe(err);
    expect(buildPage).toHaveBeenCalledTimes(1);
  });

  it("discards earlier pages when a later page fails", async () => {
    const err = { message: "boom" } as PostgrestError;
    const buildPage = vi
      .fn()
      .mockResolvedValueOnce({ data: Array.from({ length: PAGE_SIZE }, (_, i) => i), error: null })
      .mockResolvedValueOnce({ data: null, error: err });

    const { data, error } = await fetchAllPages<number>(buildPage);

    // A partial result returned as success is the bug this helper exists to
    // prevent, so a failed page fails the whole read.
    expect(data).toBeNull();
    expect(error).toBe(err);
  });

  it("reads past an exact multiple of the page size", async () => {
    const rows = Array.from({ length: PAGE_SIZE * 2 }, (_, i) => i);
    const buildPage = pagerOver(rows);

    const { data } = await fetchAllPages<number>(buildPage);

    expect(data).toEqual(rows);
    expect(buildPage).toHaveBeenCalledTimes(3); // two full pages + empty final page
  });
});

describe("page-size contract", () => {
  it("never asks for more rows than the server's max_rows returns", () => {
    // A short page ends the scan. If PostgREST capped responses below
    // PAGE_SIZE, every page would come back short and the scan would stop
    // after the first one, silently.
    const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");
    const maxRows = Number(config.match(/^max_rows\s*=\s*(\d+)/m)?.[1]);

    expect(maxRows).toBeGreaterThan(0);
    expect(PAGE_SIZE).toBeLessThanOrEqual(maxRows);
  });
});

// ── Keyset pager ────────────────────────────────────────────

/** A UUID-shaped key whose leading 32 bits are `fraction` of the way through the space. */
function uuidAtFraction(fraction: number, suffix: number): string {
  const prefix = Math.min(Math.floor(fraction * 0x1_0000_0000), 0xffff_ffff).toString(16).padStart(8, "0");
  return `${prefix}-0000-4000-8000-${suffix.toString(16).padStart(12, "0")}`;
}

/** `count` keys spread evenly over the UUID space, ascending. */
function spreadKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => uuidAtFraction(i / count, i)).sort();
}

type Row = { key: string };

/**
 * A buildPage over an in-memory table that honours the bounds, orders by key
 * and caps at PAGE_SIZE, as the admin query does. Records every request's
 * bounds and how many were in flight at once.
 */
function keyedTable(keys: string[], opts: { failOnCall?: number } = {}) {
  const rows: Row[] = [...keys].sort().map((key) => ({ key }));
  const calls: KeyBounds[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const buildPage = vi.fn(async (bounds: KeyBounds) => {
    calls.push(bounds);
    const call = calls.length;
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 0));
    inFlight--;
    if (call === opts.failOnCall) return { data: null, error: { message: "boom" } as PostgrestError };
    const data = rows
      .filter(
        (r) =>
          (bounds.after === undefined || r.key > bounds.after) &&
          (bounds.from === undefined || r.key >= bounds.from) &&
          (bounds.before === undefined || r.key < bounds.before)
      )
      .slice(0, PAGE_SIZE)
      .map((r) => ({ ...r }));
    return { data, error: null as PostgrestError | null };
  });
  return { buildPage, calls, maxInFlight: () => maxInFlight, sorted: rows.map((r) => r.key) };
}

const keyOf = (r: Row) => r.key;
const splitPoints = uuidSplitPoints(8);

describe("uuidSplitPoints", () => {
  it("splits the UUID space into equal ranges by leading bits", () => {
    expect(uuidSplitPoints(8)).toEqual([
      "20000000-0000-0000-0000-000000000000",
      "40000000-0000-0000-0000-000000000000",
      "60000000-0000-0000-0000-000000000000",
      "80000000-0000-0000-0000-000000000000",
      "a0000000-0000-0000-0000-000000000000",
      "c0000000-0000-0000-0000-000000000000",
      "e0000000-0000-0000-0000-000000000000",
    ]);
    expect(uuidSplitPoints(1)).toEqual([]);
  });
});

describe("fetchAllByKey", () => {
  it("reads an empty table in one request", async () => {
    const t = keyedTable([]);
    const { data, error } = await fetchAllByKey(t.buildPage, keyOf, { splitPoints });
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(t.calls).toEqual([{}]);
  });

  it("reads a table that fits in one short page in exactly one request", async () => {
    const t = keyedTable(spreadKeys(PAGE_SIZE - 1));
    const { data } = await fetchAllByKey(t.buildPage, keyOf, { splitPoints });
    expect(data!.map(keyOf)).toEqual(t.sorted);
    expect(t.calls).toEqual([{}]);
  });

  it("reads exactly PAGE_SIZE rows once each, asking only about ranges past the first page", async () => {
    const t = keyedTable(spreadKeys(PAGE_SIZE));
    const { data } = await fetchAllByKey(t.buildPage, keyOf, { splitPoints });

    expect(data!.map(keyOf)).toEqual(t.sorted);
    // The first page reached into the last range [e0…, +∞), so every other
    // range was already covered and only that one is asked about.
    const last = t.sorted[PAGE_SIZE - 1];
    expect(last > splitPoints[6]).toBe(true);
    expect(t.calls).toEqual([{}, { after: last, from: undefined, before: undefined }]);
  });

  it("fans a large table out over every range concurrently, reading each row exactly once, in key order", async () => {
    // Rows on every boundary, just below each, and at both ends of the space.
    const edges = splitPoints.flatMap((p, i) => [
      p,
      `${(parseInt(p.slice(0, 8), 16) - 1).toString(16).padStart(8, "0")}-ffff-ffff-ffff-ffffffffff${i}0`,
    ]);
    const keys = [
      ...spreadKeys(PAGE_SIZE * 12 + 345),
      ...edges,
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    ];
    const t = keyedTable(keys);

    const { data, error } = await fetchAllByKey(t.buildPage, keyOf, { splitPoints });

    expect(error).toBeNull();
    expect(data!.map(keyOf)).toEqual(t.sorted); // all of them, none twice, ascending
    expect(new Set(data!.map(keyOf)).size).toBe(keys.length);
    expect(t.maxInFlight()).toBeGreaterThan(1);

    // After the first page, every request starts after what page one read, and
    // all eight ranges are asked about.
    const firstLast = t.sorted[PAGE_SIZE - 1];
    for (const b of t.calls.slice(1)) expect(b.after! >= firstLast).toBe(true);
    expect(new Set(t.calls.slice(1).map((b) => b.before ?? "end")).size).toBe(8);
  });

  it("handles a first page that ends exactly on a range boundary", async () => {
    // 999 keys below the first split point, then the split point itself: page one ends on it.
    const below = Array.from({ length: PAGE_SIZE - 1 }, (_, i) => uuidAtFraction((i / PAGE_SIZE) * 0.125, i));
    const above = Array.from({ length: 1500 }, (_, i) => uuidAtFraction(0.125 + ((i + 1) / 1501) * 0.875, i));
    const t = keyedTable([...below, splitPoints[0], ...above]);

    const { data } = await fetchAllByKey(t.buildPage, keyOf, { splitPoints });

    expect(t.sorted[PAGE_SIZE - 1]).toBe(splitPoints[0]);
    expect(data!.map(keyOf)).toEqual(t.sorted);
    // [−∞, p₀) is done; [p₀, p₁) continues after the boundary key itself.
    expect(t.calls[1]).toEqual({ after: splitPoints[0], from: undefined, before: splitPoints[1] });
    expect(t.calls.some((b) => b.before === splitPoints[0])).toBe(false);
  });

  it("pages sequentially without split points", async () => {
    const keys = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, i) => `2020-${String(i).padStart(5, "0")}`);
    const t = keyedTable(keys);

    const { data } = await fetchAllByKey(t.buildPage, keyOf);

    expect(data!.map(keyOf)).toEqual(t.sorted);
    expect(t.calls).toEqual([
      {},
      { after: t.sorted[PAGE_SIZE - 1], from: undefined, before: undefined },
      { after: t.sorted[PAGE_SIZE * 2 - 1], from: undefined, before: undefined },
    ]);
    expect(t.maxInFlight()).toBe(1);
  });

  it("asks once more after an exactly-full page and stops on the empty one", async () => {
    const keys = Array.from({ length: PAGE_SIZE * 2 }, (_, i) => `k${String(i).padStart(5, "0")}`);
    const t = keyedTable(keys);
    const { data } = await fetchAllByKey(t.buildPage, keyOf);
    expect(data).toHaveLength(PAGE_SIZE * 2);
    expect(t.calls).toHaveLength(3);
  });

  it("fails the whole read when a later page errors, with no partial result", async () => {
    const t = keyedTable(spreadKeys(PAGE_SIZE * 6), { failOnCall: 4 });
    const { data, error } = await fetchAllByKey(t.buildPage, keyOf, { splitPoints });
    expect(data).toBeNull();
    expect(error).toEqual({ message: "boom" });
  });

  it("fails when the first page errors, without asking for more", async () => {
    const t = keyedTable(spreadKeys(10), { failOnCall: 1 });
    const { data, error } = await fetchAllByKey(t.buildPage, keyOf, { splitPoints });
    expect(data).toBeNull();
    expect(error).toEqual({ message: "boom" });
    expect(t.calls).toHaveLength(1);
  });
});
