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
  cap = 10,
) {
  const key = `damage:${s.augment!.turn.serial}`;
  const paid = Math.max(
    0,
    Math.min(
      amount,
      playerTotals(from).total,
      cap - (from.augment!.roundIncome[key] ?? 0),
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
  if (kind === "thief" || kind === "duel") {
    const fee=kind==="thief"?5:10;
    if(c.value===0){
      if(playerTotals(p).total<fee)throw Error(`${fee}점이 있어야 납부할 수 있어요.`);
      const paid=transfer(s,p,source,fee);
      h.result(s,`${p.nickname} → ${source.nickname} ${paid}점 납부 · ${kind==="duel"?"결투 거절":"압류 종료"}`);
      if(kind==="duel"){source.augment!.progress??={};source.augment!.progress.duelRoll=1;}
      if(kind==="duel")s.augment!.duels=s.augment!.duels.filter(d=>!(d.a===source.id&&d.b===p.id&&!d.accepted));
      p.augment!.curse=null;
    }else{
      if(kind==="duel"){
        const d=s.augment!.duels.find(d=>d.a===source.id&&d.b===p.id&&!d.accepted);
        if(!d)throw Error("수락할 결투가 없어요.");
        d.accepted=true;t.maxRolls=Math.min(2,t.maxRolls);
      }
      curse.resolved=true;
      h.result(s,`${p.nickname} · ${kind==="duel"?"콜! 결투 수락 — 승리 +35 / 패배 -10":"수금 계약: 이번 기본 족보의 25% 납부 (올림, 최대 15점)"}`);
    }
  } else if (kind === "bombParcel") {
    const face = c.value === 1 ? random(6) + 1 : null;
    const reverse = face !== null && face >= 5;
    const amount = transfer(
      s,
      reverse ? source : p,
      reverse ? p : source,
      face === null ? 15 : reverse ? 10 : 25,
      25,
    );
    h.result(
      s,
      `착불 폭탄 · ${face === null ? "배송비 납부" : `${face} · ${reverse ? "역폭발!" : "폭발!"}`} · ${reverse ? source.nickname : p.nickname} → ${reverse ? p.nickname : source.nickname} ${amount}점`,
    );
    p.augment!.curse = null;
  } else if (kind === "hostage") {
    if (c.value === 0) {
      if (playerTotals(p).total < 30)
        throw Error("30점이 없으면 주사위 세 개를 봉인해야 해요.");
      const paid = transfer(s, p, source, 30, 30);
      h.result(s, `${source.nickname} · 악마의 택배 몸값 +${paid}점 획득 / ${p.nickname} -${paid}점`);
    } else {
      const indices = c.indices ?? [];
      if (
        indices.length !== 3 ||
        new Set(indices).size !== 3 ||
        indices.some((i) => !Number.isInteger(i) || i < 0 || i >= s.dice.length || t.preheld?.includes(i)) ||
        curse.values?.length !== 3
      )
        throw Error("미리 보관한 주사위를 제외하고 세 개를 고르세요.");
      indices.forEach((i) => h.change(s, i, 1));
      t.sealed = [...indices];
      t.fixed = [...indices];
      for (const i of indices) s.held[i] = true;
      t.flags.push("faceChanged");
    }
    h.result(s, `${p.nickname} · 악마의 택배: ${c.value === 0 ? "몸값 정산 완료! 주사위를 지켰어요." : "주사위 세 개가 이번 턴 내내 1로 봉인!"}`);
    p.augment!.curse = null;
  }
  t.pending = undefined;
}
