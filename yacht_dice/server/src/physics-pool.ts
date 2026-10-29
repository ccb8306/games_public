import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import type { PhysicsCommand, PhysicsEvent } from "./physics-worker.js";

export class PhysicsPool {
  private workers: Worker[] = [];
  private readonly count = Math.min(4, availableParallelism());
  private jobs = new Map<string, { index: number; id: string }>();
  constructor(private receive: (event: PhysicsEvent) => void) {}
  private worker(index: number) {
    if (this.workers[index]) return this.workers[index]!;
    const worker = new Worker(
      new URL(
        import.meta.url.endsWith(".ts")
          ? "./physics-worker.ts"
          : "./physics-worker.js",
        import.meta.url,
      ),
      {
        resourceLimits: {
          maxOldGenerationSizeMb: 128,
          maxYoungGenerationSizeMb: 16,
        },
      },
    );
    worker.on("message", (event: PhysicsEvent) => {
      if (this.jobs.get(event.roomId)?.id !== event.id) return;
      if (event.type !== "frames") this.jobs.delete(event.roomId);
      this.receive(event);
    });
    worker.on("error", () => {
      for (const [roomId, job] of this.jobs)
        if (job.index === index) {
          this.jobs.delete(roomId);
          this.receive({ type: "failed", roomId, id: job.id });
        }
      delete this.workers[index];
    });
    this.workers[index] = worker;
    return worker;
  }
  send(command: PhysicsCommand) {
    if (command.type === "start") {
      const counts = Array(this.count).fill(0) as number[];
      for (const job of this.jobs.values()) counts[job.index]!++;
      const index = counts.indexOf(Math.min(...counts));
      this.jobs.set(command.roomId, { index, id: command.id });
    }
    const job = this.jobs.get(command.roomId);
    if (!job || job.id !== command.id) return;
    this.worker(job.index).postMessage(command);
    if (command.type === "cancel") this.jobs.delete(command.roomId);
  }
  async close() {
    this.jobs.clear();
    await Promise.all(this.workers.map((worker) => worker?.terminate()));
    this.workers = [];
  }
}
