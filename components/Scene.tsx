"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { advance, Canvas, useFrame, useThree } from "@react-three/fiber";
import Cow from "./Cow";
import Pit from "./Pit";
import GrassPatches from "./Grass";
import PoliceStation from "./PoliceStation";
import Environment from "./Environment";
import Outside from "./Outside";
import Farm from "./Farm";
import { rng } from "@/lib/geometry";
import { useCowStore } from "@/lib/store";
import { cowState } from "@/lib/cowState";
import { cam, frame, framedOffset, easeBehind, resetBehind, stepShake } from "@/lib/camera";
import { attachLook, isTouch } from "@/lib/input";
import { cameraBlocked, WAYPOINTS } from "@/lib/world";

/**
 * Mid-afternoon, sun low and behind-left. Everything that needs to agree about
 * where the sun is — the sky dome, the shadow-casting light and the warmth of
 * the fill — reads it from here, so they can't drift apart.
 */
const SUN = new THREE.Vector3(-24, 21, 14);
/**
 * Haze colour. The sky dome paints exactly this at the horizon and the fog
 * fades everything distant to it, which is what hides the world's edge.
 */
const HAZE = "#cfe6f7";

export default function Scene() {
  return (
    <Canvas
      // "percentage" is PCFShadowMap. The default R3F picks (PCFSoft) is
      // deprecated in this version of three and falls back to this anyway, with
      // a console warning every reload.
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [1.6, 3.2, 7.4], fov: 45, near: 0.12, far: 400 }}
      gl={{ antialias: true }}
      onCreated={({ gl, scene }) => {
        // Filmic tone mapping keeps the white of the cow and the bright sky from
        // clipping to flat paper, which is most of what makes untuned WebGL look
        // like a screensaver.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        // Thin: the hills are a hundred metres off now and should still be
        // green when they get here, with only the far ridge gone to blue.
        scene.fog = new THREE.FogExp2(HAZE, 0.0052);
      }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <SkyDome />
      <Clouds />

      {/* Sky above, warm bounce off the field below. Strong enough that a
          shadow is a cooler, darker green and not a hole in the ground. */}
      <hemisphereLight args={["#cfe4ff", "#8aa256", 1.25]} />
      <ambientLight intensity={0.22} />
      <SunLight />

      <Environment />
      <Outside />
      <Farm />
      <Pit />
      <GrassPatches />
      <Cow />
      <PoliceStation />

      <FrameRig />
      <CameraRig />
      <DevBridge />
    </Canvas>
  );
}

/**
 * The sky: a deep blue overhead paling to haze at the horizon, with the sun in
 * it. A painted gradient rather than a physical sky model, because the
 * physical one at this sun angle is a sheet of white — correct, and the reason
 * the whole game looked overcast.
 *
 * It rides along with the camera, so it is always the same distance away, and
 * it goes through the same tone mapping as everything else so that the horizon
 * comes out exactly the colour the fog fades the hills to.
 */
function SkyDome() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSun: { value: SUN.clone().normalize() },
          uHorizon: { value: new THREE.Color(HAZE) },
          uMid: { value: new THREE.Color("#63a8ee") },
          uZenith: { value: new THREE.Color("#1f63c8") },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 uSun;
          uniform vec3 uHorizon;
          uniform vec3 uMid;
          uniform vec3 uZenith;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = max(d.y, 0.0);
            vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.3, h));
            col = mix(col, uZenith, smoothstep(0.22, 0.95, h));
            float s = max(dot(d, uSun), 0.0);
            // a warm bloom round the sun, and the disc itself
            col += vec3(1.0, 0.86, 0.6) * (pow(s, 6.0) * 0.16 + pow(s, 90.0) * 0.5);
            col += vec3(1.0, 0.97, 0.88) * smoothstep(0.9989, 0.9994, s) * 6.0;
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    []
  );
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[370, 32, 16]} />
    </mesh>
  );
}

