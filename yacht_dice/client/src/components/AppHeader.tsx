import { RoomInvite } from "./RoomInvite";
import type { RoomState } from "@yacht/shared";

type Props = {
  room: RoomState | null;
  connected: boolean;
  busy: boolean;
  expired: boolean;
  onLeave: () => void;
};

export function AppHeader({ room, connected, busy, expired, onLeave }: Props) {
  return (
    <header className="topbar">
      <a
        className="brand"
        href="/"
        onClick={(event) => {
          if (room) event.preventDefault();
        }}
      >
        <span aria-hidden="true">⚄</span> YACHT <b>DICE</b>
      </a>
      {room && (
        <div className="room-meta">
          <h1>방 {room.code}</h1>
          <span>
            {room.phase === "waiting"
              ? "대기실"
              : room.phase === "finished"
                ? "경기 결과"
                : "진행 중"}
          </span>
        </div>
      )}
      {room && room.phase !== "waiting" && (
        <RoomInvite key={room.code} code={room.code} compact />
      )}
      <span className={`connection ${connected ? "online" : ""}`}>
        {connected ? "서버 연결됨" : "서버 연결 중…"}
      </span>
      {room && (
        <button
          className="quiet"
          disabled={busy || (!connected && !expired)}
          onClick={onLeave}
        >
          방 나가기
        </button>
      )}
    </header>
  );
}
