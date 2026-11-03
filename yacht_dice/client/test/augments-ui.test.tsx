import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AugmentPanel } from "../src/components/AugmentPanel";
import { ScoreTable } from "../src/components/ScoreTable";
import { ScoreConfirmation } from "../src/components/ScoreConfirmation";
import {
  emptyScorecard,
  initAugment,
  applyGameAction,
  scoreBreakdown,
  type RoomState,
  type AugmentCommand,
} from "@yacht/shared";

const dom = new JSDOM("<html><body></body></html>", {
  url: "http://localhost",
});
const originals = new Map<string, PropertyDescriptor | undefined>();
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, value });
}
after(() => {
  dom.window.close();
  for (const [key, value] of originals) {
    if (value) Object.defineProperty(globalThis, key, value);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test("card reroll is separate from selection, spends only its slot and reports the remaining slots", async () => {
  let room = {
    roomId: "ui-room",
    code: "ABC12345",
    mode: "augment",
    capacity: 2,
    disconnectGraceSeconds: 60,
    phase: "playing",
    players: [0, 1].map((slot) => ({
      id: `p${slot}`,
      slot,
      nickname: `Player ${slot}`,
      connected: true,
      ready: true,
      forfeited: false,
      reconnectDeadline: null,
      scores: emptyScorecard(),
    })),
    currentPlayerId: "p0",
    dice: Array(5).fill(null),
    held: Array(5).fill(false),
    rollCount: 0,
    rollPhase: "idle",
    revision: 0,
    reconnectDeadline: null,
    outcome: null,
  } as RoomState;
  initAugment(room, (n) => (n === 100 ? 99 : 0));
  const host = document.createElement("div"),
    root = createRoot(host),
    commands: AugmentCommand[] = [];
  document.body.append(host);
  const render = () =>
    root.render(
      <AugmentPanel
        room={room}
        playerId="p0"
        disabled={false}
        onCommand={(command) => {
          commands.push(command);
          const result = applyGameAction(
            room,
            "p0",
            {
              type: "augment",
              command,
              requestId: `ui-${commands.length}`,
              roomId: room.roomId,
              expectedRevision: room.revision,
            },
            () => 0,
          );
          assert.equal(result.ok, true);
          if (result.ok) room = result.state;
          render();
        }}
      />,
    );
  try {
    await act(async () => render());
    assert.equal(
      document.querySelector(".augment-overlay")?.parentElement,
      document.body,
    );
    assert.equal(document.body.style.overflow, "hidden");
    const old = [...room.players[0]!.augment!.offers];
    const buttons = () => [
      ...document.querySelectorAll<HTMLButtonElement>(".augment-reroll"),
    ];
    assert.equal(buttons().length, 3);
    assert.ok(buttons().every((b) => !b.disabled));
    await act(async () => buttons()[1]!.click());
    assert.deepEqual(commands[0], { op: "refresh", offerIndex: 1, id: old[1] });
    assert.equal(room.players[0]!.augment!.offers[0], old[0]);
    assert.equal(room.players[0]!.augment!.offers[2], old[2]);
    assert.deepEqual(
      buttons().map((b) => b.disabled),
      [false, true, false],
    );
    assert.match(
      document.querySelector(".augment-reroll-summary")!.textContent!,
      /2\/3/,
    );
    await act(async () => buttons()[1]!.click());
    assert.equal(commands.length, 1);
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>(".augment-offers .augment-card")!
        .click(),
    );
    assert.equal(commands[1]!.op, "pick");
    assert.equal(room.players[0]!.augment!.offers.length, 0);
    room.augment!.drafting = false;
    room.players[0]!.augment!.bonus = 16;
    room.augment!.results.push(
      { key: "paid-1", text: "지워진 0 +10점 지급 완료" },
      { key: "paid-2", text: "바닥 청소부 +6점 지급 완료" },
    );
    await act(async () => render());
    assert.equal(document.body.style.overflow, "");
    assert.match(
      document.querySelector(".augment-result-burst")!.textContent!,
      /지워진 0.*\+10[\s\S]*바닥 청소부.*\+6/,
    );
    assert.match(
      document.querySelector(".augment-receipts summary")!.textContent!,
      /\+16점/,
    );
    assert.equal(document.querySelectorAll(".augment-receipts li").length, 2);
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="지급 알림 닫기"]')!
        .click(),
    );
    assert.equal(document.querySelector(".augment-result-burst"), null);
    assert.equal(document.querySelectorAll(".augment-receipts li").length, 2);
    room.dice = [6, 6, 6, 6, 6];
    room.held = Array(5).fill(false);
    room.rollCount = 1;
    room.players[0]!.augment!.items = [
      { id: "rest", remaining: 0, usedTurn: -1, usedRound: -1 },
    ];
    const breakdown = scoreBreakdown(room, room.players[0]!, "choice")!;
    assert.equal(breakdown.recorded, 30);
    assert.equal(breakdown.augment, 6);
    assert.equal(breakdown.total, 36);
    await act(async () =>
      root.render(
        <ScoreTable
          room={room}
          playerId="p0"
          selected="choice"
          canScore={true}
          onSelect={() => {}}
          confirmation={
            <ScoreConfirmation
              selected="choice"
              preview={breakdown.recorded}
              breakdown={breakdown}
              enabled={true}
              reason=""
              onConfirm={() => {}}
            />
          }
        />,
      ),
    );
    const cell = document.querySelector('[data-category="choice"] button')!;
    assert.equal(cell.textContent, "30");
    assert.match(
      cell.getAttribute("title")!,
      /기록 30점.*증강·사건 \+6점.*총점 변화 \+36점/,
    );
    assert.match(
      document.querySelector(".score-confirm button")!.textContent!,
      /30점 기록/,
    );
    assert.match(
      document.querySelector(".score-breakdown")!.textContent!,
      /증강·사건\s*\+6점/,
    );
    await act(async () => render());
    room.augment!.log.push("능력 발동!");
    await act(async () => render());
    assert.ok(document.querySelector(".augment-burst"));
    room.augment!.log.push("다음 행동");
    await act(async () => render());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 1900)));
    assert.equal(document.querySelector(".augment-burst"), null);
    room.augment!.results.push({
      key: "activation-ui",
      text: "시전자 → 대상",
      activation: {
        id: "seal",
        actor: "시전자",
        targets: ["대상"],
        name: "굴림 봉인",
        effect: "대상의 다음 턴에 굴림 횟수 -1",
        kind: "attack",
        rarity: "gold",
        flash: false,
      },
    });
    await act(async () => render());
    assert.match(
      document.querySelector(".activation-route")!.textContent!,
      /시전자.*대상/,
    );
    assert.match(
      document.querySelector(".activation-copy p")!.textContent!,
      /다음 턴.*-1/,
    );
    assert.equal(
      document.querySelector(".activation-burst")!.getAttribute("data-kind"),
      "attack",
    );
    assert.equal(
      document.querySelector(".activation-burst")!.parentElement,
      document.body,
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
