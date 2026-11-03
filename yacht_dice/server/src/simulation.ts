import { Quaternion, Vec3, ConvexPolyhedron, type Body } from "cannon-es";
import { randomInt } from "node:crypto";
import type { MotionFrame, Pose, RoomState } from "@yacht/shared";
import {
  createDicePhysics,
  POUR_AT,
  POUR_POSITION,
  POUR_TILT,
} from "./dice-physics.js";

const normals = [
  new Vec3(0, 1, 0),
  new Vec3(0, 0, 1),
  new Vec3(1, 0, 0),
  new Vec3(-1, 0, 0),
  new Vec3(0, 0, -1),
  new Vec3(0, -1, 0),
];
export function topFace(body: Body) {
  let face = 1,
    dot = -1;
  (body.shapes[0] instanceof ConvexPolyhedron?body.shapes[0].faceNormals:normals).forEach((normal, i) => {
    const y = body.quaternion.vmult(normal).y;
    if (y > dot) {
      face = i + 1;
      dot = y;
    }
  });
  return { face, dot };
}
export function grounded(body: Body) {
  return (
    // Readable tilts are valid; moving, edge-balanced or stacked dice still need recovery.
    topFace(body).dot >= 0.85 &&
    body.position.y >= 0.42 &&
    body.position.y <= 0.9 &&
    body.velocity.length() < 0.12 &&
    body.angularVelocity.length() < 0.2
  );
}
export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pose(p: Vec3, q: Quaternion): Pose {
  return { p: [p.x, p.y, p.z], q: [q.x, q.y, q.z, q.w] };
}

export class Simulation {
  readonly physics: ReturnType<typeof createDicePhysics>;
  phase: "shaking" | "throwing" | "rest" = "shaking";
  paused = false;
  elapsed = 0;
  throwTime = 0;
  seq = 0;
  windCount = 0;
  windDirection = 0;
  private random: () => number;
  windUntil = 0;
  failed = false;
  private poured = false;
  private stable = 0;
  private still = 0;
  constructor(
    readonly id: string,
    readonly held: RoomState["held"],
    readonly previousDice: RoomState["dice"],
    seed?: number,
    previousPoses?: Pose[],
    readonly faces?:number[],
    readonly monster?:number,
  ) {
    this.random =
      seed === undefined
        ? () => randomInt(0x100000000) / 0x100000000
        : seededRandom(seed);
    this.physics = createDicePhysics(this.random, held.length,monster);
    previousPoses?.forEach((pose, i) => {
      const body = this.physics.bodies[i]!;
      body.position.set(...pose.p);
      body.quaternion.set(...pose.q);
    });
    this.physics.setHeld(held);
    this.physics.start();
  }
  stop() {
    if (this.phase === "shaking") {
      this.phase = "throwing";
      this.throwTime = 0;
    }
  }
  tick(dt = 1 / 60) {
    if (this.paused || this.phase === "rest" || this.failed) return;
    this.elapsed += dt;
    if (this.phase === "shaking") {
      this.physics.shake(this.elapsed, dt);
      return;
    }
    this.throwTime += dt;
    if (this.throwTime < POUR_AT) return;
    if (!this.poured) {
      this.physics.pour();
      this.poured = true;
    }
    this.physics.step(dt);
    if (this.physics.cupLift > 5) this.physics.removeCup();
    const active = this.physics.bodies.filter((body) => body.world);
    if (
      active.some(
        (b) =>
          !Number.isFinite(
            b.position.length() +
              (b.quaternion.x +
                b.quaternion.y +
                b.quaternion.z +
                b.quaternion.w),
          ),
      )
    ) {
      this.failed = true;
      return;
    }
    this.stable = active.every(grounded) ? this.stable + dt : 0;
    this.still = active.every(
      (body) =>
        body.velocity.length() < 0.12 && body.angularVelocity.length() < 0.2,
    )
      ? this.still + dt
      : 0;
    if (this.stable >= 0.3) {
      this.phase = "rest";
      this.physics.freeze();
      return;
    }
    if (
      this.still >= 0.6 &&
      this.throwTime >= 3 + this.windCount * 2 &&
      this.windCount < (this.held.length > 7 ? 6 : 3)
    )
      this.blow();
    if (this.throwTime >= (this.held.length > 7 ? 18 : 10)) this.failed = true;
  }
  blow() {
    this.windCount++;
    this.windDirection = Math.floor(this.random() * 8);
    this.windUntil = this.throwTime + 0.65;
    this.stable = 0;
    this.still = 0;
    this.physics.bodies.forEach((body, i) => {
      if (!body.world || grounded(body)) return;
      const angle = (this.windDirection * Math.PI) / 4;
      const inward = new Vec3(
        Math.cos(angle) * (2.4 + this.windCount),
        4 + this.windCount * 2,
        Math.sin(angle) * (2.4 + this.windCount),
      );
      body.wakeUp();
      body.applyImpulse(inward);
      body.angularVelocity.vadd(
        new Vec3(1.5 * this.windCount, 0.5, -this.windCount),
        body.angularVelocity,
      );
    });
  }
  values(): RoomState["dice"] {
    return this.physics.bodies.map((b, i) =>
      this.held[i] ? this.previousDice[i] : i!==this.monster&&this.faces?this.faces[topFace(b).face-1]:topFace(b).face,
    ) as RoomState["dice"];
  }
  frame(at: number): MotionFrame {
    let cup: Pose | null = null;
    let q = new Quaternion(),
      p = new Vec3(0, 1.35, 0);
    if (this.phase === "shaking") {
      p.set(
        Math.sin(this.elapsed * 19) * 0.72,
        1.35 + Math.cos(this.elapsed * 16) * 0.16,
        0,
      );
      q.setFromEuler(
        Math.cos(this.elapsed * 16) * 0.2,
        0,
        Math.sin(this.elapsed * 19) * 0.3,
      );
      cup = pose(p, q);
    } else if (this.phase === "throwing") {
      const t = Math.min(this.throwTime / POUR_AT, 1);
      const fraction = t * t * (3 - 2 * t);
      p.set(
        POUR_POSITION.x * fraction,
        1.35 +
          fraction * (POUR_POSITION.y - 1.35) +
          Math.sin(t * Math.PI) * 0.4 +
          (this.poured ? this.physics.cupLift : 0),
        0,
      );
      q.setFromEuler(0, 0, POUR_TILT * fraction);
      if (p.y < 8) cup = pose(p, q);
    }
    const dice = this.physics.bodies.map((b, i) => {
      if (!this.held[i] && !this.poured && this.phase !== "rest") {
        const position = b.position.clone();
        position.y -= 1.35;
        q.vmult(position, position);
        position.vadd(p, position);
        return pose(position, q.mult(b.quaternion));
      }
      return pose(b.position, b.quaternion);
    });
    return {
      id: this.id,
      seq: this.seq++,
      at,
      phase: this.phase,
      dice,
      cup,
      wind: this.phase === "throwing" && this.throwTime < this.windUntil,
      windDirection: this.windDirection,
      paused: this.paused,
    };
  }
}
