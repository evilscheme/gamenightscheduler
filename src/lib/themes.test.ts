import { describe, it, expect } from "vitest";
import { themes, getThemeById, DEFAULT_THEME_ID, Theme } from "./themes";

describe("themes", () => {
  describe("themes array", () => {
    it("has at least one theme defined", () => {
      expect(themes.length).toBeGreaterThan(0);
    });

    it("all themes have required properties", () => {
      themes.forEach((theme) => {
        expect(theme.id).toBeDefined();
        expect(theme.id.length).toBeGreaterThan(0);
        expect(theme.name).toBeDefined();
        expect(theme.name.length).toBeGreaterThan(0);
        expect(theme.description).toBeDefined();
        expect(theme.previewColors).toBeDefined();
        expect(theme.previewColors.primary).toBeDefined();
        expect(theme.previewColors.secondary).toBeDefined();
        expect(theme.previewColors.accent).toBeDefined();
      });
    });

    it("all theme IDs are unique", () => {
      const ids = themes.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("all theme names are unique", () => {
      const names = themes.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("preview colors are valid hex colors", () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      themes.forEach((theme) => {
        expect(theme.previewColors.primary).toMatch(hexColorRegex);
        expect(theme.previewColors.secondary).toMatch(hexColorRegex);
        expect(theme.previewColors.accent).toMatch(hexColorRegex);
      });
    });
  });

  describe("DEFAULT_THEME_ID", () => {
    it("is a valid theme ID", () => {
      const defaultTheme = getThemeById(DEFAULT_THEME_ID);
      expect(defaultTheme).toBeDefined();
    });

    it("is a non-empty string", () => {
      expect(DEFAULT_THEME_ID).toBeDefined();
      expect(DEFAULT_THEME_ID.length).toBeGreaterThan(0);
    });
  });

  describe("getThemeById", () => {
    it("returns the correct theme for a valid ID", () => {
      const theme = getThemeById("ocean");
      expect(theme).toBeDefined();
      expect(theme?.id).toBe("ocean");
      expect(theme?.name).toBe("Ocean Blue");
    });

    it("returns undefined for an invalid ID", () => {
      const theme = getThemeById("nonexistent-theme");
      expect(theme).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const theme = getThemeById("");
      expect(theme).toBeUndefined();
    });

    it("is case-sensitive", () => {
      const lowerCase = getThemeById("ocean");
      const upperCase = getThemeById("OCEAN");
      const mixedCase = getThemeById("Ocean");

      expect(lowerCase).toBeDefined();
      expect(upperCase).toBeUndefined();
      expect(mixedCase).toBeUndefined();
    });

    it("can retrieve all defined themes by their IDs", () => {
      themes.forEach((expectedTheme) => {
        const retrievedTheme = getThemeById(expectedTheme.id);
        expect(retrievedTheme).toBeDefined();
        expect(retrievedTheme?.id).toBe(expectedTheme.id);
        expect(retrievedTheme?.name).toBe(expectedTheme.name);
      });
    });

    it("returns the same reference as in the themes array", () => {
      const themeFromArray = themes.find((t) => t.id === "purple");
      const themeFromGetter = getThemeById("purple");
      expect(themeFromGetter).toBe(themeFromArray);
    });
  });
});
