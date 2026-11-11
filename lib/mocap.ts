// Dances, from motion capture.
//
// The dances are real human dances recorded for Mixamo's standard skeleton and
// dropped into public/dances/ as FBX files (see public/dances/index.json, which
// `scripts/dance-index.mjs` writes). Nothing here is keyframed by hand: every
// frame, the human skeleton is played at the right time and the cow is posed to
// match it.
//
// The cow is not a person, so this is not a bone-for-bone copy. It is a mapping
// of DIRECTIONS, which does not care that the two skeletons have different
// proportions or different resting poses:
//
//   - the cow's body points the way the dancer's torso points (hips to neck),
//     leaning forward the way the cow does when it rears up anyway;
//   - each segment of a front leg points the way the matching piece of the
//     dancer's arm points, so the hooves become hands;
//   - each segment of a hind leg points the way the dancer's thigh and shin do;
//   - the head turns the way the dancer's head turns.
//
// Then the whole cow is lifted or lowered so its lowest point is as high off the
// ground as the dancer's lowest point — feet in a moonwalk, the head in a
// headspin — and any distance the dancer travels (a moonwalk goes backwards)
// moves the cow through the world.

import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { PartName } from "./poses";
import { BACK_RIG, STAND_HIP_Y, STAND_TILT } from "./locomotion";
import { pick } from "./reactions";

/** One dance, loaded and ready to sample. */
export interface Dance {
  name: string;
  duration: number;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  joints: Record<Joint, THREE.Object3D>;
  /** The head's world rotation in the rest (T) pose, to measure turns from. */
  headBind: THREE.Quaternion;
  /** Hip height and lowest point in the rest pose, in the file's units. */
  hip0: number;
  low0: number;
  /** Where the hips are at the start of the loop, and how far they go in one loop. */
  start: THREE.Vector3;
  drift: THREE.Vector3;
}

const JOINTS = {
  hips: "Hips",
  chest: "Spine2",
  neck: "Neck",
  head: "Head",
  headTop: "HeadTop_End",
  lArm: "LeftArm",
  lFore: "LeftForeArm",
  lHand: "LeftHand",
  lFinger: "LeftHandMiddle1",
  rArm: "RightArm",
  rFore: "RightForeArm",
  rHand: "RightHand",
  rFinger: "RightHandMiddle1",
  lThigh: "LeftUpLeg",
  lKnee: "LeftLeg",
  lFoot: "LeftFoot",
  lToe: "LeftToeBase",
  rThigh: "RightUpLeg",
  rKnee: "RightLeg",
  rFoot: "RightFoot",
  rToe: "RightToeBase",
} as const;
type Joint = keyof typeof JOINTS;

/** The points that can touch the ground, for keeping the cow on it. */
const CONTACTS: Joint[] = ["lToe", "rToe", "lFoot", "rFoot", "lHand", "rHand", "headTop", "head", "lKnee", "rKnee", "lFore", "rFore", "hips", "chest"];

// ---------------------------------------------------------------------------
// loading
// ---------------------------------------------------------------------------

const loaded = new Map<string, Promise<Dance | null>>();
let names: string[] | null = null;
let listing: Promise<string[]> | null = null;

