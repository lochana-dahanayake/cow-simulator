if (!__cowStore().started) { __cowStore().start(); await sleep(2500); }
window.out = {};
window.walk = async (ms, shift) => { if (shift) key("ShiftLeft"); key("KeyW"); await sleep(ms); key("KeyW", false); if (shift) key("ShiftLeft", false); };
// bull: approach from the pen side (south-east of paddock), heading toward it
const B = { x: -17.5, z: 16.2 };
await tp(-11.5, 13.2, Math.atan2(-11.5 - B.x, 13.2 - B.z), 0.2, 6.5, Math.atan2(B.x + 11.5, B.z - 13.2));
await walk(1200);
out.bull = [S().prompt, C()];
await tap("KeyE"); await sleep(1500);
//SHOT m_bull1
await sleep(1500);
//SHOT m_bull2
await sleep(2200);
//SHOT m_bull3
out.bullAfter = S();
// loo: door faces PORTALOO.face; stand in front of it
const L = { x: 23.4, z: 6.4, f: -Math.PI / 2 - 0.5 };
const lx = L.x + Math.sin(L.f) * 3.2, lz = L.z + Math.cos(L.f) * 3.2;
await tp(lx, lz, L.f, 0.2, 5.5, L.f + Math.PI);
await walk(900);
out.loo = [S().prompt, C()];
await tap("KeyE"); await sleep(1500);
//SHOT m_loo1
await sleep(2200);
await tap("KeyE"); await sleep(3600);
await tap("KeyE"); await sleep(1250);
//SHOT m_loo3
await sleep(700);
//SHOT m_loo4
await sleep(2500);
out.looAfter = [S(), __cowStore().looSeq];
await tap("KeyE"); await sleep(600);
out.looFree = S().say;
//SHOT m_loo5
return out;
