// Static layout of the world. Everything that other modules need to agree on
// (where the fence is, where the gate is, where the grass grows) lives here so
// the pen can be extended later without hunting through components.

import { rng } from "./rand";

export const PIT_RADIUS = 7;
/**
 * How close the cow's centre can get to the fence before it's stopped. The cow
 * is about 2 units nose to tail, so this keeps the barrel off the rails — the
 * head still leans over them, which is exactly what cows do to fences.
 */
export const PIT_INNER = PIT_RADIUS - 1.15;

/** The gate sits on the +X side of the ring. */
export const GATE_WIDTH = 2.8;

/** How tall the fence posts stand. The rails are hung off this. */
export const FENCE_HEIGHT = 1.32;

export const WAYPOINTS = {
  gateInside: { x: PIT_RADIUS - 1.5, z: 0 },
  gateOutside: { x: PIT_RADIUS + 1.6, z: 0 },
  // Far enough back that the cow does not stand *inside* the officer once it
  // rears up: the rear-up shifts the whole body forward by STAND_SHIFT.
  stationFront: { x: 14.2, z: 0 },
  penCentre: { x: 1.8, z: 0.8 },
};

export const STATION = { x: 19, z: 0 };
// Out on the step, not standing in his own doorway (the front wall is at
// STATION.x - 2.7), and far enough from `stationFront` that a reared-up cow
// still has room to wave its hooves about.
export const OFFICER = { x: 15.9, z: 0.85 };

export interface GrassSpot {
  id: number;
  x: number;
  z: number;
}

export const GRASS: GrassSpot[] = [
  { id: 0, x: -3.1, z: 2.4 },
  { id: 1, x: 1.9, z: 4 },
  { id: 2, x: 4.1, z: -2.8 },
  { id: 3, x: -4.3, z: -2.1 },
  { id: 4, x: -0.8, z: -4.3 },
];

/**
 * Things in the pen the cow cannot walk through, as circles on the ground. Both
 * the models and the collision read this list, so a trough can never be moved in
 * one place and left behind in the other.
 */
export interface Obstacle {
  x: number;
  z: number;
  /** Includes the cow's own girth, so this is the distance its centre is held off. */
  r: number;
  spin?: number;
}

export const OBSTACLES: Obstacle[] = [
  { x: -3.4, z: 3.6, r: 0.95 }, // water trough
  { x: -5.4, z: -3, r: 0.95, spin: 0.4 }, // hay bales
  { x: 9.2, z: -5.6, r: 0.95, spin: 1.9 },
  { x: 10.1, z: -4.4, r: 0.95, spin: 0.2 },
];

/** Cow must be this close to a grass tuft for the eat prompt to appear. */
export const INTERACT_RANGE = 1.5;
/** How long a nibbled tuft takes to grow back, in ms. */
export const REGROW_MS = 14000;

/** Slaps needed before the cow gives up and files a police report. */
export const SLAPS_BEFORE_POLICE = 3;

export const WALK_SPEED = 2.3;
/**
 * Flat out, with Shift held or the stick shoved to its rim. Twice walking pace,
 * on the same legs — the stride rate doubles rather than the stride, so it reads
 * as half a tonne of animal scrabbling as fast as it can, which is the joke.
 */
export const GALLOP_SPEED = 4.6;
/** Hit something solid faster than this and the cow sees stars. */
export const BONK_SPEED = 3.3;
export const TURN_SPEED = 7;
/** Metres a second to miles an hour, for anything shown to the player. */
export const MPH = 2.237;

/**
 * How fast the stride clock runs, per unit of walking speed. This is NOT a taste
 * setting: it is solved from the leg geometry in lib/locomotion.ts as
 * `PI / (2 * hipY * SWING)`, which is the rate at which a hoof planted on the
 * ground travels backwards at exactly the speed the cow travels forwards. Change
 * the leg length or the swing angle and this has to be re-derived, or the cow
 * will start to skate.
 */
export const STRIDE_RATE = 4.14;

// ---------------------------------------------------------------------------
// outside the pen
//
// The pen used to be the whole game, so "you can't leave" was one line of
// arithmetic: clamp the cow's distance from the origin. Now the gate opens, so
// the fence has to be a ring **with a hole in it**, and everything out in the
// field has to be solid — otherwise the moment the cow gets out it walks
// through the trees, through the pond and straight through the police station.
// ---------------------------------------------------------------------------

/** How far the cow may wander from the middle of the world. */
export const WORLD_RADIUS = 30;

/** Roughly the cow's own girth. Every clearance below is measured off it. */
export const COW_GIRTH = 0.5;

/**
 * How wide the doorway is *for the cow's centre*, as a half-angle around the
 * ring. Narrower than the gate itself by the cow's girth, so it can't clip a
 * gate post on the way through.
 */
