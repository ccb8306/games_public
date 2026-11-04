import { useState } from "react";
import {
  SCORE_CATEGORIES,
  SCORE_LABELS,
  monsterIndex,
  turnsLeft,
  type RoomState,
  type PublicPlayer,
  type AugmentCommand,
  type ScoreCategory,
} from "@yacht/shared";
export function NovelAugmentInputs({
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
  onUse: (c: AugmentCommand) => void;
}) {
  const [source, setSource] = useState(1),
    [plots, setPlots] = useState<string[]>([]);
  const use = (extra: Partial<AugmentCommand> = {}) =>
    onUse({ op: "use", id, ...extra });
  if (id === "customDie")
    return (
      <section className="novel-workshop">
        <h3>이번 턴 모든 6면체 눈금 바꾸기</h3>
        <p>
          없앨 숫자를 고른 뒤 새 숫자를 누르세요. 예: 1→6이면 6이 두 면입니다.
        </p>
        <div className="augment-choice">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              aria-pressed={source === n}
              onClick={() => setSource(n)}
            >
              {n} 없애기
            </button>
          ))}
        </div>
        <div className="augment-choice">
          {[1, 2, 3, 4, 5, 6]
            .filter((n) => n !== source)
            .map((n) => (
              <button
                key={n}
                disabled={!enabled}
                onClick={() =>
                  use({
                    faces: [1, 2, 3, 4, 5, 6].map((v) =>
                      v === source ? n : v,
                    ),
                  })
                }
              >
                {source} → {n} · 이번 턴 적용
              </button>
            ))}
        </div>
      </section>
    );
  if (id === "estate" && player.augment?.estate) {
    const estate = player.augment.estate;
    return (
      <section>
        <p>
          실패한 부지를 다른 빈 칸으로 한 번 옮깁니다. 완공한 부지는 유지됩니다.
        </p>
        {estate.ruined.flatMap((from) =>
          SCORE_CATEGORIES.filter(
            (k) => player.scores[k] === null && !estate.plots.includes(k),
          ).map((to) => (
            <button
              key={from + to}
              disabled={!enabled || estate.relocated || room.rollCount > 0}
              onClick={() => use({ category: from, destination: to })}
            >
              {SCORE_LABELS[from as ScoreCategory]} → {SCORE_LABELS[to]}
            </button>
          )),
        )}
        {!estate.ruined.length && <p>아직 실패한 부지가 없습니다.</p>}
      </section>
    );
  }
  if (id === "estate")
    return (
      <section>
        <p>완성할 빈 점수칸 세 곳을 고르세요. ({plots.length}/3)</p>
        <div className="augment-choice">
          {SCORE_CATEGORIES.filter((k) => player.scores[k] === null).map(
            (k) => (
              <button
                key={k}
                aria-pressed={plots.includes(k)}
                disabled={
                  !enabled || (plots.length === 3 && !plots.includes(k))
                }
                onClick={() =>
                  setPlots(
                    plots.includes(k)
                      ? plots.filter((v) => v !== k)
                      : [...plots, k],
                  )
                }
              >
                {SCORE_LABELS[k]}
              </button>
            ),
          )}
        </div>
        <button
          className="primary"
          disabled={!enabled || plots.length !== 3}
          onClick={() => use({ categories: plots })}
        >
          부지 세 곳 계약
        </button>
      </section>
    );
  if (id === "custody")
    return (
      <div className="augment-choice">
        {room.players
          .filter(
            (q): q is PublicPlayer => !!q && !q.forfeited && q.id !== player.id,
          )
          .map((q) => (
            <button
              key={q.id}
              disabled={
                !enabled ||
                turnsLeft(q) < 2 ||
                !!q.augment?.curse ||
                room.augment?.custody?.some((l) =>
                  [l.a, l.b].some((id) => id === q.id || id === player.id),
                )
              }
              onClick={() => use({ target: q.id })}
            >
              {q.nickname}와 공동 육아
            </button>
          ))}
      </div>
    );
  const index = monsterIndex(room);
  if (id === "monster" && index !== undefined) {
    const n = room.dice[index] ?? 0;
    return (
      <section className="novel-workshop">
        <h3>괴물의 눈: {n || "아직 안 굴림"}</h3>
        <p>분열하면 더 굴릴 수 없습니다. 이번 결과로 채점합니다.</p>
        <div className="augment-choice">
          {[n, 13 - n]
            .filter((sum) => sum >= 2 && sum <= 12)
            .flatMap((sum) =>
              [1, 2, 3, 4, 5, 6]
                .filter((v) => sum - v >= 1 && sum - v <= 6 && v <= sum - v)
                .map((v) => (
                  <button
                    key={`${sum}:${v}`}
                    disabled={!enabled || !room.rollCount}
                    onClick={() => use({ value: v, sum })}
                  >
                    {v} + {sum - v}로 분열 · +8점
                  </button>
                )),
            )}
        </div>
      </section>
    );
  }
  return (
    <button className="primary" disabled={!enabled} onClick={() => use()}>
      {id === "monster"
        ? "주사위 둘 먹이기 · 12면체 합체"
        : "왕관 행사 개최 · 즉시 +15점"}
    </button>
  );
}
export function NovelAugmentStatus({
  room,
  player,
}: {
  room: RoomState;
  player: PublicPlayer;
}) {
  const a = room.augment!,
    e = player.augment?.estate,
    c = a.crown;
  const name = (id: string) =>
    room.players.find((p) => p?.id === id)?.nickname ?? "없음";
  return (
    <div className="novel-status">
      {player.augment?.customFaces && (
        <p>
          🔧 이번 턴 내 모든 6면체: {player.augment.customFaces.join(" · ")}
        </p>
      )}
      {e && (
        <p>
          🏗 내 부지 ·{" "}
          {e.plots
            .map(
              (k) =>
                `${SCORE_LABELS[k as ScoreCategory]} ${e.completed.includes(k) ? "완공" : e.ruined.includes(k) ? "폐허" : "공사 중"}`,
            )
            .join(" / ")}{" "}
          · 지급 +{e.paid}/40점
        </p>
      )}
      {a.custody?.map((l) => (
        <p key={l.a}>
          🍼 {name(l.a)} ↔ {name(l.b)} · 공동 눈 {l.face ?? "첫 전달 대기"} ·
          남은 {l.aLeft}/{l.bLeft}턴 · 지급 {l.aPaid ?? 0}/{l.bPaid ?? 0}점 (각
          최대 18) · 기록한 눈 4~6은 나 +6, 1~3은 상대 +6
        </p>
      ))}
      {c && (
        <p className="novel-crown">
          👑 {c.finished ? "최종 왕관" : "현재 왕관"}: {name(c.holder)} ·{" "}
          {c.finished
            ? "결산 완료"
            : `${c.threshold}점${!c.claimed ? " 이상" : " 초과"}으로 탈취 · 최종 +40점`}
          <br />
          {c.entries.map((e) => `${name(e.id)} ${e.left}턴`).join(" · ")}
        </p>
      )}
    </div>
  );
}
