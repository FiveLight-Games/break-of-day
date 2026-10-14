// Stone Thrower and Pterodactyl Roost art + animation (ported from the approved demos; sim lives in game.js)
// ST: cavemen on a patch of rocky soil. Idle they inspect rocks and waddle about; the host's 'th' event makes one wind up and throw.
const ST = (() => {
let COL = '#3a7bd5';
const rr = (a, b) => a + Math.random() * (b - a), ap = (v, g, r) => v < g ? Math.min(g, v + r) : Math.max(g, v - r);
const sm = k => k * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k, L2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const RS = 1.6; // rocks in flight drawn bigger than in the demo: the game is viewed further out
function srand(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function shade(h, k) { const p = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return '#' + p.map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))).toString(16).padStart(2, '0')).join(''); }
// ---------- rocks ----------
function poly(R, sz) { const n = 5 + Math.floor(R() * 3), v = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R() * 0.5; v.push([Math.cos(a) * sz * (0.75 + R() * 0.4), Math.sin(a) * sz * 0.62 * (0.75 + R() * 0.4)]); } return v; }
const SKULL = { x: 7.5, y: -5.2, ex: 9 };
function makeRocks(seed, k, ex, n = 9) {
  const R = srand(seed), out = [], sh = ['#8f8473', '#9e9280', '#7b7063', '#a59a86', '#857867', '#94836c'];
  let tries = 0;
  while (out.length < n && tries++ < 600) {
    const a = R() * Math.PI * 2, rad = 0.4 + R() * 0.58, px = Math.cos(a) * 17.5 * rad, py = Math.sin(a) * 6.8 * rad;
    if (Math.hypot(px, py * 2.5) < 6) continue;
    if (ex && Math.hypot(px - ex.x, (py - ex.y) * 2.5) < ex.ex) continue;
    if (out.some(o => Math.hypot(o.x - px, (o.y - py) * 2.5) < 8)) continue;
    const sz = (1.7 + R() * 2.3) * k, glint = out.length % 3 === 0;
    const vein = []; const va = R() * Math.PI; for (let j = 0; j < 3; j++) vein.push([Math.cos(va) * (j - 1) * sz * 0.38 + (R() - 0.5) * 0.5, Math.sin(va) * (j - 1) * sz * 0.22 + (R() - 0.5) * 0.3]);
    out.push({ x: px, y: py, sz, v: poly(R, sz), c: sh[Math.floor(R() * sh.length)], h: 1 + sz * 0.45, glint, gp: R() * 10, vein });
  }
  return out;
}
function makeBones(rocks, n) {
  const R = srand(77), out = [], kinds = ['long', 'skull', 'long', 'rib', 'long'].slice(0, n); let tries = 0;
  while (out.length < kinds.length && tries++ < 600) {
    const a = R() * Math.PI * 2, rad = 0.45 + R() * 0.5, px = Math.cos(a) * 17 * rad, py = Math.sin(a) * 6.6 * rad;
    if (Math.hypot(px, py * 2.5) < 5) continue;
    if (rocks.concat(out).some(o => Math.hypot(o.x - px, (o.y - py) * 2.5) < (o.ex || 6.5))) continue;
    out.push({ x: px, y: py, k: kinds[out.length], a: (R() - 0.5) * 1.1, len: 3.2 + R() * 1.8, f: R() < 0.5 ? 1 : -1 });
  }
  return out;
}
const BONE = '#ece2c8', BONED = '#c4b694';
// standing stones around the edge of the patch, some with a handprint in the owner's colour
function makeCircle(skull) {
  const R = srand(31), out = [], n = 7;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.2, x = Math.cos(a) * 21, y = Math.sin(a) * 8.6; if (skull && Math.hypot(x - SKULL.x, (y - SKULL.y) * 2.5) < 13) continue; out.push({ x, y, w: 1.5 + R() * 0.5, h: 5.2 + R() * 2.2, lean: (R() - 0.5) * 0.12, c: ['#8d877d', '#9a9488', '#7f7a71'][i % 3], hand: i % 2 === 0 }); }
  return out;
}
function standing(c, st) {
  c.save(); c.translate(st.x, st.y);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 0.5, st.w * 1.5, 0.9, 0, 0, 7); c.fill();
  c.rotate(st.lean); const w = st.w, h = st.h;
  c.fillStyle = shade(st.c, -0.3); c.beginPath(); c.moveTo(-w, 0.4); c.lineTo(-w * 0.95, -h * 0.8); c.quadraticCurveTo(-w * 0.6, -h - 0.4, 0.2, -h); c.lineTo(w + 0.5, -h * 0.8 + 0.3); c.lineTo(w + 0.6, 0.6); c.closePath(); c.fill();
  c.fillStyle = st.c; c.beginPath(); c.moveTo(-w, 0.4); c.lineTo(-w * 0.95, -h * 0.8); c.quadraticCurveTo(-w * 0.6, -h - 0.4, 0.2, -h); c.quadraticCurveTo(w * 0.7, -h * 0.9, w * 0.75, -h * 0.7); c.lineTo(w * 0.8, 0.5); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-w * 0.8, -h * 0.85, w * 0.5, h * 0.7);
  if (st.hand) { const hy = -h * 0.5; c.fillStyle = COL; c.globalAlpha = 0.9; c.beginPath(); c.ellipse(-0.1, hy + 0.35, 0.62, 0.55, 0, 0, 7); c.fill(); c.lineCap = 'round'; c.strokeStyle = COL; c.lineWidth = 0.28; for (const [fx, fl] of [[-0.5, 0.75], [-0.18, 0.95], [0.15, 0.9], [0.45, 0.7]]) { c.beginPath(); c.moveTo(fx, hy); c.lineTo(fx * 1.25, hy - fl); c.stroke(); } c.beginPath(); c.moveTo(0.55, hy + 0.4); c.lineTo(0.95, hy + 0.05); c.stroke(); c.lineCap = 'butt'; c.globalAlpha = 1; }
  c.fillStyle = '#6e4f30'; c.beginPath(); c.ellipse(-0.1, 0.45, w * 1.15, 0.5, 0, 0, 7); c.fill();
  c.restore();
}
// a half-buried mammoth skull at the back of the patch, tusks sweeping up and out
function mammothSkull(c) {
  c.save(); c.translate(SKULL.x, SKULL.y);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 0.8, 7.5, 2, 0, 0, 7); c.fill();
  const tusk = (sx) => { c.lineCap = 'round'; c.strokeStyle = BONED; c.lineWidth = 1.7; c.beginPath(); c.moveTo(sx * 1.6, -1.2); c.bezierCurveTo(sx * 4.5, 0.6, sx * 8, -1, sx * 7.6, -5.6); c.stroke(); c.strokeStyle = BONE; c.lineWidth = 1.15; c.beginPath(); c.moveTo(sx * 1.6, -1.4); c.bezierCurveTo(sx * 4.5, 0.3, sx * 7.8, -1.2, sx * 7.5, -5.5); c.stroke(); c.lineCap = 'butt'; };
  tusk(-1); tusk(1);
  c.fillStyle = BONED; c.beginPath(); c.moveTo(-4.4, 0.4); c.quadraticCurveTo(-5, -5.4, 0, -7.4); c.quadraticCurveTo(5, -5.4, 4.4, 0.4); c.closePath(); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.moveTo(-4, 0.2); c.quadraticCurveTo(-4.6, -5.2, 0, -7.1); c.quadraticCurveTo(4.2, -5.3, 3.4, 0.2); c.closePath(); c.fill();
  c.strokeStyle = BONED; c.lineWidth = 0.3; c.beginPath(); c.moveTo(0, -7); c.quadraticCurveTo(0.4, -5, 0, -3.8); c.stroke();
  c.fillStyle = '#2a1d12'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * 2.2, -3.1, 0.95, 0.75, sx * 0.3, 0, 7); c.fill(); }
  c.beginPath(); c.ellipse(0, -1.4, 0.9, 1.1, 0, 0, 7); c.fill();
  c.fillStyle = '#6e4f30'; c.beginPath(); c.ellipse(0, 0.5, 5.2, 1.2, 0, 0, 7); c.fill();
  c.fillStyle = '#7d5a37'; for (const [ax, r] of [[-3.5, 0.9], [-1, 0.7], [2.6, 1]]) { c.beginPath(); c.ellipse(ax, 0.3, r, 0.5, 0, 0, 7); c.fill(); }
  c.restore();
}
function boneShape(c, len, w) { // a bone lying along +x, centred
  const h = len / 2; c.fillStyle = BONE; c.fillRect(-h, -w / 2, len, w);
  for (const e of [-h, h]) for (const o of [-w * 0.55, w * 0.55]) { c.beginPath(); c.arc(e, o, w * 0.62, 0, 7); c.fill(); }
  c.fillStyle = BONED; c.fillRect(-h, w * 0.1, len, w * 0.35);
}
function groundBone(c, b) {
  c.save(); c.translate(b.x, b.y);
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(0.6, 0.4, 1.8, 0.7, 0, 0, 7); c.fill();
  if (b.k === 'long') { // a leg bone jutting out of the soil
    c.save(); c.rotate(-Math.PI / 2 + b.a); c.translate(b.len / 2, 0); boneShape(c, b.len, 0.75); c.restore();
  } else if (b.k === 'skull') { // half-buried skull
    c.fillStyle = BONED; c.beginPath(); c.ellipse(0, -1.1, 1.9, 1.5, 0, Math.PI, 0); c.fill();
    c.fillStyle = BONE; c.beginPath(); c.ellipse(-0.15, -1.25, 1.75, 1.4, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#2a1d12'; for (const ex of [-0.7, 0.5]) { c.beginPath(); c.ellipse(ex * b.f, -0.65, 0.42, 0.36, 0, 0, 7); c.fill(); }
  } else { // ribs curling up out of the ground
    c.strokeStyle = BONE; c.lineWidth = 0.5; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const ox = (i - 1) * 0.95; c.beginPath(); c.moveTo(ox - 0.9, 0); c.quadraticCurveTo(ox - 1.1, -2.6 + Math.abs(i - 1) * 0.5, ox + 0.5, -2.9 + Math.abs(i - 1) * 0.5); c.stroke(); }
    c.lineCap = 'butt';
  }
  c.fillStyle = '#6e4f30'; c.beginPath(); c.ellipse(0, 0.05, 1.3, 0.45, 0, 0, 7); c.fill(); // soil heaped at the base
  c.restore();
}
function sparkle(c, sx, sy, k, r) {
  if (k <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = k;
  const g = c.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6); g.addColorStop(0, shade(COL, 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r * 1.6, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(sx, sy - r); c.lineTo(sx + r * 0.16, sy - r * 0.16); c.lineTo(sx + r, sy); c.lineTo(sx + r * 0.16, sy + r * 0.16); c.lineTo(sx, sy + r); c.lineTo(sx - r * 0.16, sy + r * 0.16); c.lineTo(sx - r, sy); c.lineTo(sx - r * 0.16, sy - r * 0.16); c.closePath(); c.fill();
  c.restore();
}
function glintK(ph, t) { const u = ((t * 0.42 + ph) % 2.6); return u < 0.4 ? Math.sin(u / 0.4 * Math.PI) : 0; }
function rock(c, s, t) {
  c.save(); c.translate(s.x, s.y);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0.8, 0.7, s.sz * 1.05, s.sz * 0.45, 0, 0, 7); c.fill();
  c.fillStyle = shade(s.c, -0.32); c.beginPath(); s.v.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
  c.translate(0, -s.h); c.fillStyle = s.c; c.beginPath(); s.v.forEach((p, i) => i ? c.lineTo(p[0] * 0.92, p[1] * 0.92) : c.moveTo(p[0] * 0.92, p[1] * 0.92)); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.ellipse(-s.sz * 0.25, -s.sz * 0.15, s.sz * 0.38, s.sz * 0.18, -0.2, 0, 7); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 0.25; c.beginPath(); c.moveTo(s.v[1][0] * 0.5, s.v[1][1] * 0.4); c.lineTo(s.v[1][0] * 0.1, s.v[1][1] * 0.05 + 0.3); c.stroke();
  if (s.glint) {
    // a vein of the owner's colour running over the top face
    c.lineCap = 'round'; c.strokeStyle = shade(COL, -0.35); c.lineWidth = 0.75; c.beginPath(); s.vein.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    c.strokeStyle = COL; c.lineWidth = 0.45; c.beginPath(); s.vein.forEach((p, i) => i ? c.lineTo(p[0], p[1] - 0.1) : c.moveTo(p[0], p[1] - 0.1)); c.stroke();
    c.fillStyle = shade(COL, 0.55); c.beginPath(); c.arc(s.vein[1][0], s.vein[1][1] - 0.15, 0.22, 0, 7); c.fill();
    c.lineCap = 'butt';
    sparkle(c, s.vein[1][0], s.vein[1][1] - 0.2, glintK(s.gp, t), 1.5);
  }
  c.restore();
}
// ---------- soil patch (baked once) ----------
let patch = null;
function makePatch() {
  const S = 6, pw = 58, ph = 28; patch = document.createElement('canvas'); patch.width = pw * S; patch.height = ph * S;
  const g = patch.getContext('2d'); g.scale(S, S); g.translate(pw / 2, ph / 2); const R = srand(99);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(1.5, 2, 24, 9.8, 0, 0, 7); g.fill();
  g.fillStyle = '#86603d'; g.beginPath(); g.ellipse(0, 0, 21, 8.5, 0, 0, 7); g.fill();
  g.save(); g.beginPath(); g.ellipse(0, 0, 21, 8.5, 0, 0, 7); g.clip();
  g.fillStyle = '#7a5636'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse((R() - 0.5) * 34, (R() - 0.5) * 13, 3 + R() * 5, 1.4 + R() * 2, R() * 0.6, 0, 7); g.fill(); }
  g.fillStyle = '#93704b'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse((R() - 0.5) * 34, (R() - 0.5) * 13, 2 + R() * 4, 1 + R() * 1.6, R() * 0.6, 0, 7); g.fill(); }
  // dry cracks
  g.strokeStyle = '#5a3e25'; g.lineWidth = 0.32; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { let cx = (R() - 0.5) * 30, cy = (R() - 0.5) * 11, a = R() * 6.28; g.beginPath(); g.moveTo(cx, cy); for (let j = 0; j < 4; j++) { a += (R() - 0.5) * 1.4; cx += Math.cos(a) * 2.2; cy += Math.sin(a) * 0.9; g.lineTo(cx, cy); } g.stroke(); }
  // grit and pebbles
  for (let i = 0; i < 90; i++) { const px = (R() - 0.5) * 40, py = (R() - 0.5) * 16; g.fillStyle = R() < 0.5 ? '#a4835c' : '#5f442b'; g.beginPath(); g.arc(px, py, 0.15 + R() * 0.28, 0, 7); g.fill(); }
  for (let i = 0; i < 16; i++) { const px = (R() - 0.5) * 36, py = (R() - 0.5) * 13, r = 0.4 + R() * 0.55; g.fillStyle = '#5a4634'; g.beginPath(); g.ellipse(px + 0.15, py + 0.15, r, r * 0.65, 0, 0, 7); g.fill(); g.fillStyle = ['#9a8d7a', '#8b7f6d', '#a8987e'][i % 3]; g.beginPath(); g.ellipse(px, py, r, r * 0.65, 0, 0, 7); g.fill(); }
  g.restore();
  g.strokeStyle = 'rgba(60,40,22,.55)'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(0, 0, 21, 8.5, 0, 0, 7); g.stroke();
}
// ---------- the caveman: feet at (0,0) ----------
const HIDE = '#c79d63', HIDED = '#8a6236', HIDEL = '#dcb67e';
const PALS = [{ SK: '#b97b4b', SKD: '#8b5532', SKL: '#d39a68', HAIR: '#3a2617', HAIR2: '#4b3220' }, { SK: '#a86c40', SKD: '#7c4a2a', SKL: '#c58a58', HAIR: '#6a3218', HAIR2: '#7d4122' }, { SK: '#c58d5c', SKD: '#94603a', SKL: '#dcaa78', HAIR: '#262422', HAIR2: '#3a3734' }, { SK: '#b07446', SKD: '#86512e', SKL: '#cc9264', HAIR: '#8d8882', HAIR2: '#a29d96' }];
function kf(u, keys) { let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= u) i++; const [u0, a] = keys[i], [u1, b] = keys[i + 1], k = sm(Math.max(0, Math.min(1, (u - u0) / (u1 - u0)))); return Array.isArray(a) ? L2(a, b, k) : lerp(a, b, k); }
function man(c, M, T, t) {
  const { SK, SKD, SKL, HAIR, HAIR2 } = M.pal;
  const f = M.face, wk = M.wk, wp = M.wp, ta = M.ta, u = M.cyc;
  // throw choreography (u = 0..1 over one throw)
  const bend = ta * kf(u, [[0, 0], [0.13, 0.75], [0.28, 0], [1, 0]]);
  const k = Math.max(M.cr, bend);
  const sway = Math.sin(wp) * wk, bob = Math.abs(Math.cos(wp)) * wk;
  const hipY = -5 + k * 2.5 + bob * 0.35, hx0 = sway * 0.7;
  const thLean = kf(u, [[0, 0.9], [0.13, 2.6], [0.3, 0.9], [0.52, -0.7], [0.62, 2.6], [0.8, 1.6], [1, 0.9]]);
  const lean = f * lerp(0.9 + M.cr * 2.1, thLean, ta) + hx0;
  const sh = hipY - 5 + k * 0.6, hx = lean * 1.3 + f * 0.5, hy = sh - 2.1 + k * 0.7;
  const shL = [-3 + lean, sh + 0.9], shR = [3 + lean, sh + 0.9];
  // idle hands: hanging low (knuckles near the knees), swinging while he waddles
  const hang = [[-3.3 + lean * 0.6 - Math.sin(wp) * 1.1 * wk * f, hipY + 2.2], [3.3 + lean * 0.6 + Math.sin(wp) * 1.1 * wk * f, hipY + 2.2]];
  let near = f > 0 ? hang[1] : hang[0], far = f > 0 ? hang[0] : hang[1];
  if (M.chief) { // hand on hip and staff planted; in a fight he raises his fist and his staff high
    const sw = Math.sin(t * 5) * 0.35 * ta;
    near = L2([f * 2.5 + lean * 0.5, hipY - 0.6], [f * 1.4 + lean, sh - 5.6 + sw], ta);
    far = L2([-f * 3.1 + lean * 0.3, hipY + 1.4], [-f * 2.3 + lean, sh - 3.6 - sw], ta);
  }
  // inspecting: tap the rock, lift a pebble to his face and turn it over, then scratch his head
  let pebble = null, tilt = 0;
  if (M.cr > 0.02) {
    const r = T.rocks[M.ri], ip = 1 - Math.max(0, M.tm) / M.dur, rt = [(r.x - M.px) / M.sc, (r.y - M.py - r.h - 0.3) / M.sc];
    const knee = [[f * 2.2 + lean * 0.4, hipY + 0.4], [-f * 1.6 + lean * 0.4, hipY + 0.9]];
    let nh = knee[0], fh = knee[1];
    if (ip < 0.32) { const a = sm(Math.min(1, ip / 0.08)); nh = L2(knee[0], [rt[0], rt[1] - Math.max(0, Math.sin(t * 13)) * 0.7], a); }
    else if (ip < 0.82) { const a = sm(Math.min(1, (ip - 0.32) / 0.1)) * sm(Math.min(1, (0.82 - ip) / 0.08)), face = [hx + f * 2.6, hy + 1.7 + Math.sin(t * 2.3) * 0.25]; nh = L2(knee[0], face, a); pebble = { a, rot: t * 1.6, glint: r.glint }; tilt = Math.sin(t * 1.7) * 0.18 * a; }
    else { const a = sm(Math.min(1, (ip - 0.82) / 0.06)) * sm(Math.min(1, (1 - ip) / 0.05)); fh = L2(knee[1], [hx - f * 0.6 + Math.sin(t * 24) * 0.35, hy - 2.2], a); tilt = -0.12 * a; }
    near = L2(near, nh, M.cr); far = L2(far, fh, M.cr);
  }
  // throwing: grab a rock off the ground, hoist it, wind back over the head, hurl it, follow through
  let rockAt = null;
  if (ta > 0.01 && !M.chief) {
    const rest = [f * 2.6 + lean * 0.4, hipY + 1.6];
    const th = kf(u, [[0, rest], [0.13, [f * 3.6, -0.7]], [0.3, [f * 1.8, sh + 0.6]], [0.52, [-f * 2.6 + lean * 0.3, sh - 4.6]], [0.6, [f * 1.2 + lean, sh - 4.4]], [0.66, [f * 5 + lean, sh - 1.4]], [0.82, [f * 3.6 + lean, hipY + 1.4]], [1, rest]]);
    const off = kf(u, [[0, [-f * 2 + lean * 0.5, hipY + 1.8]], [0.3, [-f * 1.6 + lean * 0.5, hipY + 1.2]], [0.45, [f * 4.6 + lean, sh - 0.6]], [0.56, [f * 4.4 + lean, sh - 0.2]], [0.68, [-f * 2.6 + lean, hipY + 0.6]], [1, [-f * 2 + lean * 0.5, hipY + 1.8]]]);
    if (M.sling) { // load the pouch, whirl it overhead, whip it forward
      const th2 = kf(u, [[0, rest], [0.13, [f * 3.6, -0.7]], [0.26, [f * 1.4, sh + 0.4]], [0.34, [f * 0.4 + lean * 0.3, sh - 5]], [0.58, [f * 0.6 + lean * 0.3, sh - 5.2]], [0.66, [f * 4.8 + lean, sh - 2.2]], [0.82, [f * 3.6 + lean, hipY + 1.4]], [1, rest]]);
      near = L2(near, th2, ta); far = L2(far, off, ta);
      if (M.hold && u < 0.27) rockAt = near;
    } else { near = L2(near, th, ta); far = L2(far, off, ta); if (M.hold) rockAt = near; }
  }
  // ---- draw ----
  c.save(); c.scale(M.sc, M.sc);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(lean * 0.3, 0.4, 4.4 + k * 0.6, 1.5, 0, 0, 7); c.fill();
  // stubby bow legs
  const lL = Math.max(0, Math.sin(wp)) * 1.5 * wk, rL = Math.max(0, -Math.sin(wp)) * 1.5 * wk;
  const lf = [-2.3 - k * 0.9 + f * Math.sin(wp) * 1.1 * wk, -lL], rf = [2.3 + k * 0.9 - f * Math.sin(wp) * 1.1 * wk, -rL];
  c.lineCap = 'round'; c.strokeStyle = SKD; c.lineWidth = 1.9;
  c.beginPath(); c.moveTo(-1.3 + hx0, hipY); c.quadraticCurveTo(-3.4 - k * 1.8 + hx0, hipY * 0.45 - lL * 0.5, lf[0], lf[1] - 0.4); c.moveTo(1.3 + hx0, hipY); c.quadraticCurveTo(3.4 + k * 1.8 + hx0, hipY * 0.45 - rL * 0.5, rf[0], rf[1] - 0.4); c.stroke();
  c.fillStyle = '#7a4a2a'; for (const p of [lf, rf]) { c.beginPath(); c.ellipse(p[0] + f * 0.55, p[1] - 0.2, 1.25, 0.6, 0, 0, 7); c.fill(); }
  if (M.chief) { // fur cloak hanging down his back
    c.fillStyle = '#6b5a47'; c.beginPath(); c.moveTo(-3.6 + lean, sh + 0.6); c.quadraticCurveTo(-f * 4.6 + lean * 0.5, (sh + hipY) / 2, -f * 3.8 + hx0, hipY + 3); for (let i = 0; i <= 5; i++) c.lineTo(-f * 3.8 + f * i * 1.3 + hx0, hipY + 3 + (i % 2 ? 0.8 : 0)); c.lineTo(3.6 + lean, sh + 0.6); c.closePath(); c.fill(); }
  // barrel torso
  c.fillStyle = SK; c.beginPath(); c.moveTo(-2.4 + hx0, hipY); c.lineTo(-3.3 + lean, sh + 1.1); c.quadraticCurveTo(lean, sh - 1.4, 3.3 + lean, sh + 1.1); c.lineTo(2.4 + hx0, hipY); c.quadraticCurveTo(hx0 + f * 0.6, hipY + 0.9, -2.4 + hx0, hipY); c.fill();
  c.fillStyle = SKL; c.beginPath(); c.ellipse(lean * 0.7 + f * 0.9, (sh + hipY) / 2 - 0.3, 1.5, 2.1, 0, 0, 7); c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
  // chest hair
  c.strokeStyle = HAIR; c.lineWidth = 0.28; c.beginPath(); for (let i = -2; i <= 2; i++) { const bx = lean * 0.85 + i * 0.55, by = sh + 1.9 + Math.abs(i) * 0.2; c.moveTo(bx, by); c.lineTo(bx + 0.25, by + 0.7); } c.stroke();
  // hide strap over one shoulder
  c.strokeStyle = HIDED; c.lineWidth = 1.25; c.beginPath(); c.moveTo(-f * 2.4 + lean, sh + 0.9); c.lineTo(f * 2 + hx0, hipY - 0.6); c.stroke();
  c.strokeStyle = HIDE; c.lineWidth = 0.85; c.beginPath(); c.moveTo(-f * 2.4 + lean, sh + 0.8); c.lineTo(f * 2 + hx0, hipY - 0.7); c.stroke();
  if (M.chief) { // shaggy fur collar over his shoulders
    c.fillStyle = '#7d6a54'; c.beginPath(); c.moveTo(-3.8 + lean, sh + 1.6); for (let i = 0; i <= 8; i++) { const xx = -3.8 + i * 0.95; c.lineTo(xx + lean, sh + (i % 2 ? 2.6 : 1.7)); } c.lineTo(3.8 + lean, sh + 0.2); c.quadraticCurveTo(lean, sh - 1.4, -3.8 + lean, sh + 0.2); c.closePath(); c.fill();
    c.fillStyle = '#9a866c'; for (const ax of [-2.4, -0.6, 1.3, 2.8]) { c.beginPath(); c.ellipse(ax + lean, sh + 0.5, 0.7, 0.4, 0, 0, 7); c.fill(); }
    c.fillStyle = '#efe6cf'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 0.8 + lean - 0.25, sh + 2); c.lineTo(i * 0.8 + lean, sh + 2.9 - Math.abs(i) * 0.15); c.lineTo(i * 0.8 + lean + 0.25, sh + 2); c.fill(); } }
  // spotted hide loincloth, ragged hem, tied with a cord in the owner's colour
  const hy0 = hipY - 1.1, hy1 = hipY + 2.9 - k * 0.6;
  c.fillStyle = HIDE; c.beginPath(); c.moveTo(-2.7 + hx0, hy0); c.lineTo(2.7 + hx0, hy0); c.lineTo(2.9 + hx0, hy1 - 0.6);
  for (let i = 0; i <= 6; i++) { const xx = 2.9 - i * (5.8 / 6); c.lineTo(xx + hx0, hy1 + (i % 2 ? 0.7 : -0.2) + Math.sin(t * 3 + i) * 0.12 * wk); }
  c.closePath(); c.fill();
  c.fillStyle = HIDED; for (const [sx, sy, r] of [[-1.5, 0.4, 0.45], [0.6, 1.4, 0.55], [1.9, 0.1, 0.35], [-0.4, 2.1, 0.3]]) { c.beginPath(); c.ellipse(sx + hx0, hy0 + sy, r, r * 0.75, 0, 0, 7); c.fill(); }
  c.fillStyle = HIDEL; c.globalAlpha = 0.4; c.fillRect(-2.6 + hx0, hy0 + 0.1, 5.2, 0.35); c.globalAlpha = 1;
  c.strokeStyle = shade(COL, -0.3); c.lineWidth = 0.75; c.beginPath(); c.moveTo(-2.75 + hx0, hy0 + 0.05); c.lineTo(2.75 + hx0, hy0 + 0.05); c.stroke();
  c.strokeStyle = COL; c.lineWidth = 0.45; c.beginPath(); c.moveTo(-2.7 + hx0, hy0 - 0.05); c.lineTo(2.7 + hx0, hy0 - 0.05); c.stroke();
  const kx = f * 1.3 + hx0; c.fillStyle = COL; c.beginPath(); c.arc(kx, hy0 + 0.05, 0.5, 0, 7); c.fill();
  c.strokeStyle = COL; c.lineWidth = 0.4; c.beginPath(); c.moveTo(kx, hy0 + 0.3); c.quadraticCurveTo(kx + f * 0.4, hy0 + 1.4, kx + f * 0.2 + Math.sin(t * 3) * 0.2 * wk, hy0 + 2.2); c.moveTo(kx, hy0 + 0.3); c.quadraticCurveTo(kx - f * 0.1, hy0 + 1.3, kx - f * 0.4, hy0 + 1.9); c.stroke();
  // head: low brow, shaggy mane, beard
  c.save(); c.translate(hx, hy); c.rotate(tilt * f);
  c.fillStyle = HAIR; for (const [ax, ay, r] of [[-1.7, -0.2, 1.35], [-1.1, -1.7, 1.35], [0.2, -2.1, 1.25], [-2.1, 1, 1.05], [-1.4, 1.9, 0.9]]) { c.beginPath(); c.arc(ax * f, ay, r, 0, 7); c.fill(); }
  c.fillStyle = SK; c.beginPath(); c.ellipse(f * 0.2, 0, 2.3, 2.35, 0, 0, 7); c.fill();
  c.fillStyle = HAIR2; c.beginPath(); c.ellipse(-f * 0.3, -1.5, 2.3, 1.15, -f * 0.15, Math.PI, 0); c.fill();
  c.fillStyle = HAIR; for (const ax of [-1.2, -0.2, 0.8]) { c.beginPath(); c.moveTo((ax - 0.5) * f, -1.6); c.lineTo((ax + 0.15) * f, -0.5); c.lineTo((ax + 0.5) * f, -1.6); c.fill(); }
  if (M.bone) { c.save(); c.translate(-f * 1.2, -2.3); c.rotate(-f * 0.5); c.fillStyle = '#efe6cf'; c.fillRect(-1.5, -0.25, 3, 0.5); for (const e of [-1.5, 1.5]) for (const o of [-0.3, 0.3]) { c.beginPath(); c.arc(e, o, 0.35, 0, 7); c.fill(); } c.restore(); }
  if (M.chief) { // bone crown: two curved horns and a band of teeth, a stone in the owner's colour at the front
    c.lineCap = 'round'; for (const sx of [-1, 1]) { c.strokeStyle = BONED; c.lineWidth = 0.75; c.beginPath(); c.moveTo(sx * 1.3 - f * 0.3, -1.9); c.quadraticCurveTo(sx * 3.2 - f * 0.3, -2.6, sx * 2.6 - f * 0.3, -4.6); c.stroke(); c.strokeStyle = BONE; c.lineWidth = 0.45; c.beginPath(); c.moveTo(sx * 1.3 - f * 0.3, -2); c.quadraticCurveTo(sx * 3.1 - f * 0.3, -2.7, sx * 2.6 - f * 0.3, -4.5); c.stroke(); } c.lineCap = 'butt';
    c.fillStyle = '#5b3d22'; c.beginPath(); c.ellipse(-f * 0.1, -1.75, 2.45, 0.6, 0, 0, 7); c.fill();
    c.fillStyle = BONE; for (let i = -3; i <= 3; i++) { const bx = i * 0.65 - f * 0.1; c.beginPath(); c.moveTo(bx - 0.22, -1.9); c.lineTo(bx, -2.75 + Math.abs(i) * 0.1); c.lineTo(bx + 0.22, -1.9); c.fill(); }
    c.fillStyle = COL; c.beginPath(); c.arc(f * 1.2, -1.75, 0.45, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(f * 1.1, -1.9, 0.15, 0, 7); c.fill(); }
  c.fillStyle = SKD; c.beginPath(); c.ellipse(f * 1.35, -0.45, 1.25, 0.5, f * 0.12, 0, 7); c.fill();
  c.fillStyle = '#1a0f08'; c.beginPath(); c.arc(f * 1.55, 0.1, 0.27, 0, 7); c.fill();
  c.fillStyle = SKL; c.beginPath(); c.ellipse(f * 2.35, 0.5, 0.65, 0.55, 0, 0, 7); c.fill(); c.fillStyle = SKD; c.beginPath(); c.arc(f * 2.5, 0.8, 0.18, 0, 7); c.fill();
  c.fillStyle = HAIR; c.beginPath(); c.moveTo(-f * 0.6, 0.4); c.quadraticCurveTo(f * 2.6, 0.9, f * 2.3, 1.4); c.quadraticCurveTo(f * 2, 3.4, f * 0.6, 3.5); c.quadraticCurveTo(-f * 0.6, 3.2, -f * 0.9, 1.6); c.closePath(); c.fill();
  c.strokeStyle = '#2a1a0e'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(f * 1.2, 1.55); c.lineTo(f * 2.05, 1.5); c.stroke();
  c.restore();
  if (M.chief) { // staff in his free hand, topped with a stone in the owner's colour
    const sb = [far[0] + 0.3, far[1] + 3.6], st = [far[0] - 0.4, far[1] - 8.4];
    c.lineCap = 'round'; c.strokeStyle = '#4d3219'; c.lineWidth = 0.75; c.beginPath(); c.moveTo(sb[0], sb[1]); c.lineTo(st[0], st[1]); c.stroke(); c.lineCap = 'butt';
    c.strokeStyle = HIDE; c.lineWidth = 0.4; for (const k2 of [0.62, 0.7]) { const px = sb[0] + (st[0] - sb[0]) * k2, py = sb[1] + (st[1] - sb[1]) * k2; c.beginPath(); c.moveTo(px - 0.5, py); c.lineTo(px + 0.5, py - 0.2); c.stroke(); }
    c.fillStyle = shade(COL, -0.35); c.beginPath(); c.ellipse(st[0], st[1] - 0.7, 1.05, 1.15, 0.3, 0, 7); c.fill(); c.fillStyle = COL; c.beginPath(); c.ellipse(st[0] - 0.15, st[1] - 0.85, 0.8, 0.85, 0.3, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(st[0] - 0.4, st[1] - 1.15, 0.22, 0, 7); c.fill();
    sparkle(c, st[0] - 0.3, st[1] - 1.1, glintK(1.1, t), 1.6); }
  // long thick arms with fists
  const lh = near[0] <= far[0] ? near : far, rh = lh === near ? far : near;
  const arm = (s, h) => { c.strokeStyle = SK; c.lineWidth = 1.75; c.lineCap = 'round'; c.beginPath(); c.moveTo(s[0], s[1]); c.quadraticCurveTo((s[0] + h[0]) / 2 + (h[0] > s[0] ? -0.9 : 0.9), (s[1] + h[1]) / 2 + 1.1, h[0], h[1]); c.stroke(); c.fillStyle = SKD; c.beginPath(); c.arc(h[0], h[1], 0.85, 0, 7); c.fill(); c.fillStyle = SK; c.beginPath(); c.arc(h[0] - 0.12, h[1] - 0.12, 0.7, 0, 7); c.fill(); };
  arm(shL, lh); arm(shR, rh);
  if (pebble) { c.save(); c.translate(near[0] + f * 0.3, near[1] - 0.6); c.rotate(pebble.rot); c.fillStyle = '#968a78'; c.beginPath(); c.ellipse(0, 0, 0.8, 0.6, 0, 0, 7); c.fill(); c.fillStyle = '#b1a690'; c.beginPath(); c.ellipse(-0.2, -0.15, 0.4, 0.25, 0, 0, 7); c.fill(); if (pebble.glint) { c.fillStyle = COL; c.beginPath(); c.arc(0.25, 0.1, 0.24, 0, 7); c.fill(); } c.restore(); if (pebble.glint) sparkle(c, near[0] + f * 0.5, near[1] - 0.7, glintK(0.3, t * 2.2) * pebble.a, 1.2); }
  if (rockAt) drawThrown(c, rockAt[0] + f * 0.2, rockAt[1] - 0.9, u * 2, (M.ps || 1) / M.sc, M.ammo);
  let relPt = near;
  if (M.sling) {
    let pouch; const whirl = ta > 0.5 && u > 0.27 && u < 0.64;
    if (whirl) { const th = t * 19 + M.wp; pouch = [near[0] + Math.cos(th) * 3.4, near[1] - 0.6 + Math.sin(th) * 1.3]; }
    else if (ta > 0.5 && u >= 0.64 && u < 0.85) pouch = [near[0] + f * 3.4, near[1] + 0.9];
    else pouch = [near[0] + Math.sin(t * 2.5 + M.wp) * 0.4, near[1] + 2.6];
    c.strokeStyle = shade(COL, -0.2); c.lineWidth = 0.32; c.beginPath(); c.moveTo(near[0], near[1]); c.quadraticCurveTo((near[0] + pouch[0]) / 2, (near[1] + pouch[1]) / 2 + (whirl ? 0 : 0.6), pouch[0], pouch[1]); c.stroke();
    c.fillStyle = '#7a5532'; c.beginPath(); c.ellipse(pouch[0], pouch[1], 0.75, 0.5, 0, 0, 7); c.fill();
    if (whirl && M.hold) { c.fillStyle = '#8a8070'; c.beginPath(); c.arc(pouch[0], pouch[1] - 0.25, 0.5, 0, 7); c.fill(); }
    relPt = pouch;
  }
  c.restore();
  return [relPt[0] * M.sc, relPt[1] * M.sc];
}
function drawThrown(c, px, py, rot, s, kind, ol) { c.save(); c.translate(px, py); c.rotate(rot); c.scale(s, s); if (kind === 'bone') { if (ol) { c.fillStyle = '#1c1610'; c.fillRect(-1.6, -0.62, 3.2, 1.24); for (const e of [-1.3, 1.3]) for (const o of [-0.34, 0.34]) { c.beginPath(); c.arc(e, o, 0.62, 0, 7); c.fill(); } } boneShape(c, 2.6, 0.62); c.restore(); return; } c.fillStyle = '#6f665a'; c.beginPath(); c.moveTo(-1.3, -0.5); c.lineTo(-0.4, -1.2); c.lineTo(1, -0.9); c.lineTo(1.4, 0.3); c.lineTo(0.5, 1.1); c.lineTo(-1, 0.9); c.closePath(); if (ol) { c.strokeStyle = '#1c1610'; c.lineWidth = 0.55; c.lineJoin = 'round'; c.stroke(); } c.fill(); c.fillStyle = '#9b9182'; c.beginPath(); c.moveTo(-0.9, -0.4); c.lineTo(-0.3, -0.9); c.lineTo(0.8, -0.6); c.lineTo(0.3, 0); c.closePath(); c.fill(); c.restore(); }
const GEO = {};
function geo(L) {
  if (GEO[L]) return GEO[L];
  const rocks = makeRocks(11, L >= 3 ? 1 : 0.7, L >= 5 ? SKULL : null, L >= 5 ? 5 : L >= 4 ? 6 : 9);
  return GEO[L] = { rocks, bones: L >= 3 ? makeBones(rocks.concat(L >= 5 ? [SKULL] : []), L >= 5 ? 2 : L >= 4 ? 3 : 5) : [], circle: L >= 4 ? makeCircle(L >= 5) : [] };
}
function spotFor(G, M, i) {
  const r = G.rocks[i], side = r.x >= 0 ? -1 : 1; let sx = r.x + side * (r.sz + 2.6), sy = r.y + 0.7;
  const k = Math.hypot(sx / 16, sy / 6.2); if (k > 1) { sx /= k; sy /= k; }
  M.sx = sx; M.sy = sy; M.sf = -side;
}
function pickRock(S, M) { const G = S.G, taken = S.men.filter(o => o !== M && !o.chief).map(o => o.ri); let i; do i = Math.floor(Math.random() * G.rocks.length); while ((i === M.ri || taken.includes(i)) && G.rocks.length > 2); M.ri = i; spotFor(G, M, i); }
function init(T, L) {
  const G = geo(L), men = [], n = L >= 5 ? 4 : Math.min(2, L);
  for (let i = 0; i < n; i++) {
    const M = { px: 0, py: 0, face: 1, st: 'walk', cr: 0, wk: 0, wp: i * 1.3 + (T.id || 0), tm: 0, dur: 1, ri: 0, cyc: 0, ta: 0, hold: false, pal: PALS[i], sc: [1, 0.93, 0.97, 1.05][i], bone: i === 1, chief: i === 3, sling: L >= 4 && i < 3, ps: L >= 3 ? 1.3 : 1 };
    if (M.chief) { M.px = SKULL.x - 0.3; M.py = SKULL.y + 0.02; M.z = 5.6; M.tm = 3; }
    else { M.ri = [1, 4, 2][i] % G.rocks.length; spotFor(G, M, M.ri); M.px = M.sx + [-6, 6, 4][i]; M.py = M.sy; }
    men.push(M);
  }
  T.st = { L, G, men, busyUntil: 0, wasBusy: false };
}
let patchMade = false;
function draw(c, T, t) {
  const L = Math.max(1, Math.min(5, T.lvl || 1)); COL = T.col || COL;
  if (!patchMade) { makePatch(); patchMade = true; }
  if (!T.st || T.st.L !== L) init(T, L);
  const S = T.st, G = S.G;
  c.save(); c.translate(0, 4);
  c.drawImage(patch, -29, -14, 58, 28);
  const items = G.rocks.map(r => [r.y, () => rock(c, r, t)]).concat(G.bones.map(b => [b.y, () => groundBone(c, b)]), G.circle.map(st => [st.y, () => standing(c, st)]));
  if (L >= 5) items.push([SKULL.y, () => mammothSkull(c)]);
  for (const M of S.men) items.push([M.py + 0.05, () => { c.save(); c.translate(M.px, M.py - (M.z || 0)); const h = man(c, M, G, t); c.restore(); if (T.x !== undefined) M.handW = [T.x + M.px + h[0], T.y + 4 + M.py + h[1] - 0.9]; }]);
  items.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
  c.restore();
}
// the host says caveman `who` winds up now and lets go after `wind` seconds; the rock then flies for `fly` seconds
function throwEv(T, who, u, wind, fly, now) {
  if (!T.st) init(T, Math.max(1, Math.min(5, T.lvl || 1)));
  const S = T.st, men = S.men.filter(m => !m.chief), M = men[who % men.length]; if (!M) return;
  M.q = { u, t0: now, dur: wind / 0.63, fly, rel: false }; M.ammo = S.L === 3 && Math.random() < 0.35 ? 'bone' : 'rock';
  S.busyUntil = now + 2.2; S.tgt = u;
}
const shots = [], bits = [], dust = [];
function update(T, dt, now) {
  if (!T.st) return; const S = T.st, G = S.G, busy = now < S.busyUntil;
  if (S.tgt && !V.units.has(S.tgt.id)) S.tgt = null;
  if (S.wasBusy && !busy) for (const M of S.men) if (!M.chief) { M.st = 'walk'; pickRock(S, M); }
  S.wasBusy = busy;
  for (const M of S.men) {
    if (M.chief) { M.ta = ap(M.ta, busy ? 1 : 0, dt * 4); if (busy && S.tgt) M.face = S.tgt.x >= T.x + M.px ? 1 : -1; else if ((M.tm -= dt) <= 0) { M.face = -M.face; M.tm = rr(3, 5); } continue; }
    if (busy || M.q) {
      M.ta = ap(M.ta, 1, dt * 6); M.cr = ap(M.cr, 0, dt * 7); M.wk = ap(M.wk, 0, dt * 6);
      const tg = M.q ? M.q.u : S.tgt; if (tg) M.face = tg.x >= T.x + M.px ? 1 : -1;
      if (M.q) {
        const q = M.q; M.cyc = Math.min(1, (now - q.t0) / q.dur);
        M.hold = M.cyc >= 0.13 && !q.rel;
        if (!q.rel && M.cyc >= 0.63) { q.rel = true; M.hold = false; release(T, M, q, now); }
        if (M.cyc >= 1) { M.q = null; M.cyc = 0; }
      } else M.cyc = 0;
      continue;
    }
    M.ta = ap(M.ta, 0, dt * 2.5); M.cyc = 0;
    if (M.st === 'inspect') { M.tm -= dt; M.cr = ap(M.cr, 1, dt * 2.4); M.wk = ap(M.wk, 0, dt * 6); if (M.tm <= 0) { M.st = 'walk'; pickRock(S, M); } }
    else {
      M.cr = ap(M.cr, 0, dt * 3);
      const dx = M.sx - M.px, dy = M.sy - M.py, d = Math.hypot(dx, dy * 1.6);
      if (M.cr < 0.35) {
        if (d > 0.35) { const v = 7.5 * Math.min(1, d / 1.2); M.px += dx / d * v * dt; M.py += dy / d * v * dt; M.wk = ap(M.wk, 1, dt * 5); M.wp += dt * 8.5; if (Math.abs(dx) > 0.4) M.face = dx > 0 ? 1 : -1; }
        else { M.wk = ap(M.wk, 0, dt * 6); if (M.wk < 0.2) { M.st = 'inspect'; M.dur = M.tm = rr(3, 5); M.face = M.sf; } }
      }
    }
  }
}
function release(T, M, q, now) {
  const u = q.u, h = M.handW || [T.x, T.y - 8]; if (!onScreen(T.x, T.y, 320)) return;
  const d = Math.hypot(u.x - h[0], u.y - h[1]);
  shots.push({ x0: h[0], y0: h[1], g0: [T.x + M.px, T.y + 4 + M.py], u, tx: u.x, ty: u.y, t: 0, dur: Math.max(0.08, q.fly), arc: M.sling ? 4 + d * 0.06 : 12 + d * 0.16, sling: M.sling, spin: (u.x > h[0] ? 1 : -1) * rr(9, 13), kind: M.ammo, ps: M.ps });
  sfx('arrow', T.x, T.y);
}
function step(dt) {
  for (const s of shots) { s.t += dt; if (s.u && V.units.has(s.u.id)) { s.tx = s.u.x; s.ty = s.u.y; } if (s.t >= s.dur && !s.done) { s.done = 1; land(s); } }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  for (const b of bits) { b.t += dt; if (!b.rest) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= 240 * dt; b.rot += b.spin * dt; if (b.z <= 0) { b.z = 0; if (b.vz < -28) { b.vz *= -0.35; b.vx *= 0.5; b.spin *= 0.5; } else b.rest = b.t; } } }
  for (let i = bits.length - 1; i >= 0; i--) if (bits[i].rest && bits[i].t - bits[i].rest > 1.6) bits.splice(i, 1);
  for (const p of dust) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 5; p.vy *= 1 - dt * 5; }
  for (let i = dust.length - 1; i >= 0; i--) if (dust[i].t >= dust[i].max) dust.splice(i, 1);
}
function land(s) {
  const tx = s.tx, ty = s.ty - 3;
  for (let i = 0; i < 7; i++) { const a = rr(0, 6.28); dust.push({ x: tx + Math.cos(a) * 2, y: ty + Math.sin(a), vx: Math.cos(a) * rr(16, 36), vy: Math.sin(a) * rr(6, 14), r: rr(1.6, 2.8), t: 0, max: rr(0.4, 0.7) }); }
  if (bits.length < 120) { const dir = Math.sign(s.tx - s.x0) || 1; bits.push({ x: tx, y: s.ty, z: 6, vx: dir * rr(30, 50), vy: rr(-4, 6), vz: rr(36, 52), rot: 0, spin: s.spin * 0.7, t: 0, rest: 0, kind: s.kind, s: 0.85 * (s.ps || 1) }); for (let i = 0; i < 2; i++) bits.push({ x: tx, y: s.ty, z: 6, vx: rr(-28, 28), vy: rr(-8, 8), vz: rr(24, 44), rot: 0, spin: rr(-15, 15), t: 0, rest: 0, s: 0.35 }); }
}
function drawAir(c, inView) {
  for (const b of bits) { if (!inView(b.x, b.y, 10)) continue; c.globalAlpha = b.rest ? Math.max(0, 1 - (b.t - b.rest) / 1.6) : 1; if (b.z > 0) { c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(b.x, b.y, 1.6 * b.s * RS, 0.7 * b.s * RS, 0, 0, 7); c.fill(); } drawThrown(c, b.x, b.y - 1 - b.z, b.rot, b.s * RS, b.kind); }
  c.globalAlpha = 1;
  for (const p of dust) { const k = p.t / p.max; c.fillStyle = `rgba(150,120,85,${0.5 * (1 - k)})`; c.beginPath(); c.arc(p.x, p.y - k * 4, p.r * (1 + k * 1.6), 0, 7); c.fill(); }
  for (const s of shots) {
    const u = Math.min(1, s.t / s.dur), gx = lerp(s.g0[0], s.tx, u), gy = lerp(s.g0[1], s.ty, u);
    const px = lerp(s.x0, s.tx, u), py = lerp(s.y0, s.ty - 5, u) - s.arc * 4 * u * (1 - u), ps = (s.ps || 1) * RS;
    if (!inView(px, py, 20)) continue;
    c.fillStyle = `rgba(0,0,0,${0.12 + 0.14 * u})`; c.beginPath(); c.ellipse(gx, gy, 1.4 * ps, 0.6 * ps, 0, 0, 7); c.fill();
    if (s.sling) { const u2 = Math.max(0, u - 0.12), qx = lerp(s.x0, s.tx, u2), qy = lerp(s.y0, s.ty - 5, u2) - s.arc * 4 * u2 * (1 - u2); const g = c.createLinearGradient(qx, qy, px, py); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.45)'); c.strokeStyle = g; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(qx, qy); c.lineTo(px, py); c.stroke(); c.lineCap = 'butt'; }
    drawThrown(c, px, py, s.t * s.spin * (s.sling ? 1.6 : 1), 0.95 * ps, s.kind, true);
  }
}
return { draw, update, throwEv, step, drawAir };
})();

