import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  SCORE_CATEGORIES,
  decodeClientMessage,
  decodeServerMessage,
  MAX_MESSAGE_BYTES,
  MAX_SERVER_MESSAGE_BYTES,
} from "../dist/index.js";

const requestId = randomUUID();
const roomId = randomUUID();
const playerId = randomUUID();
const scores = Object.fromEntries(SCORE_CATEGORIES.map((category) => [category, null]));

const state = {
  roomId,
  code: "ABC123",
  phase: "waiting",
  players: [
    { id: playerId, slot: 0, nickname: "플레이어", connected: true, ready: false, scores },
    null,
  ],
  currentPlayerId: null,
  dice: [null, null, null, null, null],
  held: [false, false, false, false, false],
  rollCount: 0,
  rollPhase: "idle",
  revision: 0,
  reconnectDeadline: null,
  outcome: null,
};

test("정상적인 명령과 공개 상태를 읽는다", () => {
  const base = { requestId, roomId, expectedRevision: 0 };
  const commands = [
    { type: "createRoom", requestId, nickname: "플레이어" },
    { type: "joinRoom", requestId, code: "ABC123", nickname: "상대" },
    { type: "resumeRoom", requestId, code: "ABC123", token: "a".repeat(32) },
    { type: "setReady", ...base, ready: true },
    { type: "roll", ...base },
    { type: "startShake", ...base },
    { type: "setHolds", ...base, held: [true, false, false, false, false] },
    { type: "score", ...base, category: "yacht" },
    { type: "leaveRoom", ...base },
  ];
  const responses = [
    { type: "accepted", requestId, revision: 1 },
    { type: "rejected", requestId, code: "INVALID_ACTION", message: "현재는 할 수 없습니다." },
    { type: "roomState", state },
    { type: "session", requestId, roomId, code: "ABC123", playerId, token: "a".repeat(32) },
  ];

  for (const command of commands) {
    assert.equal(decodeClientMessage(JSON.stringify(command)).success, true, command.type);
  }
  for (const response of responses) {
    assert.equal(decodeServerMessage(JSON.stringify(response)).success, true, response.type);
  }
});

test("누락된 요청 ID, 잘못된 점수 칸, 잘못된 보관 배열을 거부한다", () => {
  assert.equal(decodeClientMessage(JSON.stringify({ type: "createRoom", nickname: "플레이어" })).success, false);
  assert.equal(decodeClientMessage(JSON.stringify({ type: "score", requestId, roomId, expectedRevision: 0, category: "bonus" })).success, false);
  assert.equal(decodeClientMessage(JSON.stringify({ type: "setHolds", requestId, roomId, expectedRevision: 0, held: [true, false] })).success, false);
});

test("0점은 확정 점수이고 비밀 토큰은 공개 상태에 넣을 수 없다", () => {
  const zeroScoreState = structuredClone(state);
  zeroScoreState.players[0].scores.yacht = 0;
  assert.equal(decodeServerMessage(JSON.stringify({ type: "roomState", state: zeroScoreState })).success, true);

  const leakedState = structuredClone(state);
  leakedState.players[0].token = "a".repeat(32);
  assert.equal(decodeServerMessage(JSON.stringify({ type: "roomState", state: leakedState })).success, false);
});

test("잘못된 JSON과 크기 제한 초과를 거부한다", () => {
  assert.equal(decodeClientMessage("{").success, false);
  assert.equal(decodeClientMessage("x".repeat(MAX_MESSAGE_BYTES + 1)).success, false);
});

test("maximum chat history fits the response limit and chat has no game revision or author input", () => {
  const send = { type: "sendChat", requestId, roomId, text: "  안녕하세요  " };
  assert.equal(decodeClientMessage(JSON.stringify(send)).data.text, "안녕하세요");
  assert.equal(decodeClientMessage(JSON.stringify({ ...send, expectedRevision: 1 })).success, false);
  assert.equal(decodeClientMessage(JSON.stringify({ ...send, nickname: "위조" })).success, false);
  const messages = Array.from({ length: 100 }, () => ({ id: randomUUID(), playerId, nickname: "가".repeat(20), text: "\u0001".repeat(300), sentAt: Date.now() }));
  const response = JSON.stringify({ type: "chatHistory", roomId, messages });
  assert.ok(Buffer.byteLength(response) < MAX_SERVER_MESSAGE_BYTES);
  assert.equal(decodeServerMessage(response).success, true);
  assert.equal(decodeServerMessage(JSON.stringify({ type: "chatHistory", roomId, messages: [...messages, messages[0]] })).success, false);
});
