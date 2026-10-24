// ===================== Map designer (DRAFT 2026-10-22, rebuilt) =====================
// Inlined into knights.html by build.py (at /*@STAGEDIT@*/, after campaign.js). Edits the campaign's STAGES (format 2, stagekit.js) in place and
// draws them exactly as the game does: painted ground, props, edge trees, the enemies themselves. Tools: Move, Ground (paint), Props, Enemies,
// Locks (screens that lock with waves flooding in), Spawns (where the flood comes from), Start. Two fingers pan and zoom.
// Saved on this device in localStorage 'kn_stages2' (the whole list); Copy gives the JSON to paste to Claude.
const SEDDEF = STAGES.map(s => JSON.stringify(s));
try { const s = JSON.parse(localStorage.getItem('kn_stages2') || 'null'); if (Array.isArray(s) && s.length && s.every(q => q && q.v === 2)) { STAGES.length = 0; s.forEach(x => { if (!x.CS) x.CS = csDefault(x); STAGES.push(x); }); } } catch (e) { }
const SED = { on: 0, i: 0, tool: 'move', paint: 2, brush: 2, prop: 'tree', pbrush: 0, enemy: 'foot', cnt: 1, spawn: 'woods', sel: null, cam: { x: 600, y: 400, s: 0.6 }, ptr: new Map(), hist: [], fut: [], drag: null, pinch: null, dirty: 1, sheet: '' };
const sedS = () => STAGES[SED.i];
const SEDSP = { woods: ['Woods', '#7ad06a'], cave: ['Cave', '#c9a65a'], gate: ['Gate', '#a8b0c0'], grave: ['Grave', '#b07ad0'] };
const SEDK = () => Object.keys(UK).filter(k => UK[k] && UK[k].n).sort((a, b) => (UK[a].hp || 0) - (UK[b].hp || 0));
let sedSvT = 0; const sedSave = () => { clearTimeout(sedSvT); sedSvT = setTimeout(() => { try { localStorage.setItem('kn_stages2', JSON.stringify(STAGES)); } catch (e) { } CPUI.last = ''; }, 400); };
function sedPush() { SED.hist.push(JSON.stringify(sedS())); if (SED.hist.length > 40) SED.hist.shift(); SED.fut = []; }
function sedDone() { sedSave(); SED.dirty = 1; sedSelBar(); }
// ---- thumbnails (enemy, prop, ground) ----
const SEDTH = new Map();
// drawn big, trimmed to what was drawn, then fitted to 64 px so every picture fills its button
function sedThumb(key, f, trim) { if (SEDTH.has(key)) return SEDTH.get(key); const c = document.createElement('canvas'); c.width = c.height = 64; f(c.getContext('2d'));
  if (trim) { const d = c.getContext('2d').getImageData(0, 0, 64, 64).data; let x0 = 64, y0 = 64, x1 = -1, y1 = -1; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (d[(y * 64 + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 > x0) { const o = document.createElement('canvas'); o.width = o.height = 64; const w = x1 - x0 + 1, h = y1 - y0 + 1, k = Math.min(60 / w, 60 / h); o.getContext('2d').drawImage(c, x0, y0, w, h, 32 - w * k / 2, 32 - h * k / 2, w * k, h * k); const u = o.toDataURL(); SEDTH.set(key, u); return u; } }
  const u = c.toDataURL(); SEDTH.set(key, u); return u; }
const sedEnemyImg = k => sedThumb('e' + k, g => { const U = UK[k], SB = U.sb || (['ogre', 'warg', 'naga', 'necro'].includes(k) ? SBB : SBS), s = 58 / Math.max(SB.w, SB.h); g.setTransform(s, 0, 0, s, 32 - (SB.x + SB.w / 2) * s, 32 - (SB.y + SB.h / 2) * s); NOHP = true; try { walkerLive(g, { x: 0, y: 0, k, ph: 0, hp: 1, max: 1, id: 1, atk: -1 }, 0, 1, -1, false); } catch (e) { } NOHP = false; }, 1);
const sedPropImg = k => sedThumb('p' + k + sedS().th, g => { const o = skSprite(k, sedS().th, 1, 0, 0); if (!o) return; const s = Math.min(60 / o.width, 60 / o.height); g.drawImage(o, 32 - o.width * s / 2, 62 - o.height * s, o.width * s, o.height * s); }, 1);
const sedGroundImg = c => sedThumb('g' + c + sedS().th, g => { if (c === 1) { g.fillStyle = g.createPattern(grassT, 'repeat'); g.fillRect(0, 0, 64, 64); } else { g.fillStyle = g.createPattern(skTex(c, sedS().th), 'repeat'); g.fillRect(0, 0, 64, 64); } });
// ---- the page ----
function sedCss() { if (document.getElementById('sedCss')) return; const s = document.createElement('style'); s.id = 'sedCss'; s.textContent = `
body.live .sedBtn{display:none !important}
#sed{position:fixed;inset:0;z-index:80;display:none;flex-direction:column;background:#0d110b;color:#f3ead2;font:600 13px system-ui,sans-serif;user-select:none;-webkit-user-select:none}
#sed button,#sed select,#sed input{font:700 13px system-ui;border-radius:9px;border:1px solid #6a5a36;background:#2a2615;color:#f3ead2;padding:8px 11px}
#sed button.on{background:#6a4a1a;border-color:#ffd36a;color:#fff}#sed button.pri{background:#3d6a2a;border-color:#8ad06a}
#sed .bar{display:flex;gap:6px;align-items:center;padding:6px;background:#1a2015;border-bottom:1px solid #3a3a2a}#sed .bar select{flex:1;min-width:0}
#sed .cvw{position:relative;flex:1;min-height:0;overflow:hidden}#sed canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
#sed .hint{position:absolute;left:8px;right:8px;top:6px;text-align:center;pointer-events:none;font:700 12px system-ui;color:#ffe9b0;text-shadow:0 1px 3px #000,0 0 6px #000}
#sedSel{position:absolute;left:6px;right:6px;top:30px;display:none;gap:6px;align-items:center;flex-wrap:wrap;background:#141a12e8;border:1px solid #c9a65a;border-radius:10px;padding:6px}#sedSel b{flex:1;min-width:80px}
#sed .pal{display:flex;gap:6px;padding:6px;overflow-x:auto;background:#141a12;border-top:1px solid #3a3a2a;align-items:center;min-height:62px;touch-action:pan-x}#sed .pal *{touch-action:pan-x}
#sed .pal .it{flex:0 0 auto;width:58px;height:58px;padding:2px;border-radius:10px;border:2px solid #3a3a2a;background:#1d2418;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 9px system-ui;color:#cfc6ae;gap:1px}
#sed .pal .it img{width:40px;height:40px;object-fit:contain;image-rendering:auto}#sed .pal .it.on{border-color:#ffd36a;background:#3a3218}
#sed .pal .lbl{flex:0 0 auto;font:700 11px system-ui;color:#cfc6ae;padding:0 4px;max-width:150px}
#sed .tools{display:flex;gap:5px;padding:6px;overflow-x:auto;background:#1a2015;border-top:1px solid #3a3a2a;touch-action:pan-x}#sed .tools button{flex:1 0 auto;padding:9px 8px}
#sedSheet{position:absolute;left:6px;right:6px;bottom:6px;max-height:70%;overflow:auto;display:none;background:#141a12f4;border:1px solid #c9a65a;border-radius:12px;padding:10px;touch-action:pan-y}#sedSheet *{touch-action:pan-y}
#sedSheet h3{margin:0 0 8px;font:800 15px system-ui;display:flex;justify-content:space-between;align-items:center;gap:6px}
#sedSheet .wv{border:1px solid #3a3a2a;border-radius:10px;padding:6px;margin:6px 0;background:#1d2418}#sedSheet .wv>b{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
#sedSheet .en{display:flex;align-items:center;gap:6px;margin:3px 0}#sedSheet .en img{width:34px;height:34px}#sedSheet .en span{flex:1}#sedSheet .en button{padding:4px 11px;min-width:36px}
#sedSheet .add{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}#sedSheet .add button{padding:2px;width:46px;height:46px}#sedSheet .add img{width:40px;height:40px}
#sedSheet label{display:flex;align-items:center;gap:8px;margin:6px 0}#sedSheet label input,#sedSheet label select{flex:1;min-width:0}
#sedTxt{position:absolute;inset:8%;z-index:2;display:none;flex-direction:column;gap:6px;background:#141a12;border:1px solid #c9a65a;border-radius:12px;padding:10px}#sedTxt textarea{flex:1;font:11px monospace;background:#0a0d08;color:#cfe;border-radius:8px}`;
  document.head.appendChild(s); }
function sedOpen(i) { sedCss(); SED.on = 1; SED.i = cl(i | 0, 0, STAGES.length - 1); SED.sel = null; SED.hist = []; SED.fut = []; SED.sheet = ''; let el = document.getElementById('sed');
  if (!el) { el = document.createElement('div'); el.id = 'sed'; document.body.appendChild(el);
    el.innerHTML = `<div class="bar"><select id="sedSt"></select><button id="sedUndo">↶</button><button id="sedRedo">↷</button><button class="pri" id="sedPlay">▶ Play</button><button id="sedMenu">⋯</button><button id="sedClose">✕</button></div>
      <div class="cvw"><canvas id="sedCv"></canvas><div class="hint" id="sedHint"></div><div id="sedSel"></div><div id="sedSheet" class="scrollOk"></div><div id="sedTxt"><b>Stage data: copy all of this and paste it to Claude</b><textarea id="sedTa" readonly></textarea><button id="sedTxC">Close</button></div></div>
      <div class="pal scrollOk" id="sedPal"></div>
      <div class="tools scrollOk">${[['move', 'Move'], ['ground', 'Ground'], ['prop', 'Props'], ['enemy', 'Enemies'], ['lock', 'Locks'], ['spawn', 'Spawns'], ['start', 'Players'], ['cut', 'Cutscenes']].map(([k, n]) => `<button data-t="${k}">${n}</button>`).join('')}</div>`;
    const $ = id => document.getElementById(id);
    $('sedSt').onchange = e => { SED.i = +e.target.value; SED.sel = null; SED.hist = []; SED.fut = []; sedSheet(''); sedFit(); sedUI(); };
    $('sedUndo').onclick = () => { if (!SED.hist.length) return; SED.fut.push(JSON.stringify(sedS())); STAGES[SED.i] = JSON.parse(SED.hist.pop()); SED.sel = null; sedDone(); sedSheet(SED.sheet); };
    $('sedRedo').onclick = () => { if (!SED.fut.length) return; SED.hist.push(JSON.stringify(sedS())); STAGES[SED.i] = JSON.parse(SED.fut.pop()); SED.sel = null; sedDone(); sedSheet(SED.sheet); };
    $('sedClose').onclick = sedClose; $('sedPlay').onclick = sedPlay; $('sedMenu').onclick = () => sedSheet(SED.sheet === 'stage' ? '' : 'stage');
    $('sedTxC').onclick = () => { $('sedTxt').style.display = 'none'; };
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { SED.tool = b.dataset.t; SED.sel = null; sedSheet(''); sedUI(); });
    const cv2 = $('sedCv'); cv2.addEventListener('pointerdown', sedDown); cv2.addEventListener('pointermove', sedMove); cv2.addEventListener('pointerup', sedUp); cv2.addEventListener('pointercancel', sedUp); cv2.addEventListener('contextmenu', e => e.preventDefault());
    cv2.addEventListener('wheel', e => { e.preventDefault(); sedZoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false }); }
  el.style.display = 'flex'; sedUI(); sedFit(); requestAnimationFrame(sedDraw); }
function sedClose() { SED.on = 0; const el = document.getElementById('sed'); if (el) el.style.display = 'none'; CPUI.last = ''; }
function sedPlay() { const i = SED.i; sedClose();
  if (BH.on && BH.cp) { if (AUTH()) { CMP.sel = i; cpBegin(i); } return; }
  BHMODE = 'camp'; try { localStorage.setItem('kn_mode', 'camp'); } catch (e) { } startGame(1, 0); setTimeout(() => { if (BH.cp) { CMP.sel = i; cpBegin(i); } }, 80); }
const SEDTIP = { move: 'Tap anything to select it, drag it to move it · drag empty ground or use two fingers to pan · pinch to zoom', ground: 'Paint the ground with one finger · Void = where nobody can walk', prop: 'Tap to place · tap a prop to select it · Brush: drag to scatter', enemy: 'Tap to place enemies · they stand about until someone comes near', lock: 'Tap to add a locked screen · drag its corners to size it · Waves… to choose who floods in', spawn: 'Tap to place a spawn point: the flood comes out of these (and the screen edges)', start: 'Drag a stone to move that player\'s spawn · tap empty ground to move all four there', cut: 'Cutscenes play when something happens in the stage · a "spot" one plays when someone walks into its circle (drag it)' };
function sedUI() { const $ = id => document.getElementById(id); document.querySelectorAll('#sed [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === SED.tool)); $('sedHint').textContent = SED.sel ? '' : SEDTIP[SED.tool];
  $('sedSt').innerHTML = STAGES.map((s, i) => `<option value="${i}" ${i === SED.i ? 'selected' : ''}>${i + 1}. ${s.name}</option>`).join('');
  const P = $('sedPal'), T = SED.tool, it = (key, img, n, on) => `<button class="it ${on ? 'on' : ''}" data-k="${key}"><img src="${img}" alt="">${n}</button>`; let h = '';
  if (T === 'ground') h = [2, 3, 4, 5, 1, 6, 0].map(c => it('g' + c, sedGroundImg(c), SKG[c], SED.paint === c)).join('') + '<span class="lbl">Brush</span>' + [[1, 'S'], [2, 'M'], [4, 'L'], [7, 'XL']].map(([r, n]) => `<button class="it ${SED.brush === r ? 'on' : ''}" data-b="${r}" style="width:44px">${n}</button>`).join('');
  else if (T === 'prop') h = `<button class="it ${SED.pbrush ? 'on' : ''}" data-pb="1" style="width:64px">${SED.pbrush ? 'Brush on' : 'Brush off'}</button>` + SKPLIST.map(k => it('p' + k, sedPropImg(k), SKP[k].n, SED.prop === k)).join('');
  else if (T === 'enemy') h = [1, 3, 5].map(n => `<button class="it ${SED.cnt === n ? 'on' : ''}" data-c="${n}" style="width:40px">×${n}</button>`).join('') + SEDK().map(k => it('e' + k, sedEnemyImg(k), UK[k].n, SED.enemy === k)).join('');
  else if (T === 'spawn') h = Object.entries(SEDSP).map(([k, [n, col]]) => `<button class="it ${SED.spawn === k ? 'on' : ''}" data-s="${k}"><span style="width:22px;height:22px;border-radius:50%;background:${col};display:block"></span>${n}</button>`).join('') + '<span class="lbl">Each feeds the nearest locked screen</span>';
  else if (T === 'lock') h = `<span class="lbl">${(sedS().L || []).length} locked screens · the stage is won when every one is cleared</span>`;
  else if (T === 'start') h = '<span class="lbl">Players 1-4 start at these stones · with fewer players the higher numbers stay empty</span>';
  else if (T === 'cut') h = `<button class="it" data-cn="1" style="width:86px">+ Cutscene</button>` + (sedS().CS || []).map((c, i) => `<button class="it" data-ci="${i}" style="width:auto;min-width:110px;padding:6px 10px;text-align:left"><b>🎬 ${i + 1}</b> ${sedCsWhen(c)}<br><small style="opacity:.7">${(c.ln || []).length} lines</small></button>`).join('');
  else h = `<span class="lbl">${sedS().name} · ${(sedS().U || []).length} enemies placed · ${(sedS().O || []).length} props</span>`;
  P.innerHTML = h;
  P.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k, v = k.slice(1); if (k[0] === 'g') SED.paint = +v; else if (k[0] === 'p') SED.prop = v; else if (k[0] === 'e') { SED.enemy = v; const s2 = SED.sel; if (s2 && s2.t === 'enemy') { sedPush(); sedS().U[s2.i][0] = v; sedDone(); } } sedUI(); });
  P.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { SED.brush = +b.dataset.b; sedUI(); });
  P.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { SED.cnt = +b.dataset.c; sedUI(); });
  P.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { SED.spawn = b.dataset.s; const s2 = SED.sel; if (s2 && s2.t === 'spawn') { sedPush(); sedS().SP[s2.i][0] = SED.spawn; sedDone(); } sedUI(); });
  P.querySelectorAll('[data-cn]').forEach(b => b.onclick = () => { sedPush(); const S = sedS(); S.CS = S.CS || []; S.CS.push({ tr: 'start', i: 0, ln: [{ w: 'p1', s: 0, t: '' }] }); sedDone(); SED.ci = S.CS.length - 1; sedUI(); sedSheet('cut'); });
  P.querySelectorAll('[data-ci]').forEach(b => b.onclick = () => { SED.ci = +b.dataset.ci; sedSheet('cut'); });
  P.querySelectorAll('[data-pb]').forEach(b => b.onclick = () => { SED.pbrush = SED.pbrush ? 0 : 1; sedUI(); });
  sedSelBar(); SED.dirty = 1; }
