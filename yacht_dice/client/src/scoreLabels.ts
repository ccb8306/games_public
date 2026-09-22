import {
  SCORE_LABELS as defaultLabels,
  type ScoreCategory,
} from "@yacht/shared";

// Presentation names are separate from stable protocol category IDs.
export const SCORE_LABELS: Record<ScoreCategory, string> = {
  ...defaultLabels,
  ones: "ones",
  twos: "twos",
  threes: "threes",
  fours: "fours",
  fives: "fives",
  sixes: "sixes",
  fourOfAKind: "포 오브 카인드",
};
