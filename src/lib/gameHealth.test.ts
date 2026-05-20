import { describe, it, expect } from "vitest";
import {
  calculateGameHealth,
  getHealthGrade,
  type GameHealthInput,
} from "./gameHealth";

// Fixed reference date for deterministic tests: 2025-03-15
const referenceDate = new Date("2025-03-15T12:00:00Z");

/** Helper: build a GameHealthInput with sensible defaults, overriding as needed */
function makeInput(overrides: Partial<GameHealthInput> = {}): GameHealthInput {
  return {
    playerCount: 4,
    futureSessionCount: 1,
    availabilityFillRate: 60,
    lastActivity: "2025-03-12T10:00:00Z", // 3 days ago
    createdAt: "2024-06-01T00:00:00Z", // ~9 months old
    ...overrides,
  };
}

describe("calculateGameHealth", () => {
  describe("composite scoring", () => {
    it("scores a thriving game 80+", () => {
      const result = calculateGameHealth(
        makeInput({
          playerCount: 6,
          futureSessionCount: 3,
          availabilityFillRate: 90,
          lastActivity: "2025-03-14T20:00:00Z", // yesterday
        }),
        referenceDate
      );

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toBe("A");
      expect(result.label).toBe("Thriving");
    });

    it("scores a dead game below 10", () => {
      const result = calculateGameHealth(
        makeInput({
          playerCount: 1,
          futureSessionCount: 0,
          availabilityFillRate: 0,
          lastActivity: null,
          createdAt: "2024-01-01T00:00:00Z", // old game
        }),
        referenceDate
      );

      expect(result.score).toBeLessThan(10);
      expect(result.grade).toBe("F");
      expect(result.label).toBe("Inactive");
    });

    it("applies new game floor of 50 for games < 14 days old", () => {
      const result = calculateGameHealth(
        makeInput({
          playerCount: 1, // solo GM
          futureSessionCount: 0,
          availabilityFillRate: 0,
          lastActivity: "2025-03-10T00:00:00Z",
          createdAt: "2025-03-08T00:00:00Z", // 7 days old
        }),
        referenceDate
      );

      // Without floor this would be very low, but new game floor = 50
      expect(result.score).toBe(50);
      expect(result.grade).toBe("C");
    });

    it("does not apply new game floor for games >= 14 days old", () => {
      const result = calculateGameHealth(
        makeInput({
          playerCount: 1,
          futureSessionCount: 0,
          availabilityFillRate: 0,
          lastActivity: null,
          createdAt: "2025-02-01T00:00:00Z", // 42 days old
        }),
        referenceDate
      );

      // No floor applied; score should be low
      expect(result.score).toBeLessThan(50);
    });
  });

  describe("player score dimension", () => {
    it("gives 0 for solo GM", () => {
      const result = calculateGameHealth(
        makeInput({ playerCount: 1 }),
        referenceDate
      );
      expect(result.breakdown.playerScore).toBe(0);
    });

    it("gives 33 for 2 players", () => {
      const result = calculateGameHealth(
        makeInput({ playerCount: 2 }),
        referenceDate
      );
      expect(result.breakdown.playerScore).toBe(33);
    });

    it("gives 67 for 3 players", () => {
      const result = calculateGameHealth(
        makeInput({ playerCount: 3 }),
        referenceDate
      );
      expect(result.breakdown.playerScore).toBe(67);
    });

    it("gives 100 for 4 players", () => {
      const result = calculateGameHealth(
        makeInput({ playerCount: 4 }),
        referenceDate
      );
      expect(result.breakdown.playerScore).toBe(100);
    });

    it("gives 100 for 5+ players", () => {
      const result = calculateGameHealth(
        makeInput({ playerCount: 5 }),
        referenceDate
      );
      expect(result.breakdown.playerScore).toBe(100);

      const result10 = calculateGameHealth(
        makeInput({ playerCount: 10 }),
        referenceDate
      );
      expect(result10.breakdown.playerScore).toBe(100);
    });
  });

  describe("session score dimension", () => {
    it("gives 0 for no sessions at all", () => {
      const result = calculateGameHealth(
        makeInput({ futureSessionCount: 0 }),
        referenceDate
      );
      expect(result.breakdown.sessionScore).toBe(0);
    });

    it("gives 100 for 2+ future sessions even with no past sessions", () => {
      const result = calculateGameHealth(
        makeInput({ futureSessionCount: 2 }),
        referenceDate
      );
      expect(result.breakdown.sessionScore).toBe(100);
    });

    it("gives 50 for 1 future session", () => {
      const result = calculateGameHealth(
        makeInput({ futureSessionCount: 1 }),
        referenceDate
      );
      expect(result.breakdown.sessionScore).toBe(50);
    });

  });

  describe("fill rate score dimension", () => {
    it("passes through availabilityFillRate directly", () => {
      const result = calculateGameHealth(
        makeInput({ availabilityFillRate: 73 }),
        referenceDate
      );
      expect(result.breakdown.fillRateScore).toBe(73);
    });

    it("clamps to 0 minimum", () => {
      const result = calculateGameHealth(
        makeInput({ availabilityFillRate: -5 }),
        referenceDate
      );
      expect(result.breakdown.fillRateScore).toBe(0);
    });

    it("clamps to 100 maximum", () => {
      const result = calculateGameHealth(
        makeInput({ availabilityFillRate: 110 }),
        referenceDate
      );
      expect(result.breakdown.fillRateScore).toBe(100);
    });
  });

  describe("recency score dimension", () => {
    it("gives 100 for activity within 7 days", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: "2025-03-14T00:00:00Z" }), // 1 day ago
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(100);
    });

    it("gives 100 for activity 7-14 days ago", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: "2025-03-05T00:00:00Z" }), // 10 days ago
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(100);
    });

    it("decays smoothly after 14 days", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: "2025-02-25T00:00:00Z" }), // 18 days ago
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(91);
    });

    it("continues smooth decay 30-45 days ago", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: "2025-02-08T00:00:00Z" }), // 35 days ago
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(54);
    });

    it("continues smooth decay 45-60 days ago", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: "2025-01-25T00:00:00Z" }), // 49 days ago
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(24);
    });

    it("gives 0 for activity over 60 days ago", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: "2024-12-01T00:00:00Z" }), // ~104 days ago
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(0);
    });

    it("gives 0 for null lastActivity", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: null }),
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(0);
    });

    it("gives 100 for future lastActivity (timezone edge case)", () => {
      const result = calculateGameHealth(
        makeInput({ lastActivity: "2025-03-16T00:00:00Z" }), // tomorrow
        referenceDate
      );
      expect(result.breakdown.recencyScore).toBe(100);
    });
  });

  describe("result structure", () => {
    it("returns score, grade, label, and breakdown", () => {
      const result = calculateGameHealth(makeInput(), referenceDate);

      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("grade");
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("breakdown");
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("clamps final score between 0 and 100", () => {
      // Even extreme inputs shouldn't produce out-of-range scores
      const low = calculateGameHealth(
        makeInput({
          playerCount: 0,
          futureSessionCount: 0,
          availabilityFillRate: 0,
          lastActivity: null,
          createdAt: "2020-01-01T00:00:00Z",
        }),
        referenceDate
      );
      expect(low.score).toBeGreaterThanOrEqual(0);

      const high = calculateGameHealth(
        makeInput({
          playerCount: 100,
          futureSessionCount: 50,
          availabilityFillRate: 100,
          lastActivity: "2025-03-15T00:00:00Z",
        }),
        referenceDate
      );
      expect(high.score).toBeLessThanOrEqual(100);
    });
  });
});

