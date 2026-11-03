import type { Command, RoomAction } from "../src/network/protocol";

// Compile-only assertions: if command types become permissive, typecheck must fail.
const roll: RoomAction = { type: "roll" };
const score: RoomAction = { type: "score", category: "yacht" };
const create: Command = { type: "createRoom", nickname: "player" };
// @ts-expect-error score requires a category
const missingCategory: RoomAction = { type: "score" };
// @ts-expect-error arbitrary command strings are not allowed
const unknownAction: RoomAction = { type: "reroll" };
// Length 5..7 is checked at runtime; augment mode permits extra dice.
const extraHolds: RoomAction = {
  type: "setHolds",
  held: [true, false, false, false, false, false],
};
// @ts-expect-error hold entries must still be booleans
const invalidHolds: RoomAction = { type: "setHolds", held: [1, 0, 0, 0, 0] };
// @ts-expect-error join requires a room code
const missingCode: Command = { type: "joinRoom", nickname: "player" };
// @ts-expect-error chat must use its separate request path, never game revision/pending
const chatAsGameAction: RoomAction = { type: "sendChat", text: "hello" };
void [
  roll,
  score,
  create,
  missingCategory,
  unknownAction,
  invalidHolds,
  extraHolds,
  missingCode,
  chatAsGameAction,
];
