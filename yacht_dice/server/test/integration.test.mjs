import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { avatarPng } from "../../shared/test/avatar-fixture.mjs";
import { WebSocket } from "ws";
import { createApp } from "../dist/app.js";
import { SCORE_CATEGORIES, decodeServerMessage } from "../../shared/dist/index.js";

async function setup(t, options = {}) {
  let clock = Date.now();
  const app = createApp({ ...options, now: () => clock });
  await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
  t.after(() => app.close());
  const url = `ws://127.0.0.1:${app.server.address().port}/ws`;
  return { app, url, advance(ms) { clock += ms; app.rooms.tick(); } };
}
async function client(url) {
  const ws = new WebSocket(url);
  const messages = [];
  const waits = [];
  const c = { ws, state: null, session: null, send(type, fields = {}) {
    const message = { type, requestId: randomUUID(), ...fields };
    if (c.state && type === "sendChat") Object.assign(message, { roomId: c.state.roomId });
    else if (c.state && !["createRoom", "joinRoom", "resumeRoom"].includes(type)) Object.assign(message, { roomId: c.state.roomId, expectedRevision: c.state.revision });
    ws.send(JSON.stringify(message)); return message;
  }, next(predicate) {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const entry = { predicate, resolve, timer: setTimeout(() => { waits.splice(waits.indexOf(entry), 1); reject(new Error("message timeout")); }, 3000) };
      waits.push(entry);
    });
  }, async command(type, fields = {}) {
    const msg = c.send(type, fields);
    const response = await c.next(m => ["accepted", "rejected"].includes(m.type) && m.requestId === msg.requestId);
    if (response.type === "accepted" && type !== "leaveRoom") await c.next(m => m.type === "roomState" && m.state.revision >= response.revision);
    return response;
  } };
  ws.on("message", raw => {
    const parsed = decodeServerMessage(raw.toString());
    assert.equal(parsed.success, true, raw.toString());
    const m = parsed.data;
    if (m.type === "roomState") c.state = m.state;
    if (m.type === "session") c.session = m;
    const index = waits.findIndex(w => w.predicate(m));
    if (index >= 0) { const [w] = waits.splice(index, 1); clearTimeout(w.timer); w.resolve(m); } else messages.push(m);
  });
  await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
  return c;
}
async function pair(url) {
  const a = await client(url), b = await client(url);
  a.send("createRoom", { nickname: "A" });
  await a.next(m => m.type === "session"); await a.next(m => m.type === "roomState");
  b.send("joinRoom", { nickname: "B", code: a.session.code });
  await b.next(m => m.type === "session"); await b.next(m => m.type === "roomState");
  await a.next(m => m.type === "roomState" && m.state.players.every(Boolean));
  await a.command("setReady", { ready: true });
  await b.next(m => m.type === "roomState" && m.state.players[0].ready);
  await b.command("setReady", { ready: true });
  await a.next(m => m.type === "roomState" && m.state.phase === "playing");
  return [a, b];
}

async function sync(clients, revision) {
  for (const c of clients) if (c.state.revision < revision) await c.next(m => m.type === "roomState" && m.state.revision >= revision);
}
async function group(url, capacity, count = capacity, fields = {}) {
  const clients = [await client(url)];
  clients[0].send("createRoom", { nickname: "P0", capacity, ...fields });
  await clients[0].next(m => m.type === "session"); await clients[0].next(m => m.type === "roomState");
  for (let i = 1; i < count; i++) {
    const c = await client(url);
    c.send("joinRoom", { nickname: `P${i}`, code: clients[0].session.code, avatar: fields.avatar });
    await c.next(m => m.type === "session"); await c.next(m => m.type === "roomState");
    clients.push(c);
    await sync(clients, c.state.revision);
  }
  for (const c of clients) {
    assert.equal((await c.command("setReady", { ready: true })).type, "accepted");
    await sync(clients, c.state.revision);
  }
  return clients;
}

