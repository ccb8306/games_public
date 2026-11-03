import { useState, useRef } from "react";
import {
  useAugment,
  monsterIndex,
  SCORE_CATEGORIES,
  SCORE_LABELS,
  categoryScore,
  type RoomState,
  type PublicPlayer,
  type AugmentCommand,
} from "@yacht/shared";
export const NEW_INPUTS = [
  "tomorrow",
  "taste",
  "bounty",
  "memory",
  "misdelivery",
];
export function NewAugmentInputs({
  room,
  player,
  id,
  enabled,
  onUse,
}: {
  room: RoomState;
  player: PublicPlayer;
  id: string;
  enabled: boolean;
  onUse: (fields: Partial<AugmentCommand>) => void;
}) {
  const [value, setValue] = useState(1),
    [target, setTarget] = useState("");
  const legal = (fields: Partial<AugmentCommand>) => {
    if (!enabled) return false;
    try {
      const s = structuredClone(room);
      useAugment(
        s,
        s.players.find((p) => p?.id === player.id)!,
        { op: "use", id, ...fields },
        () => 0,
      );
      return true;
    } catch {
      return false;
    }
  };
  const opponents = room.players.filter(
    (p) => p && !p.forfeited && p.id !== player.id,
  );
  const memoryPreview = (historyIndex: number) => {
    const copy = structuredClone(room),
      actor = copy.players.find((p) => p?.id === player.id)!;
    try {
      useAugment(
        copy,
        actor,
        { op: "use", id: "memory", historyIndex },
        () => 0,
      );
    } catch (error) {
      return (error as Error).message;
    }
    if (copy.dice.some((n) => n === null))
      return `복사 후 ${copy.dice.filter((n) => n === null).length}개를 던져야 점수가 확정됩니다.`;
    return SCORE_CATEGORIES.filter((k) => actor.scores[k] === null)
      .map(
        (k) =>
          `${SCORE_LABELS[k]} 기본 ${categoryScore(k, copy.dice as number[])}점`,
      )
      .join(" / ");
  };
  if (id === "memory")
    return (
      <div className="augment-choice">
        <p>
          다시 쓸 기록을 고르세요. 현재 주사위 수만큼 가져옵니다. 강제 고정은
          유지하며 부족한 주사위는 굴립니다.
        </p>
        {(player.augment?.archive ?? []).map((entry, historyIndex) => (
          <button
            key={historyIndex}
            disabled={!legal({ historyIndex })}
            onClick={() => onUse({ historyIndex })}
          >
            {memoryPreview(historyIndex)}
            <br />
            {historyIndex + 1}번째 기록 ·{" "}
            {entry.dice.slice(0, room.dice.length).join(" · ")}
          </button>
        ))}
        {!player.augment?.archive?.length && (
          <p>아직 기록한 주사위가 없어요.</p>
        )}
      </div>
    );
  if (id === "tomorrow")
    return (
      <div className="augment-choice">
        {room.dice.map(
          (n, i) =>
            n !== null &&
            n <= 3 && (
              <button
                key={i}
                disabled={!legal({ die: i })}
                onClick={() => onUse({ die: i })}
              >
                {i + 1}번 · 다음 턴 {7 - n} 저장
              </button>
            ),
        )}
      </div>
    );
  if (id === "bounty")
    return (
      <div className="augment-direct">
        <p>수배할 숫자</p>
        <div className="augment-choice">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              aria-pressed={value === n}
              onClick={() => setValue(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {opponents.map((p) => (
          <button
            key={p!.id}
            disabled={!legal({ target: p!.id, value })}
            onClick={() => onUse({ target: p!.id, value })}
          >
            {p!.nickname}에게 {value} 수배
          </button>
        ))}
      </div>
    );
  if (id === "taste" || id === "misdelivery")
    return (
      <div className="augment-direct">
        <p>상대의 직전 눈을 고른 뒤 바꿀 내 주사위를 눌러요.</p>
        {id === "misdelivery" && (
          <p>내 원래 눈은 상대의 다음 턴 끝까지 강제 보관·눈 변경 금지예요.</p>
        )}
        <div className="augment-choice">
          {opponents.flatMap((p) =>
            [...new Set(p!.augment?.lastDice ?? [])].map((n) => (
              <button
                key={`${p!.id}:${n}`}
                aria-pressed={target === p!.id && value === n}
                onClick={() => {
                  setTarget(p!.id);
                  setValue(n);
                }}
              >
                {p!.nickname} · {n}
              </button>
            )),
          )}
        </div>
        <div className="augment-choice">
          {room.dice.map((n, i) => (
            <button
              key={i}
              disabled={!legal({ target, value, die: i })}
              onClick={() => onUse({ target, value, die: i })}
            >
              {i + 1}번 · {n} → {value}
            </button>
          ))}
        </div>
      </div>
    );
  return null;
}
export function PendingAugmentChoice({
  room,
  enabled,
  onCommand,
}: {
  room: RoomState;
  enabled: boolean;
  onCommand: (c: AugmentCommand) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [indices, setIndices] = useState<number[]>([]);
  const t = room.augment!.turn,
    p = room.players.find((p) => p?.id === room.currentPlayerId)!;
  const kind = t.pending;
  if (!kind) return null;
  const legal = (value: number, chosen?: number[]) => {
    if (!enabled) return false;
    try {
      const s = structuredClone(room);
      useAugment(
        s,
        s.players.find((q) => q?.id === p.id)!,
        { op: "resolve", value, indices: chosen },
        () => 0,
      );
      return true;
    } catch {
      return false;
    }
  };
  const send = (value: number, chosen?: number[]) =>
    onCommand({ op: "resolve", value, indices: chosen });
  return (
    <div
      ref={root}
      className="augment-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="능력 결과 선택"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const nodes = [
          ...root.current!.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        ];
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="augment-dialog">
        <h2>
          {
            {
              bombParcel: "착불 폭탄입니다",
              hostage: "악마의 택배",
              thief: "압류 예고장 · 납부할까, 역풍을 노릴까?",
              duel: "콜? 쫄? · 승부 신청이 왔어요",
              forkSecond: "평행 던지기 · A 결과",
              forkChoice: "평행 던지기 · A/B 결과 선택",
            }[kind]
          }
        </h2>
        {(kind === "thief" || kind === "duel") && (
          <>
            <p>
              {kind === "thief"
                ? "지금 8점을 내고 끝내거나, 이번 기본 족보 점수의 40%를 납부해요(올림, 최대 18점). 0점이면 납부도 0점!"
                : "15점을 내고 거절하면 상대는 별도 보너스 10점도 받아요. 수락하면 양쪽 다음 턴 최대 2번. 승자 +40점, 패자 -10점, 동점 각각 +15점."}
            </p>
            <div className="augment-choice">
              <button disabled={!legal(0)} onClick={() => send(0)}>
                {kind === "thief" ? "8점 내고 끝내기" : "15점 내고 거절"}
              </button>
              <button
                className="primary"
                disabled={!legal(1)}
                onClick={() => send(1)}
              >
                {kind === "thief"
                  ? "이번 기본 기록의 40% 납부"
                  : "콜! 승부하자"}
              </button>
            </div>
          </>
        )}
        {kind === "bombParcel" && (
          <>
            <p>
              보낸 사람에게 15점을 주고 끝내거나, 폭탄을 열어 승부하세요. 열면
              무작위 숫자 1~6이 나와요. 1~4면 내가 25점을 주고, 5~6이면 오히려
              상대에게서 10점을 받아요. 가진 점수까지만 오가요.
            </p>
            <button disabled={!legal(0)} onClick={() => send(0)}>
              15점 주고 끝내기
            </button>
            <button disabled={!legal(1)} onClick={() => send(1)}>
              폭탄 열고 승부하기
            </button>
          </>
        )}
        {kind === "hostage" && (
          <>
            <p>
              보낸 사람에게 30점을 주면 내 주사위를 지켜요. 돈을 내지 않으면
              주사위 셋이 1로 바뀌고 이번 턴 끝까지 잠겨요. 잠긴 주사위는 다시
              굴리거나 다른 능력으로 눈을 바꿀 수 없어요.
            </p>
            <button disabled={!legal(0)} onClick={() => send(0)}>
              30점 주고 내 주사위 지키기
            </button>
            <div className="augment-choice">
              {room.dice.map((n, i) => (
                <button
                  key={i}
                  aria-pressed={indices.includes(i)}
                  disabled={
                    !enabled ||
                    t.preheld?.includes(i) ||
                    i === monsterIndex(room)
                  }
                  onClick={() =>
                    setIndices(
                      indices.includes(i)
                        ? indices.filter((j) => j !== i)
                        : indices.length < 3
                          ? [...indices, i]
                          : indices,
                    )
                  }
                >
                  {i + 1}번 · {n}
                  {indices.includes(i)
                    ? ` → ${p.augment!.curse?.values?.[indices.indexOf(i)]}`
                    : ""}
                </button>
              ))}
            </div>
            <button
              disabled={!legal(1, indices)}
              onClick={() => send(1, indices)}
            >
              세 주사위를 1로 봉인
            </button>
          </>
        )}
        {kind === "forkSecond" && (
          <>
            <p>A: {t.fork?.first?.dice.join(" · ")}</p>
            <button disabled={!legal(0)} onClick={() => send(0)}>
              B 결과 흔들기
            </button>
          </>
        )}
        {kind === "forkChoice" && (
          <>
            <p>
              A 결과를 통째로 쓸지, B 결과를 통째로 쓸지 고르세요. 둘을 섞을
              수는 없어요.
            </p>
            <button disabled={!legal(0)} onClick={() => send(0)}>
              A · {t.fork?.first?.dice.join(" · ")}
            </button>
            <button disabled={!legal(1)} onClick={() => send(1)}>
              B · {room.dice.join(" · ")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
