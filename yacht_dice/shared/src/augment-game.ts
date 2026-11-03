import { resolveChoice, transfer } from "./augment-choices.js";
import {
  flashGlobal,
  flashTargets,
  flashEligible,
  goldDisabled,
  blockedCategory,
} from "./flash.js";
import {
  AUGMENTS,
  MISCHIEF_IDS,
  EVENTS,
  newAugmentPlayer,
  type AugmentCommand,
  type AugmentState,
} from "./augments.js";
import {
  categoryScore,
  totals,
  SCORE_CATEGORIES,
  SCORE_LABELS,
  type RoomState,
  type PublicPlayer,
  type ScoreCategory,
  type Pose,
} from "./index.js";

type Random = (max: number) => number;
const alive = (s: RoomState) =>
  s.players.filter((p): p is PublicPlayer => !!p && !p.forfeited);
const filled = (p: PublicPlayer) =>
  Object.values(p.scores).filter((v) => v !== null).length;
export const countAugment = (p: PublicPlayer, id: string) =>
  p.augment?.items.filter((a) => a.id === id && !goldDisabled(p, id)).length ??
  0;
export function playerTotals(p: PublicPlayer) {
  if (!p.augment) return totals(p.scores);
  const upper = p.augment.rawUpper,
    bonus = upper >= 63 ? 35 : 0;
  return {
    upper,
    bonus,
    total: Math.max(
      0,
      Object.values(p.scores).reduce<number>((a, b) => a + (b ?? 0), 0) +
        bonus +
        p.augment.bonus,
    ),
  };
}
const note = (s: RoomState, text: string) => {
  s.augment!.log.push(text);
  s.augment!.log = s.augment!.log.slice(-40);
};
function effectResult(s: RoomState, text: string, payouts?: {playerId:string;amount:number;reason:string}[]) {
  s.augment!.results ??= [];
  s.augment!.results.push({
    key: `${s.augment!.turn.serial}:${s.revision}:${s.augment!.results.length}:${text}`,
    text,
    payouts,
  });
  s.augment!.results = s.augment!.results.slice(-40);
}
const turn = (serial: number): AugmentState["turn"] => ({
  serial,
  maxRolls: 3,
  gap: 0,
  locked: null,
  kept: [],
  flags: [],
  target: null,
  extra: 0,
  first: null,
  oldWorld: null,
  reroll: null,
  chooseOld: null,
  erase: null,
  parallel: null,
});
export function initAugment(s: RoomState, random: Random) {
  for (const p of alive(s)) p.augment = newAugmentPlayer();
  const order = alive(s).map((p) => p.id),
    first = order.indexOf(s.currentPlayerId!);
  s.augment = {
    round: 1,
    drafting: false,
    order,
    done: [],
    first,
    event: null,
    log: [],
    results: [],
    turn: turn(0),
    duels: [],
  };
  beginRound(s, random);
}
function availableGold(p: PublicPlayer) {
  return p.augment!.items.filter(
    (i) =>
      i.borrowedAt === undefined &&
      AUGMENTS.find((d) => d.id === i.id)?.rarity === "gold" &&
      (AUGMENTS.find((d) => d.id === i.id)!.charges <= 0 || i.remaining > 0),
  );
}
export const pendingInstant = (p: PublicPlayer) =>
  p.augment?.items.find(
    (i) => ["swap", "doppel"].includes(i.id) && i.remaining > 0,
  )?.id;
