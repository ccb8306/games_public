import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export const CELEBRATION_DURATION_MS = 1800;
type CelebrationEvent = {
  id: string;
  kind: "fireworks" | "scream";
  variant?: "yacht";
};
const BURSTS = [
  [12, 26],
  [84, 22],
  [35, 15],
  [66, 45],
  [18, 65],
  [87, 67],
  [43, 75],
  [54, 30],
];

/** Live event IDs, never score previews or restored chat history. */
export function CelebrationLayer({ events }: { events: CelebrationEvent[] }) {
  const seen = useRef(new Set<string>());
  const [active, setActive] = useState<CelebrationEvent[]>([]);
  useEffect(() => {
    const fresh = events.filter((event) => !seen.current.has(event.id));
    fresh.forEach((event) => seen.current.add(event.id));
    if (fresh.length) setActive((current) => [...current, ...fresh]);
  }, [events]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="celebration-layer" aria-hidden="true">
      {active.map((event) => (
        <Celebration
          key={event.id}
          event={event}
          onEnd={() =>
            setActive((current) =>
              current.filter((item) => item.id !== event.id),
            )
          }
        />
      ))}
    </div>,
    document.body,
  );
}
function Celebration({
  event,
  onEnd,
}: {
  event: CelebrationEvent;
  onEnd: () => void;
}) {
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    const timer = setTimeout(() => end.current(), CELEBRATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);
  const yacht = event.kind === "fireworks" && event.variant === "yacht";
  return (
    <div
      className={`celebration celebration-${event.kind}`}
      data-celebration={event.kind}
      data-event-id={event.id}
      data-variant={yacht ? "yacht" : undefined}
      style={
        {
          "--celebration-duration": `${CELEBRATION_DURATION_MS}ms`,
        } as CSSProperties
      }
    >
      {event.kind === "scream" ? (
        <img className="sans-face" src="/sans-face.svg" alt="" />
      ) : (
        <>
          {yacht && <div className="celebration-aura" />}
          {BURSTS.map(([x, y], burst) => (
            <div
              className="firework-burst"
              key={burst}
              style={
                {
                  "--burst-x": `${x}%`,
                  "--burst-y": `${y}%`,
                  "--burst-delay": `${burst * 60}ms`,
                  "--burst-hue": yacht ? 42 : burst * 47,
                } as CSSProperties
              }
            >
              {Array.from({ length: 32 }, (_, index) => (
                <i
                  key={index}
                  style={
                    {
                      "--angle": `${index * 11.25}deg`,
                      "--reach": 0.7 + (index % 3) * 0.15,
                      "--hue": yacht
                        ? 35 + (index % 5) * 5
                        : index * 47 + burst * 55,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          ))}
          <div className="celebration-confetti">
            {Array.from({ length: 72 }, (_, index) => (
              <i
                key={index}
                style={
                  {
                    "--confetti-x": `${(index * 37) % 101}%`,
                    "--drift": `${((index * 13) % 31) - 15}vw`,
                    "--spin": `${360 + (index % 4) * 180}deg`,
                    "--tilt": `${index * 47}deg`,
                    "--confetti-delay": `${(index % 6) * 35}ms`,
                    "--rest-y": `${8 + ((index * 23) % 80)}%`,
                    "--hue": yacht ? 35 + (index % 5) * 5 : index * 47,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          {yacht && (
            <div className="celebration-title">
              <strong>YACHT!</strong>
              <span>+50</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