/**
 * Fair-weather clouds: heaps of white puffs with flat bottoms, drifting. One
 * instanced mesh, lit by the same sun as the field so their tops are bright
 * and their undersides are in shade.
 */
function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 12, 9), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#a9c1dc",
        emissiveIntensity: 0.55,
        roughness: 1,
        fog: false,
      }),
    []
  );
  const matrices = useMemo(() => {
    const r = rng(2024);
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let c = 0; c < 22; c++) {
      const a = (c / 22) * Math.PI * 2 + r() * 0.25;
      const d = 110 + r() * 170;
      const y = 58 + r() * 50;
      const size = 9 + r() * 12;
      const yaw = r() * Math.PI;
      const puffs = 5 + Math.floor(r() * 5);
      for (let i = 0; i < puffs; i++) {
        // strung out along one line, biggest in the middle
        const t = puffs === 1 ? 0 : i / (puffs - 1) - 0.5;
        const along = t * size * 2.6;
        const big = size * (1 - Math.abs(t) * 1.1) * (0.75 + r() * 0.45);
        p.set(
          Math.cos(a) * d + Math.cos(yaw) * along + (r() - 0.5) * size * 0.5,
          y + big * 0.42,
          Math.sin(a) * d + Math.sin(yaw) * along + (r() - 0.5) * size * 0.5
        );
        s.set(big, big * 0.62, big * 0.9);
        out.push(m.clone().compose(p, q, s));
      }
    }
    return out;
  }, []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mat4, i) => mesh.setMatrixAt(i, mat4));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += Math.min(delta, 0.05) * 0.004;
  });
  return <instancedMesh ref={ref} args={[geo, mat, matrices.length]} frustumCulled={false} />;
}

/**
 * Keeps the shot readable on any screen shape.
 *
 * `fov` in three.js is the VERTICAL angle, which is the wrong end to hold fixed
 * on a phone: a 45-degree vertical on a 9:20 portrait screen leaves barely 22
 * degrees across, which is why an upright phone used to show nothing but the
 * cow's backside. So the HORIZONTAL angle is what's held constant instead — the
 * "Hor+" convention — and the vertical gives way to keep it.
 *
 * Two limits stop that from going silly. The vertical is capped, because the
 * angle a tall screen actually wants is about 117 degrees and that looks like a
 * fisheye lens. Whatever width the cap couldn't give back is then taken by
 * pulling the camera further off the cow instead, which widens the view without
 * bending it.
 */
const DESIGN_FOV = 45; // vertical degrees, framed for a 16:9 screen
const DESIGN_ASPECT = 16 / 9;
const DESIGN_HFOV = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(DESIGN_FOV) / 2) * DESIGN_ASPECT);
const FOV_CAP = 64;
const DIST_CAP = 1.6;

/**
 * How much the viewport has to change shape before the framing is allowed to
 * move at all. A phone's dynamic viewport height changes on its own as the
 * browser's chrome slides in and out, and reframing on every one of those was
 * one of the two things that made the camera look like it was zooming by
 * itself.
 */
const ASPECT_DEAD = 0.04;

function FrameRig() {
  // Recomputed from inside the frame loop rather than an effect, because the
  // camera is the render loop's to mutate — the same reason `CameraRig` below
  // writes to it there.
  const lastAspect = useRef(0);
  const want = useRef({ fov: DESIGN_FOV, scale: 1 });

  useFrame(({ camera, size }, delta) => {
    const lens = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const first = lastAspect.current === 0;

    // Recompute the target, but only when the shape has really changed. The
    // targets are held in a ref rather than derived every frame so that a
    // viewport wobbling inside the dead zone leaves the framing exactly alone
    // rather than easing towards a slightly different one.
    if (first || Math.abs(aspect - lastAspect.current) / aspect > ASPECT_DEAD) {
      lastAspect.current = aspect;
      const wanted = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(DESIGN_HFOV / 2) / aspect));
      const fov = THREE.MathUtils.clamp(wanted, DESIGN_FOV, FOV_CAP);
      // What we ended up with across, after the cap — and so how much further
      // back the camera has to stand to make up the difference.
      const got = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
      want.current = { fov, scale: THREE.MathUtils.clamp(DESIGN_HFOV / got, 1, DIST_CAP) };
    }

    // Rotating a phone swings the framing a long way — 64 degrees and 1.6x out
    // in portrait against 45 and 1x in landscape — and snapping between the
    // two reads as the camera lurching. Easing over about a quarter of a second
    // makes the same change read as a move.
    const k = first ? 1 : 1 - Math.pow(0.02, Math.min(delta, 0.05));
    frame.distScale += (want.current.scale - frame.distScale) * k;
    if (Math.abs(lens.fov - want.current.fov) > 0.005) {
      lens.fov += (want.current.fov - lens.fov) * k;
      lens.updateProjectionMatrix();
    }
  });

  return null;
}

