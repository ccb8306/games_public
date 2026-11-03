import { useRef, useState } from "react";
import { AUGMENTS, goldDisabled, type PublicPlayer } from "@yacht/shared";
import { AugmentIcon } from "./AugmentIcon";

export function PlayerAugments({
  player,
  turn,
}: {
  player: PublicPlayer;
  turn: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const items = player.augment?.items ?? [];
  const describe = (index: number) => {
    const item = items[index];
    const def = item && AUGMENTS.find((d) => d.id === item.id);
    if (!def) return null;
    const state = goldDisabled(player, item.id)
      ? "이번 턴 사용 중지"
      : item.remaining === 0 && def.charges !== 0
        ? ["artisan", "fakeHouse"].includes(item.id)
          ? "조작 완료 · 자동 효과 유지"
          : "사용 완료"
        : item.usedTurn === turn && def.trigger === "active"
          ? "이번 턴 사용함"
          : def.trigger === "passive"
            ? "자동 발동"
            : "사용형";
    const status = `${state}${item.remaining >= 0 && (def.charges > 0 || item.borrowedAt !== undefined) ? ` · 남은 ${item.remaining}회` : ""}${item.borrowedAt !== undefined ? " · 대여: 다음 자기 턴 끝에 반납" : ""}`;
    return { def, status };
  };
  const detail = describe(selected);
  if (!items.length) return null;
  return (
    <>
      <div
        className="player-augments"
        aria-label={`${player.nickname} 보유 능력`}
      >
        {items.map((item, index) => {
          const data = describe(index);
          return (
            data && (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className={`player-augment ${data.def.rarity} ${data.def.flash ? "flash" : ""}`}
                data-spent={
                  item.remaining === 0 &&
                  data.def.charges !== 0 &&
                  !["artisan", "fakeHouse"].includes(item.id)
                }
                aria-label={`${data.def.name} 설명`}
                aria-haspopup="dialog"
                title={`${data.def.name} · ${data.status}\n${data.def.description}`}
                onClick={() => {
                  setSelected(index);
                  dialog.current?.showModal();
                }}
              >
                <AugmentIcon id={item.id} />
              </button>
            )
          );
        })}
      </div>
      <dialog
        ref={dialog}
        className="player-augment-dialog"
        aria-label="보유 능력 설명"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        {detail && (
          <article>
            <small>
              {player.nickname} ·{" "}
              {
                { silver: "실버", gold: "골드", prism: "프리즘" }[
                  detail.def.rarity
                ]
              }
              {detail.def.flash ? " · 번뜩임" : ""}
            </small>
            <h3>
              <AugmentIcon id={detail.def.id} />
              {detail.def.name}
            </h3>
            <p>{detail.def.description}</p>
            <p className="ability-status">{detail.status}</p>
            <button type="button" onClick={() => dialog.current?.close()}>
              닫기
            </button>
          </article>
        )}
      </dialog>
    </>
  );
}
