import { describe, it, expect } from "vitest";
import { USAGE_LIMITS, TEXT_LIMITS } from "./constants";

describe("USAGE_LIMITS", () => {
  it("defines MAX_GAMES_PER_USER as 20", () => {
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBe(20);
  });

  it("defines MAX_PLAYERS_PER_GAME as 50", () => {
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBe(50);
  });

  it("defines MAX_FUTURE_SESSIONS_PER_GAME as 100", () => {
    expect(USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME).toBe(100);
  });

  it("limits are positive numbers", () => {
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeGreaterThan(0);
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeGreaterThan(0);
    expect(USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME).toBeGreaterThan(0);
  });

  it("limits are reasonable (not too restrictive or too permissive)", () => {
    // Max games should be between 5 and 100
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeGreaterThanOrEqual(5);
    expect(USAGE_LIMITS.MAX_GAMES_PER_USER).toBeLessThanOrEqual(100);

    // Max players should be between 10 and 200
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeGreaterThanOrEqual(10);
    expect(USAGE_LIMITS.MAX_PLAYERS_PER_GAME).toBeLessThanOrEqual(200);

    // Max future sessions should be between 50 and 500
    expect(USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME).toBeGreaterThanOrEqual(50);
    expect(USAGE_LIMITS.MAX_FUTURE_SESSIONS_PER_GAME).toBeLessThanOrEqual(500);
  });
});

describe("TEXT_LIMITS", () => {
  it("defines GAME_NAME as 100", () => {
    expect(TEXT_LIMITS.GAME_NAME).toBe(100);
  });

  it("defines GAME_DESCRIPTION as 1000", () => {
    expect(TEXT_LIMITS.GAME_DESCRIPTION).toBe(1000);
  });

  it("defines USER_DISPLAY_NAME as 50", () => {
    expect(TEXT_LIMITS.USER_DISPLAY_NAME).toBe(50);
  });

  it("all text limits are positive numbers", () => {
    expect(TEXT_LIMITS.GAME_NAME).toBeGreaterThan(0);
    expect(TEXT_LIMITS.GAME_DESCRIPTION).toBeGreaterThan(0);
    expect(TEXT_LIMITS.USER_DISPLAY_NAME).toBeGreaterThan(0);
  });

  it("text limits are reasonable", () => {
    // Game name should allow decent length but not be excessive
    expect(TEXT_LIMITS.GAME_NAME).toBeGreaterThanOrEqual(50);
    expect(TEXT_LIMITS.GAME_NAME).toBeLessThanOrEqual(200);

    // Description should allow paragraphs but not essays
    expect(TEXT_LIMITS.GAME_DESCRIPTION).toBeGreaterThanOrEqual(500);
    expect(TEXT_LIMITS.GAME_DESCRIPTION).toBeLessThanOrEqual(5000);

    // Display name should allow full names but not novels
    expect(TEXT_LIMITS.USER_DISPLAY_NAME).toBeGreaterThanOrEqual(20);
    expect(TEXT_LIMITS.USER_DISPLAY_NAME).toBeLessThanOrEqual(100);
  });
});
