"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { bladeGeometry, foliageGeometry, loft, lumpGeometry, rng } from "@/lib/geometry";
import {
  barkMap,
  dirtMap,
  fieldMap,
  groundBump,
  stripFadeMap,
  woodMap,
} from "@/lib/textures";
import InstancedGroup, { type Placement } from "./Instanced";
import { applySway, wind } from "@/lib/sway";
import {
  APPLE_TREE,
  BULL_PEN,
  LANE,
  OBSTACLES,
  PIT_RADIUS,
  POND,
  PORTALOO,
  STATION,
  TREES,
  WALL_RADIUS,
} from "@/lib/world";

/** How far out the loose grass goes: up to the foot of the stone wall. */
const FIELD_RADIUS = WALL_RADIUS - 0.5;
/** The ground itself carries on a long way past that, under the barn and out to the hills. */
const GROUND_SIZE = 460;

/** A canvas texture, drawn once. */
function paintTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Advances the one wind clock. Mounted once, by `Environment`. */
function WindClock() {
  useFrame((state) => {
    wind.value = state.clock.elapsedTime;
  });
  return null;
}

// ---------------------------------------------------------------------------
// ground
// ---------------------------------------------------------------------------

function Ground() {
  const mat = useMemo(() => {
    // The same painted field as before, tiled at the same size underfoot —
    // the plane is just much bigger now, so it needs more repeats.
    const tile = (t: THREE.Texture) => {
      const c = t.clone();
      c.repeat.multiplyScalar(GROUND_SIZE / 180);
      c.needsUpdate = true;
      return c;
    };
    return new THREE.MeshStandardMaterial({
      map: tile(fieldMap()),
      bumpMap: tile(groundBump()),
      bumpScale: 0.35,
      roughness: 0.95,
      metalness: 0,
      vertexColors: true,
    });
  }, []);

  // One tiled texture over a whole field reads as a carpet however good the
  // texture is. Broad, slow drifts of colour laid over it by vertex — lusher
  // here, sun-bleached there — are what make it read as land.
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 120, 120);
    const p = g.getAttribute("position");
    const col = new Float32Array(p.count * 3);
    const lush = new THREE.Color(0.9, 1.04, 0.84);
    const dry = new THREE.Color(1.12, 1.07, 0.86);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const n =
        Math.sin(x * 0.07 + 1.3) * Math.cos(y * 0.06 - 0.4) * 0.5 +
        Math.sin(x * 0.19 + y * 0.13) * 0.3 +
        Math.sin(x * 0.031 - y * 0.043 + 2) * 0.4;
      c.copy(lush).lerp(dry, THREE.MathUtils.clamp(0.5 + n * 0.55, 0, 1));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mat} geometry={geo} />;
}

/**
 * The track from the gate to the station. A rectangle of dirt with a hard edge
 * reads as a rug thrown on the grass, so the edges are dissolved by a ragged
 * alpha mask and the grass is left growing through them.
 */
function Road() {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map: dirtMap(),
      alphaMap: stripFadeMap(),
      bumpMap: groundBump(),
      bumpScale: 0.2,
      transparent: true,
      roughness: 1,
      depthWrite: false,
    });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    return m;
  }, []);

  const from = PIT_RADIUS - 0.6;
  const to = STATION.x - 1.6;
  const len = to - from;
  // the pond lane: overlaps the road at the top, runs out into the mud at the bottom
  const laneTop = LANE.z0 + 1.2;
  const laneLen = laneTop - LANE.z1 + 0.6;

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(from + to) / 2, 0.012, 0]}
        material={mat}
        receiveShadow
      >
        <planeGeometry args={[len, 3.4]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        position={[LANE.x, 0.01, laneTop - laneLen / 2]}
        material={mat}
        receiveShadow
      >
        <planeGeometry args={[laneLen, LANE.w + 0.4]} />
      </mesh>
    </>
  );
}

/**
 * Wheel ruts down the middle of the track. Two darker strips are the cheapest
 * possible way to say "things drive down here".
 */
