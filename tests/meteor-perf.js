// volcano rock into a 200-enemy clump: average frame cost (step + draw, canvas flushed each frame) before, at and after the impact. node tests/meteor-perf.js (server on :8765)
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  await p.goto('http://localhost:8765/knights.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400); await p.click('#cFire'); await p.click('#lSolo'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { window.__stop(); const K = window.__KN()[0]; K.st = 'fight'; K.u = 1; const W = window.__W(); let s = 9; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) { window.__spawnK(1, ['foot', 'zombie', 'scout', 'ogre'][i % 4]); const w = W[W.length - 1]; w.x = K.x + 150 + Math.random() * 50; w.y = K.y + (Math.random() - 0.5) * 50; w.sp = 0; }
    window.__fillUlt(); K.in.ultN = (K.in.ultN || 0) + 1; const ST = []; const fr = n => { const a = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); window.__step(1 / 60); const t1 = performance.now(); window.__draw(); window.__flush(); a.push(performance.now() - t0); ST.push(t1 - t0); } return a; };
    const pre = fr(150); K.in.vtN = (K.in.vtN || 0) + 1; K.in.vtP = [K.x + 175, K.y]; const post = fr(420); const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), mx = a => Math.max(...a).toFixed(0);
    return { pre: avg(pre.slice(30)), preMax: mx(pre.slice(30)), impact: avg(post.slice(45, 105)), impactMax: mx(post.slice(45, 105)), after: avg(post.slice(105, 240)), later: avg(post.slice(240)), arr: window.__arr(), stepAfter: avg(ST.slice(255)), stepImpact: avg(ST.slice(195, 255)) }; });
  console.log(JSON.stringify(r)); await b.close(); })();
