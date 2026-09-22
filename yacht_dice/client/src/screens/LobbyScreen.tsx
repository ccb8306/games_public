import { RoomInvite } from "../components/RoomInvite";
import { AvatarImage } from "../components/AvatarImage";
import type { RoomState } from "@yacht/shared";
type Props = {
  room: RoomState;
  playerId?: string;
  connected: boolean;
  busy: boolean;
  onReady: (ready: boolean) => void;
};
export function LobbyScreen({
  room,
  playerId,
  connected,
  busy,
  onReady,
}: Props) {
  const me = room.players.find((p) => p?.id === playerId);
  return (
    <section className="lobby panel">
      <h2>함께할 플레이어를 기다려요</h2>
      <p className="muted">
        현재 {room.players.filter(Boolean).length}명 / 최대 {room.capacity}명 ·
        재접속 대기 {room.disconnectGraceSeconds}초
      </p>
      <p className="muted">
        2명 이상 전원 연결·준비하면 정원 미달이어도 시작해요. 더 기다리려면
        준비를 누르지 마세요. 첫 차례는 무작위, 이후 자리순으로 진행합니다.
      </p>
      <div className="seats">
        {room.players.map((p, i) => (
          <div className={`seat ${p?.ready ? "ready" : ""}`} key={i}>
            {p ? (
              <AvatarImage avatar={p.avatar} />
            ) : (
              <span className="avatar">+</span>
            )}
            <h3>
              {p?.nickname ?? "빈 자리"}
              {p?.id === me?.id && <small> 나</small>}
            </h3>
            <p>
              {!p
                ? "초대 링크를 공유하세요"
                : !p.connected
                  ? "재접속 대기"
                  : p.ready
                    ? "준비 완료"
                    : "준비 중"}
            </p>
          </div>
        ))}
      </div>
      <RoomInvite key={room.code} code={room.code} />
      <button
        className="primary wide"
        disabled={!connected || busy || !me}
        onClick={() => onReady(!me?.ready)}
      >
        {me?.ready ? "준비 취소" : "준비 완료"}
      </button>
    </section>
  );
}
