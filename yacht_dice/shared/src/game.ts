import { prepareAugmentRoll, initAugment, useAugment, recordAugment, advanceAugment, afterAugmentRoll, playerTotals } from "./augment-game.js";
import { SCORE_CATEGORIES, type PublicPlayer, type ScoreCategory, type Scorecard, type RoomState, type ClientMessage, type ErrorCode } from "./index.js";

export function emptyScorecard(): Scorecard {
  return Object.fromEntries(SCORE_CATEGORIES.map(key => [key, null])) as Scorecard;
}

export function categoryScore(category: ScoreCategory, dice: readonly number[]): number {
  if ((dice.length < 4 || dice.length > 10) || dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) throw new Error("주사위 4~10개의 눈은 1~6이어야 합니다.");
  const sum = dice.reduce((a, b) => a + b, 0);
  const upper = SCORE_CATEGORIES.indexOf(category);
  if (upper < 6) return dice.filter(n => n === upper + 1).reduce((a, b) => a + b, 0);
  const counts = Array.from({ length: 6 }, (_, i) => dice.filter(n => n === i + 1).length);
  const unique = [...new Set(dice)].sort((a, b) => a - b);
  let run = 1, longest = 1;
  for (let i = 1; i < unique.length; i++) { run = unique[i] === unique[i - 1]! + 1 ? run + 1 : 1; longest = Math.max(longest, run); }
  switch (category) {
    case "choice": return sum;
    case "fourOfAKind": return counts.some(n => n >= 4) ? sum : 0;
    case "fullHouse": return counts.some(n => n >= 5) || counts.some((n, i) => n >= 3 && counts.some((m, j) => j !== i && m >= 2)) ? sum : 0;
    case "smallStraight": return longest >= 4 ? 15 : 0;
    case "largeStraight": return longest >= 5 ? 30 : 0;
    case "yacht": return counts.some(n => n >= 5) ? 50 : 0;
    default: throw new Error("알 수 없는 점수 칸입니다.");
  }
}

