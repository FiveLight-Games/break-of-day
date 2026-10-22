// ===================== Map designer (DRAFT 2026-10-22) =====================
// Inlined into knights.html by build.py (at /*@STAGEDIT@*/, after campaign.js). Edits the campaign's STAGES in place:
// walkable areas (rects), the road, the start point, fights (rings with waves) and groups (enemies standing about, no ring).
// Saved on this device in localStorage 'kn_stages' (the whole stage list); 'Copy' puts the JSON on the clipboard to paste to Claude.
// The host sends the stage it's playing to guests in the snapshot (`cs`), so designed stages work online too.
const SEDDEF = JSON.parse(JSON.stringify(STAGES));
try { const s = JSON.parse(localStorage.getItem('kn_stages') || 'null'); if (Array.isArray(s) && s.length) { STAGES.length = 0; s.forEach(x => STAGES.push(x)); } } catch (e) { }
const SED = { on: 0, i: 0, tool: 'sel', sel: null, cam: { x: 900, y: 250, s: 0.5 }, ptr: new Map(), hist: [], fut: [], drag: null, pinch: null };
const sedS = () => STAGES[SED.i];
const sedKinds = () => Object.keys(UK).filter(k => UK[k] && UK[k].n).sort((a, b) => (UK[a].hp || 0) - (UK[b].hp || 0));
const sedSave = () => { try { localStorage.setItem('kn_stages', JSON.stringify(STAGES.map(s => sedClean(s)))); } catch (e) { } CPDEC = null; CPUI.last = ''; };
const sedClean = s => JSON.parse(JSON.stringify(s, (k, v) => k === 'i' ? undefined : v));
function sedPush() { SED.hist.push(JSON.stringify(sedS())); if (SED.hist.length > 60) SED.hist.shift(); SED.fut = []; }
function sedDone() { sedSave(); sedPanel(); }
const sedWaves = e => e.w.map(s => cpParse(s));
const sedWStr = L => L.filter(([k, n]) => n > 0).map(([k, n]) => k + '*' + n).join(',');
function sedCss() { if (document.getElementById('sedCss')) return; const s = document.createElement('style'); s.id = 'sedCss'; s.textContent = `
body.live .sedBtn{display:none !important}
#sed{position:fixed;inset:0;z-index:80;display:none;flex-direction:column;background:#0d110b;color:#f3ead2;font:600 13px system-ui,sans-serif}
#sed .bar{display:flex;gap:6px;align-items:center;padding:6px;flex-wrap:wrap;background:#1a2015;border-bottom:1px solid #3a3a2a}
#sed button,#sed select,#sed input{font:700 13px system-ui;border-radius:8px;border:1px solid #6a5a36;background:#2a2615;color:#f3ead2;padding:7px 10px}
#sed button.on{background:#6a4a1a;border-color:#ffd36a;color:#fff}#sed button.pri{background:#3d6a2a;border-color:#8ad06a}
#sed .cvw{position:relative;flex:1;min-height:0}#sed canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
#sed .tools{display:flex;gap:6px;padding:6px;overflow-x:auto;background:#1a2015;border-top:1px solid #3a3a2a}
#sed .tools button{flex:0 0 auto}
#sed .sedp{position:absolute;left:6px;right:6px;bottom:6px;max-height:46%;overflow:auto;background:#141a12f2;border:1px solid #c9a65a;border-radius:12px;padding:10px;touch-action:pan-y}
#sed .sedp *{touch-action:pan-y}
#sed .sedp h3{margin:0 0 6px;font:800 15px system-ui;display:flex;justify-content:space-between;align-items:center;gap:6px}
#sed .sedp .wv{border:1px solid #3a3a2a;border-radius:10px;padding:6px;margin:6px 0;background:#1d2418}
#sed .sedp .wv b{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
#sed .sedp .en{display:flex;align-items:center;gap:6px;margin:3px 0}#sed .sedp .en span{flex:1}
#sed .sedp .en button{padding:4px 10px;min-width:34px}
#sed .sedp label{display:flex;align-items:center;gap:8px;margin:5px 0}#sed .sedp input[type=range]{flex:1}
#sed .hint{position:absolute;left:0;right:0;top:6px;text-align:center;pointer-events:none;font:700 12px system-ui;color:#ffe9b0;text-shadow:0 1px 3px #000}
#sedTxt{position:absolute;inset:10%;z-index:2;display:none;flex-direction:column;gap:6px;background:#141a12;border:1px solid #c9a65a;border-radius:12px;padding:10px}#sedTxt textarea{flex:1;font:11px monospace;background:#0a0d08;color:#cfe;border-radius:8px}`;
  document.head.appendChild(s); }
