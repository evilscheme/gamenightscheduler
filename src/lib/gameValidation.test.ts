import { describe, it, expect } from "vitest";
import { validateGameForm } from "./gameValidation";
import { TEXT_LIMITS } from "./constants";

describe("validateGameForm", () => {
  it("returns valid for valid form data", () => {
    const result = validateGameForm({
      name: "Friday Game Night",
      playDays: [5],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails for empty name", () => {
    const result = validateGameForm({
      name: "",
      playDays: [5],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Please enter a game name");
  });

  it("fails for whitespace-only name", () => {
    const result = validateGameForm({
      name: "   ",
      playDays: [5],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Please enter a game name");
  });

  it("fails for no play days selected", () => {
    const result = validateGameForm({
      name: "Game Night",
      playDays: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Please select at least one play day");
  });

  it("passes with a single play day selected", () => {
    const result = validateGameForm({
      name: "Game Night",
      playDays: [3], // Wednesday
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("passes with all play days selected", () => {
    const result = validateGameForm({
      name: "Daily Games",
      playDays: [0, 1, 2, 3, 4, 5, 6],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns multiple errors when both name and play days are invalid", () => {
    const result = validateGameForm({
      name: "",
      playDays: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(result.errors).toContain("Please enter a game name");
    expect(result.errors).toContain("Please select at least one play day");
  });

  it("accepts names with special characters", () => {
    const result = validateGameForm({
      name: "D&D: Campaign #2!",
      playDays: [5],
    });

    expect(result.valid).toBe(true);
  });

  it("accepts names with leading/trailing whitespace (trims internally)", () => {
    const result = validateGameForm({
      name: "  Game Night  ",
      playDays: [5],
    });

    expect(result.valid).toBe(true);
  });

  it("handles undefined playDays gracefully", () => {
    const result = validateGameForm({
      name: "Game Night",
      playDays: undefined as unknown as number[],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Please select at least one play day");
  });

  it("fails for game name exceeding max length", () => {
    const longName = "A".repeat(TEXT_LIMITS.GAME_NAME + 1);
    const result = validateGameForm({
      name: longName,
      playDays: [5],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Game name must be ${TEXT_LIMITS.GAME_NAME} characters or less`);
  });

  it("passes for game name at exactly max length", () => {
    const exactLengthName = "A".repeat(TEXT_LIMITS.GAME_NAME);
    const result = validateGameForm({
      name: exactLengthName,
      playDays: [5],
    });

    expect(result.valid).toBe(true);
  });

  it("fails for description exceeding max length", () => {
    const longDescription = "A".repeat(TEXT_LIMITS.GAME_DESCRIPTION + 1);
    const result = validateGameForm({
      name: "Game Night",
      description: longDescription,
      playDays: [5],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`Description must be ${TEXT_LIMITS.GAME_DESCRIPTION} characters or less`);
  });

  it("passes for description at exactly max length", () => {
    const exactLengthDescription = "A".repeat(TEXT_LIMITS.GAME_DESCRIPTION);
    const result = validateGameForm({
      name: "Game Night",
      description: exactLengthDescription,
      playDays: [5],
    });

    expect(result.valid).toBe(true);
  });

  it("passes for undefined description", () => {
    const result = validateGameForm({
      name: "Game Night",
      playDays: [5],
    });

    expect(result.valid).toBe(true);
  });

  it("passes for empty description", () => {
    const result = validateGameForm({
      name: "Game Night",
      description: "",
      playDays: [5],
    });

    expect(result.valid).toBe(true);
  });
});
