import { createPortal } from "react-dom";
import { AUGMENTS, EVENTS, type RoomState } from "@yacht/shared";
import { SCORE_LABELS } from "../scoreLabels";
import type { AugmentResult } from "../hooks/useAugmentEffects";
import { AugmentActivation } from "./AugmentActivation";
import { AugmentIcon } from "./AugmentIcon";
import { useLayoutEffect, useState, type CSSProperties } from "react";

function Flights({ result }: { result: AugmentResult }) {
  const [flights, setFlights] = useState<
    { text: string; style: CSSProperties }[]
  >([]);
  useLayoutEffect(() => {
    const e = result.presentation;
    if (!e) return;
    const anchor = (id: string, category?: string) =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          category
            ? "td[data-player-id]"
            : ".player-augments[data-player-id], th[data-player-id]",
        ),
      )
        .find(
          (el) =>
            el.dataset.playerId === id &&
            (!category || el.dataset.category === category),
        )
        ?.getBoundingClientRect();
    const moves: { text: string; style: CSSProperties }[] = [];
    const add = (
      text: string,
      from: DOMRect | undefined,
      to: DOMRect | undefined,
    ) => {
      if (!from || !to) return;
      moves.push({
        text,
        style: {
          left: from.x + from.width / 2,
          top: from.y + from.height / 2,
          "--dx": `${to.x + to.width / 2 - from.x - from.width / 2}px`,
          "--dy": `${to.y + to.height / 2 - from.y - from.height / 2}px`,
        } as CSSProperties,
      });
    };
    if (e.abilityId === "closed" || e.abilityId === "strike")
      for (const cell of e.cells) {
        const target = e.cells.find(
          (c) =>
            c.playerId !== cell.playerId &&
            c.category === cell.category &&
            c.after === cell.before,
        );
        if (target)
          add(
            String(cell.before ?? 0),
            anchor(cell.playerId, cell.category),
            anchor(target.playerId, target.category),
          );
      }
    for (const card of e.cards)
      add(
        AUGMENTS.find((d) => d.id === card.id)?.name ?? card.id,
        anchor(card.from),
        anchor(card.to),
      );
    for (const d of e.defenses)
      if (d.reflected) add("🛡 반격", anchor(d.defenderId), anchor(e.actorId));
    if (["hostage", "thief", "bombParcel"].includes(e.abilityId ?? "")) {
      const loss = e.players.find((p) => p.after < p.before),
        gain = e.players.find((p) => p.after > p.before);
      if (loss && gain)
        add(
          `+${Math.min(loss.before - loss.after, gain.after - gain.before)}점`,
          anchor(loss.id),
          anchor(gain.id),
        );
    }
    if (e.abilityId === "squid")
      for (const p of e.players) {
        const center = document
          .querySelector(".effect-pot")
          ?.getBoundingClientRect();
        if (p.after < p.before)
          add(`${p.before - p.after}점`, anchor(p.id), center);
        else if (p.after > p.before)
          add(`+${p.after - p.before}점`, center, anchor(p.id));
      }
    if (e.stage === "acquire")
      add(
        AUGMENTS.find((d) => d.id === e.abilityId)?.name ?? "✦",
        document.querySelector(".effect-emblem")?.getBoundingClientRect(),
        anchor(e.actorId),
      );
    setFlights(moves);
  }, [result.key]);
  return createPortal(
    <div
      className="effect-flights"
      aria-hidden="true"
      style={
        {
          "--flight-time":
            result.presentation?.level === "major"
              ? ".9s"
              : result.presentation?.level === "emphasis"
                ? ".65s"
                : ".3s",
        } as CSSProperties
      }
    >
      {flights.map((f, i) => (
        <span key={i} style={f.style}>
          {f.text}
        </span>
      ))}
    </div>,
    document.body,
  );
}