function Ruts() {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#6b5439",
        transparent: true,
        opacity: 0.28,
        alphaMap: stripFadeMap(),
        depthWrite: false,
      }),
    []
  );
  const from = PIT_RADIUS + 0.4;
  const to = STATION.x - 2.2;
  return (
    <>
      {[-0.62, 0.62].map((z) => (
        <mesh
          key={z}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(from + to) / 2, 0.02, z]}
          material={mat}
        >
          <planeGeometry args={[to - from, 0.46]} />
        </mesh>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// loose grass
// ---------------------------------------------------------------------------

/** True where the ground is trodden bare and grass should not grow. */
function isBare(x: number, z: number): boolean {
  if (Math.hypot(x, z) < PIT_RADIUS - 0.35) return true; // the pen floor
  if (Math.abs(z) < 1.6 && x > PIT_RADIUS - 1 && x < STATION.x - 1) return true; // the road
  if (Math.abs(x - LANE.x) < LANE.w / 2 && z < LANE.z0 + 0.5 && z > LANE.z1 - 0.5) return true; // the pond lane
  if (Math.abs(x - STATION.x) < 4 && Math.abs(z) < 4.5) return true; // the station yard
  // the pond, and the trodden mud round the edge of it
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.6) return true;
  // the bull has trodden his paddock flat
  if (Math.hypot(x - BULL_PEN.x, z - BULL_PEN.z) < 2.2) return true;
  if (Math.hypot(x - PORTALOO.x, z - PORTALOO.z) < 0.95) return true;
  if (Math.hypot(x - APPLE_TREE.x, z - APPLE_TREE.z) < 0.5) return true;
  return false;
}

/**
 * The field, one blade at a time. Fifteen thousand of them is a single draw call
 * as an InstancedMesh, and the whole reason the ground stops looking like a
 * painted plane: from the cow's eye height you can see individual blades move.
 */
function GrassField({ count = 34000 }: { count?: number }) {
  // Rooted in the colour of the ground it stands on and lightening to the
  // tip. The roots used to be far darker than the field, so from any distance
  // the meadow read as a lawn with black thorns growing out of it.
  const geo = useMemo(() => bladeGeometry(0.3, 0.075, 0.11, 3, "#4c8a33", "#b4e26c"), []);
  const mat = useMemo(
    () =>
      applySway(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.9,
          side: THREE.DoubleSide,
        }),
        0.34,
        0.055
      ),
    []
  );

  const matrices = useMemo(() => {
    const r = rng(4242);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const out: THREE.Matrix4[] = [];
    let guard = 0;
    // Grass grows in tufts, not in an even scatter: most blades are planted
    // beside the last "seed" rather than somewhere new.
    let sx = 0;
    let sz = 0;
    let tuft = 1;
    while (out.length < count && guard++ < count * 6) {
      let x: number;
      let z: number;
      if (out.length > 0 && r() < 0.72) {
        const a = r() * Math.PI * 2;
        const d = r() * 0.3;
        x = sx + Math.cos(a) * d;
        z = sz + Math.sin(a) * d;
      } else {
        const a = r() * Math.PI * 2;
        const d = Math.pow(r(), 0.56) * FIELD_RADIUS;
        x = sx = Math.cos(a) * d;
        z = sz = Math.sin(a) * d;
        tuft = 0.55 + r() * 0.75;
      }
      if (isBare(x, z) || Math.hypot(x, z) > FIELD_RADIUS) continue;
      const h = tuft * (0.6 + r() * 0.6);
      pos.set(x, -0.01, z);
      e.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5);
      q.setFromEuler(e);
      scale.set(0.8 + r() * 0.7, h, 1);
      out.push(m.clone().compose(pos, q, scale));
    }
    return out;
  }, [count]);

  return (
    <instancedMesh
      // Instances live in the matrix buffer, so they have to be uploaded once the
      // mesh exists. The bounding sphere only covers a single blade, so culling
      // has to be off or the whole field vanishes when you look away from origin.
      ref={(mesh) => {
        if (!mesh) return;
        matrices.forEach((mat4, i) => mesh.setMatrixAt(i, mat4));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
      }}
      args={[geo, mat, matrices.length]}
    />
  );
}