function sedOpen(i) { sedCss(); SED.on = 1; SED.i = cl(i | 0, 0, STAGES.length - 1); SED.sel = null; SED.hist = []; SED.fut = []; let el = document.getElementById('sed');
  if (!el) { el = document.createElement('div'); el.id = 'sed'; document.body.appendChild(el);
    el.innerHTML = `<div class="bar"><select id="sedSt"></select><button id="sedNew">+ Stage</button><button id="sedUndo">↶</button><button id="sedRedo">↷</button><button class="pri" id="sedPlay">▶ Play</button><button id="sedCopy">Copy</button><button id="sedClose">Close</button></div>
      <div class="cvw"><canvas id="sedCv"></canvas><div class="hint" id="sedHint"></div><div class="sedp scrollOk" id="sedPnl"></div><div id="sedTxt"><b>Stage data (copy this and paste it to Claude)</b><textarea id="sedTa" readonly></textarea><button id="sedTxC">Close</button></div></div>
      <div class="tools">${[['sel', 'Select / move'], ['area', '+ Area'], ['road', '+ Road'], ['fight', '+ Fight'], ['group', '+ Group'], ['start', 'Start']].map(([k, n]) => `<button data-t="${k}">${n}</button>`).join('')}<button id="sedFit">Fit</button></div>`;
    const $ = id => document.getElementById(id);
    $('sedSt').onchange = e => { SED.i = +e.target.value; SED.sel = null; SED.hist = []; SED.fut = []; sedFit(); sedPanel(); };
    $('sedNew').onclick = () => { const n = STAGES.length; STAGES.push({ id: 'st' + Date.now().toString(36), name: 'Stage ' + (n + 1), blurb: '', th: 'grass', mul: 1, S: [200, 230], R: [[110, 110, 900, 400]], P: [[160, 250], [860, 250]], E: [{ x: 700, y: 250, r: 110, w: ['foot*4'] }] }); SED.i = n; SED.sel = null; sedSave(); sedFit(); sedPanel(); };
    $('sedUndo').onclick = () => { if (!SED.hist.length) return; SED.fut.push(JSON.stringify(sedS())); STAGES[SED.i] = JSON.parse(SED.hist.pop()); SED.sel = null; sedDone(); };
    $('sedRedo').onclick = () => { if (!SED.fut.length) return; SED.hist.push(JSON.stringify(sedS())); STAGES[SED.i] = JSON.parse(SED.fut.pop()); SED.sel = null; sedDone(); };
    $('sedClose').onclick = sedClose; $('sedFit').onclick = sedFit;
    $('sedCopy').onclick = () => { const j = JSON.stringify(STAGES.map(sedClean)); $('sedTa').value = j; $('sedTxt').style.display = 'flex'; try { navigator.clipboard.writeText(j).then(() => sedHint('Copied: paste it to Claude to make these the game\'s stages'), () => { }); } catch (e) { } };
    $('sedTxC').onclick = () => { $('sedTxt').style.display = 'none'; };
    $('sedPlay').onclick = sedPlay;
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { SED.tool = b.dataset.t; SED.sel = null; sedTools(); sedPanel(); });
    const cv2 = $('sedCv'); cv2.addEventListener('pointerdown', sedDown); cv2.addEventListener('pointermove', sedMove); cv2.addEventListener('pointerup', sedUp); cv2.addEventListener('pointercancel', sedUp);
    cv2.addEventListener('wheel', e => { e.preventDefault(); const [wx, wy] = sedW(e.offsetX, e.offsetY); SED.cam.s = cl(SED.cam.s * Math.exp(-e.deltaY * 0.0015), 0.08, 3); const [wx2, wy2] = sedW(e.offsetX, e.offsetY); SED.cam.x += wx - wx2; SED.cam.y += wy - wy2; }, { passive: false }); }
  el.style.display = 'flex'; sedTools(); sedFit(); sedPanel(); requestAnimationFrame(sedDraw); }