// the bar for whatever is selected
function sedSelBar() { const el = document.getElementById('sedSel'); if (!el) return; const sel = SED.sel, S = sedS(); const h = document.getElementById('sedHint'); if (h) h.textContent = sel ? '' : SEDTIP[SED.tool];
  if (!sel) { el.style.display = 'none'; return; } let t = '', b = '';
  if (sel.t === 'prop') { const p = S.O[sel.i]; if (!p) { SED.sel = null; return sedSelBar(); } t = SKP[p[0]].n; b = '<button data-a="flip">Flip</button><button data-a="small">−</button><button data-a="big">+</button><button data-a="var">Look</button><button data-a="del">Delete</button>'; }
  else if (sel.t === 'enemy') { const u = S.U[sel.i]; if (!u) { SED.sel = null; return sedSelBar(); } t = UK[u[0]].n + ' <small style="opacity:.7">(tap one below to swap)</small>'; b = '<button data-a="del">Delete</button>'; }
  else if (sel.t === 'lock') { const L = S.L[sel.i]; if (!L) { SED.sel = null; return sedSelBar(); } t = 'Locked screen ' + (sel.i + 1); b = '<button data-a="waves" class="pri">Waves…</button><button data-a="del">Delete</button>'; }
  else if (sel.t === 'spawn') { const q = S.SP[sel.i]; if (!q) { SED.sel = null; return sedSelBar(); } t = 'Spawn: ' + SEDSP[q[0]][0]; b = '<button data-a="del">Delete</button>'; }
  else if (sel.t === 'pst') { t = 'Player ' + (sel.i + 1) + ' spawn'; }
  else if (sel.t === 'cut') { t = '🎬 Cutscene ' + (sel.i + 1) + ' spot'; b = '<button data-a="cut" class="pri">Edit…</button>'; }
  el.innerHTML = `<b>${t}</b>${b}<button data-a="x">✕</button>`; el.style.display = 'flex';
  el.querySelectorAll('[data-a]').forEach(q => q.onclick = () => { const a = q.dataset.a; if (a === 'x') { SED.sel = null; sedSelBar(); SED.dirty = 1; return; } if (a === 'waves') { sedSheet('waves'); return; } if (a === 'cut') { SED.ci = sel.i; sedSheet('cut'); return; }
    sedPush(); if (sel.t === 'prop') { const p = S.O[sel.i]; if (a === 'flip') p[4] = p[4] ? 0 : 1; if (a === 'small') p[3] = Math.max(0.4, Math.round(((p[3] || 1) - 0.1) * 10) / 10); if (a === 'big') p[3] = Math.min(3, Math.round(((p[3] || 1) + 0.1) * 10) / 10); if (a === 'var') p[5] = ((p[5] || 0) + 1) % 3; }
    if (a === 'del') { ({ prop: S.O, enemy: S.U, lock: S.L, spawn: S.SP })[sel.t].splice(sel.i, 1); SED.sel = null; sedSheet(''); }
    sedDone(); }); }
