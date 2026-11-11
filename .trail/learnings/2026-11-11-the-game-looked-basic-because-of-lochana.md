---
title: "The game looked basic because of the world, not the cow; and how to look at it without a human"
author: Lochana
date: 2026-11-11
cost: { minutes: 41, tokens: 479099 }
id: l-881c32f1
scope: repo
status: active
src: agent
touches:
  - lib/bullBody.ts
  - components/Farm.tsx
  - components/Scene.tsx
  - lib/world.ts
  - lib/store.ts
  - components/Environment.tsx
  - components/Outside.tsx
---

## Decided
The cow was already fine. What read as "just shapes" was the setting: a white sky, hills that poked up inside the field, dark-rooted grass that looked like thorns, and no edge to the world. Fixed with a painted sky dome and clouds, a stone wall as the world edge, and a farm beyond it. New jokes reuse existing reactions with a "target" rather than adding a reaction per object.
The cow's head and the camera are now solid as well as its body.

## Tried and ruled out
The physical sky model: at this sun angle it is a sheet of white, which is why everything looked overcast.
A minimum camera distance when blocked: it forced the camera inside the wall it was avoiding. It now comes right in and lifts.

## Watch out
Headless Edge DOES draw the 3D scene if launched with GPU flags; earlier notes saying it renders black are out of date. Mute it and block pointer lock first, or it plays sound and traps the real mouse.
Its animation frames are throttled to about one a second, so drive the frame loop from a timer to test at real speed.
Hills must start well outside the wall or their skirts come up through the field.

In the code:
- components/Farm.tsx, lib/bullBody.ts
- components/Scene.tsx (SkyDome, Clouds, CameraRig reach)
- lib/world.ts (resolveNose, cameraBlocked, BOXES, WALL_RADIUS)
- lib/store.ts (target, bullSeq, looSeq, shakeSeq)
- msedge --headless=new --use-angle=d3d11 --enable-gpu --mute-audio; setInterval(() => __cowScene.advance(performance.now(), true), 16)
