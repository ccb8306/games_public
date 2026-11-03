import { resolveChoice, transfer } from "./augment-choices.js";
import {captureAugmentFeedback,attachAugmentFeedback} from './augment-feedback.js';
import {NOVEL_IDS,D12,estateReward,novelStart,novelRecord,turnsLeft,physicalFaces,monsterIndex} from './novelty.js';
import {
  flashGlobal,
  flashTargets,
  flashEligible,
  goldDisabled,
  blockedCategory,
} from "./flash.js";
import {
  AUGMENTS,
  FLASH_CHANCE,
  MISCHIEF_IDS,
  EVENTS,
  newAugmentPlayer,
  canTradeGold,
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
    key: `${s.roomId}:${s.revision}:${s.augment!.resultSerial=(s.augment!.resultSerial??0)+1}`,
    text,
    payouts,
  });
  s.augment!.results = s.augment!.results.slice(-40);
}
function chargeTariff(s:RoomState,p:PublicPlayer,id:string){
 const curse=p.augment?.curse,def=AUGMENTS.find(d=>d.id===id);
 if(!curse?.active||curse.id!=="ordinaryDay"||!def||def.rarity==="silver"||id==="ordinaryDay"||curse.triggered?.includes(id))return;
 const source=alive(s).find(q=>q.id===curse.from);if(!source)return;
 (curse.triggered??=[]).push(id);
 const paid=transfer(s,p,source,Math.min(5,Math.max(0,25-(curse.paid??0))),25);curse.paid=(curse.paid??0)+paid;
 effectResult(s,`${p.nickname} → ${source.nickname} · ${def.name} 작동 통행료 ${paid}점 납부 · 총 ${curse.paid}/25점`);
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
  return p.augment!.items.filter(canTradeGold);
}
export const pendingInstant = (p: PublicPlayer) =>
  p.augment?.items.find(
    (i) => ["swap", "doppel", "estate"].includes(i.id) && i.remaining > 0 && (i.id!=="estate" || !p.augment?.estate),
  )?.id;