/** Every dance there is, by file name without the extension. */
export function danceNames(): Promise<string[]> {
  listing ??= fetch("/dances/index.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((list: string[]) => (names = list))
    .catch(() => (names = []));
  return listing;
}

export function loadDance(name: string): Promise<Dance | null> {
  let p = loaded.get(name);
  if (p) return p;
  p = new FBXLoader()
    .loadAsync(`/dances/${name}.fbx`)
    .then((root) => prepare(name, root))
    .catch((e) => {
      console.warn(`dance ${name} failed to load`, e);
      return null;
    });
  loaded.set(name, p);
  return p;
}

function prepare(name: string, root: THREE.Object3D): Dance | null {
  const clip = root.animations[0];
  if (!clip) return null;
  const joints = {} as Record<Joint, THREE.Object3D>;
  for (const [key, bone] of Object.entries(JOINTS)) {
    // Mixamo names its bones "mixamorig:Hips"; three strips the colon.
    const o = root.getObjectByName(`mixamorig${bone}`) ?? root.getObjectByName(`mixamorig:${bone}`);
    if (!o) {
      console.warn(`dance ${name}: no ${bone} bone`);
      return null;
    }
    joints[key as Joint] = o;
  }
  // The bones sit in the rest pose until the clip is played.
  root.updateMatrixWorld(true);
  const headBind = joints.head.getWorldQuaternion(new THREE.Quaternion());
  const hip0 = joints.hips.getWorldPosition(new THREE.Vector3()).y;
  const low0 = lowest(joints);

  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const dance: Dance = {
    name,
    duration: clip.duration,
    root,
    mixer,
    joints,
    headBind,
    hip0,
    low0,
    start: new THREE.Vector3(),
    drift: new THREE.Vector3(),
  };
  dance.start.copy(hipsAt(dance, 0));
  dance.drift.copy(hipsAt(dance, clip.duration - 1e-3)).sub(dance.start);
  dance.drift.y = 0;
  return dance;
}

const tmp = new THREE.Vector3();

function lowest(joints: Record<Joint, THREE.Object3D>): number {
  let low = Infinity;
  for (const j of CONTACTS) low = Math.min(low, joints[j].getWorldPosition(tmp).y);
  return low;
}

function play(d: Dance, t: number) {
  d.mixer.setTime(((t % d.duration) + d.duration) % d.duration);
  d.root.updateMatrixWorld(true);
}

function hipsAt(d: Dance, t: number): THREE.Vector3 {
  play(d, t);
  return d.joints.hips.getWorldPosition(new THREE.Vector3());
}

// ---------------------------------------------------------------------------
// which dance is on
// ---------------------------------------------------------------------------

let current: Dance | null = null;
let startedAt = 0;
/** Dances that have finished loading, by name. */
const ready = new Map<string, Dance>();

/** The dance clock: seconds, on the same clock the store's timers measure. */
function clock(): number {
  return performance.now() / 1000;
}

/**
 * Pick the next dance and start it — one of `prefer`, if any of those are
 * loaded. Returns how long it should run, in ms, or
 * 0 if none has loaded yet (the caller then falls back on the hand-made one).
 * Dealt like the lines are: every dance comes up once before any comes up twice.
 */
export function startDance(prefer?: string[]): number {
  if (ready.size === 0) {
    void danceNames().then(preloadAll);
    return 0;
  }
  const preferred = prefer ? [...ready.values()].filter((d) => prefer.includes(d.name)) : [];
  const d = preferred.length ? pick("title-dances", preferred) : pick("dances", [...ready.values()]);
  current = d;
  startedAt = clock();
  return danceLength(d) * 1000;
}

/** Load every dance in the background, so the first press is not a wait. */
export function preloadAll(list: string[] = names ?? []) {
  for (const n of list) {
    void loadDance(n).then((d) => {
      if (d) ready.set(n, d);
    });
  }
}

export function hasDances(): boolean {
  return ready.size > 0;
}

export function currentDance(): Dance | null {
  return current;
}

/** How long the current dance should run as a gag: a few loops of a short clip, one pass of a long one. */
export function danceLength(d: Dance): number {
  return d.duration < 4 ? d.duration * Math.ceil(8 / d.duration) : d.duration;
}

// ---------------------------------------------------------------------------
// the retarget
// ---------------------------------------------------------------------------

export interface Rest {
  pos: [number, number, number];
  rot: [number, number, number];
}

export interface CowTarget {
  /** Local rotation for every part the dance drives. */
  quat: Partial<Record<PartName, THREE.Quaternion>>;
  bodyPos: THREE.Vector3;
  /** How high the cow's lowest point should be off the ground. */
  low: number;
  /** Where along the loop's travel the cow should be, in its own space. */
  travel: THREE.Vector3;
}

/** How tall the cow is (at the hip, reared up) against how tall the dancer is. */
function scaleOf(d: Dance): number {
  return STAND_HIP_Y / d.hip0;
}

/** How far a hind leg kinks at the hock, either side of the dancer's shin. */
const HOCK = 0.32;

const P = Object.fromEntries(Object.keys(JOINTS).map((k) => [k, new THREE.Vector3()])) as Record<Joint, THREE.Vector3>;
const DOWN = new THREE.Vector3(0, -1, 0);

const out: CowTarget = {
  quat: {},
  bodyPos: new THREE.Vector3(),
  low: 0,
  travel: new THREE.Vector3(),
};

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const lat = new THREE.Vector3();
const up = new THREE.Vector3();
const fwd = new THREE.Vector3();
const basis = new THREE.Matrix4();
const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), STAND_TILT);
const qBody = new THREE.Quaternion();
const qHead = new THREE.Quaternion();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const restQ = new Map<PartName, THREE.Quaternion>();
const euler = new THREE.Euler();

function restQuat(name: PartName, rest: Record<PartName, Rest>): THREE.Quaternion {
  let q = restQ.get(name);
  if (!q) {
    const r = rest[name].rot;
    q = new THREE.Quaternion().setFromEuler(euler.set(r[0], r[1], r[2]));
    restQ.set(name, q);
  }
  return q;
}

function slot(name: PartName): THREE.Quaternion {
  return (out.quat[name] ??= new THREE.Quaternion());
}

/**
 * Aim a chain of bones down a list of directions. Each bone hangs along its own
 * -y; it is swung, from its resting rotation, by the smallest turn that points
 * it where the dancer's matching bone points. `parent` is the world rotation of
 * whatever the chain hangs off.
 */
