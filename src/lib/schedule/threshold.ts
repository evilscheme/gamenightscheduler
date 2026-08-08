/**
 * The number of confirmed players a date needs to count as "enough".
 *
 * `gmValue` is `games.min_players_needed`, where 0 means the GM never chose one.
 * The derived default is 60% of the group rounded up, floored at 3 and capped at
 * the group size — so it stays reachable for small tables.
 *
 * An explicit GM value is used verbatim and deliberately NOT capped: a game whose
 * minimum exceeds its roster genuinely cannot run, and the calendar should say so
 * rather than quietly lowering the bar.
 */
export function effectiveThreshold(gmValue: number, totalPlayers: number): number {
  if (gmValue > 0) return gmValue;
  if (totalPlayers <= 0) return 0;
  return Math.min(totalPlayers, Math.max(3, Math.ceil(0.6 * totalPlayers)));
}
