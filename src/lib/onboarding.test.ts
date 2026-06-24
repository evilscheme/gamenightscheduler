import { describe, it, expect } from "vitest";
import { shouldShowAvailabilityNudge } from "./onboarding";

describe("shouldShowAvailabilityNudge", () => {
  const base = {
    hasAnyAvailability: false,
    activeTab: "overview" as const,
    isParticipant: true,
  };

  it("shows for a participant with no availability on the overview tab", () => {
    expect(shouldShowAvailabilityNudge(base)).toBe(true);
  });

  it("shows for a participant with no availability on the schedule tab", () => {
    expect(shouldShowAvailabilityNudge({ ...base, activeTab: "schedule" })).toBe(true);
  });

  it("hides when the participant already has availability", () => {
    expect(shouldShowAvailabilityNudge({ ...base, hasAnyAvailability: true })).toBe(false);
  });

  it("hides while on the availability tab even with no availability", () => {
    expect(shouldShowAvailabilityNudge({ ...base, activeTab: "availability" })).toBe(false);
  });

  it("hides for a non-participant", () => {
    expect(shouldShowAvailabilityNudge({ ...base, isParticipant: false })).toBe(false);
  });
});
