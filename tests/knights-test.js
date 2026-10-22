// two players over the mocked Supabase relay: host + join by code, both knights move, enemies spawn, kills sync
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/tmp/kn-shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = q.url.includes('knights') ? 'knights.html' : 'index.html'; r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(ROOT, f))); }).listen(8781);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [], pages = new Set();
  async function mk(tag, vp) { const ctx = await b.newContext({ viewport: vp, hasTouch: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ': ' + e.message + ' ' + (e.stack || '').split('\n').slice(1,6).join(' | ')));
    await p.route('**/supabase-js@*/**', r => r.fulfill({ body: fs.readFileSync(ROOT + '/tests/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); await p.goto('http://localhost:8781/knights.html?mode=box'); await sleep(300); return p; }
  const A = await mk('A', { width: 844, height: 390 }), B = await mk('B', { width: 412, height: 820 });
  await A.screenshot({ path: OUT + '/0-lobby.png' });
  await A.click('#lHost'); await sleep(300); const code = await A.evaluate(() => document.querySelector('.code').textContent);
  await B.evaluate(c => window.__join(c), code); await sleep(1500);
  console.log('code', code, 'A lobby hidden', await A.evaluate(() => getComputedStyle(document.getElementById('lobbyUI')).display), 'B', await B.evaluate(() => getComputedStyle(document.getElementById('lobbyUI')).display));
  // both move: A right, B left (B through its joystick input object)
  await A.evaluate(() => { __IN0 = null; }).catch(() => { });
  await A.keyboard.down('d'); await sleep(1500); await A.keyboard.up('d');
  await B.evaluate(() => { const ev = (t, x, y) => document.getElementById('lst').dispatchEvent(new PointerEvent(t, { pointerId: 3, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); const r = document.getElementById('lst').getBoundingClientRect(); document.getElementById('lst').setPointerCapture = () => { }; ev('pointerdown', r.left + r.width / 2, r.top + r.height / 2); ev('pointermove', r.left + r.width / 2 - 50, r.top + r.height / 2); window.__up = () => ev('pointerup', 0, 0); });
  await sleep(1500); await B.evaluate(() => window.__up());
  await sleep(500);
  await B.click('#hordeBtn'); await B.click('[data-kk="ogre"]'); await B.click('[data-n="4"]'); await A.click('#hordeBtn'); await A.click('[data-kk="warg"]'); await A.click('[data-n="10"]'); await A.click('[data-r="few"]');
  await sleep(2500);
  await A.screenshot({ path: OUT + '/1-host.png' }); await B.screenshot({ path: OUT + '/1-guest.png' });
  const st = async p => p.evaluate(() => document.getElementById('stats').textContent);
  console.log('A:', await st(A)); console.log('B:', await st(B));
  // A spins, B swings repeatedly
  await A.keyboard.down(' '); await sleep(300); await A.keyboard.up(' ');
  await B.evaluate(() => { const el = document.getElementById('rst'), r = el.getBoundingClientRect(); el.setPointerCapture = () => { }; const ev = (t, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: 4, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); ev('pointerdown', r.left + 50, r.top + 50); window.__aimAt = () => { const K = window.__KN()[1], W = window.__W().filter(w => w.hp > 0); if (!W.length) return; const n = W.reduce((a, b) => Math.hypot(a.x - K.x, a.y - K.y) < Math.hypot(b.x - K.x, b.y - K.y) ? a : b), dx = n.x - K.x, dy = n.y - K.y, d = Math.hypot(dx, dy) || 1; ev('pointermove', r.left + 50 + dx / d * 40, r.top + 50 + dy / d * 40); }; window.__aimAt(); window.__aimT = setInterval(window.__aimAt, 300); window.__up2 = () => ev('pointerup', 0, 0); });
  await sleep(1200); await A.screenshot({ path: OUT + '/2-host.png' }); await B.screenshot({ path: OUT + '/2-guest.png' });
  await sleep(4000); await B.evaluate(() => { clearInterval(window.__aimT); window.__up2(); });
  console.log('A:', await st(A)); console.log('B:', await st(B));
  console.log('guest knight on host: swings', await A.evaluate(() => window.__KN()[1].swN), 'st', await A.evaluate(() => window.__KN()[1].st));
  await B.click('#slow'); await sleep(600); console.log('slow on A/B:', await A.evaluate(() => document.getElementById('slow').textContent), await B.evaluate(() => document.getElementById('slow').textContent));
  console.log(errs.join('\n') || 'no errors'); await b.close(); srv.close();
})();
