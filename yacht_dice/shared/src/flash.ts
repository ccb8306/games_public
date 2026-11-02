import { AUGMENTS, type AugmentCommand } from "./augments.js";
import {
  SCORE_CATEGORIES,
  type PublicPlayer,
  type RoomState,
} from "./index.js";

export const flashGlobal = [
  "handsUp",
  "strike",
  "squid",
  "dinner",
  "confiscate",
];
const remaining = (p: PublicPlayer) =>
  SCORE_CATEGORIES.filter((k) => p.scores[k] === null);
export function goldDisabled(p: PublicPlayer, id: string) {
  const curse = p.augment?.curse;
  return (
    !!curse?.active &&
    ((curse.id === "ordinaryDay" &&
      AUGMENTS.find((d) => d.id === id)?.trigger === "active") ||
      (curse.id === "strike" &&
        AUGMENTS.find((d) => d.id === id)?.rarity === "gold") ||
      (curse.id === "broken" && curse.other === id))
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
    const eligible = alive.filter((q) =>
      q.augment!.items.some(
        (i) =>
          i.borrowedAt === undefined &&
          AUGMENTS.some(
            (d) =>
              d.id === i.id &&
              d.rarity === "gold" &&
              (d.charges <= 0 || i.remaining > 0),
          ),
      ),
    );
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
  if (id === "construction" && remaining(q).length <= 3)
    throw Error("빈 점수칸이 4개 이상인 상대에게만 사용할 수 있어요.");
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