test("3/4 real connections complete full games, including four uploaded profiles and chat", async t => {
  const { url } = await setup(t);
  for (const count of [3, 4]) {
    const avatar = { kind: "upload", dataUrl: avatarPng(true) };
    const clients = await group(url, count, count, { avatar });
    assert.equal(clients[0].state.phase, "playing");
    assert.equal(clients[0].state.capacity, count);
    if (count === 4) assert.ok(Buffer.byteLength(JSON.stringify(clients[0].state)) > 272 * 1024);
    const first = clients[0].state.players.findIndex(p => p.id === clients[0].state.currentPlayerId);
    for (let turn = 0; turn < count * 12; turn++) {
      const actor = clients[(first + turn) % count];
      assert.equal(actor.state.currentPlayerId, actor.session.playerId);
      assert.equal((await actor.command("startShake")).type, "accepted");
      assert.equal((await actor.command("roll")).type, "accepted");
      const category = SCORE_CATEGORIES.find(c => actor.state.players.find(p => p.id === actor.session.playerId).scores[c] === null);
      assert.equal((await actor.command("score", { category })).type, "accepted");
      await sync(clients, actor.state.revision);
    }
    assert.equal(clients[0].state.phase, "finished");
    for (const c of clients) assert.deepEqual(c.state, clients[0].state);
    const send = clients[0].send("sendChat", { text: "다 같이 수고했어요" });
    await clients[0].next(m => m.type === "chatAccepted" && m.requestId === send.requestId);
    for (const c of clients) assert.equal((await c.next(m => m.type === "chatMessage")).message.text, "다 같이 수고했어요");
  }
});

test("underfilled rooms start with two ready players, block late joins and keep room settings independent", async t => {
  const { url, app } = await setup(t, { graceMs: 75000 });
  const two = await group(url, 4, 2, { disconnectGraceSeconds: 5 });
  assert.equal(two[0].state.phase, "playing");
  assert.equal(two[0].state.players.filter(Boolean).length, 2);
  const outsider = await client(url);
  const join = outsider.send("joinRoom", { code: two[0].session.code, nickname: "late" });
  assert.equal((await outsider.next(m => m.type === "rejected" && m.requestId === join.requestId)).code, "ROOM_FULL");
  const solo = await group(url, 3, 1);
  assert.equal(solo[0].state.phase, "waiting");
  assert.equal(solo[0].state.disconnectGraceSeconds, 75);
  assert.equal(app.rooms.rooms.get(two[0].session.code).state.disconnectGraceSeconds, 5);
  two[0].ws.close();
  await two[1].next(m => m.type === "roomState" && !m.state.players[0].connected);
  const deadline = two[1].state.players[0].reconnectDeadline;
  assert.equal(typeof deadline, "number");
  const resumed = await client(url);
  resumed.send("resumeRoom", { code: two[0].session.code, token: two[0].session.token });
  await resumed.next(m => m.type === "session"); await resumed.next(m => m.type === "roomState");
  assert.equal(resumed.state.disconnectGraceSeconds, 5);
  assert.equal(resumed.state.capacity, 4);
  assert.equal(resumed.state.players[0].reconnectDeadline, null);
});

test("four-player forfeits preserve other turns, skip the current player and forbid rejoining", async t => {
  const { url } = await setup(t);
  const clients = await group(url, 4);
  const current = clients.find(c => c.session.playerId === c.state.currentPlayerId);
  const other = clients.find(c => c !== current);
  await current.command("startShake");
  await sync(clients, current.state.revision);
  await other.command("leaveRoom");
  const remaining = clients.filter(c => c !== other);
  await sync(remaining, other.state.revision + 1);
  assert.equal(current.state.phase, "playing");
  assert.equal(current.state.rollPhase, "shaking");
  assert.equal(current.state.players.find(p => p.id === other.session.playerId).forfeited, true);
  const forbidden = await client(url);
  const resume = forbidden.send("resumeRoom", { code: other.session.code, token: other.session.token });
  assert.equal((await forbidden.next(m => m.type === "rejected" && m.requestId === resume.requestId)).code, "UNAUTHORIZED");
  await current.command("leaveRoom");
  const finalTwo = remaining.filter(c => c !== current);
  await sync(finalTwo, current.state.revision + 1);
  assert.equal(finalTwo[0].state.phase, "playing");
  assert.equal(finalTwo[0].state.rollCount, 0);
  assert.equal(finalTwo[0].state.rollPhase, "idle");
  assert.ok(finalTwo.some(c => c.session.playerId === c.state.currentPlayerId));
  await finalTwo[0].command("leaveRoom");
  await finalTwo[1].next(m => m.type === "roomState" && m.state.phase === "finished");
  assert.equal(finalTwo[1].state.outcome.playerId, finalTwo[1].session.playerId);
});