export function totals(scores: Scorecard) {
  const upper = SCORE_CATEGORIES.slice(0, 6).reduce((sum, key) => sum + (scores[key] ?? 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  return { upper, bonus, total: Object.values(scores).reduce<number>((sum, n) => sum + (n ?? 0), 0) + bonus };
}

type Action = Extract<ClientMessage, { type: "setReady" | "startShake" | "roll" | "setHolds" | "score" | "augment" }>;

export function activePlayers(state: RoomState): PublicPlayer[] {
  return state.players.filter((p): p is PublicPlayer => !!p && !p.forfeited);
}
function complete(player: PublicPlayer) { return Object.values(player.scores).every(n => n !== null); }
export function nextPlayerId(state: RoomState, afterId: string): string | null {
  if(state.augment){
    const a=state.augment,eligible=activePlayers(state).filter(p=>!complete(p)&&p.id!==afterId);
    const order=a.order.slice(a.first).concat(a.order.slice(0,a.first));
    const pending=order.find(id=>!a.done.includes(id)&&eligible.some(p=>p.id===id));
    if(pending)return pending;
    const first=(a.first+1)%a.order.length;
    return a.order.slice(first).concat(a.order.slice(0,first)).find(id=>eligible.some(p=>p.id===id))??null;
  }
  const start = state.players.findIndex(p => p?.id === afterId);
  for (let offset = 1; offset <= state.players.length; offset++) {
    const player = state.players[(start + offset) % state.players.length];
    if (player && !player.forfeited && !complete(player)) return player.id;
  }
  return null;
}
function resetTurn(state: RoomState) {
  state.dice = [null, null, null, null, null];
  state.held = [false, false, false, false, false];
  state.rollCount = 0;
  state.motion = null;
  state.rollPhase = "idle";
}
export function standings(state: RoomState) {
  const ranked = activePlayers(state).sort((a, b) => playerTotals(b).total - playerTotals(a).total || a.slot - b.slot);
  return state.players.filter((p): p is PublicPlayer => !!p).map(player => ({
    player, total: playerTotals(player).total,
    rank: player.forfeited ? null : ranked.filter(p => playerTotals(p).total > playerTotals(player).total).length + 1,
  })).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.player.slot - b.player.slot);
}
/** Mutates only the supplied authoritative/draft state, after all forfeits in a batch. */
export function settleGame(state: RoomState) {
  if (state.phase !== "playing") return;
  const active = activePlayers(state);
  if (!active.length) state.outcome = { kind: "abandoned", reason: "disconnect" };
  else if (active.length === 1) {
    if (active[0]!.connected) state.outcome = { kind: "winner", playerId: active[0]!.id, reason: "forfeit" };
  } else if (active.every(complete)) {
    const maximum = Math.max(...active.map(p => playerTotals(p).total));
    const winners = active.filter(p => playerTotals(p).total === maximum).map(p => p.id);
    state.outcome = winners.length === 1 ? { kind: "winner", playerId: winners[0]!, reason: "score" } : { kind: "draw", playerIds: winners, reason: "score" };
  }
  if (state.outcome) { state.phase = "finished"; state.currentPlayerId = null; state.rollPhase = "idle"; }
  else {
    const current = active.find(p => p.id === state.currentPlayerId);
    if (!current || complete(current)) {
      state.currentPlayerId = nextPlayerId(state, state.currentPlayerId ?? "");
      resetTurn(state);
    }
  }
}
export type GameResult = { ok: true; state: RoomState } | { ok: false; code: ErrorCode; message: string };

export function applyGameAction(state: RoomState, actorId: string, action: Action, randomInt: (max: number) => number): GameResult {
  const fail = (message: string, code: ErrorCode = "INVALID_ACTION"): GameResult => ({ ok: false, code, message });
  const actor = state.players.find(p => p?.id === actorId);
  if (!actor || actor.forfeited || !actor.connected) return fail("게임에 참여할 수 없는 플레이어입니다.", "UNAUTHORIZED");
  if (state.phase === "finished") return fail("이미 종료된 경기입니다.");
  const next = structuredClone(state);
  const player = next.players.find(p => p?.id === actorId)!;
  if (action.type === "setReady") {
    if (state.phase !== "waiting") return fail("대기실에서만 준비할 수 있습니다.");
    player.ready = action.ready;
    const participants = activePlayers(next);
    if (participants.length >= 2 && participants.every(p => p.connected && p.ready)) {
      next.phase = "playing";
      next.currentPlayerId = participants[randomInt(participants.length)]!.id;
      if(next.mode === "augment") initAugment(next, randomInt);
    }
  } else {
    if (state.phase !== "playing") return fail("아직 경기가 시작되지 않았습니다.");
    if (activePlayers(state).some(p => !p.connected)) return fail("플레이어의 재접속을 기다리고 있습니다.", "GAME_PAUSED");
    if (action.type === "augment") {
      if(!next.augment) return fail("증강 모드에서만 사용할 수 있습니다.");
      try { useAugment(next,player,action.command,randomInt); } catch(e) { return fail((e as Error).message); }
      next.revision++; return {ok:true,state:next};
    }
    if(state.augment?.drafting) return fail("모두 증강을 선택하면 시작합니다.");
    if (state.currentPlayerId !== actorId) return fail("상대 플레이어의 차례입니다.");
    if(state.augment?.turn.pending) return fail("진행 중인 능력 선택을 먼저 마쳐주세요.");
    if(state.augment?.turn.fork && !["roll","startShake"].includes(action.type)) return fail("평행 던지기의 결과를 먼저 골라주세요.");
    if (state.rollPhase === "throwing") return fail("주사위가 멈출 때까지 기다려주세요.");
    if (state.rollPhase === "shaking" && action.type !== "roll") return fail("흔들기를 멈춘 후 조작해주세요.");
    if (action.type === "roll" || action.type === "startShake") {
      if (state.augment?.turn.chooseOld || state.augment?.turn.flags.includes("final")) return fail("최종 결과를 선택하고 점수를 기록하세요.");
      if (!state.augment?.turn.reroll && state.rollCount >= (state.augment?.turn.maxRolls ?? 3)) return fail("남은 일반 굴림 횟수가 없습니다.");
      if(action.type === "startShake" && next.augment)prepareAugmentRoll(next,randomInt);
      if (state.rollCount > 0 && next.held.every(Boolean)) return fail("다시 굴릴 주사위를 선택하세요.");
      if (action.type === "startShake") {
        next.rollPhase = "shaking";
      } else {
        if (state.rollPhase !== "shaking") return fail("먼저 흔들기를 시작해주세요.");
        next.rollPhase = "throwing";
      }
    } else if (action.type === "setHolds") {
      if (!state.rollCount) return fail("먼저 주사위를 굴려주세요.");
      if(action.held.length!==state.dice.length) return fail("주사위 개수가 맞지 않습니다.");
      if(state.augment?.turn.reroll)return fail("진행 중인 무료 재굴림을 먼저 완료하세요.");
      if(state.augment?.turn.locked!=null&&!action.held[state.augment.turn.locked])return fail("강제 고정된 주사위는 해제할 수 없습니다.");
      if(state.augment?.turn.fixed?.some(i=>!action.held[i])) return fail("인질 주사위는 이번 턴 끝까지 보관해야 해요.");
      next.held = [...action.held];
      const curse = state.players.find(p => p?.id === actorId)?.augment?.curse;
      if (curse?.active && curse.id === "butterFingers" && action.held.filter(Boolean).length > 1)
        return fail("손에 버터! 이번 턴에는 1개만 보관할 수 있어요.");
      if (curse?.active && curse.id === "parkingTicket" && action.held.filter(Boolean).length >= 3 && !next.augment!.turn.flags.includes("parkingViolation"))
        next.augment!.turn.flags.push("parkingViolation");
      if(next.augment){
        const t=next.augment.turn;
        if(state.rollCount===1) t.kept=action.held.flatMap((v,i)=>v&&!t.flags.includes(`rerolled:${i}`)?[i]:[]);
        else t.kept=t.kept.filter(i=>action.held[i]);
      }
    } else {
      if (!state.rollCount || state.dice.some(n => n === null)) return fail("먼저 주사위를 굴려주세요.");
      if (player.scores[action.category] !== null) return fail("이미 기록한 점수 칸입니다.");
      if(next.augment) {
        try { recordAugment(next,player,action.category); } catch(e) { return fail((e as Error).message); }
        advanceAugment(next,randomInt);
        settleGame(next);next.revision++;return {ok:true,state:next};
      }
      player.scores[action.category] = categoryScore(action.category, state.dice as number[]);
      settleGame(next);
      if (next.phase === "playing") {
        next.currentPlayerId = nextPlayerId(next, actorId);
        resetTurn(next);
      }
    }
  }
  next.revision++;
  return { ok: true, state: next };
}


/** Only server physics may complete a roll; no client command accepts its result. */
export function completeRoll(state: RoomState, dice: RoomState["dice"], motion: NonNullable<RoomState["motion"]>): RoomState {
  if (state.rollPhase !== "throwing" || state.motion?.id !== motion.id || motion.phase !== "rest") return state;
  const monster=state.augment?.turn.monster;
  if (dice.length!==state.dice.length || dice.some((n, i) => n === null || !Number.isInteger(n) || n < 1 || n > (monster&&!monster.split&&monster.index===i?12:6) || (state.held[i] && n !== state.dice[i]))) throw new Error("Invalid physical result");
  const next:RoomState = { ...state, dice: [...dice], motion, rollPhase: "idle", rollCount: state.rollCount + 1, revision: state.revision + 1 };
  return next;
}
