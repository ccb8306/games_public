import { useEffect, useRef, useState } from "react";
import type { RoomState, AugmentState } from "@yacht/shared";
export type AugmentResult = AugmentState["results"][number];
export function effectDuration(
  result: AugmentResult,
  reduced = false,
  backlog = 0,
) {
  return reduced
    ? 350
    : backlog > 3
      ? result.presentation?.level === "major"
        ? 850
        : 350
      : result.presentation?.level === "major"
        ? 1300
        : result.presentation?.level === "emphasis"
          ? 850
          : 500;
}
export function useAugmentEffects(
  room: RoomState,
  connected = true,
  snapshotEpoch = 0,
  enabled = true,
) {
  const [queue, setQueue] = useState<AugmentResult[]>([]),
    [muted, setMuted] = useState(() => {
      try {
        return localStorage.getItem("yacht.effects") === "off";
      } catch {
        return false;
      }
    }),
    [reduced, setReduced] = useState(false);
  const last = useRef<{
    room: string;
    epoch: number;
    connected: boolean;
    cursor?: string;
    seen: Set<string>;
  } | null>(null);
  const results = room.augment?.results ?? [],
    latest = results.at(-1)?.key;
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    const previous = last.current;
    if (
      !enabled ||
      !previous ||
      previous.room !== room.roomId ||
      previous.epoch !== snapshotEpoch ||
      !connected ||
      !previous.connected
    ) {
      last.current = {
        room: room.roomId,
        epoch: snapshotEpoch,
        connected,
        cursor: latest,
        seen: new Set(results.map((r) => r.key)),
      };
      setQueue([]);
      return;
    }
    if (previous.cursor === latest) return;
    const index = results.findIndex((r) => r.key === previous.cursor),
      fresh = results.slice(index + 1).filter((r) => !previous.seen.has(r.key));
    previous.cursor = latest;
    for (const r of fresh) previous.seen.add(r.key);
    if (previous.seen.size > 128)
      previous.seen = new Set(results.map((r) => r.key));
    if (muted) return;
    const visual = fresh.some((r) => r.presentation)
      ? fresh
          .filter((r) => r.presentation)
          .map((r) => {
            const end = fresh.indexOf(r);
            let start = end;
            while (start > 0 && !fresh[start - 1]!.presentation) start--;
            return {
              ...r,
              text: fresh
                .slice(start, end + 1)
                .map((x) => x.text)
                .join("\n"),
            };
          })
      : fresh.some((r) => r.activation)
        ? fresh.filter((r) => r.activation)
        : fresh.length
          ? [{ ...fresh.at(-1)!, text: fresh.map((r) => r.text).join("\n") }]
          : [];
    setQueue((q) => {
      const next = [...q, ...visual];
      return next.length <= 8 ? next : [next[0]!, ...next.slice(-7)];
    });
  }, [room.roomId, latest, snapshotEpoch, connected, enabled, muted]);
  const current = queue[0];
  useEffect(() => {
    if (!current || muted) return;
    const timer = setTimeout(
      () => setQueue((q) => (q[0]?.key === current.key ? q.slice(1) : q)),
      effectDuration(current, reduced, queue.length),
    );
    return () => clearTimeout(timer);
  }, [current?.key, muted, reduced]);
  const toggle = () =>
    setMuted((value) => {
      const next = !value;
      setQueue([]);
      try {
        localStorage.setItem("yacht.effects", next ? "off" : "on");
      } catch {}
      return next;
    });
  return {
    current: muted ? undefined : current,
    skip: () => setQueue((q) => q.slice(1)),
    skipAll: () => setQueue([]),
    muted,
    toggle,
    reduced,
    queued: queue.length,
  };
}
export type AugmentEffects = ReturnType<typeof useAugmentEffects>;
