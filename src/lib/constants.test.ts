import { describe, it, expect } from "vitest";
import { USAGE_LIMITS } from "./constants";

describe("USAGE_LIMITS", () => {
  it("defines MAX_GAMES_PER_USER as 20", () => {
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBe(20);
  });

  it("defines MAX_PLAYERS_PER_GAME as 50", () => {
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBe(50);
  });

  it("limits are positive numbers", () => {
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeGreaterThan(0);
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeGreaterThan(0);
  });

  it("limits are reasonable (not too restrictive or too permissive)", () => {
    // Max games should be between 5 and 100
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeGreaterThanOrEqual(5);
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeLessThanOrEqual(100);

    // Max players should be between 10 and 200
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeGreaterThanOrEqual(10);
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeLessThanOrEqual(200);
  });
});