// PT: a pterodactyl roost (dead tree at L1-2, rock snag L3, crag L4, peak L5). The host's 'pt' event sends the bird out:
// it dips for a boulder, flies out and lets go early so the boulder (keeping some of its momentum) lands on the spot the host aimed at.
const PT = (() => {
let COL = '#3a7bd5';
const rr = (a, b) => a + Math.random() * (b - a), lerp = (a, b, k) => a + (b - a) * k;
const CARRY = 0.6, CRUISE = 44, BS = 1.5; // CRUISE: flying height; BS: boulders drawn bigger than in the demo
const LV = [null,
  { rs: 0.56, ps: 0.62, bs: 1.15, dmg: 36, sp: 10, fly: 62, r: 92 },
  { rs: 0.68, ps: 0.74, bs: 1.3, dmg: 44, sp: 11, fly: 66, r: 98 },
  { rs: 0.8, ps: 0.86, bs: 1.45, dmg: 54, sp: 12, fly: 70, r: 104 },
  { rs: 0.9, ps: 0.98, bs: 1.6, dmg: 66, sp: 13, fly: 74, r: 110 },
  { rs: 1.0, ps: 1.1, bs: 1.75, dmg: 80, sp: 14, fly: 78, r: 116 }];
function srand(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function shade(h, k) { const p = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return '#' + p.map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))).toString(16).padStart(2, '0')).join(''); }
function poly(R, sz, sq = 0.62) { const n = 5 + Math.floor(R() * 3), v = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R() * 0.5; v.push([Math.cos(a) * sz * (0.75 + R() * 0.4), Math.sin(a) * sz * sq * (0.75 + R() * 0.4)]); } return v; }
// ---------- the roost: a crag of stacked rock with a twig nest on top ----------
// L1-2: a dead tree with the nest in its fork; L3: the tree grows out of a rock outcrop; L4: a rocky crag; L5: a rocky peak
const ROOST = [null,
  { kind: 'tree', s: 0.62, th: 11, tw: 1.5, pad: 6 },
  { kind: 'tree', s: 0.74, th: 13.5, tw: 1.9, pad: 7.5 },
  { kind: 'rocktree', s: 0.72, th: 10, tw: 2, base: 1, pad: 10 },
  { kind: 'crag', s: 0.95, hs: 1.35, pad: 13 },
  { kind: 'peak', s: 1.05, hs: 1.4, pad: 15 }];
