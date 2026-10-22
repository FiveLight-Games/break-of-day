// Survival over the mocked Supabase relay: host + guest; the run starts, both get level-up cards and the game pauses, bullets reach the guest, a downed player is revived
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/tmp/kn-shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = q.url.includes('knights') ? 'knights.html' : 'index.html'; r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(ROOT, f))); }).listen(8782);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [], pages = new Set();
  async function mk(tag, vp) { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.route('**/supabase-js@*/**', r => r.fulfill({ body: fs.readFileSync(ROOT + '/tests/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); await p.goto('http://localhost:8782/knights.html?mode=run'); await sleep(300); return p; }
  const A = await mk('A', { width: 1000, height: 600 }), B = await mk('B', { width: 1000, height: 600 });
  await A.click('#lHost'); await sleep(300); const code = await A.evaluate(() => document.querySelector('.code').textContent);
  await B.evaluate(c => window.__join(c), code); await sleep(1500);
  await A.keyboard.down('d'); await B.keyboard.down('a'); await sleep(1200); await A.keyboard.up('d'); await B.keyboard.up('a'); await sleep(2500);
  const st = p => p.evaluate(() => { const B2 = __bh.BH, me = window.__KN()[window.__NETS().me]; return JSON.stringify({ on: B2.on, go: B2.go, t: B2.t | 0, lvl: B2.lvl, pause: B2.pause, hp: me.rHp, pk: me.rPk, ups: (me.ups || []).join(','), cards: document.getElementById('bhCards').style.display, bul: __bh.BUL.length, walk: document.getElementById('stats').textContent.slice(0, 40) }); });
  console.log('A', await st(A)); console.log('B', await st(B));
  // force a level-up on the host
  await A.evaluate(() => { __bh.BH.xp = __bh.BH.need + 1; }); await sleep(800);
  console.log('lvl A', await st(A)); console.log('lvl B', await st(B));
  await A.keyboard.press('1'); await sleep(600); console.log('A picked', await st(A)); console.log('B', await st(B));
  await B.keyboard.press('2'); await sleep(1200); console.log('B picked A', await st(A)); console.log('B', await st(B));
  // a volley at the guest
  await A.evaluate(() => { const g = window.__KN()[1]; for (let i = 0; i < 3; i++) setTimeout(() => window.__bhFire && window.__bhFire(g.x + 40, g.y - 5, Math.PI, 5, 0.4, 80, 9, 1) || window.__bhFire(g.x, g.y - 120, -1.5, 4, 0.4, 30, 9, 2), i * 300); });
  await B.evaluate(() => { window.__vol = 0; const o = window.__bhVolleyHook; }); await sleep(1500); console.log('bullets A/B', await A.evaluate(() => __bh.BUL.length), await B.evaluate(() => __bh.BUL.length), 'B hp', await B.evaluate(() => window.__KN()[1].rHp));
  // down the guest, then walk the host over to revive
  await A.evaluate(() => { const g = window.__KN()[1]; g.rHp = 0; g.rDn = 1; const h = window.__KN()[0]; h.x = g.x + 5; h.y = g.y; });
  await sleep(3500); console.log('revived?', await A.evaluate(() => { const g = window.__KN()[1]; return [g.rDn, Math.round(g.rHp)]; }));
  console.log('B ups/classes', await B.evaluate(() => [window.__KN()[1].ups.join(','), document.body.className]));
  await A.screenshot({ path: OUT + '/sv-host.png' }); await B.screenshot({ path: OUT + '/sv-guest.png' });
  console.log(errs.length ? errs.slice(0, 6) : 'no errors'); await b.close(); srv.close(); })();
