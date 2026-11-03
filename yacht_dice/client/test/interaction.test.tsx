import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  emptyScorecard,
  type RoomState,
  type ScoreCategory,
} from "@yacht/shared";
import { GameScreen } from "../src/screens/GameScreen";
import { DiceTray } from "../src/components/DiceTray";
import { AvatarPicker } from "../src/components/AvatarPicker";
import { FEEDBACK_TIMING } from "../src/feedback/qualifications";

// DOM event tests, not a substitute for real browser layout/pointer-device QA.
const dom = new JSDOM("<!doctype html><html><body></body></html>");
const globals = new Map<string, PropertyDescriptor | undefined>();
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, value });
}
after(() => {
  dom.window.close();
  for (const [key, value] of globals) {
    if (value) Object.defineProperty(globalThis, key, value);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test("profile modal opens from an empty frame, selects presets and keeps failed uploads open", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const selections: unknown[] = [];
  let uploadSuccess = false;
  await act(async () =>
    root.render(
      <AvatarPicker
        avatar={{ kind: "preset", id: "teal" }}
        hasSelection={false}
        disabled={false}
        message=""
        onSelect={(value) => selections.push(value)}
        onUpload={async () => uploadSuccess}
      />,
    ),
  );
  const trigger = host.querySelector<HTMLButtonElement>(".profile-frame")!;
  const dialog = host.querySelector("dialog")!;
  // jsdom has no native dialog implementation; browser focus trapping/Escape require browser QA.
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new dom.window.Event("close"));
  };
  try {
    assert.equal(trigger.textContent, "+");
    assert.equal(dialog.open, false);
    await act(async () => trigger.click());
    assert.equal(dialog.open, true);
    await act(async () =>
      host.querySelector<HTMLButtonElement>(".profile-options button")!.click(),
    );
    assert.equal(selections.length, 1);
    assert.equal(dialog.open, false);
    assert.equal(document.activeElement, trigger);
    await act(async () => trigger.click());
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [
        new dom.window.File(["image"], "profile.png", { type: "image/png" }),
      ],
    });
    await act(async () =>
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true })),
    );
    assert.equal(dialog.open, true);
    uploadSuccess = true;
    await act(async () =>
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true })),
    );
    assert.equal(dialog.open, false);
    await act(async () => trigger.click());
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(".profile-modal-heading button")!
        .click(),
    );
    assert.equal(dialog.open, false);
    assert.equal(selections.length, 1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

function state(): RoomState {
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
    held: [false, false, false, false, false],
    rollCount: 1,
    rollPhase: "idle",
    reconnectDeadline: null,
    outcome: null,
  };
}