function sedClose() { SED.on = 0; const el = document.getElementById('sed'); if (el) el.style.display = 'none'; CPUI.last = ''; }
function sedPlay() { const i = SED.i; sedClose();
  if (BH.on && BH.cp) { if (AUTH()) { CMP.sel = i; cpBegin(i); } return; }
  BHMODE = 'camp'; try { localStorage.setItem('kn_mode', 'camp'); } catch (e) { } startGame(1, 0); setTimeout(() => { if (BH.cp) { CMP.sel = i; cpBegin(i); } }, 80); }
let sedHT = 0; function sedHint(t) { const h = document.getElementById('sedHint'); if (h) { h.textContent = t; clearTimeout(sedHT); sedHT = setTimeout(() => { h.textContent = sedTip(); }, 2500); } }
const sedTip = () => ({ sel: 'Tap something to select it · drag it to move · drag empty ground to pan · pinch to zoom', area: 'Drag to draw a walkable area', road: 'Tap to add road points (in order)', fight: 'Tap to place a fight (a ring that locks everyone in)', group: 'Tap to place a group (enemies standing about)', start: 'Tap where the players start' })[SED.tool];
function sedTools() { document.querySelectorAll('#sed [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === SED.tool)); const h = document.getElementById('sedHint'); if (h) h.textContent = sedTip();
  const st = document.getElementById('sedSt'); st.innerHTML = STAGES.map((s, i) => `<option value="${i}" ${i === SED.i ? 'selected' : ''}>${i + 1}. ${s.name}</option>`).join(''); }
function sedFit() { const S = sedS(), cv2 = document.getElementById('sedCv'); if (!S || !cv2) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of S.R) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
  if (!S.S) S.S = [200, 230]; const W = cv2.clientWidth || 400, H = cv2.clientHeight || 400; SED.cam.s = cl(Math.min(W / (x1 - x0 + 80), H * 0.55 / (y1 - y0 + 80)), 0.08, 3); SED.cam.x = (x0 + x1) / 2; SED.cam.y = (y0 + y1) / 2 + H * 0.2 / SED.cam.s; }
