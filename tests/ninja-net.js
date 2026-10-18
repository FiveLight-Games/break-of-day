// host Knight + guest Ninja over the mocked relay: the guest leaps (3 charges), then ults: slow motion reaches both screens, the guest's
// dragged joints reach the host, the strike kills on the host and the game speed comes back
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const srv = http.createServer((q, r) => { const f = q.url.includes('knights') ? 'knights.html' : 'index.html'; r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(ROOT, f))); }).listen(8782);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [], pages = new Set();
  async function mk(tag, vp, ch) { const ctx = await b.newContext({ viewport: vp, hasTouch: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    await p.route('**/supabase-js@*/**', r => r.fulfill({ body: fs.readFileSync(ROOT + '/tests/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); await p.goto('http://localhost:8782/knights.html'); await sleep(300); if (ch) { await p.click('#lChars'); await p.click(`[data-ch=${ch}]`); await p.click('#lBack'); } return p; }
  const A = await mk('A', { width: 844, height: 390 }), B = await mk('B', { width: 844, height: 390 }, 'ninja');
  await A.click('#lHost'); await sleep(300); const code = await A.evaluate(() => document.querySelector('.code').textContent);
  await B.evaluate(c => window.__join(c), code); await sleep(1500);
  await A.evaluate(() => window.__horde('dozens')); await B.evaluate(() => { window.__KN()[window.__NETS().me].in.mv = [1, 0]; }); await sleep(400); await B.evaluate(() => { window.__KN()[window.__NETS().me].in.mv = [0, 0]; }); await sleep(2500);
  const g = async (p, i) => p.evaluate(i => { const K = window.__KN()[i]; return K ? { kind: K.kind, nQ: K.nQ, nl: K.nl, nPh: K.nPh, x: Math.round(K.x), kills: K.kills } : null; }, i);
  await B.evaluate(() => window.__leap([1, 0])); await sleep(450); console.log('mid-leap host sees', JSON.stringify(await g(A, 1)), 'guest', JSON.stringify(await g(B, 1)));
  await sleep(900); console.log('after leap host', JSON.stringify(await g(A, 1)));
  await A.evaluate(() => { const K = window.__KN()[1]; K.kills = 5000; }); await sleep(600);
  await B.evaluate(() => window.__ult()); await sleep(500);
  console.log('ult: host speed', await A.evaluate(() => document.getElementById('slow').textContent), 'guest', await B.evaluate(() => document.getElementById('slow').textContent), 'host nPh', (await g(A, 1)).nPh);
  // the guest drags joint 3 straight up
  await B.evaluate(() => { const ME = window.__NETS().me, K = window.__KN()[ME]; const J = K.njJ; const c = window.__cam(), cv = document.querySelector('canvas'), r = cv.getBoundingClientRect(), k = c[2] * r.width / cv.width; const sx = r.left + r.width / 2 + (J[4] - c[0]) * k, sy = r.top + r.height / 2 + (J[5] - c[1]) * k;
    const ev = (t, y) => window.dispatchEvent(new PointerEvent(t, { pointerId: 9, clientX: sx, clientY: y, bubbles: true })); cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: sx, clientY: sy, bubbles: true })); for (let i = 1; i <= 5; i++) ev('pointermove', sy - i * 18); ev('pointerup', sy - 90); });
  await sleep(700); console.log('joints guest', JSON.stringify(await B.evaluate(() => window.__KN()[window.__NETS().me].njJ)), 'host', JSON.stringify(await A.evaluate(() => window.__KN()[1].njJ)));
  await sleep(4000); console.log('after ult host', JSON.stringify(await g(A, 1)), 'speed', await A.evaluate(() => document.getElementById('slow').textContent), await B.evaluate(() => document.getElementById('slow').textContent));
  console.log(errs.join('\n') || 'no errors'); await b.close(); srv.close();
})();
