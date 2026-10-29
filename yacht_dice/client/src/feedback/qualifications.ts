import {
  categoryScore,
  SCORE_CATEGORIES,
  type ScoreCategory,
  type Scorecard,
} from "@yacht/shared";

export type Qualification = {
  category: ScoreCategory;
  score: number;
  highlight: "normal" | "special";
};
export type RecordedScore = {
  id: string;
  playerId: string;
  category: ScoreCategory;
  score: number;
};
export type RollPhase = "idle" | "shaking" | "throwing" | "result";
export const FEEDBACK_TIMING = {
  throw: 150,
  turnIntro: 500,
  result: 2800,
  recorded: 1200,
  hold: 300,
} as const;
export const COMBO_LABELS: Partial<Record<ScoreCategory, string>> = {
  choice: "CHOICE",
  fourOfAKind: "FOUR OF A KIND",
  fullHouse: "FULL HOUSE",
  smallStraight: "SMALL STRAIGHT",
  largeStraight: "LARGE STRAIGHT",
  yacht: "YACHT",
};

/** Presentation-independent policy. Choice never participates in the maximum. */
export function qualifications(
  dice: readonly number[],
  scores: Scorecard,
): Qualification[] {
  const candidates = SCORE_CATEGORIES.slice(6)
    .filter((category) => scores[category] === null)
    .map((category) => ({ category, score: categoryScore(category, dice) }))
    .filter((candidate) => candidate.score > 0);
  const maximum = Math.max(
    0,
    ...candidates.filter((c) => c.category !== "choice").map((c) => c.score),
  );
  return candidates.map((c) => ({
    ...c,
    highlight:
      c.category !== "choice" && c.score === maximum ? "special" : "normal",
  }));
}
