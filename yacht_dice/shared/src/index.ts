import { augmentPlayerSchema, augmentStateSchema, augmentCommandSchema } from "./augments.js";
export * from "./augments.js";
export * from "./augment-game.js";
export * from "./novelty.js";
import { motionSchema } from "./motion.js";
export { motionSchema, FACE_ORDER, type Pose, type MotionFrame } from "./motion.js";
import { z } from "zod";
import { avatarSchema } from "./avatar.js";
export { AVATAR_IDS, MAX_AVATAR_BYTES, DEFAULT_AVATAR, avatarSchema, isAvatarPng, type Avatar } from "./avatar.js";
export { emptyScorecard, categoryScore, totals, applyGameAction, completeRoll, activePlayers, nextPlayerId, standings, settleGame } from "./game.js";

export const SCORE_CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "choice",
  "fourOfAKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yacht",
] as const;

export const SCORE_LABELS: Record<(typeof SCORE_CATEGORIES)[number], string> = {
  ones: "1",
  twos: "2",
  threes: "3",
  fours: "4",
  fives: "5",
  sixes: "6",
  choice: "초이스",
  fourOfAKind: "포커",
  fullHouse: "풀하우스",
  smallStraight: "스몰 스트레이트 (15)",
  largeStraight: "라지 스트레이트 (30)",
  yacht: "요트 (50)",
};

export const scoreCategorySchema = z.enum(SCORE_CATEGORIES);
export type ScoreCategory = z.infer<typeof scoreCategorySchema>;

const requestIdSchema = z.uuid();
const roomIdSchema = z.uuid();
const playerIdSchema = z.uuid();
const roomCodeSchema = z.string().regex(/^[A-Z0-9]{6,8}$/);
const revisionSchema = z.number().int().nonnegative();
const nicknameSchema = z.string().trim().min(1).max(20);
export const capacitySchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);
export type Capacity = z.infer<typeof capacitySchema>;
export const disconnectGraceSchema = z.number().int().min(1).max(86400);
export const CHAT_MAX_LENGTH = 300;
export const CHAT_HISTORY_LIMIT = 100;
export const chatTextSchema = z.string().trim().min(1).max(CHAT_MAX_LENGTH);
export const chatMessageSchema = z.strictObject({
  id: z.uuid(), playerId: playerIdSchema, nickname: nicknameSchema,
  text: chatTextSchema, sentAt: z.number().int().nonnegative(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
const reconnectTokenSchema = z.string().min(32).max(256);
const dieSchema = z.number().int().min(1).max(12);
const diceSchema = z.array(dieSchema.nullable()).min(3).max(10);
const heldSchema = z.array(z.boolean()).min(3).max(10);

export const scorecardSchema = z.record(scoreCategorySchema, z.number().int().nonnegative().nullable());
export type Scorecard = z.infer<typeof scorecardSchema>;

export const publicPlayerSchema = z.strictObject({
  id: playerIdSchema,
  slot: z.number().int().min(0).max(3),
  nickname: nicknameSchema,
  avatar: avatarSchema.optional(),
  connected: z.boolean(),
  ready: z.boolean(),
  forfeited: z.boolean().default(false),
  reconnectDeadline: z.number().int().nonnegative().nullable().default(null),
  scores: scorecardSchema,
  augment: augmentPlayerSchema.optional(),
});
export type PublicPlayer = z.infer<typeof publicPlayerSchema>;

export const roomStateSchema = z.strictObject({
  roomId: roomIdSchema,
  mode: z.enum(["normal", "augment"]).optional(),
  augment: augmentStateSchema.optional(),
  code: roomCodeSchema,
  phase: z.enum(["waiting", "playing", "finished"]),
  capacity: capacitySchema.default(2),
  disconnectGraceSeconds: disconnectGraceSchema.default(60),
  players: z.array(publicPlayerSchema.nullable()).min(2).max(4),
  currentPlayerId: playerIdSchema.nullable(),
  dice: diceSchema,
  held: heldSchema,
  rollCount: z.number().int().min(0).max(12),
  rollPhase: z.enum(["idle", "shaking", "throwing"]),
  motion: motionSchema.nullable().optional(),
  revision: revisionSchema,
  reconnectDeadline: z.number().int().nonnegative().nullable(),
  outcome: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("winner"), playerId: playerIdSchema, reason: z.enum(["score", "forfeit"]) }),
    z.strictObject({ kind: z.literal("draw"), reason: z.literal("score"), playerIds: z.array(playerIdSchema).min(2).max(4) }),
    z.strictObject({ kind: z.literal("abandoned"), reason: z.literal("disconnect") }),
  ]).nullable(),
}).superRefine((room, ctx) => {
  const monster=room.augment?.turn.monster;const index=monster&&!monster.split?monster.index:-1;
  if(room.dice.some((v,i)=>v!==null&&v>6&&i!==index)||room.dice.length<4&&index<0)ctx.addIssue({code:'custom',message:'괴물 주사위만 7~12 눈을 가질 수 있습니다.'});
  if(room.dice.length!==room.held.length || (!room.augment && (room.dice.length!==5 || room.rollCount>3)))ctx.addIssue({code:"custom",message:"모드에 맞지 않는 주사위 상태입니다."});
  if (room.players.length !== room.capacity) ctx.addIssue({ code: "custom", message: "정원과 자리 수가 다릅니다." });
  const ids = new Set<string>();
  room.players.forEach((player, slot) => {
    if (!player) return;
    if (player.slot !== slot || ids.has(player.id)) ctx.addIssue({ code: "custom", message: "자리 또는 플레이어가 중복되거나 올바르지 않습니다." });
    ids.add(player.id);
  });
});
export type RoomState = z.infer<typeof roomStateSchema>;