/**
 * Hands the live three.js state to the console in dev, next to `__cowStore()`.
 *
 * This exists because an automated browser tab runs backgrounded, and Chrome
 * suspends requestAnimationFrame in a hidden tab — so an agent screenshotting
 * this page gets a frozen frame or a black one. `__cowScene.advance(t, true)`
 * steps the whole frame loop by hand, which makes the scene checkable without a
 * human watching it. See "Verifying without watching it" in HANDOFF.md.
 */
function DevBridge() {
  const state = useThree();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as Record<string, unknown>;
    w.__cowScene = { ...state, advance };
    // the per-frame state that lives outside React, for poking at in tests
    w.__cow = { cowState, cam };
    // `__shot(px,py,pz, tx,ty,tz, fov)` renders the live scene from any camera
    // into an overlay image (`__hide()` removes it). A second renderer on a
    // detached canvas, so it works even when the game canvas is not drawing —
    // see "Verifying without watching it" in HANDOFF.md.
    let shotRenderer: THREE.WebGLRenderer | null = null;
    w.__shot = (px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov = 35) => {
      if (!shotRenderer) {
        shotRenderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: true });
        shotRenderer.setSize(1280, 720, false);
        shotRenderer.toneMapping = state.gl.toneMapping;
        shotRenderer.toneMappingExposure = state.gl.toneMappingExposure;
        shotRenderer.shadowMap.enabled = true;
        shotRenderer.shadowMap.type = state.gl.shadowMap.type;
      }
      let img = document.getElementById("__shot") as HTMLImageElement | null;
      if (!img) {
        img = document.createElement("img");
        img.id = "__shot";
        img.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;object-fit:cover;background:#000";
        document.body.appendChild(img);
      }
      const lens = new THREE.PerspectiveCamera(fov, 1280 / 720, 0.02, 400);
      lens.position.set(px, py, pz);
      lens.lookAt(tx, ty, tz);
      shotRenderer.render(state.scene, lens);
      img.src = shotRenderer.domElement.toDataURL("image/png");
      img.style.display = "block";
      return "ok";
    };
    // `await __step(frames)` runs the game forward on a virtual 60fps clock,
    // letting React flush between frames so store-driven gags still start. For
    // automated tabs, where requestAnimationFrame is throttled to a crawl.
    w.__step = async (frames: number, ms = 1000 / 60) => {
      const real = performance.now.bind(performance);
      const win = w as { __vt?: number };
      if (win.__vt === undefined) {
        win.__vt = real();
        performance.now = () => win.__vt!;
      }
      const flush = () =>
        new Promise<void>((r) => {
          const c = new MessageChannel();
          c.port1.onmessage = () => r();
          c.port2.postMessage(0);
        });
      for (let i = 0; i < frames; i++) {
        win.__vt! += ms;
        advance(win.__vt!, true);
        await flush();
      }
      return frames;
    };
    w.__hide = () => {
      const img = document.getElementById("__shot");
      if (img) img.style.display = "none";
    };
    return () => {
      delete w.__cowScene;
      delete w.__cow;
      delete w.__shot;
      shotRenderer?.dispose();
    };
  }, [state]);
  return null;
}

