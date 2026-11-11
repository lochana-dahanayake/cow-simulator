"use client";

/**
 * The farm: everything that turns "a pen in a green void" into a place.
 *
 * Two kinds of thing live here. Scenery — the dry-stone wall that is the edge
 * of the world, the barn and the windmill beyond it, the bushes, the stones
 * round the pond — exists to be looked at. And three things exist to be
 * bothered: a bull who will not be, a portaloo with somebody in it, and an
 * apple tree with a grudge.
 *
 * The same two rules as `Outside.tsx`: positions come from `lib/world.ts`, so
 * the collision and the models cannot disagree; and nothing here owns game
 * state — each thing reacts to a counter in the store going up.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useCowStore } from "@/lib/store";
import { cowState } from "@/lib/cowState";
import { foliageGeometry, loft, lumpGeometry, rng } from "@/lib/geometry";
import { BULL_NECK } from "@/lib/bullBody";
import { skinGeometry } from "@/lib/skinClient";
import { applySway } from "@/lib/sway";
import { barkMap, roofMap, stuccoMap, woodMap } from "@/lib/textures";
import InstancedGroup, { type Placement } from "./Instanced";
import { buildTree } from "./Environment";
import {
  APPLE_TREE,
  BULL_PEN,
  NOSE_REACH,
  POND,
  PORTALOO,
  SIGNPOST,
  STATION,
  WALL_RADIUS,
} from "@/lib/world";

// ---------------------------------------------------------------------------
// painted surfaces
// ---------------------------------------------------------------------------

/** A canvas texture, drawn once. */
function paintTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat?: [number, number]
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Dry-stone walling: courses of mismatched stones with dark gaps between. */
function stoneMap() {
  return paintTexture(512, 256, (g, W, H) => {
    g.fillStyle = "#4f4a43";
    g.fillRect(0, 0, W, H);
    const r = rng(404);
    const rows = 5;
    const rowH = H / rows;
    for (let row = 0; row < rows; row++) {
      let x = -r() * 60;
      while (x < W) {
        const w = 44 + r() * 70;
        const lift = (r() - 0.5) * 6;
        const tone = 46 + r() * 22;
        const stone = (ox: number) => {
          g.fillStyle = `hsl(${32 + r() * 16}, ${7 + r() * 9}%, ${tone}%)`;
          g.beginPath();
          g.roundRect(ox + 2, row * rowH + 3 + lift, w - 4, rowH - 6, 9);
          g.fill();
          // a lit top edge and a shaded bottom one: cheap, and it reads as depth
          g.fillStyle = "rgba(255,255,255,0.13)";
          g.beginPath();
          g.roundRect(ox + 5, row * rowH + 5 + lift, w - 10, rowH * 0.28, 6);
          g.fill();
          g.fillStyle = "rgba(0,0,0,0.14)";
          g.beginPath();
          g.roundRect(ox + 5, row * rowH + rowH * 0.66 + lift, w - 10, rowH * 0.24, 6);
          g.fill();
        };
        stone(x);
        if (x + w > W) stone(x - W); // wrap, so the wall has no seam
        x += w;
      }
    }
    // lichen
    for (let i = 0; i < 50; i++) {
      g.fillStyle = `rgba(${150 + r() * 40}, ${165 + r() * 30}, ${90 + r() * 30}, ${0.1 + r() * 0.16})`;
      g.beginPath();
      g.arc(r() * W, r() * H, 4 + r() * 12, 0, Math.PI * 2);
      g.fill();
    }
  }, [1, 1]);
}

