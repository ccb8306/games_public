import type { ScoreBreakdown } from "@yacht/shared";

export const signedScore = (value: number) =>
  `${value >= 0 ? "+" : ""}${value}점`;
export function describeScore(score: ScoreBreakdown) {
  return [
    `점수판 기록 ${score.recorded}점`,
    `증강·사건 ${signedScore(score.augment)}`,
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
