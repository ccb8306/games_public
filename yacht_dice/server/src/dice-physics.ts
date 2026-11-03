import { Body, Box, Vec3, World, Quaternion, SAPBroadphase, ConvexPolyhedron } from "cannon-es";
import {D12} from '@yacht/shared';

// BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z.
export const FACE_ORDER = [3, 4, 1, 6, 2, 5];
const NORMALS = [
  new Vec3(0, 1, 0),
  new Vec3(0, 0, 1),
  new Vec3(1, 0, 0),
  new Vec3(-1, 0, 0),
  new Vec3(0, 0, -1),
  new Vec3(0, -1, 0),
];
export const REST_SPOTS = [
  [-2.8, -0.65],
  [-1.4, 0.65],
  [0, -0.7],
  [1.4, 0.7],
  [2.8, -0.5],
  [-2.8, 2],
  [-1.4, 2],
  [0, 2],
  [1.4, 2],
  [2.8, 2],
];
// Small steps prevent fast corner impacts from sinking into the cup floor.
export const PHYSICS_STEP = 1 / 480;
export const POUR_AT = 0.28;
export const POUR_TILT = -2.4;
export const POUR_POSITION = new Vec3(-1.2, 2.95, 0);

export function faceUp(face: number, yaw = 0): Quaternion {
  const rotation = new Quaternion().setFromVectors(
    NORMALS[face - 1]!,
    new Vec3(0, 1, 0),
  );
  return new Quaternion()
    .setFromAxisAngle(new Vec3(0, 1, 0), yaw)
    .mult(rotation);
}

