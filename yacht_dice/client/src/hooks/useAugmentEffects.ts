import { useEffect, useRef, useState } from "react";
import type { RoomState, AugmentState } from "@yacht/shared";
export type AugmentResult = AugmentState["results"][number];
export function effectDuration(
  result: AugmentResult,
  reduced = false,
  backlog = 0,
) {
  const base =
    result.presentation?.level === "major"
      ? 6000
      : result.presentation?.level === "emphasis"
        ? 4500
        : 3000;
  return Math.min(
    8000,
    Math.max(
      base,
      1500 +
        [
          result.activation?.actor,
          result.activation?.targets.join(" "),
          result.activation?.effect ?? result.text,
          ...(result.presentation?.players.map(
            (p) => `${p.name} ${p.before} ${p.after}`,
          ) ?? []),
          ...(result.presentation?.cells.map(
            (c) => `${c.category} ${c.before} ${c.after}`,
          ) ?? []),
        ]
          .join(" ")
          .replace(/\s/g, "").length *
          50,
    ),
  );
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
  const [overflow, setOverflow] = useState(0);
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
      setOverflow(0);
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
    setQueue((q) => [...q, ...visual]);
  }, [room.roomId, latest, snapshotEpoch, connected, enabled, muted]);
  useEffect(() => {
    if (queue.length > 8) {
      setOverflow((n) => n + queue.length - 8);
      setQueue((q) => q.slice(0, 8));
    }
  }, [queue]);
  const [paused, setPaused] = useState(false),
    [pinned, setPinned] = useState(false),
    [hidden, setHidden] = useState(false);
  const remaining = useRef(0),
    timerKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const current = queue[0];
  useEffect(() => {
    if (!current || muted) return;
    if (timerKey.current !== current.key) {
      timerKey.current = current.key;
      remaining.current = effectDuration(current);
    }
    if (paused || pinned || hidden) return;
    const started = Date.now();
    const timer = setTimeout(
      () => setQueue((q) => (q[0]?.key === current.key ? q.slice(1) : q)),
      Math.max(1500, remaining.current),
    );
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [current?.key, muted, paused, pinned, hidden]);
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
    skip: () => {
      setPinned(false);
      setQueue((q) => q.slice(1));
    },
    skipAll: () => {
      setPinned(false);
      setQueue([]);
    },
    muted,
    toggle,
    reduced,
    overflow,
    clearOverflow: () => setOverflow(0),
    queued: queue.length,
    paused,
    setPaused,
    pinned,
    setPinned,
  };
}
export type AugmentEffects = ReturnType<typeof useAugmentEffects>;