// bottom sheets: a lock's waves, or the stage's settings
function sedSheet(k) { SED.sheet = k; const el = document.getElementById('sedSheet'); if (!el) return; const S = sedS(); if (!k) { el.style.display = 'none'; return; } let h = '';
  const sc0 = el.scrollTop;
  if (k === 'waves') { const sel = SED.sel, L = sel && sel.t === 'lock' && S.L[sel.i]; if (!L) { el.style.display = 'none'; SED.sheet = ''; return; } const W = L.wv.map(skParse), pre = (S.U || []).filter(u => lkIn(L, u[1], u[2])).length;
    h = `<h3>Locked screen ${sel.i + 1}<button data-x="1">Done</button></h3><div style="opacity:.75;font-weight:500">When a player walks onto it the screen locks. ${pre} enemies are already standing on it; each wave below floods in from its spawn points and the screen's edges once the last is nearly dead.</div>
      <label>Boss <select id="sBoss"><option value="">None</option>${SEDK().map(q => `<option value="${q}" ${L.boss === q ? 'selected' : ''}>${UK[q].n}</option>`).join('')}</select></label>
      ${W.map((Lw, wi) => `<div class="wv"><b><span>Wave ${wi + 1}</span>${W.length > 1 ? `<button data-dw="${wi}">Remove</button>` : ''}</b>${Lw.map(([q, n], ei) => `<div class="en"><img src="${sedEnemyImg(q)}"><span>${(UK[q] || { n: q }).n}</span><button data-w="${wi}" data-e="${ei}" data-d="-1">−</button><b style="min-width:22px;text-align:center">${n}</b><button data-w="${wi}" data-e="${ei}" data-d="1">+</button><button data-w="${wi}" data-e="${ei}" data-d="x">✕</button></div>`).join('')}
        <div class="add">${SEDK().map(q => `<button data-aw="${wi}" data-q="${q}" title="${UK[q].n}"><img src="${sedEnemyImg(q)}"></button>`).join('')}</div></div>`).join('')}<button id="sAddW">+ Wave</button>`; }
  else if (k === 'cut') { const C = (S.CS || [])[SED.ci]; if (!C) { el.style.display = 'none'; SED.sheet = ''; return; }
    const lk = (S.L || []).map((L, i) => `<option value="${i}" ${(C.i | 0) === i ? 'selected' : ''}>Locked screen ${i + 1}${L.boss && UK[L.boss] ? ' (boss ' + UK[L.boss].n + ')' : ''}</option>`).join('');
    const who = w => `<optgroup label="Players (whoever plays them)">${[1, 2, 3, 4].map(n => `<option value="p${n}" ${w === 'p' + n ? 'selected' : ''}>Player ${n}</option>`).join('')}</optgroup><optgroup label="Characters">${CSCH.map(q => `<option value="${q}" ${w === q ? 'selected' : ''}>${CNAME[q] || q}</option>`).join('')}</optgroup><optgroup label="Enemies">${SEDK().map(q => `<option value="${q}" ${w === q ? 'selected' : ''}>${UK[q].n}</option>`).join('')}</optgroup><option value="narr" ${w === 'narr' ? 'selected' : ''}>Narrator (no picture)</option>`;
    const esc = v => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    h = `<h3>🎬 Cutscene ${SED.ci + 1}<span style="display:flex;gap:6px"><button id="cPrev" class="pri">▶ Preview</button><button data-x="1">Done</button></span></h3>
      <label>Plays when <select id="cTr">${CSTR.map(([v, n]) => `<option value="${v}" ${C.tr === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${((CSHOOK[C.tr] || {}).p || []).map(q => q === 'lock' ? `<label>Which <select id="cLk">${lk || '<option>No locked screens yet</option>'}</select></label>`
        : q === 'kind' ? `<label>Enemy <select id="cKd">${SEDK().map(k => `<option value="${k}" ${(C.k || 'foot') === k ? 'selected' : ''}>${UK[k].n}</option>`).join('')}</select></label>`
        : q === 'spot' ? `<label>Circle size <input id="cR" type="number" min="15" max="400" step="5" value="${C.r || 60}"></label><div style="opacity:.7;font-weight:500">Drag its 🎬 circle on the map (Cutscenes tool) to place it.</div>`
        : `<label>${q[1]} <input data-cp="${q[0]}" data-mn="${q[3]}" data-mx="${q[4]}" type="number" min="${q[3]}" max="${q[4]}" value="${C[q[0]] ?? q[2]}"></label>`).join('')}
      <div style="opacity:.7;font-weight:500;margin:4px 0">The game pauses while it plays. Anyone can tap to go on or skip it.</div>
      ${(C.ln || []).map((l, i) => `<div class="wv cl"><b><span style="display:flex;align-items:center;gap:6px">${l.w !== 'narr' ? `<img src="${csPic(l.w, csSeat(l.w) > 0 ? KCOLS[csSeat(l.w)] : (MYCOL || KCOLS[0]), csSeat(l.w) >= 0 ? [CHAR || 'knight', 'fire', 'priest', 'time'][csSeat(l.w)] : undefined)}" style="width:40px;height:40px;object-fit:contain;${l.s ? 'transform:scaleX(-1)' : ''}">` : ''}Line ${i + 1}</span><span style="display:flex;gap:4px"><button data-lu="${i}">▲</button><button data-ld="${i}">▼</button><button data-lx="${i}">✕</button></span></b>
        <label>Who <select data-lw="${i}">${who(l.w)}</select></label>
        <label>Side <span style="display:flex;gap:4px"><button data-ls="${i}" data-v="0" class="${l.s ? '' : 'on'}">Left</button><button data-ls="${i}" data-v="1" class="${l.s ? 'on' : ''}">Right</button></span></label>
        <label>Name <input data-ln="${i}" placeholder="${esc(csSeat(l.w) >= 0 ? 'their own name' : l.w === 'narr' ? '(none)' : (CNAME[l.w] || (UK[l.w] && UK[l.w].n) || ''))}" value="${esc(l.n)}"></label>
        <textarea data-lt="${i}" rows="2" style="width:100%;box-sizing:border-box;font:600 14px system-ui;border-radius:9px;background:#0d110b;color:#f3ead2;border:1px solid #6a5a36;padding:7px" placeholder="What they say">${esc(l.t)}</textarea></div>`).join('')}
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button id="cAdd">+ Line</button><button id="cDel">Delete cutscene</button></div>`; }
  else if (k === 'stage') h = `<h3>Stage ${SED.i + 1}<button data-x="1">Done</button></h3>
    <div style="margin:2px 0 10px"><button id="sSend" class="pri" style="font-size:16px;padding:10px 16px">Send to Claude</button> <span id="sSendM" style="opacity:.8"></span><div style="opacity:.7;font-weight:500;margin-top:4px">Sends every stage to Claude so he can make them the game's own. Then just tell him in the chat.</div></div>
    <label>Name <input id="sNm" value="${(S.name || '').replace(/"/g, '&quot;')}"></label><label>Description <input id="sBl" value="${(S.blurb || '').replace(/"/g, '&quot;')}"></label>
    <label>Look <select id="sTh">${[['grass', 'Grassland'], ['wood', 'Dark forest'], ['fort', 'Fortress']].map(([v, n]) => `<option value="${v}" ${S.th === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Enemy health × <input id="sMul" type="number" step="0.05" min="0.2" max="10" value="${S.mul || 1}"></label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><button id="sNew">+ New stage</button><button id="sCopy">Copy stage data</button><button id="sDelSt">Delete this stage</button><button id="sReset">Reset all to the game's stages</button></div>`;
  el.innerHTML = h; el.style.display = 'block'; el.scrollTop = sc0; const $ = id => document.getElementById(id), chg = f => { sedPush(); f(); sedDone(); sedSheet(SED.sheet); };
  el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => sedSheet(''));
  if (k === 'waves') { const L = S.L[SED.sel.i], W = L.wv.map(skParse), put = () => { L.wv = W.map(Lw => Lw.filter(q => q[1] > 0).map(([q, n]) => q + '*' + n).join(',')).filter(Boolean); if (!L.wv.length) L.wv = ['foot*3']; };
    $('sBoss').onchange = e => chg(() => { if (e.target.value) L.boss = e.target.value; else delete L.boss; });
    $('sAddW').onclick = () => chg(() => { W.push([['foot', 3]]); put(); });
    el.querySelectorAll('[data-dw]').forEach(b => b.onclick = () => chg(() => { W.splice(+b.dataset.dw, 1); put(); }));
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => chg(() => { const Lw = W[+b.dataset.w], i = +b.dataset.e; if (b.dataset.d === 'x') Lw.splice(i, 1); else Lw[i][1] = cl(Lw[i][1] + +b.dataset.d, 1, 60); put(); }));
    el.querySelectorAll('[data-aw]').forEach(b => b.onclick = () => chg(() => { const Lw = W[+b.dataset.aw], q = b.dataset.q, f = Lw.find(z => z[0] === q); if (f) f[1]++; else Lw.push([q, UK[q].heavy ? 1 : 3]); put(); })); }
  if (k === 'cut') { const C = S.CS[SED.ci], L = C.ln = C.ln || [];
    $('cPrev').onclick = () => { const a = document.activeElement; if (a && a.blur) a.blur(); setTimeout(() => csPreview(S.CS[SED.ci]), 0); };
    $('cTr').onchange = e => chg(() => { C.tr = e.target.value; if (C.tr === 'spot' && C.x === undefined) { C.x = Math.round(SED.cam.x); C.y = Math.round(SED.cam.y); C.r = 60; } for (const q of (CSHOOK[C.tr] || {}).p || []) { if (Array.isArray(q) && C[q[0]] === undefined) C[q[0]] = q[2]; if (q === 'kind' && !C.k) C.k = 'foot'; } sedUI(); });
    if ($('cKd')) $('cKd').onchange = e => chg(() => C.k = e.target.value);
    el.querySelectorAll('[data-cp]').forEach(b => b.onchange = e => chg(() => C[b.dataset.cp] = cl(Math.round(+e.target.value || 0), +b.dataset.mn, +b.dataset.mx)));
    if ($('cLk')) $('cLk').onchange = e => chg(() => C.i = +e.target.value || 0); if ($('cR')) $('cR').onchange = e => chg(() => C.r = cl(+e.target.value || 60, 15, 400));
    $('cAdd').onclick = () => chg(() => { const p = L[L.length - 1]; L.push({ w: p ? (p.w === 'p1' ? 'p2' : 'p1') : 'p1', s: p ? 1 - (p.s | 0) : 0, t: '' }); });
    $('cDel').onclick = () => { sedPush(); S.CS.splice(SED.ci, 1); sedDone(); sedSheet(''); sedUI(); };
    el.querySelectorAll('[data-lu]').forEach(b => b.onclick = () => chg(() => { const i = +b.dataset.lu; if (i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]]; }));
    el.querySelectorAll('[data-ld]').forEach(b => b.onclick = () => chg(() => { const i = +b.dataset.ld; if (i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]]; }));
    el.querySelectorAll('[data-lx]').forEach(b => b.onclick = () => chg(() => L.splice(+b.dataset.lx, 1)));
    el.querySelectorAll('[data-lw]').forEach(b => b.onchange = e => chg(() => L[+b.dataset.lw].w = e.target.value));
    el.querySelectorAll('[data-ls]').forEach(b => b.onclick = () => chg(() => L[+b.dataset.ls].s = +b.dataset.v));
    // typing edits the line in place (no redraw of the sheet, so the next tap isn't lost)
    el.querySelectorAll('[data-ln],[data-lt]').forEach(b => { b.onfocus = () => sedPush(); b.onchange = () => { sedDone(); sedUI(); };
      b.oninput = e => { const l = L[+(b.dataset.ln ?? b.dataset.lt)]; if (b.dataset.lt !== undefined) l.t = e.target.value.slice(0, 400); else { const v = e.target.value.slice(0, 40); if (v) l.n = v; else delete l.n; } }; }); }
  if (k === 'stage') { $('sNm').onchange = e => chg(() => { S.name = e.target.value || 'Stage'; sedUI(); }); $('sBl').onchange = e => chg(() => S.blurb = e.target.value); $('sMul').onchange = e => chg(() => S.mul = cl(+e.target.value || 1, 0.2, 10));
    $('sTh').onchange = e => chg(() => { S.th = e.target.value; SKX.delete(S); SEDTH.clear(); sedUI(); });
    $('sNew').onclick = () => { const n = STAGES.length; STAGES.push(Object.assign(skGen({ id: 'st' + Date.now().toString(36), name: 'Stage ' + (n + 1), blurb: '', th: 'grass', mul: 1, mp: [10 + (n * 22) % 80, n % 2 ? 36 : 66], seed: Date.now() % 9999, start: [260, 400], props: 160, pts: [[200, 400, 140], [1700, 400, 150]], locks: [{ x: 1200, y: 400, w: 540, h: 300, wv: ['foot*4'] }] }), { CS: csDefault({}) })); SED.i = n; SED.sel = null; SED.hist = []; sedSave(); sedSheet(''); sedUI(); sedFit(); };
    $('sSend').onclick = () => sedSend();
    $('sCopy').onclick = () => { const j = JSON.stringify(STAGES); $('sedTa').value = j; $('sedTxt').style.display = 'flex'; $('sedTa').select(); try { navigator.clipboard.writeText(j); } catch (e) { } };
    $('sDelSt').onclick = () => { if (STAGES.length < 2) return; STAGES.splice(SED.i, 1); SED.i = Math.max(0, SED.i - 1); SED.hist = []; sedSave(); sedSheet(''); sedUI(); sedFit(); };
    $('sReset').onclick = () => { STAGES.length = 0; SEDDEF.forEach(j => STAGES.push(JSON.parse(j))); try { localStorage.removeItem('kn_stages2'); } catch (e) { } SED.i = 0; SED.hist = []; SED.sel = null; CPUI.last = ''; sedSheet(''); sedUI(); sedFit(); }; } }
