// Records the Storm Ogre's animations from the game's own drawing code into src/ogre-anims.json (the Pose Bench's library).
// Needs: python3 -m http.server 8765 in the repo, then: node tools/record-ogre.js
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const STEP = 2; // a key every 2 frames (60 fps)
const rel = (h, s) => [h[0] - s[0], h[1] - s[1]], r3 = v => Array.isArray(v) ? v.map(r3) : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
function toPose(q) { const o = q.F, f = q.f, i = s => o.ord.indexOf(s), iT = i('T'), iH = i('H');
  const P = { f, pel: o.pel, lean: o.lean, yaw: o.yaw, feet: o.feet, kn: [f > 0 ? -1 : 1, f > 0 ? -1 : 1], hA: rel(o.hA, o.shA), hB: rel(o.hB, o.shB), eA: o.sA, eB: o.sB,
    fa: [0, 0], hr: [0, 0], aF: i('A') < iT ? 0 : i('A') < iH ? 1 : 2, bF: i('B') < iT ? 0 : 1, ls: 0, act: q.act, yf: q.yf, cA: o.cA || 0, cB: o.cB || 0 };
  if (q.kb > 0 && q.B) { const b = q.B; P.view = q.kb; P.bk = { pel: b.pel, aG: b.aG, aP: b.aP, hG: rel(b.hG, b.shG), hP: rel(b.hP, b.shP), eG: b.sG, eP: b.sP }; }
  return r3(P); }
const clipOf = (name, frames, note) => { const keys = []; frames.forEach((q, j) => { if (j % STEP === 0 || j === frames.length - 1) keys.push({ fr: j, ease: 'smooth', pose: toPose(q) }); }); return { name, note, keys }; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 640 } }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/knights.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  await p.click('#lChars'); await p.click('[data-ch=ogre]'); await p.click('#lBack'); await p.click('#lSolo'); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__still = 1; const K = window.__KN()[0]; K.in.mv = [1, 0]; for (let i = 0; i < 20; i++) window.__step(1 / 60); K.in.mv = [0, 0]; for (let i = 0; i < 200; i++) window.__step(1 / 60); });
  // run n frames with an input setter; returns the recorded frames, each tagged with the ogre's state
  const run = (n, setup, each) => p.evaluate(([n, setup, each]) => { const K = window.__KN()[0], IN = K.in; if (setup) new Function('K', 'IN', setup)(K, IN); const fe = each ? new Function('K', 'IN', 'j', each) : null, out = [];
    for (let j = 0; j < n; j++) { if (fe) fe(K, IN, j); window.__step(1 / 60); window.__ogRec = []; window.__draw(); const q = window.__ogRec[0]; window.__ogRec = null; if (q) { q.tag = { ou: K.ou, ouK: K.ouK, ogR: K.ogR, ogHs: K.ogHs, ogHk: K.ogHk, ogHn: K.ogHn, ogFn: K.ogFn, sv: K.sv, clT: K.clT, spd: K.spd }; out.push(q); } }
    return out; }, [n, setup || '', each || '']);
  const rest = n => p.evaluate(n => { const K = window.__KN()[0]; K.in.mv = [0, 0]; K.in.aim = null; for (let i = 0; i < n; i++) window.__step(1 / 60); }, n);
  const L = { Movement: [], Combo: [], Abilities: [], 'Rampage (ult)': [] };
  L.Movement.push(clipOf('Idle', await run(150), 'Standing, breathing'));
  await run(40, 'IN.mv = [0.45, 0];'); L.Movement.push(clipOf('Walk', await run(90, 'IN.mv = [0.45, 0];'), 'Half stick'));
  await run(40, 'IN.mv = [1, 0];'); L.Movement.push(clipOf('Run', await run(70, 'IN.mv = [1, 0];'), 'Full stick')); await rest(120);
  // the combo: hold the swing stick and split the three swings
  { const fr = await run(380, 'IN.aim = [1, 0];'); await rest(120); const segs = []; let cur = null;
    for (const q of fr) { const g = q.tag; if (g.ou >= 0) { if (!cur || g.ouK !== cur.k || g.ou < cur.last) { cur = { k: g.ouK, fr: [], last: -1 }; segs.push(cur); } cur.fr.push(q); cur.last = g.ou; } else cur = null; }
    const nm = ['1 · Ice punch (frost hook)', '2 · Lightning punch (storm hook)', '3 · Ground smash']; for (const s of segs.slice(0, 3)) L.Combo.push(clipOf(nm[s.k], s.fr, 'Facing right, from the game')); }
  L.Abilities.push(clipOf('Frost surf', await run(270, 'IN.dashD = [1, 0]; IN.dashN = (IN.dashN || 0) + 1;'), 'Dash stick: rides the ice for 4.2s (hammer/ice not drawn here)')); await rest(200);
  L.Abilities.push(clipOf('Storm cloud cast', await run(70, 'const K2 = K; IN.leapT = [K2.x + 80, K2.y]; IN.leapN = (IN.leapN || 0) + 1;'), 'Leap circle: both heads breathe the cloud up')); await rest(200);
  // the rampage: fill the ult, roar, then hold the swing stick through it and split the hammer swings by kind
  { await p.evaluate(() => window.__fillUlt()); const fr = await run(60 * 15, 'IN.ulV = [1, 0]; IN.ultN = (IN.ultN || 0) + 1;', 'IN.aim = j > 60 ? [1, 0] : null; IN.mv = [0, 0];');
    const roar = fr.filter(q => q.tag.ogR >= 0 && q.tag.ogR < 0.75); if (roar.length) L['Rampage (ult)'].push(clipOf('Roar (hammer forms)', roar, 'Start of the ult; the hammer itself is not drawn here'));
    const segs = []; let cur = null; for (const q of fr) { const g = q.tag; if (g.ogHs >= 0 && !(g.ogFn >= 0)) { if (!cur || g.ogHn !== cur.n) { cur = { n: g.ogHn, k: g.ogHk, fr: [] }; segs.push(cur); } cur.fr.push(q); } else cur = null; }
    const big = k => segs.filter(s => s.k === k).sort((a, b) => b.fr.length - a.fr.length)[0], sw = big(0), sm2 = big(1); console.log('hammer swings', segs.map(s => s.k + ':' + s.fr.length).join(' '));
    if (sw) L['Rampage (ult)'].push(clipOf('Hammer sweep', sw.fr, 'Hammer not drawn here')); if (sm2) L['Rampage (ult)'].push(clipOf('Hammer smash', sm2.fr, 'Hammer not drawn here'));
    const fin = fr.filter(q => q.tag.ogFn >= 0); if (fin.length) L['Rampage (ult)'].push(clipOf('Finisher', fin, 'Hammer driven into the ground (not drawn here)')); }
  const lib = { character: 'Storm Ogre', recorded: new Date().toISOString().slice(0, 10), folders: Object.entries(L).filter(([, v]) => v.length).map(([name, clips]) => ({ name, clips })) };
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'ogre-anims.json'), JSON.stringify(lib));
  console.log(lib.folders.map(f => f.name + ': ' + f.clips.map(c => c.name + ' (' + c.keys[c.keys.length - 1].fr + 'f)').join(', ')).join('\n'));
  await b.close(); })();