async function mount(playerId = "a", initialTurnIntro = false) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const calls: ScoreCategory[] = [];
  const actions: string[] = [];
  let snapshotEpoch = 0;
  let room = state(),
    connected = true,
    busy = false;
  async function render(
    changes: {
      room?: RoomState;
      connected?: boolean;
      busy?: boolean;
      snapshotEpoch?: number;
    } = {},
  ) {
    room = changes.room ?? room;
    connected = changes.connected ?? connected;
    busy = changes.busy ?? busy;
    snapshotEpoch = changes.snapshotEpoch ?? snapshotEpoch;
    await act(async () =>
      root.render(
        <StrictMode>
          <GameScreen
            room={room}
            playerId={playerId}
            initialTurnIntro={initialTurnIntro}
            snapshotEpoch={snapshotEpoch}
            connected={connected}
            busy={busy}
            onScore={(category) => calls.push(category)}
            onRoll={() => actions.push("roll")}
            onStartShake={() => actions.push("startShake")}
            onHolds={() => actions.push("setHolds")}
            onLeave={() => {}}
          />
        </StrictMode>,
      ),
    );
  }
  await render();
  return {
    host,
    calls,
    actions,
    render,
    cell: (label: string) =>
      host.querySelector<HTMLButtonElement>(`button[aria-label^="${label} "]`)!,
    confirm: () =>
      host.querySelector<HTMLButtonElement>(".score-confirm button")!,
    close: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
function pointer(target: Element, type = "mouse") {
  const event = new dom.window.Event("pointerdown", { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: type });
  target.dispatchEvent(event);
}

test("Space starts shaking and throws; text inputs, repeats and disconnected turns are ignored", async () => {
  const ui = await mount();
  const press = (target: EventTarget = window, repeat = false) =>
    target.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
        repeat,
      }),
    );
  try {
    assert.equal(ui.host.querySelector(".manual-cup-hint"), null);
    await act(async () => press());
    assert.deepEqual(ui.actions, ["startShake"]);
    await ui.render({
      room: { ...state(), revision: 2, rollPhase: "shaking" },
    });
    const input = document.createElement("textarea");
    ui.host.append(input);
    await act(async () => press(input));
    await act(async () => press(window, true));
    assert.deepEqual(ui.actions, ["startShake"]);
    await act(async () => press());
    assert.deepEqual(ui.actions, ["startShake", "roll"]);
    await ui.render({
      room: { ...state(), revision: 3, rollPhase: "throwing" },
    });
    await act(async () => press());
    assert.equal(ui.actions.length, 2);
    await ui.render({ connected: false });
    await act(async () => press());
    assert.equal(ui.actions.length, 2);
  } finally {
    await ui.close();
  }
});

test("all score candidates including choice and the maximum share dashed rounded geometry", async () => {
  const style = document.createElement("style");
  style.textContent = ["base", "game", "feedback"]
    .map((name) =>
      readFileSync(
        new URL(`../src/styles/${name}.css`, import.meta.url),
        "utf8",
      ),
    )
    .join("\n");
  document.head.append(style);
  const ui = await mount();
  try {
    const buttons = [
      ...ui.host.querySelectorAll<HTMLButtonElement>(".preview-score"),
    ];
    assert.equal(buttons.length, 12);
    for (const button of buttons) {
      const computed = window.getComputedStyle(button);
      assert.equal(computed.borderTopStyle, "dashed");
      assert.equal(computed.borderTopWidth, "1px");
      assert.equal(computed.borderRadius, "10px");
    }
    const choice = ui.host.querySelector(
      'td[data-category="choice"][data-highlight="normal"]',
    )!;
    const yacht = ui.host.querySelector(
      'td[data-category="yacht"][data-highlight="special"]',
    )!;
    assert.equal(
      window.getComputedStyle(choice).backgroundColor,
      "rgba(0, 0, 0, 0)",
    );
    assert.equal(
      window.getComputedStyle(yacht).backgroundColor,
      "rgba(0, 0, 0, 0)",
    );
    assert.notEqual(
      window.getComputedStyle(ui.cell("초이스")).backgroundColor,
      window.getComputedStyle(ui.cell("요트")).backgroundColor,
    );
    await act(async () => click(ui.cell("요트")));
    assert.equal(
      window.getComputedStyle(ui.cell("요트")).borderTopStyle,
      "dashed",
    );
  } finally {
    await ui.close();
    style.remove();
  }
});
function click(target: Element, detail = 1) {
  target.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, detail }),
  );
}
function doubleClick(target: Element) {
  target.dispatchEvent(
    new dom.window.MouseEvent("dblclick", { bubbles: true, detail: 2 }),
  );
}

async function settleAnimation() {
  await act(async () => {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(FEEDBACK_TIMING.throw, FEEDBACK_TIMING.turnIntro) + 50,
      ),
    );
  });
}

