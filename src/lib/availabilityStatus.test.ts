import { describe, it, expect } from "vitest";
import { getNextStatus, AvailabilityEntry } from "./availabilityStatus";

describe("getNextStatus", () => {
  it('returns "available" when current is undefined', () => {
    expect(getNextStatus(undefined)).toBe("available");
  });

  it('returns "unavailable" when current is available', () => {
    const entry: AvailabilityEntry = { status: "available", comment: null };
    expect(getNextStatus(entry)).toBe("unavailable");
  });

  it('returns "maybe" when current is unavailable', () => {
    const entry: AvailabilityEntry = { status: "unavailable", comment: null };
    expect(getNextStatus(entry)).toBe("maybe");
  });

  it('returns "available" when current is maybe', () => {
    const entry: AvailabilityEntry = { status: "maybe", comment: null };
    expect(getNextStatus(entry)).toBe("available");
  });

  it("preserves the cycling behavior with comments present", () => {
    const entryWithComment: AvailabilityEntry = {
      status: "available",
      comment: "Working late",
    };
    expect(getNextStatus(entryWithComment)).toBe("unavailable");
  });

  it("handles full cycle: undefined → available → unavailable → maybe → available", () => {
    // Start with undefined
    const first = getNextStatus(undefined);
    expect(first).toBe("available");

    // Then available → unavailable
    const second = getNextStatus({ status: first, comment: null });
    expect(second).toBe("unavailable");

    // Then unavailable → maybe
    const third = getNextStatus({ status: second, comment: null });
    expect(third).toBe("maybe");

    // Then maybe → available (full cycle)
    const fourth = getNextStatus({ status: third, comment: null });
    expect(fourth).toBe("available");
  });
});
