import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RoundEventBanner } from "../src/components/RoundEventBanner";
import { EVENTS, type RoomState } from "@yacht/shared";
import {
  CelebrationLayer,
  CELEBRATION_DURATION_MS,
} from "../src/components/CelebrationLayer";
import {
  RoomInvite,
  roomInviteUrl,
  copyInviteUrl,
} from "../src/components/RoomInvite";
const dom = new JSDOM("<html><body></body></html>", {
  url: "http://192.168.0.2:3000/?old=value#fragment",
});
const originals = new Map<string, PropertyDescriptor | undefined>();
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  location: dom.window.location,
  sessionStorage: dom.window.sessionStorage,
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

test("round events announce once, expire in StrictMode and announce again next event round", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const host = document.createElement("div");
  const root = createRoot(host);
  const room = {
    roomId: "event-test",
    phase: "playing",
    augment: { round: 3, event: EVENTS[0].id },
  } as RoomState;
  const render = () =>
    act(async () =>
      root.render(
        <StrictMode>
          <RoundEventBanner room={room} />
        </StrictMode>,
      ),
    );
  try {
    await render();
    assert.match(host.textContent!, new RegExp(EVENTS[0].name));
    await act(async () => t.mock.timers.tick(7000));
    assert.equal(host.textContent, "");
    await render();
    assert.equal(host.textContent, "");
    room.augment!.round = 6;
    await render();
    assert.ok(host.querySelector('[role="status"]'));
    await act(async () => host.querySelector("button")!.click());
    assert.equal(host.textContent, "");
  } finally {
    await act(async () => root.unmount());
  }
});

test("celebrations retain distinct batched events once, survive strict effects and expire", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const host = document.createElement("div");
  const root = createRoot(host);
  const events = [
    { id: "one", kind: "fireworks" as const, variant: "yacht" as const },
    { id: "two", kind: "fireworks" as const },
  ];
  const render = async () =>
    act(async () =>
      root.render(
        <StrictMode>
          <CelebrationLayer events={[...events]} />
        </StrictMode>,
      ),
    );
  try {
    await render();
    assert.equal(
      document.querySelectorAll('[data-celebration="fireworks"]').length,
      2,
    );
    await render();
    assert.equal(
      document.querySelectorAll('[data-celebration="fireworks"]').length,
      2,
    );
    assert.equal(CELEBRATION_DURATION_MS, 1800);
    assert.equal(document.querySelectorAll(".celebration-title").length, 1);
    assert.match(
      document.querySelector(".celebration-title")!.textContent!,
      /YACHT!\+50/,
    );
    await act(async () => t.mock.timers.tick(1799));
    assert.equal(document.querySelectorAll("[data-celebration]").length, 2);
    await act(async () => t.mock.timers.tick(1));
    assert.equal(document.querySelectorAll("[data-celebration]").length, 0);
    await render();
    assert.equal(document.querySelectorAll("[data-celebration]").length, 0);
  } finally {
    await act(async () => root.unmount());
  }
});

test("invite copy uses URL, handles API rejection and HTTP fallback, then exposes manual failure", async () => {
  const invite = roomInviteUrl("ABCDEF12", location.href);
  assert.equal(invite, "http://192.168.0.2:3000/?room=ABCDEF12");
  assert.equal(new URL(invite).searchParams.get("room"), "ABCDEF12");
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const originalCommand = Object.getOwnPropertyDescriptor(
    document,
    "execCommand",
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copied = value;
        },
      },
    });
    assert.equal(await copyInviteUrl(invite), true);
    assert.equal(copied, invite);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: (command: string) => {
        assert.equal(command, "copy");
        copied = document.querySelector("textarea")!.value;
        return true;
      },
    });
    assert.equal(await copyInviteUrl(invite), true);
    assert.equal(copied, invite);
    assert.equal(document.querySelector("textarea"), null);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    assert.equal(await copyInviteUrl(invite), true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => false,
    });
    await act(async () => root.render(<RoomInvite code="ABCDEF12" compact />));
    await act(async () => host.querySelector("button")!.click());
    assert.match(host.textContent!, /자동 복사에 실패/);
    assert.equal(host.querySelector("input")!.value, invite);
    assert.doesNotMatch(host.querySelector("button")!.textContent!, /복사됨/);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
    if (originalCommand)
      Object.defineProperty(document, "execCommand", originalCommand);
    else Reflect.deleteProperty(document, "execCommand");
  }
});