test("fallback controls preserve server faces and held dice through cup phases", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const dice: RoomState["dice"] = [1, 2, 3, 4, 6];
  const held: RoomState["held"] = [true, false, false, false, false];
  const calls: RoomState["held"][] = [];
  try {
    for (const phase of ["shaking", "throwing", "result"] as const) {
      await act(async () =>
        root.render(
          <StrictMode>
            <DiceTray
              dice={dice}
              held={held}
              disabled={phase !== "result"}
              phase={phase}
              onHolds={(value) => calls.push(value)}
            />
          </StrictMode>,
        ),
      );
      assert.deepEqual(
        [...host.querySelectorAll(".die-face")].map((face) =>
          Number(face.getAttribute("data-value")),
        ),
        dice,
      );
      assert.equal(host.querySelectorAll(".die.held").length, 1);
      assert.equal(
        host.querySelectorAll(".die:disabled").length,
        phase === "result" ? 0 : 5,
      );
      assert.equal(host.querySelectorAll(".dice-cup-fallback").length, 1);
      for (const [i, face] of [...host.querySelectorAll(".die-face")].entries())
        assert.equal(face.querySelectorAll("circle").length, dice[i]);
    }
    await act(async () =>
      host.querySelectorAll<HTMLButtonElement>(".die")[1]!.click(),
    );
    assert.deepEqual(calls, [[true, true, false, false, false]]);
    assert.deepEqual(held, [true, false, false, false, false]);
  } finally {
    await act(async () => root.unmount());
  }
});

test("shaking persists; throw locks controls; duplicates and holds do not replay results", async () => {
  const ui = await mount();
  try {
    const button = () => ui.host.querySelector<HTMLButtonElement>(".roll")!;
    await act(async () => click(button()));
    assert.deepEqual(ui.actions, ["startShake"]);
    const shaking = { ...state(), revision: 2, rollPhase: "shaking" as const };
    shaking.held[0] = true;
    await ui.render({ room: shaking });
    await settleAnimation();
    assert.equal(
      ui.host.querySelector(".dice-tray")?.getAttribute("data-roll-phase"),
      "shaking",
    );
    assert.equal(button().disabled, true);
    assert.equal(
      ui.host.querySelector<HTMLButtonElement>(".throw")!.disabled,
      false,
    );
    assert.equal(ui.host.querySelector(".preview-score"), null);
    assert.ok(ui.confirm().disabled);
    assert.equal(ui.host.querySelectorAll(".die:disabled").length, 5);
    assert.match(
      ui.host.querySelector(".die.held")!.getAttribute("aria-label")!,
      /3, 보관 중/,
    );
    await act(async () =>
      click(ui.host.querySelector<HTMLButtonElement>(".throw")!),
    );
    assert.deepEqual(ui.actions, ["startShake", "roll"]);
    await ui.render({
      room: { ...shaking, revision: 3, rollPhase: "throwing" },
    });
    await settleAnimation();
    assert.equal(ui.host.querySelector(".combo-feedback"), null);
    const result = {
      ...shaking,
      revision: 4,
      rollCount: 2,
      rollPhase: "idle" as const,
    };
    await ui.render({ room: result });
    // A loaded host can finish the 150ms playback buffer before act returns.
    if (
      ui.host.querySelector(".dice-tray")?.getAttribute("data-roll-phase") ===
      "throwing"
    ) {
      assert.ok(button().disabled);
      assert.equal(ui.host.querySelector(".preview-score"), null);
      assert.equal(ui.host.querySelector(".combo-feedback"), null);
    }
    await settleAnimation();
    assert.equal(button().disabled, false);
    const banner = ui.host.querySelector(".combo-feedback");
    assert.ok(banner);
    assert.match(banner.textContent!, /YACHT/);
    assert.match(banner.textContent!, /족보 달성!/);
    assert.match(banner.textContent!, /기록 가능/);
    assert.equal(
      ui.host.querySelectorAll('.score-panel [data-highlight="special"]')
        .length,
      1,
    );
    await ui.render({ room: structuredClone(result) });
    assert.equal(ui.host.querySelector(".combo-feedback"), banner);
    const hold = {
      ...result,
      revision: 5,
      held: [false, false, false, false, false] as RoomState["held"],
    };
    await ui.render({ room: hold });
    assert.ok(ui.host.querySelector('[data-feedback="hold-changed"]'));
    assert.equal(ui.host.querySelector(".combo-feedback"), banner);
    await ui.render({ room: { ...hold, revision: 6, rollPhase: "shaking" } });
    assert.equal(ui.host.querySelector(".combo-feedback"), null);
    await ui.render({ room: { ...hold, revision: 7, rollCount: 3 } });
    await settleAnimation();
    assert.ok(ui.host.querySelector(".combo-feedback"));
    assert.notEqual(ui.host.querySelector(".combo-feedback"), banner);
  } finally {
    await ui.close();
  }
});

