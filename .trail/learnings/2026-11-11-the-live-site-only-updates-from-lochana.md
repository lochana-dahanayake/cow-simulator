---
title: "The live site only updates from main, and the to-do list is meant to be on screen"
author: Lochana
date: 2026-11-11
branch: farm-pass
cost: { minutes: 36, tokens: 262139 }
id: l-7479eb5d
scope: repo
status: active
src: agent
touches:
  - components/Environment.tsx
  - lib/goals.ts
  - lib/store.ts
  - scripts/playtest/README.md
  - scripts/playtest/lib.js
  - scripts/playtest/run.mjs
  - lib/cowState.ts
  - components/Cow.tsx
  - components/Grass.tsx
---

## Decided
The live site (Vercel) builds from main. Work left on a branch looks lost to the owner: weeks of changes, including the dances, sat on farm-pass and never showed up live. Fast-forward main and push to release.
The to-do list, the tick pop-up and the finale card stay on screen. They were removed when the corner menu was added, which left the game with no visible goals and no ending; the owner asked for them back.

## Tried and ruled out
Page screenshots for judging a reaction: they take one to two seconds and miss the moment. Grab the 3D canvas directly at the exact time instead.

## Watch out
A prompt that reaches further than the animation does looks like a bug: the cow ate from a metre and a half away and the tuft vanished on the key press, so it chewed bare earth. Move the actor to the thing, and remove the thing when the mouth gets there.
One reaction reused on several targets must tick the goal for the target, not for the reaction: mooing at the bull used to tick the scarecrow goal.
git here needs -c safe.directory=* (the drive's owner differs from the Windows user).

In the code:
- components/Progress.tsx, lib/store.ts (toast, listOpen, finale, complete)
- lib/cowState.ts (aim), components/Cow.tsx (GRAZE_REACH), components/Grass.tsx (BITE_START, BITE_END)
- scripts/playtest/lib.js (snap), scripts/playtest/run.mjs