async function sedSend() { const m = document.getElementById('sSendM'), say = t => { if (m) m.textContent = t; }, sb = typeof getSB === 'function' && getSB();
  if (!sb) return say('No connection: use Copy stage data instead.'); say('Sending…');
  try { const { error } = await sb.from('kn_stage_drafts').insert({ author: String(myName || '').slice(0, 60), note: 'stages ' + STAGES.length, stages: STAGES }); say(error ? 'Failed: ' + (error.message || error) : 'Sent ' + STAGES.length + ' stages at ' + new Date().toLocaleTimeString() + '. Tell Claude!'); }
  catch (e) { say('Failed: ' + e); } }
// ---- keyboard: WASD / arrows pan, Q/E or -/= zoom ----
const SEDKEY = new Set();
addEventListener('keydown', e => { if (!SED.on) return; const tg = e.target, tn = tg && tg.tagName; if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT') return; const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); document.getElementById(e.shiftKey ? 'sedRedo' : 'sedUndo').click(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); document.getElementById('sedRedo').click(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', '-', '=', '+', 'shift'].includes(k)) { SEDKEY.add(k); e.preventDefault(); e.stopImmediatePropagation(); SED.kt = SED.kt || performance.now(); } }, true);
addEventListener('keyup', e => { SEDKEY.delete(e.key.toLowerCase()); if (SED.on) e.stopImmediatePropagation(); }, true);
addEventListener('blur', () => SEDKEY.clear());
function sedKeys() { const now = performance.now(), dt = Math.min(0.05, ((now - (SED.kt || now)) / 1000)); SED.kt = now; if (!SEDKEY.size) { SED.kt = 0; return; } const K = k => SEDKEY.has(k) ? 1 : 0;
  const dx = K('d') + K('arrowright') - K('a') - K('arrowleft'), dy = K('s') + K('arrowdown') - K('w') - K('arrowup'), z = K('e') + K('=') + K('+') - K('q') - K('-');
  const sp = 700 * (K('shift') ? 2.5 : 1) / SED.cam.s * dt; if (dx || dy) { const l = Math.hypot(dx, dy); SED.cam.x += dx / l * sp; SED.cam.y += dy / l * sp; SED.dirty = 1; }
  if (z) { const cv2 = document.getElementById('sedCv'); if (cv2) sedZoomAt(cv2.clientWidth / 2, cv2.clientHeight / 2, Math.exp(z * 1.6 * dt)); } }