test("staggered expirations wait for the last disconnected player, then expire everyone without a winner", async t => {
  const { url, app, advance } = await setup(t);
  const clients = await group(url, 4, 4, { disconnectGraceSeconds: 5 });
  const code = clients[0].session.code;
  for (const c of clients.slice(0, 3)) c.ws.close();
  await clients[3].next(m => m.type === "roomState" && m.state.players.slice(0, 3).every(p => !p.connected));
  advance(1000);
  clients[3].ws.close();
  await new Promise(resolve => clients[3].ws.once("close", resolve));
  // Wait until the server has handled the close before advancing its clock.
  const probe = await client(url);
  const ping = probe.send("sendChat", { roomId: clients[3].state.roomId, text: "probe" });
  await probe.next(m => m.type === "rejected" && m.requestId === ping.requestId);
  advance(4000);
  const state = app.rooms.rooms.get(code).state;
  assert.equal(state.phase, "playing");
  assert.equal(state.players.filter(p => !p.forfeited).length, 1);
  advance(1000);
  assert.equal(app.rooms.rooms.get(code).state.outcome.kind, "abandoned");
  advance(30000);
  assert.equal(app.rooms.rooms.has(code), false);
});

test("chat shares ordered text, deduplicates, restores 100 messages and does not change game revision", async t => {
  const { url, app, advance } = await setup(t);
  const [a, b] = await pair(url);
  await a.next(m => m.type === "chatHistory");
  await b.next(m => m.type === "chatHistory");
  const revision = a.state.revision;
  const send = a.send("sendChat", { text: "  안녕 <script>hello</script>  " });
  const received = await b.next(m => m.type === "chatMessage");
  const accepted = await a.next(m => m.type === "chatAccepted" && m.requestId === send.requestId);
  assert.equal(received.message.text, "안녕 <script>hello</script>");
  assert.equal(received.message.playerId, a.session.playerId);
  assert.equal(received.message.id, accepted.messageId);
  assert.equal(app.rooms.rooms.get(a.session.code).state.revision, revision);
  a.ws.send(JSON.stringify(send));
  assert.equal((await a.next(m => m.type === "chatAccepted" && m.requestId === send.requestId)).messageId, accepted.messageId);
  assert.equal(app.rooms.rooms.get(a.session.code).chat.length, 1);
  const fast = a.send("sendChat", { text: "too fast" });
  assert.equal((await a.next(m => m.type === "rejected" && m.requestId === fast.requestId)).code, "INVALID_ACTION");
  const active = [a, b].find(c => c.session.playerId === c.state.currentPlayerId);
  assert.equal((await active.command("startShake")).type, "accepted");
  for (let i = 0; i < 101; i++) {
    advance(1000);
    const request = a.send("sendChat", { text: `message ${i}` });
    await a.next(m => m.type === "chatAccepted" && m.requestId === request.requestId);
    assert.equal((await b.next(m => m.type === "chatMessage")).message.text, `message ${i}`);
  }
  const stored = app.rooms.rooms.get(a.session.code);
  assert.equal(stored.chat.length, 100);
  assert.equal(stored.chat[0].text, "message 1");
  assert.equal(stored.state.rollPhase, "shaking");
  const session = a.session;
  a.ws.close();
  await b.next(m => m.type === "roomState" && m.state.players.some(p => !p.connected));
  const pausedChat = b.send("sendChat", { text: "기다릴게요" });
  await b.next(m => m.type === "chatAccepted" && m.requestId === pausedChat.requestId);
  const resumed = await client(url);
  resumed.send("resumeRoom", { code: session.code, token: session.token });
  await resumed.next(m => m.type === "session");
  await resumed.next(m => m.type === "roomState");
  const history = await resumed.next(m => m.type === "chatHistory");
  assert.equal(history.messages.length, 100);
  assert.equal(history.messages.at(-1).text, "기다릴게요");
  advance(1000);
  await resumed.command("leaveRoom");
  await b.next(m => m.type === "roomState" && m.state.phase === "finished");
  const final = b.send("sendChat", { text: "수고했어요" });
  await b.next(m => m.type === "chatAccepted" && m.requestId === final.requestId);
  advance(30_000);
  await b.next(m => m.type === "rejected" && m.code === "ROOM_NOT_FOUND");
  assert.equal(app.rooms.rooms.size, 0);
  const deleted = b.send("sendChat", { text: "expired" });
  assert.equal((await b.next(m => m.type === "rejected" && m.requestId === deleted.requestId)).code, "UNAUTHORIZED");
});

