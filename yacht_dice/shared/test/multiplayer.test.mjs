import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { completeRoll, roomStateSchema, clientMessageSchema, applyGameAction, emptyScorecard, SCORE_CATEGORIES, settleGame, standings, nextPlayerId } from "../dist/index.js";

function room(capacity, slots = Array.from({ length: capacity }, (_, i) => i)) {
  return roomStateSchema.parse({ roomId: randomUUID(), code: "ABCDEF12", capacity, disconnectGraceSeconds: 60, phase: "waiting", players: Array.from({ length: capacity }, (_, slot) => slots.includes(slot) ? { id: randomUUID(), slot, nickname: `P${slot}`, connected: true, ready: false, scores: emptyScorecard() } : null), currentPlayerId: null, dice: [null, null, null, null, null], held: [false, false, false, false, false], rollCount: 0, rollPhase: "idle", revision: 0, reconnectDeadline: null, outcome: null });
}
function command(state, id, type, fields = {}, random = () => 0) {
  const result = applyGameAction(state, id, { type, ...fields, requestId: randomUUID(), roomId: state.roomId, expectedRevision: state.revision }, random);
  assert.equal(result.ok, true, result.message);
  if(type==="roll") {
    const frame={id:randomUUID(),seq:1,at:Date.now(),phase:"rest",dice:Array.from({length:5},()=>({p:[0,.48,0],q:[0,0,0,1]})),cup:null,wind:false,paused:false};
    result.state.motion=frame;
    return completeRoll(result.state,[1,1,1,1,1],frame);
  }
  return result.state;
}
function start(state, first = 0) {
  for (const p of state.players.filter(Boolean)) state = command(state, p.id, "setReady", { ready: true }, max => { assert.equal(max, state.players.filter(Boolean).length); return first; });
  return state;
}

test("2/3/4 players finish 24/36/48 turns in slot order and share the top rank", () => {
  for (const count of [2, 3, 4]) {
    let state = start(room(count), count - 1);
    const first = state.currentPlayerId;
    let turns = 0;
    while (state.phase === "playing") {
      const actor = state.players.find(p => p?.id === state.currentPlayerId);
      const expected = state.players[(count - 1 + turns) % count];
      assert.equal(actor.id, expected.id);
      state = command(state, actor.id, "startShake");
      state = command(state, actor.id, "roll");
      state = command(state, actor.id, "score", { category: SCORE_CATEGORIES.find(c => actor.scores[c] === null) });
      assert.equal(roomStateSchema.safeParse(state).success, true);
      turns++;
      assert.ok(turns <= count * 12);
    }
    assert.equal(turns, count * 12);
    assert.equal(state.outcome.kind, "draw");
    assert.equal(state.outcome.playerIds.length, count);
    assert.ok(state.outcome.playerIds.includes(first));
    assert.deepEqual(standings(state).map(row => row.rank), Array(count).fill(1));
  }
});

test("a single ready player waits; two ready players start below capacity and skip empty slots", () => {
  let solo = room(4, [0]);
  solo = command(solo, solo.players[0].id, "setReady", { ready: true });
  assert.equal(solo.phase, "waiting");
  let state = room(4, [1, 3]);
  state = command(state, state.players[1].id, "setReady", { ready: true });
  assert.equal(state.phase, "waiting");
  state = command(state, state.players[3].id, "setReady", { ready: true }, () => 1);
  assert.equal(state.phase, "playing");
  assert.equal(state.currentPlayerId, state.players[3].id);
  assert.equal(nextPlayerId(state, state.currentPlayerId), state.players[1].id);
});

test("forfeit preserves another player's turn, skips current forfeiter and waits for the last disconnected player", () => {
  const state = start(room(4));
  state.rollCount = 1; state.dice = [3, 3, 3, 3, 3]; state.held[0] = true;
  state.players[2].forfeited = true; state.players[2].connected = false;
  settleGame(state);
  assert.equal(state.phase, "playing");
  assert.equal(state.currentPlayerId, state.players[0].id);
  assert.equal(state.rollCount, 1);
  state.players[0].forfeited = true; state.players[0].connected = false;
  settleGame(state);
  assert.equal(state.currentPlayerId, state.players[1].id);
  assert.equal(state.rollCount, 0);
  assert.deepEqual(state.dice, [null, null, null, null, null]);
  state.players[1].forfeited = true;
  state.players[3].connected = false;
  settleGame(state);
  assert.equal(state.phase, "playing");
  state.players[3].connected = true;
  settleGame(state);
  assert.deepEqual(state.outcome, { kind: "winner", playerId: state.players[3].id, reason: "forfeit" });
  const all = start(room(4));
  all.players.forEach(p => { p.forfeited = true; p.connected = false; });
  settleGame(all);
  assert.equal(all.outcome.kind, "abandoned");
});

test("rankings exclude forfeits, handle partial ties and skip completed scorecards", () => {
  const state = start(room(4));
  state.players.forEach(p => { p.scores = Object.fromEntries(SCORE_CATEGORIES.map(c => [c, 0])); });
  state.players[0].scores.choice = 20;
  state.players[1].scores.choice = 20;
  state.players[2].scores.choice = 10;
  state.players[3].scores.choice = 30;
  state.players[3].forfeited = true;
  settleGame(state);
  assert.deepEqual(state.outcome.playerIds, state.players.slice(0, 2).map(p => p.id));
  assert.deepEqual(standings(state).map(row => row.rank), [1, 1, 3, null]);
  state.phase = "playing"; state.outcome = null;
  state.players[2].scores.yacht = null;
  assert.equal(nextPlayerId(state, state.players[0].id), state.players[2].id);
  const rejected = applyGameAction(state, state.players[3].id, { type: "startShake" }, () => 0);
  assert.equal(rejected.code, "UNAUTHORIZED");
});

test("room settings and seat/ID uniqueness reject invalid contracts", () => {
  const base = { type: "createRoom", requestId: randomUUID(), nickname: "A" };
  for (const capacity of [0, 1, 5, 2.5]) assert.equal(clientMessageSchema.safeParse({ ...base, capacity }).success, false);
  for (const disconnectGraceSeconds of [0, -1, 1.5, 86401]) assert.equal(clientMessageSchema.safeParse({ ...base, disconnectGraceSeconds }).success, false);
  for (const disconnectGraceSeconds of [1, 60, 86400]) assert.equal(clientMessageSchema.safeParse({ ...base, capacity: 4, disconnectGraceSeconds }).success, true);
  const state = room(4);
  assert.equal(roomStateSchema.safeParse({ ...state, players: state.players.slice(0, 3) }).success, false);
  const copy = structuredClone(state); copy.players[1].id = copy.players[0].id;
  assert.equal(roomStateSchema.safeParse(copy).success, false);
  const wrongSlot = structuredClone(state); wrongSlot.players[1].slot = 0;
  assert.equal(roomStateSchema.safeParse(wrongSlot).success, false);
});
