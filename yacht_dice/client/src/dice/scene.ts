import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { RoomState } from "@yacht/shared";
import type { RollPhase } from "../feedback/qualifications";
import { FACE_ORDER, D12, type Pose } from "@yacht/shared";
import { MotionStream, positionBetween } from "./motion";

export type DiceView = {
  motion?: MotionStream;
  dice: RoomState["dice"];
  held: RoomState["held"];
  phase: RollPhase;
  disabled: boolean;
  faces?: number[][];
  monster?: number;
  childIndex?: number;
};

export function createDiceScene(
  host: HTMLElement,
  onSelect: (index: number) => void,
  onUnavailable: () => void,
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 3, -3, 0.1, 60);
  const table = new THREE.Group();
  scene.add(table);
  scene.add(new THREE.HemisphereLight(0xfff5df, 0x23372e, 3));
  const light = new THREE.DirectionalLight(0xfff5dc, 4);
  light.position.set(-3, 9, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {
    left: -6,
    right: 6,
    top: 5,
    bottom: -5,
  });
  light.shadow.normalBias = 0.035;
  scene.add(light);
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const textures: THREE.Texture[] = [];
  const material = (color: number, roughness = 0.75, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    mat: THREE.Material | THREE.Material[],
    parent: THREE.Object3D = table,
  ) => {
    geometries.push(geometry);
    const m = new THREE.Mesh(geometry, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const wood = material(0x3b2a20),
    felt = material(0x20604b),
    brass = material(0xd8b66d, 0.35, 0.55);
  const block = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const m = mesh(
      new RoundedBoxGeometry(w, h, d, 3, Math.min(0.1, h / 3)),
      mat,
    );
    m.position.set(x, y, z);
    return m;
  };
  block(9.4, 0.4, 7.4, 0, -0.28, 0, wood);
  block(8.8, 0.1, 6.8, 0, -0.025, 0, felt);
  for (const x of [-4.5, 4.5]) {
    block(0.35, 0.65, 7.3, x, 0.18, 0, wood);
    block(0.06, 0.04, 6.9, x, 0.52, 0, brass);
  }
  for (const z of [-3.5, 3.5]) {
    block(9.3, 0.65, 0.35, 0, 0.18, z, wood);
    block(8.9, 0.04, 0.06, 0, 0.52, z, brass);
  }
  const cup = new THREE.Group();
  table.add(cup);
  const leather = material(0x244a40, 0.65);
  leather.side = THREE.DoubleSide;
  mesh(new THREE.CylinderGeometry(1.95, 1.7, 2.5, 48, 1, true), leather, cup);
  const cupBottom = mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 0.12, 48),
    leather,
    cup,
  );
  cupBottom.position.y = -1.2;
  const glass = material(0xd9f4ec, 0.15);
  glass.transparent = true;
  glass.opacity = 0.08;
  glass.depthWrite = false;
  const cupLid = mesh(
    new THREE.CylinderGeometry(1.98, 1.98, 0.16, 48),
    glass,
    cup,
  );
  cupLid.position.y = 1.37;
  cupLid.castShadow = cupLid.receiveShadow = false;
  for (const [radius, y] of [
    [1.95, 1.25],
    [1.71, -1.18],
    [1.79, -0.35],
  ]) {
    const ring = mesh(
      new THREE.TorusGeometry(radius!, 0.035, 8, 48),
      brass,
      cup,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y!;
  }
  const pipPositions = [
    [],
    [[0.5, 0.5]],
    [
      [0.27, 0.27],
      [0.73, 0.73],
    ],
    [
      [0.27, 0.27],
      [0.5, 0.5],
      [0.73, 0.73],
    ],
    [
      [0.27, 0.27],
      [0.73, 0.27],
      [0.27, 0.73],
      [0.73, 0.73],
    ],
    [
      [0.27, 0.27],
      [0.73, 0.27],
      [0.5, 0.5],
      [0.27, 0.73],
      [0.73, 0.73],
    ],
    [
      [0.27, 0.27],
      [0.73, 0.27],
      [0.27, 0.5],
      [0.73, 0.5],
      [0.27, 0.73],
      [0.73, 0.73],
    ],
  ];
  const diceMaterials = FACE_ORDER.map((face) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff4da";
    context.fillRect(0, 0, 128, 128);
    for (const [x, y] of pipPositions[face]!) {
      const gradient = context.createRadialGradient(
        x! * 128 - 2,
        y! * 128 - 2,
        1,
        x! * 128,
        y! * 128,
        10,
      );
      gradient.addColorStop(0, face === 1 ? "#8d2923" : "#10291f");
      gradient.addColorStop(0.8, face === 1 ? "#c34b39" : "#315448");
      gradient.addColorStop(1, "#cbbfa8");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x! * 128, y! * 128, 10, 0, Math.PI * 2);
      context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.32,
    });
    materials.push(mat);
    return mat;
  });
  const makeDie = () =>
    mesh(new RoundedBoxGeometry(0.9, 0.9, 0.9, 3, 0.08), diceMaterials);
  const diceMeshes = Array.from({ length: 5 }, makeDie);
  const childMaterials = diceMaterials.map((m, i) => {
    const copy = m.clone();
    copy.color.set(i % 2 ? "#b4e8ff" : "#ffc7df");
    copy.emissive.set("#271327");
    copy.emissiveIntensity = 0.15;
    materials.push(copy);
    return copy;
  });
  const monsterGeometry = new THREE.BufferGeometry(),
    positions: number[] = [],
    uvs: number[] = [];
  const monsterMaterials = D12.faces.map((face, index) => {
    const center = new THREE.Vector3();
    for (const i of face.indices)
      center.add(new THREE.Vector3(...D12.vertices[i]!));
    center.divideScalar(5);
    const normal = new THREE.Vector3(...face.normal),
      u = new THREE.Vector3(...D12.vertices[face.indices[0]!]!)
        .sub(center)
        .normalize(),
      v = new THREE.Vector3().crossVectors(normal, u);
    const start = positions.length / 3;
    for (let j = 1; j < 4; j++)
      for (const id of [
        face.indices[0]!,
        face.indices[j]!,
        face.indices[j + 1]!,
      ]) {
        const point = new THREE.Vector3(...D12.vertices[id]!);
        positions.push(...point.toArray());
        point.sub(center);
        uvs.push(0.5 + point.dot(u), 0.5 + point.dot(v));
      }
    monsterGeometry.addGroup(start, 9, index);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#52215d";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#ffcc6b";
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, 122, 122);
    ctx.fillStyle = "#fff2c8";
    ctx.font = "bold 65px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${index + 1}${[6, 9].includes(index + 1) ? "." : ""}`,
      64,
      64,
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.3,
      metalness: 0.15,
    });
    materials.push(mat);
    return mat;
  });
  monsterGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  monsterGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  monsterGeometry.computeVertexNormals();
  geometries.push(monsterGeometry);
  let view: DiceView = {
    dice: [null, null, null, null, null],
    held: [false, false, false, false, false],
    phase: "idle",
    disabled: true,
  };
  let frame = 0,
    disposed = false,
    lost = false;
  let unsubscribe: (() => void) | undefined;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const qa = new THREE.Quaternion(),
    qb = new THREE.Quaternion();
  function applyPose(
    object: THREE.Object3D,
    a: Pose,
    b: Pose,
    fraction: number,
  ) {
    object.position.fromArray(positionBetween(a, b, fraction));
    qa.fromArray(a.q);
    qb.fromArray(b.q);
    object.quaternion.slerpQuaternions(qa, qb, fraction);
  }
  function request() {
    if (!frame && !disposed && !lost && !document.hidden)
      frame = requestAnimationFrame(draw);
  }
  function draw() {
    frame = 0;
    if (disposed || lost) return;
    const sample = view.motion?.sample();
    cup.visible = false;
    cupLid.visible = false;
    diceMeshes.forEach((m) => (m.visible = false));
    host.dataset.wind = "false";
    if (sample) {
      const { a, b, fraction } = sample;
      const discrete = fraction < 1 ? a : b;
      cupLid.visible = discrete.phase === "shaking";
      const show = !motion.matches || discrete.phase === "rest";
      if (show) {
        diceMeshes.forEach((m, i) => {
          if (!a.dice[i] || !b.dice[i]) return;
          applyPose(m, a.dice[i]!, b.dice[i]!, fraction);
          m.visible =
            !view.held[i] &&
            (discrete.phase !== "rest" || view.dice[i] !== null);
        });
        if (discrete.cup) {
          applyPose(
            cup,
            a.cup ?? discrete.cup,
            b.cup ?? discrete.cup,
            fraction,
          );
          cup.visible = true;
        }
      }
      host.dataset.wind = String(discrete.wind && !discrete.paused);
      host.style.setProperty(
        "--wind-angle",
        (discrete.windDirection ?? 0) * 45 + "deg",
      );
    } else if (view.dice.every((n) => n === null)) {
      cup.visible = true;
      cup.position.set(0, 1.35, 0);
      cup.rotation.set(0, 0, 0);
    }
    renderer.render(scene, camera);
    if (
      !motion.matches &&
      sample &&
      (sample.fraction < 1 ||
        sample.b.seq < (view.motion?.latest()?.seq ?? 0)) &&
      !sample.b.paused
    )
      request();
  }
  function resize() {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    const aspect = width / height;
    const viewWidth = Math.max(10.4, 6.4 * aspect);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewWidth / aspect / 2;
    camera.bottom = -camera.top;
    camera.position.set(0, 10, 8);
    camera.lookAt(0, 0.45, 0);
    camera.updateProjectionMatrix();
    request();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  function motionChanged() {
    request();
  }
  motion.addEventListener("change", motionChanged);
  function visibilityChanged() {
    request();
  }
  document.addEventListener("visibilitychange", visibilityChanged);
  const raycaster = new THREE.Raycaster();
  let press: { x: number; y: number } | null = null;
  function pointerDown(event: PointerEvent) {
    press =
      event.isPrimary && event.button === 0
        ? { x: event.clientX, y: event.clientY }
        : null;
  }
  function pointerCancel() {
    press = null;
  }
  function select(event: PointerEvent) {
    const start = press;
    press = null;
    if (
      !start ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
    )
      return;
    if (view.disabled || view.phase === "shaking" || view.phase === "throwing")
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(
      diceMeshes.filter((m) => m.visible),
    )[0];
    if (hit) onSelect(diceMeshes.indexOf(hit.object as THREE.Mesh));
  }
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointercancel", pointerCancel);
  renderer.domElement.addEventListener("pointerup", select);
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    onUnavailable();
  }
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  return {
    update(next: DiceView) {
      if (next.motion !== view.motion) {
        unsubscribe?.();
        unsubscribe = next.motion?.subscribe(request);
      }
      view = next;
      cup.scale.set(
        next.dice.length > 8 ? 1.25 : 1,
        1,
        next.dice.length > 8 ? 1.25 : 1,
      );
      while (diceMeshes.length < next.dice.length) diceMeshes.push(makeDie());
      while (diceMeshes.length > next.dice.length)
        table.remove(diceMeshes.pop()!);
      diceMeshes.forEach((m, i) => {
        m.userData.normalGeometry ??= m.geometry;
        m.geometry =
          i === next.monster ? monsterGeometry : m.userData.normalGeometry;
        const base = i === next.childIndex ? childMaterials : diceMaterials;
        m.material =
          i === next.monster
            ? monsterMaterials
            : next.faces?.[i]
              ? FACE_ORDER.map(
                  (f) => base[FACE_ORDER.indexOf(next.faces![i]![f - 1]!)]!,
                )
              : base;
      });
      request();
    },
    dispose() {
      disposed = true;
      unsubscribe?.();
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
      renderer.domElement.removeEventListener("pointerup", select);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
