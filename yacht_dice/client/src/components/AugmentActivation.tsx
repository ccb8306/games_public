import type { AugmentState } from "@yacht/shared";
import { AugmentIcon } from "./AugmentIcon";

export function AugmentActivation({
  activation,
}: {
  activation: NonNullable<AugmentState["results"][number]["activation"]>;
}) {
  const labels = {
    attack: "공격 개시",
    defense: "방어 성공",
    dice: "운명 조작",
    swap: "판 뒤집기",
    gamble: "승부 개시",
    score: "능력 발동",
  };
  return (
    <div className="activation-content" data-ability={activation.id}>
      <div className="activation-emblem" aria-hidden="true">
        <AugmentIcon
          id={activation.id === "loanDouble" ? "loan" : activation.id}
        />
      </div>
      <div className="activation-copy">
        {["customDie", "monster", "custody", "estate", "crown"].includes(
          activation.id,
        ) && (
          <div className={`novel-effect ${activation.id}`} aria-hidden="true">
            <span>
              {activation.id === "monster"
                ? "⚄"
                : activation.id === "custody"
                  ? "🍼"
                  : activation.id === "estate"
                    ? "🏗"
                    : activation.id === "crown"
                      ? "👑"
                      : "⚙"}
            </span>
            <b>
              {activation.id === "monster"
                ? "👾"
                : activation.id === "custody"
                  ? "🛒"
                  : activation.id === "estate"
                    ? "🏰"
                    : activation.id === "crown"
                      ? "✦"
                      : "⚅"}
            </b>
            <span>
              {activation.id === "monster"
                ? "⚄"
                : activation.id === "custody"
                  ? "🍼"
                  : activation.id === "estate"
                    ? "🏗"
                    : activation.id === "crown"
                      ? "👑"
                      : "⚙"}
            </span>
          </div>
        )}
        <small>
          {activation.flash ? "✦ 번뜩임 · " : ""}
          {labels[activation.kind]}
        </small>
        <div className="activation-route">
          <b>{activation.actor}</b>
          <span aria-label="대상">→</span>
          <b>{activation.targets.join(" · ")}</b>
        </div>
        <h3>{activation.name}</h3>
        <p>{activation.effect}</p>
      </div>
    </div>
  );
}
