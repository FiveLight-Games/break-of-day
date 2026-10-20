// Bake a Pose Bench animation (Copy animation text) into one rig per frame for the game.
// node tools/bake-clip.js src/anims/storm-hook-right.json src/anims/storm-hook-right.baked.json   (needs the 8765 server)
const { chromium } = require('playwright'), fs = require('fs');
(async () => { const [inp, out] = process.argv.slice(2); const txt = fs.readFileSync(inp, 'utf8');
  const b = await chromium.launch(), p = await b.newPage(); await p.goto('http://localhost:8765/anim.html'); await p.waitForTimeout(600);
  await p.fill('#io', txt); await p.click('#bLoad'); await p.waitForTimeout(200);
  const fr = await p.evaluate(() => window.__benchBake());
  const r = v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(r) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r(x)])) : v;
  fs.writeFileSync(out, JSON.stringify({ name: JSON.parse(txt).name, fps: 60, frames: fr.map(r) })); console.log(out, fr.length, 'frames'); await b.close(); })();