/** Buttercups and daisies, scattered where the grass is thickest. */
function Flowers() {
  const geo = useMemo(() => new THREE.SphereGeometry(0.048, 6, 5), []);
  const white = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f6f2e2", roughness: 0.8 }),
    []
  );
  const yellow = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e8c33f", roughness: 0.8 }),
    []
  );

  const [warmSpots, coolSpots] = useMemo(() => {
    const r = rng(77);
    const warm: Placement[] = [];
    const cool: Placement[] = [];
    let guard = 0;
    while (warm.length + cool.length < 420 && guard++ < 5000) {
      const a = r() * Math.PI * 2;
      const d = 3 + Math.pow(r(), 0.7) * (FIELD_RADIUS - 4);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (isBare(x, z)) continue;
      const item: Placement = {
        pos: [x, 0.14 + r() * 0.12, z],
        rot: [0, r() * Math.PI, 0],
        scale: [1, 0.55, 1],
      };
      (r() > 0.45 ? warm : cool).push(item);
    }
    return [warm, cool];
  }, []);

  return (
    <group>
      <InstancedGroup geometry={geo} material={yellow} items={warmSpots} />
      <InstancedGroup geometry={geo} material={white} items={coolSpots} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// trees
// ---------------------------------------------------------------------------

interface TreeParts {
  trunk: THREE.BufferGeometry;
  branches: { geo: THREE.BufferGeometry; pos: [number, number, number]; rot: [number, number, number] }[];
  canopy: { geo: THREE.BufferGeometry; pos: [number, number, number]; scale: number; dark: boolean }[];
}

/**
 * A tree grown from numbers: a trunk that flares into roots and tapers to a
 * crown, a handful of branches leaning out of it, and overlapping blobs of
 * foliage. Four variants are built and then reused at different scales — the
 * silhouette is what makes them read as different trees, not the leaf count.
 */
export function buildTree(seed: number): TreeParts {
  const r = rng(seed);
  // Shorter and thicker than the first pass: a tall bare pole with a ball on top
  // is a lollipop, not a tree. The crown has to start low enough that the trunk
  // disappears into it.
  const height = 2.5 + r() * 1.1;
  const thick = 0.2 + r() * 0.08;

  const trunk = loft(
    [
      { z: 0, x: 0, rx: thick * 1.9, ry: thick * 1.9 },
      { z: 0.22, x: 0, rx: thick * 1.25, ry: thick * 1.25 },
      { z: height * 0.35, x: (r() - 0.5) * 0.18, rx: thick, ry: thick },
      { z: height * 0.7, x: (r() - 0.5) * 0.3, rx: thick * 0.72, ry: thick * 0.72 },
      { z: height, x: (r() - 0.5) * 0.4, rx: thick * 0.4, ry: thick * 0.4 },
    ],
    { radial: 12, segments: 22 }
  );

  // Boughs leave the trunk steeply and end inside the crown, so they read as
  // structure glimpsed through leaves rather than spikes stuck on the outside.
  const branches: TreeParts["branches"] = [];
  const count = 4 + Math.floor(r() * 3);
  for (let i = 0; i < count; i++) {
    const len = 0.7 + r() * 0.55;
    branches.push({
      geo: loft(
        [
          { z: 0, rx: thick * 0.5, ry: thick * 0.5 },
          { z: len * 0.6, rx: thick * 0.26, ry: thick * 0.26 },
          { z: len, rx: thick * 0.08, ry: thick * 0.08 },
        ],
        { radial: 8, segments: 10 }
      ),
      pos: [0, height * (0.62 + r() * 0.28), 0],
      rot: [-0.95 - r() * 0.45, (i / count) * Math.PI * 2 + r() * 0.6, 0],
    });
  }

  // Two shells of foliage: a wide, dark inner mass and lighter clumps hung
  // around its edge, which is what gives a canopy depth instead of a silhouette.
  const canopy: TreeParts["canopy"] = [];
  const crown = height * 0.92;
  canopy.push({ geo: foliageGeometry(seed * 97, 1.05), pos: [0, crown + 0.25, 0], scale: 1, dark: true });
  canopy.push({ geo: foliageGeometry(seed * 89, 0.9), pos: [0, crown + 0.75, 0], scale: 0.95, dark: true });
  const blobs = 8 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + r() * 0.5;
    const spread = 0.55 + r() * 0.55;
    const rise = crown + 0.1 + r() * 0.95;
    canopy.push({
      geo: foliageGeometry(seed * 31 + i, 0.5 + r() * 0.26),
      pos: [Math.cos(a) * spread, rise, Math.sin(a) * spread],
      scale: 0.9 + r() * 0.35,
      dark: i % 3 === 0,
    });
  }

  return { trunk, branches, canopy };
}

