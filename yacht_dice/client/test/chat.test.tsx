import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";
import { act } from "react";
import {
  emptyScorecard,
  type ChatMessage,
  type RoomState,
} from "@yacht/shared";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
const originals = new Map<string, PropertyDescriptor | undefined>();
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  constructor() {
    Socket.instances.push(this);
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  location: dom.window.location,
  sessionStorage: dom.window.sessionStorage,
  WebSocket: Socket,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, value });
}
const { createRoot } = await import("react-dom/client");
const { useGame } = await import("../src/hooks/useGame");
const { ChatPanel } = await import("../src/components/ChatPanel");
after(() => {
  dom.window.close();
  for (const [key, value] of originals) {
    if (value) Object.defineProperty(globalThis, key, value);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test("chat and game acknowledgements are independent, history deduplicates and expiration becomes read-only", async () => {
  sessionStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let game!: ReturnType<typeof useGame>;
  function Harness() {
    game = useGame();
    return null;
  }
  await act(async () => root.render(<Harness />));
  const ws = Socket.instances.at(-1)!;
  const roomId = randomUUID(),
    playerId = randomUUID();
  const state: RoomState = {
    capacity: 2,
    disconnectGraceSeconds: 60,
    roomId,
    code: "ABCDEF12",
    phase: "waiting",
    players: [
      {
        id: playerId,
        slot: 0,
        forfeited: false,
        reconnectDeadline: null,
        nickname: "나",
        connected: true,
        ready: false,
        scores: emptyScorecard(),
      },
      null,
    ],
    currentPlayerId: null,
    dice: [null, null, null, null, null],
    held: [false, false, false, false, false],
    rollCount: 0,
    rollPhase: "idle",
    revision: 1,
    reconnectDeadline: null,
    outcome: null,
  };
  try {
    await act(async () => ws.onopen?.());
    await act(async () => game.send({ type: "createRoom", nickname: "나" }));
    await act(async () => {
      ws.receive({
        type: "session",
        requestId: ws.sent.at(-1)!.requestId,
        roomId,
        code: state.code,
        playerId,
        token: "x".repeat(64),
      });
      ws.receive({ type: "roomState", state });
      ws.receive({ type: "chatHistory", roomId, messages: [] });
    });
    let chatResult!: Promise<boolean>;
    await act(async () => {
      game.action({ type: "setReady", ready: true });
      chatResult = game.sendChat("안녕");
    });
    const gameRequest = ws.sent.at(-2)!,
      chatRequest = ws.sent.at(-1)!;
    assert.equal(game.busy, true);
    assert.equal(game.chatBusy, true);
    const message: ChatMessage = {
      id: randomUUID(),
      playerId,
      nickname: "나",
      text: "안녕",
      sentAt: Date.now(),
    };
    await act(async () => {
      ws.receive({ type: "chatMessage", roomId, message });
      ws.receive({ type: "chatMessage", roomId, message });
      ws.receive({
        type: "chatAccepted",
        requestId: chatRequest.requestId,
        roomId,
        messageId: message.id,
      });
    });
    assert.equal(await chatResult, true);
    assert.equal(game.messages.length, 1);
    assert.equal(game.liveChatMessages.length, 1);
    await act(async () =>
      ws.receive({ type: "chatHistory", roomId, messages: [message] }),
    );
    assert.equal(
      game.liveChatMessages.length,
      0,
      "history is not a live celebration",
    );
    await act(async () => ws.receive({ type: "chatMessage", roomId, message }));
    assert.equal(
      game.liveChatMessages.length,
      0,
      "replayed history IDs stay suppressed",
    );
    assert.equal(game.chatBusy, false);
    assert.equal(game.busy, true);
    await act(async () =>
      ws.receive({ type: "roomState", state: { ...state, revision: 2 } }),
    );
    assert.equal(
      game.busy,
      true,
      "unrelated snapshots cannot unlock pending game actions",
    );
    await act(async () =>
      ws.receive({
        type: "accepted",
        requestId: gameRequest.requestId,
        revision: 2,
      }),
    );
    assert.equal(game.busy, false);
    await act(async () => {
      chatResult = game.sendChat("again");
      game.action({ type: "setReady", ready: false });
    });
    const secondChat = ws.sent.at(-2)!,
      secondGame = ws.sent.at(-1)!;
    await act(async () =>
      ws.receive({
        type: "rejected",
        requestId: secondChat.requestId,
        code: "INVALID_ACTION",
        message: "잠시 후 전송하세요",
      }),
    );
    assert.equal(await chatResult, false);
    assert.equal(game.busy, true);
    assert.equal(game.chatError, "잠시 후 전송하세요");
    await act(async () =>
      ws.receive({
        type: "accepted",
        requestId: secondGame.requestId,
        revision: 3,
      }),
    );
    await act(async () =>
      ws.receive({
        type: "chatMessage",
        roomId: randomUUID(),
        message: { ...message, id: randomUUID() },
      }),
    );
    assert.equal(game.messages.length, 1);
    await act(async () => {
      ws.receive({
        type: "roomState",
        state: {
          ...state,
          phase: "finished",
          outcome: { kind: "abandoned", reason: "disconnect" },
        },
      });
      ws.receive({
        type: "rejected",
        requestId: null,
        code: "ROOM_NOT_FOUND",
        message: "종료",
      });
    });
    assert.equal(game.expired, true);
    assert.equal(game.room?.phase, "finished");
    assert.equal(game.messages.length, 1);
    assert.equal(await game.sendChat("blocked"), false);
    assert.equal(game.chatPlayerId, playerId);
    await act(async () => game.leave());
    assert.equal(game.messages.length, 0);
    assert.equal(game.chatPlayerId, undefined);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test("chat input preserves failures and composition, escapes text and clears only successfully sent draft", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let success = false;
  const calls: string[] = [];
  const props = {
    messages: [
      {
        id: randomUUID(),
        playerId: randomUUID(),
        nickname: "상대",
        text: "<script>alert(1)</script>",
        sentAt: Date.now(),
      },
    ],
    connected: true,
    expired: false,
    busy: false,
    error: "",
    onSend: async (text: string) => {
      calls.push(text);
      return success;
    },
  };
  await act(async () => root.render(<ChatPanel {...props} />));
  const input = host.querySelector("input")!;
  const form = host.querySelector("form")!;
  const setValue = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  try {
    assert.equal(host.querySelector("script"), null);
    assert.match(host.textContent!, /<script>alert\(1\)<\/script>/);
    await act(async () => {
      setValue.call(input, "안녕하세요");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await act(async () =>
      input.dispatchEvent(
        new dom.window.CompositionEvent("compositionstart", { bubbles: true }),
      ),
    );
    await act(async () =>
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    assert.equal(calls.length, 0);
    await act(async () =>
      input.dispatchEvent(
        new dom.window.CompositionEvent("compositionend", { bubbles: true }),
      ),
    );
    await act(async () =>
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    assert.deepEqual(calls, ["안녕하세요"]);
    assert.equal(input.value, "안녕하세요");
    success = true;
    await act(async () =>
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    assert.equal(input.value, "");
    let acknowledge!: (ok: boolean) => void;
    await act(async () =>
      root.render(
        <ChatPanel
          {...props}
          onSend={() =>
            new Promise<boolean>((resolve) => {
              acknowledge = resolve;
            })
          }
        />,
      ),
    );
    await act(async () => {
      setValue.call(input, "보낼 문장");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await act(async () =>
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    await act(async () => {
      setValue.call(input, "다음 문장");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      acknowledge(true);
    });
    assert.equal(
      input.value,
      "다음 문장",
      "acknowledgement must not erase a newer draft",
    );
    const list = host.querySelector<HTMLDivElement>(".chat-messages")!;
    Object.defineProperties(list, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 200 },
    });
    list.scrollTop = 100;
    await act(async () =>
      list.dispatchEvent(new dom.window.Event("scroll", { bubbles: true })),
    );
    const more = [
      ...props.messages,
      { ...props.messages[0]!, id: randomUUID(), text: "새 메시지" },
    ];
    await act(async () =>
      root.render(<ChatPanel {...props} messages={more} />),
    );
    assert.equal(
      list.scrollTop,
      100,
      "reading older history must not jump to the bottom",
    );
    assert.ok(host.querySelector(".chat-new"));
    await act(async () =>
      host.querySelector<HTMLButtonElement>(".chat-new")!.click(),
    );
    assert.equal(host.querySelector(".chat-new"), null);
    assert.equal(list.scrollTop, 1000);
    await act(async () => root.render(<ChatPanel {...props} expired />));
    assert.equal(input.disabled, true);
    assert.equal(
      host.querySelector<HTMLButtonElement>(".chat-compose button")!.disabled,
      true,
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