/** Vertical boards, painted once a long time ago. */
function plankMap(base: string, repeat: [number, number]) {
  return paintTexture(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = base;
      g.fillRect(0, 0, W, H);
      const r = rng(91);
      for (let x = 0; x < W; x += 32) {
        g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"}, ${0.03 + r() * 0.07})`;
        g.fillRect(x, 0, 32, H);
        g.fillStyle = "rgba(0,0,0,0.32)";
        g.fillRect(x, 0, 2, H);
        g.fillStyle = "rgba(255,255,255,0.1)";
        g.fillRect(x + 2, 0, 1.5, H);
      }
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`;
        g.fillRect(r() * W, r() * H, 1 + r() * 2, 10 + r() * 50);
      }
    },
    repeat
  );
}

/** A board with words on it. */
function boardMap(lines: { text: string; size: number; color?: string }[], bg: string, border?: string, w = 512, h = 256) {
  return paintTexture(w, h, (g, W, H) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = 12;
      g.strokeRect(8, 8, W - 16, H - 16);
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    const total = lines.reduce((s, l) => s + l.size * 1.15, 0);
    let y = H / 2 - total / 2;
    for (const l of lines) {
      g.font = `900 ${l.size}px "Arial Black", Arial, Helvetica, sans-serif`;
      g.fillStyle = l.color ?? "#1b1b1b";
      y += (l.size * 1.15) / 2;
      g.fillText(l.text, W / 2, y, W - 44);
      y += (l.size * 1.15) / 2;
    }
  });
}

// ---------------------------------------------------------------------------
// the wall round the field
// ---------------------------------------------------------------------------

/**
 * The edge of the world, as something a farm would actually have: a dry-stone
 * wall. The cow used to walk until it hit nothing at all, thirty metres out,
 * in the middle of an identical field.
 */
function StoneWall() {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stoneMap(), roughness: 1, side: THREE.DoubleSide }),
    []
  );
  const capMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#8f897d", roughness: 1, flatShading: true }),
    []
  );

  const geo = useMemo(() => {
    const N = 220;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      // whole numbers of waves, so the top meets itself where the ring closes
      const h = 0.94 + Math.sin(a * 9) * 0.05 + Math.sin(a * 23 + 1) * 0.035;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ro = WALL_RADIUS + 0.32;
      const ri = WALL_RADIUS - 0.32;
      const u = (i / N) * 84;
      pos.push(c * ro, -0.05, s * ro, c * (ro - 0.07), h, s * (ro - 0.07), c * (ri + 0.07), h, s * (ri + 0.07), c * ri, -0.05, s * ri);
      uv.push(u, 0, u, 0.92, u, 1.16, u, 0.24);
    }
    for (let i = 0; i < N; i++) {
      const b = i * 4;
      const n = b + 4;
      for (const [p, q] of [[0, 1], [1, 2], [2, 3]]) {
        idx.push(b + p, b + q, n + p, b + q, n + q, n + p);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);

  // The coping: a row of stones stood on edge along the top, which is what
  // gives a stone wall its silhouette.
  const capGeo = useMemo(() => lumpGeometry(61, 0.2, 0.3, 0), []);
  const caps = useMemo(() => {
    const r = rng(62);
    const out: Placement[] = [];
    const n = 430;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.004;
      const h = 0.94 + Math.sin(a * 9) * 0.05 + Math.sin(a * 23 + 1) * 0.035;
      out.push({
        pos: [Math.cos(a) * WALL_RADIUS, h + 0.07 + r() * 0.03, Math.sin(a) * WALL_RADIUS],
        rot: [(r() - 0.5) * 0.4, -a + (r() - 0.5) * 0.3, (r() - 0.5) * 0.5],
        scale: [1.25 + r() * 0.4, 0.75 + r() * 0.5, 0.75 + r() * 0.35],
      });
    }
    return out;
  }, []);

  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      <InstancedGroup geometry={capGeo} material={capMat} items={caps} castShadow />
    </group>
  );
}

/** Shrubs growing in the lee of the wall, out of reach of anything that eats. */
function Bushes() {
  const geos = useMemo(() => [foliageGeometry(201, 0.62), foliageGeometry(202, 0.5)], []);
  const mats = useMemo(
    () => [
      applySway(new THREE.MeshStandardMaterial({ color: "#3f7a34", roughness: 1 }), 1.2, 0.03),
      applySway(new THREE.MeshStandardMaterial({ color: "#5b9a3d", roughness: 1 }), 1.2, 0.03),
    ],
    []
  );
  const berryGeo = useMemo(() => new THREE.SphereGeometry(0.045, 6, 5), []);
  const berryMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d9345a", roughness: 0.5 }), []);

  const { a, b, berries } = useMemo(() => {
    const r = rng(203);
    const a: Placement[] = [];
    const b: Placement[] = [];
    const berries: Placement[] = [];
    for (let i = 0; i < 34; i++) {
      const ang = (i / 34) * Math.PI * 2 + r() * 0.12;
      const d = WALL_RADIUS - 0.75 - r() * 0.25;
      const x = Math.cos(ang) * d;
      const z = Math.sin(ang) * d;
      const s = 0.8 + r() * 0.7;
      a.push({ pos: [x, 0.38 * s, z], rot: [0, r() * 6.3, 0], scale: [s, s * 0.8, s] });
      b.push({ pos: [x + (r() - 0.5) * 0.8, 0.5 * s, z + (r() - 0.5) * 0.8], rot: [0, r() * 6.3, 0], scale: s * 0.9 });
      if (i % 3 === 0) {
        for (let k = 0; k < 7; k++) {
          const t = r() * 6.3;
          const up = 0.2 + r() * 0.5;
          berries.push({
            pos: [x + Math.cos(t) * 0.55 * s * Math.cos(up), 0.4 * s + Math.sin(up) * 0.5 * s, z + Math.sin(t) * 0.55 * s * Math.cos(up)],
          });
        }
      }
    }
    return { a, b, berries };
  }, []);

  return (
    <group>
      <InstancedGroup geometry={geos[0]} material={mats[0]} items={a} castShadow />
      <InstancedGroup geometry={geos[1]} material={mats[1]} items={b} castShadow />
      <InstancedGroup geometry={berryGeo} material={berryMat} items={berries} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// beyond the wall
// ---------------------------------------------------------------------------

const BARN = { x: -36, z: -22, w: 9, wall: 4.4, d: 12 };

/** A big red barn with a silo: the one building every drawing of a farm has. */
function Barn() {
  const mats = useMemo(
    () => ({
      red: new THREE.MeshStandardMaterial({ map: plankMap("#a5352b", [0.5, 0.5]), roughness: 0.95 }),
      door: new THREE.MeshStandardMaterial({
        roughness: 0.95,
        map: paintTexture(256, 256, (g, W, H) => {
          g.fillStyle = "#8a2a22";
          g.fillRect(0, 0, W, H);
          g.strokeStyle = "#f0ead9";
          g.lineWidth = 16;
          g.strokeRect(8, 8, W - 16, H - 16);
          g.beginPath();
          g.moveTo(10, 10);
          g.lineTo(W - 10, H - 10);
          g.moveTo(W - 10, 10);
          g.lineTo(10, H - 10);
          g.stroke();
          g.strokeRect(W / 2 - 1, 8, 2, H - 16);
        }),
      }),
      trim: new THREE.MeshStandardMaterial({ color: "#f0ead9", roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ map: roofMap(), color: "#8b8f98", roughness: 0.85 }),
      dark: new THREE.MeshStandardMaterial({ color: "#2a211c", roughness: 1 }),
      silo: new THREE.MeshStandardMaterial({ color: "#c9ccce", roughness: 0.5, metalness: 0.35 }),
      band: new THREE.MeshStandardMaterial({ color: "#8f9499", roughness: 0.5, metalness: 0.4 }),
      cap: new THREE.MeshStandardMaterial({ color: "#7d8fa3", roughness: 0.4, metalness: 0.5 }),
    }),
    []
  );

  // The gambrel: wall, a steep lower slope, a shallow upper one.
  const hw = BARN.w / 2;
  const profile = useMemo<[number, number][]>(
    () => [
      [-hw, 0],
      [-hw, BARN.wall],
      [-hw * 0.62, BARN.wall + 2.1],
      [0, BARN.wall + 3.1],
      [hw * 0.62, BARN.wall + 2.1],
      [hw, BARN.wall],
      [hw, 0],
    ],
    [hw]
  );
  const shell = useMemo(() => {
    const shape = new THREE.Shape();
    profile.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: BARN.d, bevelEnabled: false });
    g.translate(0, 0, -BARN.d / 2);
    return g;
  }, [profile]);

  // One slab of roof per sloping edge of the profile, derived from it, so the
  // roof cannot float off the walls.
  const slabs = useMemo(() => {
    const out: { pos: [number, number, number]; rot: number; len: number }[] = [];
    for (let i = 1; i < 5; i++) {
      const [x0, y0] = profile[i];
      const [x1, y1] = profile[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0) + 0.35;
      out.push({ pos: [(x0 + x1) / 2, (y0 + y1) / 2 + 0.09, 0], rot: Math.atan2(y1 - y0, x1 - x0), len });
    }
    return out;
  }, [profile]);

  // Turned so the big doors look back across the field at the pen.
  const face = Math.atan2(-BARN.x, -BARN.z);
  const front = BARN.d / 2 + 0.03;

  return (
    <group position={[BARN.x, 0, BARN.z]} rotation={[0, face, 0]}>
      <mesh geometry={shell} material={mats.red} />
      {slabs.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, 0, s.rot]} material={mats.roof}>
          <boxGeometry args={[s.len, 0.18, BARN.d + 0.9]} />
        </mesh>
      ))}
      {/* the doors, and the hayloft hatch above them */}
      <mesh position={[0, 1.9, front]} material={mats.door}>
        <planeGeometry args={[4, 3.8]} />
      </mesh>
      <mesh position={[0, BARN.wall + 1.25, front]} material={mats.dark}>
        <planeGeometry args={[1.5, 1.5]} />
      </mesh>
      {[
        [0, BARN.wall + 2.08, 1.8, 0.16],
        [0, BARN.wall + 0.42, 1.8, 0.16],
        [-0.82, BARN.wall + 1.25, 0.16, 1.82],
        [0.82, BARN.wall + 1.25, 0.16, 1.82],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, front + 0.02]} material={mats.trim}>
          <planeGeometry args={[w, h]} />
        </mesh>
      ))}
      {/* corner boards */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (hw - 0.1), BARN.wall / 2, front + 0.01]} material={mats.trim}>
          <planeGeometry args={[0.22, BARN.wall]} />
        </mesh>
      ))}
      {/* the silo */}
      <group position={[hw + 2.6, 0, -1.5]}>
        <mesh position={[0, 4.6, 0]} material={mats.silo}>
          <cylinderGeometry args={[1.9, 1.9, 9.2, 28]} />
        </mesh>
        {[1.2, 3, 4.8, 6.6, 8.4].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.band}>
            <torusGeometry args={[1.91, 0.05, 6, 32]} />
          </mesh>
        ))}
        <mesh position={[0, 9.2, 0]} material={mats.cap}>
          <sphereGeometry args={[1.95, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
    </group>
  );
}

const MILL = { x: 38, z: 24 };

/** A windmill on the skyline. It turns in the same wind the grass bends in. */
function Windmill() {
  const mats = useMemo(
    () => ({
      tower: new THREE.MeshStandardMaterial({ map: stuccoMap(), color: "#f4efe2", roughness: 0.95 }),
      cap: new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ map: woodMap(), roughness: 0.9 }),
      sail: new THREE.MeshStandardMaterial({
        roughness: 1,
        side: THREE.DoubleSide,
        transparent: true,
        map: paintTexture(128, 512, (g, W, H) => {
          g.clearRect(0, 0, W, H);
          g.fillStyle = "rgba(244,236,214,0.94)";
          g.fillRect(0, 0, W, H);
          g.strokeStyle = "#6b5138";
          g.lineWidth = 7;
          for (let y = 0; y <= H; y += 64) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(W, y);
            g.stroke();
          }
          for (const x of [3, W / 2, W - 3]) {
            g.beginPath();
            g.moveTo(x, 0);
            g.lineTo(x, H);
            g.stroke();
          }
        }),
      }),
      dark: new THREE.MeshStandardMaterial({ color: "#3a2f28", roughness: 1 }),
    }),
    []
  );
  const sails = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (sails.current) sails.current.rotation.z -= Math.min(delta, 0.05) * 0.5;
  });
  const face = Math.atan2(-MILL.x, -MILL.z);

  return (
    <group position={[MILL.x, 0, MILL.z]} rotation={[0, face, 0]}>
      <mesh position={[0, 4.6, 0]} material={mats.tower}>
        <cylinderGeometry args={[1.45, 2.5, 9.2, 10]} />
      </mesh>
      <mesh position={[0, 10.1, 0]} material={mats.cap}>
        <coneGeometry args={[1.85, 2, 10]} />
      </mesh>
      <mesh position={[0, 1.1, 2.36]} rotation={[-0.12, 0, 0]} material={mats.dark}>
        <planeGeometry args={[1, 2.2]} />
      </mesh>
      {[4.2, 6.9].map((y) => (
        <mesh key={y} position={[0, y, 2.5 - (y / 9.2) * 1.02]} rotation={[-0.12, 0, 0]} material={mats.dark}>
          <planeGeometry args={[0.6, 0.8]} />
        </mesh>
      ))}
      <group ref={sails} position={[0, 8.9, 1.95]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.wood}>
          <cylinderGeometry args={[0.22, 0.22, 0.7, 10]} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, 0, (k * Math.PI) / 2 + 0.3]}>
            <mesh position={[0, 3.1, 0.2]} material={mats.wood}>
              <boxGeometry args={[0.16, 6.2, 0.12]} />
            </mesh>
            <mesh position={[0.62, 3.7, 0.22]} rotation={[0, 0.16, 0]} material={mats.sail}>
              <planeGeometry args={[1.15, 4.7]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Somebody's day out, drifting round the horizon. */
function Balloon() {
  const ref = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      envelope: new THREE.MeshStandardMaterial({
        roughness: 0.7,
        map: paintTexture(256, 64, (g, W, H) => {
          const cols = ["#e8483f", "#f6e7c4", "#f2b632", "#f6e7c4"];
          for (let i = 0; i < 8; i++) {
            g.fillStyle = cols[i % 4];
            g.fillRect((i * W) / 8, 0, W / 8 + 1, H);
          }
        }),
      }),
      basket: new THREE.MeshStandardMaterial({ color: "#7a5a36", roughness: 1 }),
    }),
    []
  );
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime * 0.012 + 2.2;
    g.position.set(Math.cos(t) * 88, 30 + Math.sin(t * 5) * 3, Math.sin(t) * 88);
    g.rotation.y = t * 2;
  });
  return (
    <group ref={ref}>
      <mesh scale={[1, 1.18, 1]} material={mats.envelope}>
        <sphereGeometry args={[5, 24, 16]} />
      </mesh>
      <mesh position={[0, -5.6, 0]} material={mats.envelope}>
        <cylinderGeometry args={[1.6, 0.8, 1.6, 16, 1, true]} />
      </mesh>
      <mesh position={[0, -8.1, 0]} material={mats.basket}>
        <boxGeometry args={[1.3, 1, 1.3]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// the bull
// ---------------------------------------------------------------------------

/** Seconds, from the moo landing: he looks, he considers it, he turns his back. */
const BULL_LOOK = 0.35;
const BULL_SNORT = 2.1;
const BULL_TURN = 2.5;
const BULL_DONE = 4.6;

/**
 * A very large animal in a small paddock who has seen cows before.
 *
 * Moo at him and he does three things, slowly: looks round at you, breathes
 * out through his nose, and rearranges himself so that what you are now
 * addressing is his backside.
 */
function Bull() {
  const mats = useMemo(
    () => ({
      hide: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
      eye: new THREE.MeshStandardMaterial({ color: "#f3efe4", roughness: 0.3 }),
      pupil: new THREE.MeshBasicMaterial({ color: "#0d0b0a" }),
      lid: new THREE.MeshStandardMaterial({ color: "#2e1b15", roughness: 0.9 }),
      ring: new THREE.MeshStandardMaterial({ color: "#e0b44a", roughness: 0.25, metalness: 0.9, emissive: "#6b4d10", emissiveIntensity: 0.5 }),
      puff: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }),
    }),
    []
  );
  const [geo, setGeo] = useState<{ body: THREE.BufferGeometry; head: THREE.BufferGeometry } | null>(null);
  useEffect(() => {
    let live = true;
    void skinGeometry({ kind: "bull" }).then(([body, head]) => {
      if (live) setGeo({ body, head });
    });
    return () => {
      live = false;
    };
  }, []);

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const bullSeq = useCowStore((s) => s.bullSeq);
  const since = useRef(-1);
  // He starts side-on to the pen, like a bull in a picture book.
  const yaw = useRef(Math.PI / 2);
  const from = useRef(Math.PI / 2);
  const to = useRef(Math.PI / 2);

  useEffect(() => {
    if (bullSeq > 0) since.current = 0;
  }, [bullSeq]);

  useFrame((state, delta) => {
    const g = root.current;
    const h = head.current;
    const b = body.current;
    if (!g || !h || !b) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // chewing, breathing, the occasional flick of the tail: the whole of his day
    const chew = Math.sin(t * 3.1) * 0.5 + 0.5;
    let headYaw = Math.sin(t * 0.23) * 0.12;
    let headPitch = 0.34 + chew * 0.05;
    b.scale.set(1 + Math.sin(t * 1.3) * 0.012, 1, 1);
    if (tail.current) tail.current.rotation.z = Math.pow(Math.max(0, Math.sin(t * 0.9)), 14) * 0.9;

    let puff = 0;
    if (since.current >= 0) {
      since.current += dt;
      const s = since.current;
      // the bearing of the cow, as seen from the bull, relative to his nose
      const toCow = Math.atan2(cowState.x - BULL_PEN.x, cowState.z - BULL_PEN.z);
      const rel = Math.atan2(Math.sin(toCow - yaw.current), Math.cos(toCow - yaw.current));
      if (s < BULL_TURN) {
        // a long, level look — as far round as a neck that thick will go
        const k = THREE.MathUtils.smoothstep(s, BULL_LOOK, BULL_LOOK + 0.9);
        headYaw = THREE.MathUtils.lerp(headYaw, THREE.MathUtils.clamp(rel, -1.15, 1.15), k);
        headPitch = THREE.MathUtils.lerp(headPitch, 0.12, k);
        from.current = yaw.current;
        // ...and then the back view: nose pointing directly away from the cow
        to.current = yaw.current + Math.atan2(Math.sin(toCow + Math.PI - yaw.current), Math.cos(toCow + Math.PI - yaw.current));
      } else if (s < BULL_DONE) {
        const k = THREE.MathUtils.smootherstep(s, BULL_TURN, BULL_DONE);
        yaw.current = THREE.MathUtils.lerp(from.current, to.current, k);
        // shuffling round on the spot is undignified, and he knows it
        g.position.y = Math.abs(Math.sin(s * 9)) * 0.03 * Math.sin(k * Math.PI);
      } else {
        since.current = -1;
        g.position.y = 0;
      }
      if (s > BULL_SNORT && s < BULL_SNORT + 0.7) puff = (s - BULL_SNORT) / 0.7;
    }

    g.rotation.y = yaw.current;
    h.rotation.set(headPitch, headYaw, 0);

    puffs.current.forEach((p, i) => {
      if (!p) return;
      const m = p.material as THREE.MeshBasicMaterial;
      m.opacity = puff > 0 ? (1 - puff) * 0.75 : 0;
      const side = i ? 1 : -1;
      p.position.set(side * (0.07 + puff * 0.2), -0.3 - puff * 0.12, 0.66 + puff * 0.5);
      p.scale.setScalar(0.5 + puff * 1.8);
    });
  });

  if (!geo) return null;

  return (
    <group position={[BULL_PEN.x, 0, BULL_PEN.z]}>
      <group ref={root} scale={1.08}>
        <group ref={body}>
          <mesh geometry={geo.body} material={mats.hide} castShadow receiveShadow />
        </group>
        <group ref={tail} position={[0, 1.3, -1.12]} />
        <group ref={head} position={BULL_NECK}>
          <mesh geometry={geo.head} material={mats.hide} castShadow />
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.2, -0.02, 0.21]}>
              <mesh material={mats.eye}>
                <sphereGeometry args={[0.05, 12, 10]} />
              </mesh>
              <mesh position={[sx * 0.012, -0.008, 0.038]} material={mats.pupil}>
                <sphereGeometry args={[0.024, 10, 8]} />
              </mesh>
              {/* a heavy lid: the look of a creature that is not impressed */}
              <mesh position={[0, 0.028, 0.012]} rotation={[0.35, 0, sx * 0.25]} material={mats.lid}>
                <sphereGeometry args={[0.056, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.37, 0.56]} rotation={[0.25, 0, 0]} material={mats.ring}>
            <torusGeometry args={[0.075, 0.016, 8, 20]} />
          </mesh>
          {[0, 1].map((i) => (
            <mesh
              key={i}
              ref={(m) => {
                puffs.current[i] = m;
              }}
              material={mats.puff}
            >
              <sphereGeometry args={[0.09, 10, 8]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Post-and-rail round the bull, a water bucket, and a sign that oversells him. */
function BullPaddock() {
  const mats = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ map: woodMap(), roughness: 0.95 }),
      sign: new THREE.MeshStandardMaterial({
        roughness: 0.7,
        map: boardMap(
          [
            { text: "BEWARE", size: 78, color: "#c0241c" },
            { text: "OF THE BULL", size: 54 },
            { text: "(he is not bothered)", size: 26, color: "#555" },
          ],
          "#f5edd6",
          "#c0241c"
        ),
      }),
      bucket: new THREE.MeshStandardMaterial({ color: "#8a9099", roughness: 0.4, metalness: 0.6 }),
      water: new THREE.MeshStandardMaterial({ color: "#3f6d78", roughness: 0.1 }),
      mud: new THREE.MeshStandardMaterial({ color: "#6a5238", roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    }),
    []
  );
  const postGeo = useMemo(
    () =>
      loft(
        [
          { z: 0, rx: 0.085, ry: 0.085 },
          { z: 0.8, rx: 0.075, ry: 0.08 },
          { z: 1.45, rx: 0.07, ry: 0.07 },
        ],
        { radial: 8, segments: 8, square: 0.4 }
      ).rotateX(-Math.PI / 2),
    []
  );
  const railGeo = useMemo(() => new THREE.BoxGeometry(1, 0.11, 0.06), []);

  const { posts, rails } = useMemo(() => {
    const { hw, hd } = BULL_PEN;
    const posts: Placement[] = [];
    const rails: Placement[] = [];
    const r = rng(717);
    const side = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 1.8);
      const rot = -Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        posts.push({ pos: [x0 + (x1 - x0) * t0, 0, z0 + (z1 - z0) * t0], rot: [0, r() * 6, (r() - 0.5) * 0.06] });
        for (const y of [0.45, 0.85, 1.25]) {
          rails.push({
            pos: [x0 + (x1 - x0) * (t0 + t1) * 0.5, y + (r() - 0.5) * 0.03, z0 + (z1 - z0) * (t0 + t1) * 0.5],
            rot: [0, rot, (r() - 0.5) * 0.02],
            scale: [len / n + 0.1, 1, 1],
          });
        }
      }
    };
    side(-hw, -hd, hw, -hd);
    side(hw, -hd, hw, hd);
    side(hw, hd, -hw, hd);
    side(-hw, hd, -hw, -hd);
    return { posts, rails };
  }, []);

  // The sign hangs on the side nearest the pen, which is where a cow comes from.
  const signYaw = Math.atan2(-BULL_PEN.x, -BULL_PEN.z);
  const onLongSide = Math.abs(Math.cos(signYaw)) > 0.5;

  return (
    <group position={[BULL_PEN.x, 0, BULL_PEN.z]}>
      <InstancedGroup geometry={postGeo} material={mats.wood} items={posts} castShadow />
      <InstancedGroup geometry={railGeo} material={mats.wood} items={rails} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]} material={mats.mud}>
        <circleGeometry args={[2.3, 24]} />
      </mesh>
      {onLongSide ? (
        <mesh position={[0.9, 0.95, -BULL_PEN.hd - 0.06]} rotation={[0, Math.PI, 0]} material={mats.sign}>
          <planeGeometry args={[1.5, 0.75]} />
        </mesh>
      ) : (
        <mesh position={[BULL_PEN.hw + 0.06, 0.95, -0.6]} rotation={[0, Math.PI / 2, 0]} material={mats.sign}>
          <planeGeometry args={[1.5, 0.75]} />
        </mesh>
      )}
      <group position={[BULL_PEN.hw - 0.7, 0, BULL_PEN.hd - 0.7]}>
        <mesh position={[0, 0.2, 0]} material={mats.bucket} castShadow>
          <cylinderGeometry args={[0.3, 0.24, 0.4, 16, 1, true]} />
        </mesh>
        <mesh position={[0, 0.33, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.water}>
          <circleGeometry args={[0.28, 16]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// the portaloo
// ---------------------------------------------------------------------------

/**
 * One plastic cubicle round the side of the police station, with the bolt
 * across. Headbutt the door and you are told, from inside, that it is
 * occupied. The third time, the occupant gives up — see `Sheep` in
 * components/Outside.tsx, which is where he lands.
 */
function Portaloo() {
  const mats = useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({ color: "#2f86c2", roughness: 0.55 }),
      door: new THREE.MeshStandardMaterial({ color: "#3d97d6", roughness: 0.5 }),
      roof: new THREE.MeshStandardMaterial({ color: "#eef3f6", roughness: 0.6 }),
      base: new THREE.MeshStandardMaterial({ color: "#3a4047", roughness: 0.8 }),
      inside: new THREE.MeshStandardMaterial({ color: "#1d4b6d", roughness: 0.9, side: THREE.BackSide }),
      seat: new THREE.MeshStandardMaterial({ color: "#eef1f2", roughness: 0.4 }),
      red: new THREE.MeshBasicMaterial({ color: "#e02b2b" }),
      green: new THREE.MeshBasicMaterial({ color: "#35c45a" }),
      metal: new THREE.MeshStandardMaterial({ color: "#c9ced2", roughness: 0.3, metalness: 0.8 }),
      fly: new THREE.MeshBasicMaterial({ color: "#111" }),
      sign: new THREE.MeshStandardMaterial({
        roughness: 0.6,
        map: boardMap([{ text: "WC", size: 150, color: "#ffffff" }], "#1f5f8f", undefined, 256, 256),
      }),
      roll: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }),
    }),
    []
  );
  const cabin = useRef<THREE.Group>(null);
  const door = useRef<THREE.Group>(null);
  const flies = useRef<(THREE.Mesh | null)[]>([]);
  const looSeq = useCowStore((s) => s.looSeq);
  const since = useRef(-1);
  const opened = useRef(0);

  useEffect(() => {
    if (looSeq > 0) since.current = 0;
  }, [looSeq]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const c = cabin.current;
    if (c) {
      // rocked by the knock, and — while there is somebody in it — by them
      let rock = looSeq < 3 ? Math.pow(Math.max(0, Math.sin(t * 0.7)), 30) * Math.sin(t * 30) * 0.012 : 0;
      if (since.current >= 0) {
        since.current += dt;
        const s = since.current;
        rock += Math.sin(s * 26) * 0.07 * Math.exp(-s * 3.2);
        if (s > 3) since.current = -1;
      }
      c.rotation.z = rock;
      c.rotation.x = rock * 0.5;
    }
    // Third knock: the door goes, hard, and stays gone.
    const want = looSeq >= 3 ? 1 : 0;
    opened.current += (want - opened.current) * Math.min(1, dt * 9);
    if (door.current) door.current.rotation.y = -opened.current * 2.05 + (want ? Math.sin(t * 2) * 0.03 : 0);
    flies.current.forEach((f, i) => {
      if (!f) return;
      const a = t * (3.1 + i * 0.7) + i * 2.1;
      f.position.set(Math.cos(a) * (0.3 + i * 0.08), 2.75 + Math.sin(a * 1.7 + i) * 0.14, Math.sin(a * 1.3) * (0.3 + i * 0.08));
    });
  });

  const W = 1.2;
  const H = 2.3;

  return (
    <group position={[PORTALOO.x, 0, PORTALOO.z]} rotation={[0, PORTALOO.face, 0]}>
      <mesh position={[0, 0.06, 0]} material={mats.base} receiveShadow>
        <boxGeometry args={[W + 0.2, 0.12, W + 0.2]} />
      </mesh>
      <group ref={cabin} position={[0, 0.12, 0]}>
        {/* three walls and a back, so there is an inside to look into */}
        {[
          [-W / 2, 0, 0.04, W],
          [W / 2, 0, 0.04, W],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, H / 2, z]} material={mats.shell} castShadow>
            <boxGeometry args={[w, H, d]} />
          </mesh>
        ))}
        <mesh position={[0, H / 2, -W / 2]} material={mats.shell} castShadow>
          <boxGeometry args={[W, H, 0.04]} />
        </mesh>
        {/* door frame */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (W / 2 - 0.07), H / 2, W / 2]} material={mats.shell}>
            <boxGeometry args={[0.14, H, 0.05]} />
          </mesh>
        ))}
        <mesh position={[0, H - 0.14, W / 2]} material={mats.shell}>
          <boxGeometry args={[W, 0.28, 0.05]} />
        </mesh>
        <mesh position={[0, H - 0.14, W / 2 + 0.03]} material={mats.sign}>
          <planeGeometry args={[0.24, 0.24]} />
        </mesh>
        <mesh position={[0, H / 2, 0]} material={mats.inside}>
          <boxGeometry args={[W - 0.06, H - 0.04, W - 0.06]} />
        </mesh>
        {/* the facilities */}
        <mesh position={[0, 0.25, -0.22]} material={mats.seat}>
          <boxGeometry args={[0.62, 0.5, 0.6]} />
        </mesh>
        <mesh position={[0, 0.505, -0.2]} rotation={[-Math.PI / 2, 0, 0]} material={mats.base}>
          <circleGeometry args={[0.17, 16]} />
        </mesh>
        <mesh position={[W / 2 - 0.1, 0.95, 0.05]} rotation={[0, 0, Math.PI / 2]} material={mats.roll}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 12]} />
        </mesh>
        {/* the roof, domed a little, and the vent that makes it a portaloo */}
        <mesh position={[0, H + 0.05, 0]} material={mats.roof} castShadow>
          <boxGeometry args={[W + 0.12, 0.1, W + 0.12]} />
        </mesh>
        <mesh position={[0, H + 0.1, 0]} scale={[1, 0.22, 1]} material={mats.roof}>
          <sphereGeometry args={[W * 0.56, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[-W / 2 + 0.16, H + 0.35, -W / 2 + 0.16]} material={mats.base}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
        </mesh>
        {/* the door, hinged on its left edge */}
        <group ref={door} position={[-(W / 2 - 0.14), 0, W / 2 + 0.01]}>
          <mesh position={[(W - 0.28) / 2, (H - 0.28) / 2, 0]} material={mats.door} castShadow>
            <boxGeometry args={[W - 0.28, H - 0.28, 0.04]} />
          </mesh>
          <mesh position={[W - 0.42, 1.05, 0.04]} material={mats.metal}>
            <boxGeometry args={[0.05, 0.2, 0.04]} />
          </mesh>
          {/* the bolt indicator: red until he leaves */}
          <mesh position={[W - 0.42, 1.28, 0.025]} material={looSeq >= 3 ? mats.green : mats.red}>
            <circleGeometry args={[0.05, 14]} />
          </mesh>
        </group>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            ref={(m) => {
              flies.current[i] = m;
            }}
            material={mats.fly}
          >
            <sphereGeometry args={[0.014, 5, 4]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// the apple tree
// ---------------------------------------------------------------------------

interface Windfall {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** 0 = still on the tree (hidden), 1 = falling at the cow, 2 = bounced, 3 = lying in the grass. */
  phase: number;
  spin: number;
}

const WINDFALLS = 6;
/** Module state, like the flock: it changes every frame and re-renders nothing. */
const windfalls: Windfall[] = Array.from({ length: WINDFALLS }, () => ({
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, phase: 0, spin: 0,
}));
let nextWindfall = 0;

/**
 * An apple tree. Headbutt the trunk and exactly one apple comes down, and it
 * comes down on the cow — aimed at wherever its head is at the time, so there
 * is no standing somewhere clever.
 */
function AppleTree() {
  const tree = useMemo(() => buildTree(137), []);
  const mats = useMemo(
    () => ({
      bark: new THREE.MeshStandardMaterial({ map: barkMap(), roughness: 0.95 }),
      leafDark: applySway(new THREE.MeshStandardMaterial({ color: "#3d7a30", roughness: 0.95 }), 3, 0.045),
      leafLit: applySway(new THREE.MeshStandardMaterial({ color: "#6aa944", roughness: 0.95 }), 3, 0.045),
      apple: new THREE.MeshStandardMaterial({ color: "#d9281f", roughness: 0.35 }),
      stalk: new THREE.MeshStandardMaterial({ color: "#4a3520", roughness: 1 }),
    }),
    []
  );
  const appleGeo = useMemo(() => new THREE.SphereGeometry(0.085, 12, 10).scale(1, 0.9, 1), []);

  // Apples hung on the outside of the crown, lower half, where they show.
  const hung = useMemo(() => {
    const r = rng(4711);
    const out: Placement[] = [];
    const crownY = Math.max(...tree.canopy.map((c) => c.pos[1])) - 0.6;
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.95 + r() * 0.75;
      out.push({ pos: [Math.cos(a) * d, crownY - 0.55 + r() * 0.9 - d * 0.18, Math.sin(a) * d] });
    }
    return out;
  }, [tree]);

  const crown = useRef<THREE.Group>(null);
  const fallen = useRef<(THREE.Mesh | null)[]>([]);
  const shakeSeq = useCowStore((s) => s.shakeSeq);
  const since = useRef(-1);

  useEffect(() => {
    if (shakeSeq <= 0) return;
    since.current = 0;
    // One apple, dropped from the leaves straight above the cow's head.
    const a = windfalls[nextWindfall++ % WINDFALLS];
    a.x = cowState.x + Math.sin(cowState.facing) * NOSE_REACH * 0.8;
    a.z = cowState.z + Math.cos(cowState.facing) * NOSE_REACH * 0.8;
    a.y = 3.1;
    a.vx = a.vz = 0;
    a.vy = 0;
    a.phase = 1;
    a.spin = 0;
  }, [shakeSeq]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (crown.current) {
      let shake = 0;
      if (since.current >= 0) {
        since.current += dt;
        shake = Math.sin(since.current * 34) * 0.05 * Math.exp(-since.current * 3.5);
        if (since.current > 2) since.current = -1;
      }
      crown.current.rotation.z = shake;
      crown.current.rotation.x = shake * 0.6;
    }
    windfalls.forEach((a, i) => {
      const m = fallen.current[i];
      if (!m) return;
      if (a.phase === 1 || a.phase === 2) {
        a.vy -= 13 * dt;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.z += a.vz * dt;
        a.spin += dt * 9;
        // the cow's skull, more or less
        if (a.phase === 1 && a.y < 1.42) {
          const away = Math.random() * Math.PI * 2;
          a.vy = 3.4;
          a.vx = Math.cos(away) * 1.5;
          a.vz = Math.sin(away) * 1.5;
          a.phase = 2;
        }
        if (a.phase === 2 && a.y < 0.085) {
          a.y = 0.085;
          if (Math.abs(a.vy) > 1.2) {
            a.vy *= -0.35;
            a.vx *= 0.6;
            a.vz *= 0.6;
          } else a.phase = 3;
        }
      }
      m.visible = a.phase > 0;
      m.position.set(a.x - APPLE_TREE.x, a.y, a.z - APPLE_TREE.z);
      m.rotation.set(a.spin, a.spin * 0.7, 0);
    });
  });

  return (
    <group position={[APPLE_TREE.x, 0, APPLE_TREE.z]}>
      <group scale={1.15}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={tree.trunk} material={mats.bark} castShadow receiveShadow />
        </group>
        <group ref={crown}>
          {tree.branches.map((b, j) => (
            <group key={j} position={b.pos} rotation={[b.rot[0] + Math.PI / 2, 0, 0]}>
              <group rotation={[0, 0, b.rot[1]]}>
                <mesh geometry={b.geo} material={mats.bark} castShadow />
              </group>
            </group>
          ))}
          {tree.canopy.map((c, j) => (
            <mesh key={j} geometry={c.geo} material={c.dark ? mats.leafDark : mats.leafLit} position={c.pos} scale={c.scale} castShadow />
          ))}
          <InstancedGroup geometry={appleGeo} material={mats.apple} items={hung} />
        </group>
      </group>
      {windfalls.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            fallen.current[i] = m;
          }}
          geometry={appleGeo}
          material={mats.apple}
          visible={false}
          castShadow
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// the fingerpost
// ---------------------------------------------------------------------------

/** Where everything is, as told by somebody who has been here too long. */
function Signpost() {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ map: woodMap(), roughness: 0.95 }), []);
  const arms = useMemo(() => {
    const to = (x: number, z: number) => Math.atan2(x - SIGNPOST.x, z - SIGNPOST.z);
    const list: { text: string; note: string; yaw: number }[] = [
      { text: "POLICE", note: "closed for lunch", yaw: to(STATION.x, STATION.z) },
      { text: "POND", note: "wet", yaw: to(POND.x, POND.z) },
      { text: "BULL", note: "don't", yaw: to(BULL_PEN.x, BULL_PEN.z) },
      { text: "LOO", note: "occupied", yaw: to(PORTALOO.x, PORTALOO.z) },
      { text: "APPLES", note: "mind your head", yaw: to(APPLE_TREE.x, APPLE_TREE.z) },
    ];
    return list.map((a, i) => ({
      ...a,
      y: 2.5 - i * 0.36,
      mat: new THREE.MeshStandardMaterial({
        roughness: 0.8,
        map: paintTexture(512, 128, (g, W, H) => {
          g.fillStyle = "#f3ead2";
          g.fillRect(0, 0, W, H);
          g.strokeStyle = "#2c241c";
          g.lineWidth = 8;
          g.strokeRect(4, 4, W - 8, H - 8);
          g.fillStyle = "#1f1a15";
          g.textBaseline = "middle";
          g.textAlign = "left";
          g.font = `900 66px "Arial Black", Arial, sans-serif`;
          g.fillText(a.text, 22, H / 2 + 4, 250);
          const used = Math.min(250, g.measureText(a.text).width);
          g.font = `italic 700 44px Georgia, serif`;
          g.fillStyle = "#8a2a20";
          g.fillText(`(${a.note})`, 38 + used, H / 2 + 6, W - 54 - used);
        }),
      }),
    }));
  }, []);
  const postGeo = useMemo(
    () =>
      loft(
        [
          { z: 0, rx: 0.09, ry: 0.09 },
          { z: 1.4, rx: 0.075, ry: 0.075 },
          { z: 2.85, rx: 0.065, ry: 0.065 },
        ],
        { radial: 8, segments: 10, square: 0.5 }
      ).rotateX(-Math.PI / 2),
    []
  );
  return (
    <group position={[SIGNPOST.x, 0, SIGNPOST.z]}>
      <mesh geometry={postGeo} material={wood} castShadow />
      <mesh position={[0, 2.92, 0]} material={wood}>
        <coneGeometry args={[0.11, 0.2, 4]} />
      </mesh>
      {arms.map((a) => (
        // A plane's face looks along +z; the board has to run along the bearing
        // instead, so it is turned a quarter of the way round from it.
        <group key={a.text} position={[0, a.y, 0]} rotation={[0, a.yaw - Math.PI / 2, 0]}>
          <mesh position={[0.8, 0, 0]} material={wood} castShadow>
            <boxGeometry args={[1.5, 0.32, 0.035]} />
          </mesh>
          <mesh position={[0.8, 0, 0.019]} material={a.mat}>
            <planeGeometry args={[1.46, 0.29]} />
          </mesh>
          <mesh position={[0.8, 0, -0.019]} rotation={[0, Math.PI, 0]} material={a.mat}>
            <planeGeometry args={[1.46, 0.29]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// the pond's furniture
// ---------------------------------------------------------------------------

/** Stones on the bank, lily pads, and one rubber duck nobody will admit to. */
function PondLife() {
  const stoneGeo = useMemo(() => lumpGeometry(301, 0.3, 0.3, 1), []);
  const mats = useMemo(
    () => ({
      stone: new THREE.MeshStandardMaterial({ color: "#8f8c84", roughness: 0.95, flatShading: true }),
      pad: new THREE.MeshStandardMaterial({ color: "#4f9a44", roughness: 0.6, side: THREE.DoubleSide }),
      flower: new THREE.MeshStandardMaterial({ color: "#f6c4d6", roughness: 0.6 }),
      duck: new THREE.MeshStandardMaterial({ color: "#ffd21f", roughness: 0.35 }),
      beak: new THREE.MeshStandardMaterial({ color: "#f07c1c", roughness: 0.4 }),
      eye: new THREE.MeshBasicMaterial({ color: "#111" }),
    }),
    []
  );
  const padGeo = useMemo(() => new THREE.CircleGeometry(0.3, 18, 0.25, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2), []);

  const { stones, pads, flowers } = useMemo(() => {
    const r = rng(302);
    const stones: Placement[] = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.1;
      // leave the bank open where the lane comes down to the water
      const toLane = Math.atan2(-8.3 - POND.z, 13.2 - POND.x);
      if (Math.abs(Math.atan2(Math.sin(a - toLane), Math.cos(a - toLane))) < 0.5) continue;
      const d = POND.r + 0.05 + r() * 0.3;
      const s = 0.5 + r() * 0.9;
      stones.push({
        pos: [POND.x + Math.cos(a) * d, s * 0.08, POND.z + Math.sin(a) * d],
        rot: [r() * 0.4, r() * 6.3, r() * 0.4],
        scale: [s, s * 0.6, s],
      });
    }
    const pads: Placement[] = [];
    const flowers: Placement[] = [];
    for (let i = 0; i < 11; i++) {
      const a = r() * Math.PI * 2;
      const d = (0.25 + r() * 0.55) * POND.r;
      const s = 0.6 + r() * 0.8;
      const x = POND.x + Math.cos(a) * d;
      const z = POND.z + Math.sin(a) * d;
      pads.push({ pos: [x, 0.062 + i * 0.0006, z], rot: [0, r() * 6.3, 0], scale: s });
      if (i % 3 === 0) flowers.push({ pos: [x, 0.1, z], scale: [s, s * 0.7, s] });
    }
    return { stones, pads, flowers };
  }, []);
  const flowerGeo = useMemo(() => new THREE.IcosahedronGeometry(0.09, 0), []);

  const duck = useRef<THREE.Group>(null);
  useFrame((state) => {
    const d = duck.current;
    if (!d) return;
    const t = state.clock.elapsedTime;
    const a = t * 0.16;
    d.position.set(POND.x + Math.cos(a) * POND.r * 0.45, 0.075 + Math.sin(t * 2.1) * 0.012, POND.z + Math.sin(a) * POND.r * 0.45);
    d.rotation.set(Math.sin(t * 1.7) * 0.06, -a, Math.sin(t * 2.3) * 0.08);
  });

  return (
    <group>
      <InstancedGroup geometry={stoneGeo} material={mats.stone} items={stones} castShadow receiveShadow />
      <InstancedGroup geometry={padGeo} material={mats.pad} items={pads} />
      <InstancedGroup geometry={flowerGeo} material={mats.flower} items={flowers} />
      <group ref={duck}>
        <mesh position={[0, 0.07, 0]} scale={[1, 0.72, 1.25]} material={mats.duck} castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.11, -0.16]} rotation={[0.9, 0, 0]} scale={[0.8, 1, 0.5]} material={mats.duck}>
          <coneGeometry args={[0.08, 0.14, 8]} />
        </mesh>
        <mesh position={[0, 0.22, 0.1]} material={mats.duck} castShadow>
          <sphereGeometry args={[0.085, 14, 10]} />
        </mesh>
        <mesh position={[0, 0.205, 0.19]} scale={[1.3, 0.5, 1]} material={mats.beak}>
          <sphereGeometry args={[0.035, 8, 6]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.045, 0.245, 0.16]} material={mats.eye}>
            <sphereGeometry args={[0.012, 6, 5]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------

export default function Farm() {
  return (
    <group>
      <StoneWall />
      <Bushes />
      <Barn />
      <Windmill />
      <Balloon />
      <BullPaddock />
      <Bull />
      <Portaloo />
      <AppleTree />
      <Signpost />
      <PondLife />
    </group>
  );
}