const sedW = (sx, sy) => { const cv2 = document.getElementById('sedCv'); return [SED.cam.x + (sx - cv2.clientWidth / 2) / SED.cam.s, SED.cam.y + (sy - cv2.clientHeight / 2) / SED.cam.s]; };
const sedSc = (wx, wy) => { const cv2 = document.getElementById('sedCv'); return [(wx - SED.cam.x) * SED.cam.s + cv2.clientWidth / 2, (wy - SED.cam.y) * SED.cam.s + cv2.clientHeight / 2]; };
// ---- picking ----
function sedPick(sx, sy) { const S = sedS(), P = (x, y) => Math.hypot(...((p => [p[0] - sx, p[1] - sy])(sedSc(x, y)))), R = 16;
  if (SED.sel && SED.sel.t === 'rect') { const r = S.R[SED.sel.i]; if (r) for (const [c, x, y] of [[0, r[0], r[1]], [1, r[2], r[1]], [2, r[0], r[3]], [3, r[2], r[3]]]) if (P(x, y) < R) return { t: 'corner', i: SED.sel.i, c }; }
  if (SED.sel && (SED.sel.t === 'fight')) { const e = S.E[SED.sel.i]; if (e && P(e.x + e.r, e.y) < R) return { t: 'rad', i: SED.sel.i }; }
  for (let i = S.E.length - 1; i >= 0; i--) { const e = S.E[i]; if (P(e.x, e.y) < R + 4) return { t: e.g ? 'group' : 'fight', i }; }
  if (S.S && P(S.S[0], S.S[1]) < R) return { t: 'start' };
  for (let i = 0; i < S.P.length; i++) if (P(S.P[i][0], S.P[i][1]) < R - 4) return { t: 'road', i };
  for (let i = S.E.length - 1; i >= 0; i--) { const e = S.E[i]; if (!e.g) { const [wx, wy] = sedW(sx, sy); if (Math.hypot(wx - e.x, (wy - e.y) / ARY) < e.r) return { t: 'fight', i }; } }
  const [wx, wy] = sedW(sx, sy); for (let i = S.R.length - 1; i >= 0; i--) { const r = S.R[i]; if (wx >= r[0] && wx <= r[2] && wy >= r[1] && wy <= r[3]) return { t: 'rect', i }; }
  return null; }