function finishDraft(s: RoomState) {
  for (const p of alive(s)) {
    const pending = pendingInstant(p);
    if (!pending) continue;
    if(pending==='customDie'||pending==='estate')continue;
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
      !d.flash && !d.retired && (d.id!=="chance" || SCORE_CATEGORIES.slice(6).some(k=>p.scores[k]===null)) && (d.id!=="defect" || SCORE_CATEGORIES.slice(7).some(k=>p.scores[k]===null)) && (!["devil","loan"].includes(d.id) || SCORE_CATEGORIES.some((k,i)=>p.scores[k]===null && (i<6?(i+1)*(6+countAugment(p,"sixth")+(countAugment(p,"confiscate")?Math.max(2,alive(s).length-1):0)):k==="smallStraight"?15:30)>=(d.id==="devil"?20:25))) && (d.id !== "scoreRemodel" || SCORE_CATEGORIES.slice(6).some(k=>p.scores[k]!==null) && SCORE_CATEGORIES.slice(6).some(k=>p.scores[k]===null)) &&
      d.rarity === rarity &&
      !countAugment(p, d.id) &&
      !exclude.includes(d.id) &&
      d.id !== "evolution",
  );
  pool=pool.filter(d=>d.id!=='estate'||turnsLeft(p)>=3);
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
export function drawAugmentOffers(s: RoomState, p: PublicPlayer, random: Random) {
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
  const wonFlash = random(100) < (FLASH_CHANCE[s.augment!.round]??0);
  if (wonFlash) {
    const eligible = AUGMENTS.filter(
      (d) =>
        d.flash &&
        d.rarity === rarity &&
        !countAugment(p, d.id) &&
        flashEligible(s, p, d.id),
    );
    const choices = eligible;
    if (choices.length) result.push(choices[random(choices.length)]!.id);
  }
  p.augment!.flashOffer = result.length===4;
  p.augment!.offers = result;
  p.augment!.rerolled = result.map(()=>false);
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
  if (a.drafting) for (const p of alive(s)) drawAugmentOffers(s, p, random);
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
  p.augment!.customFaces=undefined;
  if (["bombParcel", "thief", "duel"].includes(p.augment!.curse?.id ?? "")) t.pending = p.augment!.curse!.id as "bombParcel" | "thief" | "duel";
  t.gap =
    Math.max(...alive(s).map((p) => playerTotals(p).total)) -
    playerTotals(p).total;
  if(t.gap>0 && playerTotals(p).total===Math.min(...alive(s).map(q=>playerTotals(q).total)))t.flags.push("lastPlace");
  t.maxRolls = Math.max(
    1,
    3 +
      countAugment(p, "fourth") +

      (t.gap >= 20 ? 2*(p.augment!.items.filter(i=>i.id==="loser"&&(i.uses??0)<3&&!goldDisabled(p,"loser")).length) : 0) + (p.augment!.progress?.duelRoll??0) -
      (a.event === "speed" ? 1 : 0) -
      (p.augment!.curse?.id === "seal" ? 1 : 0),
  );
  const ap = p.augment!;
  ap.progress ??= {};
  if(!a.drafting){const eligible=t.gap>=20?ap.items.filter(i=>i.id==="loser"&&(i.uses??0)<3&&!goldDisabled(p,"loser")):[];t.flags.push(`loserBonus:${eligible.length*2}`);for(const i of eligible)i.uses=(i.uses??0)+1;ap.progress.duelRoll=0;}
  if (!a.drafting && ap.items.some(i=>i.id==="rollVault")) {
    const turns=12-filled(p);
    ap.rollBank=Math.max(turns,(ap.rollBank??(turns*3+6))+t.maxRolls-3);
    t.maxRolls=Math.min(countAugment(p,"rollVault")?7:t.maxRolls,ap.rollBank-(turns-1));
  }
  if (
    a.duels.some(
      (d) =>
        d.accepted && ((d.a === p.id && d.aScore === null) ||
          (d.b === p.id && d.bScore === null)) &&
        t.serial > d.after,
    )
  )
    t.maxRolls = Math.min(2, t.maxRolls);

  if (p.augment!.curse?.id === "squid") t.maxRolls = Math.min(p.augment!.curse.from===p.id?3:2, t.maxRolls);
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
    t.fixed=[...(t.fixed??[]),index];
    t.sealed=[...(t.sealed??[]),index];
  }
  t.preheld = s.held.flatMap((v, i) => (v ? [i] : []));
  if(!a.drafting){novelStart(s,p);t.preheld=s.held.flatMap((v,i)=>v?[i]:[]);}
}
export function reconcileAugment(s: RoomState, random: Random) {
  const a = s.augment;
  if (!a || s.phase !== "playing") return;
  a.custody=a.custody?.filter(l=>alive(s).some(p=>p.id===l.a)&&alive(s).some(p=>p.id===l.b));
  for(const p of alive(s))if(p.augment!.curse?.id==='custody'&&!a.custody?.some(l=>l.a===p.id||l.b===p.id))p.augment!.curse=null;
  if(a.crown&&!a.crown.finished){a.crown.entries=a.crown.entries.filter(e=>alive(s).some(p=>p.id===e.id));if(!alive(s).some(p=>p.id===a.crown!.holder)){a.crown.holder='';a.crown.claimed=false;a.crown.threshold=25;}if(a.crown.entries.every(e=>e.left===0)){a.crown.finished=true;const holder=alive(s).find(p=>p.id===a.crown!.holder);if(holder){holder.augment!.bonus+=40;effectResult(s,`${holder.nickname} · 왕관 최종 우승 +40점 지급 완료`);}}}
  for (const p of s.players)
    if (p?.forfeited && p.augment) p.augment.curse = null;
  for(const p of alive(s))for(const item of p.augment!.items){
    if(item.id==='parasite'&&item.target&&(item.target===p.id||!alive(s).some(q=>q.id===item.target))){
      item.target=undefined;item.remaining=1;
      effectResult(s,`${p.nickname} · 스폰서가 나가서 재계약할 수 있어요. 누적 지급액은 유지됩니다.`);
    }
  }
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
      a.turn.maxRolls=Math.max(1,3+countAugment(current,"fourth")+Number(a.turn.flags.find(f=>f.startsWith("loserBonus:"))?.split(":")[1]??0)-(a.event==="speed"?1:0));
      if(current.augment!.rollBank!==undefined) a.turn.maxRolls=Math.min(countAugment(current,"rollVault")?7:a.turn.maxRolls,current.augment!.rollBank-(11-filled(current)));
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
  if (has("defect") && raw === 0) {
    const sum = dice.reduce((total, value) => total + value, 0);
    const longest = counts.reduce((result, count) => {
      result.current = count ? result.current + 1 : 0;
      result.longest = Math.max(result.longest, result.current);
      return result;
    }, { current: 0, longest: 0 }).longest;
    if (c === "fourOfAKind" && counts.some(n => n >= 3)) base = Math.floor(sum * 0.8);
    if (c === "fullHouse" && (counts.filter(n => n >= 2).length >= 2 ||
      (counts.some(n => n >= 3) && counts.filter(n => n > 0).length >= 2))) base = Math.floor(sum * 0.8);
    if (c === "smallStraight" && longest >= 3) base = 12;
    if (c === "largeStraight" && longest >= 4) base = 24;
  }
  if (
    c === "fullHouse" &&
    raw === 0 &&
    counts.some((n) => n >= 4) &&
    has("fakeHouse")
  )
    base = Math.max(base, 25);
  if (
    c === "yacht" &&
    base === 0 &&
    counts.some((n) => n >= 4) &&
    has("defect")
  )
    base = 40;
  const cashout = !!t?.flags.includes("chance") && SCORE_CATEGORIES.indexOf(c) >= 6;
  if (cashout) base = Math.min(40, dice.reduce((sum, n) => sum + n, 0) + 10);
  if (t?.flags.includes("substitute"))
    base = Math.min(
      25,
      dice.reduce((a, b) => a + b, 0),
    );

  const multiplier = Math.min(
    3,
    (t?.flags.includes("devil") ? (base >= 20 ? 1 : 0) : 1),
  );
  const score = Math.max(
    0,
    cashout ? base : Math.floor((base + enhance) * Math.min(3, multiplier)) + (t?.flags.includes("devil") && base>=20 ? Math.min(30,base) : 0),
  );
  let extra = t?.extra ?? 0;
  const reasons: string[] = [];
  const awards:Record<string,number>={};
  if (t?.extra) reasons.push(`추가 굴림·교환 정산 ${t.extra > 0 ? "+" : ""}${t.extra}점`);
  const add = (id: string, points: number) => {
    extra += points;
    if(points)awards[id]=(awards[id]??0)+points;
    if (points) reasons.push(`${AUGMENTS.find((d) => d.id === id)?.name ?? EVENTS.find((d) => d.id === id)?.name ?? id} ${points > 0 ? "+" : ""}${points}`);
  };
  if (a && t) {
    add('estate',estateReward(p,c,score>0?base:0));
    if (counts[0]! >= 2) add("cleaner", 6 * has("cleaner"));
    if (new Set(dice).size >= 5) add("artisan", 5 * has("artisan"));
    add("rest", Math.max(0, 3 - s.rollCount) * 3 * has("rest"));
    if (t.kept.length >= 2) add("stubborn", Math.min(9,Math.max(0,s.rollCount-1)*3) * has("stubborn"));
    if (dice.filter((n) => n % 2).length >= 4) add("odd", 6 * has("odd"));
    if(score>0 && t.flags.includes("allIn")) add("clockwork",Math.min(Math.max(0,36-(p.augment!.progress?.clockwork??0)),[0,4,10,18][Math.min(3,t.flags.filter(f=>f.startsWith("allInRoll:")).length)]??0)*has("clockwork"));
    const upper = SCORE_CATEGORIES.indexOf(c);
    if (score>0 && upper < 6 && counts[upper]! >= 3) add("upper", (4 + (!p.augment!.progress?.[`upper:${c}`]&&Object.keys(p.augment!.progress??{}).filter(k=>k.startsWith("upper:")).length===2 ? 12 : 0)) * has("upper"));
    if (score === 0 && (p.augment!.progress?.lower??0)<3) add("lower", 8 * has("lower"));
    const kind=Math.max(...counts);
    if(has("hunter"))for(const item of p.augment!.items.filter(i=>i.id==="hunter"))add("hunter",Math.min(Math.max(0,36-(item.earned??0)),kind>=5?12:kind===4?8:kind===3?4:0));
    add("erase",Math.min(Math.max(0,45-(p.augment!.progress?.erase??0)),Math.max(0,20-score))*has("erase"));
    if (score > 0 && p.augment!.streak >= 2 && (p.augment!.progress?.savings??0)<2)
      add("savings", 18 * has("savings"));
    if(has("parasite"))for(const contract of p.augment!.items.filter(i=>i.id==="parasite"&&i.target)){const sponsor=alive(s).find(q=>q.id===contract.target);const previous=sponsor?.augment?.progress?.lastBase??0;if(sponsor&&base>=Math.max(10,previous))add("parasite",Math.min(5,Math.max(0,40-(contract.earned??0))));}
    if (counts[5]! >= 3) add("six", 7 * has("six"));
    if (t.flags.includes("lastPlace")) add("underdog", Math.min(4,Math.max(0,20-(p.augment!.progress?.underdog??0))) * has("underdog"));
    if (t.target) add("target", t.target === c && score > 0 ? 12 : -6);
    if (t.flags.includes("loan")) add("loan", (base >= 25 ? 20 : -10) * (t.flags.includes("loanDouble") ? 2 : 1));
    if (t.flags.includes("bomb")) add("bomb", counts[5]! >= 3 ? 20 : -8);
    if (a.event === "speed" && score > 0) add("speed", 10);

    if (p.augment!.curse?.active && p.augment!.curse.id === "dinner")
      add("dinner", counts[0]!>=3 ? 10 : counts[0]! ? 5 : -5);
    if (a.event === "aid") add("aid", base === 0 ? 12 : base <= 15 ? 6 : 0);
  }
  if (extra < -score) reasons.push(`감점 하한 적용: 이번 기록은 0점까지만 감소`);
  return {
    reasons,
    awards,
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
      ? 8
      : curse?.active && curse.id === "parkingTicket"
        ? s.augment!.turn.flags.includes("parkingViolation")
          ? 8
          : 0
          : curse?.active && curse.id === "taxSix"
            ? Math.min(9, s.dice.filter((n) => n === 6).length * 3)
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
  base: number;
  upperCredit: number;
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
    return {base:recorded,upperCredit:SCORE_CATEGORIES.indexOf(c)<6?recorded:0,recorded,augment:0,otherRecords:0,upperBonus:0,floorAdjustment:0,total:recorded};
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
  const base=recorded>0?categoryScore(c,s.dice as number[]):0;
  return {base,upperCredit:SCORE_CATEGORIES.indexOf(c)<6&&recorded>0?base:0,recorded,augment,otherRecords,upperBonus,total,floorAdjustment:total-recorded-augment-otherRecords-upperBonus};
}
export function scorePreview(s: RoomState, p: PublicPlayer, c: ScoreCategory) {
  return scoreBreakdown(s,p,c)?.total ?? 0;
}
export function recordAugment(s: RoomState, p: PublicPlayer, c: ScoreCategory) {
  const before=captureAugmentFeedback(s);
  const curse=p.augment!.curse;
  recordAugmentCore(s,p,c);
  const flags=s.augment!.turn.flags;
  const ability=before.jackpot&&!s.augment!.jackpot?'squid':before.duels>s.augment!.duels.length?'duel':['loanDouble','loan','devil','bomb'].find(id=>flags.includes(id))??(curse?.active!==false?curse?.id:undefined);
  const source=ability===curse?.id?curse?.from:undefined;
  attachAugmentFeedback(s,before,source??p.id,'score',ability,source?[p.id]:[]);
}
function recordAugmentCore(s: RoomState, p: PublicPlayer, c: ScoreCategory) {
  if(monsterIndex(s)!==undefined)throw Error('괴물 주사위를 먼저 분열하세요.');
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
  ap.progress ??= {};
  ap.progress.lastBase=r.base;
  novelRecord(s,p,c,r.base,text=>effectResult(s,text));
  if(countAugment(p,"clockwork")&&r.score>0&&t.flags.includes("allIn"))ap.progress.clockwork=Math.min(36,(ap.progress.clockwork??0)+([0,4,10,18][Math.min(3,t.flags.filter(f=>f.startsWith("allInRoll:")).length)]??0));
  if(countAugment(p,"parasite"))for(const contract of ap.items.filter(i=>i.id==="parasite"&&i.target)){const sponsor=alive(s).find(q=>q.id===contract.target);const previous=sponsor?.augment?.progress?.lastBase??0;if(sponsor&&r.base>=Math.max(10,previous))contract.earned=Math.min(40,(contract.earned??0)+5);}
  if (ap.streak >= 3 && countAugment(p,"savings") && (ap.progress.savings??0)<2) {ap.progress.savings=(ap.progress.savings??0)+1;ap.streak=0;}
  for(const id of ["hunter","erase","underdog"])ap.progress[id]=(ap.progress[id]??0)+(r.awards[id]??0);
  if(countAugment(p,"hunter")){const kind=Math.max(...[1,2,3,4,5,6].map(n=>s.dice.filter(v=>v===n).length));for(const item of ap.items.filter(i=>i.id==="hunter"))item.earned=Math.min(36,(item.earned??0)+(kind>=5?12:kind===4?8:kind===3?4:0));}
  if(r.score===0&&countAugment(p,"lower")&&(ap.progress.lower??0)<3)ap.progress.lower=(ap.progress.lower??0)+1;
  if(r.awards.upper)ap.progress[`upper:${c}`]=1;
  ap.progress.cleanerVoucher=0;
  if(countAugment(p,"cleaner")&&s.dice.filter(n=>n===1).length>=2&&filled(p)<12&&(ap.progress.cleanerCreated??0)<2&&!ap.progress.cleanerVoucher){ap.progress.cleanerVoucher=1;ap.progress.cleanerCreated=(ap.progress.cleanerCreated??0)+1;}
  if(ap.rollBank!==undefined){ap.rollBank=Math.max(0,ap.rollBank-Number(t.flags.find(f=>f.startsWith("catStart:"))?.split(":")[1]??s.rollCount));if(filled(p)===12){const paid=Math.min(12,ap.rollBank*2);ap.bonus+=paid;effectResult(s,`${p.nickname} · 남은 굴림 ${ap.rollBank}회 환전 +${paid}점 지급 완료`);ap.rollBank=0;}}
  if(r.score===0&&!goldDisabled(p,"revive"))for(const revive of ap.items.filter(i=>i.id==="revive"&&(i.uses??0)<3))revive.remaining=1;
  if(filled(p)===12) {const shield=ap.items.find(i=>i.id==="shield"&&i.remaining>0);if(shield){shield.remaining=0;ap.bonus+=8;effectResult(s,`${p.nickname} · 방패 미사용 보상 +8점 지급`);}}
  ap.previousZero = r.score === 0;
  if (t.parallel) {
    const parallel = Math.min(40,
      categoryScore(t.parallel as ScoreCategory, scoringDice(s)),
    );
    ap.bonus += parallel;
    receipt.push(`한 턴에 두 탕: +${parallel}점 별도 지급 · 선택한 칸의 기록은 유지`);
  }
  const damage = directDamage(s, p, r.total);
  if(ap.curse?.active && ap.curse.id==="thief" && ap.curse.resolved){
    const source=alive(s).find(q=>q.id===ap.curse!.from);
    if(source){
      const paid=transfer(s,p,source,Math.min(18,Math.ceil(r.base*.4)),18);
      effectResult(s,`${p.nickname} → ${source.nickname} · 기본 점수의 40% 수금 ${paid}점 지급 완료`);
    }
  }
  if (damage) {
    ap.bonus -= damage;
    receipt.push(`상대 방해: -${damage}점`);
    const from = alive(s).find((q) => q.id === ap.curse?.from);
    if (from && ["thief","taxSix"].includes(ap.curse?.id??"")) {
      from.augment!.bonus += damage;
      effectResult(s, `${from.nickname} · ${ap.curse?.id==="taxSix"?"6 세금 징수":"주사위 도둑"}: ${p.nickname}에게서 +${damage}점 획득`);
    }
    note(s, `${p.nickname} · 방해 피해 -${damage}`);
  }
  for(const bounty of ap.bounties??[]){const source=alive(s).find(q=>q.id===bounty.from);if(!source)continue;const hit=s.dice.filter(n=>n===bounty.face).length>=2;const recipient=hit?source:p;recipient.augment!.bonus+=hit?8:3;effectResult(s,`${recipient.nickname} · ${bounty.face} 수배 ${hit?'성공':'회피'}! +${hit?8:3}점 지급 완료`);}ap.bounties=[];
  if(ap.curse?.active&&ap.curse.id==="practice"&&!ap.curse.resolved&&s.rollCount===1){const source=alive(s).find(q=>q.id===ap.curse!.from);if(source){source.augment!.bonus+=3;effectResult(s,`${source.nickname} · 첫 굴림 회피 보상 +3점 지급 완료`);}}
  for(const id of Object.keys(r.awards))chargeTariff(s,p,id);
  for(const id of ["fakeHouse","defect"])if(countAugment(p,id)&&r.base>r.raw)chargeTariff(s,p,id);
  if (ap.curse?.active !== false) {
    if (ap.curse)
      effectResult(
        s,
        `${p.nickname} · ${AUGMENTS.find((d) => d.id === ap.curse!.id)?.name} 종료`,
      );
    ap.curse = null;
  }
  for (const q of alive(s).filter((q) => q.id !== p.id)) {
    if(r.base>=20&&countAugment(q,"parasite"))for(const contract of q.augment!.items.filter(i=>i.id==="parasite"&&i.target===p.id)){const amount=Math.min(5,Math.max(0,40-(contract.earned??0)));contract.earned=(contract.earned??0)+amount;q.augment!.bonus+=amount;if(amount)chargeTariff(s,q,"parasite");if(amount)effectResult(s,`${q.nickname} \u00b7 ${AUGMENTS.find(d=>d.id==="parasite")!.name} +${amount}`);}
    for (const [id, threshold, points, cap] of [
      ["spectator", 20, 4, 4],

    ] as const) {
      if (r.base < threshold) continue;
      const qa = q.augment!,
        earned = qa.roundIncome[id] ?? 0,
        amount = Math.max(0,Math.min(cap - earned, points * countAugment(q, id), 28-(qa.progress?.[id]??0)));
      qa.progress ??= {};qa.progress[id]=(qa.progress[id]??0)+amount;
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
          d.aScore > d.bScore ? 40 : d.aScore === d.bScore ? 15 : -Math.min(10, playerTotals(pa).total);
        pb.augment!.bonus +=
          d.bScore > d.aScore ? 40 : d.aScore === d.bScore ? 15 : -Math.min(10, playerTotals(pb).total);
        note(
          s,
          `결투 결산 ${pa.nickname} ${d.aScore} : ${pb.nickname} ${d.bScore}`,
        );
        effectResult(
          s,
          `⚔ ${pa.nickname} ${d.aScore}점 : ${pb.nickname} ${d.bScore}점 · ${d.aScore === d.bScore ? "동점! 각각 +15점" : `${d.aScore > d.bScore ? pa.nickname : pb.nickname} 승리! +40점`}`,
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
      const amount=a.jackpot.pot+60;
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
    customOverride:s.augment!.turn.customOverride?structuredClone(s.augment!.turn.customOverride):undefined,
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
  if(i===monsterIndex(s)||s.augment?.turn.flags.includes(`lockedFace:${i}`))throw Error("이 주사위의 눈은 능력으로 바꿀 수 없어요.");
  if (s.augment?.turn.sealed?.includes(i))
    throw Error("이 주사위는 이번 턴이 끝날 때까지 현재 눈으로 봉인돼요.");
  s.dice[i] = value;
  if (s.rollCount) s.augment!.turn.flags.push("faceChanged");
  if (s.motion) {
    let face=value;
    if(physicalFaces(s)){
      const map=[...(s.augment!.turn.customOverride?.[i]??physicalFaces(s)!)];const found=map.indexOf(value);face=found<0?1:found+1;if(found<0)map[0]=value;(s.augment!.turn.customOverride??={})[i]=map;
    }
    if(i!==monsterIndex(s))s.motion.dice[i]!.q = [...Q[face - 1]!];
    else {const [x,y,z]=D12.faces[value-1]!.normal;const w=1+y,n=Math.hypot(z,x,w);s.motion.dice[i]!.q=n<1e-6?[1,0,0,0]:[-z/n,0,x/n,w/n];}
    s.motion.seq++;
    s.motion.at += 1;
  }
}
function restore(
  s: RoomState,
  snap: NonNullable<AugmentState["turn"]["first"]>,
) {
  const protectedFaces=new Map((s.augment!.turn.sealed??[]).map(i=>[i,s.dice[i]!]));
  s.dice = [...snap.dice];
  s.augment!.turn.customOverride=snap.customOverride;
  for (const [i,value] of protectedFaces) s.dice[i] = value;
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
      {const value=s.dice[i]!,map=physicalFaces(s);if(map){const faces=[...map];const face=Math.max(0,faces.indexOf(value));faces[face]=value;(s.augment!.turn.customOverride??={})[i]=faces;s.motion.dice[i]!.q=[...Q[face]!];}else s.motion.dice[i]!.q = [...Q[value-1]!];}
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
    ap.bonus+=6;
    effectResult(s,`${q.nickname} · 방패 방어 보상 +6점 지급`);
    note(s, `${q.nickname} · 소형 방패로 방어!`);
    effectResult(s, `${q.nickname} · 소형 방패로 공격 무효!`);
    return false;
  }
  if (reflect) {
    chargeTariff(s,q,"reflect");
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
  const before=captureAugmentFeedback(s);
  const ability=c.id??(c.op==='resolve'?p.augment?.curse?.id:undefined);
  const source=p.augment?.curse?.from;
  useAugmentCore(s,p,c,random);
  if(c.op==='refresh')return;
  if(c.op==='use'&&c.id)chargeTariff(s,p,c.id);
  if(c.op==='pick'&&!s.augment!.results.some(r=>!before.keys.has(r.key)))effectResult(s,`${p.nickname} · ${AUGMENTS.find(d=>d.id===c.id)?.name??c.id} 획득`);
  attachAugmentFeedback(s,before,p.id,c.op==='pick'?'acquire':c.op==='resolve'?'resolve':'use',ability,c.target?[c.target]:source&&c.op==='resolve'?[source]:[]);
}
function useAugmentCore(s:RoomState,p:PublicPlayer,c:AugmentCommand,random:Random){
  if (c.op !== "use") return executeAugment(s,p,c,random);
  const id=c.id??"", def=AUGMENTS.find(d=>d.id===(id==="loanDouble"?"loan":id));
  const event=EVENTS.find(e=>e.id===id);
  const targets=(def?.flash || MISCHIEF_IDS.includes(id)) && id!=="bounty"
    ? flashTargets(s,p,c).map(({q})=>q)
    : [["bounty","parasite","taste","thief","lock","seal","duel","swap","doppel"].includes(id)
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
    reserved.length || targets.some(q=>q.id!==p.id) && !["taste","bounty","parasite"].includes(id) ? "attack" :
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
    if(["loser","underdog"].includes(def.id)){ap.bonus+=8;effectResult(s,`${p.nickname} · ${def.name} 획득 보너스 +8점 지급 완료`);}
    if(def.id==='cashNow') {
      const item=ap.items.at(-1)!;
      item.remaining=0;
      item.earned=20;
      ap.bonus+=20;
      const message=`${p.nickname} · ${def.name}: 증강 보너스 +20점 지급 완료! 현재 총점 ${playerTotals(p).total}점 · 추가 발동 없음`;
      effectResult(s,message,[{playerId:p.id,amount:20,reason:def.name}]);
      a.results.at(-1)!.activation={id:def.id,actor:p.nickname,targets:[p.nickname],name:def.name,effect:message,kind:'score',rarity:def.rarity,flash:false};
      note(s,message);
    }
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
  if(t.oldWorld)throw Error('재도전 결과와 원래 결과 중 하나를 먼저 선택하세요.');
  if(monsterIndex(s)!==undefined && ['cat','memory','fork'].includes(c.id??''))throw Error('괴물 주사위가 있는 동안 세계를 되돌릴 수 없어요.');
  if(t.monster&&!t.monster.split&&c.id==='monster'){
    if(!s.rollCount||t.oldWorld)throw Error('괴물을 굴린 뒤 분열하세요.');
    const i=t.monster.index,n=s.dice[i];if(n===null)throw Error('먼저 괴물을 굴리세요.');
    if(c.value===undefined||!Number.isInteger(c.value)||c.value<1||c.value>6)throw Error('분열할 첫 번째 눈은 1~6이어야 해요.');
    const first=n===1?1:c.value,second=n===1?1:n!-(first??0);
    if(!Number.isInteger(first)||first!<1||first!>6||second<1||second>6)throw Error('합계에 맞는 두 눈을 고르세요.');
    if(n===1)t.extra-=8;
    s.dice[i]=first!;s.dice.push(second);s.held[i]=true;s.held.push(true);t.monster.split=true;t.first=null;t.flags.push('final');
    if(t.fixed?.includes(i))t.fixed.push(s.dice.length-1);
    if(t.sealed?.includes(i)){s.dice[i]=1;s.dice[s.dice.length-1]=1;t.sealed.push(s.dice.length-1);}
    s.motion=null;effectResult(s,`${p.nickname} · 괴물 분열! ${n} → ${s.dice[i]} · ${s.dice.at(-1)}${n===1?' / 소화불량 -8점':''} · 이제 점수를 기록하세요.`);return;
  }
  if(t.monster?.split&&['cat','memory','fork'].includes(c.id??''))throw Error('괴물 분열 후에는 세계를 되돌릴 수 없어요.');
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
        (i.remaining !== 0 || id==="estate"&&!!ap.estate&&!ap.estate.relocated ||
          AUGMENTS.find((d) => d.id === id)?.charges === 0) &&
        (i.usedTurn !== t.serial || i.extraTurn===t.serial),
    );
  const def = AUGMENTS.find((d) => d.id === id);
  if (event) {
    if (t.flags.includes(id))
      throw Error("이번 사건 능력을 이미 사용했습니다.");
  } else if (!item || !def || def.trigger !== "active")
    throw Error("사용 가능한 능력이 아닙니다.");
  if(NOVEL_IDS.includes(id)){
    if(t.oldWorld||t.flags.includes('final'))throw Error('결과를 확정하기 전에 사용하세요.');
    if(id==='customDie'){
      const faces=c.faces;
      if(s.rollCount||!faces||faces.length!==6||faces.some(n=>!Number.isInteger(n)||n<1||n>6)||faces.filter((n,i)=>n!==i+1).length!==1)throw Error('첫 굴림 전에 숫자 한 종류를 다른 숫자로 바꾸세요.');
      ap.customFaces=[...faces];effectResult(s,`${p.nickname} · 이번 턴 모든 6면체 인쇄 완료! ${faces.join(' · ')}`);
    }else if(id==='estate'){
      if(ap.estate){
        const from=c.category,to=c.destination;
        if(s.rollCount||ap.estate.relocated||!from||!to||!ap.estate.ruined.includes(from)||!SCORE_CATEGORIES.includes(to as ScoreCategory)||p.scores[to as ScoreCategory]!==null||ap.estate.plots.includes(to))throw Error('첫 굴림 전에 실패한 부지를 다른 빈 칸으로 한 번 옮길 수 있어요.');
        ap.estate.plots[ap.estate.plots.indexOf(from)]=to;ap.estate.ruined=ap.estate.ruined.filter(k=>k!==from);ap.estate.relocated=true;
        effectResult(s,`${p.nickname} · 실패한 부지를 ${SCORE_LABELS[to as ScoreCategory]}로 이전 완료`);
      }else{
      const plots=c.categories;
      if(!a.drafting||!plots||plots.length!==3||new Set(plots).size!==3||plots.some(k=>!SCORE_CATEGORIES.includes(k as ScoreCategory)||p.scores[k as ScoreCategory]!==null))throw Error('서로 다른 빈 점수칸 세 곳을 고르세요.');
      ap.estate={plots:[...plots],paid:0,completed:[],ruined:[]};effectResult(s,`${p.nickname} · 부지 확보: ${plots.map(k=>SCORE_LABELS[k as ScoreCategory]).join(' / ')} · 두 곳 +8점, 세 곳 추가 +24점`);
      }
    }else if(id==='monster'){
      if(s.rollCount||t.monster||s.held.slice(-2).some(Boolean)||(t.childIndex??-1)>=s.dice.length-2)throw Error('첫 굴림 전, 마지막 두 주사위가 비어 있어야 합체할 수 있어요.');
      s.dice.pop();s.held.pop();t.monster={index:s.dice.length-1,split:false};s.motion=null;effectResult(s,`${p.nickname} · 주사위 둘을 삼켰다! 실제 12면체 등장 · 굴린 뒤 분열 조합을 선택하세요.`);
    }else if(id==='custody'){
      const q=alive(s).find(q=>q.id===c.target&&q.id!==p.id);
      if(!q||turnsLeft(p)<2||turnsLeft(q)<2||q.augment!.curse||a.custody?.some(l=>[l.a,l.b].some(id=>id===p.id||id===q.id)))throw Error('두 턴 이상 남고 공동 육아와 방해가 없는 상대를 고르세요.');
      const index=s.dice.findIndex((_,i)=>!t.fixed?.includes(i)&&!t.sealed?.includes(i)&&t.locked!==i);
      if(index<0)throw Error('공동 주사위로 쓸 수 있는 주사위가 없어요.');
      if(attack(s,p,q)){(a.custody??=[]).push({a:p.id,b:q.id,face:null,aLeft:2,bLeft:2,aPaid:0,bPaid:0});t.childIndex=index;q.augment!.curse={id,from:p.id};effectResult(s,`${p.nickname} ↔ ${q.nickname} · 공동 육아 시작! ${index+1}번 주사위 마지막 눈을 전달, 각자 2턴`);}
    }else if(id==='crown'){
      if(s.rollCount||a.crown||alive(s).some(q=>turnsLeft(q)<2))throw Error('모두 두 턴 이상 남아 있을 때 첫 굴림 전에, 판 전체 한 번만 개최할 수 있어요.');
      a.crown={holder:p.id,threshold:25,claimed:false,finished:false,entries:alive(s).map(q=>({id:q.id,left:2}))};ap.bonus+=10;effectResult(s,`${p.nickname} · 왕관 개최! +10점 지급, 각자 두 턴 뒤 최종 보유자 +40점! 첫 탈취 기본 25점 이상`);
      for(const q of alive(s).filter(q=>q.id!==p.id))for(const spare of q.augment!.items.filter(i=>i.id==='crown'&&i.remaining>0)){spare.remaining=0;spare.earned=35;q.augment!.bonus+=35;effectResult(s,`${q.nickname} · 다른 플레이어가 먼저 왕관을 개최해 미사용 초대장을 +35점으로 환전! 왕관 쟁탈에는 그대로 참가합니다.`,[{playerId:q.id,amount:35,reason:'중복 왕관 초대장 환전'}]);}
    }
    if(item!.usedTurn===t.serial&&item!.extraTurn===t.serial)item!.extraTurn=undefined;
    if(item!.remaining>0)item!.remaining--;item!.usedTurn=t.serial;

    if(a.drafting)finishDraft(s);return;
  }
  const before = [
    "parasite",
    "scoreRemodel",
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
    "lifebuoy",
    "cleaner",
    "odd",
    "six",
    "lastmove",
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
    ["lifebuoy", "cleaner", "lastmove", "collector", "fork", "choiceRoll", "even", "chaos", "exchange", "cat"].includes(id)
  )
    throw Error("최종 단계에서는 다시 굴릴 수 없습니다.");
  const die = id === "lifebuoy" ? s.dice.findIndex((_,i)=>t.locked!==i&&!t.fixed?.includes(i)&&!t.sealed?.includes(i)) : id === "even" ? s.dice.findIndex((n,i)=>n===1 && t.locked!==i && !t.fixed?.includes(i)) : c.die ?? -1;
  if ((id === "chance" && t.flags.includes("substitute")) ||
      (id === "substitute" && t.flags.includes("chance")))
    throw Error("환전과 족보 대체는 함께 사용할 수 없어요.");
  const validDie = () => {
    if (die < 0 || die >= s.dice.length || s.dice[die] === null || die===monsterIndex(s))
      throw Error("주사위를 선택하세요.");
  };
  const category = () => {
    if (!SCORE_CATEGORIES.includes(c.category as ScoreCategory))
      throw Error("족보를 선택하세요.");
    return c.category as ScoreCategory;
  };
  if (["tomorrow", "hostage"].includes(id) && t.oldWorld)
    throw Error("원래 결과와 다시 굴린 결과 중 하나를 먼저 골라주세요.");
  if(id==="parasite") {const target=alive(s).find(q=>q.id===c.target&&q.id!==p.id);if(!target||item?.target)throw Error("새로 계약할 상대 한 명을 고르세요.");item!.target=target.id;
  } else if(id==="bounty"){const target=alive(s).find(q=>q.id===c.target&&q.id!==p.id&&filled(q)<12);if(!target||!c.value||c.value>6||(target.augment!.bounties??[]).some(b=>b.from===p.id))throw Error("남은 턴이 있고 내가 수배하지 않은 상대와 숫자 1~6을 고르세요.");(target.augment!.bounties??=[]).push({from:p.id,face:c.value});
  } else if (id === "scoreRemodel") {
    const from=category(), to=c.destination as ScoreCategory;
    if(!SCORE_CATEGORIES.slice(6).includes(from)||!SCORE_CATEGORIES.slice(6).includes(to)||p.scores[from]===null||p.scores[to]!==null) throw Error("기록한 하단 칸과 빈 하단 칸을 선택하세요.");
    const saved=p.scores[from]!;ap.bonus+=saved+15;p.scores[from]=null;p.scores[to]=0;
    effectResult(s,`${p.nickname} · ${SCORE_LABELS[from]} 다시 열기! ${saved}점 보존 + 지원금 15점 지급, ${SCORE_LABELS[to]}에 0점 · 총점 +15`);
  } else if (id === "tomorrow") {
    validDie();
    if (s.dice[die]! > 3 || ap.savedFace != null || filled(p) >= 11)
      throw Error("다음 턴이 있고 저장 슬롯이 비어 있을 때 1~3을 저장하세요.");
    ap.savedFace = 7 - s.dice[die]!;
  } else if (id === "taste") {
    const q = alive(s).find((q) => q.id === c.target && q.id !== p.id);
    validDie();
    if (
      !q?.augment?.lastDice?.includes(c.value ?? 0)
    )
      throw Error("상대의 직전 확정 결과에 있는 눈을 고르세요.");
    change(s, die, c.value!);
  } else if (id === "memory") {
    const remembered = ap.archive?.[c.historyIndex ?? -1]?.dice;
    if (!remembered)
      throw Error(
        "과거 기록을 고르세요. 미리 보관한 주사위가 있으면 사용할 수 없어요.",
      );
    const slots=s.dice.flatMap((_,i)=>t.fixed?.includes(i)||t.sealed?.includes(i)||t.locked===i?[]:[i]);
    const copied = Math.min(remembered.length, slots.length);
    for (let j = 0; j < copied; j++) {
      const i=slots[j]!;change(s, i, remembered[j]!);
      s.held[i] = true;
    }
    if (slots.length === copied) {
      s.rollCount = 1;
      s.held=s.held.map((_,i)=>!!t.fixed?.includes(i)||!!t.sealed?.includes(i)||t.locked===i);
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
      const trial=structuredClone(s), caster=alive(trial).find(q=>q.id===p.id)!;
      if(targets.filter(({q})=>q.id===p.id||attack(trial,caster,alive(trial).find(v=>v.id===q.id)!)).length<3)throw Error("방패 제외 후 세 명이 필요해요. 사용권과 방패는 소모하지 않았어요.");
      const accepted=targets.filter(({q})=>q.id===p.id||attack(s,p,q));
      if(accepted.length<3) throw Error("방패 제외 후 참가자가 3명 이상이어야 해요. 사용권은 소모하지 않았어요.");
      else {
        const key=c.category as ScoreCategory, values=accepted.map(({q})=>q.scores[key]!);
        const seat=accepted.findIndex(({q})=>q.id===p.id);
        const left=values[(seat-1+values.length)%values.length]!,right=values[(seat+1)%values.length]!;
        const direction=left===right?(random(2)===0?1:-1):left>right?1:-1;
        accepted.forEach(({q},i)=>{q.scores[key]=values[(i-direction+values.length)%values.length]!;q.augment!.scoreSwapped=true;});
        effectResult(s,`점수표 회전목마 · ${SCORE_LABELS[key]} · ${direction===1?"정방향":"역방향"} | ${accepted.map(({q},i)=>`${q.nickname} ${values[i]} → ${q.scores[key]}점`).join(" / ")}`);
      }
    } else if (id === "squid") {
      const accepted=targets.filter(({q})=>q.id===p.id||attack(s,p,q));
      if(accepted.length<2) effectResult(s,"공동 승부 불발! 참가자가 부족해 판돈은 받지 않았어요.");
      else {
        a.jackpot={after:t.serial,pot:accepted.length*20,entries:accepted.map(({q})=>({id:q.id,score:null}))};
        for(const {q} of accepted){q.augment!.bonus-=20;q.augment!.curse={id,from:p.id,active:false};}
        effectResult(s,`판돈은 목숨입니다! ${accepted.map(({q})=>q.nickname).join(" · ")} 각 -20점 납부 | 우승 지급액 ${a.jackpot.pot+60}점`);
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
          if(incoming.id==="parasite"&&incoming.target===q.id){incoming.target=undefined;incoming.remaining=1;}
          if(q.id===p.id){
            const charges=AUGMENTS.find(d=>d.id===incoming.id)!.charges;
            incoming.remaining=charges;incoming.usedTurn=-1;incoming.usedRound=-1;incoming.uses=0;incoming.earned=0;incoming.target=undefined;
            q.augment!.bonus+=20;
            if(AUGMENTS.find(d=>d.id===incoming.id)!.trigger==="active")incoming.extraTurn=t.serial;else q.augment!.bonus+=10;
          }
        });
        effectResult(
          s,
          `골드 대이동! ${accepted.map(({ q }, i) => `${q.nickname}: ${AUGMENTS.find((d) => d.id === chosen[(i + chosen.length - 1) % chosen.length]!.id)!.name}`).join(" / ")} | ${p.nickname} 받은 골드 완충 · +20점 지급${AUGMENTS.find(d=>d.id===chosen[(accepted.findIndex(({q})=>q.id===p.id)+chosen.length-1)%chosen.length]!.id)!.trigger==='passive'?' + 자동형 보상 10점 지급':' · 이번 턴 추가 사용권 1회'}`,
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
          for (let n = 0; n < 2; n++)
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
      ap.bonus += 8;
      effectResult(s, `${p.nickname} · 회식 보너스 +8점 지급 완료`);
    }
    if(id==="handsUp" && alive(s).some(q=>q.id!==p.id&&q.augment!.curse?.id===id&&q.augment!.curse.from===p.id)){
      ap.bonus+=10;
      effectResult(s,`${p.nickname} · 나는 믹서기 면제! +10점 지급 완료`);
    }
    if (id === "confiscate") {
      const count = alive(s).filter(
        (q) =>
          q.id !== p.id &&
          q.augment!.curse?.id === id &&
          q.augment!.curse.from === p.id,
      ).length;
      if (count) ap.curse!.other = String(count+(alive(s).length===2?1:0));
      else ap.curse = null;
      effectResult(
        s,
        `${p.nickname} · 주사위 ${count}개 압수! 다음 내 턴에 ${ap.curse?.other??0}개 추가${count&&alive(s).length===2?' (2인전 보너스 1개 포함)':''}.`,
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
        indices.some((i) => !Number.isInteger(i) || i < 0 || i >= s.dice.length || !s.dice[i] || t.sealed?.includes(i)||i===monsterIndex(s)))
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
  } else if(id==="odd"||id==="six"){
    validDie();if(id==="odd"&&s.dice[die]!%2!==0||id==="six"&&s.dice[die]!==5)throw Error(id==="odd"?"짝수 주사위를 고르세요.":"5인 주사위를 고르세요.");
    change(s,die,id==="odd"?s.dice[die]!-1:6);
  } else if (["lifebuoy","cleaner","lastmove", "collector", "choiceRoll", "even", "chaos", "exchange"].includes(id)) {
    if(id==="lifebuoy"&&(s.rollCount!==1||t.flags.includes("faceChanged")))throw Error("첫 일반 굴림 직후, 눈을 바꾸기 전에 사용하세요.");
    if(id==="cleaner"&&(s.rollCount!==1||!ap.progress?.cleanerVoucher||s.dice[die]!==1))throw Error("청소권으로 첫 굴림의 1을 다시 던질 수 있어요.");
    if(id==="lastmove"&&s.rollCount<3)throw Error("세 번째 일반 굴림 이후에 사용할 수 있어요.");
    validDie();
    if(id==="lifebuoy")t.kept=[];
    if (id === "collector" && s.dice.filter((n) => n === s.dice[die]).length < 2)
      throw Error("같은 눈이 둘 이상인 주사위를 골라주세요.");
    if (id === "even" && s.dice[die] !== 1)
      throw Error("1이 나온 주사위만 반품할 수 있어요.");
    if (id === "exchange" && s.rollCount < 2)
      throw Error("두 번째 굴림 이후 사용하세요.");
    if (t.locked === die || t.fixed?.includes(die))
      throw Error("강제 고정된 주사위는 굴릴 수 없습니다.");
    t.reroll = { id, index: die, old: s.dice[die]!, held: [...s.held],prior:s.dice.filter((n):n is number=>n!==null) };
    if(id==="lifebuoy")t.reroll.held=s.held.map((_,i)=>t.locked===i||!!t.fixed?.includes(i)||!!t.sealed?.includes(i)||i===monsterIndex(s));
    if(id==="cleaner")ap.progress!.cleanerVoucher=0;
    s.held = s.held.map((_, i) => id === "lifebuoy" ? t.locked===i||!!t.fixed?.includes(i)||!!t.sealed?.includes(i)||i===monsterIndex(s) : id === "even" ? i===monsterIndex(s)||s.dice[i]!==1 || t.locked===i || !!t.fixed?.includes(i) : i !== die);
    s.rollPhase = "shaking";
  } else if (id === "target") {
    const key = category();
    if (p.scores[key] !== null) throw Error("미사용 족보를 선택하세요.");
    t.target = key;
  } else if (id === "revive") {
    if ((item?.uses??0)>=3) throw Error("게임당 3회까지 사용할 수 있어요.");
    if (die < 0 || die >= s.dice.length) throw Error("주사위를 선택하세요.");
    const slots=s.held.flatMap((v,i)=>!v?[i]:[]).slice(0,2);
    if(slots.length!==2)throw Error("빈 주사위 두 개가 필요해요.");
    for(const index of slots){change(s,index,c.value??0);s.held[index]=true;}
    t.preheld=s.held.flatMap((held,index)=>held?[index]:[]);
    if(item)item.uses=(item.uses??0)+1;
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
    if(ap.rollBank!==undefined) {ap.rollBank++;t.maxRolls=Math.min(7,t.maxRolls);}
    t.extra -= 8;
  } else if (id === "cat") {
    if (!t.first || s.rollCount < t.maxRolls || t.oldWorld)
      throw Error("마지막 일반 굴림 후 사용하세요.");
    t.oldWorld = snapshot(s);
    t.flags.push(`catStart:${s.rollCount}`);
    s.held=s.held.map((_,i)=>t.locked===i||!!t.fixed?.includes(i)||!!t.sealed?.includes(i));
    t.maxRolls=s.rollCount+3;
    t.kept=[];
  } else if (id === "parallel") {
    const key = category();
    if (!SCORE_CATEGORIES.some(k=>k!==key&&p.scores[k]===null&&!blockedCategory(p,k)))throw Error("일반 기록으로 쓸 다른 빈 칸이 필요해요.");
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
          for(const recipient of [p,q])for(const contract of recipient.augment!.items)if(contract.id==="parasite"&&contract.target===recipient.id){contract.target=undefined;contract.remaining=1;}
        }
      }
    } else {
      if(id==="lock"){validDie();if(s.dice[die]!>3)throw Error("보낼 눈 1~3을 고르세요.");}
      if(attack(s,p,q)){q.augment!.curse={id,from:p.id,values:id==="lock"?[s.dice[die]!]:undefined};if(id==="seal"){ap.bonus+=5;effectResult(s,`${p.nickname} · 굴림 봉인 예약 성공 +5점 지급 완료`);}}
    }
  } else if (!["loan", "devil", "bomb", "substitute"].includes(id))
    throw Error("지원하지 않는 능력입니다.");
  if(id==="ordinaryDay")for(const q of alive(s).filter(q=>q.augment!.curse?.id===id&&q.augment!.curse.from===p.id)){const paid=transfer(s,q,p,15,25);q.augment!.curse!.paid=paid;effectResult(s,`${p.nickname} · ${q.nickname}에게 선불 통행료 ${paid}점 강탈 완료 · 다음 턴 종류별 5점, 합계 25점까지`);}
  if(id==="parkingTicket"&&alive(s).some(q=>q.augment!.curse?.id===id&&q.augment!.curse.from===p.id)){ap.bonus+=3;effectResult(s,`${p.nickname} · 주차 위반 예약 성공 +3점 지급 완료`);}

  if (item) {
    if(item.usedTurn===t.serial&&item.extraTurn===t.serial)item.extraTurn=undefined;
    if (item.remaining > 0) item.remaining--;
    if (
      def?.charges === -1 ||
      [
        "parallel",
        "devil",
        "lifebuoy",
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
  const before=captureAugmentFeedback(s),p=alive(s).find(p=>p.id===s.currentPlayerId)!;
  const reroll=s.augment!.turn.reroll;
  if(reroll)before.dice[reroll.index]=reroll.old;
  const id=reroll?.id??p.augment?.curse?.id;
  const source=reroll?undefined:p.augment?.curse?.from;
  afterAugmentRollCore(s,random);
  attachAugmentFeedback(s,before,source??p.id,'roll',id,source?[p.id]:[]);
}
function afterAugmentRollCore(s:RoomState,random:Random){
  const a = s.augment!,
    t = a.turn,
    p = alive(s).find((p) => p.id === s.currentPlayerId)!;
  const curse = p.augment!.curse;
  if(!t.reroll&&!t.oldWorld){
    if(countAugment(p,"sixth"))chargeTariff(s,p,"sixth");
    if(s.rollCount>=4){for(const id of ["fourth","rollVault"])if(countAugment(p,id))chargeTariff(s,p,id);if(t.flags.some(f=>f.startsWith("loserBonus:")&&f!=="loserBonus:0"))chargeTariff(s,p,"loser");}
  }
  if (
    curse?.active &&
    curse.id === "receipt" &&
    curse.die !== undefined &&
    !curse.resolved &&
    (s.rollCount > 1 || !!t.reroll) &&
    !s.held[curse.die]
  ) {
    curse.resolved = true;
    const source = alive(s).find((q) => q.id === curse.from);
    if (source) source.augment!.bonus += 8;
    effectResult(
      s,
      `${p.nickname} · 주사위 폭발! ${source?.nickname ?? "시전자"} +8점`,
    );
  }
  if(t.oldWorld)return;
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
    s.held=s.held.map((_,i)=>!!t.fixed?.includes(i)||!!t.sealed?.includes(i)||t.locked===i);
    t.flags = t.flags.filter((f) => f !== "memoryFirst");
  }
  if (t.reroll) {
    const r = t.reroll;
    const rerolled = s.held.flatMap((held,index)=>held?[]:[index]);
    s.rollCount--;
    s.held = r.held;
    if (r.id === "choiceRoll" && s.dice[r.index] !== r.old)
      t.chooseOld = { index: r.index, old: r.old };
    if (r.id === "exchange") t.extra += 8;
    if(r.id==="collector"&&!r.prior?.includes(s.dice[r.index]!)){const paid=Math.min(2,Math.max(0,8-(p.augment!.progress?.collector??0)));p.augment!.progress??={};p.augment!.progress.collector=(p.augment!.progress.collector??0)+paid;t.extra+=paid;effectResult(s,`${p.nickname} · 새 숫자 발견! 기록 시 보너스 +${paid}점`);}
    if (["chaos"].includes(r.id)) t.flags.push("final");
    t.kept = t.kept.filter((i) => !rerolled.includes(i));
    t.flags.push(`rerolled:${r.index}`, "faceChanged");
    t.reroll = null;
    if (r.id === "practice") {
      if(s.rollCount===1)t.first = snapshot(s);
      t.kept = t.kept.filter(i=>i!==r.index);
      const source=alive(s).find(q=>q.id===curse?.from);
      if(source){source.augment!.bonus+=6;effectResult(s,`${source.nickname} · 연습비 +6점 지급 완료`);}
    }
    return;
  }
  if (p.augment!.curse?.active && p.augment!.curse!.id === "construction") {
    const pool = SCORE_CATEGORIES.filter((k) => p.scores[k] === null);
    for (let n = 0; n < 2 && pool.length; n++) pool.splice(random(pool.length), 1);
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
      const highest = Math.max(...s.dice.map((n,i) => i===monsterIndex(s)?0:n ?? 0));
      const indices = s.dice.flatMap((n, i) => (n === highest && i!==monsterIndex(s) ? [i] : []));
      const index = indices[random(indices.length)]!;
      change(s, index, 1);
      t.flags.push("bananaApplied");
      effectResult(
        s,
        `${p.nickname} · 바나나 껍질! ${index + 1}번 주사위 ${highest} → 1`,
      );
    }
    if (p.augment!.curse?.id === "lock") {
      const slots=s.dice.flatMap((_,i)=>t.fixed?.includes(i)||t.sealed?.includes(i)||i===monsterIndex(s)?[]:[i]);
      if(slots.length){const i=slots[random(slots.length)]!;change(s,i,curse?.values?.[0]??1);t.locked=i;t.fixed=[...(t.fixed??[]),i];s.held[i]=true;t.flags.push(`lockedFace:${i}`);}

    }
    t.first = snapshot(s);
    if (curse?.active && curse.id === "receipt" && curse.die === undefined) {
      curse.die = random(s.dice.length);
      effectResult(
        s,
        `${p.nickname} · ${curse.die + 1}번에 폭탄! 다시 굴리면 상대 +8점, 그대로 기록하면 내 점수 -8점`,
      );
    }
    if (p.augment!.curse?.active && p.augment!.curse.id === "hostage") {
      if (s.dice.filter((_,i)=>!t.preheld?.includes(i)&&i!==monsterIndex(s)).length < 3) {
        effectResult(s, `${p.nickname} · 악마의 택배 무효: 봉인할 주사위가 3개 미만이에요.`);
        p.augment!.curse = null;
      }
      else t.pending = "hostage";
    }
  }
  if (s.rollCount > 1 && !s.held.some(Boolean) && !t.flags.includes("allIn"))
    t.flags.push("allIn");
  if(s.rollCount>1&&!s.held.some(Boolean)&&!t.flags.includes(`allInRoll:${s.rollCount}`))t.flags.push(`allInRoll:${s.rollCount}`);
  if (s.rollCount === 3) t.flags.push("third");
    if (s.rollCount===2 && curse?.active && curse.id === "practice" && !curse.resolved) {
      curse.resolved = true;
      const highest = Math.max(...s.dice.map((n,i) => t.locked===i||t.fixed?.includes(i)||i===monsterIndex(s)?0:n!)),
        indices = s.dice.flatMap((n, i) => (n === highest && t.locked!==i&&!t.fixed?.includes(i)&&i!==monsterIndex(s) ? [i] : [])),
        index = indices[random(indices.length)]!;
      if(!indices.length)return;
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

}

export function prepareAugmentRoll(s: RoomState, random: Random) {
  for(const key of Object.keys(s.augment!.turn.customOverride??{}))if(!s.held[Number(key)])delete s.augment!.turn.customOverride![key];
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
  const before=captureAugmentFeedback(s);
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
    `${p.nickname} · ${curse.id === "handsUp" ? "너희만 믹서기 입장" : "보관함 털이"}! ${taken.length ? taken.map((i) => i + 1).join("·") + "번도 다시 굴려요!" : "보관한 주사위가 없어요"}`,
  );
  attachAugmentFeedback(s,before,curse.from,'roll',curse.id,[p.id]);
  s.augment!.results.at(-1)!.presentation!.rerollIndices=taken;
}
