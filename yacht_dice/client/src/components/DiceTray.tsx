import type { RoomState } from "@yacht/shared";
import type { RollPhase } from "../feedback/qualifications";
import { useShakingFaces } from "../hooks/useShakingFaces";

const PIP_POSITIONS = [
  [],
  [[30, 30]],
  [
    [16, 16],
    [44, 44],
  ],
  [
    [16, 16],
    [30, 30],
    [44, 44],
  ],
  [
    [16, 16],
    [44, 16],
    [16, 44],
    [44, 44],
  ],
  [
    [16, 16],
    [44, 16],
    [30, 30],
    [16, 44],
    [44, 44],
  ],
  [
    [16, 16],
    [44, 16],
    [16, 30],
    [44, 30],
    [16, 44],
    [44, 44],
  ],
];
type Props = {
  dice: RoomState["dice"];
  held: RoomState["held"];
  disabled: boolean;
  phase?: RollPhase;
  holdFeedback?: { id: number; indices: number[] } | null;
  onHolds: (held: RoomState["held"]) => void;
};
export function DiceTray({
  dice,
  held,
  disabled,
  onHolds,
  phase = "idle",
  holdFeedback,
}: Props) {
  const shakingFaces = useShakingFaces(phase === "shaking");
  function toggle(index: number) {
    const next: RoomState["held"] = [...held];
    next[index] = !next[index];
    onHolds(next);
  }
  return (
    <div className="dice-tray" data-roll-phase={phase}>
      {dice.map((value, i) => {
        const displayValue =
          !held[i] && phase === "shaking" ? (shakingFaces[i] ?? 5) : value;
        return (
          <button
            className={`die ${held[i] ? "held" : ""}`}
            key={i}
            aria-label={`${i + 1}번 주사위 ${!held[i] && (phase === "shaking" || phase === "throwing") ? "굴리는 중" : (value ?? "굴리기 전")}${held[i] ? ", 보관 중" : ""}`}
            aria-pressed={held[i]}
            disabled={disabled}
            onClick={() => toggle(i)}
          >
            <strong className="die-value" aria-hidden="true">
              {displayValue ?? "—"}
            </strong>
            <span
              className="die-face"
              data-value={displayValue ?? "unrolled"}
              aria-hidden="true"
              key={holdFeedback?.indices.includes(i) ? holdFeedback.id : "rest"}
              data-feedback={
                holdFeedback?.indices.includes(i) ? "hold-changed" : undefined
              }
            >
              <svg viewBox="0 0 60 60" focusable="false" aria-hidden="true">
                <rect
                  x="3"
                  y="3"
                  width="54"
                  height="54"
                  rx="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <g className="die-pips">
                  {(PIP_POSITIONS[displayValue ?? 0] ?? []).map(
                    ([cx, cy], index) => (
                      <circle key={index} cx={cx} cy={cy} r="4.5" />
                    ),
                  )}
                </g>
                {displayValue === null && (
                  <path d="M22 30h16" stroke="currentColor" strokeWidth="3" />
                )}
              </svg>
            </span>
            <small>{held[i] ? "보관" : value ? "선택" : "대기"}</small>
          </button>
        );
      })}
    </div>
  );
}
