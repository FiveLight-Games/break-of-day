// Renders all five heroes side by side (real WebGL) for model review: node tests/heroes-shot.js out.png
const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const out = process.argv[2]; const srv = http.createServer((q, r) => { r.end(fs.readFileSync(path.join(__dirname, '..', 'index.html'))); }).listen(8890);
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 420 }, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'three.min.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/supabase-js@2', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'supabase-mock.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8890/'); await p.evaluate(() => localStorage.setItem('bod_name', 'T')); await p.reload(); await p.click('[data-act=solo]'); await p.click('#btnReady');
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!window.BOD.G.cur)); i++) await p.waitForTimeout(500);
  await p.evaluate(() => { const S = window.BOD.G.sim, h0 = S.heroes[0]; const ids = DW.HERO_IDS; const F = DW.MAP.fountain;
    ids.forEach((hid, i) => { let h = i === 0 ? h0 : S.mk('hero', 0, 0, 0, { hp: 500, r: 0.9, v: 'h_' + hid }); h.v = 'h_' + hid; h.x = [0, -4.2, 4.2, -8.4, 8.4][i]; h.z = F.z - 26; h.face = Math.PI / 2; if (i) { h.kind = 'decor'; h.untarget = 1; } });
    h0.dir = null; window.__noMove = 1; });
  await p.evaluate(() => { document.querySelectorAll('.hud').forEach(e => e.style.display = 'none'); }); await p.waitForTimeout(3500); await p.screenshot({ path: out }); console.log('errors', errs.join(' | ') || 'none'); await b.close(); srv.close(); })();