export function AugmentEvent({
  result,
  room,
}: {
  result: AugmentResult;
  room: RoomState;
}) {
  const e = result.presentation;
  if (!e)
    return result.activation ? (
      <AugmentActivation activation={result.activation} />
    ) : (
      <strong>{result.text}</strong>
    );
  const def = AUGMENTS.find(
    (d) => d.id === (e.abilityId === "loanDouble" ? "loan" : e.abilityId),
  );
  const name = (id: string) =>
    room.players.find((p) => p?.id === id)?.nickname ?? id;
  const charges = (n: number) => (n < 0 ? "매 턴" : `${n}회`);
  return (
    <div
      className={`augment-event effect-${e.abilityId ?? e.stage}`}
      data-stage={e.stage}
      data-rarity={def?.rarity}
    >
      <Flights result={result} />
      <div className="effect-emblem" aria-hidden="true">
        {def ? <AugmentIcon id={def.id} /> : "✦"}
      </div>
      <small>
        {def?.flash ? "✦ 번뜩임 · " : ""}
        {e.stage === "acquire"
          ? "획득!"
          : e.stage === "resolve"
            ? "결과 확정"
            : "능력 발동"}
      </small>
      <h3>
        {e.abilityId === "loanDouble"
          ? "판돈 두 배"
          : (def?.name ??
            result.activation?.name ??
            EVENTS.find((d) => d.id === e.abilityId)?.name ??
            "점수 확정")}
      </h3>
      <b>
        {name(e.actorId)}
        {e.targetIds.length > 0 && ` → ${e.targetIds.map(name).join(" · ")}`}
      </b>
      {e.outcome && (
        <strong className="effect-outcome">
          {
            {
              jackpot: "대박!",
              backfire: "자폭!",
              counter: "반격 성공!",
              steal: "강탈 성공!",
              comeback: "역전 발생!",
            }[e.outcome]
          }
        </strong>
      )}
      {e.abilityId === "hostage" && (
        <div className="effect-parcel">
          📦{" "}
          {e.stage === "use"
            ? "택배 도착 · 몸값 지불 또는 주사위 봉인"
            : "택배 처리 완료"}
        </div>
      )}
      {e.abilityId === "squid" && (
        <div className="effect-pot">
          {e.stage === "use"
            ? "💰 판돈 집결 · 다음 턴 결과로 승부!"
            : "🏆 승부 종료 · 상금 지급"}
        </div>
      )}
      <div className="effect-cells">
        {e.cells.map((c) => (
          <span key={`${c.playerId}:${c.category}`}>
            {name(c.playerId)} ·{" "}
            {SCORE_LABELS[c.category as keyof typeof SCORE_LABELS]}{" "}
            <b>
              {c.before ?? "—"} → {c.after ?? "—"}
            </b>
          </span>
        ))}
      </div>
      {e.abilityId === "closed" && e.players.length === 2 && (
        <small>
          두 사람의 점수 차이{" "}
          {Math.abs(e.players[0]!.before - e.players[1]!.before)} →{" "}
          {Math.abs(e.players[0]!.after - e.players[1]!.after)}점
        </small>
      )}
      {e.cards.map((c, i) => (
        <div className="effect-card-transfer" key={i}>
          {name(c.from)} → {name(c.to)}{" "}
          <b>{AUGMENTS.find((d) => d.id === c.id)?.name}</b> ·{" "}
          {charges(c.before)} → {charges(c.after)}
        </div>
      ))}
      {e.defenses.map((d) => (
        <div className="effect-shield" key={d.defenderId}>
          🛡 {name(d.defenderId)} · 공격 차단
          {d.reflected ? " · 시전자에게 반격!" : "!"}
        </div>
      ))}
      <div className="effect-dice">
        {e.dice.map((d) => (
          <span key={d.index}>
            {d.index + 1}번{" "}
            <b>
              {d.before ?? "?"} → {d.after ?? "굴림"}
            </b>
          </span>
        ))}
        {e.rerollIndices.length > 0 && (
          <span>
            {e.rerollIndices.map((i) => i + 1).join("·")}번 주사위 다시 굴림
          </span>
        )}
      </div>
      <div className="effect-scores">
        {e.players
          .filter((p) => p.before !== p.after)
          .map((p) => (
            <span key={p.id} data-loss={p.after < p.before}>
              {p.name}{" "}
              <b>
                {p.after - p.before > 0 ? "+" : ""}
                {p.after - p.before}점
              </b>
              <small>
                {p.before} → {p.after}
              </small>
            </span>
          ))}
      </div>
      <p>{result.activation?.effect ?? result.text}</p>
    </div>
  );
}
