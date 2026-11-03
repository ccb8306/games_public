import type { MotionFrame, Pose } from "@yacht/shared";

export class MotionStream {
  private frames: MotionFrame[] = [];
  private id: string | null = null;
  private listeners = new Set<() => void>();
  private offset = 0;
  private clocks: { rtt: number; offset: number }[] = [];
  reset() {
    this.frames = [];
    this.id = null;
    this.notify();
  }
  clock(sentAt: number, serverAt: number, receivedAt = Date.now()) {
    const rtt = receivedAt - sentAt;
    if (rtt < 0 || rtt > 5000) return;
    this.clocks.push({ rtt, offset: serverAt - (sentAt + receivedAt) / 2 });
    this.clocks = this.clocks.slice(-6);
    this.offset = this.clocks.reduce((a, b) => (a.rtt < b.rtt ? a : b)).offset;
  }
  snapshot(frame: MotionFrame | null | undefined) {
    if (!frame) {
      this.reset();
      return;
    }
    if (this.id !== frame.id) {
      this.id = frame.id;
      this.frames = [];
    }
    this.ingest([frame]);
  }
  ingest(frames: MotionFrame[]) {
    for (const frame of frames) {
      if (frame.id !== this.id || frame.seq <= (this.frames.at(-1)?.seq ?? -1))
        continue;
      this.frames.push(frame);
    }
    this.frames = this.frames.slice(-120);
    this.notify();
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notify() {
    for (const listener of this.listeners) listener();
  }
  sample(
    now = Date.now(),
  ): { a: MotionFrame; b: MotionFrame; fraction: number } | null {
    if (!this.frames.length) return null;
    const at = now + this.offset - 150;
    let index = this.frames.findIndex((f) => f.at >= at);
    if (index < 0) index = this.frames.length - 1;
    const b = this.frames[index]!,
      a = this.frames[Math.max(0, index - 1)]!;
    const fraction =
      a.at === b.at ? 1 : Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at)));
    return { a, b, fraction };
  }
  latest() {
    return this.frames.at(-1) ?? null;
  }
}

// Same inputs and time yield the same position, regardless of local frame rate.
export function positionBetween(a: Pose, b: Pose, t: number): Pose["p"] {
  return a.p.map((v, i) => v + (b.p[i]! - v) * t) as Pose["p"];
}
