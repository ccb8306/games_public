import { afterAugmentRoll, reconcileAugment,physicalFaces,monsterIndex } from "@yacht/shared";
import { PhysicsPool } from "./physics-pool.js";
import type { PhysicsEvent } from "./physics-worker.js";
import { completeRoll, type MotionFrame } from "@yacht/shared";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { CHAT_HISTORY_LIMIT, DEFAULT_AVATAR, settleGame, type Avatar, type ChatMessage } from "@yacht/shared";
import { WebSocket } from "ws";
import { applyGameAction, decodeClientMessage, emptyScorecard, type RoomState, type ServerMessage, type ClientMessage, type ErrorCode } from "@yacht/shared";

type Session = { room: Room; playerId: string };
type Room = {
  state: RoomState;
  physicsJob?: { id: string; actor: string; before: RoomState["motion"]; deadline?: number; autoAt?: number };
  tokens: Map<string, string>;
  sockets: Map<string, WebSocket>;
  deadlines: Map<string, number>;
  expired: Set<string>;
  history: Map<string, Map<string, ServerMessage>>;
  inactiveSince: number | null;
  finishedAt: number | null;
  chat: ChatMessage[];
  chatTimes: Map<string, number>;
  chatRequests: Map<string, Map<string, string>>;
};

export class Rooms {
  readonly rooms = new Map<string, Room>();
  private sessions = new WeakMap<WebSocket, Session>();
  private limits = new WeakMap<WebSocket, { start: number; count: number }>();
  private physics = new PhysicsPool(event => this.physicalEvent(event));
  async close() { await this.physics.close(); }
  constructor(private graceMs = 60_000, private now = Date.now) {}