function finishDraft(s: RoomState) {
  for (const p of alive(s)) {
    const pending = pendingInstant(p);
    if (!pending) continue;
    const possible = alive(s).some(
      (q) =>
        q.id !== p.id &&
        availableGold(q).some((theirs) =>
          pending === "doppel"
            ? AUGMENTS.find((d) => d.id === theirs.id)!.charges <= 0
            : availableGold(p).some(
                (mine) =>
                  !countAugment(p, theirs.id) && !countAugment(q, mine.id),
              ),
        ),
    );
    if (!possible) {
      p.augment!.items.find((i) => i.id === pending)!.remaining = 0;
      p.augment!.bonus += 10;
      effectResult(s, `${p.nickname} · ${AUGMENTS.find((d) => d.id === pending)!.name}: 대상이 없어 대체 보너스 +10점 지급 완료`);
      note(s, `${p.nickname} · 획득 효과 대상 없음: 대체 보너스 +10`);
    }
  }
  if (alive(s).every((p) => !p.augment!.offers.length && !pendingInstant(p))) {
    s.augment!.drafting = false;
    beginTurn(s);
  }
}
function offerPool(s: RoomState, p: PublicPlayer, exclude: string[] = []) {
  const a = s.augment!,
    rarity = a.round === 1 ? "silver" : a.round === 10 ? "prism" : "gold";
  let pool = AUGMENTS.filter(
    (d) =>
      !d.flash &&
      d.rarity === rarity &&
      !countAugment(p, d.id) &&
      !exclude.includes(d.id) &&
      d.id !== "evolution",
  );
  pool = pool.filter(
    (d) =>
      d.id !== "swap" ||
      (availableGold(p).length > 0 &&
        alive(s).some((q) => q.id !== p.id && availableGold(q).length > 0)),
  );
  pool = pool.filter(
    (d) =>
      d.id !== "doppel" ||
      alive(s).some(
        (q) =>
          q.id !== p.id &&
          availableGold(q).some(
            (i) => AUGMENTS.find((d) => d.id === i.id)!.charges <= 0,
          ),
      ),
  );
  return pool;
}
function offers(s: RoomState, p: PublicPlayer, random: Random) {
  const rarity =
    s.augment!.round === 1
      ? "silver"
      : s.augment!.round === 10
        ? "prism"
        : "gold";
  let pool = offerPool(s, p);
  const result: string[] = [];
  for (let n = 0; n < 3 && pool.length; n++) {
    const pick = pool[random(pool.length)]!;
    result.push(pick.id);
    pool = pool.filter((d) => d.id !== pick.id);
  }
  p.augment!.flashOffer = random(100) < 10;
  if (p.augment!.flashOffer) {
    const eligible = AUGMENTS.filter(
      (d) =>
        d.flash &&
        d.rarity === rarity &&
        !countAugment(p, d.id) &&
        flashEligible(s, p, d.id),
    );
    const choices = eligible;
    if (choices.length) result[2] = choices[random(choices.length)]!.id;
  }
  p.augment!.offers = result;
  p.augment!.rerolled = [false, false, false];
  p.augment!.seenOffers = [...result];
}
function beginRound(s: RoomState, random: Random) {
  const a = s.augment!;
  a.done = [];
  a.event = a.round % 3 === 0 ? EVENTS[random(EVENTS.length)]!.id : null;
  for (const p of alive(s)) p.augment!.roundIncome = {};
  const order = a.order.slice(a.first).concat(a.order.slice(0, a.first));
  s.currentPlayerId =
    order.find((id) => alive(s).some((p) => p.id === id)) ?? null;
  a.drafting = [1, 4, 7, 10].includes(a.round);
  if (a.drafting) for (const p of alive(s)) offers(s, p, random);
  note(
    s,
    `${a.round}라운드${a.event ? ` · ${EVENTS.find((e) => e.id === a.event)!.name}` : ""}`,
  );
  beginTurn(s);
}
function beginTurn(s: RoomState) {
  const a = s.augment!,
    p = alive(s).find((p) => p.id === s.currentPlayerId);
  if (!p) return;
  a.turn = turn(a.turn.serial + 1);
  if (p.augment!.curse) p.augment!.curse.active = true;
  const t = a.turn;
  if (["bombParcel", "thief", "duel"].includes(p.augment!.curse?.id ?? "")) t.pending = p.augment!.curse!.id as "bombParcel" | "thief" | "duel";
  t.gap =
    Math.max(...alive(s).map((p) => playerTotals(p).total)) -
    playerTotals(p).total;
  t.maxRolls = Math.max(
    1,
    3 +
      countAugment(p, "fourth") +
      (p.augment!.previousZero ? countAugment(p, "lifebuoy") : 0) +
      (t.gap >= 40 ? countAugment(p, "loser") : 0) -
      (a.event === "speed" ? 1 : 0) -
      (p.augment!.curse?.id === "seal" ? 1 : 0),
  );
  if (
    a.duels.some(
      (d) =>
        d.accepted && ((d.a === p.id && d.aScore === null) ||
          (d.b === p.id && d.bScore === null)) &&
        t.serial > d.after,
    )
  )
    t.maxRolls = Math.min(2, t.maxRolls);

  if (p.augment!.curse?.id === "squid") t.maxRolls = Math.min(2, t.maxRolls);
  if (
    a.duels.some(
      (d) =>
        t.serial > d.after &&
        d.accepted && ((d.a === p.id && d.aScore === null) ||
          (d.b === p.id && d.bScore === null)),
    )
  )
    t.maxRolls = Math.min(2, t.maxRolls);
  const confiscated =
    p.augment!.curse?.id === "confiscate"
      ? p.augment!.curse.from === p.id
        ? Number(p.augment!.curse.other ?? 0)
        : -1
      : 0;
  const n =
    5 +
    confiscated +
    (countAugment(p, "sixth") ? 1 : 0) +
    (a.event === "overflow" ? 1 : 0);
  s.dice = Array(n).fill(null);
  s.held = Array(n).fill(false);
  s.rollCount = 0;
  s.rollPhase = "idle";
  s.motion = null;
  if (!a.drafting && p.augment!.savedFace != null) {
    s.dice[0] = p.augment!.savedFace;
    s.held[0] = true;
    p.augment!.savedFace = null;
  }
  if (p.augment!.curse?.id === "misdelivery" && p.augment!.curse!.values?.[0]) {
    const index = s.held.findIndex((v) => !v);
    s.dice[index] = p.augment!.curse!.values[0];
    s.held[index] = true;
  }
  t.preheld = s.held.flatMap((v, i) => (v ? [i] : []));
}
export function reconcileAugment(s: RoomState, random: Random) {
  const a = s.augment;
  if (!a || s.phase !== "playing") return;
  for (const p of s.players)
    if (p?.forfeited && p.augment) p.augment.curse = null;
  for (const d of a.duels)
    if (
      !alive(s).some((p) => p.id === d.a) ||
      !alive(s).some((p) => p.id === d.b)
    )
      effectResult(s, "결투 취소 · 참가자가 나갔어요. 보상은 없어요.");
  a.duels = a.duels.filter(
    (d) =>
      alive(s).some((p) => p.id === d.a) && alive(s).some((p) => p.id === d.b),
  );
  if(a.jackpot && a.jackpot.entries.some(e=>!alive(s).some(p=>p.id===e.id))){
    const affectedCurrent=alive(s).find(p=>p.id===s.currentPlayerId)?.augment?.curse?.id==="squid";
    for(const entry of a.jackpot.entries){
      const q=s.players.find(p=>p?.id===entry.id);
      if(q?.augment){q.augment.bonus+=20;if(q.augment.curse?.id==="squid")q.augment.curse=null;}
    }
    a.jackpot=undefined;
    effectResult(s,"공동 승부 취소 · 참가자가 나가서 판돈 20점씩 전액 환급했습니다.");
    const current=alive(s).find(p=>p.id===s.currentPlayerId);
    if(current && affectedCurrent){
      a.turn.maxRolls=Math.max(1,3+countAugment(current,"fourth")+(current.augment!.previousZero?countAugment(current,"lifebuoy"):0)+(a.turn.gap>=40?countAugment(current,"loser"):0)-(a.event==="speed"?1:0));
      if(a.duels.some(d=>d.accepted&&a.turn.serial>d.after&&((d.a===current.id&&d.aScore===null)||(d.b===current.id&&d.bScore===null))))a.turn.maxRolls=Math.min(2,a.turn.maxRolls);
    }
  }
  for (const p of alive(s))
    if (
      p.augment!.curse &&
      ["hostage", "bombParcel", "inspection"].includes(p.augment!.curse!.id) &&
      !alive(s).some((q) => q.id === p.augment!.curse!.from)
    ) {
      p.augment!.curse = null;
      if (p.id === s.currentPlayerId) a.turn.pending = undefined;
    }
  if (a.drafting) finishDraft(s);
  if (!alive(s).some((p) => p.id === s.currentPlayerId))
    advanceAugment(s, random);
}
export function advanceAugment(s: RoomState, random: Random) {
  const a = s.augment!;
  if (s.currentPlayerId && !a.done.includes(s.currentPlayerId))
    a.done.push(s.currentPlayerId);
  const order = a.order.slice(a.first).concat(a.order.slice(0, a.first));
  const next = order.find(
    (id) =>
      !a.done.includes(id) &&
      alive(s).some((p) => p.id === id && filled(p) < 12),
  );
  if (next) {
    s.currentPlayerId = next;
    beginTurn(s);
    return;
  }
  if (alive(s).every((p) => filled(p) >= 12)) return;
  a.round++;
  beginRound(s, random);
}
export function scoringDice(s: RoomState): number[] {
  return s.dice.map((n) => n ?? 1);
}
export function augmentedScore(
  s: RoomState,
  p: PublicPlayer,
  c: ScoreCategory,
) {
  const dice = scoringDice(s),
    a = s.augment,
    t = a?.turn;
  let raw = categoryScore(c, dice),
    base = raw,
    enhance = 0;
  const has = (id: string) => countAugment(p, id);
  const counts = Array.from(
    { length: 6 },
    (_, i) => dice.filter((v) => v === i + 1).length,
  );
  if (
    c === "fullHouse" &&
    base === 0 &&
    counts.some((n) => n >= 4) &&
    has("fakeHouse")
  )
    base = 25;
  if (
    c === "yacht" &&
    base === 0 &&
    counts.some((n) => n >= 4) &&
    has("defect")
  )
    base = 40;
  const cashout = !!t?.flags.includes("chance") && SCORE_CATEGORIES.indexOf(c) >= 6;
  if (cashout) base = Math.min(40, dice.reduce((sum, n) => sum + n, 0) + 10);
  const qualifies = base > 0 && !cashout;
  if (t?.flags.includes("substitute"))
    base = Math.min(
      25,
      dice.reduce((a, b) => a + b, 0),
    );
  if (qualifies && ["fourOfAKind", "yacht"].includes(c))
    enhance += 15 * has("hunter");
  const multiplier = Math.min(
    3,
    (t?.flags.includes("devil") ? (base >= 25 ? 2 : 0) : 1),
  );
  const score = Math.max(
    0,
    cashout ? base : Math.floor((base + enhance) * Math.min(3, multiplier)),
  );
  let extra = t?.extra ?? 0;
  const reasons: string[] = [];
  if (t?.extra) reasons.push(`추가 굴림·교환 정산 ${t.extra > 0 ? "+" : ""}${t.extra}점`);
  const add = (id: string, points: number) => {
    extra += points;
    if (points) reasons.push(`${AUGMENTS.find((d) => d.id === id)?.name ?? EVENTS.find((d) => d.id === id)?.name ?? id} ${points > 0 ? "+" : ""}${points}`);
  };
  if (a && t) {
    if (counts[0]! >= 2) add("cleaner", 6 * has("cleaner"));
    if (new Set(dice).size >= 5) add("artisan", 5 * has("artisan"));
    add("rest", Math.max(0, 3 - s.rollCount) * 3 * has("rest"));
    if (t.kept.length >= 2) add("stubborn", 3 * has("stubborn"));
    if (dice.filter((n) => n % 2).length >= 4) add("odd", 6 * has("odd"));
    if (score > 0 && t.flags.includes("allIn")) add("clockwork", 4 * has("clockwork"));
    const upper = SCORE_CATEGORIES.indexOf(c);
    if (upper < 6 && counts[upper]! >= 3) add("upper", 5 * has("upper"));
    if (score > 0 && p.augment!.previousZero) add("lower", 8 * has("lower"));
    if (score > 0 && p.augment!.streak >= 2 && !p.augment!.savingsPaid)
      add("savings", 12 * has("savings"));
    if (score > 0 && t.flags.includes("third")) add("lastmove", 3 * has("lastmove"));
    if (counts[5]! >= 3) add("six", 7 * has("six"));
    if (score > 0 && t.gap >= 25) add("underdog", 6 * has("underdog"));
    if (t.target) add("target", t.target === c && score > 0 ? 12 : -6);
    if (t.flags.includes("loan")) add("loan", (base >= 25 ? 20 : -10) * (t.flags.includes("loanDouble") ? 2 : 1));
    if (t.flags.includes("bomb")) add("bomb", counts[5]! >= 3 ? 20 : -8);
    if (a.event === "speed" && score > 0) add("speed", 10);
    if (t.flags.includes("mixer") && dice.reduce((a,b)=>a+b,0)>=25)
      add("handsUp", 10);
    if (p.augment!.curse?.active && p.augment!.curse.id === "dinner")
      add("dinner", counts[0]! ? Math.min(6, counts[0]! * 2) : -4);
    if (a.event === "aid") add("aid", base === 0 ? 12 : base <= 15 ? 6 : 0);
  }
  if (extra < -score) reasons.push(`감점 하한 적용: 이번 기록은 0점까지만 감소`);
  return {
    reasons,
    raw,
    base,
    enhance,
    multiplier: cashout ? 1 : multiplier,
    score,
    extra: Math.max(-score, extra),
    total: Math.max(0, score + extra),
  };
}
function directDamage(s: RoomState, p: PublicPlayer, total: number) {
  const curse = p.augment?.curse;
  const amount =
    curse?.active && curse.id === "receipt" && !curse.resolved
      ? 4
      : curse?.active && curse.id === "parkingTicket"
        ? s.augment!.turn.flags.includes("parkingViolation")
          ? 4
          : 0
          : curse?.active && curse.id === "taxSix"
            ? Math.min(6, s.dice.filter((n) => n === 6).length * 2)
            : 0;
  return Math.max(
    0,
    Math.min(
      amount,
      total,
      10 - (p.augment?.roundIncome[`damage:${s.augment!.turn.serial}`] ?? 0),
    ),
  );
}
export type ScoreBreakdown = {
  recorded: number;
  augment: number;
  otherRecords: number;
  upperBonus: number;
  floorAdjustment: number;
  total: number;
};
export function scoreBreakdown(s: RoomState, p: PublicPlayer, c: ScoreCategory): ScoreBreakdown | null {
  if (p.scores[c] !== null || !s.rollCount || s.dice.some(n=>n===null)) return null;
  if (!s.augment) {
    const recorded=categoryScore(c,s.dice as number[]);
    return {recorded,augment:0,otherRecords:0,upperBonus:0,floorAdjustment:0,total:recorded};
  }
  if (!p.augment) return null;
  const copy=structuredClone(s), actor=copy.players.find(q=>q?.id===p.id);
  if (!actor) return null;
  const before=playerTotals(p), beforeBonus=p.augment.bonus;
  try { recordAugment(copy,actor,c); } catch { return null; }
  const after=playerTotals(actor), recorded=actor.scores[c]!;
  const augment=actor.augment!.bonus-beforeBonus;
  const otherRecords=SCORE_CATEGORIES.filter(k=>k!==c).reduce((sum,k)=>sum+(actor.scores[k]??0)-(p.scores[k]??0),0);
  const upperBonus=after.bonus-before.bonus, total=after.total-before.total;
  return {recorded,augment,otherRecords,upperBonus,total,floorAdjustment:total-recorded-augment-otherRecords-upperBonus};
}
export function scorePreview(s: RoomState, p: PublicPlayer, c: ScoreCategory) {
  return scoreBreakdown(s,p,c)?.total ?? 0;
}
export function recordAugment(s: RoomState, p: PublicPlayer, c: ScoreCategory) {
  const beforeTotal=playerTotals(p).total;
  const a = s.augment!,
    t = a.turn,
    ap = p.augment!,
    r = augmentedScore(s, p, c);
  if (t.pending || t.fork || t.chooseOld || t.oldWorld || t.reroll || t.flags.includes("loanDoublePending"))
    throw Error("먼저 주사위 결과 또는 평행세계를 선택하세요.");
  if (blockedCategory(p, c) || (t.parallel && blockedCategory(p, t.parallel)))
    throw Error("이번 턴에는 봉인된 족보를 사용할 수 없어요.");
  if (t.parallel === c)
    throw Error("평행 채점과 일반 기록은 다른 칸을 선택하세요.");
  if (t.saveIndex != null) {
    const n = s.dice[t.saveIndex];
    if (n == null || n > 3)
      throw Error("저장할 주사위는 1, 2, 3 중 하나여야 해요.");
    ap.savedFace = n;
  }
  if (t.hostage) {
    const q = alive(s).find((q) => q.id === t.hostage!.target);
    if (q?.augment?.curse?.id === "hostage" && q.augment.curse.from === p.id)
      q.augment.curse.values = t.hostage.indices.map((i) => s.dice[i]!);
  }
  ap.lastDice = scoringDice(s);
  (ap.archive ??= []).push({ category: c, dice: [...ap.lastDice] });
  ap.items = ap.items.filter(
    (i) => i.borrowedAt === undefined || i.borrowedAt >= t.serial,
  );
  p.scores[c] = r.score;
  ap.bonus += r.extra;
  const receipt = [`족보 ${r.score}점`, ...(r.extra ? [`증강·사건 보너스 ${r.extra > 0 ? "+" : ""}${r.extra}점`] : [])];
  if (SCORE_CATEGORIES.indexOf(c) < 6 && r.score > 0) ap.rawUpper += r.raw;
  ap.streak = r.score > 0 ? ap.streak + 1 : 0;
  if (ap.streak >= 3 && countAugment(p, "savings")) ap.savingsPaid = true;
  ap.previousZero = r.score === 0;
  if (t.erase) {
    if (t.erase === "bonus") {
      ap.bonus += 10;
      receipt.push("지워진 0: 고칠 0점 칸이 없어 +10점 지급 완료");
    }
    else {
      const key = t.erase as ScoreCategory;
      const repair = augmentedScore(s, p, key);
      p.scores[key] = repair.score;
      receipt.push(`지워진 0: ${SCORE_LABELS[key]} 0점 → ${repair.score}점`);
      if (SCORE_CATEGORIES.indexOf(key) < 6 && repair.score > 0)
        ap.rawUpper += repair.raw;
    }
  }
  if (t.parallel) {
    const parallel = Math.min(40,
      augmentedScore(s, p, t.parallel as ScoreCategory).score,
    );
    ap.bonus += parallel;
    receipt.push(`평행 채점: +${parallel}점 지급 완료`);
  }
  const damage = directDamage(s, p, r.total);
  if(ap.curse?.active && ap.curse.id==="thief" && ap.curse.resolved){
    const source=alive(s).find(q=>q.id===ap.curse!.from);
    if(source){
      const won=r.base>=25, from=won?p:source, to=won?source:p;
      const paid=transfer(s,from,to,won?15:8,15);
      receipt.push(`압류 ${won?"성공":"역풍"}: ${from.nickname} → ${to.nickname} ${paid}점`);
      effectResult(s,`${to.nickname} · 압류 예고장 +${paid}점 획득 / ${from.nickname} -${paid}점`);
    }
  }
  if (damage) {
    ap.bonus -= damage;
    receipt.push(`상대 방해: -${damage}점`);
    const from = alive(s).find((q) => q.id === ap.curse?.from);
    if (from && ap.curse?.id === "thief") {
      from.augment!.bonus += damage;
      effectResult(s, `${from.nickname} · 주사위 도둑: ${p.nickname}에게서 +${damage}점 획득`);
    }
    note(s, `${p.nickname} · 방해 피해 -${damage}`);
  }
  if (
    ap.curse?.active &&
    ap.curse.id === "bounty" &&
    s.dice.filter((n) => n === Number(ap.curse!.other)).length >= 3
  ) {
    const source = alive(s).find((q) => q.id === ap.curse!.from);
    if (source) {
      source.augment!.bonus += 6;
      effectResult(s, `${source.nickname} · 수배한 숫자 3개 이상! 보너스 +6점`);
    }
  }
  if (ap.curse?.active !== false) {
    if (ap.curse)
      effectResult(
        s,
        `${p.nickname} · ${AUGMENTS.find((d) => d.id === ap.curse!.id)?.name} 종료`,
      );
    ap.curse = null;
  }
  for (const q of alive(s).filter((q) => q.id !== p.id)) {
    for (const [id, threshold, points, cap] of [
      ["spectator", 30, 3, 6],
      ["parasite", 25, 5, 10],
    ] as const) {
      if (r.base < threshold) continue;
      const qa = q.augment!,
        earned = qa.roundIncome[id] ?? 0,
        amount = Math.min(cap - earned, points * countAugment(q, id));
      qa.bonus += amount;
      if (amount > 0) effectResult(s, `${q.nickname} · ${AUGMENTS.find((d) => d.id === id)!.name}: ${p.nickname}의 고득점으로 +${amount}점 지급 완료`);
      qa.roundIncome[id] = earned + amount;
    }
  }
  for (const d of a.duels) {
    if (t.serial <= d.after || !d.accepted) continue;
    if (d.a === p.id && d.aScore === null) d.aScore = r.base;
    if (d.b === p.id && d.bScore === null) d.bScore = r.base;
    if (d.aScore !== null && d.bScore !== null) {
      const pa = alive(s).find((p) => p.id === d.a),
        pb = alive(s).find((p) => p.id === d.b);
      if (pa && pb) {
        pa.augment!.bonus +=
          d.aScore > d.bScore ? 35 : d.aScore === d.bScore ? 10 : -Math.min(10, playerTotals(pa).total);
        pb.augment!.bonus +=
          d.bScore > d.aScore ? 35 : d.aScore === d.bScore ? 10 : -Math.min(10, playerTotals(pb).total);
        note(
          s,
          `결투 결산 ${pa.nickname} ${d.aScore} : ${pb.nickname} ${d.bScore}`,
        );
        effectResult(
          s,
          `⚔ ${pa.nickname} ${d.aScore}점 : ${pb.nickname} ${d.bScore}점 · ${d.aScore === d.bScore ? "동점! 각각 +10점" : `${d.aScore > d.bScore ? pa.nickname : pb.nickname} 승리! +20점`}`,
        );
      }
    }
  }
  a.duels = a.duels.filter((d) => d.aScore === null || d.bScore === null);
  if(a.jackpot && t.serial>a.jackpot.after){
    const entry=a.jackpot.entries.find(e=>e.id===p.id && e.score===null);
    if(entry)entry.score=r.base;
    if(a.jackpot.entries.every(e=>e.score!==null)){
      const top=Math.max(...a.jackpot.entries.map(e=>e.score!));
      const winners=a.jackpot.entries.filter(e=>e.score===top).sort((x,y)=>alive(s).find(q=>q.id===x.id)!.slot-alive(s).find(q=>q.id===y.id)!.slot);
      const amount=a.jackpot.pot+40;
      const receipts=winners.map((e,i)=>{const q=alive(s).find(q=>q.id===e.id)!;const paid=Math.floor(amount/winners.length)+(i<amount%winners.length?1:0);q.augment!.bonus+=paid;return `${q.nickname} +${paid}점`;});
      effectResult(s,`공동 승부 결산! 최고 ${top}점 | ${receipts.join(" / ")} | 지급 완료`);
      a.jackpot=undefined;
    }
  }
  effectResult(s, `${p.nickname} · 점수 반영 완료 | ${[...receipt, ...r.reasons].join(" / ")} | 현재 총점 ${playerTotals(p).total}점`,[{playerId:p.id,amount:playerTotals(p).total-beforeTotal,reason:receipt.join(" / ")}]);
  note(
    s,
    `${p.nickname} · ${c}: 기본 ${r.base} / 강화 ${r.enhance} / ×${r.multiplier} / 보너스 ${r.extra >= 0 ? "+" : ""}${r.extra}`,
  );
}
function snapshot(s: RoomState) {
  return {
    dice: [...s.dice],
    held: [...s.held],
    rolls: s.rollCount,
    kept: [...s.augment!.turn.kept],
    poses: s.motion?.dice ? structuredClone(s.motion.dice) : undefined,
  };
}
const Q: Pose["q"][] = [
  [0, 0, 0, 1],
  [-Math.SQRT1_2, 0, 0, Math.SQRT1_2],
  [0, 0, Math.SQRT1_2, Math.SQRT1_2],
  [0, 0, -Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
  [1, 0, 0, 0],
];
function change(s: RoomState, i: number, value: number) {
  if (
    i < 0 ||
    i >= s.dice.length ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 6
  )
    throw Error("올바른 주사위와 눈을 선택하세요.");
  if (s.augment?.turn.sealed?.includes(i))
    throw Error("이 주사위는 이번 턴이 끝날 때까지 1로 봉인돼요.");
  s.dice[i] = value;
  if (s.rollCount) s.augment!.turn.flags.push("faceChanged");
  if (s.motion) {
    s.motion.dice[i]!.q = [...Q[value - 1]!];
    s.motion.seq++;
    s.motion.at += 1;
  }
}
function restore(
  s: RoomState,
  snap: NonNullable<AugmentState["turn"]["first"]>,
) {
  s.dice = [...snap.dice];
  for (const i of s.augment!.turn.sealed ?? []) s.dice[i] = 1;
  s.held = [...snap.held];
  for (const i of s.augment!.turn.fixed ?? []) s.held[i] = true;
  s.rollCount = snap.rolls;
  s.augment!.turn.kept = [...(snap.kept ?? [])];
  if (!snap.poses) s.motion = null;
  if (s.motion && snap.poses) {
    s.motion.dice = structuredClone(snap.poses);
    s.motion.seq++;
    s.motion.at += 1;
    for (const i of s.augment!.turn.sealed ?? [])
      s.motion.dice[i]!.q = [...Q[0]!];
  }
}
function attack(s: RoomState, p: PublicPlayer, q: PublicPlayer): boolean {
  const ap = q.augment!,
    shield = ap.items.find((i) => i.id === "shield" && i.remaining > 0),
    reflect = ap.items.find(
      (i) =>
        i.id === "reflect" &&
        !goldDisabled(q, "reflect") &&
        i.usedRound !== s.augment!.round,
    );
  if (shield) {
    shield.remaining--;
    note(s, `${q.nickname} · 소형 방패로 방어!`);
    effectResult(s, `${q.nickname} · 소형 방패로 공격 무효!`);
    return false;
  }
  if (reflect) {
    reflect.usedRound = s.augment!.round;
    const used =
        p.augment!.roundIncome[`damage:${s.augment!.turn.serial}`] ?? 0,
      damage = Math.min(5, 10 - used, playerTotals(p).total);
    p.augment!.bonus -= damage;
    p.augment!.roundIncome[`damage:${s.augment!.turn.serial}`] = used + damage;
    note(s, `${q.nickname} · 반사! ${p.nickname} -${damage}`);
    effectResult(
      s,
      `${q.nickname} · 반사 방패로 공격 무효! ${p.nickname} -${damage}`,
    );
    return false;
  }
  return true;
}
export function useAugment(
  s: RoomState,
  p: PublicPlayer,
  c: AugmentCommand,
  random: Random,
) {
  if (c.op !== "use") return executeAugment(s,p,c,random);
  const id=c.id??"", def=AUGMENTS.find(d=>d.id===(id==="loanDouble"?"loan":id));
  const event=EVENTS.find(e=>e.id===id);
  const targets=(def?.flash || MISCHIEF_IDS.includes(id))
    ? flashTargets(s,p,c).map(({q})=>q)
    : [["taste","thief","lock","seal","duel","swap","doppel"].includes(id)
      ? s.players.find(q=>q?.id===c.target)??p : p];
  const beforeDice=[...s.dice], keys=new Set(s.augment!.results.map(r=>r.key));
  const oldCurses=new Map(targets.map(q=>[q.id,JSON.stringify(q.augment?.curse)]));
  const exchangeState=()=>JSON.stringify(targets.map(q=>[q.scores,q.augment?.scoreSwapped,q.augment?.items.map(i=>i.id)]));
  const beforeExchange=exchangeState();
  executeAugment(s,p,c,random);
  const outcomes=s.augment!.results.filter(r=>!keys.has(r.key)).map(r=>r.text);
  const reserved=targets.filter(q=>q.augment?.curse?.id===id && JSON.stringify(q.augment.curse)!==oldCurses.get(q.id));
  const changes=s.dice.flatMap((n,i)=>n!==null&&beforeDice[i]!==null&&n!==beforeDice[i]?[`${i+1}번 주사위 ${beforeDice[i]} → ${n}`]:[]);
  const blocked=outcomes.some(t=>/공격 무효|반사|불발|무산/.test(t));
  const exchanged=beforeExchange!==exchangeState();
  const kind: NonNullable<AugmentState["results"][number]["activation"]>["kind"]=
    blocked && !reserved.length && !exchanged ? "defense" :
    ["swap","doppel","closed","strike","goldRush"].includes(id) ? "swap" :
    ["loan","loanDouble","devil","bomb","duel","squid"].includes(id) ? "gamble" :
    reserved.length || targets.some(q=>q.id!==p.id) && id!=="taste" ? "attack" :
    changes.length || s.augment!.turn.reroll || ["fork","cat","memory","tomorrow"].includes(id) ? "dice" : "score";
  const effect=[
    ...outcomes,
    ...(reserved.length?[`${reserved.map(q=>q.nickname).join(" · ")}의 다음 자기 턴에 적용 예정.`]:[]),
    ...changes,
    ...(id==="bounty" ? [`수배한 눈: ${c.value}`] : []),
    ...(["broken","swap","doppel"].includes(id) && c.other ? [`대상 능력: ${AUGMENTS.find(d=>d.id===c.other)?.name??c.other}`] : []),
    ...(id==="tomorrow" ? [`다음 내 턴에 꺼낼 눈: ${p.augment!.savedFace}`] : []),
    ...(["target","erase","parallel","strike","closed"].includes(id) && c.category && SCORE_CATEGORIES.includes(c.category as ScoreCategory)?[`선택한 점수칸: ${SCORE_LABELS[c.category as ScoreCategory]}`]:[]),
    ...((!blocked || reserved.length || exchanged) && id!=="loanDouble" ? [`능력 규칙 · ${def?.description??event?.description??""}`] : []),
  ].filter(Boolean).join("\n");
  const activation={id,actor:p.nickname,targets:targets.map(q=>q.nickname),name:id==="loanDouble"?"판돈 두 배":def?.name??event?.name??id,effect,kind,rarity:def?.rarity??"silver" as const,flash:!!def?.flash};
  const text=`${activation.actor} → ${activation.targets.join(" · ")} | ${activation.name}\n${effect}`;
  effectResult(s,text);
  s.augment!.results.at(-1)!.activation=activation;
  if(s.augment!.log.at(-1)?.endsWith("발동!")) s.augment!.log.pop();
  note(s,text);
}
function executeAugment(
  s: RoomState,
  p: PublicPlayer,
  c: AugmentCommand,
  random: Random,
) {
  const a = s.augment!,
    ap = p.augment!,
    t = a.turn;
  if (c.op === "pick" || c.op === "refresh") {
    if (!a.drafting || !ap.offers.length)
      throw Error("증강 선택 시간이 아닙니다.");
    if (c.op === "refresh") {
      const index = c.offerIndex;
      if (
        index === undefined ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= ap.offers.length ||
        ap.offers[index] !== c.id
      )
        throw Error("교체할 증강 카드의 리롤 버튼을 눌러주세요.");
      if (ap.rerolled[index])
        throw Error("이 카드는 이미 리롤했어요. 카드마다 한 번씩만 가능해요.");
      const previous = AUGMENTS.find((d) => d.id === ap.offers[index])!;
      const excluded = [...ap.seenOffers, ...ap.offers];
      const pool = previous.flash
        ? AUGMENTS.filter(
            (d) =>
              d.flash &&
              d.rarity === previous.rarity &&
              !countAugment(p, d.id) &&
              !excluded.includes(d.id) &&
              flashEligible(s, p, d.id),
          )
        : offerPool(s, p, excluded);
      if (!pool.length)
        throw Error(
          "지금 교체할 수 있는 다른 증강이 없어요. 리롤은 소모되지 않았어요.",
        );
      const next = pool[random(pool.length)]!.id;
      ap.offers[index] = next;
      ap.rerolled[index] = true;
      ap.seenOffers = [...new Set([...excluded, next])];
      return;
    }
    if (c.id === "evolution" && a.round === 7 && countAugment(p, "nudge"))
      ap.items = ap.items.filter((i) => i.id !== "nudge");
    else if (!c.id || !ap.offers.includes(c.id))
      throw Error("제시된 증강을 선택하세요.");
    const def = AUGMENTS.find((d) => d.id === c.id)!;
    ap.items.push({
      id: def.id,
      remaining: def.charges,
      usedTurn: -1,
      usedRound: -1,
    });
    ap.offers = [];
    note(s, `${p.nickname} · ${def.name} 획득`);
    finishDraft(s);
    return;
  }
  if (
    (a.drafting
      ? !(c.op === "use" && c.id === pendingInstant(p))
      : s.currentPlayerId !== p.id) ||
    s.rollPhase !== "idle"
  )
    throw Error("자기 차례에 주사위가 멈춘 뒤 사용하세요.");
  if (c.op === "resolve") {
    const forkChoice = t.pending === "forkChoice";
    resolveChoice(s, p, c, random, {
      change,
      restore,
      snapshot,
      result: effectResult,
    });
    if (forkChoice) afterAugmentRoll(s, random);
    return;
  }
  if (t.pending || t.fork) throw Error("진행 중인 결과 선택을 마쳐주세요.");
  if (t.flags.includes("loanDoublePending")) throw Error("두 배 승부의 일반 굴림을 먼저 완료해주세요.");
  if (c.op === "keepOld") {
    if (!t.chooseOld) throw Error("선택할 결과가 없습니다.");
    if (c.value === 1) change(s, t.chooseOld.index, t.chooseOld.old);
    t.chooseOld = null;
    return;
  }
  if (c.op === "world") {
    if (!t.oldWorld) throw Error("선택할 세계가 없습니다.");
    if (c.value === 1) restore(s, t.oldWorld);
    t.oldWorld = null;
    t.flags.push("final");
    return;
  }
  if (t.reroll) throw Error("진행 중인 무료 재굴림을 먼저 완료하세요.");
  if (t.chooseOld) throw Error("먼저 이전 눈과 새 눈 중 하나를 선택하세요.");
  const id = c.id ?? "",
    event = EVENTS.some((e) => e.id === id) && a.event === id;
  if (id === "loanDouble") {
    if (!t.flags.includes("loan") || t.flags.includes("loanDouble") || t.flags.includes("loanDoublePending") || t.flags.includes("final") || s.rollCount !== 2 || s.rollCount >= t.maxRolls || s.held.every(Boolean) || t.oldWorld || goldDisabled(p,"loan"))
      throw Error("대출 선언 뒤 두 번째 일반 굴림을 마치고, 다시 굴릴 주사위와 횟수가 있어야 해요.");
    t.flags.push("loanDoublePending");
    prepareAugmentRoll(s,random);
    s.rollPhase="shaking";
    effectResult(s, `${p.nickname} · 판돈 두 배! 25점 이상 +40 / 실패 -20. 한 번 더 던지세요!`);
    return;
  }
  const item = [...ap.items]
    .sort(
      (a, b) =>
        Number(b.borrowedAt !== undefined) - Number(a.borrowedAt !== undefined),
    )
    .find(
      (i) =>
        i.id === id &&
        !goldDisabled(p, id) &&
        (i.remaining !== 0 ||
          AUGMENTS.find((d) => d.id === id)?.charges === 0) &&
        i.usedTurn !== t.serial,
    );
  const def = AUGMENTS.find((d) => d.id === id);
  if (event) {
    if (t.flags.includes(id))
      throw Error("이번 사건 능력을 이미 사용했습니다.");
  } else if (!item || !def || def.trigger !== "active")
    throw Error("사용 가능한 능력이 아닙니다.");
  const before = [
    "memory",
    "target",
    "loan",
    "devil",
    "revive",
    "bomb",
    "debt",
  ].includes(id);
  if (before && s.rollCount) throw Error("첫 굴림 전에 선언하세요.");
  if (
    id !== "fork" &&
    !def?.flash &&
    !MISCHIEF_IDS.includes(id) &&
    !before &&
    !["thief", "lock", "seal", "swap", "doppel", "duel"].includes(id) &&
    !s.rollCount
  )
    throw Error("먼저 주사위를 굴려주세요.");
  const changes = [
    "collector",
    "artisan",
    "fakeHouse",
    "taste",
    "fork",
    "nudge",
    "evolution",
    "mirror",
    "flip",
    "clone",
    "alchemy",
    "wild",
    "worldFlip",
    "reverse",
    "choiceRoll",
    "even",
    "chaos",
    "exchange",
    "cat",
  ];
  if ((t.saveIndex != null || t.hostage) && changes.includes(id))
    throw Error("저장·인질 예약 후에는 눈을 변경할 수 없어요.");
  if (t.flags.includes("wild") && changes.includes(id))
    throw Error("와일드 지정 후에는 눈을 바꿀 수 없습니다.");
  if (
    t.flags.includes("final") &&
    ["collector", "fork", "choiceRoll", "even", "chaos", "exchange", "cat"].includes(id)
  )
    throw Error("최종 단계에서는 다시 굴릴 수 없습니다.");
  const die = c.die ?? -1;
  if ((id === "chance" && t.flags.includes("substitute")) ||
      (id === "substitute" && t.flags.includes("chance")))
    throw Error("환전과 족보 대체는 함께 사용할 수 없어요.");
  const validDie = () => {
    if (die < 0 || die >= s.dice.length || s.dice[die] === null)
      throw Error("주사위를 선택하세요.");
  };
  const category = () => {
    if (!SCORE_CATEGORIES.includes(c.category as ScoreCategory))
      throw Error("족보를 선택하세요.");
    return c.category as ScoreCategory;
  };
  if (["tomorrow", "hostage"].includes(id) && t.oldWorld)
    throw Error("원래 결과와 다시 굴린 결과 중 하나를 먼저 골라주세요.");
  if (id === "tomorrow") {
    validDie();
    if (s.dice[die]! > 3 || ap.savedFace != null || filled(p) >= 11)
      throw Error("다음 턴이 있고 저장 슬롯이 비어 있을 때 1~3을 저장하세요.");
    ap.savedFace = 7 - s.dice[die]!;
  } else if (id === "taste") {
    const q = alive(s).find((q) => q.id === c.target && q.id !== p.id);
    validDie();
    if (
      s.rollCount !== 1 ||
      t.flags.includes("faceChanged") ||
      !q?.augment?.lastDice?.includes(c.value ?? 0)
    )
      throw Error("첫 굴림 직후, 상대의 직전 확정 눈을 고르세요.");
    change(s, die, c.value!);
  } else if (id === "memory") {
    const remembered = ap.archive?.[c.historyIndex ?? -1]?.dice;
    if (!remembered || s.held.some(Boolean))
      throw Error(
        "과거 기록을 고르세요. 미리 보관한 주사위가 있으면 사용할 수 없어요.",
      );
    const copied = Math.min(5, remembered.length, s.dice.length);
    for (let i = 0; i < copied; i++) {
      change(s, i, remembered[i]!);
      s.held[i] = true;
    }
    if (s.dice.length === copied) {
      s.rollCount = 1;
      s.held.fill(false);
      afterAugmentRoll(s, random);
    } else t.flags.push("memoryFirst");
  } else if (id === "fork") {
    if (
      !s.rollCount &&
      ap.curse?.active &&
      ["dropIt", "receipt", "practice", "hostage", "lock"].includes(ap.curse.id)
    )
      throw Error("첫 굴림의 방해를 먼저 해결한 뒤 A/B 굴림을 사용하세요.");
    if (
      t.oldWorld ||
      s.rollCount >= t.maxRolls ||
      (s.rollCount > 0 && s.held.every(Boolean))
    )
      throw Error("남은 일반 굴림이 필요해요.");
    t.fork = { start: snapshot(s) };
  } else if (def?.flash || MISCHIEF_IDS.includes(id)) {
    if (id === "bounty" && (!c.value || c.value > 6))
      throw Error("수배할 숫자를 고르세요.");
    if (id === "misdelivery") {
      validDie();
      if (!s.rollCount || t.flags.includes("final") || t.flags.includes("wild"))
        throw Error("주사위를 굴린 뒤, 최종 확정 전에 사용하세요.");
      if (t.sealed?.includes(die))
        throw Error("봉인된 주사위는 바꿀 수 없어요.");
    }
    const targets = flashTargets(s, p, c);
    if (id === "closed") {
      const q = targets[0]!.q,
        key = c.category as ScoreCategory;
      if (attack(s, p, q)) {
        const mine = p.scores[key]!,
          theirs = q.scores[key]!;
        p.scores[key] = theirs;
        q.scores[key] = mine;
        q.augment!.scoreSwapped = true;
        effectResult(
          s,
          `${p.nickname} ↔ ${q.nickname} · 성적표 맞바꿔치기! ${mine}점 ↔ ${theirs}점`,
        );
      }
    } else if (id === "strike") {
      const accepted=targets.filter(({q})=>q.id===p.id||attack(s,p,q));
      if(accepted.length<2) effectResult(s,"회전목마 불발! 방패로 참가자가 부족해졌어요.");
      else {
        const key=c.category as ScoreCategory, values=accepted.map(({q})=>q.scores[key]!);
        const direction=random(2)===0?1:-1;
        accepted.forEach(({q},i)=>{q.scores[key]=values[(i-direction+values.length)%values.length]!;q.augment!.scoreSwapped=true;});
        effectResult(s,`점수표 회전목마 · ${SCORE_LABELS[key]} · ${direction===1?"정방향":"역방향"} | ${accepted.map(({q},i)=>`${q.nickname} ${values[i]} → ${q.scores[key]}점`).join(" / ")}`);
      }
    } else if (id === "squid") {
      const accepted=targets.filter(({q})=>q.id===p.id||attack(s,p,q));
      if(accepted.length<2) effectResult(s,"공동 승부 불발! 참가자가 부족해 판돈은 받지 않았어요.");
      else {
        a.jackpot={after:t.serial,pot:accepted.length*20,entries:accepted.map(({q})=>({id:q.id,score:null}))};
        for(const {q} of accepted){q.augment!.bonus-=20;q.augment!.curse={id,from:p.id,active:false};}
        effectResult(s,`판돈은 목숨입니다! ${accepted.map(({q})=>q.nickname).join(" · ")} 각 -20점 납부 | 우승 지급액 ${a.jackpot.pot+40}점`);
      }
    } else if (id === "goldRush") {
      const accepted = targets.filter(
        ({ q }) => q.id === p.id || attack(s, p, q),
      );
      if (accepted.length >= 2) {
        const chosen = accepted.map(({ q }) => {
          const pool = availableGold(q);
          return pool[random(pool.length)]!;
        });
        accepted.forEach(({ q }, i) => {
          const incoming = chosen[(i + chosen.length - 1) % chosen.length]!;
          q.augment!.items[q.augment!.items.indexOf(chosen[i]!)] = incoming;
        });
        effectResult(
          s,
          `골드 대이동! ${accepted.map(({ q }, i) => `${q.nickname}: ${AUGMENTS.find((d) => d.id === chosen[(i + chosen.length - 1) % chosen.length]!.id)!.name}`).join(" / ")}`,
        );
      } else
        effectResult(
          s,
          "골드 대이동 무산! 방패로 막혀 교환할 사람이 부족해요.",
        );
    } else
      for (const { q, categories, other } of targets) {
        if (q.id !== p.id && !attack(s, p, q)) continue;
        let blocked = categories;
        if (id === "construction") {
          const pool = SCORE_CATEGORIES.filter((k) => q.scores[k] === null),
            allowed: string[] = [];
          for (let n = 0; n < 3; n++)
            allowed.push(pool.splice(random(pool.length), 1)[0]!);
          blocked = pool;
        }
        q.augment!.curse = {
          id,
          from: p.id,
          active: false,
          categories: blocked,
          other: id === "bounty" ? String(c.value) : other,
          values:
            id === "hostage"
              ? [1, 1, 1]
              : id === "misdelivery"
                ? [s.dice[die]!]
                : undefined,
        };
        if (id === "broken")
          ap.items.push({
            id: other!,
            remaining: 1,
            usedTurn: -1,
            usedRound: -1,
            borrowedAt: t.serial,
          });
        if (id === "misdelivery") change(s, die, c.value!);
      }
    if (id === "dinner") {
      ap.bonus += 3;
      effectResult(s, `${p.nickname} · 회식 보너스 +3점 지급 완료`);
    }
    if (id === "confiscate") {
      const count = alive(s).filter(
        (q) =>
          q.id !== p.id &&
          q.augment!.curse?.id === id &&
          q.augment!.curse.from === p.id,
      ).length;
      if (count) ap.curse!.other = String(count);
      else ap.curse = null;
      effectResult(
        s,
        `${p.nickname} · 주사위 ${count}개 압수! 다음 내 턴에 ${count}개 더 굴려요.`,
      );
    }
    if (flashGlobal.includes(id))
      for (const q of alive(s))
        if (!targets.some((x) => x.q.id === q.id))
          note(s, `${q.nickname} · 기존 방해가 있어 난장판 제외`);
  } else if (
    [
      "nudge",
      "evolution",
      "mirror",
      "flip",
      "clone",
      "alchemy",
      "wild",
      "reverse",
    ].includes(id)
  ) {
    validDie();
    let value = c.value ?? 0;
    if (
      ["nudge", "evolution"].includes(id) &&
      Math.abs(value - s.dice[die]!) > (id === "evolution" ? 2 : 1)
    )
      throw Error("보정 범위를 벗어났습니다.");
    if (["mirror", "flip", "reverse"].includes(id)) value = 7 - s.dice[die]!;
    if (id === "clone") {
      const source = c.value ?? -1;
      if (source === die || !s.dice[source])
        throw Error("복사할 다른 주사위를 선택하세요.");
      value = s.dice[source]!;
    }
    change(s, die, value);
    if (["wild", "reverse"].includes(id)) t.flags.push("final");
  } else if (id === "artisan") {
    validDie();
    if (s.dice.filter((n) => n === s.dice[die]).length < 2 || s.dice.includes(c.value ?? 0))
      throw Error("중복된 주사위를 지금 없는 숫자로 바꿔주세요.");
    const old = s.dice[die];
    change(s, die, c.value ?? 0);
    effectResult(s, `${p.nickname} · 밀수 성공! ${old} → ${c.value}`);
  } else if (id === "fakeHouse") {
    const indices = [...(c.indices ?? [])].sort((a, b) => a - b);
    if (indices.length !== 2 || indices[0] === indices[1] ||
        indices.some((i) => !Number.isInteger(i) || i < 0 || i >= s.dice.length || !s.dice[i] || t.sealed?.includes(i)))
      throw Error("변경할 수 있는 주사위 두 개를 골라주세요.");
    const [i, j] = indices as [number, number];
    const sum = s.dice[i]! + s.dice[j]!;
    const low = Math.floor(sum / 2), high = Math.ceil(sum / 2);
    if (s.dice[i] === low && s.dice[j] === high)
      throw Error("이미 나눠 가진 눈이에요. 다른 조합을 골라주세요.");
    change(s, i, low);
    change(s, j, high);
    effectResult(s, `${p.nickname} · 강제 입주! ${low} + ${high}`);
  } else if (id === "chance") {
    if (!SCORE_CATEGORIES.slice(6).some((k) => p.scores[k] === null && !blockedCategory(p, k)))
      throw Error("환전할 수 있는 빈 하단 칸이 없어요.");
    t.flags.push("final");
    effectResult(s, `${p.nickname} · 환전 준비! 점수표에서 빈 하단 칸을 골라주세요.`);
  } else if (id === "worldFlip") {
    const indices = c.indices ?? [];
    if (
      !indices.length ||
      new Set(indices).size !== indices.length ||
      indices.some((i) => i >= s.dice.length)
    )
      throw Error("뒤집을 주사위를 선택하세요.");
    for (const i of indices) change(s, i, 7 - s.dice[i]!);
    t.flags.push("final");
  } else if (["collector", "choiceRoll", "even", "chaos", "exchange"].includes(id)) {
    validDie();
    if (id === "collector" && s.dice.filter((n) => n === s.dice[die]).length < 2)
      throw Error("같은 눈이 둘 이상인 주사위를 골라주세요.");
    if (id === "even" && s.dice[die] !== 1)
      throw Error("1이 나온 주사위만 반품할 수 있어요.");
    if (id === "exchange" && s.rollCount < 2)
      throw Error("두 번째 굴림 이후 사용하세요.");
    if (t.locked === die || t.fixed?.includes(die))
      throw Error("강제 고정된 주사위는 굴릴 수 없습니다.");
    t.reroll = { id, index: die, old: s.dice[die]!, held: [...s.held] };
    s.held = s.held.map((_, i) => i !== die);
    s.rollPhase = "shaking";
  } else if (id === "target") {
    const key = category();
    if (p.scores[key] !== null) throw Error("미사용 족보를 선택하세요.");
    t.target = key;
  } else if (id === "revive") {
    if (!ap.previousZero)
      throw Error("직전 턴 기본 점수가 0점일 때 사용합니다.");
    if (die < 0 || die >= s.dice.length) throw Error("주사위를 선택하세요.");
    change(s, die, c.value ?? 0);
    s.held[die] = true;
  } else if (id === "debt") {
    if (ap.curse?.active && ap.curse.id === "squid")
      throw Error("오징어게임에서는 일반 굴림을 늘릴 수 없어요.");
    if (
      a.duels.some(
        (d) =>
          t.serial > d.after &&
          d.accepted && ((d.a === p.id && d.aScore === null) ||
            (d.b === p.id && d.bScore === null)),
      )
    )
      throw Error("결투 중에는 일반 굴림을 늘릴 수 없습니다.");
    t.maxRolls++;
    t.extra -= 8;
  } else if (id === "cat") {
    if (t.maxRolls <= 1 || !t.first || s.rollCount < t.maxRolls || t.oldWorld)
      throw Error("마지막 일반 굴림 후 사용하세요.");
    t.oldWorld = snapshot(s);
    restore(s, t.first);
  } else if (id === "erase") {
    const zeros = SCORE_CATEGORIES.filter((k) => p.scores[k] === 0);
    if (!zeros.length) t.erase = "bonus";
    else {
      const key = category();
      if (!zeros.includes(key)) throw Error("기존 0점 칸을 선택하세요.");
      t.erase = key;
    }
  } else if (id === "parallel") {
    if (SCORE_CATEGORIES.filter((k) => p.scores[k] === null).length < 2)
      throw Error("평행 채점에는 빈 족보가 2개 이상 필요해요.");
    const key = category();
    if (p.scores[key] !== null) throw Error("미사용 족보를 선택하세요.");
    if (blockedCategory(p, key)) throw Error("이번 턴 봉인된 족보예요.");
    t.parallel = key;
  } else if (["thief", "lock", "seal", "duel", "swap", "doppel"].includes(id)) {
    const q = alive(s).find((q) => q.id === c.target && q.id !== p.id);
    if (!q || filled(q) >= 12) throw Error("남은 턴이 있는 상대를 선택하세요.");
    if (["thief", "lock", "seal", "duel"].includes(id) && q.augment!.curse)
      throw Error("상대에게 이미 예약된 방해가 있습니다.");
    if (id === "duel") {
      if (
        filled(p) >= 11 ||
        a.duels.some(
          (d) => [d.a, d.b].includes(p.id) || [d.a, d.b].includes(q.id),
        )
      )
        throw Error("다음 턴이 없거나 이미 결투 중입니다.");
      if (attack(s, p, q)) {
        a.duels.push({
          a: p.id,
          b: q.id,
          aScore: null,
          bScore: null,
          after: t.serial,
          accepted: false,
        });
        q.augment!.curse = { id, from: p.id };
      }
    } else if (id === "swap" || id === "doppel") {
      const theirs = availableGold(q).find((i) => i.id === c.other);
      if (!theirs) throw Error("상대의 사용 가능한 골드를 선택하세요.");
      if (id === "doppel") {
        if (AUGMENTS.find((d) => d.id === theirs.id)!.charges > 0)
          throw Error("지속형 골드만 복제할 수 있습니다.");
        ap.items.push({ ...theirs, usedTurn: -1, usedRound: -1 });
      } else {
        const mine = availableGold(p).find((i) => i.id === c.category);
        if (!mine || countAugment(p, theirs.id) || countAugment(q, mine.id))
          throw Error("중복되지 않는 교환 가능한 내 골드를 선택하세요.");
        if (attack(s, p, q)) {
          ap.items[ap.items.indexOf(mine)] = theirs;
          q.augment!.items[q.augment!.items.indexOf(theirs)] = mine;
        }
      }
    } else if (attack(s, p, q)) q.augment!.curse = { id, from: p.id };
  } else if (!["loan", "devil", "bomb", "substitute"].includes(id))
    throw Error("지원하지 않는 능력입니다.");
  if (item) {
    if (item.remaining > 0) item.remaining--;
    if (
      def?.charges === -1 ||
      [
        "nudge",
        "clone",
        "evolution",
        "even",
        "tomorrow",
        "taste",
        "fork",
        "collector",
        "artisan",
        "fakeHouse",
      ].includes(id)
    )
      item.usedTurn = t.serial;
  }
  if (a.drafting) finishDraft(s);
  t.flags.push(id);
  note(
    s,
    `${p.nickname} · ${def?.name ?? EVENTS.find((e) => e.id === id)?.name} 발동!`,
  );
}
export function afterAugmentRoll(s: RoomState, random: Random) {
  const a = s.augment!,
    t = a.turn,
    p = alive(s).find((p) => p.id === s.currentPlayerId)!;
  const curse = p.augment!.curse;
  if (
    curse?.active &&
    curse.id === "receipt" &&
    curse.die !== undefined &&
    !curse.resolved &&
    s.rollCount > 1 &&
    !s.held[curse.die]
  ) {
    curse.resolved = true;
    const source = alive(s).find((q) => q.id === curse.from);
    if (source) source.augment!.bonus += 3;
    effectResult(
      s,
      `${p.nickname} · 주사위 폭발! ${source?.nickname ?? "시전자"} +3점`,
    );
  }
  if (t.fork) {
    if (!t.fork.first) {
      t.fork.first = snapshot(s);
      t.pending = "forkSecond";
      return;
    }
    t.pending = "forkChoice";
    return;
  }
  if (t.flags.includes("memoryFirst")) {
    s.held.fill(false);
    t.flags = t.flags.filter((f) => f !== "memoryFirst");
  }
  if (t.reroll) {
    const r = t.reroll;
    s.rollCount--;
    s.held = r.held;
    if (r.id === "choiceRoll" && s.dice[r.index] !== r.old)
      t.chooseOld = { index: r.index, old: r.old };
    if (r.id === "exchange") t.extra += 8;
    if (r.id === "chaos") t.flags.push("final");
    t.kept = t.kept.filter((i) => i !== r.index);
    t.flags.push(`rerolled:${r.index}`, "faceChanged");
    t.reroll = null;
    if (r.id === "practice") {
      t.first = snapshot(s);
      t.kept = [];
    }
    return;
  }
  if (p.augment!.curse?.active && p.augment!.curse!.id === "construction") {
    const pool = SCORE_CATEGORIES.filter((k) => p.scores[k] === null);
    for (let n = 0; n < 3 && pool.length; n++) pool.splice(random(pool.length), 1);
    p.augment!.curse!.categories = pool;
    effectResult(s, `${p.nickname}: ${SCORE_CATEGORIES.filter((k) => p.scores[k] === null && !pool.includes(k)).map((k) => SCORE_LABELS[k]).join(" / ")}`);
  }
  if(t.flags.includes("loanDoublePending") && s.rollCount>=3){
    t.flags=t.flags.filter(f=>f!=="loanDoublePending");
    t.flags.push("loanDouble");
  }
  if(t.flags.includes("mixerPending") && s.rollCount>=2){
    t.flags=t.flags.filter(f=>f!=="mixerPending");
    t.flags.push("mixer");
  }
  if (s.rollCount === 1) {
    if (
      p.augment!.curse?.id === "dropIt" &&
      !t.flags.includes("bananaApplied")
    ) {
      const highest = Math.max(...s.dice.map((n) => n ?? 0));
      const indices = s.dice.flatMap((n, i) => (n === highest ? [i] : []));
      const index = indices[random(indices.length)]!;
      change(s, index, 1);
      t.flags.push("bananaApplied");
      effectResult(
        s,
        `${p.nickname} · 바나나 껍질! ${index + 1}번 주사위 ${highest} → 1`,
      );
    }
    if (p.augment!.curse?.id === "lock") {
      t.locked = random(s.dice.length);
      s.held[t.locked] = true;
    }
    t.first = snapshot(s);
    if (curse?.active && curse.id === "receipt" && curse.die === undefined) {
      curse.die = random(s.dice.length);
      effectResult(
        s,
        `${p.nickname} · ${curse.die + 1}번에 폭탄! 다시 굴리면 상대 +3점, 그대로 기록하면 내 점수 -4점`,
      );
    }
    if (curse?.active && curse.id === "practice" && !curse.resolved) {
      curse.resolved = true;
      const highest = Math.max(...s.dice.map((n) => n!)),
        indices = s.dice.flatMap((n, i) => (n === highest ? [i] : [])),
        index = indices[random(indices.length)]!;
      t.reroll = {
        id: "practice",
        index,
        old: s.dice[index]!,
        held: [...s.held],
      };
      s.held = s.held.map((_, i) => i !== index);
      s.rollPhase = "shaking";
      effectResult(
        s,
        `${p.nickname} · 방금 건 연습! ${index + 1}번을 자동으로 다시 굴려요.`,
      );
    }
    if (p.augment!.curse?.active && p.augment!.curse.id === "hostage") {
      if (s.dice.length - (t.preheld?.length ?? 0) < 3) {
        effectResult(s, `${p.nickname} · 악마의 택배 무효: 봉인할 주사위가 3개 미만이에요.`);
        p.augment!.curse = null;
      }
      else t.pending = "hostage";
    }
  }
  if (s.rollCount > 1 && !s.held.some(Boolean) && !t.flags.includes("allIn"))
    t.flags.push("allIn");
  if (s.rollCount === 3) t.flags.push("third");
}

export function prepareAugmentRoll(s: RoomState, random: Random) {
  const t = s.augment!.turn,
    p = s.players.find((p) => p?.id === s.currentPlayerId)!,
    curse = p.augment!.curse;
  if (
    s.rollCount !== 1 ||
    t.reroll ||
    !["inspection", "handsUp"].includes(curse?.id ?? "") ||
    !curse?.active ||
    curse.resolved
  )
    return;
  const pool = s.held.flatMap((v, i) =>
      v && t.locked !== i && !t.fixed?.includes(i) ? [i] : [],
    ),
    taken: number[] = [];
  const limit = curse.id === "handsUp" ? pool.length : 2;
  if (curse.id === "handsUp") t.flags.push("mixerPending");
  for (let n = 0; n < limit && pool.length; n++) {
    const i = pool.splice(random(pool.length), 1)[0]!;
    s.held[i] = false;
    taken.push(i);
  }
  curse.resolved = true;
  t.kept = t.kept.filter((i) => !taken.includes(i));
  if (t.fork)
    t.fork.start = { ...t.fork.start, held: [...s.held], kept: [...t.kept] };
  effectResult(
    s,
    `${p.nickname} · ${curse.id === "handsUp" ? "전원 믹서기 입장" : "보관함 털이"}! ${taken.length ? taken.map((i) => i + 1).join("·") + "번도 다시 굴려요!" : "보관한 주사위가 없어요"}`,
  );
}