export const GATE_HALF_ANGLE = (GATE_WIDTH / 2 - COW_GIRTH - 0.05) / PIT_RADIUS;

/** How close the cow's centre can get to the fence from OUTSIDE the ring. */
export const PIT_OUTER = PIT_RADIUS + COW_GIRTH + 0.35;

/** Where the gate is, in the world. Used for the prompt and the cutscene. */
export const GATE_POINT = { x: PIT_RADIUS, z: 0 };

// --- things out in the field ----------------------------------------------

/** A circle on the ground that something is held out of. */
export interface Solid {
  x: number;
  z: number;
  /** Includes the cow's girth: this is how far its centre is held off. */
  r: number;
  /**
   * Low enough for the cow to hang its head over: the pond, the trough. The
   * body is still held off it, but the nose is not (see `resolveNose`).
   */
  low?: boolean;
}

export const SCARECROW = { x: -4.6, z: 13.8 };
export const POND = { x: 14.5, z: -12.2, r: 3.3 };
/**
 * A dirt lane off the road, down to the pond. It runs north-south (along z),
 * from the road's edge to the trodden mud at the water.
 */
export const LANE = { x: 13.2, z0: -1.4, z1: -8.3, w: 2.8 };

/**
 * The speed camera, on the verge of the pond lane.
 *
 * It used to stand on the road itself, between the pen and the station, so
 * every trip to the officer ran straight through it and it went off as part of
 * leaving the pen rather than as its own thing. Down the pond lane it is
 * somewhere you choose to go, on the way to something you want (a drink).
 */
export const SPEED_TRAP = { x: LANE.x + LANE.w / 2 + 0.45, z: -5.2 };
/** Which way the box points: back up the lane, at a cow coming down from the road. */
export const SPEED_TRAP_FACE = Math.atan2(LANE.x - SPEED_TRAP.x, LANE.z0 - SPEED_TRAP.z);
/**
 * How fast the cow has to be going past it to set it off: between a walk and a
 * gallop, so it is the player's choice. It used to be 1.9 — slower than the
 * cow's ordinary walking pace — which meant the camera fired at anyone who
 * simply held W, and there was nothing to understand and nothing to avoid.
 *
 * The posted limit on the sign is this in mph, rounded down: 7.
 */
export const SPEED_LIMIT = 3.2;
/**
 * Where the camera actually measures: the strip of lane under the painted
 * lines, verge to verge. A circle round the post (which is what this used to
 * be) fired the moment a cow strayed near the pole at any angle, often while
 * it was still getting up to speed; a measured strip across the lane fires
 * where the lines say it will, at whatever the cow is actually doing there.
 */
export const SPEED_ZONE = {
  x0: LANE.x - LANE.w / 2 - 0.4,
  x1: SPEED_TRAP.x + 0.5,
  z0: SPEED_TRAP.z - 1.4,
  z1: SPEED_TRAP.z + 1.4,
};

/** Seconds the camera needs to recharge between photos. */
export const SPEED_TRAP_COOLDOWN = 6;

/**
 * The posted limit and the camera warning, at the top of the lane, facing the
 * road — so the rule is there to be read before the cow turns down it.
 */
export const SPEED_SIGN = { x: LANE.x - LANE.w / 2 - 0.35, z: -2.3 };

/**
 * The portaloo, round the side of the station. Somebody is always in it.
 * `face` is the way the door looks: back towards the road.
 */
export const PORTALOO = { x: 23.4, z: 6.4, face: -Math.PI / 2 - 0.5 };
/** The apple tree. Shake it and find out. */
export const APPLE_TREE = { x: -2.5, z: -13.5 };
/** The fingerpost where the pond lane leaves the road. */
export const SIGNPOST = { x: 10.6, z: 2.5 };
/**
 * The bull's paddock: a rail fence round one very large animal who has no
 * interest in anything. A box, like the station, because it is one.
 */
export const BULL_PEN = { x: -17.5, z: 16.2, hw: 3.6, hd: 2.8 };
/** The dry-stone wall round the whole field. The cow's centre stops at WORLD_RADIUS. */
export const WALL_RADIUS = 31.4;

/** Where the flock starts. They wander from here and run from the cow. */
export const SHEEP_HOME = { x: -15, z: -9 };

/**
 * The trees, as a fixed list rather than a random scatter. It lives here rather
 * than in `Environment.tsx` for the same reason `OBSTACLES` does: the model and
 * the collision have to read the same numbers or the cow walks through a trunk.
 */
export interface TreeSpot {
  x: number;
  z: number;
  kind: number;
  scale: number;
  spin: number;
}

/**
 * Places nothing else is allowed to be planted, and how much room each needs.
 * A tree in the middle of the pond is the sort of thing a hand-placed list gets
 * wrong once and then keeps getting wrong, so the list filters itself.
 */
