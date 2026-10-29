import { useEffect, useState } from "react";
import { useAvatar } from "./hooks/useAvatar";
import { AvatarPicker } from "./components/AvatarPicker";
import { ChatPanel } from "./components/ChatPanel";
import { CelebrationLayer } from "./components/CelebrationLayer";
import { AppHeader } from "./components/AppHeader";
import { useGame } from "./hooks/useGame";
import { EntryScreen } from "./screens/EntryScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
export function App() {
  const game = useGame();
  const profile = useAvatar();
  const { room, session, connected, busy, error } = game;
  // Keep entry fields when returning from a room, as before the screen split.
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "",
  );
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => {
    setConfirmLeave(false);
  }, [room?.currentPlayerId, room?.rollCount, room?.phase]);
  return (
    <main className="app">
      <AppHeader
        room={room}
        connected={connected}
        busy={busy}
        expired={game.expired}
        onLeave={() =>
          room?.phase === "playing" ? setConfirmLeave(true) : game.leave()
        }
      />
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!connected && room && (
        <div className="notice" role="status">
          연결이 끊겼어요. 자동으로 다시 연결하고 있습니다.
        </div>
      )}

      {!room ? (
        <EntryScreen
          profilePicker={
            <AvatarPicker
              avatar={profile.avatar}
              hasSelection={profile.hasSelection}
              disabled={busy || profile.processing}
              message={profile.message}
              onSelect={profile.select}
              onUpload={profile.upload}
            />
          }
          nickname={nickname}
          code={code}
          onNicknameChange={setNickname}
          onCodeChange={setCode}
          connected={connected}
          busy={busy || profile.processing}
          onCreate={(nickname, capacity, disconnectGraceSeconds) =>
            game.send({
              type: "createRoom",
              nickname,
              capacity,
              disconnectGraceSeconds,
              avatar: profile.avatar,
            })
          }
          onJoin={(nickname, code) =>
            game.send({
              type: "joinRoom",
              nickname,
              code,
              avatar: profile.avatar,
            })
          }
        />
      ) : (
        <>
          {confirmLeave && (
            <div className="notice leave-confirm" role="alert">
              <span>
                지금 나가면 기권 처리됩니다. 남은 참가자가 2명 이상이면 경기는
                계속됩니다.
              </span>
              <button disabled={busy} onClick={game.leave}>
                나가기
              </button>
              <button onClick={() => setConfirmLeave(false)}>계속하기</button>
            </div>
          )}

          <div
            className={`room-layout ${room.phase === "waiting" ? "lobby-room" : "game-room"}`}
          >
            {room.phase === "waiting" ? (
              <LobbyScreen
                room={room}
                playerId={session?.playerId}
                connected={connected}
                busy={busy}
                onReady={(ready) => game.action({ type: "setReady", ready })}
              />
            ) : (
              <GameScreen
                motion={game.motion}
                snapshotEpoch={game.snapshotEpoch}
                initialTurnIntro={game.liveStart}
                onStartShake={() => game.action({ type: "startShake" })}
                room={room}
                playerId={session?.playerId}
                connected={connected}
                busy={busy}
                onRoll={() => game.action({ type: "roll" })}
                onHolds={(held) => game.action({ type: "setHolds", held })}
                onScore={(category) => game.action({ type: "score", category })}
                onLeave={game.leave}
              />
            )}
            <ChatPanel
              key={room.roomId}
              messages={game.messages}
              playerId={game.chatPlayerId}
              connected={connected && !!session}
              expired={game.expired}
              busy={game.chatBusy}
              error={game.chatError}
              onSend={game.sendChat}
            />
          </div>
          <CelebrationLayer
            key={`${room.roomId}:${game.snapshotEpoch}:${connected}`}
            events={game.liveChatMessages
              .filter((message) => message.text.trim() === "ㅊㅋㅊㅋ")
              .map((message) => ({
                id: message.id,
                kind: "fireworks" as const,
              }))}
          />
          <footer>
            {room.phase === "finished"
              ? "종료된 방은 30초 뒤 정리됩니다. 화면의 결과는 돌아가기 전까지 볼 수 있어요."
              : room.players
                  .filter((p) => p !== null)
                  .map(
                    (p) =>
                      `${p.nickname}${p.id === session?.playerId ? " (나)" : ""}${p.forfeited ? " · 기권" : ""}`,
                  )
                  .join(" / ")}
          </footer>
        </>
      )}
    </main>
  );
}