describe("getHealthGrade", () => {
  it("returns A/Thriving for scores 80-100", () => {
    expect(getHealthGrade(80)).toEqual({ grade: "A", label: "Thriving" });
    expect(getHealthGrade(100)).toEqual({ grade: "A", label: "Thriving" });
    expect(getHealthGrade(95)).toEqual({ grade: "A", label: "Thriving" });
  });

  it("returns B/Healthy for scores 60-79", () => {
    expect(getHealthGrade(60)).toEqual({ grade: "B", label: "Healthy" });
    expect(getHealthGrade(79)).toEqual({ grade: "B", label: "Healthy" });
  });

  it("returns C/Moderate for scores 40-59", () => {
    expect(getHealthGrade(40)).toEqual({ grade: "C", label: "Moderate" });
    expect(getHealthGrade(59)).toEqual({ grade: "C", label: "Moderate" });
  });

  it("returns D/Struggling for scores 20-39", () => {
    expect(getHealthGrade(20)).toEqual({ grade: "D", label: "Struggling" });
    expect(getHealthGrade(39)).toEqual({ grade: "D", label: "Struggling" });
  });

  it("returns F/Inactive for scores 0-19", () => {
    expect(getHealthGrade(0)).toEqual({ grade: "F", label: "Inactive" });
    expect(getHealthGrade(19)).toEqual({ grade: "F", label: "Inactive" });
  });

  it("handles boundary values correctly", () => {
    // 79 should be B, not A
    expect(getHealthGrade(79).grade).toBe("B");
    // 80 should be A
    expect(getHealthGrade(80).grade).toBe("A");
  });
});