const CLEARINGS: Solid[] = [
  { x: POND.x, z: POND.z, r: POND.r + 1.2 },
  { x: SCARECROW.x, z: SCARECROW.z, r: 2.6 },
  { x: SPEED_TRAP.x, z: SPEED_TRAP.z, r: 2.4 },
  { x: BULL_PEN.x, z: BULL_PEN.z, r: 6.2 },
  { x: PORTALOO.x, z: PORTALOO.z, r: 5 },
  { x: APPLE_TREE.x, z: APPLE_TREE.z, r: 4 },
];

export const TREES: TreeSpot[] = (() => {
  const r = rng(1234);
  const ring: [number, number][] = [
    [-13, -7], [-16, 5], [-9, 14], [5, -15], [14, -12],
    [11, 13], [21, 10], [25, -9], [-3, 18], [28, 4],
    [-21, -14], [18, 18], [-24, 8], [7, 22], [-14, -19],
    [30, -16], [24, 20], [-29, -3],
  ];
  return ring
    .map(([x, z]) => ({
      x: x + (r() - 0.5) * 2,
      z: z + (r() - 0.5) * 2,
      kind: Math.floor(r() * 4),
      scale: 0.85 + r() * 0.7,
      spin: r() * Math.PI * 2,
    }))
    .filter((t) => !CLEARINGS.some((c) => Math.hypot(t.x - c.x, t.z - c.z) < c.r));
})();

/**
 * Everything solid in the world, as circles. Built once from the same tables
 * the models are built from.
 */
export const SOLIDS: Solid[] = [
  // the trough is low; the bales are not
  ...OBSTACLES.map((o, i) => ({ x: o.x, z: o.z, r: o.r, low: i === 0 })),
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.42 * t.scale + COW_GIRTH })),
  { x: SCARECROW.x, z: SCARECROW.z, r: 0.55 },
  { x: SPEED_TRAP.x, z: SPEED_TRAP.z, r: 0.5 },
  { x: SPEED_SIGN.x, z: SPEED_SIGN.z, r: 0.45 },
  // The pond. It used to be walkable — a cow strolling across the top of the
  // water — and the lane now points straight at it. Held off at the bank, the
  // head still reaches over the water to drink (the prompt reaches further).
  { x: POND.x, z: POND.z, r: POND.r + 0.15, low: true },
  { x: PORTALOO.x, z: PORTALOO.z, r: 0.75 + COW_GIRTH },
  { x: APPLE_TREE.x, z: APPLE_TREE.z, r: 0.38 + COW_GIRTH },
  { x: SIGNPOST.x, z: SIGNPOST.z, r: 0.5 },
  // The officer. He is not going to move out of the way.
  { x: OFFICER.x, z: OFFICER.z, r: 0.85 },
];

/**
 * The police station, as a box. A building is the one thing in the world that a
 * circle is a bad fit for: the smallest circle round it either lets the cow
 * into a corner or holds it off the wall by two metres.
 */
export const STATION_BOX = {
  x: STATION.x,
  z: STATION.z,
  hw: 5.4 / 2 + 0.15 + COW_GIRTH,
  hd: 6.4 / 2 + 0.15 + COW_GIRTH,
};

/** A rectangle on the ground that things are held out of. Half-sizes include the cow's girth. */
export interface Box {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

/** The bull's paddock, as the cow's centre sees it. */
export const BULL_BOX: Box = {
  x: BULL_PEN.x,
  z: BULL_PEN.z,
  hw: BULL_PEN.hw + 0.1 + COW_GIRTH,
  hd: BULL_PEN.hd + 0.1 + COW_GIRTH,
};

const BOXES: Box[] = [STATION_BOX, BULL_BOX];

/** Push a point out of a box, along whichever face is nearest. `shrink` pulls the faces in. */
function pushOutOfBox(b: Box, x: number, z: number, shrink = 0): { x: number; z: number; hit: boolean } {
  const dx = x - b.x;
  const dz = z - b.z;
  const hw = b.hw - shrink;
  const hd = b.hd - shrink;
  const ox = hw - Math.abs(dx);
  const oz = hd - Math.abs(dz);
  if (ox <= 0 || oz <= 0) return { x, z, hit: false };
  if (ox < oz) return { x: b.x + Math.sign(dx || 1) * hw, z, hit: true };
  return { x, z: b.z + Math.sign(dz || 1) * hd, hit: true };
}

/**
 * Slide a point out of everything solid in the world. Returns the corrected
 * position and whether anything was actually hit, so the caller can thump the
 * springs once per contact rather than every frame.
 */
export function resolveSolids(x: number, z: number): { x: number; z: number; hit: boolean } {
  let hit = false;
  for (const s of SOLIDS) {
    const dx = x - s.x;
    const dz = z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < s.r) {
      // dead centre: shove it out along +x rather than dividing by zero
      const nx = d > 1e-4 ? dx / d : 1;
      const nz = d > 1e-4 ? dz / d : 0;
      x = s.x + nx * s.r;
      z = s.z + nz * s.r;
      hit = true;
    }
  }
  for (const b of BOXES) {
    const out = pushOutOfBox(b, x, z);
    x = out.x;
    z = out.z;
    hit = hit || out.hit;
  }
  return { x, z, hit };
}

