// usage: node scripts/playtest/run.mjs <jsfile> [--reload]
// Connects to the hidden browser on :9333 (see README.md). The file is split on lines
// "//SHOT name"; each part runs in the page, then a screenshot is saved as name.png.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const file = process.argv[2];
const reload = process.argv.includes("--reload");
const outDir = process.env.SHOTS || path.join(os.tmpdir(), "cow-shots");
fs.mkdirSync(outDir, { recursive: true });
const NOLOCK = `(()=>{const no=()=>Promise.resolve();try{Element.prototype.requestPointerLock=no;Element.prototype.requestFullscreen=no;}catch(e){}})()`;
const br = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = br.contexts()[0];
let page = ctx.pages().find((p) => p.url().includes("localhost:3000"));
if (!page) { page = await ctx.newPage(); await page.setViewportSize({ width: 1280, height: 720 }); }
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 400)); });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 400)));
await page.addInitScript(NOLOCK);
await page.evaluate(NOLOCK).catch(()=>{});
if (reload || !page.url().includes("localhost:3000")) {
  await page.goto("http://localhost:3000", { waitUntil: "load" });
  await page.evaluate(NOLOCK);
  await page.waitForFunction(() => window.__cowScene, null, { timeout: 90000 });
  await page.waitForTimeout(5000);
}
const src = fs.readFileSync(file, "utf8");
const parts = src.split(/^\/\/SHOT\s+(\S+).*$/m);
for (let i = 0; i < parts.length; i += 2) {
  const code = parts[i].trim();
  if (code) {
    const r = await page.evaluate(`(async()=>{${code}\n})()`);
    if (r !== undefined) console.log(JSON.stringify(r));
  }
  const name = parts[i + 1];
  if (name) await page.screenshot({ path: path.join(outDir, name + ".png") });
}
const snaps = await page.evaluate(() => { const s = window.__snaps || {}; window.__snaps = {}; return s; });
for (const [name, url] of Object.entries(snaps)) {
  if (!url.startsWith("data:")) { console.log("[snap failed]", name, url); continue; }
  fs.writeFileSync(path.join(outDir, name + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
}
console.log("shots in", outDir);
await br.close();
