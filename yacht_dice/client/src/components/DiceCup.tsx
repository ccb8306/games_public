import { useEffect, useRef, useState } from "react";
import type { DiceView, createDiceScene } from "../dice/scene";

export function DiceCup({
  onSelect,
  ...view
}: DiceView & { onSelect: (index: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ view, onSelect });
  latest.current = { view, onSelect };
  const scene = useRef<ReturnType<typeof createDiceScene> | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!("WebGLRenderingContext" in window)) return;
    let disposed = false;
    void import("../dice/scene")
      .then(({ createDiceScene }) => {
        if (disposed || !host.current) return;
        scene.current = createDiceScene(
          host.current,
          (index) => latest.current.onSelect(index),
          () => setReady(false),
        );
        scene.current.update(latest.current.view);
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setReady(false);
      });
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.update(view);
  }, [
    view.dice,
    view.held,
    view.phase,
    view.disabled,
    view.motion,
    view.faces,
    view.monster,
    view.childIndex,
  ]);
  return (
    <div
      className="dice-stage"
      ref={host}
      data-ready={ready}
      aria-hidden="true"
    >
      <div className="dice-wind" role="status">
        바람이 불어온다~~
      </div>
      {!ready && (
        <div className="dice-cup-fallback">
          <span>⚄</span>
        </div>
      )}
    </div>
  );
}