function Trees() {
  const kinds = useMemo(() => [11, 29, 53, 71].map(buildTree), []);
  const mats = useMemo(() => {
    const bark = new THREE.MeshStandardMaterial({ map: barkMap(), roughness: 0.95 });
    return {
      bark,
      // Smooth-shaded: `foliageGeometry` welds its seams so the normals blend,
      // and a faceted crown reads as crumpled paper rather than leaves.
      leafDark: applySway(
        new THREE.MeshStandardMaterial({ color: "#33682c", roughness: 0.95 }),
        3,
        0.045
      ),
      leafLit: applySway(
        new THREE.MeshStandardMaterial({ color: "#55913c", roughness: 0.95 }),
        3,
        0.045
      ),
    };
  }, []);

  // The placement list lives in lib/world.ts, because the collision reads it
  // too: a tree the cow can walk through is worse than no tree.
  return (
    <group>
      {TREES.map((s, i) => {
        const t = kinds[s.kind];
        return (
          <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.spin, 0]} scale={s.scale}>
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <mesh geometry={t.trunk} material={mats.bark} castShadow receiveShadow />
            </group>
            {t.branches.map((b, j) => (
              <group key={j} position={b.pos} rotation={[b.rot[0] + Math.PI / 2, 0, 0]}>
                <group rotation={[0, 0, b.rot[1]]}>
                  <mesh geometry={b.geo} material={mats.bark} castShadow />
                </group>
              </group>
            ))}
            {t.canopy.map((c, j) => (
              <mesh
                key={j}
                geometry={c.geo}
                material={c.dark ? mats.leafDark : mats.leafLit}
                position={c.pos}
                scale={c.scale}
                castShadow
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------

/** Rocks, mostly to break up the far ground and catch the sun. */
function Rocks() {
  const geos = useMemo(() => [1, 2, 3, 4].map((i) => lumpGeometry(500 + i, 0.3, 0.38, 1)), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#8d8b83", roughness: 0.95, flatShading: true }),
    []
  );
  const buckets = useMemo(() => {
    const r = rng(31337);
    const out: Placement[][] = [[], [], [], []];
    let guard = 0;
    let placed = 0;
    while (placed < 26 && guard++ < 400) {
      const a = r() * Math.PI * 2;
      const d = 9 + r() * (FIELD_RADIUS - 10);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (isBare(x, z)) continue;
      const scale = 0.4 + r() * 1.1;
      out[Math.floor(r() * 4)].push({
        pos: [x, scale * 0.1, z],
        rot: [0, r() * 6.28, 0],
        scale,
      });
      placed++;
    }
    return out;
  }, []);

  return (
    <group>
      {geos.map((g, i) => (
        <InstancedGroup key={i} geometry={g} material={mat} items={buckets[i]} castShadow receiveShadow />
      ))}
    </group>
  );
}

/** A galvanised water trough in the pen. Cows need somewhere to drink. */
function Trough({ position }: { position: [number, number, number] }) {
  const mats = useMemo(
    () => ({
      metal: new THREE.MeshStandardMaterial({ color: "#8a9099", roughness: 0.45, metalness: 0.5 }),
      water: new THREE.MeshStandardMaterial({
        color: "#3f6d78",
        roughness: 0.08,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
      }),
      wood: new THREE.MeshStandardMaterial({ map: woodMap(), roughness: 0.9 }),
    }),
    []
  );
  const shell = useMemo(
    () =>
      loft(
        [
          { z: 0, rx: 0.34, ry: 0.24 },
          { z: 0.3, rx: 0.36, ry: 0.26 },
          { z: 0.9, rx: 0.36, ry: 0.26 },
          { z: 1.2, rx: 0.34, ry: 0.24 },
        ],
        { radial: 18, segments: 18, square: 0.75 }
      ),
    []
  );
  const water = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // barely moving, but not dead still
    if (water.current) {
      water.current.position.y = 0.42 + Math.sin(state.clock.elapsedTime * 0.9) * 0.004;
    }
  });

  return (
    <group position={position}>
      <group position={[0, 0.27, -0.6]}>
        <mesh geometry={shell} material={mats.metal} castShadow receiveShadow />
      </group>
      <mesh ref={water} position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.water}>
        <planeGeometry args={[0.6, 1.1]} />
      </mesh>
      {[-0.45, 0.45].map((z) => (
        <mesh key={z} position={[0, 0.04, z]} material={mats.wood} castShadow>
          <boxGeometry args={[0.78, 0.08, 0.12]} />
        </mesh>
      ))}
    </group>
  );
}

/** Straw laid round the bale, and the spiral it was rolled up in. */
let baleMaps: { side: THREE.Texture; end: THREE.Texture } | null = null;
function hayMaps() {
  if (baleMaps) return baleMaps;
  const r = rng(808);
  const straw = (g: CanvasRenderingContext2D, n: number, draw: (i: number) => void) => {
    for (let i = 0; i < n; i++) {
      const light = r() > 0.45;
      g.strokeStyle = light
        ? `rgba(${236 + r() * 19}, ${214 + r() * 26}, ${140 + r() * 40}, ${0.25 + r() * 0.4})`
        : `rgba(${120 + r() * 30}, ${92 + r() * 24}, ${40 + r() * 20}, ${0.2 + r() * 0.35})`;
      g.lineWidth = 0.8 + r() * 1.6;
      g.beginPath();
      draw(i);
      g.stroke();
    }
  };
  const side = paintTexture(512, 256, (g, W, H) => {
    g.fillStyle = "#cfae5e";
    g.fillRect(0, 0, W, H);
    // wrapped round the cylinder: u runs round it, so the straws run along u
    straw(g, 900, () => {
      const y = r() * H;
      const x = r() * W;
      const len = 30 + r() * 90;
      g.moveTo(x, y);
      g.lineTo(x + len, y + (r() - 0.5) * 7);
    });
  });
  side.wrapS = THREE.RepeatWrapping;
  side.repeat.set(3, 1);
  const end = paintTexture(256, 256, (g, W) => {
    g.fillStyle = "#c6a253";
    g.fillRect(0, 0, W, W);
    const c = W / 2;
    straw(g, 520, () => {
      const rad = 6 + Math.pow(r(), 0.7) * (c - 8);
      const a = r() * Math.PI * 2;
      g.arc(c, c, rad, a, a + 0.25 + r() * 0.8);
    });
    const shade = g.createRadialGradient(c, c, 4, c, c, c);
    shade.addColorStop(0, "rgba(70,45,10,0.45)");
    shade.addColorStop(0.25, "rgba(70,45,10,0.05)");
    shade.addColorStop(1, "rgba(70,45,10,0.22)");
    g.fillStyle = shade;
    g.fillRect(0, 0, W, W);
  });
  baleMaps = { side, end };
  return baleMaps;
}

/** A round bale, wrapped in string. */
function HayBale({ position, spin = 0 }: { position: [number, number, number]; spin?: number }) {
  const mats = useMemo(() => {
    const maps = hayMaps();
    return {
      hay: new THREE.MeshStandardMaterial({ map: maps.side, roughness: 1 }),
      end: new THREE.MeshStandardMaterial({ map: maps.end, roughness: 1 }),
      string: new THREE.MeshStandardMaterial({ color: "#3c6fb0", roughness: 0.7 }),
    };
  }, []);
  // Straw sticking out all over it, so the silhouette is not a machined cylinder.
  const wisps = useMemo(() => {
    const r = rng(Math.round(position[0] * 100 + position[2] * 7));
    return Array.from({ length: 46 }, () => {
      const a = r() * Math.PI * 2;
      const y = (r() - 0.5) * 0.9;
      return {
        pos: [Math.cos(a) * 0.615, y, Math.sin(a) * 0.615] as [number, number, number],
        rot: [(r() - 0.5) * 1.2, -a, Math.PI / 2 + (r() - 0.5) * 1.1] as [number, number, number],
        len: 0.1 + r() * 0.16,
      };
    });
  }, [position]);
  const wispGeo = useMemo(() => new THREE.CylinderGeometry(0.004, 0.006, 1, 4).translate(0, 0.5, 0), []);
  const wispMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e2c878", roughness: 1 }), []);
  return (
    <group position={position} rotation={[0, spin, Math.PI / 2]}>
      <mesh castShadow receiveShadow material={mats.hay}>
        <cylinderGeometry args={[0.62, 0.62, 0.95, 28, 1, true]} />
      </mesh>
      {[-0.475, 0.475].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]} material={mats.end} castShadow>
          <circleGeometry args={[0.62, 28]} />
        </mesh>
      ))}
      {[-0.26, 0.26].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.string}>
          <torusGeometry args={[0.624, 0.01, 6, 28]} />
        </mesh>
      ))}
      {wisps.map((w, i) => (
        <mesh key={i} geometry={wispGeo} material={wispMat} position={w.pos} rotation={w.rot} scale={[1, w.len, 1]} />
      ))}
    </group>
  );
}