/**
 * The sun, and the one thing that casts shadows.
 *
 * A single shadow map stretched over the whole 70-unit world would be too coarse
 * to show a hoof, so the shadow camera is kept small and dragged along behind the
 * cow. You always get a sharp shadow where you are looking, and the far field
 * simply has none — which nobody notices.
 */
function SunLight() {
  const ref = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const light = ref.current;
    if (!light) return;
    target.position.set(cowState.x, 0, cowState.z);
    target.updateMatrixWorld();
    light.position.set(cowState.x + SUN.x * 0.5, SUN.y * 0.5, cowState.z + SUN.z * 0.5);
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={ref}
        color="#fff0d2"
        intensity={2.5}
        target={target}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.022}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
      />
    </>
  );
}

/**
 * Third-person free-look camera. There are no OrbitControls here: the rig owns
 * the camera outright, positioning it from the yaw/pitch/distance in `cam` so
 * the view can follow the mouse without a button held down.
 */
function CameraRig() {
  const { camera, gl } = useThree();
  const focus = useRef(new THREE.Vector3(WAYPOINTS.penCentre.x, 1.05, WAYPOINTS.penCentre.z));
  const want = useMemo(() => new THREE.Vector3(), []);
  /** How far out along its boom the camera is allowed to be, 0..1. */
  const reach = useRef(1);

  useEffect(() => {
    resetBehind(cowState.facing);
    return attachLook(gl.domElement);
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const started = useCowStore.getState().started;

    // Ease the point we're orbiting toward the cow so the camera doesn't jitter
    // with every step of the walk cycle.
    want.set(cowState.x, 1.05 + cowState.stand * 0.75, cowState.z);
    focus.current.lerp(want, 1 - Math.pow(0.0015, dt));

    // Title card: a slow drift across the FRONT of the cow, so you watch it
    // dance rather than watching it dance away from you. The values it leaves
    // behind are deliberately ordinary ones — a fine distance and pitch to
    // start playing at — so tapping through needs no handoff animation at all.
    if (!started) {
      cam.yaw = cowState.facing + Math.sin(state.clock.elapsedTime * 0.22) * 0.6;
      cam.pitch = 0.28;
      cam.dist = 5.4;
    }

    // On a phone there's no spare thumb for looking, so swing the camera around
    // behind the cow by itself. With a mouse, the player is in charge.
    //
    // Never during a reaction: the kiss turns the cow to face the camera, and if
    // the camera were also chasing round behind the cow the two would spin round
    // each other forever.
    if (started && isTouch() && !useCowStore.getState().activeGag) {
      easeBehind(cowState.facing, dt);
    }

    const off = framedOffset();

    // Never inside a building or a tree trunk. Walk out along the boom from
    // the cow and stop short of the first solid thing on it: the camera comes
    // in close instead of showing the inside of a wall. In fast, out slowly,
    // so brushing past a tree does not make the view pump.
    let clear = 1;
    const f = focus.current;
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      if (cameraBlocked(f.x + off.x * t, f.y + off.y * t, f.z + off.z * t)) {
        clear = Math.max(0.04, (i - 1) / 18);
        break;
      }
    }
    reach.current +=
      (clear - reach.current) * (clear < reach.current ? 1 - Math.pow(1e-7, dt) : 1 - Math.pow(0.08, dt));
    const k = started ? reach.current : 1;
    // Pinned right up against a wall there is no room behind the cow at all,
    // so the camera goes up and looks down on it instead of sitting in its ear.
    const lift = started ? (1 - THREE.MathUtils.smoothstep(reach.current, 0.08, 0.45)) * 2.1 : 0;

    // Impacts knock the camera about — a slap you can feel from behind the lens.
    const shake = stepShake(dt);
    camera.position.set(
      focus.current.x + off.x * k + shake.x,
      Math.max(0.5, focus.current.y + off.y * k + lift + shake.y),
      focus.current.z + off.z * k + shake.z
    );
    camera.lookAt(focus.current);
  });

  return null;
}
