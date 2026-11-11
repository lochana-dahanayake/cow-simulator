---
title: "The cow looked like balls on a tube because the torso was blended ellipsoids; fixed by remodelling, not by slimming"
author: Lochana
date: 2026-11-08
cost: { minutes: 19, tokens: 245669 }
id: l-341da9ea
scope: repo
status: active
src: agent
touches:
  - lib/cowBody.ts
  - components/Cow.tsx
---

## Decided
The torso is now three tapered sections along a spine, with the shoulder and haunch running down into the limbs. A standing cow reads as one animal.

## Tried and ruled out
Squeezing the torso, belly and neck in the skin shader as the cow stands. Strong values gave a tube; light values did not fix the look. The problem was the shape, not the thickness.
Compensating the tail's pose for the dance. The dance drives the body directly, so the tail is instead set to hang down in world space after the dance pose is applied.

## Watch out
Judge body-shape changes from a side-on screenshot in a real browser. Headless Edge draws the 3D scene black, and numeric tweaks made without looking overshot twice.
In dev, window.__cow and window.__cam expose the cow state and camera for framing a shot. Setting the camera every frame can blank the canvas during the stand-up transition.

In the code:
- lib/cowBody.ts (bodyPrims, coatSlim)
- components/Cow.tsx (hangTail)