/**
 * The country beyond the wall, in three depths: rolling pasture close in,
 * dotted with trees and hedges; darker wooded hills behind it; and a blue
 * ridge on the horizon. Depth in a landscape is mostly things getting bluer
 * and plainer with distance, and one ring of identical green lumps had none.
 *
 * Everything here starts well outside the stone wall. The old hills were up to
 * fifty metres across and only seventy out, so their skirts came up through
 * the field inside the fence as dark wedges of nothing.
 */
function Hills() {
  // `smooth` welds the icosahedron before displacing it, so a hill is a rolling
  // shape and not a heap of triangles.
  const geos = useMemo(() => [1, 2, 3].map((i) => lumpGeometry(880 + i, 1, 0.22, 3, true)), []);
  const mats = useMemo(
    () => ({
      near: ["#7fb04f", "#8fb955", "#6fa64a"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 })),
      mid: ["#5b9050", "#4f8650"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 })),
      far: new THREE.MeshBasicMaterial({ color: "#8fb4d4" }),
      wood: new THREE.MeshStandardMaterial({ color: "#3f7438", roughness: 1 }),
    }),
    []
  );
  const { near, mid, far, copses } = useMemo(() => {
    const r = rng(9);
    const ring = (n: number, d0: number, d1: number, w0: number, w1: number, h0: number, h1: number) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + r() * 0.25;
        const d = d0 + r() * (d1 - d0);
        return { x: Math.cos(a) * d, z: Math.sin(a) * d, w: w0 + r() * (w1 - w0), h: h0 + r() * (h1 - h0), k: i % 3 };
      });
    const near = ring(16, 88, 112, 24, 38, 7, 13);
    const mid = ring(14, 135, 165, 34, 56, 16, 30);
    const far = ring(12, 215, 250, 50, 90, 38, 70);
    // Trees on the near hills, as dark blobs sat on the slope: at this range a
    // wood is a texture, and it is what gives the hills a sense of size.
    const copses: Placement[] = [];
    for (const hill of near) {
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2;
        const u = Math.sqrt(r()) * 0.78;
        const dx = Math.cos(a) * u;
        const dz = Math.sin(a) * u;
        const y = hill.h * (Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz)) * 0.87 - 0.25);
        if (y < 0.5) continue;
        const s = 1.6 + r() * 2.2;
        copses.push({ pos: [hill.x + dx * hill.w, y + s * 0.3, hill.z + dz * hill.w * 0.8], rot: [0, r() * 6.3, 0], scale: [s * 1.2, s, s * 1.2] });
      }
    }
    return { near, mid, far, copses };
  }, []);
  const copseGeo = useMemo(() => foliageGeometry(4321, 1), []);

  return (
    <group>
      {near.map((s, i) => (
        <mesh key={`n${i}`} geometry={geos[s.k]} material={mats.near[i % 3]} position={[s.x, -s.h * 0.25, s.z]} scale={[s.w, s.h, s.w * 0.8]} />
      ))}
      {mid.map((s, i) => (
        <mesh key={`m${i}`} geometry={geos[s.k]} material={mats.mid[i % 2]} position={[s.x, -s.h * 0.25, s.z]} scale={[s.w, s.h, s.w * 0.8]} />
      ))}
      {far.map((s, i) => (
        <mesh key={`f${i}`} geometry={geos[s.k]} material={mats.far} position={[s.x, -s.h * 0.3, s.z]} scale={[s.w, s.h, s.w * 0.8]} />
      ))}
      <InstancedGroup geometry={copseGeo} material={mats.wood} items={copses} />
    </group>
  );
}

// ---------------------------------------------------------------------------

export default function Environment() {
  return (
    <group>
      <WindClock />
      <Ground />
      <Hills />
      <Road />
      <Ruts />
      <GrassField />
      <Flowers />
      <Rocks />
      <Trees />
      {/* Positions come from OBSTACLES so the models and the collision agree. */}
      <Trough position={[OBSTACLES[0].x, 0, OBSTACLES[0].z]} />
      {OBSTACLES.slice(1).map((ob, i) => (
        <HayBale key={i} position={[ob.x, 0.62, ob.z]} spin={ob.spin ?? 0} />
      ))}
    </group>
  );
}