test("both screens classify the active scorecard and reconnect snapshots never replay", async () => {
  const own = await mount("a"),
    other = await mount("b");
  try {
    const shaking = { ...state(), revision: 2, rollPhase: "shaking" as const };
    shaking.players[0]!.scores.yacht = 0;
    shaking.players[1]!.scores.fullHouse = 15;
    await own.render({ room: shaking });
    await other.render({ room: shaking });
    const result = {
      ...shaking,
      revision: 3,
      rollCount: 2,
      rollPhase: "idle" as const,
    };
    await own.render({ room: result });
    await other.render({ room: result });
    await settleAnimation();
    assert.equal(other.host.querySelector(".roll"), null);
    const highlights = (host: Element) =>
      [
        ...host.querySelectorAll<HTMLTableCellElement>(
          ".score-panel td[data-highlight]",
        ),
      ].map((cell) => [
        cell.getAttribute("data-category"),
        cell.getAttribute("data-highlight"),
        cell.cellIndex,
      ]);
    assert.deepEqual(highlights(own.host), highlights(other.host));
    assert.deepEqual(highlights(own.host), [
      ["choice", "normal", 1],
      ["fourOfAKind", "special", 1],
      ["fullHouse", "special", 1],
    ]);
    assert.doesNotMatch(
      other.host.querySelector(".combo-feedback")!.textContent!,
      /YACHT/,
    );
    await own.render({ connected: false });
    assert.equal(own.host.querySelector(".combo-feedback"), null);
    await own.render({
      connected: true,
      snapshotEpoch: 1,
      room: { ...result, revision: 8, rollCount: 3 },
    });
    assert.equal(own.host.querySelector(".combo-feedback"), null);
    assert.equal(own.host.querySelector('[data-feedback="turn-intro"]'), null);
    assert.equal(
      own.host.querySelector(".dice-tray")?.getAttribute("data-roll-phase"),
      "result",
    );
  } finally {
    await own.close();
    await other.close();
  }
});

test("turn intro releases after 500ms in StrictMode; approved zero score gets separate feedback", async () => {
  const ui = await mount("a", true);
  try {
    const button = () => ui.host.querySelector<HTMLButtonElement>(".roll")!;
    assert.ok(ui.host.querySelector('[data-feedback="turn-intro"]'));
    assert.ok(button().disabled);
    assert.equal(ui.host.querySelector(".preview-score"), null);
    await settleAnimation();
    assert.equal(ui.host.querySelector('[data-feedback="turn-intro"]'), null);
    assert.equal(button().disabled, false);
    await act(async () => click(ui.cell("ones")));
    assert.equal(ui.host.querySelector(".record-feedback"), null);
    await act(async () => click(ui.confirm()));
    assert.equal(ui.host.querySelector(".record-feedback"), null);
    const scored = {
      ...state(),
      revision: 2,
      currentPlayerId: "b",
      rollCount: 0,
      dice: [null, null, null, null, null] as RoomState["dice"],
    };
    scored.players[0]!.scores.ones = 0;
    await ui.render({ room: scored });
    assert.match(
      ui.host.querySelector(".record-feedback")!.textContent!,
      /ones · 0점 기록/,
    );
    assert.ok(
      ui.host.querySelector(
        'td[data-category="ones"][data-feedback="score-recorded"]',
      ),
    );
    const next = { ...scored, revision: 3, currentPlayerId: "a" };
    next.players = structuredClone(scored.players);
    next.players[1]!.scores.twos = 0;
    await ui.render({ room: next });
    assert.ok(ui.host.querySelector('[data-feedback="turn-intro"]'));
    assert.ok(button().disabled);
    await settleAnimation();
    assert.equal(button().disabled, false);
    await ui.render({ connected: false });
    assert.equal(ui.host.querySelector(".record-feedback"), null);
  } finally {
    await ui.close();
  }
});