function aimChain(parent: THREE.Quaternion, parts: PartName[], dirs: THREE.Vector3[], rest: Record<PartName, Rest>) {
  qa.copy(parent);
  parts.forEach((name, i) => {
    const world = qb.copy(qa).multiply(restQuat(name, rest));
    const now = v1.copy(DOWN).applyQuaternion(world);
    const swing = new THREE.Quaternion().setFromUnitVectors(now, dirs[i]);
    world.premultiply(swing);
    slot(name).copy(qa).invert().multiply(world);
    qa.copy(world);
  });
}

/** The cow's pose at `now` seconds into the current dance, or null if none is on. */
export function sampleDance(rest: Record<PartName, Rest>): CowTarget | null {
  const d = current;
  if (!d) return null;
  const t = Math.max(0, clock() - startedAt);
  play(d, t);
  for (const k of Object.keys(JOINTS) as Joint[]) d.joints[k].getWorldPosition(P[k]);
  const s = scaleOf(d);

  // --- the body: hips-to-neck is the cow's spine -----------------------------
  up.subVectors(P.neck, P.hips).normalize();
  lat.subVectors(P.lThigh, P.rThigh).add(v1.subVectors(P.lArm, P.rArm)).normalize();
  fwd.crossVectors(lat, up).normalize();
  lat.crossVectors(up, fwd);
  basis.makeBasis(lat, up, fwd);
  qBody.setFromRotationMatrix(basis).multiply(qTilt);
  slot("body").copy(qBody);

  // The hips stay over the cow's own position, and everywhere the dancer's
  // hips go across the floor is handed back as travel instead — so it is the
  // whole cow that moves, fences and camera included, not just its body
  // wandering off from where the game thinks it is. Thriller crosses two
  // metres of stage; a cow body two metres from its own position walks
  // straight through the fence.
  const loops = Math.floor(t / d.duration);
  v2.set(0, STAND_HIP_Y + (P.hips.y - d.hip0) * s, 0);
  out.bodyPos.set(0, BACK_RIG.hipY, BACK_RIG.hipZ).applyQuaternion(qBody).negate().add(v2);
  out.travel.subVectors(P.hips, d.start).addScaledVector(d.drift, loops).multiplyScalar(s);
  out.travel.y = 0;

  // --- the head ------------------------------------------------------------
  d.joints.head.getWorldQuaternion(qHead).multiply(qa.copy(d.headBind).invert());
  slot("head").copy(qBody).invert().multiply(qHead);

  // --- arms: the cow's +x side is the dancer's left ------------------------
  const dir = (a: Joint, b: Joint) => new THREE.Vector3().subVectors(P[b], P[a]).normalize();
  aimChain(qBody, ["legFR", "kneeFR", "shinFR"], [dir("lArm", "lFore"), dir("lFore", "lHand"), dir("lHand", "lFinger")], rest);
  aimChain(qBody, ["legFL", "kneeFL", "shinFL"], [dir("rArm", "rFore"), dir("rFore", "rHand"), dir("rHand", "rFinger")], rest);

  // --- legs: thigh, then the shin split into the cow's two lower bones, kinked
  // back at the hock the way a cow's hind leg is ---------------------------
  const shin = (a: Joint, b: Joint, k: number) => dir(a, b).applyAxisAngle(lat, k);
  aimChain(qBody, ["legBR", "kneeBR", "shinBR"], [dir("lThigh", "lKnee"), shin("lKnee", "lFoot", HOCK), shin("lKnee", "lFoot", -HOCK)], rest);
  aimChain(qBody, ["legBL", "kneeBL", "shinBL"], [dir("rThigh", "rKnee"), shin("rKnee", "rFoot", HOCK), shin("rKnee", "rFoot", -HOCK)], rest);

  let low = Infinity;
  for (const j of CONTACTS) low = Math.min(low, P[j].y);
  out.low = Math.max(0, (low - d.low0) * s);
  return out;
}

/** The parts `sampleDance` drives. Everything else (ears, tail, jaw) keeps its own motion. */
export const DANCE_PARTS: PartName[] = [
  "body", "head",
  "legFL", "kneeFL", "shinFL", "legFR", "kneeFR", "shinFR",
  "legBL", "kneeBL", "shinBL", "legBR", "kneeBR", "shinBR",
];

// Dev only: `__dance("moonwalk")` puts a particular dance on, from the start.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __dance?: (name: string) => Promise<boolean> }).__dance = async (name) => {
    const d = await loadDance(name);
    if (!d) return false;
    current = d;
    startedAt = clock();
    return true;
  };
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __danceName?: () => string | null }).__danceName = () => current?.name ?? null;
}
