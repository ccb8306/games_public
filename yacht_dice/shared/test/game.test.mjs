import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { completeRoll, categoryScore, totals, emptyScorecard, applyGameAction, SCORE_CATEGORIES, roomStateSchema } from "../dist/index.js";

function initial() {
  return { roomId: randomUUID(), code: "ABC12345", phase: "waiting", players: [0, 1].map(slot => ({ id: randomUUID(), slot, nickname: `P${slot}`, connected: true, ready: false, scores: emptyScorecard() })), currentPlayerId: null, dice: [null, null, null, null, null], held: [false, false, false, false, false], rollCount: 0, rollPhase: "idle", revision: 0, reconnectDeadline: null, outcome: null };
}
function action(state, player, type, extra = {}, rng = () => 2) {
  return applyGameAction(state, player, { type, requestId: randomUUID(), roomId: state.roomId, expectedRevision: state.revision, ...extra }, rng);
}
function started() {
  let state = initial();
  state = action(state, state.players[0].id, "setReady", { ready: true }, () => 0).state;
  return action(state, state.players[1].id, "setReady", { ready: true }, () => 0).state;
}

function shakeAndRoll(state, player, rng = () => 2) {
  const start = action(state, player, "startShake");
  if (!start.ok) return start;
  const result = action(start.state, player, "roll");
  return result.ok ? {ok:true,state:physicalResult(result.state,rng)} : result;
}

function physicalResult(state, rng=()=>2) {
  const frame={id:randomUUID(),seq:1,at:Date.now(),phase:"rest",dice:Array.from({length:5},()=>({p:[0,.48,0],q:[0,0,0,1]})),cup:null,wind:false,paused:false};
  state={...state,motion:frame};
  return completeRoll(state,state.dice.map((d,i)=>state.held[i]?d:rng(6)+1),frame);
}

test("흔들기는 난수와 횟수를 소비하지 않고 멈춤만 게임 행동으로 허용한다", () => {
  let state = started();
  const actor = state.currentPlayerId;
  assert.equal(action(state, actor, "roll").ok, false);
  const before = structuredClone(state);
  let calls = 0;
  state = action(state, actor, "startShake", {}, () => { calls++; return 4; }).state;
  assert.equal(calls, 0);
  assert.equal(state.rollPhase, "shaking");
  assert.equal(state.rollCount, 0);
  assert.deepEqual(state.dice, before.dice);
  assert.equal(action(state, actor, "startShake").ok, false);
  assert.equal(action(state, actor, "setHolds", { held: [true, false, false, false, false] }).ok, false);
  assert.equal(action(state, actor, "score", { category: "choice" }).ok, false);
  state = action(state, actor, "roll", {}, () => { calls++; return 4; }).state;
  assert.equal(calls, 0);
  assert.equal(state.rollPhase,"throwing");
  assert.equal(state.rollCount,0);
  assert.equal(action(state,actor,"score",{category:"choice"}).ok,false);
  state=physicalResult(state,()=>4);
  assert.equal(state.rollPhase, "idle");
  assert.equal(state.rollCount, 1);
  assert.equal(action(state, actor, "roll").ok, false);
  state = action(state, actor, "setHolds", { held: [true, true, true, true, true] }).state;
  assert.equal(action(state, actor, "startShake").ok, false);
  state.held = [false, false, false, false, false];
  state.rollCount = 3;
  assert.equal(action(state, actor, "startShake").ok, false);
});

test("점수 규칙과 보너스 경계", () => {
  const examples = [
    ["ones", [1,1,2,3,4], 2], ["twos", [2,2,2,3,4], 6], ["threes", [3,3,2,1,4], 6],
    ["fours", [4,4,4,4,4], 20], ["fives", [5,1,1,1,1], 5], ["sixes", [6,6,6,6,6], 30],
    ["choice", [1,2,3,4,5], 15], ["fourOfAKind", [2,2,2,2,6], 14], ["fourOfAKind", [2,2,2,6,6], 0],
    ["fullHouse", [2,2,2,6,6], 18], ["fullHouse", [2,2,2,2,6], 0], ["fullHouse", [3,3,3,3,3], 15],
    ["smallStraight", [1,2,2,3,4], 15], ["smallStraight", [1,2,3,5,6], 0],
    ["largeStraight", [6,2,5,3,4], 30], ["largeStraight", [1,2,2,3,4], 0],
    ["yacht", [3,3,3,3,3], 50], ["yacht", [3,3,3,3,4], 0],
  ];
  for (const [category, dice, score] of examples) assert.equal(categoryScore(category, dice), score, `${category} ${dice}`);
  const scores = { ...emptyScorecard(), ones: 3, twos: 6, threes: 9, fours: 12, fives: 20, sixes: 12 };
  assert.equal(totals(scores).bonus, 0);
  scores.ones = 4;
  assert.deepEqual(totals(scores), { upper: 63, bonus: 35, total: 98 });
});

test("턴 권한, 보관 재굴림, 무효 명령은 기존 상태를 바꾸지 않음", () => {
  let state = started();
  const actor = state.currentPlayerId, other = state.players[1].id;
  const untouched = structuredClone(state);
  assert.equal(action(state, actor, "score", { category: "yacht" }).ok, false);
  assert.equal(action(state, other, "roll").ok, false);
  assert.deepEqual(state, untouched);
  state = shakeAndRoll(state, actor).state;
  state = action(state, actor, "setHolds", { held: [true,false,false,false,false] }).state;
  state = shakeAndRoll(state, actor, () => 5).state;
  assert.deepEqual(state.dice, [3,6,6,6,6]);
  state = shakeAndRoll(state, actor, () => 5).state;
  assert.equal(action(state, actor, "roll").ok, false);
  state = action(state, actor, "score", { category: "yacht" }).state;
  assert.equal(state.players[0].scores.yacht, 0);
  state = shakeAndRoll(state, other).state;
  state = action(state, other, "score", { category: "choice" }).state;
  state = shakeAndRoll(state, actor).state;
  assert.equal(action(state, actor, "score", { category: "yacht" }).ok, false);
  state = action(state, actor, "setHolds", { held: [true,true,true,true,true] }).state;
  assert.equal(action(state, actor, "roll").ok, false);
});

test("24턴 완료와 무승부, 종료 뒤 행동 금지", () => {
  let state = started();
  for (const category of SCORE_CATEGORIES) for (let player = 0; player < 2; player++) {
    const id = state.currentPlayerId;
    state = shakeAndRoll(state, id).state;
    state = action(state, id, "score", { category }).state;
    assert.equal(roomStateSchema.safeParse(state).success, true);
  }
  assert.equal(state.phase, "finished");
  assert.equal(state.outcome.kind, "draw");
  assert.equal(action(state, state.players[0].id, "roll").ok, false);
});
