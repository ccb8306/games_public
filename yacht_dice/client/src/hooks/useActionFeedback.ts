import { augmentedScore } from "@yacht/shared";
import { useLayoutEffect, useRef, useState } from "react";
import { SCORE_CATEGORIES, type RoomState } from "@yacht/shared";
import {
  FEEDBACK_TIMING,
  qualifications,
  type RecordedScore,
  type RollPhase,
} from "../feedback/qualifications";

type Props = {
  room: RoomState;
  playerId?: string;
  connected: boolean;
  snapshotEpoch: number;
  initialTurnIntro: boolean;
};
type Snapshot = { room: RoomState; connected: boolean; snapshotEpoch: number };
type RollFeedback = {
  key: string;
  phase: "throwing" | "result";
  banner: boolean;
};
function rollKey(room: RoomState) {
  const filled = room.players
    .flatMap((p) => (p ? Object.values(p.scores) : []))
    .filter((n) => n !== null).length;
  return `${room.roomId}:${room.currentPlayerId}:${filled}:${room.rollCount}`;
}

/** Server snapshots trigger semantic transitions; timers never change game state. */
export function useActionFeedback({
  room,
  playerId,
  connected,
  snapshotEpoch,
  initialTurnIntro,
}: Props) {
  const previous = useRef<Snapshot | null>(null);
  const timers = useRef<
    Partial<
      Record<
        "roll" | "intro" | "record" | "hold",
        ReturnType<typeof setTimeout>
      >
    >
  >({});
  const [roll, setRoll] = useState<RollFeedback | null>(null);
  const [intro, setIntro] = useState(false);
  const [recorded, setRecorded] = useState<RecordedScore | null>(null);
  const [holds, setHolds] = useState<{ id: number; indices: number[] } | null>(
    null,
  );
  const available =
    connected && room.players.every((p) => !p || p.forfeited || p.connected);
  const key = rollKey(room);

  useLayoutEffect(() => {
    function cancel(slot: keyof typeof timers.current) {
      clearTimeout(timers.current[slot]);
      delete timers.current[slot];
    }
    function clear() {
      for (const slot of ["roll", "intro", "record", "hold"] as const)
        cancel(slot);
      setRoll(null);
      setIntro(false);
      setRecorded(null);
      setHolds(null);
    }
    function announceTurn() {
      if (room.phase !== "playing" || room.currentPlayerId !== playerId) return;
      setIntro(true);
      timers.current.intro = setTimeout(
        () => setIntro(false),
        FEEDBACK_TIMING.turnIntro,
      );
    }
    const last = previous.current;
    previous.current = { room, connected, snapshotEpoch };
    if (!last) {
      if (available && initialTurnIntro) announceTurn();
      return;
    }
    if (
      !available ||
      !last.connected ||
      !last.room.players.every((p) => !p || p.forfeited || p.connected) ||
      last.snapshotEpoch !== snapshotEpoch ||
      last.room.roomId !== room.roomId
    ) {
      clear();
      return;
    }
    if (last.room.revision === room.revision) return;
    const changedTurn =
      last.room.currentPlayerId !== room.currentPlayerId ||
      last.room.phase !== room.phase;
    if (changedTurn) {
      clear();
      announceTurn();
    }
    if (room.rollPhase === "shaking" || room.rollPhase === "throwing") {
      cancel("roll");
      setRoll(null);
    } else if (
      !changedTurn &&
      (room.rollCount > last.room.rollCount ||
        (last.room.rollPhase === "throwing" &&
          room.rollPhase === "idle" &&
          !!room.motion &&
          room.motion.id !== last.room.motion?.id) ||
        (last.room.rollPhase === "throwing" &&
          room.rollPhase === "idle" &&
          !!last.room.augment?.turn.reroll))
    ) {
      cancel("roll");
      setRoll({ key, phase: "throwing", banner: false });
      timers.current.roll = setTimeout(() => {
        setRoll({ key, phase: "result", banner: true });
        timers.current.roll = setTimeout(
          () => setRoll({ key, phase: "result", banner: false }),
          FEEDBACK_TIMING.result,
        );
      }, FEEDBACK_TIMING.throw);
    }
    // A score can be recorded on the same snapshot that ends the entire game.
    for (const player of room.players) {
      const old = last.room.players.find((p) => p?.id === player?.id);
      if (!player || !old) continue;
      const category = SCORE_CATEGORIES.find(
        (c) => old.scores[c] === null && player.scores[c] !== null,
      );
      if (category) {
        cancel("record");
        setRecorded({
          id: `${room.roomId}:${room.revision}`,
          playerId: player.id,
          category,
          score: player.scores[category]!,
        });
        timers.current.record = setTimeout(
          () => setRecorded(null),
          FEEDBACK_TIMING.recorded,
        );
      }
    }
    if (!changedTurn && room.rollCount === last.room.rollCount) {
      const indices = room.held.flatMap((held, i) =>
        held !== last.room.held[i] ? [i] : [],
      );
      if (indices.length) {
        cancel("hold");
        setHolds({ id: room.revision, indices });
        timers.current.hold = setTimeout(
          () => setHolds(null),
          FEEDBACK_TIMING.hold,
        );
      }
    }
  }, [
    room,
    connected,
    snapshotEpoch,
    playerId,
    available,
    initialTurnIntro,
    key,
  ]);

  useLayoutEffect(
    () => () => {
      for (const timer of Object.values(timers.current)) clearTimeout(timer);
      previous.current = null;
    },
    [],
  );

  const phase: RollPhase =
    !available || room.phase !== "playing"
      ? "idle"
      : room.rollPhase !== "idle"
        ? room.rollPhase
        : roll?.key === key
          ? roll.phase
          : room.rollCount
            ? "result"
            : "idle";
  const current = room.players.find((p) => p?.id === room.currentPlayerId);
  const combos =
    phase === "result" &&
    current &&
    room.dice.every((n): n is number => n !== null)
      ? room.augment
        ? SCORE_CATEGORIES.slice(6)
            .filter((c) => current.scores[c] === null)
            .map((category) => ({
              category,
              score: augmentedScore(room, current, category).score,
              highlight: "normal" as const,
            }))
            .filter((q) => q.score > 0)
        : qualifications(room.dice, current.scores)
      : [];
  return {
    phase,
    combos,
    recorded,
    holds,
    intro: available && intro,
    locked: available && (intro || phase === "throwing"),
    banner: phase === "result" && roll?.key === key && roll.banner,
    eventKey: key,
  };
}
