// ===================== Stage kit (DRAFT 2026-10-22) =====================
// Inlined into knights.html by build.py at /*@STAGEKIT@*/ (before campaign.js). Shared by the campaign and the map designer:
// - painted ground: a grid of SKC-unit cells (codes in SKG), stored run-length encoded in the stage (S.g, origin S.gx/S.gy, size S.gw x S.gh);
//   drawn as cached chunks (skChunk) with soft-edged textured layers over the game's grass tile
// - props (S.O: [kind, x, y, scale, flip, variant]): art in SKP, drawn from cached sprites in the depth list; solid ones push people out (col circles)
// - edge decor: trees / wall blocks generated along the void's edge (never saved)
// - skGen: builds a whole stage (ground, props, placed enemies, locks, spawn points) from a short spec, the same on every screen
const SKC = 16, SKCH = 256, SKRES = 2; // cell size, chunk size (world units), chunk pixels per unit
const SKG = { 0: 'Void', 1: 'Grass', 2: 'Dirt', 3: 'Cobbles', 4: 'Flagstones', 5: 'Forest floor', 6: 'Water' };
const skWalkC = c => c >= 1 && c <= 5;
const skParse = s => (s || '').split(',').filter(Boolean).map(p => { const [k, n] = p.split('*'); return [k.trim(), +n || 1]; });
function skRng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const skHash = (i, j, s = 0) => { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// ---- grid: run-length encoding and lookups (decoded arrays live in SKX, keyed by the stage object) ----
const SKX = new WeakMap();
const skEnc = a => { let o = [], c = a[0], n = 0; for (let i = 0; i <= a.length; i++) { if (i < a.length && a[i] === c) { n++; continue; } o.push(c + (n > 1 ? ':' + n.toString(36) : '')); c = a[i]; n = 1; } return o.join(','); };
function skDec(s, n) { const a = new Uint8Array(n); let i = 0; for (const p of (s || '').split(',')) { if (!p) continue; const [c, k] = p.split(':'), m = k ? parseInt(k, 36) : 1; a.fill(+c, i, i + m); i += m; } return a; }
function skX(S) { let X = SKX.get(S); if (!X || X.g !== S.g || X.gw !== S.gw) { X = { g: S.g, gw: S.gw, a: skDec(S.g, S.gw * S.gh), ch: new Map(), ed: null, pb: null, ver: (X ? X.ver : 0) + 1 }; SKX.set(S, X); } return X; }
function skCode(S, x, y) { const i = Math.floor((x - S.gx) / SKC), j = Math.floor((y - S.gy) / SKC); if (i < 0 || j < 0 || i >= S.gw || j >= S.gh) return 0; return skX(S).a[j * S.gw + i]; }
const skWalk = (S, x, y) => skWalkC(skCode(S, x, y));
function skNear(S, x, y) { if (skWalk(S, x, y)) return [x, y]; const i0 = Math.floor((x - S.gx) / SKC), j0 = Math.floor((y - S.gy) / SKC), X = skX(S);
  for (let r = 1; r < 40; r++) { let best = null, bd = 1e9; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= S.gw || j >= S.gh || !skWalkC(X.a[j * S.gw + i])) continue; const cx = S.gx + (i + 0.5) * SKC, cy = S.gy + (j + 0.5) * SKC, d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bd) { bd = d; best = [cx, cy]; } } if (best) return best; }
  return [x, y]; }
// the editor grows the grid when painting past its edge
function skGrow(S, x0, y0, x1, y1) { const X = skX(S); let gx = S.gx, gy = S.gy, ex = S.gx + S.gw * SKC, ey = S.gy + S.gh * SKC; const P = 32 * SKC;
  if (x0 >= gx && y0 >= gy && x1 < ex && y1 < ey) return false; if (x0 < gx) gx = Math.floor((x0 - P) / SKC) * SKC; if (y0 < gy) gy = Math.floor((y0 - P) / SKC) * SKC; if (x1 >= ex) ex = x1 + P; if (y1 >= ey) ey = y1 + P;
  const gw = Math.ceil((ex - gx) / SKC), gh = Math.ceil((ey - gy) / SKC), a = new Uint8Array(gw * gh), di = Math.round((S.gx - gx) / SKC), dj = Math.round((S.gy - gy) / SKC);
  for (let j = 0; j < S.gh; j++) a.set(X.a.subarray(j * S.gw, (j + 1) * S.gw), (j + dj) * gw + di); Object.assign(S, { gx, gy, gw, gh }); S.g = skEnc(a); const N = skX(S); N.a = a; return true; }
// paint a round brush of cells; returns the world box touched
function skPaint(S, x, y, r, code) { skGrow(S, x - r * SKC - SKC, y - r * SKC - SKC, x + r * SKC + SKC, y + r * SKC + SKC); const X = skX(S), i0 = Math.floor((x - S.gx) / SKC), j0 = Math.floor((y - S.gy) / SKC); let n = 0;
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (di * di + dj * dj > r * r + r * 0.6) continue; const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= S.gw || j >= S.gh) continue; const k = j * S.gw + i; if (X.a[k] !== code) { X.a[k] = code; n++; } }
  if (n) skDirty(S, x - (r + 2) * SKC, y - (r + 2) * SKC, x + (r + 2) * SKC, y + (r + 2) * SKC); return n; }
