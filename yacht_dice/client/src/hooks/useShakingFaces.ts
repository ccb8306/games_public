import { useEffect, useState } from "react";

export const SHAKE_FACE_INTERVAL_MS = 100;
const INITIAL_FACES = [1, 2, 3, 4, 5];

/** Cosmetic faces only: never used by scoring or sent to the server. */
export function useShakingFaces(active: boolean) {
  const [faces, setFaces] = useState(INITIAL_FACES);
  useEffect(() => {
    if (!active) return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    let frame = INITIAL_FACES;
    function updateMotion() {
      clearInterval(timer);
      timer = undefined;
      if (motion?.matches) return;
      timer = setInterval(() => {
        // Pick one of the other five faces so every tick visibly changes it.
        frame = frame.map(
          (value) => ((value + Math.floor(Math.random() * 5)) % 6) + 1,
        );
        setFaces(frame);
      }, SHAKE_FACE_INTERVAL_MS);
    }
    updateMotion();
    motion?.addEventListener("change", updateMotion);
    return () => {
      clearInterval(timer);
      motion?.removeEventListener("change", updateMotion);
    };
  }, [active]);
  return faces;
}