function makeRoost(L) {
  const C = ROOST[L], R = srand(40 + L * 7), s = C.s, sh = ['#8e877c', '#9a9284', '#807a70', '#a39a8a'], rocks = [];
  const Ro = { kind: C.kind, s, pad: C.pad, rocks, eggs: L >= 3 ? L - 2 : 0, bones: L >= 4 };
  const add = (list, z, k) => list.forEach(([px, py, sz], i) => rocks.push({ x: px * k, y: py * k, z, sz: sz * k, v: poly(R, sz * k), h: sz * k * 0.9, c: sh[(i + z | 0) % 4] }));
  if (C.kind === 'crag' || C.kind === 'peak') {
    const hs = C.hs;
    add([[-9, 1.2, 4.6], [-4, 3.4, 5], [2.5, 3.6, 5.2], [8.5, 1.6, 4.4], [6, -2.6, 4.8], [-6.5, -2.8, 4.6]], 0, s);
    add([[-3.6, 0.8, 5.4], [3.6, 1.2, 5], [0, -1.6, 5.6]], 4.2 * s * hs, s);
    if (C.kind === 'peak') { add([[-1.8, 0.4, 4.4], [2, 0.2, 4]], 8.2 * s * hs, s); rocks.push({ x: 0, y: 0, z: 11.6 * s * hs, sz: 5.4 * s, v: poly(R, 5.4 * s, 0.5), h: 1.6 * s, c: '#958d80' }); Ro.nestZ = 11.6 * s * hs + 1.6 * s; }
    else { rocks.push({ x: 0, y: 0, z: 8.2 * s * hs, sz: 7 * s, v: poly(R, 7 * s, 0.5), h: 1.6 * s, c: '#958d80' }); Ro.nestZ = 8.2 * s * hs + 1.6 * s; }
    Ro.layers = [...new Set(rocks.map(r => r.z))].sort((a, b) => a - b);
  } else {
    const z0 = C.base ? 5.2 : 0;
    if (C.base) { add([[-6, 1, 4.2], [-1.5, 2.6, 4.4], [4, 1.8, 4], [3, -2, 4], [-3.5, -2.2, 4.2]], 0, 1); Ro.layers = [0]; }
    Ro.tree = { z0, th: C.th, tw: C.tw, br: [] };
    const nb = L === 1 ? 3 : 5; for (let i = 0; i < nb; i++) { const side = i % 2 ? 1 : -1; Ro.tree.br.push({ h: 0.38 + i / nb * 0.5, side, len: (3 + R() * 2.5) * (1 + L * 0.1), a: -0.5 - R() * 0.5, twig: R() < 0.6 }); }
    Ro.nestZ = z0 + C.th + 0.6;
  }
  Ro.pile = []; for (let i = 0; i < 1 + L; i++) Ro.pile.push({ x: 1.6 + (i % 3) * 1.2 - 1.2, y: -0.1 + Math.floor(i / 3) * 0.6, rot: R() * 6 });
  Ro.twigs = []; for (let i = 0; i < 18 + L * 4; i++) { const a = R() * Math.PI * 2; Ro.twigs.push([a, 0.8 + R() * 0.5, R() * 0.8 - 0.4]); }
  Ro.ns = [0, 0.62, 0.72, 0.8, 0.92, 1.02][L];
  return Ro;
}
// a dead tree: crooked grey trunk, bare branches, roots, and paint bands in the owner's colour
function deadTree(c, Ro, L, t) {
  const T = Ro.tree, z0 = T.z0, top = z0 + T.th, w = T.tw;
  c.lineCap = 'round';
  // roots
  if (!z0) { c.strokeStyle = '#5c5047'; c.lineWidth = w * 0.5; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * w * 0.3, -0.4); c.quadraticCurveTo(sx * w * 1.1, 0, sx * w * 1.8, 0.6); c.stroke(); } }
  // branches behind
  const branch = (b, front) => { const by = -(z0 + T.th * b.h), bx = b.side * w * 0.3, ex = bx + b.side * Math.cos(b.a) * b.len, ey = by + Math.sin(b.a) * b.len; if ((b.side > 0) !== front) return; c.strokeStyle = '#6e6157'; c.lineWidth = w * 0.42; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo((bx + ex) / 2, by - 0.4, ex, ey); c.stroke(); if (b.twig) { c.lineWidth = w * 0.22; c.beginPath(); c.moveTo((bx + ex) / 2, (by + ey) / 2 - 0.2); c.lineTo((bx + ex) / 2 + b.side * 0.6, (by + ey) / 2 - 2); c.stroke(); } };
  T.br.forEach(b => branch(b, false));
  // trunk: tapered and a little crooked, darker on one side
  c.fillStyle = '#7a6c60'; c.beginPath(); c.moveTo(-w * 0.55, -z0 + 0.2); c.quadraticCurveTo(-w * 0.75, -z0 - T.th * 0.5, -w * 0.25 + 0.4, -top); c.lineTo(w * 0.25 + 0.4, -top); c.quadraticCurveTo(w * 0.45, -z0 - T.th * 0.5, w * 0.55, -z0 + 0.2); c.closePath(); c.fill();
  c.fillStyle = '#5e5248'; c.beginPath(); c.moveTo(w * 0.1, -z0 + 0.2); c.quadraticCurveTo(w * 0.15, -z0 - T.th * 0.5, w * 0.25 + 0.4, -top); c.lineTo(w * 0.25 + 0.4, -top + 0.5); c.quadraticCurveTo(w * 0.45, -z0 - T.th * 0.5, w * 0.55, -z0 + 0.2); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(40,30,24,.35)'; c.lineWidth = 0.2; for (let i = 0; i < 4; i++) { const yy = -z0 - T.th * (0.15 + i * 0.2); c.beginPath(); c.moveTo(-w * 0.3, yy); c.lineTo(-w * 0.2, yy - 1.2); c.stroke(); }
  // forked top that cradles the nest
  c.strokeStyle = '#6e6157'; c.lineWidth = w * 0.45; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(0.4, -top + 0.3); c.lineTo(0.4 + sx * w * 1.3, -top - 1.6); c.stroke(); }
  // paint: bands round the trunk, a handprint from L2
  c.strokeStyle = COL; c.lineWidth = 0.55; for (let i = 0; i < (L >= 2 ? 2 : 1); i++) { const yy = -z0 - T.th * (0.3 + i * 0.12); c.beginPath(); c.ellipse(0.05, yy, w * 0.62, 0.35, 0, 0.1, Math.PI - 0.1); c.stroke(); }
  if (L >= 2) { const hy = -z0 - T.th * 0.62; c.fillStyle = COL; c.beginPath(); c.ellipse(-0.1, hy + 0.3, 0.5, 0.45, 0, 0, 7); c.fill(); c.lineWidth = 0.24; for (const fx of [-0.45, -0.15, 0.15, 0.42]) { c.beginPath(); c.moveTo(fx, hy); c.lineTo(fx * 1.25, hy - 0.75); c.stroke(); } }
  T.br.forEach(b => branch(b, true));
  c.lineCap = 'butt';
}
function rockPoly(c, s, ox, oy) {
  c.save(); c.translate(ox + s.x, oy + s.y - s.z);
  if (!s.z) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0.8, 0.7, s.sz * 1.05, s.sz * 0.45, 0, 0, 7); c.fill(); }
  c.fillStyle = shade(s.c, -0.32); c.beginPath(); s.v.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
  c.fillStyle = shade(s.c, -0.32); c.fillRect(-s.sz * 0.8, -s.h, s.sz * 1.6, s.h);
  c.translate(0, -s.h); c.fillStyle = s.c; c.beginPath(); s.v.forEach((p, i) => i ? c.lineTo(p[0] * 0.95, p[1] * 0.95) : c.moveTo(p[0] * 0.95, p[1] * 0.95)); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.ellipse(-s.sz * 0.25, -s.sz * 0.12, s.sz * 0.4, s.sz * 0.16, -0.2, 0, 7); c.fill();
  c.restore();
}
// painted marks in the owner's colour on the front of the crag; more of them each level
function marks(c, Ro, L) {
  const s = Ro.kind === 'rocktree' ? 0.75 : Ro.s; c.save(); c.strokeStyle = COL; c.fillStyle = COL; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 0.55 * s + 0.2;
  // zigzag across the front rock
  c.beginPath(); for (let i = 0; i <= 4; i++) { const px = (-3.5 + i * 1.8) * s, py = (2.2 - 2.4 - (i % 2) * 1.3) * s; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
  if (L >= 2) for (let i = 0; i < 3; i++) { c.beginPath(); c.arc((-1.5 + i * 1.6) * s, (2.2 - 5.4) * s, 0.42 * s, 0, 7); c.fill(); }
  if (L >= 3) { c.beginPath(); c.moveTo(-8.8 * s, -1.2 * s); c.lineTo(-8 * s, -3.4 * s); c.moveTo(-7.6 * s, -1.2 * s); c.lineTo(-6.8 * s, -3.4 * s); c.stroke(); }
  if (L >= 4) { c.beginPath(); c.moveTo(7.6 * s, -0.6 * s); c.quadraticCurveTo(9 * s, -2.6 * s, 7.4 * s, -3.8 * s); c.stroke(); }
  if (L >= 5) { c.globalAlpha = 0.9; c.beginPath(); c.moveTo(-0.6 * s, (2.2 - 8.6) * s); c.lineTo(0.6 * s, (2.2 - 9.6) * s); c.lineTo(1.8 * s, (2.2 - 8.6) * s); c.lineTo(0.6 * s, (2.2 - 7.6) * s); c.closePath(); c.fill(); c.globalAlpha = 1; }
  c.restore();
}
function boulder(c, px, py, rot, s, ol) { c.save(); c.translate(px, py); c.rotate(rot); c.scale(s, s); c.fillStyle = '#6f675b'; c.beginPath(); c.moveTo(-1.4, -0.5); c.lineTo(-0.5, -1.3); c.lineTo(1, -1); c.lineTo(1.5, 0.3); c.lineTo(0.6, 1.2); c.lineTo(-1.1, 1); c.closePath(); if (ol) { c.strokeStyle = '#1c1610'; c.lineWidth = 0.4; c.lineJoin = 'round'; c.stroke(); } c.fill(); c.fillStyle = '#9b9283'; c.beginPath(); c.moveTo(-1, -0.4); c.lineTo(-0.3, -1); c.lineTo(0.9, -0.7); c.lineTo(0.3, 0); c.closePath(); c.fill(); c.restore(); }
function nest(c, Ro, L, t, back) { // back half drawn behind the bird, front half in front
  const s = Ro.ns, ny = -Ro.nestZ, rx = 4.6 * s + 0.6, ry = 1.9 * s + 0.3;
  if (back) { c.fillStyle = '#3d2a17'; c.beginPath(); c.ellipse(0, ny, rx, ry, 0, 0, 7); c.fill(); c.fillStyle = '#2a1c10'; c.beginPath(); c.ellipse(0, ny + 0.2, rx * 0.7, ry * 0.6, 0, 0, 7); c.fill();
    for (let i = 0; i < Ro.eggs; i++) { c.fillStyle = '#e9e1cc'; c.beginPath(); c.ellipse((-1.4 + i * 1.5) * s, ny - 0.2, 0.75 * s + 0.2, 0.95 * s + 0.2, 0.2, 0, 7); c.fill(); c.fillStyle = COL; c.beginPath(); c.arc((-1.4 + i * 1.5) * s + 0.2, ny - 0.5, 0.22 * s + 0.08, 0, 7); c.fill(); }
    for (const p of Ro.pile) boulder(c, (p.x + 0.6) * s, ny + p.y * s - 0.2, p.rot, LV[L].bs * 0.7); }
  c.lineCap = 'round';
  for (const [a, k, w] of Ro.twigs) { const sy = Math.sin(a); if (back ? sy > 0 : sy <= 0) continue; const px = Math.cos(a) * rx * k * 0.95, py = ny + sy * ry * k; c.strokeStyle = ['#6b4a2a', '#83603a', '#5a3d22'][Math.floor((a * 7) % 3)]; c.lineWidth = 0.35 + s * 0.15; c.beginPath(); c.moveTo(px - Math.cos(a + 1.4 + w) * 1.6 * s, py - Math.sin(a + 1.4 + w) * 0.6 * s); c.lineTo(px + Math.cos(a + 1.4 + w) * 1.6 * s, py + Math.sin(a + 1.4 + w) * 0.6 * s); c.stroke(); }
  if (!back && Ro.bones) { c.fillStyle = '#ece2c8'; c.save(); c.translate(-rx * 0.7, ny + ry * 0.6); c.rotate(-0.3); c.fillRect(-1.6 * s, -0.25 * s, 3.2 * s, 0.5 * s); for (const e of [-1.6, 1.6]) for (const o of [-0.3, 0.3]) { c.beginPath(); c.arc(e * s, o * s, 0.35 * s, 0, 7); c.fill(); } c.restore(); }
  if (!back && L >= 2) { const fx0 = rx * 0.75, fy0 = ny + ry * 0.4; c.strokeStyle = COL; c.lineWidth = 0.5 * s + 0.15; c.beginPath(); c.moveTo(fx0, fy0); c.quadraticCurveTo(fx0 + 1.4 * s, fy0 - 1.6 * s + Math.sin(t * 3) * 0.3, fx0 + 2.6 * s, fy0 - 1.2 * s); c.stroke(); } // a streamer tied into the twigs
  c.lineCap = 'butt';
}
// ---------- the pterodactyl (drawn at its own scale; feet/body at origin) ----------
let SKN, SKD, BEL, MEM, MEMD; const MK = '#f4ecdc';
function ptero(c, P, L, t) {
  SKN = COL; SKD = shade(COL, -0.45); BEL = shade(COL, 0.45); MEM = shade(COL, 0.12); MEMD = shade(COL, -0.22);
  const s = LV[L].ps, f = P.f, fly = P.fly, fl = P.flap;
  c.save(); c.scale(s * f, s);
  const lift = fly > 0.5 ? Math.sin(fl) * 4.2 : 0, spread = Math.max(fly, P.stretch || 0), sl = (P.stretch || 0) * Math.sin(t * 6) * 1.2;
  const tilt = fly > 0.5 ? (P.dive || 0) * 0.3 : -0.35 + (P.peck || 0) * 0.7;
  c.rotate(tilt);
  const head = fly > 0.5 ? [5.4, -1] : [3.6 + (P.peck || 0) * 1.5, -4.6 + (P.peck || 0) * 3.4];
  const look = P.look || 0, preen = P.preen || 0;
  if (preen > 0) { head[0] = lerp(head[0], -1.2, preen); head[1] = lerp(head[1], -2.4, preen); }
  const wing = (near) => { // membrane wing: shoulder, wrist, tip, back to the hip
    const sgn = near ? 1 : -1, lf = lift + sl;
    const sh = [0.8, -0.4], wr = [2.4, sgn * (4.6 * spread) - lf * 0.55 - (1 - spread) * 0.8], tp = [-0.6 - (1 - spread) * 1.5, sgn * (9.4 * spread + 1) - lf * (near ? 1.1 : 1) - (1 - spread) * 1.4], hp = [-2.6, 0.4];
    c.fillStyle = near ? MEM : MEMD; c.beginPath(); c.moveTo(sh[0], sh[1]); c.lineTo(wr[0], wr[1]); c.lineTo(tp[0], tp[1]); c.quadraticCurveTo((tp[0] + hp[0]) / 2 - 1.2, (tp[1] + hp[1]) / 2, hp[0], hp[1]); c.closePath(); c.fill();
    c.strokeStyle = SKD; c.lineWidth = 0.5; c.beginPath(); c.moveTo(sh[0], sh[1]); c.lineTo(wr[0], wr[1]); c.lineTo(tp[0], tp[1]); c.stroke();
    if (L >= 2 && spread > 0.3) { c.strokeStyle = MK; c.lineWidth = 0.55; c.beginPath(); c.moveTo(lerp(wr[0], tp[0], 0.45), lerp(wr[1], tp[1], 0.45)); c.lineTo(lerp(lerp(wr[0], tp[0], 0.45), hp[0], 0.45), lerp(lerp(wr[1], tp[1], 0.45), hp[1], 0.45)); if (L >= 4) { c.moveTo(lerp(wr[0], tp[0], 0.75), lerp(wr[1], tp[1], 0.75)); c.lineTo(lerp(lerp(wr[0], tp[0], 0.75), hp[0], 0.3), lerp(lerp(wr[1], tp[1], 0.75), hp[1], 0.3)); } c.stroke(); }
  };
  if (spread > 0.05) wing(false);
  // legs (dangling in flight, standing when perched) and the boulder in its feet
  c.strokeStyle = SKD; c.lineWidth = 0.45; c.lineCap = 'round';
  if (fly > 0.5) { c.beginPath(); c.moveTo(-0.6, 1); c.lineTo(-0.2, 2.6); c.moveTo(0.4, 1); c.lineTo(0.8, 2.6); c.stroke(); }
  else { c.beginPath(); c.moveTo(-0.8, 1); c.lineTo(-1.1, 3.2); c.moveTo(0.4, 1); c.lineTo(0.6, 3.2); c.stroke(); }
  // tail
  c.beginPath(); c.moveTo(-2.8, 0.2); c.lineTo(-5.4, 0.9); c.stroke(); c.fillStyle = SKD; c.beginPath(); c.ellipse(-5.6, 0.95, 0.7, 0.4, 0.3, 0, 7); c.fill();
  // body, belly, back stripes
  if (spread > 0.05 && P.f) {} 
  c.fillStyle = SKN; c.beginPath(); c.ellipse(0, 0, 3.2, 1.55, 0, 0, 7); c.fill();
  c.fillStyle = BEL; c.beginPath(); c.ellipse(0.4, 0.6, 2.3, 0.75, 0, 0, 7); c.fill();
  c.strokeStyle = MK; c.lineWidth = 0.42; c.beginPath(); for (let i = 0; i < Math.min(3, L); i++) { c.moveTo(-1.6 + i * 1.1, -1.4); c.lineTo(-1.2 + i * 1.1, -0.5); } c.stroke();
  if (spread <= 0.05) { // folded wing along the side
    c.fillStyle = MEMD; c.beginPath(); c.moveTo(1.4, -0.8); c.lineTo(2.6, -3.2); c.quadraticCurveTo(0, -1.6, -3.4, 0.6); c.quadraticCurveTo(-1, 0.6, 1.4, -0.8); c.fill();
    c.strokeStyle = SKD; c.lineWidth = 0.45; c.beginPath(); c.moveTo(1.4, -0.8); c.lineTo(2.6, -3.2); c.stroke();
    if (L >= 2) { c.strokeStyle = MK; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-0.4, -0.6); c.lineTo(0.6, -1.6); c.stroke(); }
  }
  if (spread > 0.05) wing(true);
  if (P.carry) { c.strokeStyle = SKD; c.lineWidth = 0.45; c.beginPath(); c.moveTo(-0.6, 1); c.lineTo(-0.3, 2.4); c.moveTo(0.4, 1); c.lineTo(0.7, 2.4); c.stroke(); boulder(c, 0.2, 2.6 + LV[L].bs * BS / s * 0.9, Math.sin(t * 3) * 0.2, LV[L].bs * BS / s, true); }
  // neck + head: long beak forward, crest swept back (painted in the owner's colour)
  c.strokeStyle = SKN; c.lineWidth = 1.1; c.beginPath(); c.moveTo(2.4, -0.6); c.quadraticCurveTo(head[0] - 0.6, (head[1] - 0.6) * 0.5, head[0], head[1]); c.stroke();
  c.save(); c.translate(head[0], head[1]); c.rotate(look * 0.5 + (fly > 0.5 ? 0.12 : 0) - preen * 2.4);
  const crest = 2.6 + L * 0.35;
  c.fillStyle = shade(COL, -0.6); c.beginPath(); c.moveTo(0.2, -0.6); c.lineTo(-crest, -1.6 - L * 0.12); c.lineTo(-0.9, 0.2); c.closePath(); c.fill();
  c.fillStyle = shade(COL, -0.4); c.beginPath(); c.moveTo(0.2, -0.65); c.lineTo(-crest + 0.3, -1.5 - L * 0.12); c.lineTo(-0.6, -0.1); c.closePath(); c.fill();
  c.fillStyle = SKN; c.beginPath(); c.ellipse(0, 0, 1.2, 0.85, 0, 0, 7); c.fill();
  const gape = P.squawk ? 0.5 : 0.08;
  c.fillStyle = '#d8c39a'; c.beginPath(); c.moveTo(0.6, -0.35); c.lineTo(4.4, 0.2); c.lineTo(0.8, 0.15); c.closePath(); c.fill();
  c.fillStyle = '#bfa77f'; c.beginPath(); c.moveTo(0.8, 0.25); c.lineTo(4.1, 0.3 + gape); c.lineTo(0.6, 0.6); c.closePath(); c.fill();
  c.fillStyle = '#1a120c'; c.beginPath(); c.arc(0.25, -0.2, 0.24, 0, 7); c.fill();
  if (L >= 3) { c.strokeStyle = MK; c.lineWidth = 0.3; c.beginPath(); c.moveTo(-0.5, 0.35); c.lineTo(0.5, 0.45); c.stroke(); } // cheek stripe
  c.restore();
  c.restore();
}
const ROOSTS = {};
function roost(L) { return ROOSTS[L] || (ROOSTS[L] = makeRoost(L)); }
function bird(T) {
  const L = Math.max(1, Math.min(5, T.lvl || 1));
  if (!T.pt || T.pt.L !== L) { const Ro = roost(L); T.pt = { L, Ro, P: { x: 0, y: 0, z: Ro.nestZ + 0.2, st: 'perch', f: (T.id || 0) % 2 ? 1 : -1, fly: 0, flap: 0, carry: false, it: rr(1, 3), act: null, look: 0 } }; }
  return T.pt;
}
function nestPos(T, B) { return [T.x, T.y + 3.6, B.Ro.nestZ + 0.2]; }
function draw(c, T, t) {
  COL = T.col || COL; const B = bird(T), Ro = B.Ro, L = B.L, P = B.P, pad = Ro.pad;
  c.save(); c.translate(0, 4);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(1.5, 1.8, pad + 1.2, pad * 0.42 + 0.6, 0, 0, 7); c.fill();
  c.fillStyle = '#7d6446'; c.beginPath(); c.ellipse(0, 0.5, pad, pad * 0.42, 0, 0, 7); c.fill();
  if (Ro.layers) for (const z of Ro.layers) { const list = Ro.rocks.filter(r => r.z === z).sort((a, b) => a.y - b.y); for (const r of list) rockPoly(c, r, 0, 0); if (Ro.tree ? z === 0 : z === Ro.layers[1]) marks(c, Ro, L); }
  if (Ro.tree) deadTree(c, Ro, L, t);
  nest(c, Ro, L, t, true);
  const perched = T.x === undefined || P.st === 'perch' || P.st === 'grab';
  if (perched) { c.save(); c.translate(0, -0.4 - Ro.nestZ - 0.2 - 2.6 * LV[L].ps); ptero(c, P, L, t); c.restore(); }
  nest(c, Ro, L, t, false);
  c.restore();
}
// the host aimed a boulder at (lx, ly), landing tImp seconds from now
function launch(T, lx, ly, tImp, now) {
  const B = bird(T), P = B.P, [nx, ny, nz] = nestPos(T, B), atNest = P.st === 'perch' || P.st === 'grab';
  const from = atNest ? [nx, ny, nz] : [P.x, P.y, P.z], grab = atNest ? TD.BIRD.grab : 0, tRel = Math.max(grab + 0.05, tImp - TD.BIRD.fall), dur = tRel - grab;
  const k = CARRY * TD.BIRD.fall / Math.max(0.05, dur), rx = (lx + k * from[0]) / (1 + k), ry = (ly + k * from[1]) / (1 + k);
  Object.assign(P, { st: atNest ? 'grab' : 'out', t0: now, grab, tRel, from, R: [rx, ry], L: [lx, ly], tImp, act: null, preen: 0, stretch: 0, look: 0, carry: !atNest });
  if (!atNest) P.t0 = now - 0; P.f = rx >= from[0] ? 1 : -1;
}
const drops = [], bits = [], dust = [], rings = [];
const flying = new Set();
function update(T, dt, now) {
  const B = bird(T), P = B.P, L = B.L, [nx, ny, nz] = nestPos(T, B); P.squawk = 0;
  if (P.st === 'perch') {
    flying.delete(T); P.fly = Math.max(0, P.fly - dt * 4); P.x = nx; P.y = ny; P.z = nz; P.dive = 0;
    P.it -= dt; if (P.it <= 0 && !P.act) { const r = Math.random(); P.act = r < 0.35 ? 'look' : r < 0.7 ? 'preen' : 'stretch'; P.at = 0; P.ad = P.act === 'stretch' ? 1.3 : P.act === 'preen' ? 1.8 : 1.4; if (P.act === 'look' && Math.random() < 0.6) P.f = -P.f; }
    if (P.act) { P.at += dt; const k = Math.sin(Math.min(1, P.at / P.ad) * Math.PI); P.look = P.act === 'look' ? Math.sin(P.at * 5) * 0.4 * k : 0; P.preen = P.act === 'preen' ? Math.min(1, k * 1.6) : 0; P.stretch = P.act === 'stretch' ? k : 0; P.squawk = P.act === 'stretch' && k > 0.6; if (P.at >= P.ad) { P.act = null; P.it = rr(1.5, 3.5); P.look = P.preen = P.stretch = 0; } }
    return;
  }
  const e = now - P.t0;
  if (P.st === 'grab') { P.peck = Math.sin(Math.min(1, e / Math.max(0.05, P.grab)) * Math.PI); P.x = nx; P.y = ny; P.z = nz; if (e >= P.grab) { P.peck = 0; P.carry = true; P.st = 'out'; } return; }
  flying.add(T);
  if (P.st === 'out') {
    const s = Math.min(1, (e - P.grab) / Math.max(0.05, P.tRel - P.grab)), ox = P.x, oy = P.y;
    P.x = lerp(P.from[0], P.R[0], s); P.y = lerp(P.from[1], P.R[1], s); P.z = lerp(P.from[2], CRUISE, Math.min(1, s * 2.2));
    P.fly = Math.min(1, P.fly + dt * 6); P.flap += dt * 15; if (Math.abs(P.x - ox) > 0.01) P.f = P.x > ox ? 1 : -1; P.dive = 0;
    if (e >= P.tRel) {
      P.carry = false; P.squawk = 1;
      const V2 = LV[L], off = 2.6 * V2.ps + (0.9 * V2.bs) * BS, z0 = Math.max(4, P.z - off), fall = Math.max(0.1, P.tImp - e), g = 2 * z0 / (fall * fall);
      const bx = P.x + 0.2 * V2.ps * P.f;
      if (onScreen(P.x, P.y, 320)) drops.push({ L, x: bx, y: P.y, z: z0, vz: 0, g, vx: (P.L[0] - bx) / fall, vy: (P.L[1] - P.y) / fall, rot: 0 });
      P.st = 'back'; P.speed = TD.towerFly('ptero', L);
    }
  } else if (P.st === 'back') {
    P.flap += dt * 12; P.fly = 1;
    const dx = nx - P.x, dy = ny - P.y, d = Math.hypot(dx, dy), v = Math.min(d, P.speed * dt);
    if (d > 1.5) { P.x += dx / d * v; P.y += dy / d * v; if (Math.abs(dx) > 1) P.f = dx > 0 ? 1 : -1; }
    P.z += (nz + 6 - P.z) * Math.min(1, dt * 3); P.dive = -0.4;
    if (d <= 1.5) { P.st = 'perch'; P.it = rr(1, 2); P.x = nx; P.y = ny; P.z = nz; P.fly = 0; }
  }
}
function step(dt) {
  for (const b of drops) { b.vz -= b.g * dt; b.z += b.vz * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 4; if (b.z <= 0 && !b.done) { b.done = 1; land(b); } }
  for (let i = drops.length - 1; i >= 0; i--) if (drops[i].done) drops.splice(i, 1);
  for (const b of bits) { b.t += dt; if (!b.rest) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= 240 * dt; b.rot += b.spin * dt; if (b.z <= 0) { b.z = 0; if (b.vz < -28) { b.vz *= -0.35; b.vx *= 0.5; b.spin *= 0.5; } else b.rest = b.t; } } }
  for (let i = bits.length - 1; i >= 0; i--) if (bits[i].rest && bits[i].t - bits[i].rest > 1.6) bits.splice(i, 1);
  for (const p of dust) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 5; p.vy *= 1 - dt * 5; }
  for (let i = dust.length - 1; i >= 0; i--) if (dust[i].t >= dust[i].max) dust.splice(i, 1);
  for (const r of rings) r.t += dt; for (let i = rings.length - 1; i >= 0; i--) if (rings[i].t > 0.4) rings.splice(i, 1);
}
function land(b) {
  const V2 = LV[b.L], sp = TD.towerSplash('ptero', b.L);
  sfx('boom', b.x, b.y); stain(b.x, b.y, sp * 0.5, '#2a2218', 0.3);
  for (let i = 0; i < 12; i++) { const a = rr(0, 6.28); dust.push({ x: b.x + Math.cos(a) * 3, y: b.y + Math.sin(a) * 1.2, vx: Math.cos(a) * rr(30, 70), vy: Math.sin(a) * rr(10, 24), r: rr(2, 3.6) * V2.bs, t: 0, max: rr(0.5, 0.9) }); }
  rings.push({ x: b.x, y: b.y, t: 0, r: sp });
  if (bits.length < 120) { bits.push({ x: b.x, y: b.y, z: 4, vx: b.vx * 0.3 + rr(-14, 14), vy: rr(-4, 6), vz: rr(34, 46), rot: 0, spin: rr(-10, 10), t: 0, rest: 0, s: V2.bs * 0.9 * BS }); for (let i = 0; i < 3; i++) bits.push({ x: b.x, y: b.y, z: 4, vx: rr(-36, 36), vy: rr(-10, 10), vz: rr(26, 48), rot: 0, spin: rr(-15, 15), t: 0, rest: 0, s: V2.bs * 0.35 * BS }); }
}
function drawAir(c, t, inView) {
  for (const r of rings) { const k = r.t / 0.4; c.strokeStyle = `rgba(230,210,170,${0.6 * (1 - k)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(r.x, r.y, r.r * (0.3 + k * 0.8), r.r * 0.45 * (0.3 + k * 0.8), 0, 0, 7); c.stroke(); }
  for (const b of bits) { if (!inView(b.x, b.y, 10)) continue; c.globalAlpha = b.rest ? Math.max(0, 1 - (b.t - b.rest) / 1.6) : 1; boulder(c, b.x, b.y - 1 - b.z, b.rot, b.s); }
  c.globalAlpha = 1;
  for (const p of dust) { const k = p.t / p.max; c.fillStyle = `rgba(150,120,85,${0.55 * (1 - k)})`; c.beginPath(); c.arc(p.x, p.y - k * 5, p.r * (1 + k * 1.6), 0, 7); c.fill(); }
  for (const b of drops) { const k = Math.max(0.3, 1 - b.z / 60), s = LV[b.L].bs * BS; c.fillStyle = `rgba(0,0,0,${0.3 * k})`; c.beginPath(); c.ellipse(b.x, b.y + 0.5, 1.6 * s * (1.4 - k * 0.4), 0.7 * s, 0, 0, 7); c.fill(); }
  for (const T of flying) {
    if (!T.pt || !V.towerMap.has(T.id)) { flying.delete(T); continue; } const P = T.pt.P, L = T.pt.L; if (!inView(P.x, P.y - P.z, 40)) continue;
    const k = Math.max(0.25, 1 - P.z / 80); c.fillStyle = `rgba(0,0,0,${0.22 * k})`; c.beginPath(); c.ellipse(P.x, P.y + 0.5, 4.5 * LV[L].ps * (1 + P.fly * 0.6), 1.6 * LV[L].ps, 0, 0, 7); c.fill();
    COL = T.col || COL; c.save(); c.translate(P.x, P.y - P.z); ptero(c, P, L, t); c.restore();
  }
  for (const b of drops) boulder(c, b.x, b.y - b.z, b.rot, LV[b.L].bs * BS, true);
}
return { draw, update, launch, step, drawAir };
})();
