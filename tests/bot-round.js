// Knight Brawl bot round (solo, horde hundreds, bot uses every ability): node tests/bot-round.js knight|fire|priest [seconds] [rate]; needs a server on :8765
const { chromium } = require('playwright');
(async () => {
  const kind = process.argv[2], SECS = +process.argv[3] || 300;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/knights.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  await p.click('#lChars'); await p.click(`[data-ch=${kind}]`); await p.click('#lBack'); await p.click('#lSolo'); await p.waitForTimeout(400);
  await p.evaluate(RATE => { window.__stop(); window.__horde(RATE); }, process.argv[4] || 'hundreds');
  await p.evaluate(() => {
    const S = window.__BS = { uses: {}, t: 0 }; const use = k => S.uses[k] = (S.uses[k] || 0) + 1;
    const near = (K, W, R) => W.filter(w => w.hp > 0 && Math.hypot(w.x - K.x, (w.y - K.y) * 1.3) < R);
    // densest spot: try up to 40 enemies as centres and count neighbours within r
    const dense = (K, W, r, maxD) => { let best = null, bn = 0; const C = W.filter(w => w.hp > 0 && Math.hypot(w.x - K.x, w.y - K.y) < maxD); for (let i = 0; i < Math.min(40, C.length); i++) { const c = C[Math.floor(Math.random() * C.length)]; let n = 0, sx = 0, sy = 0; for (const w of C) if (Math.hypot(w.x - c.x, (w.y - c.y) * 1.3) < r) { n++; sx += w.x; sy += w.y; } if (n > bn) { bn = n; best = [sx / n, sy / n]; } } return best ? { p: best, n: bn } : null; };
    window.__botStep = () => {
      const K = window.__KN()[0], IN = K.in, W = window.__W(), live = W.filter(w => w.hp > 0);
      if (K.st === 'kneel') { IN.aim = [1, 0]; return; }
      let nn = null, nd = 1e9; for (const w of live) { const d = Math.hypot(w.x - K.x, (w.y - K.y) * 1.3); if (d < nd) { nd = d; nn = w; } }
      IN.mv = [0, 0]; IN.aim = null; IN.spin = false; IN.pl = null; IN.br = null;
      if (!nn) { IN.mv = [1, 0]; return; }
      const dir = (x, y) => { const dx = x - K.x, dy = y - K.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
      if (K.kind === 'priest') {
        const hn = (R, x, y) => W.filter(w => w.hp > 0 && Math.hypot(w.x - x, (w.y - y) * 1.25) < R).length;
        if (!(K.pPh >= 0) && K.kills - (K.ultBase || 0) >= 450 && !K.ab) { IN.ultN = (IN.ultN || 0) + 1; use('penance'); }
        IN.pn = null;
        if (K.pPh >= 0) { const c = dense({ x: K.hx, y: K.hy }, W, 30, 160); if (c) { const dx = c.p[0] - K.hx, dy = c.p[1] - K.hy, d = Math.hypot(dx, dy) || 1; IN.pn = [dx / d, dy / d]; const sp = Math.hypot(K.hvx, K.hvy); if (d < 14 && sp > 50 && !(K.smCd > 0)) { IN.smN = (IN.smN || 0) + 1; use('smash'); } } return; }
        if (!(K.hoT > 0) && !(K.hoCd > 0) && hn(18, K.hx, K.hy) >= 6) { IN.lvN = (IN.lvN || 0) + 1; use('holy'); }
        const c = dense(K, W, 26, 80);
        if (K.hOut > 0 && !K.ab && Math.hypot(K.hx - K.x, K.hy - K.y) > 50 && near(K, W, 20).length < 3) { window.__leap([0, 0]); use('reel'); }
        else if (c && c.n >= 6 && !(K.slCd > 0) && !K.ab && !(K.hOut > 0)) { let v = [(c.p[0] - K.x) / 80, (c.p[1] - K.y) / 64]; const m = Math.hypot(...v); if (m > 1) v = v.map(q => q / m); window.__leap(v); use('slam'); }
        else if (!(K.swCd > 0) && !K.ab && near(K, W, 42).length >= 4) { const c2 = dense(K, W, 16, 42); if (c2) { window.__dash(dir(c2.p[0], c2.p[1])); use('sweep'); } }
        if (nd < 26) IN.aim = dir(nn.x, nn.y); if (nd > 18) IN.mv = dir(nn.x, nn.y);
      } else if (K.kind !== 'fire') {
        if (!(K.ultPh >= 0) && K.kills - (K.ultBase || 0) >= 450) { window.__ult(); use('ult'); }
        const c = dense(K, W, 26, 80);
        // leap onto the densest group
        if (c && c.n >= 6 && !(K.leapCd > 0) && !K.ab && (K.ultPh < 0 || (K.ultPh === 1 && !K.ultLeapt))) { const LR = K.ultPh === 1 ? 78 * 2.25 : 78; let v = [(c.p[0] - K.x) / LR, (c.p[1] - K.y) / (LR * 0.8)]; const m = Math.hypot(...v); if (m > 1) v = v.map(q => q / m); window.__leap(v); use('leap'); }
        else if (K.ultPh < 0 && !(K.dashCd > 0) && !K.ab && nd > 16 && nd < 55) { window.__dash(dir(nn.x, nn.y)); use('dash'); }
        const close = near(K, W, 26).length;
        if (K.ultPh < 0 && close >= 5 && !(K.spinCd > 0) && K.spin < 0) { IN.spin = true; use('spin'); } else if (K.spin >= 0) IN.spin = true;
        if (nd < 22 * (K.sz || 1)) IN.aim = dir(nn.x, nn.y); else IN.mv = dir(nn.x, nn.y);
        if (nd < 30 * (K.sz || 1)) IN.aim = dir(nn.x, nn.y);
      } else {
        const ready = K.kills - (K.ultBase || 0) >= 300;
        if (!(K.vPh >= 0) && ready && !(K.plT >= 0) && !(K.coT >= 0)) { IN.ultN = (IN.ultN || 0) + 1; use('volcano'); }
        if ((K.vPh === 1 || (K.vPh === 0 && K.vT >= 0.5)) && !(K.vBel >= 0) && K.vSh < 5) { const c = dense(K, W, 38, 200); if (c) { IN.vtN = (IN.vtN || 0) + 1; IN.vtP = c.p; use('rock'); } }
        if (K.vPh >= 0) return;
        const c = dense(K, W, 28, 120);
        // coals down a line into the crowd
        if (c && c.n >= 8 && !(K.coCd > 0) && !(K.coT >= 0) && !(K.plT >= 0)) { const d = Math.hypot(c.p[0] - K.x, c.p[1] - K.y), m = Math.min(1, Math.max(0, (d - 40) / 75)); const u = dir(c.p[0], c.p[1]); IN.coN = (IN.coN || 0) + 1; IN.coV = [u[0] * Math.max(0.25, m), u[1] * Math.max(0.25, m)]; use('coals'); }
        // plume when swarmed
        const close = near(K, W, 30).length;
        if ((K.plT >= 0) || (close >= 10 && !(K.plCd > 0) && !(K.coT >= 0))) { const c2 = dense(K, W, 30, 60); const u = c2 ? dir(c2.p[0], c2.p[1]) : [1, 0]; IN.pl = [u[0] * 0.8, u[1] * 0.8]; if (!(K.plT >= 0)) use('plume'); return; }
        // lava when it's up and there's a crowd within reach
        if (!K.lava && !(K.lvCd > 0) && near(K, W, 110).length >= 10) { IN.lvN = (IN.lvN || 0) + 1; use('lava'); }
        const tgt = (c && Math.hypot(c.p[0] - K.x, c.p[1] - K.y) < 110) ? c.p : [nn.x, nn.y];
        if (nd < 100 && !K.brLock) IN.aim = dir(tgt[0], tgt[1]);
        if (nd > 45) IN.mv = dir(nn.x, nn.y);
      }
    };
    const prev = {}; let lk = 0; const watch = () => { const K = window.__KN()[0], U = S.real = S.real || {}; const dk = K.kills - lk; lk = K.kills; const ul = K.kind === 'fire' ? K.vPh >= 0 : K.kind === 'priest' ? K.pPh >= 0 : K.ultPh >= 0; S.kb = S.kb || { ult: 0, other: 0, ultTime: 0 }; S.kb[ul ? 'ult' : 'other'] += dk; if (ul) S.kb.ultTime += 1 / 60; const tr = (key, val, start) => { if (start(val, prev[key])) U[key] = (U[key] || 0) + 1; prev[key] = val; };
      if (K.kind === 'priest') { tr('sweep', K.ab, (v, o) => v === 'sweep' && o !== 'sweep'); tr('slam', K.ab, (v, o) => v === 'slam' && o !== 'slam'); tr('reel', K.ab, (v, o) => v === 'reel' && o !== 'reel'); tr('holy', K.hoT > 0, (v, o) => v && !o); tr('penance', K.pPh >= 0, (v, o) => v && !o); tr('smash', K.impN || 0, (v, o) => o !== undefined && v !== o && K.pPh >= 0); }
      else if (K.kind !== 'fire') { tr('dash', K.ab, (v, o) => v === 'dash' && o !== 'dash'); tr('leap', K.ab, (v, o) => v === 'leap' && o !== 'leap'); tr('spin', K.spin >= 0, (v, o) => v && !o); tr('ult', K.ultPh >= 0, (v, o) => v && !o); }
      else { tr('coals', K.coId || 0, (v, o) => o !== undefined && v !== o); tr('plume', K.plT >= 0, (v, o) => v && !o); tr('lava', !!K.lava, (v, o) => v && !o); tr('volcano', K.vPh >= 0, (v, o) => v && !o); tr('rocks', K.vSN || 0, (v, o) => o !== undefined && v !== o); } };
    window.__botRun = n => { for (let i = 0; i < n; i++) { window.__botStep(); window.__step(1 / 60); watch(); } };
  });
  const t0 = Date.now(); const log = [];
  for (let s = 0; s < SECS; s += 10) { await p.evaluate(() => window.__botRun(600)); const r = await p.evaluate(() => { const K = window.__KN()[0]; const W = window.__W(); let nd = 1e9; for (const w of W) if (w.hp > 0) nd = Math.min(nd, Math.hypot(w.x - K.x, w.y - K.y)); return { k: K.kills, h: K.hits, e: W.length, x: K.x | 0, y: K.y | 0, nd: nd | 0, br: +(K.brC || 0).toFixed(1), on: K.brOn, cone: +(K.cone||0).toFixed(1), aim: !!K.in.aim, mv: K.in.mv.map(v => +v.toFixed(1)), v: K.vPh, att: +(K.att||0).toFixed(1) }; }); log.push([s + 10, r.k, r.h, r.e, r.x, r.y, r.nd, r.br, r.on, r.cone, r.aim, r.mv.join(','), r.v, r.att]); }
  const res = await p.evaluate(() => { const K = window.__KN()[0]; const W = window.__W(); return { dbg: { vT: K.vT, vSh: K.vSh, vBel: K.vBel, vLast: K.vLast, vSN: K.vSN, x: K.x|0, y: K.y|0, st: K.st, vPh: K.vPh, coT: K.coT, plT: K.plT, brOn: K.brOn, brC: K.brC, brLock: K.brLock, lava: K.lava, lvC: K.lvC, cone: K.cone, in: K.in, wx: [Math.min(...W.map(w=>w.x))|0, Math.max(...W.map(w=>w.x))|0], whp: W.slice(0,3).map(w=>[w.k,w.hp|0,w.x|0,w.y|0,w.atk]) }, kills: K.kills, hits: K.hits, uses: window.__BS.real, kb: window.__BS.kb }; });
  console.log(JSON.stringify({ kind, ...res, wall: Math.round((Date.now() - t0) / 1000), timeline: log, errs: errs.slice(0, 3) }));
  await b.close();
})();
