import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { RoomState } from "@yacht/shared";
import {
  useAugmentEffects,
  effectDuration,
  type AugmentEffects,
  type AugmentResult,
} from "../src/hooks/useAugmentEffects";
const dom = new JSDOM("<html><body></body></html>", {
  url: "http://localhost",
});
const saved = new Map<string, PropertyDescriptor | undefined>();
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true });
}
after(() => {
  dom.window.close();
  for (const [key, value] of saved) {
    if (value) Object.defineProperty(globalThis, key, value);
    else Reflect.deleteProperty(globalThis, key);
  }
});
const event = (key: string): AugmentResult => ({
  key,
  text: key,
  presentation: {
    stage: "use",
    level: "major",
    actorId: "p",
    targetIds: [],
    players: [],
    cells: [],
    dice: [],
    cards: [],
    defenses: [],
    rerollIndices: [],
  },
});
test("effect queue preserves order, deduplicates snapshots, bounds bursts, skips, mutes and baselines reconnect", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let fx!: AugmentEffects;
  const currentKey = () => fx.current?.key;
  function Probe({
    room,
    epoch = 0,
    connected = true,
  }: {
    room: RoomState;
    epoch?: number;
    connected?: boolean;
  }) {
    fx = useAugmentEffects(room, connected, epoch);
    return <span>{fx.current?.key}</span>;
  }
  const room = {
    roomId: "room",
    augment: { results: [event("old")] },
  } as RoomState;
  const render = async (epoch = 0, connected = true) => {
    await act(async () =>
      root.render(
        <Probe
          room={structuredClone(room)}
          epoch={epoch}
          connected={connected}
        />,
      ),
    );
  };
  await render();
  assert.equal(fx.current, undefined);
  room.augment!.results.push(event("a"), event("b"));
  await render();
  assert.equal(currentKey(), "a");
  assert.equal(fx.queued, 2);
  await render();
  assert.equal(fx.queued, 2);
  await act(async () => fx.skip());
  assert.equal(currentKey(), "b");
  for (let i = 0; i < 100; i++) room.augment!.results.push(event(`burst-${i}`));
  await render();
  assert.equal(fx.queued, 8);
  assert.equal(currentKey(), "b");
  await act(async () => fx.skipAll());
  assert.equal(fx.current, undefined);
  room.augment!.results.push(event("reconnect"));
  await render(1);
  assert.equal(fx.current, undefined);
  await render(1, false);
  room.augment!.results.push(event("offline"));
  await render(1, true);
  assert.equal(fx.current, undefined);
  await act(async () => fx.toggle());
  room.augment!.results.push(event("muted"));
  await render(1);
  assert.equal(fx.current, undefined);
  await act(async () => fx.toggle());
  assert.equal(fx.current, undefined);
  room.augment!.results.push(event("last"));
  await render(1);
  assert.equal(currentKey(), "last");
  await act(async () => root.unmount());
  host.remove();
});
test("effects have bounded timings and reduced motion never adds delay", () => {
  const e = event("1");
  assert.equal(effectDuration(e), 1300);
  assert.equal(effectDuration(e, true), 350);
  assert.equal(effectDuration(e, false, 5), 850);
  e.presentation!.level = "small";
  assert.equal(effectDuration(e), 500);
  e.presentation!.level = "emphasis";
  assert.equal(effectDuration(e), 850);
});
