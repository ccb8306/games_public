import { AUGMENTS, canTradeGold, type AugmentCommand } from "./augments.js";
import {
  SCORE_CATEGORIES,
  type PublicPlayer,
  type RoomState,
} from "./index.js";

export const flashGlobal = [
  "handsUp",
  "dinner",
  "confiscate",
];
const remaining = (p: PublicPlayer) =>
  SCORE_CATEGORIES.filter((k) => p.scores[k] === null);
export function goldDisabled(p: PublicPlayer, id: string) {
  const curse = p.augment?.curse;
  return (
    !!curse?.active &&
    (curse.id === "broken" && curse.other === id)
  );
}
export function blockedCategory(p: PublicPlayer, category: string) {
  return (
    !!p.augment?.curse?.active &&
    !!p.augment.curse.categories?.includes(category)
  );
}
export function flashTargets(s: RoomState, p: PublicPlayer, c: AugmentCommand) {
  const id = c.id!,
    alive = s.players.filter((q): q is PublicPlayer => !!q && !q.forfeited);
  const opponent = (target?: string) =>
    alive.find((q) => q.id === target && q.id !== p.id && remaining(q).length);
  if(id==='monster')return [{q:p,categories:undefined,other:undefined}];
  if(id==='crown'){
    if(s.augment!.crown||alive.some(q=>remaining(q).length<2))throw Error('왕관 행사를 열 수 없어요.');
    return alive.map(q=>({q,categories:undefined,other:undefined}));
  }
  if(id==='custody'){
    const q=opponent(c.target);if(!q||q.augment!.curse||remaining(q).length<2||remaining(p).length<2||s.augment!.custody?.some(l=>[l.a,l.b].some(id=>id===p.id||id===q.id)))throw Error('공동 육아 대상이 없어요.');
    return [{q,categories:undefined,other:undefined}];
  }
  if (id === "handsUp") {
    const targets=alive.filter(q=>q.id!==p.id&&remaining(q).length&&!q.augment!.curse);
    if(!targets.length) throw Error("방해를 예약할 상대가 없어요.");
    return targets.map(q=>({q,categories:undefined,other:undefined}));
  }
  if (id === "strike") {
    if(alive.length<3)throw Error("회전목마는 3인 이상에서 사용할 수 있어요.");
    const key = c.category as (typeof SCORE_CATEGORIES)[number];
    if (!SCORE_CATEGORIES.slice(6).includes(key)) throw Error("회전할 하단 칸을 고르세요.");
    const eligible = alive.filter((q) => q.scores[key] !== null && !q.augment!.scoreSwapped);
    if (eligible.length < 3 || !eligible.includes(p)) throw Error("나를 포함해 아직 교환당하지 않은 세 명 이상이 기록한 칸이 필요해요.");
    return eligible.sort((a,b)=>a.slot-b.slot).map(q=>({q,categories:[key],other:undefined}));
  }
  if (id === "squid") {
    if (s.augment!.jackpot || remaining(p).length < 2) throw Error("진행 중인 공동 승부가 없고 다음 내 턴이 있어야 해요.");
    const eligible = alive.filter(q=>remaining(q).length && !q.augment!.curse && Math.max(0,Object.values(q.scores).reduce<number>((a,b)=>a+(b??0),0)+q.augment!.bonus+(q.augment!.rawUpper>=63?35:0))>=20);
    if (eligible.length<2 || !eligible.includes(p)) throw Error("나를 포함해 20점 이상 가진 참가자가 두 명 필요해요.");
    return eligible.map(q=>({q,categories:undefined,other:undefined}));
  }
  if (flashGlobal.includes(id)) {
    if (
      p.augment!.curse ||
      alive.some((q) => !remaining(q).length) ||
      remaining(p).length < 2
    )
      throw Error("모두에게 다음 턴이 있어야 하고 내 예약 방해가 없어야 해요.");
    if (alive.some((q) => q.augment?.curse?.id === id))
      throw Error("같은 난장판이 아직 진행 중이에요.");
    const targets = alive.filter((q) => !q.augment!.curse);
    if (!targets.some((q) => q.id !== p.id))
      throw Error("방해를 받을 수 있는 상대가 없어요.");
    return targets.map((q) => ({
      q,
      categories: undefined as string[] | undefined,
      other: undefined as string | undefined,
    }));
  }
  if (id === "closed") {
    const q = alive.find((q) => q.id === c.target && q.id !== p.id),
      key = c.category as (typeof SCORE_CATEGORIES)[number];
    if (
      !q ||
      q.augment!.scoreSwapped ||
      !SCORE_CATEGORIES.slice(6).includes(key) ||
      p.scores[key] == null ||
      q.scores[key] == null ||
      p.scores[key] === q.scores[key]
    )
      throw Error(
        "둘 다 기록했고 점수가 다른 하단 점수칸을 고르세요. 한 번 당한 상대는 다시 바꿀 수 없어요.",
      );
    return [{ q, categories: [key], other: undefined }];
  }
  if (id === "goldRush") {
    const eligible = alive.filter((q) => q.augment!.items.some(canTradeGold));
    if (eligible.length < 2 || !eligible.some((q) => q.id === p.id))
      throw Error("나를 포함한 두 명 이상이 사용 가능한 골드를 갖고 있어야 해요.");
    return eligible
      .sort((a, b) => a.slot - b.slot)
      .map((q) => ({ q, categories: undefined, other: undefined }));
  }
  const q = opponent(c.target);
  if (!q || q.augment!.curse)
    throw Error("남은 턴이 있고 방해가 예약되지 않은 상대를 고르세요.");
  let categories: string[] | undefined;
  if (id === "construction" && remaining(q).length <= 2)
    throw Error("빈 점수칸이 3개 이상인 상대에게만 사용할 수 있어요.");
  if (id === "misdelivery" && !q.augment!.lastDice?.includes(c.value ?? 0))
    throw Error("상대가 직전에 기록한 주사위 눈을 고르세요.");
  if (
    id === "broken" &&
    !q.augment!.items.some(
      (i) =>
        i.id === c.other &&
        i.borrowedAt === undefined &&
        i.remaining !== 0 &&
        AUGMENTS.some(
          (d) => d.id === i.id && d.rarity === "gold" && d.trigger === "active",
        ),
    )
  )
    throw Error("사용 가능한 상대의 사용형 골드를 고르세요.");
  return [{ q, categories, other: c.other }];
}
export function flashEligible(s: RoomState, p: PublicPlayer, id: string) {
  const commands: AugmentCommand[] = [{ op: "use", id }];
  for (const q of s.players)
    if (q && q.id !== p.id && !q.forfeited) {
      commands.push({ op: "use", id, target: q.id });
      for (const category of SCORE_CATEGORIES)
        commands.push({ op: "use", id, target: q.id, category });
      for (const i of q.augment?.items ?? [])
        commands.push({ op: "use", id, target: q.id, other: i.id });
      for (const value of q.augment?.lastDice ?? [])
        commands.push({ op: "use", id, target: q.id, value });
    }
  return commands.some((c) => {
    try {
      flashTargets(s, p, c);
      return true;
    } catch {
      return false;
    }
  });
}