function sedDown(e) { const cv2 = e.target; cv2.setPointerCapture(e.pointerId); SED.ptr.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (SED.ptr.size === 2) { const [a, b] = [...SED.ptr.values()]; SED.drag = null; SED.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: SED.cam.s, m: sedW((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; return; }
  const sx = e.offsetX, sy = e.offsetY, [wx, wy] = sedW(sx, sy), S = sedS(), T = SED.tool;
  if (T === 'area') { sedPush(); S.R.push([wx, wy, wx, wy]); SED.drag = { k: 'newrect', i: S.R.length - 1, x0: wx, y0: wy }; return; }
  if (T === 'road') { sedPush(); S.P.push([Math.round(wx), Math.round(wy)]); SED.sel = { t: 'road', i: S.P.length - 1 }; sedDone(); return; }
  if (T === 'fight' || T === 'group') { sedPush(); S.E.push(T === 'fight' ? { x: Math.round(wx), y: Math.round(wy), r: 110, w: ['foot*4'] } : { g: 1, x: Math.round(wx), y: Math.round(wy), w: ['foot*3'] }); SED.sel = { t: T, i: S.E.length - 1 }; SED.tool = 'sel'; sedTools(); sedDone(); return; }
  if (T === 'start') { sedPush(); S.S = [Math.round(wx), Math.round(wy)]; SED.sel = { t: 'start' }; SED.tool = 'sel'; sedTools(); sedDone(); return; }
  const h = sedPick(sx, sy);
  if (h) { if (h.t !== 'corner' && h.t !== 'rad') SED.sel = h; SED.drag = { k: 'move', h, wx, wy, pushed: 0 }; sedPanel(); }
  else { SED.drag = { k: 'pan', sx, sy, cx: SED.cam.x, cy: SED.cam.y, moved: 0 }; } }
function sedMove(e) { if (!SED.ptr.has(e.pointerId)) return; SED.ptr.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (SED.pinch && SED.ptr.size >= 2) { const [a, b] = [...SED.ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); SED.cam.s = cl(SED.pinch.s * d / Math.max(1, SED.pinch.d), 0.08, 3); const [wx, wy] = sedW((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); SED.cam.x += SED.pinch.m[0] - wx; SED.cam.y += SED.pinch.m[1] - wy; return; }
  const D = SED.drag; if (!D) return; const [wx, wy] = sedW(e.offsetX, e.offsetY), S = sedS();
  if (D.k === 'pan') { SED.cam.x = D.cx - (e.offsetX - D.sx) / SED.cam.s; SED.cam.y = D.cy - (e.offsetY - D.sy) / SED.cam.s; if (Math.hypot(e.offsetX - D.sx, e.offsetY - D.sy) > 6) D.moved = 1; return; }
  if (D.k === 'newrect') { S.R[D.i] = [Math.round(Math.min(D.x0, wx)), Math.round(Math.min(D.y0, wy)), Math.round(Math.max(D.x0, wx)), Math.round(Math.max(D.y0, wy))]; return; }
  if (D.k === 'move') { const dx = wx - D.wx, dy = wy - D.wy; if (!D.pushed) { if (Math.hypot(dx, dy) * SED.cam.s < 4) return; sedPush(); D.pushed = 1; } D.wx = wx; D.wy = wy; const h = D.h, R = v => Math.round(v);
    if (h.t === 'fight' || h.t === 'group') { const q = S.E[h.i]; q.x = R(q.x + dx); q.y = R(q.y + dy); q.x0 = undefined; }
    else if (h.t === 'start') { S.S = [R(S.S[0] + dx), R(S.S[1] + dy)]; }
    else if (h.t === 'road') { S.P[h.i] = [R(S.P[h.i][0] + dx), R(S.P[h.i][1] + dy)]; }
    else if (h.t === 'rect') { const r = S.R[h.i]; S.R[h.i] = [R(r[0] + dx), R(r[1] + dy), R(r[2] + dx), R(r[3] + dy)]; }
    else if (h.t === 'corner') { const r = S.R[h.i]; if (h.c === 0 || h.c === 2) r[0] = R(wx); else r[2] = R(wx); if (h.c < 2) r[1] = R(wy); else r[3] = R(wy); }
    else if (h.t === 'rad') { const q = S.E[h.i]; q.r = R(cl(Math.hypot(wx - q.x, (wy - q.y) / ARY), 40, 400)); sedPanel(); } } }
function sedUp(e) { SED.ptr.delete(e.pointerId); if (SED.ptr.size < 2) SED.pinch = null; const D = SED.drag; SED.drag = null; if (!D) return; const S = sedS();
  if (D.k === 'newrect') { const r = S.R[D.i]; if (r[2] - r[0] < 30 || r[3] - r[1] < 30) { S.R.splice(D.i, 1); SED.hist.pop(); sedHint('Drag further to draw an area'); } else { r.forEach((v, j) => r[j] = Math.round(v)); SED.sel = { t: 'rect', i: D.i }; } sedDone(); return; }
  if (D.k === 'pan' && !D.moved) { SED.sel = null; sedPanel(); return; }
  if (D.k === 'move') { if (D.h.t === 'corner') { const r = S.R[D.h.i]; S.R[D.h.i] = [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])]; } sedDone(); } }
// ---- the panel for the selection (or the stage itself) ----
function sedPanel() { const el = document.getElementById('sedPnl'); if (!el) return; const S = sedS(), sel = SED.sel, K = sedKinds(), opt = (cur) => K.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${UK[k].n}</option>`).join(''); let h = '';
  const sc0 = el.scrollTop;
  if (!sel) { h = `<h3>Stage ${SED.i + 1}<span><button id="sDelSt">Delete stage</button></span></h3>
    <label>Name <input id="sNm" value="${(S.name || '').replace(/"/g, '&quot;')}" style="flex:1"></label>
    <label>Description <input id="sBl" value="${(S.blurb || '').replace(/"/g, '&quot;')}" style="flex:1"></label>
    <label>Look <select id="sTh">${['grass', 'wood', 'fort'].map(t => `<option ${S.th === t ? 'selected' : ''} value="${t}">${{ grass: 'Grassland', wood: 'Forest', fort: 'Fortress' }[t]}</option>`).join('')}</select></label>
    <label>Enemy health ×<input id="sMul" type="number" step="0.05" min="0.2" max="10" value="${S.mul || 1}" style="width:80px"></label>
    <div style="opacity:.75;font-weight:500">${S.R.length} areas · ${S.E.filter(e => !e.g).length} fights · ${S.E.filter(e => e.g).length} groups. The stage is cleared when every fight is won. <button id="sReset">Reset all stages to the game's</button></div>`; }
  else if (sel.t === 'fight' || sel.t === 'group') { const e = S.E[sel.i]; if (!e) { SED.sel = null; return sedPanel(); } const W = sedWaves(e), fights = S.E.filter(q => !q.g), n = fights.indexOf(e) + 1;
    h = `<h3>${e.g ? 'Group' : 'Fight ' + n + ' of ' + fights.length}<span>${e.g ? '' : `<button id="sUp">◀ Earlier</button><button id="sDn">Later ▶</button>`}<button id="sDel">Delete</button></span></h3>
    ${e.g ? '<div style="opacity:.75;font-weight:500">Stands about until someone comes near or hits one, then attacks.</div>' : `<label>Ring size <input id="sR" type="range" min="40" max="400" value="${e.r}"><span>${e.r}</span></label>
    <label>Boss <select id="sBoss"><option value="">None</option>${opt(e.boss)}</select></label>`}
    ${W.map((L, wi) => `<div class="wv"><b><span>${e.g ? 'Enemies' : 'Wave ' + (wi + 1)}</span>${!e.g && W.length > 1 ? `<button data-dw="${wi}">Remove wave</button>` : ''}</b>
      ${L.map(([k, c], ei) => `<div class="en"><span>${(UK[k] || { n: k }).n}</span><button data-w="${wi}" data-e="${ei}" data-d="-1">−</button><b style="min-width:22px;text-align:center">${c}</b><button data-w="${wi}" data-e="${ei}" data-d="1">+</button><button data-w="${wi}" data-e="${ei}" data-d="x">✕</button></div>`).join('')}
      <div class="en"><select data-add="${wi}"><option value="">+ Add enemy…</option>${opt('')}</select></div></div>`).join('')}
    ${e.g ? '' : '<button id="sAddW">+ Wave</button>'}`; }
  else if (sel.t === 'rect') h = `<h3>Area<span><button id="sDel">Delete</button></span></h3><div style="opacity:.75;font-weight:500">Drag it to move it, drag its corners to resize. Players and enemies can walk anywhere inside any area.</div>`;
  else if (sel.t === 'road') h = `<h3>Road point ${sel.i + 1}<span><button id="sDel">Delete point</button><button id="sClr">Clear road</button></span></h3><div style="opacity:.75;font-weight:500">The road is only decoration. Use + Road to add points to its end.</div>`;
  else if (sel.t === 'start') h = `<h3>Start<span></span></h3><div style="opacity:.75;font-weight:500">Where the players' stones stand when the stage begins.</div>`;
  el.innerHTML = h; el.scrollTop = sc0;
  const $ = id => document.getElementById(id), chg = (f) => { sedPush(); f(); sedDone(); };
  if (!sel) { $('sNm').onchange = ev => chg(() => { S.name = ev.target.value || 'Stage'; sedTools(); }); $('sBl').onchange = ev => chg(() => S.blurb = ev.target.value); $('sTh').onchange = ev => chg(() => S.th = ev.target.value); $('sMul').onchange = ev => chg(() => S.mul = cl(+ev.target.value || 1, 0.2, 10));
    $('sDelSt').onclick = () => { if (STAGES.length < 2) return sedHint('Keep at least one stage'); STAGES.splice(SED.i, 1); SED.i = Math.max(0, SED.i - 1); SED.hist = []; sedSave(); sedTools(); sedFit(); sedPanel(); };
    $('sReset').onclick = () => { STAGES.length = 0; JSON.parse(JSON.stringify(SEDDEF)).forEach(s => STAGES.push(s)); try { localStorage.removeItem('kn_stages'); } catch (er) { } SED.i = 0; SED.hist = []; CPDEC = null; CPUI.last = ''; sedTools(); sedFit(); sedPanel(); }; return; }
  if ($('sDel')) $('sDel').onclick = () => chg(() => { if (sel.t === 'rect') S.R.splice(sel.i, 1); else if (sel.t === 'road') S.P.splice(sel.i, 1); else S.E.splice(sel.i, 1); SED.sel = null; });
  if ($('sClr')) $('sClr').onclick = () => chg(() => { S.P = []; SED.sel = null; });
  if (sel.t !== 'fight' && sel.t !== 'group') return; const e = S.E[sel.i], W = sedWaves(e), put = () => { e.w = W.map(sedWStr); if (!e.w.length) e.w = ['foot*1']; e.w = e.w.map(s => s || 'foot*1'); };
  const mv = d => chg(() => { const F = S.E.map((q, j) => [q, j]).filter(([q]) => !q.g), k = F.findIndex(([q]) => q === e), o = F[k + d]; if (!o) return; const a = F[k][1], b = o[1]; [S.E[a], S.E[b]] = [S.E[b], S.E[a]]; SED.sel = { t: 'fight', i: b }; });
  if ($('sUp')) { $('sUp').onclick = () => mv(-1); $('sDn').onclick = () => mv(1); }
  if ($('sR')) $('sR').oninput = ev => { if (!SED.rP) { sedPush(); SED.rP = 1; } e.r = +ev.target.value; ev.target.nextElementSibling.textContent = e.r; }, $('sR').onchange = () => { SED.rP = 0; sedSave(); };
  if ($('sBoss')) $('sBoss').onchange = ev => chg(() => { if (ev.target.value) e.boss = ev.target.value; else delete e.boss; });
  if ($('sAddW')) $('sAddW').onclick = () => chg(() => { W.push([['foot', 3]]); put(); });
  el.querySelectorAll('[data-dw]').forEach(b => b.onclick = () => chg(() => { W.splice(+b.dataset.dw, 1); put(); }));
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => chg(() => { const L = W[+b.dataset.w], i = +b.dataset.e; if (b.dataset.d === 'x') { L.splice(i, 1); if (!L.length) L.push(['foot', 1]); } else L[i][1] = cl(L[i][1] + +b.dataset.d, 1, 60); put(); }));
  el.querySelectorAll('[data-add]').forEach(s => s.onchange = () => { const k = s.value; if (!k) return; chg(() => { const L = W[+s.dataset.add], f = L.find(q => q[0] === k); if (f) f[1]++; else L.push([k, UK[k].heavy ? 1 : 3]); put(); }); }); }
