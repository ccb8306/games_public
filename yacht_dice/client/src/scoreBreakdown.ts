import type { ScoreBreakdown } from "@yacht/shared";

export const signedScore = (value: number) =>
  `${value >= 0 ? "+" : ""}${value}점`;
export const augmentDelta = (score: ScoreBreakdown) =>
  score.recorded - score.base + score.augment;
export function compactScore(score: ScoreBreakdown) {
  const extra = augmentDelta(score);
  return `${score.base}(${extra >= 0 ? "+" : ""}${extra})`;
}
export function describeScore(score: ScoreBreakdown) {
  return [
    `기본 ${score.base}점`,
    `점수판 기록 ${score.recorded}점`,
    `증강·사건 ${signedScore(augmentDelta(score))}`,
    `상단 63점 인정 ${score.upperCredit}점`,
    ...(score.otherRecords
      ? [`다른 칸 복구 ${signedScore(score.otherRecords)}`]
      : []),
    ...(score.upperBonus
      ? [`상단 보너스 ${signedScore(score.upperBonus)}`]
      : []),
    ...(score.floorAdjustment
      ? [`총점 하한 보정 ${signedScore(score.floorAdjustment)}`]
      : []),
    `총점 변화 ${signedScore(score.total)}`,
  ].join(" · ");
}
