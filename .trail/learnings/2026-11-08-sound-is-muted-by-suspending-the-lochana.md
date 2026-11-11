---
title: "Sound is muted by suspending the audio context, not by gating each effect"
author: Lochana
date: 2026-11-08
cost: { minutes: 4, tokens: 87825 }
id: l-8ad41dc2
scope: repo
status: active
src: agent
touches:
  - app/globals.css
  - components/MenuCluster.tsx
  - lib/audio.ts
---

## Decided
Mute suspends the shared AudioContext, so every synthesized effect and the music go silent at once. The choice is remembered in localStorage. The corner menu (mute, controls card, patience meter, fullscreen) is one component rather than separate floating buttons.

## Tried and ruled out
Gating each effect: about 30 call sites connect straight to the context destination.
A pause menu: it would need the 3D frame loop frozen. That could not be verified because headless Edge renders the scene black here.

## Watch out
Source files here use CRLF line endings. Scripted edits must normalise them or exact-match replacements silently miss.
Do not call ensureAudio() expecting sound while muted; it deliberately will not resume the context.

In the code:
- lib/audio.ts (setMuted, ensureAudio)
- components/MenuCluster.tsx
