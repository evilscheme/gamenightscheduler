export type GameTab = "overview" | "availability" | "schedule";

/**
 * Whether to show the "add your availability" onboarding nudge.
 * Shown to a game participant who has not yet marked any availability,
 * except while they are already on the Availability tab.
 */
export function shouldShowAvailabilityNudge(args: {
  hasAnyAvailability: boolean;
  activeTab: GameTab;
  isParticipant: boolean;
}): boolean {
  const { hasAnyAvailability, activeTab, isParticipant } = args;
  return isParticipant && !hasAnyAvailability && activeTab !== "availability";
}