test("single clicks select; bottom button confirms zero exactly once", async () => {
  const ui = await mount();
  try {
    assert.ok(ui.confirm().disabled);
    assert.ok(ui.host.querySelector(".score-panel .score-confirm"));
    assert.equal(ui.host.querySelector(".table-area .score-confirm"), null);
    const cell = ui.cell("ones");
    await act(async () => {
      pointer(cell);
      click(cell);
    });
    assert.equal(cell.getAttribute("aria-pressed"), "true");
    assert.match(ui.host.textContent!, /0점으로 기록됩니다/);
    assert.equal(ui.confirm().disabled, false);
    await act(async () => {
      pointer(cell);
      click(cell);
    });
    assert.deepEqual(ui.calls, []);
    const confirm = ui.confirm();
    await act(async () => {
      click(confirm);
      click(confirm);
      doubleClick(cell);
    });
    assert.deepEqual(ui.calls, ["ones"]);
    assert.ok(ui.confirm().disabled);
  } finally {
    await ui.close();
  }
});

test("mouse double-click confirms its own category even before selection rerenders", async () => {
  const ui = await mount();
  try {
    await act(async () => {
      pointer(ui.cell("ones"));
      click(ui.cell("ones"));
    });
    const yacht = ui.cell("요트");
    await act(async () => {
      pointer(yacht);
      click(yacht);
      pointer(yacht);
      click(yacht, 2);
      doubleClick(yacht);
      doubleClick(yacht);
    });
    assert.deepEqual(ui.calls, ["yacht"]);
  } finally {
    await ui.close();
  }
});

test("touch double tap and keyboard activation only select; explicit confirmation still works", async () => {
  for (const input of ["touch", "keyboard"]) {
    const ui = await mount();
    try {
      const cell = ui.cell("요트");
      await act(async () => {
        if (input === "touch") pointer(cell, "touch");
        else
          cell.dispatchEvent(
            new dom.window.KeyboardEvent("keydown", {
              key: "Enter",
              bubbles: true,
            }),
          );
        click(cell, input === "keyboard" ? 0 : 1);
        click(cell, 2);
        doubleClick(cell);
      });
      assert.deepEqual(ui.calls, []);
      assert.equal(ui.confirm().disabled, false);
      await act(async () => click(ui.confirm(), 0));
      assert.deepEqual(ui.calls, ["yacht"]);
    } finally {
      await ui.close();
    }
  }
});

