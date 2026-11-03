import { useState } from "react";
import {
  AUGMENTS,
  categoryScore,
  SCORE_CATEGORIES,
  SCORE_LABELS,
  useAugment,
  type AugmentCommand,
  type PublicPlayer,
  type RoomState,
} from "@yacht/shared";

export const DIRECT_INPUT_IDS = [
  "lifebuoy",
  "cleaner",
  "odd",
  "six",
  "parasite",
  "lastmove",
  "scoreRemodel",
  "collector",
  "artisan",
  "fakeHouse",
  "chance",
  "tomorrow",
  "nudge",
  "evolution",
  "mirror",
  "flip",
  "reverse",
  "clone",
  "alchemy",
  "wild",
  "revive",
  "even",
  "choiceRoll",
  "chaos",
  "exchange",
  "target",
  "parallel",
  "thief",
  "lock",
  "seal",
  "duel",
  "swap",
  "doppel",
];

export function AugmentActionInputs({
  id,
  room,
  player,
  enabled,
  onUse,
}: {
  id: string;
  room: RoomState;
  player: PublicPlayer;
  enabled: boolean;
  onUse: (fields: Partial<AugmentCommand>) => void;
}) {
  const [source, setSource] = useState<number | null>(null),
    [die, setDie] = useState<number | null>(id === "revive" ? 0 : null),
    [mine, setMine] = useState("");
  // Use the same validation as the server, without committing the draft or consuming randomness.
  function reason(fields: Partial<AugmentCommand>) {
    if (!enabled)
      return "현재 사용할 수 없습니다. 위의 사용 조건을 확인하세요.";
    const draft = structuredClone(room),
      actor = draft.players.find((p) => p?.id === player.id)!;
    try {
      useAugment(draft, actor, { op: "use", id, ...fields }, () => 0);
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  }
  const legal = (fields: Partial<AugmentCommand>) => !reason(fields);
  if (id === "parasite")
    return (
      <div className="augment-direct">
        <p>
          게임 끝까지 계약할 스폰서를 고르세요. 상대 기본 20점 이상에 +5점, 내가
          상대의 직전 기본 점수(최소 10점)를 따라잡아도 +5점!
        </p>
        {room.players
          .filter((q) => q && q.id !== player.id && !q.forfeited)
          .map((q) => (
            <button
              key={q!.id}
              title={reason({ target: q!.id })}
              disabled={!legal({ target: q!.id })}
              onClick={() => onUse({ target: q!.id })}
            >
              {q!.nickname}와 계약
            </button>
          ))}
      </div>
    );
  if (id === "even")
    return (
      <button
        className="primary"
        title={reason({})}
        disabled={!legal({})}
        onClick={() => onUse({})}
      >
        1 전부 반품하기
      </button>
    );
  if (id === "lifebuoy")
    return (
      <button
        title={reason({})}
        disabled={!legal({})}
        onClick={() => onUse({})}
      >
        일반 보관 풀고 전부 무료 재굴림
      </button>
    );
  if (["odd", "six", "cleaner"].includes(id))
    return (
      <div className="augment-choice">
        {room.dice.map((n, i) => (
          <button
            key={i}
            title={reason({ die: i })}
            disabled={!legal({ die: i })}
            onClick={() => onUse({ die: i })}
          >
            {i + 1}번 · {n}{" "}
            {id === "cleaner"
              ? "청소권 재굴림"
              : `→ ${id === "six" ? 6 : (n ?? 0) - 1}`}
          </button>
        ))}
      </div>
    );
  if (id === "scoreRemodel")
    return (
      <div className="augment-direct">
        <p>
          다시 열 칸을 고른 뒤, 대신 0점을 쓸 빈칸을 고르세요. 기존 점수는
          보존됩니다.
        </p>
        <select
          aria-label="다시 열 하단 칸"
          value={mine}
          onChange={(e) => setMine(e.target.value)}
        >
          <option value="">다시 열 칸 선택</option>
          {SCORE_CATEGORIES.slice(6)
            .filter((k) => player.scores[k] !== null)
            .map((k) => (
              <option key={k} value={k}>
                {SCORE_LABELS[k]} · {player.scores[k]}점
              </option>
            ))}
        </select>
        {SCORE_CATEGORIES.slice(6)
          .filter((k) => player.scores[k] === null)
          .map((k) => (
            <button
              key={k}
              title={reason({ category: mine, destination: k })}
              disabled={!legal({ category: mine, destination: k })}
              onClick={() => onUse({ category: mine, destination: k })}
            >
              {SCORE_LABELS[k]}에 0점 · 총점 +15 · 이사 확정
            </button>
          ))}
      </div>
    );
  if (id === "chance")
    return (
      <div className="augment-direct">
        <p>
          현재 환전액{" "}
          <strong>
            {Math.min(
              40,
              room.dice.reduce<number>((sum, n) => sum + (n ?? 0), 0) + 10,
            )}
            점
          </strong>{" "}
          · 사용한 뒤 점수표에서 빈 하단 칸을 누르세요. 추가 굴림은 끝납니다.
        </p>
        <button
          className="primary"
          title={reason({})}
          disabled={!legal({})}
          onClick={() => onUse({})}
        >
          이 금액으로 환전하기
        </button>
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
                title={reason({ die: i })}
                disabled={!legal({ die: i })}
                onClick={() => onUse({ die: i })}
              >
                {i + 1}번 · {n} 저장
              </button>
            ),
        )}
      </div>
    );
  if (["nudge", "evolution"].includes(id))
    return (
      <div className="augment-direct">
        <p>바꿀 주사위의 보정 버튼을 누르면 바로 적용됩니다.</p>
        {room.dice.map(
          (n, i) =>
            n !== null && (
              <div className="augment-die-actions" key={i}>
                <strong>
                  {i + 1}번 · {n}
                </strong>
                {(id === "evolution" ? [-2, -1, 1, 2] : [-1, 1])
                  .filter((delta) => n + delta >= 1 && n + delta <= 6)
                  .map((delta) => (
                    <button
                      key={delta}
                      title={reason({ die: i, value: n + delta })}
                      disabled={!legal({ die: i, value: n + delta })}
                      onClick={() => onUse({ die: i, value: n + delta })}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta} → {n + delta}
                    </button>
                  ))}
              </div>
            ),
        )}
      </div>
    );
  if (["mirror", "flip", "reverse"].includes(id))
    return (
      <div className="augment-choice">
        {room.dice.map(
          (n, i) =>
            n !== null && (
              <button
                key={i}
                title={reason({ die: i })}
                disabled={!legal({ die: i })}
                onClick={() => onUse({ die: i })}
              >
                {i + 1}번 · {n} → {7 - n}
              </button>
            ),
        )}
      </div>
    );
  if (id === "clone")
    return (
      <div className="augment-direct">
        <p>
          {source === null
            ? "복사할 원본 주사위를 누르세요."
            : `${source + 1}번의 ${room.dice[source]}을 받을 주사위를 누르면 복사됩니다.`}
        </p>
        <div className="augment-choice">
          {room.dice.map((n, i) => (
            <button
              key={i}
              aria-pressed={source === i}
              disabled={!enabled}
              onClick={() => setSource(i)}
            >
              {i + 1}번 · {n}
              {source === i ? " · 원본" : ""}
            </button>
          ))}
        </div>
        {source !== null && (
          <div className="augment-choice">
            {room.dice.map(
              (n, i) =>
                i !== source &&
                n !== room.dice[source] && (
                  <button
                    key={i}
                    title={reason({ die: i, value: source })}
                    disabled={!legal({ die: i, value: source })}
                    onClick={() => onUse({ die: i, value: source })}
                  >
                    {i + 1}번 · {n} → {room.dice[source]}
                  </button>
                ),
            )}
          </div>
        )}
      </div>
    );
  if (id === "fakeHouse")
    return (
      <div className="augment-direct">
        <p>합은 그대로! 원하는 두 주사위의 결과를 눌러 바로 나눠주세요.</p>
        <div className="augment-choice">
          {room.dice.flatMap((n, i) =>
            room.dice.flatMap((m, j) => {
              if (n === null || m === null || i >= j) return [];
              const low = Math.floor((n + m) / 2),
                high = Math.ceil((n + m) / 2);
              if (n === low && m === high) return [];
              return (
                <button
                  key={`${i}-${j}`}
                  title={reason({ indices: [i, j] })}
                  disabled={!legal({ indices: [i, j] })}
                  onClick={() => onUse({ indices: [i, j] })}
                >
                  {i + 1}번·{j + 1}번: {n}+{m} → {low}+{high}
                </button>
              );
            }),
          )}
        </div>
      </div>
    );
  if (["artisan", "alchemy", "wild", "revive"].includes(id))
    return (
      <div className="augment-direct">
        {id !== "revive" && (
          <>
            <p>바꿀 주사위를 선택한 뒤 원하는 눈을 누르세요.</p>
            <div className="augment-choice">
              {room.dice.map((n, i) => (
                <button
                  key={i}
                  aria-pressed={die === i}
                  disabled={
                    !enabled ||
                    (id === "artisan" &&
                      room.dice.filter((v) => v === n).length < 2)
                  }
                  onClick={() => setDie(i)}
                >
                  {i + 1}번 · {n}
                </button>
              ))}
            </div>
          </>
        )}
        {die !== null && (
          <div className="augment-choice" aria-label="변경할 눈">
            {[1, 2, 3, 4, 5, 6]
              .filter(
                (n) =>
                  n !== room.dice[die] &&
                  (id !== "artisan" || !room.dice.includes(n)),
              )
              .map((n) => (
                <button
                  key={n}
                  title={reason({ die, value: n })}
                  disabled={!legal({ die, value: n })}
                  onClick={() => onUse({ die, value: n })}
                >
                  {n}로 {id === "revive" ? "시작" : "변경"}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  if (
    [
      "lastmove",
      "collector",
      "choiceRoll",
      "even",
      "chaos",
      "exchange",
    ].includes(id)
  )
    return (
      <div className="augment-direct">
        <p>
          주사위를 누르면 해당 주사위만 컵에 담습니다. 던지기 또는 Space로
          던지세요.
        </p>
        <div className="augment-choice">
          {room.dice.map((n, i) => (
            <button
              key={i}
              title={reason({ die: i })}
              disabled={!legal({ die: i })}
              onClick={() => onUse({ die: i })}
            >
              {i + 1}번 · {n} 재굴림
              {room.augment!.turn.locked === i ? " · 고정됨" : ""}
            </button>
          ))}
        </div>
      </div>
    );
  if (["target", "parallel"].includes(id)) {
    const categories = SCORE_CATEGORIES.filter(
      (k) => id === "parallel" || player.scores[k] === null,
    );
    return (
      <div className="augment-direct">
        <p>
          족보를 누르면 {id === "target" ? "목표가 확정" : "별도 보너스가 예약"}
          됩니다.
        </p>
        <div className="augment-choice">
          {categories.map((category) => (
            <button
              key={category}
              title={reason({ category })}
              disabled={!legal({ category })}
              onClick={() => onUse({ category })}
            >
              {SCORE_LABELS[category]}
              {id === "parallel"
                ? ` · 별도 +${Math.min(
                    40,
                    categoryScore(
                      category,
                      room.dice.map((n) => n ?? 0),
                    ),
                  )}점 · ${player.scores[category] === null ? "빈 칸 유지" : "기존 기록 유지"}`
                : ""}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const opponents = room.players.filter(
    (q): q is PublicPlayer =>
      !!q &&
      !q.forfeited &&
      q.id !== player.id &&
      Object.values(q.scores).some((n) => n === null),
  );
  if (id === "lock")
    return (
      <div className="augment-direct">
        <p>
          내 1~3 주사위를 고른 뒤 받을 상대를 누르세요. 내 주사위는
          그대로입니다.
        </p>
        <div className="augment-choice">
          {room.dice.map((n, i) =>
            n !== null && n <= 3 ? (
              <button
                key={i}
                aria-pressed={die === i}
                onClick={() => setDie(i)}
              >
                {i + 1}번 · {n}
              </button>
            ) : null,
          )}
        </div>
        {opponents.map((q) => (
          <button
            key={q.id}
            disabled={
              die === null || !legal({ die: die ?? undefined, target: q.id })
            }
            onClick={() => onUse({ die: die!, target: q.id })}
          >
            {q.nickname} 다음 턴에 {die === null ? "?" : room.dice[die]} 고정
          </button>
        ))}
      </div>
    );
  if (["thief", "seal", "duel"].includes(id))
    return (
      <div className="augment-direct">
        <p>상대를 누르면 다음 턴에 효과를 예약합니다.</p>
        <div className="augment-choice">
          {opponents.map((q) => (
            <button
              key={q.id}
              title={reason({ target: q.id })}
              disabled={!legal({ target: q.id })}
              onClick={() => onUse({ target: q.id })}
            >
              {q.nickname}
              {q.augment?.curse ? " · 이미 방해 예약됨" : ""}
            </button>
          ))}
        </div>
      </div>
    );
  if (["swap", "doppel"].includes(id)) {
    const gold = (q: PublicPlayer) =>
      q.augment!.items.filter((i) => {
        const d = AUGMENTS.find((d) => d.id === i.id)!;
        return d.rarity === "gold" && (d.charges <= 0 || i.remaining > 0);
      });
    const myGold = gold(player).filter((i) =>
      opponents.some((q) =>
        gold(q).some((other) =>
          legal({ target: q.id, other: other.id, category: i.id }),
        ),
      ),
    );
    const own = mine || (myGold.length === 1 ? myGold[0]!.id : "");
    return (
      <div className="augment-direct">
        {id === "swap" && (
          <>
            <p>
              내가 넘길 골드
              {myGold.length === 1
                ? "는 하나뿐이므로 선택되어 있습니다."
                : "를 선택하세요."}
            </p>
            <div className="augment-choice">
              {myGold.map((i, k) => (
                <button
                  key={k}
                  aria-pressed={own === i.id}
                  onClick={() => setMine(i.id)}
                >
                  {AUGMENTS.find((d) => d.id === i.id)!.name}
                </button>
              ))}
            </div>
          </>
        )}
        {(id === "doppel" || own) && (
          <>
            <p>
              {id === "swap" ? "교환할" : "복제할"} 상대 능력을 누르면
              적용됩니다.
            </p>
            <div className="augment-choice">
              {opponents.flatMap((q) =>
                gold(q)
                  .filter((i) =>
                    legal({ target: q.id, other: i.id, category: own }),
                  )
                  .map((i, k) => (
                    <button
                      key={`${q.id}-${k}`}
                      onClick={() =>
                        onUse({ target: q.id, other: i.id, category: own })
                      }
                    >
                      {q.nickname} · {AUGMENTS.find((d) => d.id === i.id)!.name}
                    </button>
                  )),
              )}
            </div>
          </>
        )}
      </div>
    );
  }
  return null;
}
