// Records the Knight's ability animations from the game's own pose code into src/knight-anims.json (the Pose Bench's Knight library, folder Abilities).
// Needs: python3 -m http.server 8765 in the repo, then: node tools/record-knight.js
// Each frame drawKnight fills window.__knRec with his drawn pose; it's turned into a bench rig here (in the page, with the game's ik):
// height (z) and the leap's flips are folded into the points, hands are measured from the bench's own shoulders so they land exactly.
// Not representable in the bench: the spin's turned-away views (drawn front-on) and the giant's size and plate armour.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const STEP = 2; // a key every 2 frames (60 fps)
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 640 } }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/knights.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  await p.click('#lSolo'); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__still = 1; const K = window.__KN()[0]; K.in.mv = [1, 0]; for (let i = 0; i < 30; i++) window.__step(1 / 60); K.in.mv = [0, 0]; for (let i = 0; i < 260; i++) window.__step(1 / 60); });
  await p.evaluate(() => {
    const r3 = v => Array.isArray(v) ? v.map(r3) : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
    const cl = (v, a, b) => Math.max(a, Math.min(b, v)), ik = (a, b, l1, l2, s2) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = cl(Math.hypot(dx, dy), 0.01, l1 + l2 - 0.01), ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), an = Math.atan2(dy, dx) + s2 * Math.acos(cl(ca, -1, 1)); return [a[0] + Math.cos(an) * l1, a[1] + Math.sin(an) * l1]; }; // the game's ik
    window.__toRig = q => { const f = q.f, ph = q.flip, cp = Math.cos(ph), sp = Math.sin(ph), piv = [q.pel[0], -6];
      const T = pt => { const dx = pt[0] - piv[0], dy = pt[1] - piv[1]; return [piv[0] + dx * cp - dy * sp, piv[1] + dx * sp + dy * cp - q.z]; };
      const pel = T(q.pel), lean = q.lean + ph * f, yaw = q.tw, L = f * lean;
      // the bench's shoulders (same formulas as the game's pose(), full width)
      const C = [pel[0] + 4.2 * Math.sin(L) + f * yaw * 0.55, pel[1] - 4.2 * Math.cos(L)], w = 1.95 * (1 - 0.22 * yaw), sd = [Math.cos(L * 0.8), Math.sin(L * 0.8)];
      const sh = [[C[0] - sd[0] * w, C[1] - sd[1] * w + f * yaw * 0.18], [C[0] + sd[0] * w, C[1] + sd[1] * w - f * yaw * 0.18]];
      const far = f > 0 ? 0 : 1, near = 1 - far, hA = T(q.hands[0]), hB = T(q.hands[1]), feet = q.feet.map(T), hips = [[pel[0] - 1.05, pel[1]], [pel[0] + 1.05, pel[1]]];
      const kn = [0, 1].map(i => { const k = T(q.knees[i]), a = ik(hips[i], feet[i], 3.1, 3.1, 1), c = ik(hips[i], feet[i], 3.1, 3.1, -1); return Math.hypot(a[0] - k[0], a[1] - k[1]) <= Math.hypot(c[0] - k[0], c[1] - k[1]) ? 1 : -1; });
      const R = { knight: 1, f, pel, lean, yaw, feet, kn, hA: [hA[0] - sh[near][0], hA[1] - sh[near][1]], hB: [hB[0] - sh[far][0], hB[1] - sh[far][1]], hr: [0, 0], fa: [0, 0], ao: q.ab ? 1 : 2 };
      if (q.hold && q.g) Object.assign(R, { sw: 1, sa: q.a + ph, lb: Math.min(1, q.glow), lz: q.lsz, bl: q.blade, so: q.sb ? 1 : 2 }); else R.sw = 0;
      return r3(R); };
  });
  // run n frames with an input setter, recording every drawn frame (tagged with his state)
  const run = (n, setup, each) => p.evaluate(([n, setup, each]) => { const K = window.__KN()[0], IN = K.in; if (setup) new Function('K', 'IN', setup)(K, IN); const fe = each ? new Function('K', 'IN', 'j', each) : null, out = [];
    for (let j = 0; j < n; j++) { if (fe) fe(K, IN, j); window.__step(1 / 60); window.__knRec = []; window.__draw(); const q = window.__knRec[0]; window.__knRec = null; if (q) out.push({ rig: window.__toRig(q), tag: q.tag }); }
    return out; }, [n, setup || '', each || '']);
  const rest = n => p.evaluate(n => { const K = window.__KN()[0]; K.in.mv = [0, 0]; K.in.aim = null; K.in.spin = 0; for (let i = 0; i < n; i++) window.__step(1 / 60); }, n);
  const clipOf = (name, frames, note) => { const keys = [], T2 = Math.PI * 2; let pl = null, ps = null; // lean / sword angle kept continuous (a flip ending at 4π then resetting to 0 is the same pose)
  for (const q of frames) { const r = q.rig; if (pl != null) r.lean += T2 * Math.round((pl - r.lean) / T2); pl = r.lean; if (r.sa != null) { if (ps != null) r.sa += T2 * Math.round((ps - r.sa) / T2); ps = r.sa; } }
  frames.forEach((q, j) => { if (j % STEP === 0 || j === frames.length - 1) keys.push({ fr: j, ease: 'smooth', pose: q.rig }); }); return { folder: 'Abilities', name, note, keys }; };
  // from the press until he's back in his guard (+ a few frames)
  const until = (fr, busy) => { let last = 0; fr.forEach((q, j) => { if (busy(q.tag)) last = j; }); return fr.slice(0, Math.min(fr.length, last + 8)); };
  const out = [];
  { const fr = await run(60 * 7, 'IN.spin = 1;', 'if (j > 2) IN.spin = 0;'); out.push(clipOf('Spin (cleave into the light-sword spin)', until(fr, g => g.pre >= 0 || g.spin >= 0 || g.post > 0), 'Spin button: overhead cleave, then 4 turns. The turned-away frames are drawn front-on here')); await rest(400); }
  { const fr = await run(90, 'IN.dashD = [1, 0]; IN.dashN = (IN.dashN || 0) + 1;'); out.push(clipOf('Dash', until(fr, g => g.ab === 'dash'), 'Dash to the right')); await rest(200); }
  { const fr = await run(120, 'IN.leapT = [0.8, 0]; IN.leapN = (IN.leapN || 0) + 1;'); out.push(clipOf('Leap', until(fr, g => g.ab === 'leap'), 'Leap to the right: flips, falls tipped, slams the blade in (height and flips folded into the pose)')); await rest(500); }
  { await p.evaluate(() => window.__fillUlt()); const fr = await run(100, 'IN.ultN = (IN.ultN || 0) + 1;'); out.push(clipOf('Ult: transform', until(fr, g => g.ultPh === 0), 'Growing into the giant (drawn at normal size, no plate armour)'));
    const lf = await run(220, 'IN.leapT = [0.8, 0]; IN.leapN = (IN.leapN || 0) + 1;'); out.push(clipOf('Ult: giant leap', until(lf, g => g.ab === 'leap'), 'The giant’s charged leap and slam (normal size here)')); }
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'knight-anims.json'), JSON.stringify({ character: 'Knight', recorded: new Date().toISOString().slice(0, 10), clips: out }));
  console.log(out.map(c => c.name + ' (' + c.keys[c.keys.length - 1].fr + 'f)').join('\n'));
  await b.close(); })();