// ---- drawing ----
function sedDraw() { if (!SED.on) return; requestAnimationFrame(sedDraw); const cv2 = document.getElementById('sedCv'); if (!cv2) return; const dpr = Math.min(2, devicePixelRatio || 1), W = cv2.clientWidth, H = cv2.clientHeight;
  if (cv2.width !== Math.round(W * dpr) || cv2.height !== Math.round(H * dpr)) { cv2.width = Math.round(W * dpr); cv2.height = Math.round(H * dpr); }
  const c = cv2.getContext('2d'), S = sedS(), TH = CPTH[S.th] || CPTH.grass, s = SED.cam.s, sel = SED.sel; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = TH.out; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-SED.cam.x, -SED.cam.y); const px = 1 / s;
  const gcol = { grass: '#4f7a3a', wood: '#33502a', fort: '#7d766b' }[S.th] || '#4f7a3a';
  c.fillStyle = gcol; for (const r of S.R) c.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  // grid every 100
  c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = px; c.beginPath(); const [ax, ay] = sedW(0, 0), [bx, by] = sedW(W, H); for (let x = Math.floor(ax / 100) * 100; x < bx; x += 100) { c.moveTo(x, ay); c.lineTo(x, by); } for (let y = Math.floor(ay / 100) * 100; y < by; y += 100) { c.moveTo(ax, y); c.lineTo(bx, y); } c.stroke();
  if (S.P.length) { c.lineCap = c.lineJoin = 'round'; c.strokeStyle = S.th === 'fort' ? '#9d958a' : '#b08a5a'; c.lineWidth = 28; c.beginPath(); S.P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }
  if (sel && sel.t === 'rect' && S.R[sel.i]) { const r = S.R[sel.i]; c.strokeStyle = '#ffd36a'; c.lineWidth = 2 * px; c.setLineDash([6 * px, 4 * px]); c.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); c.setLineDash([]); c.fillStyle = '#ffd36a'; for (const [x, y] of [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]]]) { c.beginPath(); c.arc(x, y, 8 * px, 0, 7); c.fill(); } }
  if (SED.tool === 'road' || (sel && sel.t === 'road')) S.P.forEach((p, i) => { c.fillStyle = sel && sel.t === 'road' && sel.i === i ? '#ffd36a' : '#e8d2a0'; c.beginPath(); c.arc(p[0], p[1], 6 * px, 0, 7); c.fill(); });
  let fn = 0; const font = (n, b) => { c.font = `${b ? 800 : 600} ${n * px}px system-ui`; };
  S.E.forEach((e, i) => { const on = sel && (sel.t === 'fight' || sel.t === 'group') && sel.i === i, W2 = sedWaves(e);
    if (!e.g) { fn++; c.strokeStyle = e.boss ? 'rgba(255,80,60,.95)' : 'rgba(255,190,90,.9)'; c.lineWidth = (on ? 3 : 2) * px; c.setLineDash(on ? [] : [8 * px, 5 * px]); c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * ARY, 0, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = e.boss ? 'rgba(255,80,60,.1)' : 'rgba(255,190,90,.07)'; c.fill(); if (on) { c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(e.x + e.r, e.y, 8 * px, 0, 7); c.fill(); } }
    c.fillStyle = e.g ? '#7aa8ff' : e.boss ? '#ff5040' : '#ffb84a'; c.strokeStyle = on ? '#fff' : '#000'; c.lineWidth = 2 * px; c.beginPath(); c.arc(e.x, e.y, 12 * px, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#111'; font(12, 1); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e.g ? 'G' : e.boss ? 'B' : fn, e.x, e.y + px);
    // what's in it
    const tot = W2.reduce((a2, L) => a2 + L.reduce((b2, q) => b2 + q[1], 0), 0), lines = !on ? [tot + ' enem' + (tot === 1 ? 'y' : 'ies') + (W2.length > 1 ? ' · ' + W2.length + ' waves' : '')] : W2.map((L, wi) => (e.g ? '' : (W2.length > 1 ? (wi + 1) + ': ' : '')) + L.map(([k, n]) => n + ' ' + ((UK[k] || { n: k }).n)).join(', '));
    font(11, 0); c.textAlign = 'left'; c.textBaseline = 'top'; lines.forEach((t, j) => { const y = e.y + 16 * px + j * 13 * px, w = c.measureText(t).width; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(e.x - w / 2 - 3 * px, y - px, w + 6 * px, 13 * px); c.fillStyle = e.g ? '#cfe0ff' : '#ffe9c0'; c.fillText(t, e.x - w / 2, y); }); });
  if (S.S) { const [x, y] = S.S, on = sel && sel.t === 'start'; c.fillStyle = '#6ad06a'; c.strokeStyle = on ? '#fff' : '#000'; c.lineWidth = 2 * px; c.beginPath(); c.moveTo(x, y - 14 * px); c.lineTo(x + 11 * px, y + 8 * px); c.lineTo(x - 11 * px, y + 8 * px); c.closePath(); c.fill(); c.stroke(); font(11, 1); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('START', x, y + 20 * px); }
  else { const [x, y] = [200, 230]; c.strokeStyle = '#6ad06a'; c.lineWidth = px; c.strokeRect(x - 6 * px, y - 6 * px, 12 * px, 12 * px); }
  c.restore(); }
window.__sed = { SED, open: sedOpen, close: sedClose };
