# Play-testing without a human

Drives the real game in a hidden Edge window and saves screenshots. Used to
check how things look and that interactions fire, since nothing else can see
the 3D scene.

## Start

1. `npm run dev` (game on http://localhost:3000).
2. Launch the hidden browser, in the background. **Keep `--mute-audio`**:
   without it the game's sound plays through the speakers.

   ```
   "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --mute-audio \
     --remote-debugging-port=9333 --use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu \
     --window-size=1280,720 --user-data-dir=<a temp folder> --no-first-run about:blank
   ```
3. Write a test file: `cat scripts/playtest/lib.js my-test.js > t.js`, then
   `node scripts/playtest/run.mjs t.js --reload`. Screenshots land in
   `%TEMP%/cow-shots` (or `$SHOTS`).

## Rules that cost time to learn

- **The game takes the mouse on the first key press.** `run.mjs` and `lib.js`
  stub `requestPointerLock` so the hidden browser cannot capture the real
  cursor. Never remove that.
- **Killing a browser that holds the mouse leaves the cursor boxed in.** Run
  `unclip.ps1` after stopping the browser; it reports and releases it.
- **Animation frames run at about one a second in the hidden browser.**
  `lib.js` pumps the game loop from a timer so it plays at real speed.
- Variables do not survive a `//SHOT` line: each part is a separate
  evaluation. Keep state on `window`.
- Movement follows the camera: forward is `(-sin yaw, -cos yaw)`.

`lib.js` gives you `tp(x, z, yaw, pitch, dist, facing)`, `key`, `tap`,
`sleep`, `S()` (store summary) and `C()` (cow position). See
`example-bull-and-loo.js`.
