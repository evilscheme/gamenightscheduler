import { TEXT_LIMITS } from "./constants";

export interface GameFormData {
  name: string;
  description?: string;
  playDays: number[];
  adHocOnly?: boolean;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate game form data
 *
 * @param data - The form data to validate
 * @returns Validation result with valid flag and array of error messages
 */
export function validateGameForm(data: GameFormData): ValidationResult {
  const errors: string[] = [];

  // Validate name
  if (!data.name || !data.name.trim()) {
    errors.push("Please enter a game name");
  } else if (data.name.length > TEXT_LIMITS.GAME_NAME) {
    errors.push(`Game name must be ${TEXT_LIMITS.GAME_NAME} characters or less`);
  }

  // Validate description length if provided
  if (data.description && data.description.length > TEXT_LIMITS.GAME_DESCRIPTION) {
    errors.push(`Description must be ${TEXT_LIMITS.GAME_DESCRIPTION} characters or less`);
  }

  // Validate play days
  if (!data.adHocOnly && (!data.playDays || data.playDays.length === 0)) {
    errors.push("Please select at least one play day");
  }

  // Validate campaign dates
  if (data.campaignStartDate && data.campaignEndDate) {
    if (data.campaignEndDate < data.campaignStartDate) {
      errors.push("Campaign end date must be on or after start date");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
