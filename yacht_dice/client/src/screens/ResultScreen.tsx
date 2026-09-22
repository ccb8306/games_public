import { standings, type RoomState } from "@yacht/shared";
type Props = { room: RoomState; busy: boolean; onLeave: () => void };
export function ResultScreen({ room, busy, onLeave }: Props) {
  const outcome = room.outcome;
  const resultTitle =
    outcome?.kind === "winner"
      ? `${room.players.find((p) => p?.id === outcome.playerId)?.nickname ?? "상대"} 승리!`
      : outcome?.kind === "draw"
        ? `공동 승리! ${room.players
            .filter((p) => p && outcome.playerIds.includes(p.id))
            .map((p) => p!.nickname)
            .join(" · ")}`
        : "경기가 종료됐어요";
  return (
    <>
      <p className="eyebrow">GAME OVER</p>
      <h2 className="result-title">{resultTitle}</h2>
      <p className="muted">
        {outcome?.kind === "winner" && outcome.reason === "forfeit"
          ? "다른 참가자의 기권으로 마지막 참가자가 승리했어요."
          : outcome?.kind === "abandoned"
            ? "모든 참가자가 기권해 승자 없이 종료됐어요."
            : "한 판 수고했어요. 최종 점수를 확인하세요."}
      </p>
      <ol className="result-standings" aria-label="최종 순위">
        {standings(room).map(({ player, rank, total }) => (
          <li key={player.id}>
            <span>
              {rank === null ? "기권" : `${rank}위`} · {player.nickname}
            </span>
            <strong>{total}점</strong>
          </li>
        ))}
      </ol>
      <button className="primary" disabled={busy} onClick={onLeave}>
        다음 한 판 준비하기
      </button>
    </>
  );
}
