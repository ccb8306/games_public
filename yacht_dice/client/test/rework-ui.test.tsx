import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import {
  AUGMENTS,
  emptyScorecard,
  initAugment,
  type RoomState,
} from "@yacht/shared";
import { AugmentActionInputs } from "../src/components/AugmentActionInputs";
import { NovelAugmentInputs } from "../src/components/NovelAugmentInputs";
import { NewAugmentInputs } from "../src/components/NewAugmentInputs";
import { PlayerAugments } from "../src/components/PlayerAugments";
function fixture(ids: string[]) {
  const s = {
    roomId: "rework",
    code: "ABCDEFGH",
    mode: "augment",
    phase: "playing",
    capacity: 2,
    disconnectGraceSeconds: 60,
    players: [0, 1].map((slot) => ({
      id: `p${slot}`,
      slot,
      nickname: `P${slot}`,
      scores: emptyScorecard(),
      connected: true,
      ready: true,
      forfeited: false,
      reconnectDeadline: null,
    })),
    currentPlayerId: "p0",
    dice: [6, 6, 6, 6, 6],
    held: Array(5).fill(false),
    rollCount: 1,
    rollPhase: "idle",
    revision: 0,
    reconnectDeadline: null,
    outcome: null,
  } as RoomState;
  initAugment(s, () => 0);
  s.augment!.drafting = false;
  s.players.forEach((p) => {
    p!.augment!.offers = [];
  });
  s.players[0]!.augment!.items = ids.map((id) => ({
    id,
    remaining: AUGMENTS.find((d) => d.id === id)!.charges,
    usedTurn: -1,
    usedRound: -1,
  }));
  s.dice = [6, 6, 6, 6, 6];
  s.rollCount = 1;
  return s;
}
test("final-turn parallel offers spent categories with explicit bonus and no unused-slot requirement", () => {
  const room = fixture(["parallel"]),
    player = room.players[0]!;
  Object.keys(player.scores).forEach(
    (k) => (player.scores[k as keyof typeof player.scores] = 0),
  );
  player.scores.ones = null;
  const dom = new JSDOM(
    renderToStaticMarkup(
      <AugmentActionInputs
        id="parallel"
        room={room}
        player={player}
        enabled
        onUse={() => {}}
      />,
    ),
  );
  try {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("요트"),
    )!;
    assert.match(button.textContent!, /별도 \+40점.*기존 기록 유지/);
    assert.equal(button.disabled, false);
    const ones = [...dom.window.document.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("1 "),
    )!;
    assert.equal(ones.disabled, true);
    assert.match(ones.title, /다른 빈 칸/);
  } finally {
    dom.window.close();
  }
});
test("lifebuoy is a single action and factory makes the replacement explicit", () => {
  const room = fixture(["lifebuoy", "customDie"]),
    player = room.players[0]!;
  const dom = new JSDOM(
    renderToStaticMarkup(
      <AugmentActionInputs
        id="lifebuoy"
        room={room}
        player={player}
        enabled
        onUse={() => {}}
      />,
    ),
  );
  try {
    assert.equal(dom.window.document.querySelectorAll("button").length, 1);
    assert.match(dom.window.document.body.textContent!, /전부 무료 재굴림/);
  } finally {
    dom.window.close();
  }
  room.rollCount = 0;
  const html = renderToStaticMarkup(
    <NovelAugmentInputs
      id="customDie"
      room={room}
      player={player}
      enabled
      onUse={() => {}}
    />,
  );
  assert.match(html, /1 → 6 · 이번 턴 적용/);
  assert.doesNotMatch(html, /합계 21/);
});
test("memory preview respects protected dice and explains missing physical rolls", () => {
  const room = fixture(["memory"]),
    player = room.players[0]!;
  room.rollCount = 0;
  room.dice = [6, null, null, null, null];
  room.held = [true, false, false, false, false];
  room.augment!.turn.fixed = [0];
  player.augment!.archive = [{ category: "choice", dice: [1, 2, 3, 4, 5] }];
  let html = renderToStaticMarkup(
    <NewAugmentInputs
      id="memory"
      room={room}
      player={player}
      enabled
      onUse={() => {}}
    />,
  );
  assert.match(html, /초이스 기본 16점/);
  room.dice.push(null, null);
  room.held.push(false, false);
  html = renderToStaticMarkup(
    <NewAugmentInputs
      id="memory"
      room={room}
      player={player}
      enabled
      onUse={() => {}}
    />,
  );
  assert.match(html, /1개를 던져야 점수가 확정/);
});
test("spent hybrid cards retain their automatic-effect status in opponent icons", () => {
  const room = fixture(["odd", "six"]),
    player = room.players[0]!;
  player.augment!.items.forEach((i) => (i.remaining = 0));
  const dom = new JSDOM(
    renderToStaticMarkup(
      <PlayerAugments player={player} turn={room.augment!.turn.serial} />,
    ),
  );
  try {
    for (const b of dom.window.document.querySelectorAll(".player-augment")) {
      assert.match(b.getAttribute("title")!, /자동 효과 유지/);
      assert.equal(b.getAttribute("data-spent"), "false");
    }
  } finally {
    dom.window.close();
  }
});
