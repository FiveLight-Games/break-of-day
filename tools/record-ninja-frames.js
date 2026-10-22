// Renders the ninja's leap and kama frame by frame (60 fps) for the i-frame picker. Needs python3 -m http.server 8765 in the repo.
// node tools/record-ninja-frames.js <out.json>
const { chromium } = require('playwright'), fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 800 } }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/knights.html?mode=box'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kn_char', 'ninja'); }); await p.reload(); await p.waitForTimeout(500);
  await p.click('#lSolo'); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__still = 1; const K = window.__KN()[0]; K.in.mv = [1, 0]; for (let i = 0; i < 30; i++) window.__step(1 / 60); K.in.mv = [0, 0]; for (let i = 0; i < 200; i++) window.__step(1 / 60); });
  // grab: crop round the ninja (and his height) from the drawn canvas
  await p.evaluate(() => { window.__grab = () => { window.__draw(); const K = window.__KN()[0], cv = document.querySelector('canvas'), sc = window.__cam()[2], [sx, sy] = window.__w2s(K.x, K.y - 8 - (K.z || 0) * 0.5), r = cv.getBoundingClientRect(), kx = cv.width / r.width, S = 64 * sc * kx, o = document.createElement('canvas'); o.width = o.height = 220;
    o.getContext('2d').drawImage(cv, (sx - r.left) * kx - S / 2, (sy - r.top) * kx - S / 2, S, S, 0, 0, 220, 220); return o.toDataURL('image/jpeg', 0.72); }; });
  const run = (setup, n, tag) => p.evaluate(([setup, n, tag]) => { const K = window.__KN()[0]; new Function('K', setup)(K); const out = [];
    for (let i = 0; i < n; i++) { window.__step(1 / 60); out.push({ img: window.__grab(), nl: K.nl, km: K.km, z: +(K.z || 0).toFixed(1) }); } return out; }, [setup, n, tag]);
  const leap = await run("K.in.leapT = [1, 0]; K.in.leapN = (K.in.leapN || 0) + 1;", 80);
  await p.evaluate(() => { const K = window.__KN()[0]; K.in.leapT = null; for (let i = 0; i < 300; i++) window.__step(1 / 60); window.__spawnK(1, 'foot'); const w = window.__W()[window.__W().length - 1]; w.x = K.x + 85; w.y = K.y; w.hp = w.max = 99999; w.sp = 0.01; });
  const kama = await run("window.__kamas([1, 0]);", 130);
  const tl = await p.evaluate(() => { const K = window.__KN()[0], L = njKmTL(K); return { tT: L.tT, tH: L.tH, tS: L.tS, tE: L.tE, tRip: L.tRip, LT: NJ.KM.LT, REC: NJ.KM.REC }; }).catch(() => null);
  const LT = await p.evaluate(() => typeof njLT === 'function' ? njLT(window.__KN()[0]) : 0.95).catch(() => 0.95);
  const cut = (fr, key) => { let last = 0; fr.forEach((f, i) => { if (f[key] >= 0) last = i; }); return fr.slice(0, Math.min(fr.length, last + 10)); };
  fs.writeFileSync(process.argv[2], JSON.stringify({ leap: { frames: cut(leap, 'nl').map(f => f.img), info: { LT } }, kama: { frames: cut(kama, 'km').map(f => f.img), info: tl } }));
  console.log('leap', cut(leap, 'nl').length, 'kama', cut(kama, 'km').length, JSON.stringify(tl), LT); await b.close(); })();
