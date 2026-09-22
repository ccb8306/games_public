import { useEffect, useRef, useState } from "react";
import {
  decodeClientMessage,
  decodeServerMessage,
  CHAT_HISTORY_LIMIT,
  type ChatMessage,
  type RoomState,
} from "@yacht/shared";

import { readSession, writeSession, type Session } from "../network/session";
import {
  requestId,
  socketUrl,
  type Command,
  type RoomAction,
} from "../network/protocol";

export function useGame() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const lastRoom = useRef<RoomState | null>(null);
  const [snapshotEpoch, setSnapshotEpoch] = useState(0);
  const [liveStart, setLiveStart] = useState(false);
  const [session, setSession] = useState<Session | null>(readSession);
  const saved = useRef(session);
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef<{ type: string; id: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveChatMessages, setLiveChatMessages] = useState<ChatMessage[]>([]);
  const seenChatIds = useRef(new Set<string>());
  const [chatPlayerId, setChatPlayerId] = useState<string>();
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatPending = useRef<{
    id: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const chatTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function save(value: Session | null) {
    saved.current = value;
    setSession(value);
    writeSession(value);
  }
  function clearPending() {
    pending.current = null;
    setBusy(false);
    clearTimeout(timeout.current);
  }
  function finishChat(ok: boolean) {
    chatPending.current?.resolve(ok);
    chatPending.current = null;
    clearTimeout(chatTimeout.current);
    setChatBusy(false);
  }
  function resetChat() {
    finishChat(false);
    setMessages([]);
    setLiveChatMessages([]);
    seenChatIds.current.clear();
    setChatError("");
    setChatPlayerId(undefined);
  }
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      retry = 0;
    function connect() {
      let firstSnapshot = true;
      const ws = new WebSocket(socketUrl(location));
      socket.current = ws;
      ws.onopen = () => {
        if (disposed) return;
        setConnected(true);
        retry = 0;
        if (saved.current) {
          const id = requestId();
          pending.current = { type: "resumeRoom", id };
          setBusy(true);
          ws.send(
            JSON.stringify({
              type: "resumeRoom",
              requestId: id,
              code: saved.current.code,
              token: saved.current.token,
            }),
          );
        }
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        const parsed = decodeServerMessage(String(event.data));
        if (!parsed.success) {
          setError("서버 응답을 읽지 못했습니다. 새로고침해주세요.");
          clearPending();
          return;
        }
        const msg = parsed.data;
        if (msg.type === "chatHistory" || msg.type === "chatMessage") {
          if (saved.current?.roomId !== msg.roomId) return;
          if (msg.type === "chatHistory") {
            msg.messages.forEach((message) =>
              seenChatIds.current.add(message.id),
            );
            setMessages(msg.messages);
            setLiveChatMessages([]);
          } else if (!seenChatIds.current.has(msg.message.id)) {
            seenChatIds.current.add(msg.message.id);
            setMessages((current) =>
              [...current, msg.message].slice(-CHAT_HISTORY_LIMIT),
            );
            setLiveChatMessages((current) =>
              [...current, msg.message].slice(-CHAT_HISTORY_LIMIT),
            );
          }
          return;
        }
        if (msg.type === "chatAccepted") {
          if (
            msg.requestId === chatPending.current?.id &&
            msg.roomId === saved.current?.roomId
          )
            finishChat(true);
          return;
        }
        if (msg.type === "session") {
          if (saved.current?.roomId !== msg.roomId) resetChat();
          firstSnapshot = true;
          save(msg);
          setChatPlayerId(msg.playerId);
          setExpired(false);
          setError("");
          if (msg.requestId === pending.current?.id) clearPending();
        }
        if (msg.type === "roomState") {
          setLiveStart(
            !firstSnapshot &&
              lastRoom.current?.roomId === msg.state.roomId &&
              lastRoom.current.phase === "waiting" &&
              msg.state.phase === "playing",
          );
          if (firstSnapshot) setSnapshotEpoch((epoch) => epoch + 1);
          firstSnapshot = false;
          lastRoom.current = msg.state;
          setRoom(msg.state);
        }
        if (msg.type === "accepted" && pending.current?.id === msg.requestId) {
          if (pending.current.type === "leaveRoom") {
            save(null);
            setRoom(null);
            resetChat();
            setExpired(false);
          }
          clearPending();
        }
        if (msg.type === "rejected") {
          if (
            msg.requestId !== null &&
            msg.requestId === chatPending.current?.id
          ) {
            setChatError(msg.message);
            finishChat(false);
            return;
          }
          if (msg.requestId !== null && msg.requestId !== pending.current?.id)
            return;
          const resuming = pending.current?.type === "resumeRoom";
          setError(msg.message);
          clearPending();
          if (
            msg.code === "ROOM_NOT_FOUND" ||
            (resuming && msg.code === "UNAUTHORIZED")
          ) {
            save(null);
            finishChat(false);
            setChatError("방이 종료되어 채팅을 보낼 수 없어요.");
            setExpired(true);
            setRoom((current) =>
              current?.phase === "finished" ? current : null,
            );
          }
        }
      };
      ws.onclose = (event) => {
        if (disposed) return;
        setConnected(false);
        setLiveChatMessages([]);
        clearPending();
        if (chatPending.current)
          setChatError("연결이 끊겼어요. 다시 연결한 뒤 전송해주세요.");
        finishChat(false);
        if (event.code === 4001) {
          save(null);
          setRoom(null);
          resetChat();
          setError(
            "다른 연결에서 이 자리에 접속했습니다. 새로고침해 다시 입장하세요.",
          );
          return;
        }
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 5000));
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(timeout.current);
      clearTimeout(chatTimeout.current);
      chatPending.current?.resolve(false);
      chatPending.current = null;
      socket.current?.close();
    };
  }, []);

  function send(command: Command) {
    if (
      !connected ||
      pending.current ||
      socket.current?.readyState !== WebSocket.OPEN
    )
      return;
    const message = { ...command, requestId: requestId() };
    const parsed = decodeClientMessage(JSON.stringify(message));
    if (!parsed.success) {
      setError("닉네임과 방 코드 형식을 확인해주세요.");
      return;
    }
    setError("");
    pending.current = { type: parsed.data.type, id: parsed.data.requestId };
    setBusy(true);
    socket.current.send(JSON.stringify(parsed.data));
    timeout.current = setTimeout(() => {
      setError("응답을 기다리는 중입니다. 다시 연결합니다.");
      socket.current?.close();
    }, 8000);
  }
  function action(command: RoomAction) {
    if (room)
      send({
        ...command,
        roomId: room.roomId,
        expectedRevision: room.revision,
      });
  }
  function sendChat(text: string): Promise<boolean> {
    const ws = socket.current;
    if (
      !room ||
      !saved.current ||
      expired ||
      !connected ||
      ws?.readyState !== WebSocket.OPEN ||
      chatPending.current ||
      pending.current?.type === "resumeRoom" ||
      pending.current?.type === "leaveRoom"
    )
      return Promise.resolve(false);
    const id = requestId();
    const parsed = decodeClientMessage(
      JSON.stringify({
        type: "sendChat",
        requestId: id,
        roomId: room.roomId,
        text,
      }),
    );
    if (!parsed.success) {
      setChatError("1~300자의 메시지를 입력해주세요.");
      return Promise.resolve(false);
    }
    setChatError("");
    setChatBusy(true);
    return new Promise((resolve) => {
      chatPending.current = { id, resolve };
      ws.send(JSON.stringify(parsed.data));
      chatTimeout.current = setTimeout(() => {
        setChatError(
          "전송 확인을 받지 못했어요. 내역을 확인한 뒤 다시 시도해주세요.",
        );
        finishChat(false);
      }, 8000);
    });
  }
  function leave() {
    if (room && saved.current && !expired) action({ type: "leaveRoom" });
    else {
      save(null);
      setRoom(null);
      setExpired(false);
      setError("");
      resetChat();
    }
  }
  return {
    snapshotEpoch,
    liveStart,
    room,
    session,
    connected,
    busy,
    error,
    expired,
    send,
    action,
    leave,
    messages,
    liveChatMessages,
    chatPlayerId,
    chatBusy,
    chatError,
    sendChat,
  };
}
