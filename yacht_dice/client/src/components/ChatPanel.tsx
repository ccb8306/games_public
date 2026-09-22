import { useId, useLayoutEffect, useRef, useState } from "react";
import { CHAT_MAX_LENGTH, type ChatMessage } from "@yacht/shared";

type Props = {
  messages: ChatMessage[];
  playerId?: string;
  connected: boolean;
  expired: boolean;
  busy: boolean;
  error: string;
  onSend: (text: string) => Promise<boolean>;
};

export function ChatPanel({
  messages,
  playerId,
  connected,
  expired,
  busy,
  error,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const composing = useRef(false);
  const sending = useRef(false);
  const inputId = useId();
  const titleId = useId();
  const hintId = useId();
  const latest = messages.at(-1)?.id;
  function scrollToLatest() {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    follow.current = true;
    setUnread(false);
  }
  useLayoutEffect(() => {
    if (follow.current) scrollToLatest();
    else if (latest) setUnread(true);
  }, [latest]);
  async function submit() {
    if (
      sending.current ||
      busy ||
      !connected ||
      expired ||
      !draft.trim() ||
      composing.current
    )
      return;
    const sent = draft;
    sending.current = true;
    try {
      if (await onSend(sent)) {
        setDraft((current) => (current === sent ? "" : current));
        scrollToLatest();
      }
    } finally {
      sending.current = false;
    }
  }
  return (
    <section className="chat-panel panel" aria-labelledby={titleId}>
      <div className="chat-heading">
        <h2 id={titleId}>방 채팅</h2>
        <span className="muted">최근 100개</span>
      </div>
      <div
        className="chat-messages"
        ref={list}
        role="log"
        aria-label="채팅 내역"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        onScroll={() => {
          const el = list.current!;
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 32;
          if (follow.current) setUnread(false);
        }}
      >
        {!messages.length && (
          <p className="chat-empty muted">
            함께하는 플레이어에게 인사를 건네보세요.
          </p>
        )}
        {messages.map((message) => (
          <div
            className="chat-message"
            data-own={message.playerId === playerId}
            key={message.id}
          >
            <div className="chat-meta">
              <strong>
                {message.nickname}
                {message.playerId === playerId ? " · 나" : ""}
              </strong>
              <time dateTime={new Date(message.sentAt).toISOString()}>
                {new Date(message.sentAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      {unread && (
        <button className="chat-new" type="button" onClick={scrollToLatest}>
          새 메시지 보기 ↓
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={inputId}>메시지</label>
        <div className="chat-compose">
          <input
            id={inputId}
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            placeholder="메시지를 입력하세요"
            autoComplete="off"
            aria-describedby={hintId}
            disabled={expired}
            onChange={(event) => setDraft(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (composing.current ||
                  event.nativeEvent.isComposing ||
                  event.keyCode === 229)
              )
                event.preventDefault();
            }}
          />
          <button
            className="primary"
            disabled={busy || !connected || expired || !draft.trim()}
          >
            {busy ? "전송 중…" : "전송"}
          </button>
        </div>
        <p className="chat-hint muted" id={hintId}>
          {expired
            ? "방이 종료되어 내역만 볼 수 있어요."
            : !connected
              ? "다시 연결되면 전송할 수 있어요."
              : `${draft.length}/${CHAT_MAX_LENGTH} · Enter로 전송`}
        </p>
        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