const sedCsWhen = c => { const H = CSHOOK[c.tr]; if (!H) return c.tr; const L = '#' + ((c.i | 0) + 1);
  return ({ lock: 'Lock ' + L + ' starts', clear: 'Lock ' + L + ' cleared', wave: 'Lock ' + L + ' wave ' + (c.w || 2), bosshp: 'Boss ' + L + ' < ' + (c.hp || 50) + '%', meet: 'Meet ' + ((UK[c.k] || {}).n || c.k), kills: (c.kl || 50) + ' kills', time: (c.sec || 30) + 's in', level: 'Level ' + (c.lv || 5) })[c.tr] || H.n; };
// ---- camera ----
function sedFit() { const S = sedS(), cv2 = document.getElementById('sedCv'); if (!S || !cv2) return; const W = cv2.clientWidth || 400, H = cv2.clientHeight || 400;
  // start zoomed on the start point, at roughly the game's own zoom
  SED.cam.s = cl(Math.max(1, Math.min(W / 560, H / 320)), 0.15, 3); const s0 = S.S || [260, 400]; SED.cam.x = s0[0] + W / 2 / SED.cam.s - 120; SED.cam.y = s0[1]; SED.dirty = 1; }
const sedW = (sx, sy) => { const cv2 = document.getElementById('sedCv'); return [SED.cam.x + (sx - cv2.clientWidth / 2) / SED.cam.s, SED.cam.y + (sy - cv2.clientHeight / 2) / SED.cam.s]; };
const sedSc = (wx, wy) => { const cv2 = document.getElementById('sedCv'); return [(wx - SED.cam.x) * SED.cam.s + cv2.clientWidth / 2, (wy - SED.cam.y) * SED.cam.s + cv2.clientHeight / 2]; };
function sedZoomAt(sx, sy, f) { const [wx, wy] = sedW(sx, sy); SED.cam.s = cl(SED.cam.s * f, 0.06, 4); const [wx2, wy2] = sedW(sx, sy); SED.cam.x += wx - wx2; SED.cam.y += wy - wy2; SED.dirty = 1; }
// ---- picking: what's under a screen point (handles of the selected lock first) ----
function sedPick(sx, sy, only) { const S = sedS(), [wx, wy] = sedW(sx, sy), px = 1 / SED.cam.s, ok = t => !only || only === t;
  if (SED.sel && SED.sel.t === 'lock') { const L = S.L[SED.sel.i]; if (L) for (let c = 0; c < 4; c++) { const x = L.x + (c % 2 ? 1 : -1) * L.w / 2, y = L.y + (c > 1 ? 1 : -1) * L.h / 2; if (Math.hypot(x - wx, y - wy) < 18 * px) return { t: 'corner', i: SED.sel.i, c }; } }
  if (ok('spawn')) for (let i = (S.SP || []).length - 1; i >= 0; i--) if (Math.hypot(S.SP[i][1] - wx, S.SP[i][2] - wy) < Math.max(9, 16 * px)) return { t: 'spawn', i };
  if (ok('enemy')) { let b = null, bd = 1e9; (S.U || []).forEach((u, i) => { const U = UK[u[0]]; if (!U) return; const sc = U.sc || 1, d = Math.hypot(u[1] - wx, (u[2] - 5 * sc - wy) * 0.7); if (d < Math.max(7 * sc, 14 * px) && d < bd) { bd = d; b = { t: 'enemy', i }; } }); if (b) return b; }
  if (ok('prop')) { let b = null, by = -1e9; (S.O || []).forEach((p, i) => { const P = SKP[p[0]]; if (!P) return; const s = p[3] || 1; if (Math.abs(wx - p[1]) < Math.max(P.w * s * 0.42, 8 * px) && wy < p[2] + 4 && wy > p[2] - Math.max(P.h * s * 0.9, 10 * px) && p[2] > by) { by = p[2]; b = { t: 'prop', i }; } }); if (b) return b; }
  if (ok('start')) { const PS = skPS(S); for (let j = 3; j >= 0; j--) if (Math.hypot(PS[j][0] - wx, PS[j][1] - 6 - wy) < Math.max(9, 16 * px)) return { t: 'pst', i: j }; }
  if (ok('cut')) for (let i = (S.CS || []).length - 1; i >= 0; i--) { const c = S.CS[i]; if (c.tr === 'spot' && Math.hypot(c.x - wx, c.y - wy) < Math.max(12, 20 * px)) return { t: 'cut', i }; }
  if (ok('lock')) for (let i = (S.L || []).length - 1; i >= 0; i--) if (lkIn(S.L[i], wx, wy)) return { t: 'lock', i };
  return null; }
