import type { MotionStream } from "../dice/motion";
import type { RoomState } from "@yacht/shared";
import type { RollPhase } from "../feedback/qualifications";
import { DiceCup } from "./DiceCup";

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
  motion?: MotionStream;
  dice: RoomState["dice"];
  held: RoomState["held"];
  disabled: boolean;
  lockedIndices?: number[];
  sealedIndices?: number[];
  bombIndex?: number;
  maxHeld?: number;
  phase?: RollPhase;
  holdFeedback?: { id: number; indices: number[] } | null;
  onHolds: (held: RoomState["held"]) => void;
};
export function DiceTray({
  motion,
  dice,
  held,
  disabled,
  onHolds,
  phase = "idle",
  holdFeedback,
  lockedIndices = [],
  sealedIndices = [],
  bombIndex,
  maxHeld = Infinity,
}: Props) {
  const heldCount = held.filter(Boolean).length;
  function toggle(index: number) {
    if (
      disabled ||
      lockedIndices.includes(index) ||
      (!held[index] && heldCount >= maxHeld)
    )
      return;
    const next: RoomState["held"] = [...held];
    next[index] = !next[index];
    onHolds(next);
  }
  return (
    <div className="dice-tray" data-roll-phase={phase}>
      <div className="dice-tray-heading">
        <span>DICE CUP</span>
        <span>
          {dice.length - heldCount}개 굴림 · {heldCount}개 보관
        </span>
      </div>
      <DiceCup
        motion={motion}
        dice={dice}
        held={held}
        phase={phase}
        disabled={disabled}
        onSelect={toggle}
      />
      <div
        className="dice-dock"
        style={{
          gridTemplateColumns: `repeat(${dice.length}, minmax(${dice.length > 7 ? 58 : 0}px, 1fr))`,
          overflowX: dice.length > 7 ? "auto" : undefined,
          maxWidth: "100%",
        }}
        role="group"
        aria-label="주사위 보관 및 해제"
      >
        {dice.map((value, i) => {
          const displayValue = value;
          return (
            <button
              className={`die ${held[i] ? "held" : ""} ${bombIndex === i ? "bomb-die" : ""} ${sealedIndices.includes(i) ? "sealed-die" : ""}`}
              title={
                bombIndex === i
                  ? "다시 굴리면 상대 +3점 · 그대로 기록하면 내 점수 -4점"
                  : sealedIndices.includes(i)
                    ? "이번 턴 내내 1로 봉인 · 눈 변경과 재굴림 불가"
                    : undefined
              }
              key={i}
              aria-label={`${i + 1}번 주사위 ${!held[i] && (phase === "shaking" || phase === "throwing") ? "굴리는 중" : (value ?? "굴리기 전")}${held[i] ? ", 보관 중" : ""}`}
              aria-pressed={held[i]}
              disabled={
                disabled ||
                lockedIndices.includes(i) ||
                (!held[i] && heldCount >= maxHeld)
              }
              onClick={() => toggle(i)}
            >
              <strong className="die-value" aria-hidden="true">
                {displayValue ?? "—"}
              </strong>
              <span
                className="die-face"
                data-value={displayValue ?? "unrolled"}
                aria-hidden="true"
                key={
                  holdFeedback?.indices.includes(i) ? holdFeedback.id : "rest"
                }
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
                    rx="10"
                    className="die-surface"
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
              <small>
                {sealedIndices.includes(i)
                  ? "🔒 1로 봉인"
                  : bombIndex === i
                    ? "💣 폭탄"
                    : lockedIndices.includes(i)
                      ? "🔒 강제 보관"
                      : held[i]
                        ? "보관 중"
                        : value
                          ? "보관하기"
                          : "대기"}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
