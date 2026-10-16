// four players over the mocked Supabase relay: host + 2 join, horde on MAX, a 4th joins mid-game, a 5th is turned away, one leaves
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/tmp/kn4-shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = q.url.includes('knights') ? 'knights.html' : 'index.html'; r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(ROOT, f))); }).listen(8782);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [], pages = new Set(); let maxSnap = 0;
  async function mk(tag, vp, ch) { const ctx = await b.newContext({ viewport: vp, hasTouch: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    await p.route('**/supabase-js@*/**', r => r.fulfill({ body: fs.readFileSync(ROOT + '/tests/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.exposeFunction('__relayOut', msg => { if (msg && msg.event === 's') maxSnap = Math.max(maxSnap, JSON.stringify(msg).length); for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); await p.goto('http://localhost:8782/knights.html'); await sleep(300); if (ch) await p.click(ch); return p; }
  const A = await mk('A', { width: 844, height: 390 }), Bp = await mk('B', { width: 412, height: 820 }, '#cFire'), C = await mk('C', { width: 412, height: 820 });
  await A.click('#lHost'); await sleep(300); const code = await A.evaluate(() => document.querySelector('.code').textContent);
  const join = async p => { await p.fill('#lCode', code); await p.click('#lJoin'); await sleep(1500); };
  await join(Bp); await join(C);
  const st = p => p.evaluate(() => document.getElementById('stats').textContent);
  console.log('3 in:', await st(A));
  // everyone walks right a bit, then MAX horde
  for (const p of [A, Bp, C]) await p.keyboard.down('d'); await sleep(2500); for (const p of [A, Bp, C]) await p.keyboard.up('d');
  await A.evaluate(() => { window.__snapStat = 1; }); await A.click('#hordeBtn'); await A.click('[data-r="max"]'); await A.click('#hordeBtn'); await sleep(6000);
  const D = await mk('D', { width: 844, height: 390 }); await join(D);
  console.log('4 in (late):', await st(A)); console.log('D sees:', await st(D));
  console.log('D seat/knight:', await D.evaluate(() => { const K = window.__KN(); return { n: K.length, on: K.map(k => k.on), me: K.findIndex(k => k === window.__K()) }; }));
  const E = await mk('E', { width: 412, height: 820 }); await E.fill('#lCode', code); await E.click('#lJoin'); await sleep(2000);
  console.log('E (5th):', await E.evaluate(() => (document.querySelector('#lobbyUI .err') || {}).textContent || getComputedStyle(document.getElementById('lobbyUI')).display));
  await sleep(4000);
  // frame time on the host with MAX running
  console.log('host walkers', await A.evaluate(() => window.__W().length), 'ms/step+draw', await A.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 30; i++) { window.__step(1 / 60); window.__draw(); } return ((performance.now() - t0) / 30).toFixed(1); }));
  await A.screenshot({ path: OUT + '/host.png' }); await D.screenshot({ path: OUT + '/late.png' }); await Bp.screenshot({ path: OUT + '/fire.png' });
  await C.evaluate(() => window.__leave()); await sleep(1500);
  console.log('after C left:', await st(A), '| on:', await A.evaluate(() => window.__KN().map(k => k.on)));
  console.log('max snapshot bytes', await A.evaluate(() => window.__snapB));
  console.log(errs.slice(0, 5).join('\n') || 'no errors'); await b.close(); srv.close();
})();
