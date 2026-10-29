import { test } from "node:test";
import assert from "node:assert/strict";
import type { MotionFrame } from "@yacht/shared";
import { MotionStream, positionBetween } from "../src/dice/motion";
function frame(seq: number, at: number): MotionFrame {
  return {
    id: "roll",
    seq,
    at,
    phase: "throwing",
    wind: false,
    paused: false,
    cup: null,
    dice: Array.from({ length: 5 }, () => ({
      p: [seq, 0, 0],
      q: [0, 0, 0, 1],
    })),
  };
}
test("clients at different frame rates and clock offsets sample the same trajectory", () => {
  const a = new MotionStream(),
    b = new MotionStream();
  a.clock(1000, 1010, 1020);
  b.clock(900, 1010, 920);
  a.snapshot(frame(0, 1000));
  b.snapshot(frame(0, 1000));
  const frames = [frame(1, 1050), frame(2, 1100), frame(3, 1150)];
  a.ingest(frames);
  b.ingest(frames);
  for (let t = 1000; t < 1225; t += 8) a.sample(t);
  for (let t = 900; t < 1125; t += 50) b.sample(t);
  assert.deepEqual(a.sample(1225), b.sample(1125));
  const s = a.sample(1225)!;
  assert.deepEqual(
    positionBetween(s.a.dice[0]!, s.b.dice[0]!, s.fraction),
    [1.5, 0, 0],
  );
});
test("duplicates, stale rolls, delayed final frames and reconnect snapshots", () => {
  const stream = new MotionStream();
  stream.snapshot(frame(0, 1000));
  stream.ingest([
    frame(2, 1100),
    frame(1, 1050),
    { ...frame(3, 1150), id: "old" },
  ]);
  assert.equal(stream.latest()?.seq, 2);
  const final = { ...frame(3, 1200), phase: "rest" as const };
  stream.snapshot(final);
  assert.notEqual(stream.sample(1300)?.fraction, 1);
  assert.equal(stream.sample(1400)?.b.phase, "rest");
  const resumed = new MotionStream();
  resumed.snapshot(final);
  assert.deepEqual(resumed.sample(1400)?.b, stream.sample(1400)?.b);
  stream.snapshot({ ...frame(0, 1500), id: "new" });
  stream.ingest([final]);
  assert.equal(stream.latest()?.id, "new");
  stream.reset();
  assert.equal(stream.sample(), null);
});
