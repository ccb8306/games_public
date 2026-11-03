import type { ScoreCategory, ScoreBreakdown } from "@yacht/shared";
import { SCORE_LABELS } from "../scoreLabels";
import { describeScore, signedScore, augmentDelta } from "../scoreBreakdown";

type Props = {
  selected: ScoreCategory | null;
  preview: number | null;
  breakdown?: ScoreBreakdown | null;
  enabled: boolean;
  reason: string;
  onConfirm: (category: ScoreCategory) => void;
};

export function ScoreConfirmation({
  selected,
  preview,
  breakdown,
  enabled,
  reason,
  onConfirm,
}: Props) {
  return (
    <div className={`score-confirm ${breakdown ? "has-breakdown" : ""}`}>
      <p id="score-confirm-reason" role="status">
        {breakdown ? (
          <span
            className="score-breakdown"
            aria-label={describeScore(breakdown)}
          >
            <span>
              기본 <b>{breakdown.base}점</b>
            </span>
            <span>
              증강·사건 <b>{signedScore(augmentDelta(breakdown))}</b>
            </span>
            {!!breakdown.otherRecords && (
              <span>
                칸 복구 <b>{signedScore(breakdown.otherRecords)}</b>
              </span>
            )}
            {!!breakdown.upperBonus && (
              <span>
                상단 보너스 <b>{signedScore(breakdown.upperBonus)}</b>
              </span>
            )}
            {!!breakdown.floorAdjustment && (
              <span>
                하한 보정 <b>{signedScore(breakdown.floorAdjustment)}</b>
              </span>
            )}
            <span className="score-net">
              총점 변화 <b>{signedScore(breakdown.total)}</b>
            </span>
          </span>
        ) : (
          reason
        )}
      </p>
      <button
        className="primary"
        disabled={!enabled || selected === null}
        aria-describedby="score-confirm-reason"
        onClick={() => {
          if (selected !== null) onConfirm(selected);
        }}
      >
        {selected !== null && preview !== null
          ? `${SCORE_LABELS[selected]} · ${preview}점 ${breakdown ? "기록" : "확정"}`
          : "점수 확정"}
      </button>
      <small>점수 선택 후 확정 · 마우스 더블클릭으로 바로 확정</small>
    </div>
  );
}
