import { describe, it, expect, vi } from "vitest";
import { fetchAllPages, PAGE_SIZE } from "./paginate";
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
});