test("chat rejects outsiders, spoofed authors, invalid lengths and isolates rooms; joins restore history", async t => {
  const { url, app } = await setup(t);
  const a = await client(url), outsider = await client(url);
  a.send("createRoom", { nickname: "A" });
  await a.next(m => m.type === "session"); await a.next(m => m.type === "roomState");
  const first = a.send("sendChat", { text: "welcome" });
  await a.next(m => m.type === "chatAccepted" && m.requestId === first.requestId);
  const unauthorized = outsider.send("sendChat", { roomId: a.state.roomId, text: "attack" });
  assert.equal((await outsider.next(m => m.type === "rejected" && m.requestId === unauthorized.requestId)).code, "UNAUTHORIZED");
  for (const fields of [{ text: " " }, { text: "x".repeat(301) }, { text: "spoof", playerId: randomUUID() }]) {
    a.send("sendChat", fields);
    assert.equal((await a.next(m => m.type === "rejected")).code, "INVALID_MESSAGE");
  }
  outsider.send("createRoom", { nickname: "Other" });
  await outsider.next(m => m.type === "session"); await outsider.next(m => m.type === "roomState");
  assert.equal(app.rooms.rooms.get(outsider.session.code).chat.length, 0);
  const b = await client(url);
  b.send("joinRoom", { nickname: "B", code: a.session.code });
  await b.next(m => m.type === "session");
  assert.equal((await b.next(m => m.type === "chatHistory")).messages[0].text, "welcome");
});

test("uploaded profiles are shared, survive reconnect, and expire with the room", async t => {
  const { url, app, advance } = await setup(t);
  const a = await client(url), b = await client(url);
  const avatar = { kind: "upload", dataUrl: avatarPng(true) };
  a.send("createRoom", { nickname: "A", avatar });
  await a.next(m => m.type === "session"); await a.next(m => m.type === "roomState");
  b.send("joinRoom", { nickname: "B", code: a.session.code, avatar });
  await b.next(m => m.type === "session"); await b.next(m => m.type === "roomState");
  await a.next(m => m.type === "roomState" && m.state.players.every(Boolean));
  assert.ok(JSON.stringify(b.state).length > 136 * 1024);
  assert.deepEqual(a.state.players.map(p => p.avatar), [avatar, avatar]);
  assert.deepEqual(a.state, b.state);
  const session = a.session;
  a.ws.close();
  await b.next(m => m.type === "roomState" && !m.state.players[0].connected);
  const resumed = await client(url);
  resumed.send("resumeRoom", { code: session.code, token: session.token });
  await resumed.next(m => m.type === "session"); await resumed.next(m => m.type === "roomState");
  assert.deepEqual(resumed.state.players[0].avatar, avatar);
  await resumed.command("leaveRoom");
  await b.next(m => m.type === "roomState" && !m.state.players[0]);
  await b.command("leaveRoom");
  advance(30_000);
  assert.equal(app.rooms.rooms.size, 0);
});

test("서로 다른 연결에서 방 대기, 무효 요청, 중복 방지, 24턴 완료", async t => {
  const { url } = await setup(t);
  const clients = await pair(url);
  const current = clients.find(c => c.session.playerId === c.state.currentPlayerId);
  const other = clients.find(c => c !== current);
  assert.equal((await other.command("roll")).code, "INVALID_ACTION");
  assert.equal((await current.command("score", { category: "yacht" })).code, "INVALID_ACTION");
  assert.equal((await current.command("startShake")).type, "accepted");
  const roll = current.send("roll");
  const accepted = await current.next(m => m.type === "accepted" && m.requestId === roll.requestId);
  await current.next(m => m.type === "roomState" && m.state.revision === accepted.revision);
  const dice = [...current.state.dice];
  current.ws.send(JSON.stringify(roll));
  await current.next(m => m.type === "accepted" && m.requestId === roll.requestId);
  await current.next(m => m.type === "roomState" && m.state.revision === accepted.revision);
  assert.deepEqual(current.state.dice, dice);
  assert.equal(current.state.rollCount, 1);
  const stale = { ...roll, requestId: randomUUID() };
  current.ws.send(JSON.stringify(stale));
  assert.equal((await current.next(m => m.type === "rejected" && m.requestId === stale.requestId)).code, "STALE_REVISION");
  for (let turn = 0; turn < 24; turn++) {
    const c = clients.find(p => p.session.playerId === current.state.currentPlayerId);
    const snapshot = [...clients].sort((a,b) => b.state.revision - a.state.revision)[0].state;
    if (c.state.revision < snapshot.revision) await c.next(m => m.type === "roomState" && m.state.revision >= snapshot.revision);
    if (!c.state.rollCount) {
      assert.equal((await c.command("startShake")).type, "accepted");
      assert.equal((await c.command("roll")).type, "accepted");
    }
    const player = c.state.players.find(p => p.id === c.session.playerId);
    const category = SCORE_CATEGORIES.find(key => player.scores[key] === null);
    assert.equal((await c.command("score", { category })).type, "accepted");
    const otherClient = clients.find(p => p !== c);
    await otherClient.next(m => m.type === "roomState" && m.state.revision >= c.state.revision);
  }
  assert.equal(clients[0].state.phase, "finished");
  assert.deepEqual(clients[0].state, clients[1].state);
});

