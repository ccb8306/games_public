import type { AugmentCommand, AugmentState } from "./augments.js";
import type { RoomState, PublicPlayer } from "./index.js";
import { playerTotals } from "./augment-game.js";

type Snap = NonNullable<AugmentState["turn"]["first"]>;
export type ChoiceTools = {
  change: (s: RoomState, i: number, n: number) => void;
  restore: (s: RoomState, snap: Snap) => void;
  snapshot: (s: RoomState) => Snap;
  result: (s: RoomState, text: string) => void;
};
export function transfer(
  s: RoomState,
  from: PublicPlayer,
  to: PublicPlayer,
  amount: number,
) {
  const key = `damage:${s.augment!.turn.serial}`;
  const paid = Math.max(
    0,
    Math.min(
      amount,
      playerTotals(from).total,
      10 - (from.augment!.roundIncome[key] ?? 0),
    ),
  );
  from.augment!.bonus -= paid;
  to.augment!.bonus += paid;
  from.augment!.roundIncome[key] = (from.augment!.roundIncome[key] ?? 0) + paid;
  return paid;
}
export function resolveChoice(
  s: RoomState,
  p: PublicPlayer,
  c: AugmentCommand,
  random: (n: number) => number,
  h: ChoiceTools,
) {
  const t = s.augment!.turn,
    kind = t.pending,
    curse = p.augment!.curse;
  if (!kind || ![0, 1].includes(c.value ?? -1))
    throw Error("진행 중인 선택의 버튼을 눌러주세요.");
  if (kind === "forkSecond") {
    if (c.value !== 0 || !t.fork) throw Error("B 결과를 굴려주세요.");
    h.restore(s, t.fork.start);
    s.rollPhase = "shaking";
    t.pending = undefined;
    return;
  }
  if (kind === "forkChoice") {
    if (!t.fork?.first) throw Error("비교할 결과가 없어요.");
    if (c.value === 0) h.restore(s, t.fork.first);
    t.fork = undefined;
    t.pending = undefined;
    return;
  }
  const source = s.players.find(
    (q) => q && !q.forfeited && q.id === curse?.from,
  );
  if (!curse?.active || curse.id !== kind) throw Error("해결할 방해가 없어요.");
  if (!source) {
    p.augment!.curse = null;
    t.pending = undefined;
    return;
  }
  if (kind === "bombParcel") {
    const face = c.value === 1 ? random(6) + 1 : null;
    const reverse = face !== null && face >= 4;
    const amount = transfer(
      s,
      reverse ? source : p,
      reverse ? p : source,
      face === null ? 6 : reverse ? 6 : 10,
    );
    h.result(
      s,
      `착불 폭탄 · ${face === null ? "배송비 납부" : `${face} · ${reverse ? "역폭발!" : "폭발!"}`} · ${reverse ? source.nickname : p.nickname} → ${reverse ? p.nickname : source.nickname} ${amount}점`,
    );
    p.augment!.curse = null;
  } else if (kind === "hostage") {
    if (c.value === 0) {
      if (playerTotals(p).total < 10)
        throw Error("10점이 없으면 주사위 두 개를 봉인해야 해요.");
      transfer(s, p, source, 10);
    } else {
      const indices = c.indices ?? [];
      if (
        indices.length !== 2 ||
        new Set(indices).size !== 2 ||
        indices.some((i) => i >= s.dice.length || t.preheld?.includes(i)) ||
        curse.values?.length !== 2
      )
        throw Error("미리 보관한 주사위를 제외하고 두 개를 고르세요.");
      indices.forEach((i) => h.change(s, i, 1));
      t.sealed = [...indices];
      t.fixed = [...indices];
      for (const i of indices) s.held[i] = true;
      t.flags.push("faceChanged");
    }
    h.result(s, `${p.nickname} · 악마의 택배: ${c.value === 0 ? "10점 납부!" : "주사위 두 개가 이번 턴 내내 1로 봉인!"}`);
    p.augment!.curse = null;
  }
  t.pending = undefined;
}