const roomActionBase = {
  requestId: requestIdSchema,
  roomId: roomIdSchema,
  expectedRevision: revisionSchema,
};

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("clock"), requestId: requestIdSchema, sentAt: z.number().finite() }),
  z.strictObject({ type: z.literal("sendChat"), requestId: requestIdSchema, roomId: roomIdSchema, text: chatTextSchema }),
  z.strictObject({ type: z.literal("createRoom"), requestId: requestIdSchema, nickname: nicknameSchema, avatar: avatarSchema.optional(), capacity: capacitySchema.optional(), mode: z.enum(["normal", "augment"]).optional(), disconnectGraceSeconds: disconnectGraceSchema.optional() }),
  z.strictObject({ type: z.literal("joinRoom"), requestId: requestIdSchema, code: roomCodeSchema, nickname: nicknameSchema, avatar: avatarSchema.optional() }),
  z.strictObject({ type: z.literal("resumeRoom"), requestId: requestIdSchema, code: roomCodeSchema, token: reconnectTokenSchema }),
  z.strictObject({ type: z.literal("setReady"), ...roomActionBase, ready: z.boolean() }),
  z.strictObject({ type: z.literal("roll"), ...roomActionBase }),
  z.strictObject({ type: z.literal("startShake"), ...roomActionBase }),
  z.strictObject({ type: z.literal("setHolds"), ...roomActionBase, held: heldSchema }),
  z.strictObject({ type: z.literal("score"), ...roomActionBase, category: scoreCategorySchema }),
  z.strictObject({ type: z.literal("leaveRoom"), ...roomActionBase }),
  z.strictObject({ type: z.literal("augment"), ...roomActionBase, command: augmentCommandSchema }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const ERROR_CODES = [
  "INVALID_MESSAGE",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "UNAUTHORIZED",
  "STALE_REVISION",
  "INVALID_ACTION",
  "GAME_PAUSED",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("clock"), requestId: requestIdSchema, sentAt: z.number().finite(), serverAt: z.number().finite() }),
  z.strictObject({ type: z.literal("motion"), roomId: roomIdSchema, frames: z.array(motionSchema).min(1).max(3) }),
  z.strictObject({ type: z.literal("chatHistory"), roomId: roomIdSchema, messages: z.array(chatMessageSchema).max(CHAT_HISTORY_LIMIT) }),
  z.strictObject({ type: z.literal("chatMessage"), roomId: roomIdSchema, message: chatMessageSchema }),
  z.strictObject({ type: z.literal("chatAccepted"), requestId: requestIdSchema, roomId: roomIdSchema, messageId: z.uuid() }),
  z.strictObject({ type: z.literal("accepted"), requestId: requestIdSchema, revision: revisionSchema }),
  z.strictObject({ type: z.literal("rejected"), requestId: requestIdSchema.nullable(), code: errorCodeSchema, message: z.string().min(1).max(200) }),
  z.strictObject({ type: z.literal("roomState"), state: roomStateSchema }),
  z.strictObject({ type: z.literal("session"), requestId: requestIdSchema, roomId: roomIdSchema, code: roomCodeSchema, playerId: playerIdSchema, token: reconnectTokenSchema }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export const MAX_MESSAGE_BYTES = 136 * 1024;
export const MAX_SERVER_MESSAGE_BYTES = 544 * 1024;

export type DecodeResult<T> =
  | { success: true; data: T }
  | { success: false; code: "INVALID_MESSAGE"; message: string };

function decodeMessage<T>(raw: string, schema: z.ZodType<T>, maxBytes = MAX_MESSAGE_BYTES): DecodeResult<T> {
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { success: false, code: "INVALID_MESSAGE", message: "메시지 크기가 제한을 초과했습니다." };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { success: false, code: "INVALID_MESSAGE", message: "JSON 형식이 올바르지 않습니다." };
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { success: false, code: "INVALID_MESSAGE", message: "메시지 형식이 올바르지 않습니다." };
  }

  return { success: true, data: parsed.data };
}

export function decodeClientMessage(raw: string): DecodeResult<ClientMessage> {
  return decodeMessage(raw, clientMessageSchema);
}

export function decodeServerMessage(raw: string): DecodeResult<ServerMessage> {
  return decodeMessage(raw, serverMessageSchema, MAX_SERVER_MESSAGE_BYTES);
}

export { blockedCategory, goldDisabled, flashEligible, flashTargets } from "./flash.js";