test("60초 안 재접속, 시간 만료 기권 승, 30초 뒤 방 정리", async t => {
  const { url, app, advance } = await setup(t);
  const [a,b] = await pair(url);
  const old = a.session;
  a.ws.close(); await b.next(m => m.type === "roomState" && m.state.players.some(p => !p.connected));
  advance(59_000);
  const resumed = await client(url);
  resumed.send("resumeRoom", { code: old.code, token: old.token });
  await resumed.next(m => m.type === "session");
  await resumed.next(m => m.type === "roomState");
  assert.equal(resumed.session.playerId, old.playerId);
  await b.next(m => m.type === "roomState" && m.state.players.every(p => p.connected));
  resumed.ws.close(); await b.next(m => m.type === "roomState" && m.state.players.some(p => !p.connected));
  advance(60_000);
  await b.next(m => m.type === "roomState" && m.state.phase === "finished");
  assert.equal(b.state.outcome.playerId, b.session.playerId);
  advance(29_999); assert.equal(app.rooms.rooms.size, 1);
  advance(1); assert.equal(app.rooms.rooms.size, 0);
});

test("자발적 퇴장은 즉시 상대 승리", async t => {
  const { url } = await setup(t);
  const [a,b] = await pair(url);
  assert.equal((await a.command("leaveRoom")).type, "accepted");
  await b.next(m => m.type === "roomState" && m.state.phase === "finished");
  assert.equal(b.state.outcome.playerId, b.session.playerId);
});

test("흔들기 공유·중복 요청·연결 중단 복구·흔드는 중 퇴장", async t => {
  const { url } = await setup(t);
  const clients = await pair(url);
  const current = clients.find(c => c.session.playerId === c.state.currentPlayerId);
  const other = clients.find(c => c !== current);
  const start = current.send("startShake");
  const accepted = await current.next(m => m.type === "accepted" && m.requestId === start.requestId);
  await current.next(m => m.type === "roomState" && m.state.revision === accepted.revision);
  await other.next(m => m.type === "roomState" && m.state.revision === accepted.revision);
  assert.deepEqual(current.state, other.state);
  assert.equal(other.state.rollPhase, "shaking");
  current.ws.send(JSON.stringify(start));
  await current.next(m => m.type === "accepted" && m.requestId === start.requestId);
  await current.next(m => m.type === "roomState" && m.state.revision === accepted.revision);
  assert.equal(current.state.rollCount, 0);
  assert.equal((await current.command("startShake")).code, "INVALID_ACTION");
  assert.equal((await other.command("startShake")).code, "INVALID_ACTION");
  assert.equal((await current.command("setHolds", { held: [true, false, false, false, false] })).code, "INVALID_ACTION");
  assert.equal((await current.command("score", { category: "choice" })).code, "INVALID_ACTION");
  assert.equal((await current.command("roll")).type, "accepted");
  assert.equal((await current.command("setHolds", { held: [true, false, false, false, false] })).type, "accepted");
  assert.equal((await current.command("startShake")).type, "accepted");
  await other.next(m => m.type === "roomState" && m.state.revision === current.state.revision);
  const before = structuredClone(current.state);
  const old = current.session;
  current.ws.close();
  await other.next(m => m.type === "roomState" && m.state.players.some(p => !p.connected));
  assert.equal(other.state.rollPhase, "idle");
  assert.deepEqual(other.state.dice, before.dice);
  assert.deepEqual(other.state.held, before.held);
  assert.equal(other.state.rollCount, before.rollCount);
  const resumed = await client(url);
  resumed.send("resumeRoom", { code: old.code, token: old.token });
  await resumed.next(m => m.type === "session");
  await resumed.next(m => m.type === "roomState");
  assert.equal(resumed.state.rollPhase, "idle");
  assert.equal((await resumed.command("roll")).code, "INVALID_ACTION");
  assert.equal((await resumed.command("startShake")).type, "accepted");
  assert.equal((await resumed.command("leaveRoom")).type, "accepted");
  await other.next(m => m.type === "roomState" && m.state.phase === "finished");
  assert.equal(other.state.rollPhase, "idle");
  assert.equal(other.state.outcome.playerId, other.session.playerId);
});