function skCommit(S) { const X = skX(S); S.g = skEnc(X.a); X.g = S.g; X.ed = null; X.pb = null; }
function skDirty(S, x0, y0, x1, y1) { const X = skX(S); for (let cy = Math.floor(y0 / SKCH); cy <= Math.floor(y1 / SKCH); cy++) for (let cx = Math.floor(x0 / SKCH); cx <= Math.floor(x1 / SKCH); cx++) X.ch.delete(cx + ',' + cy); }
// ---- ground textures (one pattern canvas per kind and look) ----
const SKTX = {};
function skTex(k, th) { const key = k + th; if (SKTX[key]) return SKTX[key]; const n = 128, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), R = skRng(k * 31 + th.length * 7);
  const dots = (cols, cnt, r0, r1) => { for (let i = 0; i < cnt; i++) { g.fillStyle = cols[Math.floor(R() * cols.length)]; const x = R() * n, y = R() * n, r = r0 + R() * (r1 - r0); for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.7, 0, 0, 7); g.fill(); } } };
  if (k === 2) { g.fillStyle = '#9a7a4c'; g.fillRect(0, 0, n, n); dots(['#8a6a40', '#a8895a', '#7e6038'], 70, 1.5, 6); dots(['#6b5a46', '#b9a07a'], 40, 0.8, 1.8); }
  else if (k === 3) { g.fillStyle = '#5f594f'; g.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 10) for (let x = (y / 10) % 2 * 6; x < n + 12; x += 12) { const w = 10 + R() * 2, h = 8 + R() * 1.5; g.fillStyle = ['#8f877a', '#9d958a', '#867e72', '#a39b8e'][Math.floor(R() * 4)]; g.beginPath(); g.roundRect((x % n) - 5, y + 1, w, h, 3); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect((x % n) - 3, y + 2, w - 5, 1.5); } }
  else if (k === 4) { g.fillStyle = '#4e4a43'; g.fillRect(0, 0, n, n); let y = 0; for (const h of [18, 14, 20, 16, 18, 14, 16, 12]) { let x = -R() * 20; while (x < n) { const w = 14 + R() * 18; const col = ['#807a6f', '#8a8478', '#77716a', '#857d70', '#7a7468', '#8e877a'][Math.floor(R() * 6)];
      for (const ox of [0, n]) { g.fillStyle = col; g.fillRect(x - ox + 1, y + 1, w - 2, h - 2); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x - ox + 1, y + 1, w - 2, 1.5); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x - ox + 1 + R() * (w - 6), y + 3 + R() * (h - 7), 3, 2); } x += w; } y += h; } }
  else if (k === 5) { g.fillStyle = th === 'wood' ? '#2b3d1f' : '#3a5428'; g.fillRect(0, 0, n, n); dots(['#4a3b24', '#5a4a2c', '#34481f', '#41592a', '#6a5530'], 160, 1, 3.2); }
  else if (k === 6) { const gr = g.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, '#2e6a86'); gr.addColorStop(1, '#295f7a'); g.fillStyle = gr; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(200,235,255,.25)'; g.lineWidth = 1.5; for (let i = 0; i < 14; i++) { const x = R() * n, y = R() * n, w = 8 + R() * 14; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 2.5, x + w, y); g.stroke(); } }
  else { if (th === 'fort') { g.fillStyle = '#1e1e22'; g.fillRect(0, 0, n, n); dots(['#26262b', '#18181b', '#2c2b30'], 60, 4, 12); } else { g.fillStyle = th === 'wood' ? '#0c1a0b' : '#15301a'; g.fillRect(0, 0, n, n); dots(th === 'wood' ? ['#102410', '#081408', '#142c13'] : ['#1b3a1f', '#102714', '#20452a'], 90, 5, 14); } }
  return (SKTX[key] = c); }
// one chunk of ground: each kind of ground is drawn as a soft-edged mask filled with its texture; void (the dark outside) goes on top
// each layer's mask: a round blob per cell (jittered), softened by a quarter-size round trip, then filled with its texture
const SKORD = [5, 2, 3, 4, 6, 0];
let skTmp = null, skSm = null;
function skChunk(S, cx, cy) { const X = skX(S), key = cx + ',' + cy; let cv = X.ch.get(key); if (cv) return cv;
  const px = SKCH * SKRES; cv = document.createElement('canvas'); cv.width = cv.height = px; const g = cv.getContext('2d');
  const wx0 = cx * SKCH, wy0 = cy * SKCH, i0 = Math.floor((wx0 - S.gx) / SKC) - 2, j0 = Math.floor((wy0 - S.gy) / SKC) - 2, n = SKCH / SKC + 5, cs = SKC * SKRES;
  const at = (i, j) => (i < 0 || j < 0 || i >= S.gw || j >= S.gh) ? 0 : X.a[j * S.gw + i];
  const used = new Set(); for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) used.add(at(i, j));
  if (used.size === 1 && used.has(1)) { X.ch.set(key, cv); return cv; } // all grass: the tile under it shows through
  if (used.size === 1) { g.fillStyle = g.createPattern(skTex([...used][0], S.th), 'repeat'); g.fillRect(0, 0, px, px); X.ch.set(key, cv); return cv; }
  if (!skTmp) { skTmp = document.createElement('canvas'); skSm = document.createElement('canvas'); } skTmp.width = skTmp.height = px; skSm.width = skSm.height = px / 4;
  const m = skTmp.getContext('2d'), q = skSm.getContext('2d');
  for (const code of SKORD) { if (!used.has(code)) continue; m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, px, px); m.fillStyle = '#000'; m.beginPath();
    const rk = code === 4 || code === 3 ? 0.78 : 0.72;
    for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) if (at(i, j) === code) { const x = (S.gx + (i + 0.5) * SKC - wx0) * SKRES + (skHash(i, j, 11) - 0.5) * cs * 0.3, y = (S.gy + (j + 0.5) * SKC - wy0) * SKRES + (skHash(i, j, 12) - 0.5) * cs * 0.3, r = cs * (rk + skHash(i, j, 13) * 0.22); m.moveTo(x + r, y); m.arc(x, y, r, 0, 7); }
    m.fill(); q.clearRect(0, 0, px / 4, px / 4); q.imageSmoothingEnabled = true; q.drawImage(skTmp, 0, 0, px / 4, px / 4); m.clearRect(0, 0, px, px); m.imageSmoothingEnabled = true; m.imageSmoothingQuality = 'high'; m.drawImage(skSm, 0, 0, px, px);
    if (code !== 0) m.drawImage(skTmp, 0, 0); // firm up the edge a little
    m.globalCompositeOperation = 'source-in'; const pat = m.createPattern(skTex(code, S.th), 'repeat'); pat.setTransform(new DOMMatrix().translate(-((wx0 * SKRES) % 128), -((wy0 * SKRES) % 128))); m.fillStyle = pat; m.fillRect(0, 0, px, px);
    g.drawImage(skTmp, 0, 0); }
  X.ch.set(key, cv); if (X.ch.size > 400) { const k0 = X.ch.keys().next().value; X.ch.delete(k0); } return cv; }
