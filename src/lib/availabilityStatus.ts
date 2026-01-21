import { AvailabilityStatus } from "@/types";

export interface AvailabilityEntry {
  status: AvailabilityStatus;
  comment: string | null;
}

/**
 * Get the next availability status in the cycle.
 * Cycles: undefined → available → unavailable → maybe → available (repeats)
 */
export function getNextStatus(
  current: AvailabilityEntry | undefined
): AvailabilityStatus {
  if (!current) return "available";
  switch (current.status) {
    case "available":
      return "unavailable";
    case "unavailable":
      return "maybe";
    case "maybe":
      return "available";
  }
}
