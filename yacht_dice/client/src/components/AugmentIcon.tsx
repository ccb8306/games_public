import { useId } from "react";
import { AUGMENTS } from "@yacht/shared";

export function AugmentIcon({ id }: { id: string }) {
  const gradientId = useId();
  const n = AUGMENTS.findIndex((a) => a.id === id),
    seed = Math.max(0, n);
  const motifs: Record<string, string> = {
    practice:
      "M22 22h20v20H22ZM28 28h0m8 8h0M17 35a17 17 0 1 0 1-14M13 17l5 4 5-4",
    misdelivery:
      "M17 24h30v22H17ZM17 24l15-8 15 8M32 24v22M22 30h18m-4-4 4 4-4 4M40 39H22m4-4-4 4 4 4",
    goldRush:
      "M20 18h12v15H20ZM34 31h12v15H34ZM16 40l9 8 7-5M48 24l-9-8-7 5M16 34v6h6M48 30v-6h-6",
    confiscate:
      "M17 21h12v12H17ZM35 21h12v12H35ZM22 38h20v11H22ZM23 33l4 5m14-5-4 5M27 42h10",
    tomorrow:
      "M18 24h28v23H18ZM24 17v12m16-12v12M18 32h28M27 40h10m-4-4 4 4-4 4",
    bounty: "M20 17h24v30H20ZM32 23a6 6 0 1 0 .1 0M25 39h14M27 43h10",
    taste: "M19 24h17v18H19ZM35 18h12v12H35ZM25 31h0M40 23h0M40 36l-5 6h10",
    inspection: "M19 21h20v22H19ZM25 30l4 5 7-9M40 36l8 9M39 28a8 8 0 1 0 .1 0",
    memory: "M24 20a16 16 0 1 1-8 16M16 18v11h11M29 26h11v13H29ZM34 32h0",
    fork: "M32 46V32M32 32L20 20m12 12 12-12M17 27V17h10m10 0h10v10",
    dinner:
      "M32 21a12 12 0 1 0 .1 0M15 18v14m-4-14v10h8V18M15 32v16M50 18v30M46 18v14h4",
    bombParcel:
      "M18 25h28v22H18ZM18 25l14-8 14 8M32 25v22M37 16l4-5m1 8 7-1M27 34h10",
    hostage:
      "M17 24h14v19H17ZM33 24h14v19H33ZM25 20v-4h14v4M24 33h0m16 0h0M28 46h8",
    parkingTicket:
      "M20 17h24v30l-6-4-6 4-6-4-6 4ZM28 37V24h6a5 5 0 0 1 0 10h-6",
    butterFingers:
      "M19 25h26v17H19ZM23 25l5-7h14l3 7M24 47l-3 4m13-5-2 5m13-5-2 5",
    ordinaryDay: "M32 18a7 7 0 1 0 .1 0M20 46q0-15 12-15t12 15M17 17l30 30",
    clockwork: "M18 35a14 14 0 1 1 28 0M32 34l9-13M20 44h24M16 44l5-6m27 6-5-6",
    lower: "M21 21h22v23H21ZM26 29h12M32 23v12M27 39h10",
    taxSix:
      "M22 17h20v30l-4-3-4 3-4-3-4 3-4-3V17M27 24h10M32 21v20M27 36q10 7 10-1t-10-5q0-6 10-3",
    dropIt:
      "M24 18q-9 25 19 29-17-13-12-26M24 18l7 3M24 31l-9 9 15-3M32 30l16 5-10 5",
    receipt:
      "M32 25a12 12 0 1 0 .1 0M29 25v-6h6v6M32 19q0-9 8-6M42 10v6m-3-3h6",
    broken: "M18 20h28v20H18ZM25 46h14M32 40v6M35 23l-8 8 9 2-8 5",
    construction: "M18 25h28v14H18ZM20 25l10 14m4-14 10 14M22 39v8m20-8v8",
    handsUp: "M22 42V22m0 9-6-5m6-4 5-6m15 26V22m0 9 6-5m-6-4-5-6M27 43h10",
    closed: "M17 23h30v23H17ZM23 23v-7h18v7M22 30l20 10m0-10L22 40",
    strike: "M20 19h24v20H20ZM32 39v10M25 25h14M25 31h14",
    squid:
      "M15 23a5 5 0 1 0 .1 0M27 29l6-12 6 12ZM43 18h10v11H43ZM20 42h28M25 38v8m14-8v8",
    change: "M20 39 39 20l5 5-19 19-5-5M20 20h7m-3-4v8M42 36v9m-4-5h8",
    defense: "M32 18 45 23v10c0 9-13 14-13 14S19 42 19 33V23Z M25 32l5 5 9-11",
    attack:
      "m21 19 24 25m-4-26L20 43m-2-6 8 8m12-8 8 8M20 19l1 9 8-7M44 19l-9 2 7 7",
    gamble: "M32 17 45 32 32 47 19 32Z M30 26h4v9m-2 5h0",
    roll: "M22 23a14 14 0 1 1-4 13m0-14 4 1 1-7M29 27h9v11h-9Z",
    zero: "M22 22h20v20H22Z M26 32h12M32 26v12",
    straight: "M18 40h8V32h8v-8h10M40 20l4 4-4 4",
    kind: "M18 25h12v14H18Zm16-5h12v14H34Z M34 38h12v7H34Z",
    rival: "M18 29q14-18 28 0-14 18-28 0Z M32 25a4 4 0 1 0 .1 0M24 44h16",
    sum: "M22 20h20L28 32l14 12H22",
    hold: "M23 28v-7a9 9 0 0 1 18 0v7M20 28h24v18H20Z M32 34v6",
    early: "M20 19h24M20 45h24M23 20v5l18 15v4M41 20v5L23 40v4",
    comeback: "M20 41 32 21l12 20M32 21v25M25 29l7-8 7 8",
    upper: "M22 38 32 23l10 15M32 23v22",
    safe: "M22 29v-9h20v25H22V29m4 3 5 5 8-10",
    odd: "M23 21h0m18 0h0M32 32h0M23 43h0m18 0h0",
    even: "M24 22h20v22H24ZM34 32h0M20 18l-6 7 6 6M15 25h9",
    ones: "M28 25l5-5v24m-6 0h12",
    six: "M40 21H26l-3 12v11h18V32H24m8 4v4",
  };
  const motif = motifs[id] ?? motifs[AUGMENTS[n]?.tags[0] ?? "roll"];
  return (
    <svg className="augment-icon" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x2="1" y2="1">
          <stop stopColor="#fff0b0" />
          <stop
            offset="1"
            stopColor={
              AUGMENTS[n]?.rarity === "silver"
                ? "#85bccc"
                : AUGMENTS[n]?.rarity === "gold"
                  ? "#e9a735"
                  : "#a77afa"
            }
          />
        </linearGradient>
      </defs>
      <path
        d="M32 2 58 17v30L32 62 6 47V17Z"
        fill={`url(#${gradientId})`}
        stroke="#fff4d0"
        strokeWidth="2"
      />
      <path d="M32 10 51 21v22L32 54 13 43V21Z" fill="#102e34" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        {motif ? (
          <path d={motif} />
        ) : (
          <>
            <rect
              x="21"
              y="21"
              width="22"
              height="22"
              rx="5"
              transform={`rotate(${seed % 3 === 0 ? 15 : seed % 3 === 1 ? -15 : 0} 32 32)`}
            />
            {Array.from({ length: (seed % 6) + 1 }, (_, i) => (
              <circle
                key={i}
                cx={26 + (i % 2) * 12}
                cy={25 + Math.floor(i / 2) * 7}
                r="1"
              />
            ))}
          </>
        )}
        <path
          d={
            seed % 4 === 0
              ? "M8 32h9m30 0h9M32 8v9m0 30v9"
              : seed % 4 === 1
                ? "m10 13 8 7m28 24 8 7M11 51l8-7m26-24 8-7"
                : seed % 4 === 2
                  ? "m6 31 6-7 6 7m28 2 6 7 6-7"
                  : "M20 12h24M20 52h24"
          }
        />
      </g>
    </svg>
  );
}
