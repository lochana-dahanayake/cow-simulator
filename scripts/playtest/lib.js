try{Element.prototype.requestPointerLock=()=>Promise.resolve();Element.prototype.requestFullscreen=()=>Promise.resolve();if(document.pointerLockElement)document.exitPointerLock();}catch(e){}
window.sleep = (ms) => new Promise(r => setTimeout(r, ms));
window.tp = async (x, z, yaw, pitch = 0.3, dist = 6, facing) => {
  const c = __cow.cowState ?? __cow, m = window.__cam;
  c.x = x; c.z = z; c.outside = Math.hypot(x, z) > 7; c.speed = 0;
  if (facing !== undefined) c.facing = facing;
  m.yaw = yaw; m.pitch = pitch; m.dist = dist;
  await sleep(600);
};
window.key = (code, down = true) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, key: code, bubbles: true }));
window.tap = async (code) => { key(code); await sleep(60); key(code, false); };
window.S = () => { const s = __cowStore(); return { gag: s.activeGag, prompt: s.prompt && s.prompt.label, say: s.dialogue, gate: s.gateOpen, eaten: s.grassEatenAt.map(v => v ? 1 : 0).join(""), slap: s.slapCount, cut: s.inCutscene }; };
window.C = () => { const c = __cow.cowState ?? __cow; return [+(c.x).toFixed(2), +(c.z).toFixed(2), +(c.facing).toFixed(2), +(c.speed).toFixed(2)]; };
if (!window.__pump) window.__pump = setInterval(() => { try { __cowScene.advance(performance.now(), true); } catch (e) {} }, 16);
