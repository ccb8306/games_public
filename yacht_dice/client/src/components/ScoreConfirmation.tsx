import type { ScoreCategory } from "@yacht/shared";
import { SCORE_LABELS } from "../scoreLabels";

type Props = {
  selected: ScoreCategory | null;
  preview: number | null;
  enabled: boolean;
  reason: string;
  onConfirm: (category: ScoreCategory) => void;
};

export function ScoreConfirmation({
  selected,
  preview,
  enabled,
  reason,
  onConfirm,
}: Props) {
  return (
    <div className="score-confirm">
      <p id="score-confirm-reason" role="status">
        {reason}
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
          ? `${SCORE_LABELS[selected]} · ${preview}점 확정`
          : "점수 확정"}
      </button>
      <small>점수 선택 후 확정 · 마우스 더블클릭으로 바로 확정</small>
    </div>
  );
}