  private send(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }
  private reject(ws: WebSocket, requestId: string | null, code: ErrorCode, message: string) {
    this.send(ws, { type: "rejected", requestId, code, message });
  }
  private broadcast(room: Room) {
    const deadlines = [...room.deadlines].filter(([id]) => !room.expired.has(id)).map(([, time]) => time);
    room.state.reconnectDeadline = room.state.phase === "playing" && deadlines.length ? Math.min(...deadlines) : null;
    for (const player of room.state.players) if (player) player.reconnectDeadline = room.state.phase !== "finished" && !player.forfeited ? room.deadlines.get(player.id) ?? null : null;
    if (room.state.phase === "finished" && room.finishedAt === null) room.finishedAt = this.now();
    this.syncPhysics(room);
    for (const ws of room.sockets.values()) this.send(ws, { type: "roomState", state: room.state });
  }
  private cancelPhysics(room: Room) {
    if (!room.physicsJob) return;
    this.physics.send({type:"cancel",roomId:room.state.roomId,id:room.physicsJob.id});
    room.physicsJob = undefined;
  }
  private syncPhysics(room: Room) {
    const job = room.physicsJob;
    if (!job) return;
    if (room.state.phase !== "playing" || room.state.currentPlayerId !== job.actor) { this.cancelPhysics(room); return; }
    if (room.state.rollPhase === "shaking") {
      const paused = room.state.players.some(p => p && !p.forfeited && !p.connected);
      if (room.state.motion && paused !== room.state.motion.paused) {
        room.state.motion.paused = paused;
        this.physics.send({type:"pause",roomId:room.state.roomId,id:job.id,paused});
      }
    }
  }
  private startPhysics(room: Room, playerId: string) {
    if(room.state.augment)for(const key of Object.keys(room.state.augment.turn.customOverride??{}))if(!room.state.held[Number(key)])delete room.state.augment.turn.customOverride![key];
    const id = randomUUID();
    room.physicsJob = { id, actor:playerId, before:room.state.motion };
    if (room.state.augment?.turn.reroll?.id === "practice") room.physicsJob.autoAt = this.now() + 500;
    room.state.motion = {
      id, seq:0, at:Date.now(), phase:"shaking", wind:false, paused:false, cup:null,
      dice:room.state.motion?.dice ?? Array.from({length:room.state.dice.length},()=>({p:[0,0.48,0] as [number,number,number],q:[0,0,0,1] as [number,number,number,number]})),
    };
    this.physics.send({type:"start",roomId:room.state.roomId,id,held:room.state.held,dice:room.state.dice,poses:room.physicsJob.before?.dice,faces:physicalFaces(room.state),monster:monsterIndex(room.state)});
  }
  private physicalEvent(event: PhysicsEvent) {
    const room = [...this.rooms.values()].find(r => r.state.roomId === event.roomId);
    if (!room || room.physicsJob?.id !== event.id || room.state.currentPlayerId !== room.physicsJob.actor || room.state.phase !== "playing") return;
    if (event.type === "frames") {
      const last = event.frames.at(-1)!;
      // A stop command may overtake a batch already emitted by the worker.
      if (room.state.rollPhase === "throwing" && last.phase === "shaking") return;
      if (room.state.rollPhase === "shaking" && last.paused !== room.state.players.some(p => p && !p.forfeited && !p.connected)) return;
      room.state.motion = last;
      for (const ws of room.sockets.values()) {
        if (ws.bufferedAmount < 256 * 1024) this.send(ws,{type:"motion",roomId:event.roomId,frames:event.frames});
        else if (ws.bufferedAmount > 1024 * 1024) ws.close(1013,"Slow connection; reconnect for latest state");
      }
      return;
    }
    if (event.type === "done") {
      room.state = completeRoll(room.state,event.dice,event.frame);
      if(room.state.augment) afterAugmentRoll(room.state, randomInt);
    } else {
      room.state.motion = room.physicsJob.before ?? null;
      room.state.rollPhase = "idle";
      room.state.revision++;
      for (const ws of room.sockets.values()) this.reject(ws,null,"INVALID_ACTION","착지를 마치지 못했어요. 횟수는 차감되지 않았으니 다시 흔들어 주세요.");
      console.warn("physics_failed", {roomId:event.roomId,rollId:event.id});
    }
    room.physicsJob = undefined;
    if(event.type==='done'&&room.state.rollPhase==='shaking'&&room.state.augment?.turn.reroll?.id==='practice'){
      this.startPhysics(room,room.state.currentPlayerId!);
    }
    this.broadcast(room);
  }
  private attach(ws: WebSocket, room: Room, playerId: string, requestId: string) {
    const old = room.sockets.get(playerId);
    if (old && old !== ws) {
      this.sessions.delete(old);
      old.close(4001, "Session replaced");
    }
    room.sockets.set(playerId, ws);
    this.sessions.set(ws, { room, playerId });
    const player = room.state.players.find(p => p?.id === playerId)!;
    player.connected = true;
    room.deadlines.delete(playerId);
    room.inactiveSince = null;
    room.state.revision++;
    this.send(ws, { type: "session", requestId, roomId: room.state.roomId, code: room.state.code, playerId, token: room.tokens.get(playerId)! });
    this.settle(room);
    this.broadcast(room);
    this.send(ws, { type: "chatHistory", roomId: room.state.roomId, messages: room.chat });
  }
  handle(ws: WebSocket, raw: string) {
    // Apply all due expirations before accepting a resume or game action.
    this.tick();
    const decoded = decodeClientMessage(raw);
    const time = this.now();
    let limit = this.limits.get(ws);
    if (!limit || time - limit.start > 10_000) { limit = { start: time, count: 0 }; this.limits.set(ws, limit); }
    if (++limit.count > 120) { this.reject(ws, decoded.success ? decoded.data.requestId : null, "INVALID_ACTION", "요청이 너무 빠릅니다. 잠시 후 다시 시도하세요."); return; }
    if (!decoded.success) { this.reject(ws, null, decoded.code, decoded.message); return; }
    const msg = decoded.data;
    if (msg.type === "clock") { this.send(ws,{type:"clock",requestId:msg.requestId,sentAt:msg.sentAt,serverAt:Date.now()}); return; }
    if (msg.type === "createRoom" || msg.type === "joinRoom" || msg.type === "resumeRoom") {
      if (this.sessions.has(ws)) { this.reject(ws, msg.requestId, "INVALID_ACTION", "먼저 현재 방에서 나가주세요."); return; }
      if (msg.type === "createRoom") {
        if (this.rooms.size >= 200) { this.reject(ws, msg.requestId, "INVALID_ACTION", "서버의 방이 가득 찼습니다."); return; }
        let code: string;
        do { code = randomBytes(4).toString("hex").toUpperCase(); } while (this.rooms.has(code));
        const room: Room = {
          state: { mode: msg.mode ?? "normal", roomId: randomUUID(), code, capacity: msg.capacity ?? 2, disconnectGraceSeconds: msg.disconnectGraceSeconds ?? this.graceMs / 1000, phase: "waiting", players: Array.from({ length: msg.capacity ?? 2 }, () => null), currentPlayerId: null, dice: [null, null, null, null, null], held: [false, false, false, false, false], rollCount: 0, rollPhase: "idle", revision: 0, reconnectDeadline: null, outcome: null },
          tokens: new Map(), sockets: new Map(), deadlines: new Map(), expired: new Set(), history: new Map(), inactiveSince: null, finishedAt: null,
          chat: [], chatTimes: new Map(), chatRequests: new Map(),
        };
        this.rooms.set(code, room);
        this.addPlayer(ws, room, msg.nickname, 0, msg.requestId, msg.avatar);
        return;
      }
      const room = this.rooms.get(msg.code);
      if (!room) { this.reject(ws, msg.requestId, "ROOM_NOT_FOUND", "방이 없거나 보관 시간이 끝났습니다."); return; }
      if (msg.type === "resumeRoom") {
        const playerId = [...room.tokens].find(([, token]) => token === msg.token)?.[0];
        const deadline = playerId ? room.deadlines.get(playerId) : undefined;
        if (!playerId || room.expired.has(playerId) || (room.state.phase !== "finished" && deadline !== undefined && deadline <= time)) {
          this.reject(ws, msg.requestId, "UNAUTHORIZED", "재접속 시간이 만료됐거나 접속 정보가 다릅니다."); return;
        }
        this.attach(ws, room, playerId, msg.requestId);
      } else {
        const slot = room.state.players.findIndex(p => !p);
        if (room.state.phase !== "waiting" || slot < 0) { this.reject(ws, msg.requestId, "ROOM_FULL", "참가할 수 없는 방입니다. 이미 시작했거나 정원이 찼습니다."); return; }
        this.addPlayer(ws, room, msg.nickname, slot, msg.requestId, msg.avatar);
      }
      return;
    }
    if (msg.type === "sendChat") this.chat(ws, msg);
    else this.action(ws, msg);
  }
  private chat(ws: WebSocket, msg: Extract<ClientMessage, { type: "sendChat" }>) {
    const session = this.sessions.get(ws);
    if (!session || session.room.state.roomId !== msg.roomId || session.room.sockets.get(session.playerId) !== ws) {
      this.reject(ws, msg.requestId, "UNAUTHORIZED", "이 방에 연결된 플레이어가 아닙니다."); return;
    }
    const { room, playerId } = session;
    const previous = room.chatRequests.get(playerId)?.get(msg.requestId);
    if (previous) { this.send(ws, { type: "chatAccepted", requestId: msg.requestId, roomId: msg.roomId, messageId: previous }); return; }
    const now = this.now();
    const last = room.chatTimes.get(playerId);
    if (last !== undefined && now - last < 1000) {
      this.reject(ws, msg.requestId, "INVALID_ACTION", "메시지는 1초에 한 번 보낼 수 있어요."); return;
    }
    const player = room.state.players.find(p => p?.id === playerId)!;
    const message: ChatMessage = { id: randomUUID(), playerId, nickname: player.nickname, text: msg.text, sentAt: now };
    room.chatTimes.set(playerId, now);
    room.chat.push(message);
    if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.shift();
    let requests = room.chatRequests.get(playerId);
    if (!requests) { requests = new Map(); room.chatRequests.set(playerId, requests); }
    requests.set(msg.requestId, message.id);
    for (const peer of room.sockets.values()) this.send(peer, { type: "chatMessage", roomId: msg.roomId, message });
    this.send(ws, { type: "chatAccepted", requestId: msg.requestId, roomId: msg.roomId, messageId: message.id });
  }
  private addPlayer(ws: WebSocket, room: Room, nickname: string, slot: number, requestId: string, avatar: Avatar = DEFAULT_AVATAR) {
    const id = randomUUID();
    room.state.players[slot] = { id, slot, nickname, avatar, connected: true, ready: false, forfeited: false, reconnectDeadline: null, scores: emptyScorecard() };
    room.tokens.set(id, randomBytes(32).toString("hex"));
    room.history.set(id, new Map());
    this.attach(ws, room, id, requestId);
  }
  private action(ws: WebSocket, msg: Exclude<ClientMessage, { type: "createRoom" | "joinRoom" | "resumeRoom" | "sendChat" | "clock" }>) {
    const session = this.sessions.get(ws);
    if (!session || session.room.state.roomId !== msg.roomId) { this.reject(ws, msg.requestId, "UNAUTHORIZED", "이 방에 연결된 플레이어가 아닙니다."); return; }
    const { room, playerId } = session;
    const history = room.history.get(playerId)!;
    const previous = history.get(msg.requestId);
    if (previous) { this.send(ws, previous); this.send(ws, { type: "roomState", state: room.state }); return; }
    if (msg.expectedRevision !== room.state.revision) {
      this.reject(ws, msg.requestId, "STALE_REVISION", "최신 상태로 갱신했습니다. 다시 선택해주세요.");
      this.send(ws, { type: "roomState", state: room.state }); return;
    }
    if (msg.type === "leaveRoom") {
      this.sessions.delete(ws);
      room.sockets.delete(playerId);
      const slot = room.state.players.findIndex(p => p?.id === playerId);
      if (room.state.phase === "waiting") {
        room.state.players[slot] = null;
        room.tokens.delete(playerId);
        room.chatRequests.delete(playerId); room.chatTimes.delete(playerId);
        room.deadlines.delete(playerId);
        for (const p of room.state.players) if (p) p.ready = false;
      } else {
        room.state.players[slot]!.connected = false;
        if (room.state.phase === "playing") {
          room.state.players[slot]!.forfeited = true;
          room.expired.add(playerId);
        }
        room.tokens.delete(playerId);
        room.deadlines.delete(playerId);
      }
      room.state.revision++;
      this.settle(room);
      if (!room.sockets.size) room.inactiveSince = this.now();
    } else {
      const result = applyGameAction(room.state, playerId, msg, max => randomInt(max));
      if (!result.ok) {
        const error: ServerMessage = { type: "rejected", requestId: msg.requestId, code: result.code, message: result.message };
        history.set(msg.requestId, error); this.send(ws, error); return;
      }
      const previousPhase=room.state.rollPhase;
      room.state = result.state;
      if (room.state.rollPhase === "shaking" && previousPhase !== "shaking") {
        this.startPhysics(room,playerId);
      } else if (msg.type === "roll" && room.physicsJob) {
        room.physicsJob.autoAt=undefined;
        room.physicsJob.deadline = this.now() + 20_000;
        this.physics.send({type:"stop",roomId:room.state.roomId,id:room.physicsJob.id});
      }

    }
    const reply: ServerMessage = { type: "accepted", requestId: msg.requestId, revision: room.state.revision };
    history.set(msg.requestId, reply);
    this.send(ws, reply);
    this.broadcast(room);
  }
  disconnected(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (!session) return;
    this.sessions.delete(ws);
    const { room, playerId } = session;
    if (room.sockets.get(playerId) !== ws) return;
    room.sockets.delete(playerId);
    const player = room.state.players.find(p => p?.id === playerId);
    if (player) { player.connected = false; if (room.state.phase === "waiting") player.ready = false; }
    if (room.state.phase !== "finished") room.deadlines.set(playerId, this.now() + room.state.disconnectGraceSeconds * 1000);
    if (!room.sockets.size) room.inactiveSince = this.now();
    room.state.revision++;
    this.broadcast(room);
  }
  private settle(room: Room) {
    if(room.state.augment) reconcileAugment(room.state,randomInt);
    settleGame(room.state);
    if (room.state.phase === "finished") { room.state.currentPlayerId = null; room.deadlines.clear(); }
  }
  tick() {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if(room.physicsJob?.autoAt && now>=room.physicsJob.autoAt && room.state.players.every(p=>!p||p.forfeited||p.connected)){
        room.physicsJob.autoAt=undefined;room.physicsJob.deadline=now+20000;room.state.rollPhase='throwing';room.state.revision++;
        this.physics.send({type:'stop',roomId:room.state.roomId,id:room.physicsJob.id});this.broadcast(room);
      }
      if (room.physicsJob?.deadline && now >= room.physicsJob.deadline) {
        const id = room.physicsJob.id;
        this.physics.send({type:"cancel",roomId:room.state.roomId,id});
        this.physicalEvent({type:"failed",roomId:room.state.roomId,id});
      }
      let changed = false;
      for (const [id, deadline] of room.deadlines) {
        if (room.state.phase === "finished") break;
        if (deadline > now || room.expired.has(id)) continue;
        room.expired.add(id); changed = true;
        if (room.state.phase === "waiting") {
          const slot = room.state.players.findIndex(p => p?.id === id);
          if (slot >= 0) room.state.players[slot] = null;
          room.tokens.delete(id); room.deadlines.delete(id);
          room.chatRequests.delete(id); room.chatTimes.delete(id);
          // Remaining ready players explicitly confirm readiness after a departure.
          for (const player of room.state.players) if (player) player.ready = false;
        } else {
          const player = room.state.players.find(p => p?.id === id);
          if (player) player.forfeited = true;
          room.deadlines.delete(id);
        }
      }
      if (changed) { this.settle(room); room.state.revision++; this.broadcast(room); }
      const removeAt = room.state.phase === "finished" ? room.finishedAt : room.state.phase === "waiting" ? room.inactiveSince : null;
      if (removeAt !== null && now - removeAt >= 30_000) {
        for (const ws of room.sockets.values()) { this.sessions.delete(ws); this.reject(ws, null, "ROOM_NOT_FOUND", "방의 30초 보관 시간이 끝났습니다."); }
        this.cancelPhysics(room);
        this.rooms.delete(code);
      }
    }
  }
}