/** Authoritative collision world; no result is imposed after a throw. */
export function createDicePhysics(random: () => number, count = 5, monster?:number) {
  const world = new World({ gravity: new Vec3(0, -48, 0), allowSleep: true });
  world.broadphase = new SAPBroadphase(world);
  world.defaultContactMaterial.friction = 0.24;
  world.defaultContactMaterial.restitution = 0.32;
  const box = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const body = new Body({
      mass: 0,
      shape: new Box(new Vec3(sx / 2, sy / 2, sz / 2)),
      position: new Vec3(x, y, z),
    });
    world.addBody(body);
    return body;
  };
  box(0, -0.2, 0, 9, 0.4, 7);
  box(-4.4, 2.75, 0, 0.4, 5.5, 7);
  box(4.4, 2.75, 0, 0.4, 5.5, 7);
  box(0, 2.75, -3.4, 9, 5.5, 0.4);
  box(0, 2.75, 3.4, 9, 5.5, 0.4);
  box(0, 5.5, 0, 9, 0.4, 7);
  const cupScale = count > 8 ? 1.25 : 1;
  const cup: Body[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const wall = box(
      Math.sin(angle) * 1.825 * cupScale,
      1.35,
      Math.cos(angle) * 1.825 * cupScale,
      1.05 * cupScale,
      2.5,
      0.12 * cupScale,
    );
    wall.quaternion.setFromEuler(0.1, angle, 0, "YXZ");
    world.removeBody(wall);
    cup.push(wall);
  }
  const cupFloor = box(0, 0.16, 0, 3.4 * cupScale, 0.12, 3.4 * cupScale);
  world.removeBody(cupFloor);
  cup.push(cupFloor);
  const lid = box(0, 2.72, 0, 4 * cupScale, 0.16, 4 * cupScale);
  world.removeBody(lid);
  const cupRest = cup.map((body) => ({
    position: body.position.clone(),
    quaternion: body.quaternion.clone(),
  }));
  const bodies = Array.from({ length: count }, (_, i) => {
    const body = new Body({
      mass: 1,
      // A small collision skin catches fast impacts before the visible 0.9-unit die clips.
      shape: i===monster?new ConvexPolyhedron({vertices:D12.vertices.map(v=>new Vec3(...v)),faces:D12.faces.map(f=>f.indices)}):new Box(new Vec3(0.48, 0.48, 0.48)),
      linearDamping: 0.1,
      angularDamping: 0.12,
    });
    const [x, z] = REST_SPOTS[i] ?? [(i - 5) * 1.4, 2];
    body.position.set(x!, 0.46, z!);
    world.addBody(body);
    return body;
  });
  const removeCup = () => {
    if (lid.world) world.removeBody(lid);
    cup.forEach((body) => {
      if (body.world) world.removeBody(body);
    });
  };
  let shaking = false,
    shakeTime = 0;
  world.addEventListener("preStep", () => {
    if (!shaking) return;
    bodies.forEach((body, i) => {
      if (!body.world) return;
      body.applyForce(
        new Vec3(
          Math.sin(shakeTime * 19) * 90,
          0,
          Math.cos(shakeTime * 16) * 80,
        ),
      );
      if (
        body.position.y < 0.85 &&
        body.velocity.y <= 0 &&
        Math.sin(shakeTime * 13 + i) > 0.65
      )
        body.velocity.y = 8.5;
    });
    shakeTime += PHYSICS_STEP;
  });
  // cannon's elapsed-time overload drops substeps under load, desynchronizing the cup.
  let accumulator = 0;
  const step = (dt: number) => {
    accumulator += Math.min(dt, 0.05);
    while (accumulator + 1e-10 >= PHYSICS_STEP) {
      world.step(PHYSICS_STEP);
      accumulator -= PHYSICS_STEP;
    }
  };
  let pourWallY = 0;
  return {
    get cupLift() {
      return cup[0]!.position.y - pourWallY;
    },
    world,
    bodies,
    step,
    removeCup,
    setHeld(held: readonly boolean[]) {
      bodies.forEach((body, i) => {
        if (held[i] && body.world) world.removeBody(body);
        else if (!held[i] && !body.world) world.addBody(body);
      });
    },
    start() {
      if (!lid.world) world.addBody(lid);
      shaking = true;
      accumulator = 0;
      cup.forEach((body, i) => {
        body.type = Body.STATIC;
        body.velocity.setZero();
        body.position.copy(cupRest[i]!.position);
        body.quaternion.copy(cupRest[i]!.quaternion);
        body.aabbNeedsUpdate = true;
        if (!body.world) world.addBody(body);
      });
      bodies.forEach((body, i) => {
        if (!body.world) return;
        body.position.set(
          count > 8 ? ((i % 3) - 1) * 1.05 : i % 2 ? 0.62 : -0.62,
          i >= (count > 8 ? 6 : 4) ? 1.8 : 0.72,
          count > 8
            ? Math.floor(i / 3) % 2
              ? 0.56
              : -0.56
            : i % 4 < 2
              ? -0.62
              : 0.62,
        );
        body.quaternion.copy(
          faceUp(
            1 + Math.floor(random() * 6),
            (Math.floor(random() * 4) * Math.PI) / 2,
          ),
        );
        if(i===monster){body.position.y=i>=(count>8?6:4)?1.92:.92;if(count>8)body.position.x=1.2;}
        body.velocity.set(0, 2, 0);
        body.angularVelocity.set(
          4 + random() * 6,
          -5 + random() * 10,
          3 + random() * 5,
        );
        body.wakeUp();
      });
    },
    shake(time: number, dt: number) {
      shakeTime = time;
      step(dt);
    },
    pour() {
      if (!cup[0]!.world) this.start();
      if (lid.world) world.removeBody(lid);
      shaking = false;
      const tilt = new Quaternion().setFromEuler(0, 0, POUR_TILT);
      // Keep the rendered cup solid until the dice have left through its mouth.
      for (const body of cup) {
        body.position.y -= 1.35;
        tilt.vmult(body.position, body.position);
        body.position.vadd(POUR_POSITION, body.position);
        tilt.mult(body.quaternion, body.quaternion);
        body.type = Body.KINEMATIC;
        body.velocity.set(0, 3, 0);
        body.wakeUp();
        body.aabbNeedsUpdate = true;
      }
      pourWallY = cup[0]!.position.y;
      bodies.forEach((body, i) => {
        if (!body.world) return;
        body.position.y -= 1.35;
        tilt.vmult(body.position, body.position);
        body.position.vadd(POUR_POSITION, body.position);
        tilt.mult(body.quaternion, body.quaternion);
        tilt.vmult(new Vec3(0, 10 + i * 0.4, 0), body.velocity);
        body.angularVelocity.set(18 - i, 13 + i, 16);
        body.wakeUp();
      });
    },
    freeze() {
      shaking = false;
      removeCup();
      bodies.forEach((body) => {
        if (!body.world) return;
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.sleep();
      });
    },
  };
}
