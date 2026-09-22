import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyScorecard, type RoomState } from "@yacht/shared";
import { DiceTray } from "../src/components/DiceTray";
import { AppHeader } from "../src/components/AppHeader";
import { ScoreTable } from "../src/components/ScoreTable";
import { GameScreen } from "../src/screens/GameScreen";
import { EntryScreen } from "../src/screens/EntryScreen";
import { LobbyScreen } from "../src/screens/LobbyScreen";
import { socketUrl, requestId } from "../src/network/protocol";
import { readSession, writeSession } from "../src/network/session";

const noop = () => {};

test("room code and leave control share the brand header", () => {
  const html = renderToStaticMarkup(
    <AppHeader
      room={room()}
      connected
      busy={false}
      expired={false}
      onLeave={noop}
    />,
  );
  assert.match(
    html,
    /^<header class="topbar">.*YACHT.*방 ABCDEF12.*방 나가기.*<\/header>$/,
  );
  const locked = renderToStaticMarkup(
    <AppHeader
      room={room()}
      connected={false}
      busy={false}
      expired={false}
      onLeave={noop}
    />,
  );
  assert.match(locked, /disabled=""/);
  const entry = renderToStaticMarkup(
    <AppHeader
      room={null}
      connected
      busy={false}
      expired={false}
      onLeave={noop}
    />,
  );
  assert.doesNotMatch(entry, /방 나가기/);
});

test("score table has the requested three groups and presentation names", () => {
  const html = renderToStaticMarkup(
    <ScoreTable
      room={room()}
      playerId="a"
      selected={null}
      canScore
      onSelect={noop}
    />,
  );
  const groups = [...html.matchAll(/<tbody[^>]*>(.*?)<\/tbody>/g)];
  const rows = groups.map((group) =>
    [...group[1]!.matchAll(/<th scope="row">(.*?)<\/th>/g)].map(
      (row) => row[1],
    ),
  );
  assert.deepEqual(rows, [
    [
      "ones",
      "twos",
      "threes",
      "fours",
      "fives",
      "sixes",
      "보너스 (35)",
      "상단 합계",
    ],
    [
      "초이스",
      "포 오브 카인드",
      "풀하우스",
      "스몰 스트레이트 (15)",
      "라지 스트레이트 (30)",
      "요트 (50)",
      "하단 합계",
    ],
    ["총점"],
  ]);
  assert.match(html, /ones 0점 선택/);
  assert.match(html, /포 오브 카인드 15점 선택/);
  assert.doesNotMatch(html, /포커/);
});
test("subtotals sum recorded groups independently and exclude the upper bonus", () => {
  const state = room();
  Object.assign(state.players[0]!.scores, {
    ones: 3,
    twos: 6,
    threes: 9,
    fours: 12,
    fives: 15,
    sixes: 18,
    choice: 20,
    fourOfAKind: 0,
    fullHouse: 15,
    smallStraight: 15,
    largeStraight: 30,
    yacht: 50,
  });
  Object.assign(state.players[1]!.scores, { ones: 1, choice: 7, yacht: 0 });
  const render = () =>
    renderToStaticMarkup(
      <ScoreTable
        room={state}
        playerId="a"
        selected={null}
        canScore={false}
        onSelect={noop}
      />,
    );
  const html = render();
  assert.match(
    html,
    /class="subtotal"><th scope="row">상단 합계<\/th><td>63<small> \/ 63<\/small><\/td><td>1<small>/,
  );
  assert.match(
    html,
    /class="subtotal"><th scope="row">하단 합계<\/th><td>130<\/td><td>7<\/td>/,
  );
  assert.match(html, /<th scope="row">총점<\/th><td>228<\/td><td>8<\/td>/);
  state.players[1]!.scores = emptyScorecard();
  assert.match(render(), /하단 합계<\/th><td>130<\/td><td>0<\/td>/);
});

function room(): RoomState {
  return {
    roomId: "room",
    capacity: 2,
    disconnectGraceSeconds: 60,
    code: "ABCDEF12",
    phase: "playing",
    revision: 1,
    players: [
      {
        id: "a",
        slot: 0,
        forfeited: false,
        reconnectDeadline: null,
        nickname: "하나",
        connected: true,
        ready: true,
        scores: emptyScorecard(),
      },
      {
        id: "b",
        slot: 1,
        forfeited: false,
        reconnectDeadline: null,
        nickname: "둘",
        connected: true,
        ready: true,
        scores: emptyScorecard(),
      },
    ],
    currentPlayerId: "a",
    dice: [3, 3, 3, 3, 3],
    held: [true, false, false, false, false],
    rollCount: 1,
    rollPhase: "idle",
    reconnectDeadline: null,
    outcome: null,
  };
}

