import {
  AUGMENTS,
  SCORE_CATEGORIES,
  SCORE_LABELS,
  useAugment,
  type AugmentCommand,
  type RoomState,
  type PublicPlayer,
} from "@yacht/shared";
export function FlashInputs({
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
  onUse: (c: Partial<AugmentCommand>) => void;
}) {
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
  const players = room.players.filter(
    (p): p is PublicPlayer =>
      !!p &&
      !p.forfeited &&
      p.id !== player.id &&
      (id === "closed" || Object.values(p.scores).some((n) => n === null)),
  );
  if (id === "strike")
    return (
      <div className="augment-direct">
        <p>
          기록된 하단 점수를 회전합니다. 내 점수도 넘어가요! 방향은 사용 후
          공개됩니다.
        </p>
        <div className="augment-choice">
          {SCORE_CATEGORIES.slice(6).map((category) => (
            <button
              key={category}
              disabled={!legal({ category })}
              onClick={() => onUse({ category })}
            >
              {SCORE_LABELS[category]}
              <small>
                {room.players
                  .filter(
                    (q) =>
                      q &&
                      !q.forfeited &&
                      q.scores[category] !== null &&
                      !q.augment?.scoreSwapped,
                  )
                  .map((q) => `${q!.nickname} ${q!.scores[category]}점`)
                  .join(" / ")}
              </small>
            </button>
          ))}
        </div>
      </div>
    );
  if (
    ["handsUp", "strike", "squid", "dinner", "confiscate", "goldRush"].includes(
      id,
    )
  )
    return (
      <div className="augment-direct">
        <p>
          {id === "goldRush"
            ? "골드를 가진 사람들끼리 지금 능력을 돌립니다. 내 능력도 넘어가요!"
            : "나를 포함해 각자의 다음 턴에 적용돼요. 방패나 기존 방해로 제외되는 사람은 결과에 표시돼요."}
        </p>
        <button disabled={!legal({})} onClick={() => onUse({})}>
          난장판 시작!
        </button>
        {!legal({}) && (
          <small>참여 가능한 대상이나 남은 턴 조건을 확인해 주세요.</small>
        )}
      </div>
    );
  return (
    <div className="augment-direct">
      <p>
        {id === "closed"
          ? "서로 이미 기록한 같은 칸을 맞바꿉니다. 아래 점수 변화를 보고 선택하세요."
          : id === "broken"
            ? "골드를 고르면 상대에게 사용 금지, 나에게 한 번 쓸 대여 능력이 생겨요."
            : "상대를 누르면 다음 턴에 예약돼요."}
      </p>
      {players.map((q) => (
        <section key={q.id}>
          <strong>
            {q.nickname}
            {q.augment?.curse && id !== "closed" ? " · 이미 방해 예약됨" : ""}
          </strong>
          <div className="augment-choice">
            {id === "closed" ? (
              SCORE_CATEGORIES.slice(6)
                .filter(
                  (k) => player.scores[k] !== null && q.scores[k] !== null,
                )
                .map((category) => (
                  <button
                    key={category}
                    disabled={!legal({ target: q.id, category })}
                    onClick={() => onUse({ target: q.id, category })}
                  >
                    {SCORE_LABELS[category]} · 내 {player.scores[category]} →{" "}
                    {q.scores[category]}점 / 상대 {q.scores[category]} →{" "}
                    {player.scores[category]}점
                  </button>
                ))
            ) : id === "broken" ? (
              q
                .augment!.items.filter(
                  (i) =>
                    i.borrowedAt === undefined &&
                    i.remaining !== 0 &&
                    AUGMENTS.some(
                      (d) =>
                        d.id === i.id &&
                        d.rarity === "gold" &&
                        d.trigger === "active",
                    ),
                )
                .map((i, k) => (
                  <button
                    key={k}
                    disabled={!legal({ target: q.id, other: i.id })}
                    onClick={() => onUse({ target: q.id, other: i.id })}
                  >
                    {AUGMENTS.find((d) => d.id === i.id)!.name} 빌려오기
                  </button>
                ))
            ) : (
              <button
                disabled={!legal({ target: q.id })}
                onClick={() => onUse({ target: q.id })}
              >
                {q.nickname}에게 예약
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
