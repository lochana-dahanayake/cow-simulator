// Lists the dances in public/dances/ for the game to find, so adding a dance is
// just dropping a Mixamo FBX in that folder. Runs before `dev` and `build`.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "public", "dances");
const names = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".fbx")).map((f) => f.slice(0, -4)).sort()
  : [];
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(names, null, 2) + "\n");
console.log(`dances: ${names.length ? names.join(", ") : "(none)"}`);
