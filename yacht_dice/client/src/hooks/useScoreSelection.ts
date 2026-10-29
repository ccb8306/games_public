import { useEffect, useRef, useState } from "react";
import {
  categoryScore,
  type RoomState,
  type ScoreCategory,
} from "@yacht/shared";

type Props = {
  room: RoomState;
  playerId?: string;
  connected: boolean;
  busy: boolean;
  interactionLocked?: boolean;
  onScore: (category: ScoreCategory) => void;
};

export function useScoreSelection({
  room,
  playerId,
  connected,
  busy,
  interactionLocked = false,
  onScore,
}: Props) {
  const paused =
    room.phase === "playing" &&
    room.players.some(
      (player) => player && !player.forfeited && !player.connected,
    );
  const myTurn = room.phase === "playing" && room.currentPlayerId === playerId;
  const player = room.players.find((player) => player?.id === playerId);
  const filled = room.players.reduce(
    (count, player) =>
      count +
      (player
        ? Object.values(player.scores).filter((score) => score !== null).length
        : 0),
    0,
  );
  const scope = [
    room.roomId,
    playerId,
    room.currentPlayerId,
    room.phase,
    room.rollCount,
    room.rollPhase,
    interactionLocked,
    filled,
    connected,
    paused,
  ].join(":");
  const [selection, setSelection] = useState<{
    category: ScoreCategory;
    scope: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const locked = useRef(false);

  // Clear both visual selection and synchronous submission lock on context changes.
  useEffect(() => {
    setSelection(null);
    locked.current = false;
    setSubmitting(false);
  }, [scope]);
  useEffect(() => {
    if (!busy) {
      locked.current = false;
      setSubmitting(false);
    }
  }, [busy, room.revision]);

  const canPlay =
    myTurn &&
    connected &&
    !busy &&
    !submitting &&
    !paused &&
    !interactionLocked &&
    room.rollPhase === "idle";
  const dice = room.dice.every((die): die is number => die !== null)
    ? room.dice
    : null;
  const canScore = canPlay && room.rollCount > 0 && !!dice && !!player;
  const selected =
    selection?.scope === scope && player?.scores[selection.category] === null
      ? selection.category
      : null;
  const preview = selected && dice ? categoryScore(selected, dice) : null;

  function select(category: ScoreCategory) {
    if (canScore && !locked.current && player?.scores[category] === null)
      setSelection({ category, scope });
  }
  function confirm(category: ScoreCategory) {
    if (!canScore || locked.current || player?.scores[category] !== null)
      return;
    // Both button and double-click use this path, including before React rerenders.
    locked.current = true;
    setSubmitting(true);
    setSelection(null);
    onScore(category);
  }

  let reason = "기록할 점수를 선택하세요.";
  if (room.phase === "finished") reason = "경기가 종료되었습니다.";
  else if (!connected) reason = "서버에 다시 연결하고 있습니다.";
  else if (paused) reason = "플레이어의 재접속을 기다리고 있습니다.";
  else if (!myTurn) reason = "상대방의 턴입니다.";
  else if (busy || submitting) reason = "요청을 처리하고 있습니다.";
  else if (interactionLocked) reason = "잠시 후 조작할 수 있어요.";
  else if (room.rollPhase === "shaking")
    reason = "흔들기를 멈추면 점수를 선택할 수 있어요.";
  else if (!room.rollCount) reason = "먼저 주사위를 굴려주세요.";
  else if (selected && preview !== null)
    reason =
      preview === 0
        ? "0점으로 기록됩니다."
        : "선택한 점수를 기록할 수 있습니다.";

  return {
    myTurn,
    paused,
    canPlay,
    canScore,
    selected,
    preview,
    reason,
    select,
    confirm,
  };
}
