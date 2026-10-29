import {
  COMBO_LABELS,
  type Qualification,
  type RecordedScore,
} from "../feedback/qualifications";
import { CelebrationLayer } from "./CelebrationLayer";
import { SCORE_LABELS } from "../scoreLabels";

export function ActionFeedback({
  intro,
  banner,
  combos,
  recorded,
  eventKey,
}: {
  intro: boolean;
  banner: boolean;
  combos: Qualification[];
  recorded: RecordedScore | null;
  eventKey: string;
}) {
  // Score-table highlighting and celebration visibility are separate policies.
  const celebrations = combos.filter((combo) => combo.category !== "choice");
  return (
    <div className="action-feedback" aria-live="polite" aria-atomic="true">
      {intro && (
        <div className="turn-intro" data-feedback="turn-intro">
          당신의 턴입니다
        </div>
      )}
      {banner && celebrations.length > 0 && (
        <div className="combo-feedback" key={eventKey}>
          <div className="combo-heading">
            <span aria-hidden="true">✦</span> 족보 달성!{" "}
            <span aria-hidden="true">✦</span>
          </div>
          <div className="combo-cards">
            {celebrations.map((c) => (
              <span
                key={c.category}
                data-category={c.category}
                data-highlight={c.highlight}
              >
                <small className="combo-label">
                  {COMBO_LABELS[c.category]}
                </small>
                <strong>{SCORE_LABELS[c.category]}</strong>
                <small className="combo-score">
                  {c.score}점 <em>기록 가능</em>
                </small>
              </span>
            ))}
          </div>
        </div>
      )}
      <CelebrationLayer
        events={
          recorded?.category === "yacht"
            ? [
                {
                  id: recorded.id,
                  kind: recorded.score > 0 ? "fireworks" : "scream",
                  variant: "yacht",
                },
              ]
            : []
        }
      />
      {recorded && (
        <div
          key={recorded.id}
          className="record-feedback"
          data-feedback="score-recorded"
        >
          {SCORE_LABELS[recorded.category]} · {recorded.score}점 기록
        </div>
      )}
    </div>
  );
}