// draws every ground chunk in view (at most `budget` new ones a frame; missing ones are filled flat until ready)
function skGround(c, S, vx0, vy0, vx1, vy1, budget = 4) { const X = skX(S); let made = 0, pending = 0;
  for (let cy = Math.floor(vy0 / SKCH); cy <= Math.floor(vy1 / SKCH); cy++) for (let cx = Math.floor(vx0 / SKCH); cx <= Math.floor(vx1 / SKCH); cx++) { const key = cx + ',' + cy; let cv = X.ch.get(key);
    if (!cv && made < budget) { cv = skChunk(S, cx, cy); made++; } if (cv) { if (cv.width) c.drawImage(cv, cx * SKCH, cy * SKCH, SKCH + 0.3, SKCH + 0.3); } else { pending++; if (!skCode(S, (cx + 0.5) * SKCH, (cy + 0.5) * SKCH)) { c.fillStyle = S.th === 'fort' ? '#1e1e22' : S.th === 'wood' ? '#0c1a0b' : '#15301a'; c.fillRect(cx * SKCH, cy * SKCH, SKCH, SKCH); } } }
  return pending; }
// ---- props ----
// each: w/h = sprite box above the anchor (the anchor is the base, at ground level), col = solid circles [dx, dy, r], flat = drawn on the ground under everyone
const OL = '#1f1a12';
const skTreeCol = (th, v) => th === 'wood' ? [['#24481f', '#33602b', '#162e14'], ['#2a5226', '#3c6c31', '#18321a'], ['#2f5523', '#456f2c', '#1d3415']][v % 3] : [['#3f7a30', '#5a9a42', '#2a5522'], ['#4a8634', '#64a64a', '#2f5e26'], ['#3a7034', '#559046', '#264f22']][v % 3];
function skBlobs(c, B, cols, ol = 0.7) { c.fillStyle = cols[2]; for (const [x, y, r] of B) { c.beginPath(); c.arc(x, y, r + ol, 0, 7); c.fill(); } c.fillStyle = cols[0]; for (const [x, y, r] of B) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } c.fillStyle = cols[1]; for (const [x, y, r] of B) { c.beginPath(); c.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, 7); c.fill(); } }
const skShadow = (c, w, h = w * 0.36, dx = 0) => { c.fillStyle = 'rgba(0,0,0,.24)'; c.beginPath(); c.ellipse(dx, 0, w, h, 0, 0, 7); c.fill(); };
const skPoly = (c, P, fill, stroke = OL, lw = 0.45) => { c.beginPath(); P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); } };
const SKP = {
  tree: { n: 'Oak', w: 30, h: 34, col: [[0, -0.5, 3]], d(c, th, v) { skShadow(c, 12, 4.2, 1); skPoly(c, [[-1.8, 0.4], [-1.2, -10], [1.2, -10], [1.9, 0.4]], '#5b3d22'); c.strokeStyle = '#3e2a17'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(-0.3, -1); c.lineTo(-0.1, -8); c.stroke();
    const R = skRng(v * 7 + 3), B = [[0, -18, 9], [-6.5, -14, 6.2], [6.5, -14.5, 6.5], [-3.5, -22.5, 6.2], [4, -22, 6]].map(([x, y, r]) => [x + (R() - 0.5) * 2, y + (R() - 0.5) * 2, r * (0.92 + R() * 0.16)]); skBlobs(c, B, skTreeCol(th, v)); } },
  pine: { n: 'Pine', w: 22, h: 38, col: [[0, -0.5, 2.6]], d(c, th, v) { skShadow(c, 9, 3.4, 1); c.fillStyle = '#4e3520'; c.fillRect(-1.2, -6, 2.4, 6.4); c.strokeStyle = OL; c.lineWidth = 0.4; c.strokeRect(-1.2, -6, 2.4, 6.4);
    const cols = th === 'wood' ? ['#1f4a2c', '#2d6040', '#12301c'] : ['#2b5a34', '#3d7448', '#183a20']; for (let i = 0; i < 4; i++) { const y = -5 - i * 7.2, w = 10 - i * 2.1 + (v % 2) * 0.6, h = 11; skPoly(c, [[-w, y], [0, y - h], [w, y]], cols[0], cols[2], 0.6); c.fillStyle = cols[1]; c.beginPath(); c.moveTo(-w * 0.55, y - 1); c.lineTo(0, y - h + 1.5); c.lineTo(-w * 0.1, y - 1); c.closePath(); c.fill(); } } },
  dead: { n: 'Dead tree', w: 26, h: 30, col: [[0, -0.5, 2.4]], d(c, th, v) { skShadow(c, 8, 3); c.lineCap = 'round'; const br = (w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(0, 0); c.lineTo(0.5, -13); c.moveTo(0.4, -9); c.lineTo(-6, -17); c.lineTo(-8, -22); c.moveTo(0.5, -13); c.lineTo(5, -20); c.lineTo(9, -21.5); c.moveTo(0.5, -13); c.lineTo(1, -23); c.moveTo(-6, -17); c.lineTo(-10, -17); c.moveTo(5, -20); c.lineTo(5.5, -25); c.stroke(); }; br(3.3, OL); br(2.2, '#5a4b3c'); } },
  bush: { n: 'Bush', w: 16, h: 10, col: [], d(c, th, v) { skShadow(c, 7, 2.4); skBlobs(c, [[0, -4, 4.2], [-3.8, -2.6, 3.1], [3.9, -2.7, 3.3]], skTreeCol(th, v + 1), 0.6); if (v === 1) { c.fillStyle = '#c23a3a'; for (const [x, y] of [[-2, -5], [1.5, -3], [3.5, -4.5], [-4, -2.5]]) { c.beginPath(); c.arc(x, y, 0.6, 0, 7); c.fill(); } } } },
  rock: { n: 'Rock', w: 16, h: 11, col: [[0, -2, 4.6]], d(c, th, v) { skShadow(c, 7.5, 2.6); const R = skRng(v * 13 + 5), P = []; for (let i = 0; i < 8; i++) { const a = Math.PI + i / 7 * Math.PI, r = 5.5 + R() * 1.6; P.push([Math.cos(a) * r, -Math.abs(Math.sin(a)) * r * 0.95 + 0.6]); } skPoly(c, P, '#7a7670'); c.fillStyle = '#9a958d'; c.beginPath(); c.moveTo(P[1][0] * 0.8, P[1][1] * 0.85); for (let i = 2; i < 7; i++) c.lineTo(P[i][0] * 0.75, P[i][1] * 0.85); c.lineTo(P[6][0] * 0.4, -2); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(-1, -1); c.lineTo(1.5, -3.5); c.stroke(); } },
  boulder: { n: 'Boulder', w: 30, h: 22, col: [[-3, -3, 8], [4, -2, 7]], d(c, th, v) { skShadow(c, 14, 4.5); const R = skRng(v * 17 + 9), P = []; for (let i = 0; i < 10; i++) { const a = Math.PI + i / 9 * Math.PI, r = 11 + R() * 3; P.push([Math.cos(a) * r * 1.15, -Math.abs(Math.sin(a)) * r + 1]); } skPoly(c, P, '#6f6b65'); c.fillStyle = '#8c877f'; c.beginPath(); for (let i = 1; i < 9; i++) c.lineTo(P[i][0] * 0.8, P[i][1] * 0.88 - 0.5); c.closePath(); c.fill(); if (th !== 'fort') { c.fillStyle = '#4f7a34'; c.beginPath(); c.ellipse(-2, P[5][1] * 0.9 + 1.5, 6, 2.2, -0.1, 0, 7); c.fill(); } } },
  stump: { n: 'Stump', w: 10, h: 8, col: [[0, -1, 2.8]], d(c) { skShadow(c, 4.5, 1.8); c.fillStyle = '#5b3d22'; c.fillRect(-3, -4, 6, 4); c.strokeStyle = OL; c.lineWidth = 0.4; c.strokeRect(-3, -4, 6, 4); c.fillStyle = '#c49a62'; c.beginPath(); c.ellipse(0, -4, 3, 1.2, 0, 0, 7); c.fill(); c.stroke(); c.strokeStyle = '#8a6a40'; c.lineWidth = 0.25; c.beginPath(); c.ellipse(0, -4, 1.6, 0.6, 0, 0, 7); c.stroke(); } },
  log: { n: 'Log', w: 24, h: 8, col: [[-6, -1.5, 3], [0, -1.5, 3], [6, -1.5, 3]], d(c, th, v) { skShadow(c, 11, 2); const X = 9, Y = -2.7, R = 2.6, E = 1.5;
    // bark: one cylinder, back end rounded off, the front end hidden under the cut face
    const body = () => { c.beginPath(); c.moveTo(X, Y - R); c.lineTo(-9, Y - R); c.ellipse(-9, Y, 1.3, R, 0, -Math.PI / 2, Math.PI / 2, true); c.lineTo(X, Y + R); c.ellipse(X, Y, E, R, 0, Math.PI / 2, -Math.PI / 2, true); c.closePath(); };
    const g = c.createLinearGradient(0, Y - R, 0, Y + R); g.addColorStop(0, '#7a5532'); g.addColorStop(0.45, '#5e3f24'); g.addColorStop(1, '#3b2715'); body(); c.fillStyle = g; c.fill();
    c.save(); body(); c.clip(); c.strokeStyle = 'rgba(30,18,8,.55)'; c.lineWidth = 0.28; c.lineCap = 'round';
    for (const [y0, a, b] of [[-4.4, -8, 7], [-3.4, -9, 4], [-2.5, -4, 8], [-1.5, -9, 2], [-0.8, -2, 8]]) { c.beginPath(); c.moveTo(a, y0); for (let x = a; x <= b; x += 1.5) c.lineTo(x, y0 + Math.sin(x * 1.3 + y0 * 3) * 0.18); c.stroke(); }
    c.strokeStyle = 'rgba(190,150,100,.35)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(-8.5, -4.8); c.lineTo(7.5, -4.85); c.stroke();
    if (v % 3 !== 2) { c.fillStyle = 'rgba(96,130,52,.75)'; c.beginPath(); c.ellipse(-3 + v * 2, -5, 3.2, 0.9, 0, 0, 7); c.fill(); }
    c.restore(); body(); c.strokeStyle = OL; c.lineWidth = 0.4; c.stroke();
    // a knot and a broken-off branch
    c.fillStyle = '#3a2614'; c.beginPath(); c.ellipse(-4.5 + (v % 3) * 3, -2.2, 0.9, 0.6, 0, 0, 7); c.fill(); c.strokeStyle = '#8a6438'; c.lineWidth = 0.2; c.stroke();
    c.fillStyle = '#5e3f24'; c.beginPath(); c.moveTo(2, -5.1); c.lineTo(3.2, -6.9); c.lineTo(4.1, -6.6); c.lineTo(3.6, -5.1); c.closePath(); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.3; c.stroke(); c.fillStyle = '#c99d66'; c.beginPath(); c.ellipse(3.65, -6.75, 0.5, 0.25, -0.3, 0, 7); c.fill();
    // the sawn face: pale wood, bark rim, growth rings, a check crack
    c.beginPath(); c.ellipse(X, Y, E, R, 0, 0, 7); c.fillStyle = '#d9b47c'; c.fill(); c.strokeStyle = '#4a3019'; c.lineWidth = 0.55; c.stroke(); c.strokeStyle = OL; c.lineWidth = 0.25; c.beginPath(); c.ellipse(X, Y, E + 0.28, R + 0.28, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.strokeStyle = '#b08350'; c.lineWidth = 0.18; for (const k of [0.72, 0.46, 0.22]) { c.beginPath(); c.ellipse(X + 0.05, Y + 0.1, E * k, R * k, 0, 0, 7); c.stroke(); }
    c.fillStyle = '#9a6c3c'; c.beginPath(); c.ellipse(X + 0.05, Y + 0.1, 0.25, 0.4, 0, 0, 7); c.fill(); c.strokeStyle = '#7a5230'; c.lineWidth = 0.15; c.beginPath(); c.moveTo(X + 0.05, Y + 0.1); c.lineTo(X + 0.6, Y - 1.9); c.stroke(); } },
  fence: { n: 'Fence', w: 26, h: 12, col: [[-9, -0.5, 2], [0, -0.5, 2], [9, -0.5, 2]], d(c) { for (const x of [-10, 0, 10]) skShadow(c, 1.8, 0.7, x); c.fillStyle = '#8a6a40'; c.strokeStyle = OL; c.lineWidth = 0.4; for (const y of [-7, -3.5]) { c.fillRect(-11, y - 0.8, 22, 1.6); c.strokeRect(-11, y - 0.8, 22, 1.6); } for (const x of [-10, 0, 10]) { c.fillStyle = '#6e5232'; c.fillRect(x - 0.9, -9.5, 1.8, 9.8); c.strokeRect(x - 0.9, -9.5, 1.8, 9.8); } } },
  wall: { n: 'Wall', w: 36, h: 18, col: [[-12, -2, 4.5], [-4, -2, 4.5], [4, -2, 4.5], [12, -2, 4.5]], d(c) { skShadow(c, 17, 2.4); c.fillStyle = '#5c5852'; c.fillRect(-16, -13, 32, 13); c.fillStyle = '#7d786f'; c.fillRect(-16, -15.5, 32, 3); c.strokeStyle = OL; c.lineWidth = 0.45; c.strokeRect(-16, -15.5, 32, 15.5);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.3; for (let r = 0; r < 4; r++) { const y = -12.5 + r * 3.2; c.beginPath(); c.moveTo(-16, y); c.lineTo(16, y); c.stroke(); for (let x = -16 + (r % 2) * 3; x < 16; x += 6) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 3.2); c.stroke(); } } } },
  block: { n: 'Wall block', w: 18, h: 16, col: [[0, -2, 6]], d(c) { c.fillStyle = '#4a4744'; c.fillRect(-7, -12, 14, 13); c.fillStyle = '#5d5955'; c.fillRect(-7, -12, 14, 3); c.strokeStyle = '#2c2a28'; c.lineWidth = 0.5; c.strokeRect(-7, -12, 14, 13); } },
  pillar: { n: 'Broken pillar', w: 16, h: 26, col: [[0, -1, 4]], d(c, th, v) { skShadow(c, 6.5, 2.2); c.fillStyle = '#8c867a'; c.fillRect(-5.5, -3, 11, 3); c.strokeStyle = OL; c.lineWidth = 0.4; c.strokeRect(-5.5, -3, 11, 3); const top = v === 1 ? -11 : -19; skPoly(c, [[-3.6, -3], [-3.6, top + 2], [-1.5, top], [0.6, top + 2.5], [2.2, top - 1], [3.6, top + 1.5], [3.6, -3]], '#a29b8d'); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.35; for (const x of [-1.8, 0, 1.8]) { c.beginPath(); c.moveTo(x, -3.5); c.lineTo(x, top + 3); c.stroke(); } c.fillStyle = '#8c867a'; c.beginPath(); c.ellipse(7, -1, 2.5, 1.3, 0.3, 0, 7); c.fill(); c.stroke(); } },
  house: { n: 'Hut', w: 52, h: 46, col: [[-14, -5, 8], [0, -5, 8], [14, -5, 8]], d(c, th, v) { skShadow(c, 24, 6, 2); c.fillStyle = '#b89a6a'; c.fillRect(-20, -18, 40, 18); c.strokeStyle = OL; c.lineWidth = 0.5; c.strokeRect(-20, -18, 40, 18); c.fillStyle = '#6e5232'; for (const x of [-20, -7, 7, 19]) c.fillRect(x - 0.6, -18, 1.4, 18); c.fillRect(-20, -10, 40, 1.2);
    c.fillStyle = '#3a2a1a'; c.fillRect(-4, -11, 8, 11); c.fillStyle = '#e8c56a'; c.fillRect(10, -14, 5, 4); c.strokeRect(10, -14, 5, 4); skPoly(c, [[-25, -17], [-15, -40], [15, -40], [25, -17]], v === 1 ? '#8a6a5a' : '#a8843c'); c.strokeStyle = 'rgba(60,40,10,.45)'; c.lineWidth = 0.4; for (let i = -22; i < 24; i += 3) { c.beginPath(); c.moveTo(i, -17.5); c.lineTo(i * 0.62, -39); c.stroke(); } c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-20, -18, 40, 2.5); } },
  tent: { n: 'Tent', w: 34, h: 24, col: [[-6, -3, 7], [6, -3, 7]], d(c, th, v) { skShadow(c, 15, 4); skPoly(c, [[-15, 0], [0, -20], [15, 0]], v === 1 ? '#9a8a6a' : '#c9b48a'); skPoly(c, [[-4, 0], [0, -11], [4, 0]], '#3a2e20', null); c.strokeStyle = v === 1 ? '#5a6a3a' : '#a83a2a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-10, -6.7); c.lineTo(0, -20); c.lineTo(10, -6.7); c.stroke(); c.strokeStyle = '#5b3d22'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -23); c.stroke(); } },
  crate: { n: 'Crate', w: 10, h: 10, col: [[0, -1, 3.2]], d(c) { skShadow(c, 4.5, 1.6); c.fillStyle = '#a07a46'; c.fillRect(-3.5, -7, 7, 7); c.strokeStyle = OL; c.lineWidth = 0.4; c.strokeRect(-3.5, -7, 7, 7); c.strokeStyle = '#6e5232'; c.beginPath(); c.moveTo(-3.5, -7); c.lineTo(3.5, 0); c.moveTo(3.5, -7); c.lineTo(-3.5, 0); c.stroke(); c.fillStyle = '#c49a62'; c.fillRect(-3.5, -8.2, 7, 1.2); } },
  barrel: { n: 'Barrel', w: 9, h: 10, col: [[0, -1, 2.8]], d(c) { skShadow(c, 3.8, 1.4); c.fillStyle = '#7e5a30'; c.beginPath(); c.roundRect(-3, -7.5, 6, 7.5, 1.5); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.4; c.stroke(); c.fillStyle = '#4a4744'; c.fillRect(-3.1, -6.3, 6.2, 0.8); c.fillRect(-3.1, -2, 6.2, 0.8); c.fillStyle = '#5b3d22'; c.beginPath(); c.ellipse(0, -7.5, 3, 0.9, 0, 0, 7); c.fill(); c.stroke(); } },
  grave: { n: 'Grave', w: 10, h: 12, col: [[0, -1, 2.2]], d(c, th, v) { c.fillStyle = '#5a4630'; c.beginPath(); c.ellipse(0, 1.5, 4, 1.8, 0, 0, 7); c.fill(); skPoly(c, [[-2.8, 0], [-2.8, -6.5], [-1.5, -8.5], [1.5, -8.5], [2.8, -6.5], [2.8, 0]], v === 1 ? '#7a776f' : '#8e8a80'); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(0, -6.8); c.lineTo(0, -3); c.moveTo(-1.2, -5.5); c.lineTo(1.2, -5.5); c.stroke(); } },
  cart: { n: 'Cart', w: 30, h: 16, col: [[-5, -2, 5], [5, -2, 5]], d(c) { skShadow(c, 13, 3); c.fillStyle = '#8a6a40'; c.fillRect(-11, -10, 22, 6); c.strokeStyle = OL; c.lineWidth = 0.45; c.strokeRect(-11, -10, 22, 6); c.strokeStyle = '#6e5232'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(11, -6); c.lineTo(17, -3.5); c.stroke(); for (const x of [-6, 6]) { c.fillStyle = '#5b3d22'; c.beginPath(); c.arc(x, -3, 3.3, 0, 7); c.fill(); c.strokeStyle = OL; c.lineWidth = 0.4; c.stroke(); c.strokeStyle = '#a07a46'; c.beginPath(); c.arc(x, -3, 2, 0, 7); c.stroke(); } c.fillStyle = '#c9b48a'; c.beginPath(); c.ellipse(-3, -11, 5, 2, 0, 0, 7); c.fill(); } },
  banner: { n: 'Banner', w: 12, h: 26, col: [[0, -0.5, 1.2]], d(c, th, v) { skShadow(c, 2.5, 1); c.strokeStyle = '#4e3520'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -24); c.stroke(); skPoly(c, [[0.5, -23], [8, -22], [7, -16], [8.5, -11], [0.5, -12]], v === 1 ? '#2a4a8a' : '#a8302a'); c.fillStyle = '#e8c56a'; c.beginPath(); c.arc(4, -17, 1.5, 0, 7); c.fill(); } },
  brazier: { n: 'Brazier', w: 12, h: 18, col: [[0, -0.5, 2.5]], d(c) { skShadow(c, 4, 1.4); c.strokeStyle = '#2a2724'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-2.5, 0); c.lineTo(0, -6); c.lineTo(2.5, 0); c.moveTo(0, 0); c.lineTo(0, -6); c.stroke(); skPoly(c, [[-4, -7], [4, -7], [3, -5], [-3, -5]], '#3c3a36'); c.fillStyle = '#f2891c'; c.beginPath(); c.moveTo(-3.2, -7); c.quadraticCurveTo(-2.5, -12, 0, -15); c.quadraticCurveTo(1.5, -11, 3.2, -7); c.fill(); c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(-1.6, -7); c.quadraticCurveTo(-1, -10, 0.2, -12); c.quadraticCurveTo(1, -9.5, 1.6, -7); c.fill(); } },
  tuft: { n: 'Grass tuft', w: 10, h: 6, col: [], flat: 1, d(c, th, v) { c.strokeStyle = th === 'wood' ? '#3c6a2a' : '#5e9c42'; c.lineWidth = 0.6; c.lineCap = 'round'; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 0.9, 0); c.quadraticCurveTo(i * 1.2, -2, i * 1.6 + (v - 1) * 0.5, -3.8 + Math.abs(i) * 0.4); c.stroke(); } } },
  flowers: { n: 'Flowers', w: 12, h: 6, col: [], flat: 1, d(c, th, v) { const cols = [['#f2e05a', '#fff'], ['#d65a8a', '#f7d6e3'], ['#7aa0f0', '#fff']][v % 3]; for (const [x, y] of [[-3, -1], [0, -2.2], [2.8, -0.8], [-1, 0.5], [1.5, 0.8]]) { c.fillStyle = '#4f8a34'; c.fillRect(x - 0.15, y, 0.3, 1.2); c.fillStyle = cols[0]; c.beginPath(); c.arc(x, y, 0.8, 0, 7); c.fill(); c.fillStyle = cols[1]; c.beginPath(); c.arc(x, y, 0.3, 0, 7); c.fill(); } } },
  bones: { n: 'Bones', w: 12, h: 6, col: [], flat: 1, d(c) { c.strokeStyle = '#e6dcc0'; c.lineWidth = 0.7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, 0); c.lineTo(1, -1.2); c.moveTo(-1, 0.8); c.lineTo(3, 1.5); c.stroke(); c.fillStyle = '#e6dcc0'; c.beginPath(); c.arc(3.8, -1, 1.4, 0, 7); c.fill(); c.fillStyle = '#2a2420'; c.fillRect(3.2, -1.4, 0.5, 0.5); c.fillRect(4.1, -1.4, 0.5, 0.5); } },
};
const SKPLIST = Object.keys(SKP).filter(k => k !== 'block');
// prop sprites: one canvas per kind / look / variant / flip / size step, drawn at SKPR pixels per unit
const SKPR = 6, SKPS = new Map();
function skSprite(k, th, s, f, v) { s = Math.round(s * 10) / 10; const key = k + th + s + f + v; let o = SKPS.get(key); if (o) return o; const P = SKP[k]; if (!P) return null;
  o = document.createElement('canvas'); const W2 = P.w * s, H2 = (P.h + 4) * s; o.width = Math.ceil(W2 * SKPR); o.height = Math.ceil(H2 * SKPR); const g = o.getContext('2d'); g.setTransform(SKPR * s * (f ? -1 : 1), 0, 0, SKPR * s, o.width / 2, P.h * s * SKPR); P.d(g, th, v || 0);
  o.ax = W2 / 2; o.ay = P.h * s; o.ww = W2; o.wh = H2; SKPS.set(key, o); return o; }