/** How far ahead of its own centre the cow's head is. */
export const NOSE_REACH = 0.95;
/** How much room the head itself takes up. */
const NOSE_GIRTH = 0.2;

/**
 * Keep the cow's HEAD out of things, not just its middle.
 *
 * The body is one circle about the cow's centre, which is a metre behind its
 * nose — so a cow walking up to a tree, a wall or a policeman used to stop
 * with its whole head buried in them. This tests a second, smaller circle at
 * the nose and moves the cow back by however far that one is inside something.
 * Low things (the pond, the trough) are skipped: the head is meant to go over
 * those. Returns the cow's corrected centre.
 */
export function resolveNose(x: number, z: number, facing: number): { x: number; z: number; hit: boolean } {
  let nx = x + Math.sin(facing) * NOSE_REACH;
  let nz = z + Math.cos(facing) * NOSE_REACH;
  const sx = nx;
  const sz = nz;
  let hit = false;
  for (const s of SOLIDS) {
    if (s.low) continue;
    const r = Math.max(0.15, s.r - COW_GIRTH) + NOSE_GIRTH;
    const dx = nx - s.x;
    const dz = nz - s.z;
    const d = Math.hypot(dx, dz);
    if (d < r && d > 1e-4) {
      nx = s.x + (dx / d) * r;
      nz = s.z + (dz / d) * r;
      hit = true;
    }
  }
  for (const b of BOXES) {
    const out = pushOutOfBox(b, nx, nz, COW_GIRTH - NOSE_GIRTH);
    nx = out.x;
    nz = out.z;
    hit = hit || out.hit;
  }
  // the stone wall round the field
  const nr = Math.hypot(nx, nz);
  if (nr > WALL_RADIUS - 0.45) {
    const k = (WALL_RADIUS - 0.45) / nr;
    nx *= k;
    nz *= k;
    hit = true;
  }
  return { x: x + (nx - sx), z: z + (nz - sz), hit };
}

/**
 * Is this point inside something the camera should not be inside? Buildings
 * and tree trunks only — the camera looking over a hay bale is fine, the
 * camera looking at the inside of a wall is not.
 */
export function cameraBlocked(x: number, y: number, z: number): boolean {
  if (y < 4.6 && Math.abs(x - STATION.x) < 5.4 / 2 + 0.45 && Math.abs(z - STATION.z) < 6.4 / 2 + 0.45) return true;
  if (y < 2.9 && Math.hypot(x - PORTALOO.x, z - PORTALOO.z) < 1.05) return true;
  if (y < 3.2) {
    for (const t of TREES) {
      if (Math.hypot(x - t.x, z - t.z) < 0.5 * t.scale) return true;
    }
    if (Math.hypot(x - APPLE_TREE.x, z - APPLE_TREE.z) < 0.55) return true;
  }
  return false;
}

/**
 * Keep the cow on its own side of the fence.
 *
 * `outside` is where it was last frame, and it is the whole trick: a ring with
 * a gap in it cannot be enforced with one clamp, because "too far out" and "too
 * far in" are the same test from opposite sides. Knowing which side the cow
 * started on turns it back into one clamp, and the gateway is simply the arc
 * where neither clamp applies.
 */
export function resolveFence(
  x: number,
  z: number,
  outside: boolean,
  gateOpen: number
): { x: number; z: number; outside: boolean; hit: boolean } {
  const r = Math.hypot(x, z);
  const angle = Math.atan2(z, x); // the gate is at angle 0, on the +X side
  const inDoorway = Math.abs(angle) < GATE_HALF_ANGLE && gateOpen > 0.55;

  if (inDoorway) {
    // free to walk through; note which side it comes out on
    return { x, z, outside: r > PIT_RADIUS, hit: false };
  }

  if (outside) {
    if (r < PIT_OUTER) {
      const k = r > 1e-4 ? PIT_OUTER / r : 1;
      return { x: x * k, z: z * k, outside: true, hit: true };
    }
    if (r > WORLD_RADIUS) {
      const k = WORLD_RADIUS / r;
      return { x: x * k, z: z * k, outside: true, hit: true };
    }
    return { x, z, outside: true, hit: false };
  }

  if (r > PIT_INNER) {
    const k = PIT_INNER / r;
    return { x: x * k, z: z * k, outside: false, hit: true };
  }
  return { x, z, outside: false, hit: false };
}
