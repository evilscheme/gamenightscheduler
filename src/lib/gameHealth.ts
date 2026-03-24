// ── Types ──────────────────────────────────────────────────

export interface GameHealthInput {
  playerCount: number;
  confirmedSessionCount: number;
  futureSessionCount: number;
  availabilityFillRate: number; // 0-100
  lastActivity: string | null; // ISO timestamp
  createdAt: string; // ISO timestamp
}

export interface HealthBreakdown {
  playerScore: number; // 0-100
  sessionScore: number; // 0-100
  fillRateScore: number; // 0-100
  recencyScore: number; // 0-100
}

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export interface GameHealthResult {
  score: number; // 0-100
  grade: HealthGrade;
  label: string;
  breakdown: HealthBreakdown;
}

// ── Weights ────────────────────────────────────────────────

const WEIGHTS = {
  players: 0.25,
  sessions: 0.25,
  fillRate: 0.25,
  recency: 0.25,
} as const;

/** New games (< 14 days old) get a minimum score floor */
const NEW_GAME_DAYS = 14;
const NEW_GAME_FLOOR = 50;

// ── Sub-score functions ────────────────────────────────────

function daysBetween(dateStr: string, referenceDate: Date): number {
  const date = new Date(dateStr);
  return Math.floor(
    (referenceDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/** 1 player = 0, 2 = 30, 3 = 60, 4 = 80, 5+ = 100 */
function calcPlayerScore(playerCount: number): number {
  if (playerCount >= 5) return 100;
  if (playerCount === 4) return 80;
  if (playerCount === 3) return 60;
  if (playerCount === 2) return 30;
  return 0;
}

/**
 * Blend of total confirmed sessions (50%) and future sessions presence (50%).
 * 5+ confirmed sessions = max for the total sub-signal.
 */
function calcSessionScore(
  confirmedSessionCount: number,
  futureSessionCount: number
): number {
  const totalSignal = Math.min(confirmedSessionCount / 5, 1) * 100;
  const futureSignal = futureSessionCount > 0 ? 100 : 0;
  return Math.round((totalSignal + futureSignal) / 2);
}

/** Aggressive decay: 0 at 60+ days */
function calcRecencyScore(
  lastActivity: string | null,
  referenceDate: Date
): number {
  if (!lastActivity) return 0;
  const days = daysBetween(lastActivity, referenceDate);
  if (days < 0) return 100; // future date, treat as very recent
  if (days < 7) return 100;
  if (days < 14) return 75;
  if (days < 30) return 50;
  if (days < 45) return 25;
  if (days < 60) return 10;
  return 0;
}

// ── Grade mapping ──────────────────────────────────────────

const GRADE_THRESHOLDS: Array<{
  min: number;
  grade: HealthGrade;
  label: string;
}> = [
  { min: 80, grade: "A", label: "Thriving" },
  { min: 60, grade: "B", label: "Healthy" },
  { min: 40, grade: "C", label: "Moderate" },
  { min: 20, grade: "D", label: "Struggling" },
  { min: 0, grade: "F", label: "Inactive" },
];

export function getHealthGrade(score: number): {
  grade: HealthGrade;
  label: string;
} {
  for (const tier of GRADE_THRESHOLDS) {
    if (score >= tier.min) return { grade: tier.grade, label: tier.label };
  }
  return { grade: "F", label: "Inactive" };
}

// ── Main scoring function ──────────────────────────────────

export function calculateGameHealth(
  input: GameHealthInput,
  referenceDate: Date = new Date()
): GameHealthResult {
  const breakdown: HealthBreakdown = {
    playerScore: calcPlayerScore(input.playerCount),
    sessionScore: calcSessionScore(
      input.confirmedSessionCount,
      input.futureSessionCount
    ),
    fillRateScore: Math.round(
      Math.max(0, Math.min(100, input.availabilityFillRate))
    ),
    recencyScore: calcRecencyScore(input.lastActivity, referenceDate),
  };

  let score = Math.round(
    breakdown.playerScore * WEIGHTS.players +
      breakdown.sessionScore * WEIGHTS.sessions +
      breakdown.fillRateScore * WEIGHTS.fillRate +
      breakdown.recencyScore * WEIGHTS.recency
  );

  // New game floor: games less than NEW_GAME_DAYS old get a minimum score
  const ageInDays = daysBetween(input.createdAt, referenceDate);
  if (ageInDays >= 0 && ageInDays < NEW_GAME_DAYS) {
    score = Math.max(score, NEW_GAME_FLOOR);
  }

  score = Math.max(0, Math.min(100, score));

  const { grade, label } = getHealthGrade(score);

  return { score, grade, label, breakdown };
}