test("roll, room, turn, disconnect and pause transitions invalidate selection", async () => {
  const ui = await mount();
  try {
    const choose = async () => {
      await act(async () => click(ui.cell("요트")));
      assert.equal(ui.confirm().disabled, false);
    };
    await choose();
    await ui.render({ room: { ...state(), rollCount: 2, revision: 2 } });
    assert.ok(ui.confirm().disabled);
    await act(async () => {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.max(FEEDBACK_TIMING.throw, FEEDBACK_TIMING.turnIntro) + 50,
        ),
      );
    });
    await choose();
    await ui.render({ connected: false });
    assert.ok(ui.confirm().disabled);
    await ui.render({ connected: true });
    assert.ok(ui.confirm().disabled);
    await choose();
    const paused = state();
    paused.players[1]!.connected = false;
    await ui.render({ room: paused });
    assert.match(ui.host.textContent!, /재접속을 기다리고/);
    await ui.render({ room: state() });
    assert.ok(ui.confirm().disabled);
    await choose();
    await ui.render({ room: { ...state(), roomId: "other" } });
    assert.ok(ui.confirm().disabled);
    await choose();
    await ui.render({ room: { ...state(), currentPlayerId: "b" } });
    assert.equal(ui.host.querySelector(".roll"), null);
    assert.match(ui.host.textContent!, /둘님의 턴입니다/);
    assert.match(ui.host.textContent!, /2회 남음/);
    assert.ok(ui.confirm().disabled);
    assert.deepEqual(ui.calls, []);
  } finally {
    await ui.close();
  }
});

test("busy, recorded category, first roll and finished state cannot submit; rejection allows retry", async () => {
  const ui = await mount();
  try {
    const cell = ui.cell("요트");
    await act(async () => {
      pointer(cell);
      doubleClick(cell);
    });
    assert.deepEqual(ui.calls, ["yacht"]);
    await ui.render({ busy: true });
    await ui.render({ busy: false });
    assert.ok(ui.confirm().disabled);
    const retry = ui.cell("요트");
    await act(async () => {
      pointer(retry);
      doubleClick(retry);
    });
    assert.deepEqual(ui.calls, ["yacht", "yacht"]);
    const recorded = state();
    recorded.revision++;
    recorded.players[0]!.scores.yacht = 50;
    await ui.render({ room: recorded });
    assert.equal(ui.cell("요트"), null);
    await ui.render({ busy: true });
    assert.equal(ui.host.querySelector(".preview-score"), null);
    await ui.render({
      busy: false,
      room: { ...state(), rollCount: 0, dice: [null, null, null, null, null] },
    });
    assert.ok(ui.confirm().disabled);
    assert.match(ui.host.textContent!, /먼저 주사위를 굴려주세요/);
    await ui.render({
      room: {
        ...state(),
        phase: "finished",
        currentPlayerId: null,
        outcome: { kind: "draw", reason: "score", playerIds: ["a", "b"] },
      },
    });
    assert.ok(ui.confirm().disabled);
    assert.equal(ui.host.querySelector(".roll"), null);
    assert.match(ui.host.textContent!, /경기가 종료되었습니다/);
  } finally {
    await ui.close();
  }
});

test("Yacht effects only follow score commits, including final turns; duplicates and reconnects do not replay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const score of [50, 0]) {
    const ui = await mount();
    try {
      assert.equal(document.querySelectorAll("[data-celebration]").length, 0);
      const room = state();
      room.revision = 2;
      room.players[0]!.scores.yacht = score;
      room.phase = "finished";
      room.outcome = { kind: "abandoned", reason: "disconnect" };
      await ui.render({ room });
      assert.equal(
        document.querySelectorAll(
          `[data-celebration="${score ? "fireworks" : "scream"}"]`,
        ).length,
        1,
      );
      assert.equal(
        document.querySelectorAll(".celebration-title").length,
        score ? 1 : 0,
      );
      assert.equal(
        document.querySelectorAll('img.sans-face[src="/sans-face.svg"]').length,
        score ? 0 : 1,
      );
      assert.ok(
        !document
          .querySelector(".celebration-layer")
          ?.textContent?.includes("😱"),
      );
      await ui.render({ room: structuredClone(room) });
      assert.equal(document.querySelectorAll("[data-celebration]").length, 1);
      await act(async () => t.mock.timers.tick(2000));
      assert.equal(document.querySelectorAll("[data-celebration]").length, 0);
      await ui.render({ room: { ...room, revision: 3 }, snapshotEpoch: 1 });
      assert.equal(document.querySelectorAll("[data-celebration]").length, 0);
    } finally {
      await ui.close();
    }
  }
});