// ---- pointer handling: one finger = the tool, two fingers = pan + zoom (also right/middle mouse drag to pan) ----
function sedDown(e) { const cv2 = e.target; try { cv2.setPointerCapture(e.pointerId); } catch (er) { } SED.ptr.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (SED.ptr.size === 2) { if (SED.drag && SED.drag.pushed === 0 && SED.drag.k !== 'pan') SED.hist.pop(); if (SED.drag && SED.drag.k === 'paint') { skCommit(sedS()); sedSave(); } SED.drag = null; const [a, b] = [...SED.ptr.values()]; SED.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: SED.cam.s, m: sedW((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; return; }
  if (SED.ptr.size > 2) return; const sx = e.offsetX, sy = e.offsetY, [wx, wy] = sedW(sx, sy), S = sedS(), T = SED.tool;
  if (e.button === 1 || e.button === 2) { SED.drag = { k: 'pan', sx, sy, cx: SED.cam.x, cy: SED.cam.y, moved: 1 }; return; }
  const only = { prop: 'prop', enemy: 'enemy', lock: 'lock', spawn: 'spawn', start: 'start', cut: 'cut' }[T];
  if (T === 'ground') { sedPush(); skPaint(S, wx, wy, SED.brush - 1, SED.paint); SED.drag = { k: 'paint', lx: wx, ly: wy }; SED.dirty = 1; return; }
  const h = sedPick(sx, sy, T === 'move' ? null : only === 'lock' ? null : only);
  if (h && (T === 'move' || h.t === only || h.t === 'corner' || (only === 'start' && h.t === 'pst'))) { if (h.t !== 'corner') SED.sel = h; SED.drag = { k: 'move', h, wx, wy, pushed: 0 }; sedSelBar(); SED.dirty = 1; return; }
  if (T === 'move' || T === 'cut') { SED.drag = { k: 'pan', sx, sy, cx: SED.cam.x, cy: SED.cam.y, moved: 0 }; return; }
  // place something new
  sedPush(); const R = v => Math.round(v);
  if (T === 'prop') { S.O = S.O || []; S.O.push([SED.prop, R(wx), R(wy), Math.round((0.9 + Math.random() * 0.2) * 10) / 10, Math.random() < 0.5 ? 1 : 0, Math.floor(Math.random() * 3)]); SED.sel = { t: 'prop', i: S.O.length - 1 }; SED.drag = SED.pbrush ? { k: 'pbrush', lx: wx, ly: wy } : { k: 'move', h: SED.sel, wx, wy, pushed: 1 }; }
  else if (T === 'enemy') { S.U = S.U || []; for (let q = 0; q < SED.cnt; q++) { const a = q * 2.4, r = q ? 9 + q * 2 : 0; S.U.push([SED.enemy, R(wx + Math.cos(a) * r), R(wy + Math.sin(a) * r * 0.7)]); } SED.sel = { t: 'enemy', i: S.U.length - 1 }; SED.drag = SED.cnt === 1 ? { k: 'move', h: SED.sel, wx, wy, pushed: 1 } : null; }
  else if (T === 'lock') { S.L = S.L || []; S.L.push({ x: R(wx), y: R(wy), w: 540, h: 300, wv: ['foot*4', 'foot*3,scout*2'] }); SED.sel = { t: 'lock', i: S.L.length - 1 }; SED.drag = { k: 'move', h: SED.sel, wx, wy, pushed: 1 }; }
  else if (T === 'spawn') { S.SP = S.SP || []; S.SP.push([SED.spawn, R(wx), R(wy)]); SED.sel = { t: 'spawn', i: S.SP.length - 1 }; SED.drag = { k: 'move', h: SED.sel, wx, wy, pushed: 1 }; }
  else if (T === 'start') { const PS = skPS(S), dx = wx - PS[0][0], dy = wy - PS[0][1]; S.P = PS.map(q => [R(q[0] + dx), R(q[1] + dy)]); S.S = S.P[0].slice(); SED.sel = { t: 'pst', i: 0 }; }
  sedDone(); }
function sedMove(e) { if (SED.tool === 'ground') { SED.hov = sedW(e.offsetX, e.offsetY); SED.dirty = 1; } if (!SED.ptr.has(e.pointerId)) return; SED.ptr.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (SED.pinch && SED.ptr.size >= 2) { const [a, b] = [...SED.ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); SED.cam.s = cl(SED.pinch.s * d / Math.max(1, SED.pinch.d), 0.06, 4); const [wx, wy] = sedW((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); SED.cam.x += SED.pinch.m[0] - wx; SED.cam.y += SED.pinch.m[1] - wy; SED.dirty = 1; return; }
  const D = SED.drag; if (!D) return; const [wx, wy] = sedW(e.offsetX, e.offsetY), S = sedS(), R = v => Math.round(v);
  if (D.k === 'pan') { SED.cam.x = D.cx - (e.offsetX - D.sx) / SED.cam.s; SED.cam.y = D.cy - (e.offsetY - D.sy) / SED.cam.s; if (Math.hypot(e.offsetX - D.sx, e.offsetY - D.sy) > 6) D.moved = 1; SED.dirty = 1; return; }
  if (D.k === 'paint') { const L = Math.hypot(wx - D.lx, wy - D.ly), st = Math.max(1, (SED.brush - 0.5) * SKC * 0.5), n = Math.ceil(L / st); for (let q = 1; q <= n; q++) skPaint(S, D.lx + (wx - D.lx) * q / n, D.ly + (wy - D.ly) * q / n, SED.brush - 1, SED.paint); D.lx = wx; D.ly = wy; SED.dirty = 1; return; }
  if (D.k === 'pbrush') { const P = SKP[SED.prop], gap = Math.max(10, P.w * 0.75); if (Math.hypot(wx - D.lx, wy - D.ly) < gap) return; D.lx = wx; D.ly = wy; S.O.push([SED.prop, R(wx + (Math.random() - 0.5) * gap * 0.6), R(wy + (Math.random() - 0.5) * gap * 0.4), Math.round((0.85 + Math.random() * 0.3) * 10) / 10, Math.random() < 0.5 ? 1 : 0, Math.floor(Math.random() * 3)]); SED.dirty = 1; return; }
  if (D.k === 'move') { const dx = wx - D.wx, dy = wy - D.wy; if (!D.pushed) { if (Math.hypot(dx, dy) * SED.cam.s < 5) return; sedPush(); D.pushed = 1; } D.wx = wx; D.wy = wy; const h = D.h;
    if (h.t === 'prop') { const p = S.O[h.i]; p[1] = R(p[1] + dx); p[2] = R(p[2] + dy); }
    else if (h.t === 'enemy') { const u = S.U[h.i]; u[1] = R(u[1] + dx); u[2] = R(u[2] + dy); }
    else if (h.t === 'spawn') { const q = S.SP[h.i]; q[1] = R(q[1] + dx); q[2] = R(q[2] + dy); }
    else if (h.t === 'pst') { S.P = skPS(S).map(q => q.slice()); const q = S.P[h.i]; q[0] = R(q[0] + dx); q[1] = R(q[1] + dy); if (h.i === 0) S.S = q.slice(); }
    else if (h.t === 'cut') { const c = S.CS[h.i]; c.x = R(c.x + dx); c.y = R(c.y + dy); }
    else if (h.t === 'lock') { const L = S.L[h.i]; L.x = R(L.x + dx); L.y = R(L.y + dy); }
    else if (h.t === 'corner') { const L = S.L[h.i], ox = L.x - (h.c % 2 ? 1 : -1) * L.w / 2, oy = L.y - (h.c > 1 ? 1 : -1) * L.h / 2, nx = h.c % 2 ? Math.max(ox + 160, wx) : Math.min(ox - 160, wx), ny = h.c > 1 ? Math.max(oy + 120, wy) : Math.min(oy - 120, wy); L.w = R(Math.abs(nx - ox)); L.h = R(Math.abs(ny - oy)); L.x = R((nx + ox) / 2); L.y = R((ny + oy) / 2); }
    SED.dirty = 1; } }
function sedUp(e) { SED.ptr.delete(e.pointerId); if (SED.ptr.size < 2) SED.pinch = null; const D = SED.drag; SED.drag = null; if (!D) return;
  if (D.k === 'paint') { skCommit(sedS()); sedDone(); return; }
  if (D.k === 'pan') { if (!D.moved) { SED.sel = null; sedSheet(''); sedSelBar(); SED.dirty = 1; } return; }
  if (D.k === 'pbrush' || (D.k === 'move' && D.pushed)) sedDone(); }
// ---- drawing: exactly what the game draws, plus the editing marks ----
let sedGP = null;
function sedDraw() { if (!SED.on) return; requestAnimationFrame(sedDraw); const cv2 = document.getElementById('sedCv'); if (!cv2) return; const dpr = Math.min(2, devicePixelRatio || 1), W = cv2.clientWidth, H = cv2.clientHeight;
  sedKeys(); if (cv2.width !== Math.round(W * dpr) || cv2.height !== Math.round(H * dpr)) { cv2.width = Math.round(W * dpr); cv2.height = Math.round(H * dpr); SED.dirty = 1; }
  if (!SED.dirty && !SED.pend) return; SED.dirty = 0; const c = cv2.getContext('2d'), S = sedS(), s = SED.cam.s, sel = SED.sel, px = 1 / s, t = performance.now() / 1000;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - SED.cam.x * s), dpr * (H / 2 - SED.cam.y * s)); const [vx0, vy0] = sedW(0, 0), [vx1, vy1] = sedW(W, H);
  if (!sedGP) { sedGP = c.createPattern(grassT, 'repeat'); sedGP.setTransform(new DOMMatrix().scale(1 / 3)); } c.fillStyle = sedGP; c.fillRect(vx0 - 2, vy0 - 2, vx1 - vx0 + 4, vy1 - vy0 + 4);
  SED.pend = s > 0.1 ? skGround(c, S, vx0, vy0, vx1, vy1, 6) : 0;
  if (s <= 0.1) { const X = skX(S); for (let j = 0; j < S.gh; j++) for (let i = 0; i < S.gw; i++) { const v = X.a[j * S.gw + i]; if (v === 1) continue; c.fillStyle = ['#15301a', '', '#9a7a4c', '#8f877a', '#7d766b', '#2f4a24', '#2e6a86'][v]; c.fillRect(S.gx + i * SKC, S.gy + j * SKC, SKC + 0.5, SKC + 0.5); } }
  const inV = (x, y, m = 40) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m * 1.5;
  for (const p of S.O || []) if (SKP[p[0]] && SKP[p[0]].flat && inV(p[1], p[2])) skDrawProp(c, S, p);
  const list = []; for (const p of S.O || []) if (SKP[p[0]] && !SKP[p[0]].flat && inV(p[1], p[2])) list.push([p[2], 0, p]); for (const p of skEdge(S)) if (inV(p[1], p[2])) list.push([p[2], 0, p]);
  (S.U || []).forEach((u, i) => { if (UK[u[0]] && inV(u[1], u[2])) list.push([u[2], 1, u, i]); }); list.sort((a, b) => a[0] - b[0]);
  NOHP = true; for (const [, k, o, i] of list) { if (k === 0) skDrawProp(c, S, o); else { try { walkerLive(c, { x: o[1], y: o[2], k: o[0], ph: i * 1.3, hp: 1, max: 1, id: i + 1, atk: -1 }, 0, (S.S && S.S[0] > o[1]) ? 1 : -1, -1, false); } catch (e) { } } } NOHP = false;
  // locks: their screens, labels and corner handles; lines from spawn points to the lock they feed
  const SPL = cpSPof(S); c.lineWidth = 1.2 * px;
  for (const [tp, x, y, li] of SPL) { const L = S.L[li]; if (!L) continue; c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([4 * px, 4 * px]); c.beginPath(); c.moveTo(x, y); c.lineTo(cl(x, L.x - L.w / 2, L.x + L.w / 2), cl(y, L.y - L.h / 2, L.y + L.h / 2)); c.stroke(); } c.setLineDash([]);
  (S.L || []).forEach((L, i) => { const on = sel && sel.t === 'lock' && sel.i === i, x0 = L.x - L.w / 2, y0 = L.y - L.h / 2; c.fillStyle = L.boss ? 'rgba(255,60,40,.08)' : 'rgba(255,190,90,.06)'; c.fillRect(x0, y0, L.w, L.h); c.strokeStyle = L.boss ? '#ff5a40' : '#ffbf5a'; c.lineWidth = (on ? 3 : 2) * px; c.setLineDash(on ? [] : [12 * px, 7 * px]); c.strokeRect(x0, y0, L.w, L.h); c.setLineDash([]);
    const n = L.wv.reduce((a, w) => a + skParse(w).reduce((b, q) => b + q[1], 0), 0), pre = (S.U || []).filter(u => lkIn(L, u[1], u[2])).length, txt = `LOCK ${i + 1}${L.boss && UK[L.boss] ? ' · BOSS ' + UK[L.boss].n : ''} · ${L.wv.length} wave${L.wv.length > 1 ? 's' : ''}, ${n} flood in · ${pre} here`;
    c.font = `800 ${13 * px}px system-ui`; c.textBaseline = 'top'; c.textAlign = 'left'; const tw = c.measureText(txt).width; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x0, y0 - 18 * px, tw + 12 * px, 17 * px); c.fillStyle = L.boss ? '#ffb0a0' : '#ffe2a8'; c.fillText(txt, x0 + 6 * px, y0 - 16 * px);
    if (on) { c.fillStyle = '#ffd36a'; c.strokeStyle = '#000'; for (let q = 0; q < 4; q++) { c.beginPath(); c.arc(L.x + (q % 2 ? 1 : -1) * L.w / 2, L.y + (q > 1 ? 1 : -1) * L.h / 2, 9 * px, 0, 7); c.fill(); c.stroke(); } } });
  // spawn points
  (S.SP || []).forEach(([tp, x, y], i) => { const col = (SEDSP[tp] || SEDSP.woods)[1], on = sel && sel.t === 'spawn' && sel.i === i, r = Math.max(5, 10 * px); c.fillStyle = col + '55'; c.strokeStyle = on ? '#fff' : col; c.lineWidth = (on ? 3 : 2) * px; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = `800 ${Math.max(5, 10 * px)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((SEDSP[tp] || SEDSP.woods)[0][0], x, y + 0.5 * px); });
  // start: a stone with the sword in it
  skPS(S).forEach(([x, y], j) => { const on = sel && sel.t === 'pst' && sel.i === j; c.save(); c.translate(x, y); boulder(c, 0, true, 0); c.restore(); const r = Math.max(4, 8 * px); c.fillStyle = KCOLS[j] || '#9ef09e'; c.strokeStyle = on ? '#fff' : '#000'; c.lineWidth = (on ? 2.5 : 1.2) * px; c.beginPath(); c.arc(x, y + 6 + r + 2 * px, r, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = `900 ${r * 1.3}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(j + 1, x, y + 6 + r + 2.5 * px); });
  (S.CS || []).forEach((cs, i) => { if (cs.tr !== 'spot') return; const on = sel && sel.t === 'cut' && sel.i === i, r = cs.r || 60; c.fillStyle = 'rgba(160,120,255,.10)'; c.strokeStyle = on ? '#fff' : '#b89aff'; c.lineWidth = (on ? 2.5 : 1.5) * px; c.setLineDash([6 * px, 4 * px]); c.beginPath(); c.ellipse(cs.x, cs.y, r, r * 0.7, 0, 0, 7); c.fill(); c.stroke(); c.setLineDash([]);
    c.font = `800 ${Math.max(7, 13 * px)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000a'; const tx = '🎬 ' + (i + 1); c.fillRect(cs.x - 18 * px, cs.y - 10 * px, 36 * px, 20 * px); c.fillStyle = '#fff'; c.fillText(tx, cs.x, cs.y); });
  // selection ring
  if (sel && (sel.t === 'prop' || sel.t === 'enemy')) { const o = sel.t === 'prop' ? S.O[sel.i] : S.U[sel.i]; if (o) { const r = sel.t === 'prop' ? Math.max(8, (SKP[o[0]] ? SKP[o[0]].w : 10) * (o[3] || 1) * 0.45) : 6 * (UK[o[0]] ? UK[o[0]].sc || 1 : 1); c.strokeStyle = '#ffd36a'; c.lineWidth = 2 * px; c.setLineDash([5 * px, 3 * px]); c.beginPath(); c.ellipse(o[1], o[2], r, r * 0.45, 0, 0, 7); c.stroke(); c.setLineDash([]); } }
  // the brush
  if (SED.tool === 'ground' && SED.hov) { const [hx, hy] = SED.hov; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5 * px; c.beginPath(); c.arc(hx, hy, (SED.brush - 0.5) * SKC, 0, 7); c.stroke(); } }
window.__sed = { SED, open: sedOpen, close: sedClose };