test("dice preserve five controls, hold state and disabled state", () => {
  const state = room();
  const html = renderToStaticMarkup(
    <DiceTray dice={state.dice} held={state.held} disabled onHolds={noop} />,
  );
  assert.equal((html.match(/<button/g) ?? []).length, 5);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 5);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(html, /1번 주사위 3, 보관 중/);
});

test("score table shows previews only for playable empty own cells, including zero", () => {
  const state = room();
  state.players[0]!.scores.ones = 0;
  const html = renderToStaticMarkup(
    <ScoreTable
      room={state}
      playerId="a"
      selected="yacht"
      canScore
      onSelect={noop}
    />,
  );
  assert.equal((html.match(/class="preview-score"/g) ?? []).length, 11);
  assert.match(html, /요트 \(50\) 50점 선택/);
  assert.match(html, /풀하우스 15점 선택/);
  assert.match(html, /<td data-category="ones">0<\/td>/);
  const locked = renderToStaticMarkup(
    <ScoreTable
      room={state}
      playerId="a"
      selected={null}
      canScore={false}
      onSelect={noop}
    />,
  );
  assert.doesNotMatch(locked, /preview-score/);
});

test("game locks opponent and disconnected turns and renders terminal results", () => {
  const state = room();
  const render = (playerId: string) =>
    renderToStaticMarkup(
      <GameScreen
        room={state}
        playerId={playerId}
        connected
        busy={false}
        onRoll={noop}
        onStartShake={noop}
        onHolds={noop}
        onScore={noop}
        onLeave={noop}
      />,
    );
  assert.match(render("a"), /preview-score/);
  assert.ok(
    render("a").indexOf('class="score-panel panel"') <
      render("a").indexOf('class="table-area panel"'),
  );
  assert.doesNotMatch(render("b"), /preview-score/);
  state.players[1]!.connected = false;
  assert.match(render("a"), /재접속을 기다리고 있어요/);
  assert.doesNotMatch(render("a"), /preview-score/);
  state.phase = "finished";
  state.outcome = { kind: "winner", playerId: "a", reason: "forfeit" };
  assert.match(render("a"), /하나 승리!/);
  assert.doesNotMatch(render("a"), /dice-tray/);
  state.outcome = { kind: "draw", reason: "score", playerIds: ["a", "b"] };
  assert.match(render("a"), /공동 승리!/);
});

test("entry and lobby render without mounting a connection", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { search: "?room=abcdef12", origin: "http://lan:3000" },
  });
  try {
    const entry = renderToStaticMarkup(
      <EntryScreen
        nickname="하나"
        code="ABCDEF12"
        onNicknameChange={noop}
        onCodeChange={noop}
        connected
        busy={false}
        onCreate={noop}
        onJoin={noop}
      />,
    );
    assert.match(entry, /value="ABCDEF12"/);
    const state = room();
    state.phase = "waiting";
    state.players[1] = null;
    const lobby = renderToStaticMarkup(
      <LobbyScreen
        room={state}
        playerId="a"
        connected
        busy={false}
        onReady={noop}
      />,
    );
    assert.match(lobby, /http:\/\/lan:3000\/\?room=ABCDEF12/);
    assert.match(lobby, /빈 자리/);
    assert.match(lobby, /준비 취소/);
  } finally {
    if (original) Object.defineProperty(globalThis, "location", original);
    else Reflect.deleteProperty(globalThis, "location");
  }
});

test("network utilities preserve LAN URLs, request IDs and tab sessions", () => {
  assert.equal(
    socketUrl({ protocol: "http:", host: "lan:3000" }),
    "ws://lan:3000/ws",
  );
  assert.equal(
    socketUrl({ protocol: "https:", host: "host" }),
    "wss://host/ws",
  );
  assert.match(
    requestId(),
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  let data: string | null = null;
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: () => data,
      setItem: (_key: string, value: string) => {
        data = value;
      },
      removeItem: () => {
        data = null;
      },
    },
  });
  try {
    const session = {
      code: "ABCDEF12",
      token: "secret",
      playerId: "a",
      roomId: "room",
    };
    writeSession(session);
    assert.deepEqual(readSession(), session);
    writeSession(null);
    assert.equal(readSession(), null);
    data = "broken JSON";
    assert.equal(readSession(), null);
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    assert.equal(readSession(), null);
    assert.doesNotThrow(() => writeSession(session));
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
