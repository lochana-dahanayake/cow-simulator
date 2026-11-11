// The bull in the next field: one piece of skin, like the cow and the sheep
// (lib/sdf.ts), built in the skin worker. He is all shoulder — a tonne of
// animal balanced on four short legs — because the joke is how little of that
// he is prepared to move on anybody's account.
//
// Local frame: feet on y=0, facing +z. The head is built separately so it can
// turn (slowly) without the rest of him having to.

import * as THREE from "three";
import { buildSkin, ellipsoid, roundCone, sphere, type Prim } from "./sdf";

export const BULL_HIDE = "#4b2e22";
const DARK = "#2e1b15";
const MUZZLE = "#c9a391";
const HORN = "#ebe3cd";
const HOOF = "#1c1614";

/** Where the head hangs off the neck, in the body's frame. */
export const BULL_NECK: [number, number, number] = [0, 1.12, 1.02];

export function buildBull(): { body: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  const body: Prim[] = [
    { d: ellipsoid([0, 1.02, -0.05], [0.5, 0.47, 0.9]), bone: 0, color: BULL_HIDE },
    // the hump: everything a bull is, in one lump over the shoulders
    { d: ellipsoid([0, 1.34, 0.48], [0.47, 0.4, 0.5]), bone: 0, k: 0.22, color: DARK },
    { d: ellipsoid([0, 1.0, 0.62], [0.52, 0.5, 0.42]), bone: 0, k: 0.2, color: BULL_HIDE },
    // a back end that is frankly an afterthought
    { d: ellipsoid([0, 1.06, -0.78], [0.42, 0.42, 0.4]), bone: 0, k: 0.2, color: BULL_HIDE },
    // neck and dewlap, running out to where the head hangs
    { d: roundCone([0, 1.2, 0.75], BULL_NECK, 0.4, 0.3), bone: 0, k: 0.16, color: DARK },
    { d: ellipsoid([0, 0.82, 0.88], [0.14, 0.26, 0.3]), bone: 0, k: 0.14, color: BULL_HIDE },
    // tail, and the tuft on the end of it
    { d: roundCone([0, 1.3, -1.12], [0, 0.62, -1.24], 0.045, 0.03), bone: 0, k: 0.06, color: BULL_HIDE },
    { d: ellipsoid([0, 0.5, -1.25], [0.06, 0.13, 0.06]), bone: 0, k: 0.04, color: DARK },
  ];
  for (const sx of [-1, 1]) {
    for (const [z, top] of [[0.56, 0.86], [-0.74, 0.8]] as const) {
      body.push(
        { d: roundCone([sx * 0.3, top, z], [sx * 0.3, 0.42, z], 0.19, 0.12), bone: 0, k: 0.14, color: BULL_HIDE },
        { d: roundCone([sx * 0.3, 0.42, z], [sx * 0.3, 0.1, z + 0.01], 0.105, 0.09), bone: 0, k: 0.05, color: BULL_HIDE },
        { d: ellipsoid([sx * 0.3, 0.07, z + 0.03], [0.11, 0.075, 0.13]), bone: 0, k: 0.02, color: HOOF }
      );
    }
  }
  const bodyGeo = buildSkin(body, {
    min: [-0.75, -0.02, -1.5],
    max: [0.75, 1.85, 1.45],
    step: 0.03,
    colors: true,
  });

  // The head, about its own pivot (the back of the skull), nose along +z and
  // carried low.
  const head: Prim[] = [
    { d: roundCone([0, 0, 0.02], [0, -0.2, 0.42], 0.27, 0.2), bone: 0, color: BULL_HIDE },
    { d: ellipsoid([0, 0.14, 0.06], [0.26, 0.14, 0.18]), bone: 0, k: 0.1, color: DARK }, // the brow he glowers under
    { d: ellipsoid([0, -0.25, 0.5], [0.19, 0.14, 0.14]), bone: 0, k: 0.07, color: MUZZLE },
    ...[-1, 1].flatMap((sx): Prim[] => [
      // horns: out, then up. Short, because he has never needed them.
      { d: roundCone([sx * 0.2, 0.16, 0.02], [sx * 0.44, 0.2, 0.04], 0.07, 0.05), bone: 0, k: 0.03, color: HORN },
      { d: roundCone([sx * 0.44, 0.2, 0.04], [sx * 0.53, 0.4, 0.1], 0.05, 0.012), bone: 0, k: 0.03, color: HORN },
      { d: ellipsoid([sx * 0.33, 0.0, -0.02], [0.13, 0.045, 0.075], [0, 0, sx * -0.3]), bone: 0, k: 0.03, color: DARK },
    ]),
    // a tuft between the horns
    { d: sphere([0, 0.25, 0.04], 0.09), bone: 0, k: 0.06, color: DARK },
  ];
  const headGeo = buildSkin(head, {
    min: [-0.66, -0.5, -0.36],
    max: [0.66, 0.52, 0.74],
    step: 0.018,
    colors: true,
  });
  return { body: bodyGeo, head: headGeo };
}
