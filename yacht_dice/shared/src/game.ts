import { SCORE_CATEGORIES, type PublicPlayer, type ScoreCategory, type Scorecard, type RoomState, type ClientMessage, type ErrorCode } from "./index.js";

export function emptyScorecard(): Scorecard {
  return Object.fromEntries(SCORE_CATEGORIES.map(key => [key, null])) as Scorecard;
}

export function categoryScore(category: ScoreCategory, dice: readonly number[]): number {
  if (dice.length !== 5 || dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) throw new Error("주사위 5개의 눈은 1~6이어야 합니다.");
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
    case "fullHouse": return counts.includes(5) || (counts.includes(3) && counts.includes(2)) ? sum : 0;
    case "smallStraight": return longest >= 4 ? 15 : 0;
    case "largeStraight": return longest === 5 ? 30 : 0;
    case "yacht": return counts.includes(5) ? 50 : 0;
    default: throw new Error("알 수 없는 점수 칸입니다.");
  }
}

export function totals(scores: Scorecard) {
  const upper = SCORE_CATEGORIES.slice(0, 6).reduce((sum, key) => sum + (scores[key] ?? 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  return { upper, bonus, total: Object.values(scores).reduce<number>((sum, n) => sum + (n ?? 0), 0) + bonus };
}

type Action = Extract<ClientMessage, { type: "setReady" | "startShake" | "roll" | "setHolds" | "score" }>;

export function activePlayers(state: RoomState): PublicPlayer[] {
  return state.players.filter((p): p is PublicPlayer => !!p && !p.forfeited);
}
function complete(player: PublicPlayer) { return Object.values(player.scores).every(n => n !== null); }
export function nextPlayerId(state: RoomState, afterId: string): string | null {
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
  state.rollPhase = "idle";
}
export function standings(state: RoomState) {
  const ranked = activePlayers(state).sort((a, b) => totals(b.scores).total - totals(a.scores).total || a.slot - b.slot);
  return state.players.filter((p): p is PublicPlayer => !!p).map(player => ({
    player, total: totals(player.scores).total,
    rank: player.forfeited ? null : ranked.filter(p => totals(p.scores).total > totals(player.scores).total).length + 1,
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
    const maximum = Math.max(...active.map(p => totals(p.scores).total));
    const winners = active.filter(p => totals(p.scores).total === maximum).map(p => p.id);
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
    }
  } else {
    if (state.phase !== "playing") return fail("아직 경기가 시작되지 않았습니다.");
    if (activePlayers(state).some(p => !p.connected)) return fail("플레이어의 재접속을 기다리고 있습니다.", "GAME_PAUSED");
    if (state.currentPlayerId !== actorId) return fail("상대 플레이어의 차례입니다.");
    if (state.rollPhase === "shaking" && action.type !== "roll") return fail("흔들기를 멈춘 후 조작해주세요.");
    if (action.type === "roll" || action.type === "startShake") {
      if (state.rollCount >= 3) return fail("주사위는 세 번까지 굴릴 수 있습니다.");
      if (state.rollCount > 0 && state.held.every(Boolean)) return fail("다시 굴릴 주사위를 선택하세요.");
      if (action.type === "startShake") {
        next.rollPhase = "shaking";
      } else {
        if (state.rollPhase !== "shaking") return fail("먼저 흔들기를 시작해주세요.");
        next.dice = state.dice.map((die, i) => state.rollCount > 0 && state.held[i] ? die : randomInt(6) + 1) as RoomState["dice"];
        next.rollCount++;
        next.rollPhase = "idle";
      }
    } else if (action.type === "setHolds") {
      if (!state.rollCount) return fail("먼저 주사위를 굴려주세요.");
      next.held = [...action.held];
    } else {
      if (!state.rollCount || state.dice.some(n => n === null)) return fail("먼저 주사위를 굴려주세요.");
      if (player.scores[action.category] !== null) return fail("이미 기록한 점수 칸입니다.");
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
