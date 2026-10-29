import type { MotionStream } from "../dice/motion";
import { useEffect, useState } from "react";
import {
  nextPlayerId,
  type RoomState,
  type ScoreCategory,
} from "@yacht/shared";
import { useScoreSelection } from "../hooks/useScoreSelection";
import { useActionFeedback } from "../hooks/useActionFeedback";
import { ActionFeedback } from "../components/ActionFeedback";
import { ScoreConfirmation } from "../components/ScoreConfirmation";
import { DiceTray } from "../components/DiceTray";
import { ScoreTable } from "../components/ScoreTable";
import { ResultScreen } from "./ResultScreen";
type Props = {
  motion?: MotionStream;
  room: RoomState;
  playerId?: string;
  connected: boolean;
  busy: boolean;
  snapshotEpoch?: number;
  initialTurnIntro?: boolean;
  onStartShake: () => void;
  onRoll: () => void;
  onHolds: (held: RoomState["held"]) => void;
  onScore: (category: ScoreCategory) => void;
  onLeave: () => void;
};
export function GameScreen({
  motion,
  room,
  playerId,
  connected,
  busy,
  snapshotEpoch = 0,
  initialTurnIntro = false,
  onStartShake,
  onRoll,
  onHolds,
  onScore,
  onLeave,
}: Props) {
  const feedback = useActionFeedback({
    room,
    playerId,
    connected,
    snapshotEpoch,
    initialTurnIntro,
  });
  const scoring = useScoreSelection({
    room,
    playerId,
    connected,
    busy,
    interactionLocked: feedback.locked,
    onScore,
  });
  const { myTurn, paused, canPlay, canScore, selected } = scoring;
  const [now, setNow] = useState(Date.now());
  const canThrow =
    myTurn && connected && !paused && !busy && room.rollPhase === "shaking";
  const canShake =
    canPlay &&
    !feedback.locked &&
    room.rollPhase === "idle" &&
    room.rollCount < 3 &&
    !room.held.every(Boolean);
  useEffect(() => {
    function throwWithSpace(event: KeyboardEvent) {
      if (
        (!canThrow && !canShake) ||
        (event.code !== "Space" && event.key !== " ") ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      )
        return;
      if (
        event.target instanceof window.HTMLElement &&
        event.target.closest(
          'input, textarea, select, .chat-panel, [contenteditable], [role="textbox"]',
        )
      )
        return;
      event.preventDefault();
      if (canThrow) onRoll();
      else onStartShake();
    }
    window.addEventListener("keydown", throwWithSpace);
    return () => window.removeEventListener("keydown", throwWithSpace);
  }, [canThrow, canShake, onRoll, onStartShake]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const current = room.players.find((p) => p?.id === room.currentPlayerId);
  const nextId = current ? nextPlayerId(room, current.id) : null;
  const next = room.players.find((p) => p?.id === nextId);
  return (
    <div className="game-grid">
      <ScoreTable
        qualifications={feedback.combos}
        recorded={feedback.recorded}
        room={room}
        playerId={playerId}
        selected={selected}
        canScore={canScore}
        onSelect={scoring.select}
        onQuickConfirm={scoring.confirm}
        confirmation={
          <ScoreConfirmation
            selected={selected}
            preview={scoring.preview}
            enabled={canScore && selected !== null}
            reason={scoring.reason}
            onConfirm={scoring.confirm}
          />
        }
      />

      <section className="table-area panel">
        {room.phase === "finished" ? (
          <ResultScreen room={room} busy={busy} onLeave={onLeave} />
        ) : (
          <>
            <div className="turn-heading">
              <div>
                <p className="eyebrow">
                  {myTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
                </p>
                <h2>
                  {myTurn
                    ? "당신의 턴입니다"
                    : `${current?.nickname ?? "상대방"}님의 턴입니다`}
                </h2>
                {next && (
                  <p className="next-player">다음 차례: {next.nickname}</p>
                )}
              </div>
              <span className="turn-count">
                {current
                  ? Object.values(current.scores).filter((n) => n !== null)
                      .length + 1
                  : 1}{" "}
                / 12 턴
              </span>
            </div>
            {paused && (
              <div className="notice" role="status">
                재접속을 기다리고 있어요
                {room.players
                  .filter((p) => p && !p.forfeited && !p.connected)
                  .map(
                    (p) =>
                      p && (
                        <div key={p.id}>
                          {p.nickname} ·{" "}
                          {Math.max(
                            0,
                            Math.ceil(
                              ((p.reconnectDeadline ??
                                room.reconnectDeadline ??
                                now) -
                                now) /
                                1000,
                            ),
                          )}
                          초
                        </div>
                      ),
                  )}
              </div>
            )}
            <DiceTray
              motion={motion}
              phase={feedback.phase}
              holdFeedback={feedback.holds}
              dice={room.dice}
              held={room.held}
              disabled={!canPlay || !room.rollCount || room.rollCount === 3}
              onHolds={onHolds}
            />
            <p className="dice-hint">
              {feedback.phase === "shaking"
                ? myTurn
                  ? "던지기 버튼 또는 스페이스바로 쏟으세요."
                  : "상대가 주사위 컵을 흔들고 있어요."
                : feedback.phase === "throwing"
                  ? "컵을 뒤집어 주사위를 쏟고 있어요…"
                  : myTurn
                    ? room.rollCount < 3
                      ? "흔들기 버튼 또는 스페이스바로 시작하세요."
                      : room.rollCount
                        ? "주사위나 아래 슬롯을 눌러 보관 · 다시 눌러 해제"
                        : "흔들기를 눌러 컵에 주사위를 담으세요."
                    : "상대의 주사위와 점수를 함께 보고 있어요."}
            </p>
            {myTurn ? (
              <div className="dice-actions">
                <button
                  className="primary roll"
                  disabled={
                    !canPlay ||
                    feedback.locked ||
                    room.rollPhase !== "idle" ||
                    room.rollCount === 3 ||
                    room.held.every(Boolean)
                  }
                  onClick={onStartShake}
                >
                  흔들기 <span>{3 - room.rollCount}회 남음 · Space</span>
                </button>
                <button
                  className="primary throw"
                  disabled={!canThrow}
                  onClick={onRoll}
                >
                  {room.rollPhase === "throwing" ? "쏟는 중…" : "던지기"}
                  <small>Space</small>
                </button>
              </div>
            ) : (
              <div className="opponent-turn" role="status">
                <strong>{current?.nickname ?? "상대방"}님의 턴입니다</strong>
                <span>
                  주사위와 점수를 함께 보고 있어요 · {3 - room.rollCount}회 남음
                </span>
              </div>
            )}
          </>
        )}
        <ActionFeedback
          intro={feedback.intro}
          banner={feedback.banner}
          combos={feedback.combos}
          recorded={feedback.recorded}
          eventKey={feedback.eventKey}
        />
      </section>
    </div>
  );
}
