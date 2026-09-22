import { useRef, type ReactNode } from "react";
import { AvatarImage } from "./AvatarImage";
import {
  SCORE_CATEGORIES,
  categoryScore,
  totals,
  type RoomState,
  type ScoreCategory,
} from "@yacht/shared";
import { SCORE_LABELS } from "../scoreLabels";
import type { Qualification, RecordedScore } from "../feedback/qualifications";
type Props = {
  room: RoomState;
  playerId?: string;
  selected: ScoreCategory | null;
  canScore: boolean;
  onSelect: (category: ScoreCategory) => void;
  onQuickConfirm?: (category: ScoreCategory) => void;
  confirmation?: ReactNode;
  qualifications?: Qualification[];
  recorded?: RecordedScore | null;
};
export function ScoreTable({
  room,
  playerId,
  selected,
  canScore,
  onSelect,
  onQuickConfirm,
  confirmation,
  qualifications = [],
  recorded = null,
}: Props) {
  const inputType = useRef("");
  const players = room.players.filter((p) => p !== null);
  const dice = room.dice.every((die): die is number => die !== null)
    ? room.dice
    : null;
  const renderCategory = (category: ScoreCategory) => (
    <tr key={category} className={selected === category ? "selected" : ""}>
      <th scope="row">{SCORE_LABELS[category]}</th>
      {players.map((p, i) => (
        <td
          key={i}
          data-category={category}
          data-highlight={
            p?.id === room.currentPlayerId
              ? qualifications.find((q) => q.category === category)?.highlight
              : undefined
          }
          data-feedback={
            recorded?.playerId === p?.id && recorded?.category === category
              ? "score-recorded"
              : undefined
          }
        >
          {p?.scores[category] !== null ? (
            p?.scores[category]
          ) : p?.id === playerId && canScore && dice ? (
            <button
              className="preview-score"
              onClick={() => onSelect(category)}
              onPointerDown={(event) => {
                inputType.current = event.pointerType;
              }}
              onTouchStart={() => {
                inputType.current = "touch";
              }}
              onKeyDown={() => {
                inputType.current = "keyboard";
              }}
              onDoubleClick={(event) => {
                if (inputType.current === "mouse" && event.detail >= 2)
                  onQuickConfirm?.(category);
              }}
              aria-pressed={selected === category}
              aria-label={`${SCORE_LABELS[category]} ${categoryScore(category, dice)}점 선택`}
            >
              {categoryScore(category, dice)}
            </button>
          ) : p?.id === room.currentPlayerId &&
            qualifications.some((q) => q.category === category) ? (
            <span className="score-highlight">—</span>
          ) : (
            "—"
          )}
        </td>
      ))}
    </tr>
  );
  return (
    <section className="score-panel panel">
      <h2>점수표</h2>
      <div
        className="score-scroll"
        tabIndex={0}
        role="region"
        aria-label="플레이어 점수표"
      >
        <table data-players={players.length}>
          <thead>
            <tr>
              <th scope="col">족보</th>
              {players.map((p, i) => (
                <th
                  scope="col"
                  key={i}
                  className={p?.id === playerId ? "mine" : ""}
                >
                  {p && <AvatarImage avatar={p.avatar} />}
                  {p?.nickname ?? "플레이어"}
                  <small>
                    {p.forfeited
                      ? "기권"
                      : p.id === room.currentPlayerId
                        ? "현재 차례"
                        : p.id === playerId
                          ? "나"
                          : "참가자"}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="score-group upper-group" aria-label="상단 점수">
            {SCORE_CATEGORIES.slice(0, 6).map(renderCategory)}
            <tr>
              <th scope="row">보너스 (35)</th>
              {players.map((p, i) => (
                <td key={i}>+{p ? totals(p.scores).bonus : 0}</td>
              ))}
            </tr>
            <tr className="subtotal">
              <th scope="row">상단 합계</th>
              {players.map((p, i) => (
                <td key={i}>
                  {p ? totals(p.scores).upper : 0}
                  <small> / 63</small>
                </td>
              ))}
            </tr>
          </tbody>
          <tbody className="score-group lower-group" aria-label="하단 점수">
            {SCORE_CATEGORIES.slice(6).map(renderCategory)}
            <tr className="subtotal">
              <th scope="row">하단 합계</th>
              {players.map((p, i) => (
                <td key={i}>
                  {SCORE_CATEGORIES.slice(6).reduce(
                    (sum, category) => sum + (p?.scores[category] ?? 0),
                    0,
                  )}
                </td>
              ))}
            </tr>
          </tbody>
          <tbody className="score-group total-group" aria-label="총점">
            <tr className="total">
              <th scope="row">총점</th>
              {players.map((p, i) => (
                <td key={i}>{p ? totals(p.scores).total : 0}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {confirmation}
    </section>
  );
}
