import { useEffect, useState } from "react";
import { EVENTS, type RoomState } from "@yacht/shared";

export function RoundEventBanner({ room }: { room: RoomState }) {
  const event = EVENTS.find((e) => e.id === room.augment?.event);
  const key = event ? `${room.roomId}:${room.augment!.round}:${event.id}` : "";
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!key || room.phase !== "playing") return;
    try {
      if (sessionStorage.getItem(`yacht-event:${key}`)) return;
      sessionStorage.setItem(`yacht-event:${key}`, "1");
    } catch {
      /* Notification still works when storage is unavailable. */
    }
    setShown(key);
  }, [key, room.phase]);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(""), 7000);
    return () => clearTimeout(timer);
  }, [shown]);
  if (!event || shown !== key || room.phase !== "playing") return null;
  return (
    <aside className="round-event-banner" role="status" aria-live="polite">
      <span className="round-event-mark" aria-hidden="true">
        ⚡
      </span>
      <div>
        <small>ROUND {room.augment!.round} · 이번 라운드 모두에게 적용</small>
        <h2>난장판 사건 · {event.name}</h2>
        <p>{event.description}</p>
      </div>
      <button
        type="button"
        aria-label="사건 알림 닫기"
        onKeyDown={(e) => e.stopPropagation()}
        onClick={() => setShown("")}
      >
        ×
      </button>
    </aside>
  );
}