function skDrawProp(c, S, p) { const [k, x, y, s = 1, f = 0, v = 0] = p, o = skSprite(k, S.th, s, f, v); if (o) c.drawImage(o, x - o.ax, y - o.ay, o.ww, o.wh); }
// solid prop circles in buckets of 64 units, for pushing people out
function skSolids(S) { const X = skX(S); if (X.pb && X.pbo === S.O) return X.pb; const B = new Map(); for (const p of S.O || []) { const P = SKP[p[0]]; if (!P || !P.col.length) continue; const s = p[3] || 1, f = p[4] ? -1 : 1;
    for (const [dx, dy, r] of P.col) { const cx = p[1] + dx * s * f, cy = p[2] + dy * s, R = r * s; for (let by = Math.floor((cy - R) / 64); by <= Math.floor((cy + R) / 64); by++) for (let bx = Math.floor((cx - R) / 64); bx <= Math.floor((cx + R) / 64); bx++) { const k = bx + ',' + by; (B.get(k) || B.set(k, []).get(k)).push([cx, cy, R]); } } }
  X.pb = B; X.pbo = S.O; return B; }
function skPush(S, o, rad) { const L = skSolids(S).get(Math.floor(o.x / 64) + ',' + Math.floor(o.y / 64)); if (!L) return; for (const [cx, cy, R] of L) { const dx = o.x - cx, dy = (o.y - cy) * 1.6, d = Math.hypot(dx, dy), m = R + rad; if (d < m && d > 0.001) { o.x = cx + dx / d * m; o.y = cy + dy / d * m / 1.6; } } }
// edge decor: trees (or wall blocks in a fort) on the void just outside the walkable ground, generated from the grid
function skEdge(S) { const X = skX(S); if (X.ed) return X.ed; const D = [], th = S.th, at = (i, j) => (i < 0 || j < 0 || i >= S.gw || j >= S.gh) ? 0 : X.a[j * S.gw + i];
  for (let j = 0; j < S.gh; j++) for (let i = 0; i < S.gw; i++) { if (at(i, j) !== 0) continue; let near = 9; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (skWalkC(at(i + di, j + dj))) near = Math.min(near, Math.max(Math.abs(di), Math.abs(dj))); if (near > 2) continue;
    const h = skHash(i, j, 7), x = S.gx + (i + 0.5 + (skHash(i, j, 1) - 0.5) * 0.8) * SKC, y = S.gy + (j + 0.5 + (skHash(i, j, 2) - 0.5) * 0.8) * SKC, v = Math.floor(skHash(i, j, 3) * 3);
    const ez = (S.ez || []).find(q => x >= q[0] && x < q[1]), es = ez ? ez[2] : th === 'fort' ? 'blocks' : th;
    if (es === 'blocks') { if (near === 1 && h < 0.75) D.push(['block', x, y, 1, 0, 0]); continue; }
    if (near === 1 ? h < 0.55 : h < 0.28) { const r = skHash(i, j, 4), k = es === 'wood' ? (r < 0.55 ? 'pine' : r < 0.9 ? 'tree' : 'dead') : (r < 0.6 ? 'tree' : r < 0.85 ? 'pine' : 'bush'); D.push([k, x, y, 0.9 + skHash(i, j, 5) * 0.35, skHash(i, j, 6) < 0.5 ? 1 : 0, v]); } }
  X.ed = D; return D; }
