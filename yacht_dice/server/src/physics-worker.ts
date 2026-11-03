import { parentPort } from "node:worker_threads";
import type { MotionFrame, RoomState, Pose } from "@yacht/shared";
import { Simulation } from "./simulation.js";
export type PhysicsCommand =
  | {
      type: "start";
      roomId: string;
      id: string;
      held: RoomState["held"];
      dice: RoomState["dice"];
      poses?: Pose[];
      faces?:number[];
      monster?:number;
    }
  | { type: "stop" | "cancel"; roomId: string; id: string }
  | { type: "pause"; roomId: string; id: string; paused: boolean };
export type PhysicsEvent =
  | { type: "frames"; roomId: string; id: string; frames: MotionFrame[] }
  | {
      type: "done";
      roomId: string;
      id: string;
      frame: MotionFrame;
      dice: RoomState["dice"];
    }
  | { type: "failed"; roomId: string; id: string };
const jobs = new Map<string, { sim: Simulation; frames: MotionFrame[] }>();
let timer: ReturnType<typeof setInterval> | undefined;
let last = Date.now(),
  remainder = 0;
function send(event: PhysicsEvent) {
  parentPort!.postMessage(event);
}
function tick() {
  const now = Date.now();
  remainder += (now - last) / 1000;
  last = now;
  // Under CPU pressure slow simulated time instead of skipping collision steps or cancelling every room.
  remainder = Math.min(remainder, 0.1);
  while (remainder >= 1 / 60) {
    remainder -= 1 / 60;
    for (const [roomId, job] of jobs) {
      const { sim } = job;
      if (sim.paused) continue;
      try {
        sim.tick();
        const frame = sim.frame(now - remainder * 1000);
        if (sim.failed) {
          send({ type: "failed", roomId, id: sim.id });
          jobs.delete(roomId);
        } else if (sim.phase === "rest") {
          send({ type: "done", roomId, id: sim.id, frame, dice: sim.values() });
          jobs.delete(roomId);
        } else {
          job.frames.push(frame);
          if (job.frames.length === 3) {
            send({ type: "frames", roomId, id: sim.id, frames: job.frames });
            job.frames = [];
          }
        }
      } catch {
        send({ type: "failed", roomId, id: sim.id });
        jobs.delete(roomId);
      }
    }
  }
  if (!jobs.size) {
    clearInterval(timer);
    timer = undefined;
  }
}
parentPort!.on("message", (command: PhysicsCommand) => {
  if (command.type === "start") {
    try {
      const sim = new Simulation(
        command.id,
        command.held,
        command.dice,
        undefined,
        command.poses,
        command.faces,
        command.monster,
      );
      sim.seq = 1;
      jobs.set(command.roomId, { sim, frames: [] });
      send({
        type: "frames",
        roomId: command.roomId,
        id: sim.id,
        frames: [sim.frame(Date.now())],
      });
      if (!timer) {
        last = Date.now();
        remainder = 0;
        timer = setInterval(tick, 8);
      }
    } catch {
      send({ type: "failed", roomId: command.roomId, id: command.id });
    }
    return;
  }
  const job = jobs.get(command.roomId);
  if (!job || job.sim.id !== command.id) return;
  if (command.type === "cancel") jobs.delete(command.roomId);
  else if (command.type === "stop") job.sim.stop();
  else if (command.type === "pause") {
    job.sim.paused = command.paused;
    job.frames = [];
    send({
      type: "frames",
      roomId: command.roomId,
      id: job.sim.id,
      frames: [job.sim.frame(Date.now())],
    });
  }
});