// ---- the stage generator: a corridor along `pts` [x, y, half-width], clearings for the locks, a road down the middle, props, enemies, spawn points ----
function skGen(sp) { const R = skRng(sp.seed || 1), th = sp.th, pts = sp.pts;
  const pathY = x => { for (let k = 0; k < pts.length - 1; k++) if (x <= pts[k + 1][0]) { const u = Math.max(0, (x - pts[k][0]) / (pts[k + 1][0] - pts[k][0])); return pts[k][1] + (pts[k + 1][1] - pts[k][1]) * (u * u * (3 - 2 * u)); } return pts[pts.length - 1][1]; };
  sp = Object.assign({}, sp, { locks: sp.locks.map(L => Object.assign({}, L, { y: L.y ?? pathY(L.x) + (L.dy || 0) })), groups: (sp.groups || []).map(([x, dy, str]) => [x, pathY(x) + dy, str]), pools: (sp.pools || []).map(([x, dy, r, c]) => [x, pathY(x) + dy, r, c]), extra: (sp.extra || []).map(p => p[6] ? [p[0], p[1], Math.round(pathY(p[1]) + p[2]), p[3], p[4], p[5]] : p), start: sp.start || [260, pathY(260)] });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y, w] of pts) { x0 = Math.min(x0, x - w - 260); y0 = Math.min(y0, y - w - 260); x1 = Math.max(x1, x + w + 260); y1 = Math.max(y1, y + w + 260); }
  for (const L of sp.locks) { x0 = Math.min(x0, L.x - L.w / 2 - 260); y0 = Math.min(y0, L.y - L.h / 2 - 260); x1 = Math.max(x1, L.x + L.w / 2 + 260); y1 = Math.max(y1, L.y + L.h / 2 + 260); }
  const gx = Math.floor(x0 / SKC) * SKC, gy = Math.floor(y0 / SKC) * SKC, gw = Math.ceil((x1 - gx) / SKC), gh = Math.ceil((y1 - gy) / SKC), a = new Uint8Array(gw * gh);
  const segD = (x, y) => { let best = 1e9, hw = 0, t0 = 0; for (let k = 0; k < pts.length - 1; k++) { const [ax, ay, aw] = pts[k], [bx, by, bw] = pts[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), d = Math.hypot(x - ax - dx * u, y - ay - dy * u); if (d < best) { best = d; hw = aw + (bw - aw) * u; t0 = k + u; } } return [best, hw, t0]; };
  const noise = (x, y, s) => { const f = (q, w) => Math.sin(q * 0.013 + s) * 0.5 + Math.sin(w * 0.021 + q * 0.007 + s * 2) * 0.35 + Math.sin((q + w) * 0.037 + s * 3) * 0.15; return f(x, y); };
  const Z = x => { const z = (sp.zones || []).find(q => x >= q[0] && x < q[1]); return z ? Object.assign({}, sp, z[2]) : sp; };
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = gx + (i + 0.5) * SKC, y = gy + (j + 0.5) * SKC, [d, hw] = segD(x, y); let c = 0;
    const z = Z(x), base = z.base || 1; if (d < hw + noise(x, y, 1) * 26) c = base;
    for (const L of sp.locks) { const ex = (x - L.x) / (L.w / 2 + 30 + noise(x, y, 2) * 22), ey = (y - L.y) / (L.h / 2 + 30 + noise(y, x, 3) * 22); if (ex * ex + ey * ey < 1) c = c || base; }
    if (c && z.patch && noise(x * 1.7, y * 1.7, 5) > 0.42) c = z.patch;
    if (c && z.roadW !== 0 && d < (z.roadW || 18) + noise(x, y, 4) * 5) c = z.road || 2;
    for (const [px, py, pr, pc] of sp.pools || []) if (Math.hypot(x - px, (y - py) * 1.4) < pr + noise(x, y, 6) * 10) c = pc || 6;
    a[j * gw + i] = c; }
  const S = { v: 2, ez: (sp.zones || []).filter(q => q[2].edge).map(q => [q[0], q[1], q[2].edge]), id: sp.id, name: sp.name, blurb: sp.blurb, th, mul: sp.mul, mp: sp.mp, S: sp.start, gx, gy, gw, gh, g: skEnc(a), O: [], U: [], L: [], SP: [] };
  const X = skX(S), walk = (x, y) => skWalk(S, x, y), inLock = (x, y, m = 20) => sp.locks.some(L => Math.abs(x - L.x) < L.w / 2 + m && Math.abs(y - L.y) < L.h / 2 + m);
  // props: scattered on the ground near its edges, clear of the road and the lock floors
  for (let n = 0; n < (sp.props || 260); n++) { const x = gx + R() * gw * SKC, y = gy + R() * gh * SKC; if (!walk(x, y)) continue; const [d, hw] = segD(x, y), z = Z(x), SC = z.scatter || [['tree', 3], ['bush', 2], ['rock', 2], ['tuft', 4], ['flowers', 2]], tot = SC.reduce((s2, q) => s2 + q[1], 0); let r = R() * tot, k = SC[0][0]; for (const [kk, wgt] of SC) { r -= wgt; if (r <= 0) { k = kk; break; } }
    const flat = SKP[k] && SKP[k].flat, rw = z.roadW === 0 ? 0 : (z.roadW || 18); if (!flat && (d < rw + 14 || inLock(x, y, 10) || d < hw * 0.45)) continue; if (flat && d < rw) continue;
    S.O.push([k, Math.round(x), Math.round(y), Math.round((0.85 + R() * 0.3) * 10) / 10, R() < 0.5 ? 1 : 0, Math.floor(R() * 3)]); }
  for (const p of sp.extra || []) S.O.push(p);
  // locks, their pre-placed enemies and spawn points along the tree line round them
  const put = (str, cx, cy, rad) => { for (const [k, n] of skParse(str)) for (let q = 0; q < n; q++) { const a2 = R() * 6.28, d2 = Math.sqrt(R()) * rad; let [x, y] = skNear(S, cx + Math.cos(a2) * d2, cy + Math.sin(a2) * d2 * 0.7); S.U.push([k, Math.round(x), Math.round(y)]); } };
  for (const L of sp.locks) { S.L.push({ x: L.x, y: L.y, w: L.w, h: L.h, wv: L.wv.slice(), boss: L.boss }); if (L.pre) put(L.pre, L.x, L.y, Math.min(L.w, L.h) * 0.3);
    const types = L.sp || (th === 'fort' ? ['gate', 'gate'] : ['woods', 'woods', 'woods']);
    types.forEach((tp, q) => { const side = q % 2 ? -1 : 1; let best = null; for (let t = 0; t < 40; t++) { const x = L.x + (R() - 0.5) * L.w * 0.8, y = L.y + side * (L.h / 2 - 10 - R() * 50); if (!walk(x, y)) continue; let e = 0; for (let k = 1; k < 8; k++) if (!walk(x, y + side * k * SKC)) { e = k; break; } if (e && (!best || e < best[2])) best = [x, y, e]; } if (best) S.SP.push([tp, Math.round(best[0]), Math.round(best[1])]); }); }
  for (const [x, y, str] of sp.groups || []) put(str, x, y, 30);
  return S; }
window.__sk = { skEdge, skChunk, skX, skGround, skSprite, skGen };
// the four players' spawn spots: the stage's own (S.P) or, for an older stage, a little diamond round its start
const SKPOFF = [[0, 0], [30, -18], [30, 18], [60, 0]];
const skPS = S => { const s0 = S.S || [260, 400]; return SKPOFF.map((o, j) => (S.P && S.P[j]) || [s0[0] + o[0], s0[1] + o[1]]); };
