/* Break of Day — client: lobby, netcode, 3D rendering, HUD */
(function () {
'use strict';
const DW = window.DW, THREE = window.THREE;
const SB_URL = 'https://ucdwqexhkglvhilurqti.supabase.co', SB_KEY = 'sb_publishable_E9Iaftt5o7nK4Ph5FeoONw_QSfj7KeE';
const BUILD = window.BOD_BUILD || 'dev';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('bod_' + k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('bod_' + k, v); } catch (e) { } } };
let myPid = store.get('pid', null); if (!myPid) { myPid = Math.random().toString(36).slice(2, 10); store.set('pid', myPid); }
let myName = store.get('name', 'Warrior' + Math.floor(100 + Math.random() * 900));
let myHero = store.get('hero', 'ironvow'); if (!DW.HEROES[myHero]) myHero = 'ironvow';
const fmtT = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
const RAR_COL = DW.RARITY.map(r => r.col);
const itemCol = it => it.rar >= 0 ? RAR_COL[it.rar] : it.rar === -2 ? '#7ae8ff' : '#f0e2b6';
function statLine(s) { return Object.keys(s).map(k => '+' + (DW.PCT[k] ? Math.round(s[k] * 100) + '%' : Math.round(s[k] * 10) / 10) + ' ' + (DW.STAT_NAMES[k] || k)).join(', '); }
function toast(t, c) { const el = document.createElement('div'); el.className = 'toast ' + (c || ''); el.textContent = t; $('toasts').appendChild(el); setTimeout(() => el.remove(), 2600); }
function show(id) { ['menu', 'lobby', 'game', 'end'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }

// ============================ NETWORK / LOBBY ============================
let sb = null;
function getSB() { if (!sb && window.supabase) sb = window.supabase.createClient(SB_URL, SB_KEY, { realtime: { params: { eventsPerSecond: 40 } } }); return sb; }
const L = { mode: null, code: null, ch: null, roomsCh: null, players: [], host: false, ready: false, started: false };

function initMenu() {
  $('ver').textContent = 'v' + DW.VERSION + ' · build ' + BUILD;
  $('nameIn').value = myName;
  $('nameIn').oninput = e => { myName = e.target.value.replace(/[<>]/g, '').slice(0, 16); store.set('name', myName); };
  renderRejoin();
  $('btnSolo').onclick = () => enterLobby('solo');
  $('btnCreate').onclick = () => enterLobby('host');
  $('btnJoin').onclick = () => { const c = $('codeIn').value.trim().toUpperCase(); if (c.length < 4) return toast('Enter a room code'); enterLobby('client', c); };
  watchRooms();
}
function watchRooms() {
  const s = getSB(); if (!s) { $('roomList').innerHTML = '<div class="muted">Online play unavailable (could not load network library).</div>'; return; }
  L.roomsCh = s.channel('bod-rooms', { config: { presence: { key: myPid } } });
  L.roomsCh.on('presence', { event: 'sync' }, renderRooms);
  L.roomsCh.subscribe(st => { if (st === 'SUBSCRIBED' && L.host && L.code && !L.started) trackRoom(); });
}
function renderRooms() {
  if (!L.roomsCh) return;
  const st = L.roomsCh.presenceState(); const rooms = [];
  for (const k in st) for (const p of st[k]) if (p.code && !p.started) rooms.push(p);
  $('roomList').innerHTML = rooms.length ? rooms.map(r => `<div class="room"><span><b>${esc(r.code)}</b> · ${esc(r.hostName)}'s war party</span><span>${r.n}/4 <button class="btn sm" data-code="${esc(r.code)}">Join</button></span></div>`).join('') : '<div class="muted">No open rooms. Create one!</div>';
  $('roomList').querySelectorAll('button').forEach(b => b.onclick = () => enterLobby('client', b.dataset.code));
}
function trackRoom() { if (L.roomsCh) L.roomsCh.track({ code: L.code, hostName: myName, n: L.players.length || 1, started: L.started }); }
function untrackRoom() { if (L.roomsCh) L.roomsCh.untrack(); }

function enterLobby(mode, code) {
  if (!myName.trim()) { toast('Enter your name first', 'warn'); $('nameIn').focus(); return; }
  L.mode = mode; L.host = mode !== 'client'; L.ready = L.host; L.started = false; L.players = [];
  show('lobby'); renderHeroPick();
  if (mode === 'solo') { $('lobbyTitle').textContent = 'Solo Expedition'; $('lobbyCode').textContent = 'Offline'; L.players = [{ pid: myPid, name: myName, hero: myHero, ready: true, host: true }]; renderLobby(); return; }
  if (!getSB()) { toast('Network unavailable'); show('menu'); return; }
  L.code = code || Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  $('lobbyTitle').textContent = L.host ? 'Your War Party' : 'War Party'; $('lobbyCode').textContent = L.code;
  L.joined = Date.now();
  openRoomChannel();
  renderLobby();
}
function openRoomChannel() {
  const s = getSB(); if (L.ch) { try { s.removeChannel(L.ch); } catch (e) { } }
  const ch = s.channel('bod-room-' + L.code, { config: { presence: { key: myPid }, broadcast: { self: false, ack: false } } });
  L.ch = ch;
  ch.on('presence', { event: 'sync' }, () => {
    if (ch !== L.ch) return;
    const st = ch.presenceState(); const arr = [];
    for (const k in st) { const p = st[k][st[k].length - 1]; if (p) arr.push(p); }
    arr.sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.joined - b.joined);
    L.players = arr;
    const hostHere = arr.some(p => p.host);
    if (hostHere) { L.seenHost = true; clearTimeout(L.hostGone); L.hostGone = null; }
    if (!L.host && L.seenHost && !hostHere && !L.hostGone) {
      L.hostGone = setTimeout(() => { L.hostGone = null; if (L.players.some(p => p.host)) return; toast('The host has left — the match is over'); clearSession(); if (G.running) quitGame(); else leaveLobby(); }, G.running ? 20000 : 3000);
    }
    if (G.running) return;
    if (!L.host && arr.length > 4 && arr.findIndex(p => p.pid === myPid) >= 4) { toast('Room is full'); leaveLobby(); return; }
    if (L.host) trackRoom();
    renderLobby();
  });
  ch.on('broadcast', { event: 'start' }, ({ payload }) => { if (!L.host && !G.running) startGame('client', payload); });
  ch.on('broadcast', { event: 's' }, ({ payload }) => { if (G.running && G.mode === 'client') applySnap(payload); });
  ch.on('broadcast', { event: 'in' }, ({ payload }) => { if (G.running && G.mode === 'host' && G.sim) G.sim.input(payload.pid, payload.c); });
  ch.on('broadcast', { event: 'kick' }, ({ payload }) => { if (payload.pid === myPid) { toast('Removed from room'); leaveLobby(); } });
  ch.subscribe(st => { if (st === 'SUBSCRIBED') pushPresence(); });
}
// ---- session / rejoin ----
function saveSession() { if (L.mode === 'solo') return; store.set('session', JSON.stringify({ code: L.code, host: L.host, t: Date.now() })); }
function clearSession() { store.set('session', ''); }
function getSession() { try { const s = JSON.parse(store.get('session', '') || 'null'); if (s && Date.now() - s.t < 45 * 60000) return s; } catch (e) { } return null; }
function rejoin(sess) {
  if (sess.host) { toast('Matches end when the host leaves'); clearSession(); renderRejoin(); return; }
  if (!getSB()) return toast('Network unavailable');
  L.mode = 'client'; L.host = false; L.ready = true; L.started = true; L.code = sess.code; L.joined = Date.now(); L.seenHost = false;
  openRoomChannel(); startGame('client', { players: [] });
  $('netOv').classList.remove('hidden'); $('netTxt').textContent = 'Rejoining match ' + sess.code + '…';
  setTimeout(() => { if (G.running && !G.cur) { toast('Match not found — it may have ended'); clearSession(); quitGame(); } }, 15000);
}
function renderRejoin() {
  const sess = getSession(); $('btnRejoin').classList.toggle('hidden', !sess || sess.host);
  if (sess && !sess.host) { $('btnRejoin').textContent = '↻ Rejoin Match ' + sess.code; $('btnRejoin').onclick = () => rejoin(sess); }
}
function pushPresence() { if (L.ch) L.ch.track({ pid: myPid, name: myName, hero: myHero, ready: L.ready, host: L.host, joined: L.joined }); }
function leaveLobby() {
  if (L.ch) { try { L.ch.untrack(); getSB().removeChannel(L.ch); } catch (e) { } }
  L.ch = null; L.code = null; L.seenHost = false; clearTimeout(L.hostGone); L.hostGone = null; if (L.host) untrackRoom(); show('menu'); renderRejoin();
}
function renderHeroPick() {
  $('heroPick').innerHTML = DW.HERO_IDS.map(id => { const h = DW.HEROES[id]; return `<button class="heroCard ${id === myHero ? 'sel' : ''}" data-h="${id}" style="--hc:${h.col}"><div class="hPort" style="background:${h.col}">${h.name[0]}</div><div><b>${h.name}</b><small>${h.role} · ${h.res.type}</small></div></button>`; }).join('');
  $('heroPick').querySelectorAll('.heroCard').forEach(b => b.onclick = () => { myHero = b.dataset.h; store.set('hero', myHero); renderHeroPick(); if (L.mode === 'solo') L.players[0].hero = myHero; pushPresence(); renderLobby(); });
  renderHeroInfo(myHero, $('heroInfo'));
}
function renderHeroInfo(id, el) {
  const h = DW.HEROES[id], b = h.base;
  el.innerHTML = `<h3 style="color:${h.col}">${h.name} <small>${h.title}</small></h3>
  <div class="statGrid">${[['HP', b.hp], ['Attack Dmg', b.ad], ['Armor', b.armor], ['Magic Resist', b.mr], ['Movespeed', b.ms], ['Range', b.range > 4 ? 'Ranged' : 'Melee'], ['Resource', h.res.type], ['Crit', Math.round(b.crit * 100) + '%']].map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('')}</div>
  ${h.ab.map((a, i) => `<div class="abInfo"><b>${'QWER'[i]} · ${a.n}</b>${a.ult ? ' <i>(Ultimate, lvl 6/11/16)</i>' : ''}<p>${a.d}</p></div>`).join('')}`;
}
function renderLobby() {
  const me = L.players.find(p => p.pid === myPid);
  $('playerList').innerHTML = L.players.slice(0, 4).map(p => { const h = DW.HEROES[p.hero] || DW.HEROES.ironvow; return `<div class="pRow"><div class="hPort sm" style="background:${h.col}">${h.name[0]}</div><span><b>${esc(p.name)}</b>${p.host ? ' 👑' : ''}<small>${h.name}</small></span><span class="${p.ready ? 'ok' : 'muted'}">${p.ready ? 'Ready' : 'Picking…'}</span>${L.host && !p.host && L.mode === 'host' ? `<button class="btn sm ghost" data-kick="${p.pid}">✕</button>` : ''}</div>`; }).join('') + (L.mode === 'solo' ? '' : `<div class="muted">${Math.max(0, 4 - L.players.length)} open slot(s) · share code <b>${L.code}</b></div>`);
  $('playerList').querySelectorAll('[data-kick]').forEach(b => b.onclick = () => L.ch.send({ type: 'broadcast', event: 'kick', payload: { pid: b.dataset.kick } }));
  const btn = $('btnReady');
  if (L.host) { const all = L.players.slice(0, 4).every(p => p.ready); btn.textContent = 'Begin the Battle'; btn.disabled = !all; btn.onclick = hostStart; $('lobbyHint').textContent = all ? '' : 'Waiting for everyone to ready up…'; }
  else { btn.disabled = false; btn.textContent = L.ready ? 'Unready' : 'Ready'; btn.onclick = () => { L.ready = !L.ready; pushPresence(); renderLobby(); }; $('lobbyHint').textContent = 'The host starts the match when everyone is ready.'; }
  $('btnLeave').onclick = leaveLobby;
  if (me && me.hero !== myHero) pushPresence();
}
function hostStart() {
  const players = L.players.slice(0, 4).map(p => ({ pid: p.pid, name: p.name, hero: p.hero }));
  const seed = Math.floor(Math.random() * 2 ** 31);
  if (L.mode === 'host') { L.started = true; trackRoom(); L.ch.send({ type: 'broadcast', event: 'start', payload: { seed, players } }); }
  startGame(L.mode, { seed, players });
}

// ============================ GAME STATE ============================
const G = { running: false, mode: null, sim: null, cur: null, prev: null, prevMap: new Map(), recvT: 0, interval: 100, me: null, stats: {}, aim: -1, follow: true,
  camX: 0, camZ: 100, zoom: 44, mouse: { x: 0, y: 0, wx: 0, wz: 0 }, meshes: new Map(), projMeshes: new Map(), zoneMeshes: [], fxList: [], nums: [], feed: [], ended: false, lastTownPrompt: 0 };
let renderer, scene, camera, hemi, sun, overlay, octx, mini, mctx, miniBg, raycaster, groundPlane, rangeRing, aimMarker, moveMarker, myRing;

function startGame(mode, cfg) {
  G.mode = mode; G.running = true; G.ended = false; G.cur = G.prev = null; G.stats = {}; G.feed = []; G.nums = []; G.aim = -1; G.follow = true; G.myHeroId = null;
  G.players = cfg.players; G.recvT = 0; G.lastNet = performance.now();
  saveSession();
  show('game'); $('feed').innerHTML = '';
  if (!renderer) init3D();
  clearWorld();
  if (mode !== 'client') {
    G.sim = new DW.Sim({ seed: cfg.seed, players: cfg.players }); G.stepN = 0;
    clearInterval(G.simTimer); let last = performance.now(), acc = 0;
    G.simTimer = setInterval(() => {
      const now = performance.now(); acc += Math.min(0.5, (now - last) / 1000); last = now;
      while (acc >= DW.DT && G.running) {
        acc -= DW.DT; G.sim.step(); G.stepN++;
        if (G.stepN % 2 === 0) {
          const snap = G.sim.snapshot(G.stepN % 40 === 0);
          if (mode === 'host' && L.ch) L.ch.send({ type: 'broadcast', event: 's', payload: snap });
          applySnap(snap);
        }
        if (G.sim.over && G.stepN % 2 === 0 && G.overSent) { clearInterval(G.simTimer); break; }
        if (G.sim.over) G.overSent = true;
      }
    }, 25);
  }
  G.overSent = false;
  resize();
}
function quitGame() {
  clearSession(); $('netOv').classList.add('hidden');
  G.running = false; clearInterval(G.simTimer); G.sim = null;
  if (L.mode !== 'solo') leaveLobby(); else show('menu');
}
function send(c) {
  if (!G.running) return;
  if (G.mode === 'client') { if (L.ch) L.ch.send({ type: 'broadcast', event: 'in', payload: { pid: myPid, c } }); }
  else if (G.sim) G.sim.input(myPid, c);
}
function applySnap(s) {
  if (G.cur) { G.prev = G.cur; G.prevMap = new Map(); for (const e of G.prev.e) G.prevMap.set(e[0], e); for (const p of G.prev.p) G.prevMap.set('p' + p[0], p); }
  G.cur = s; const now = performance.now(); G.lastNet = now; if (!$('netOv').classList.contains('hidden')) { $('netOv').classList.add('hidden'); if (G.reconnecting) toast('Reconnected', 'info'); G.reconnecting = false; } if (G.recvT) G.interval = G.interval * 0.8 + Math.min(300, now - G.recvT) * 0.2; G.recvT = now;
  for (const h of s.h) { if (h.st) G.stats[h.pid] = h.st; if (h.pid === myPid) { G.me = h; G.myHeroId = h.id; } }
  for (const f of s.fx) spawnFx(f);
  for (const m of s.m) addMsg(m[0], m[1]);
  if (s.over && !G.ended) { G.ended = true; setTimeout(() => showEnd(s), 2500); }
}
function addMsg(text, c) {
  if (c[0] === 'p') { if (c.slice(1) === myPid) toast(text, 'warn'); return; }
  const el = document.createElement('div'); el.className = 'msg c-' + c; el.textContent = text; $('feed').prepend(el);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
  setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 800); }, 7000);
}

// ============================ 3D ============================
const matCache = new Map();
function mat(col, emis) { const k = col + '|' + (emis || ''); if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: col, emissive: emis || 0x000000, flatShading: true })); return matCache.get(k); }
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), cone: new THREE.ConeGeometry(0.5, 1, 8), cone4: new THREE.ConeGeometry(0.5, 1, 4),
  sph: new THREE.SphereGeometry(0.5, 10, 8), oct: new THREE.OctahedronGeometry(0.5), ico: new THREE.IcosahedronGeometry(0.5, 0), torus: new THREE.TorusGeometry(0.5, 0.08, 6, 16),
  ring: new THREE.RingGeometry(0.88, 1, 40), disc: new THREE.CircleGeometry(1, 40)
};
function part(g, col, sx, sy, sz, x, y, z, emis) { const m = new THREE.Mesh(geo[g], mat(col, emis)); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0); return m; }
function grp(...parts) { const g = new THREE.Group(); parts.forEach(p => g.add(p)); return g; }

function init3D() {
  renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  $('view').appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x9cc7e8, 60, 140); scene.background = new THREE.Color(0x9cc7e8);
  camera = new THREE.PerspectiveCamera(48, 1, 1, 400);
  hemi = new THREE.HemisphereLight(0xdfefff, 0x3a5a2a, 0.7); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d0, 0.85); sun.position.set(-40, 80, 30); scene.add(sun);
  overlay = $('overlay'); octx = overlay.getContext('2d');
  mini = $('minimap'); mctx = mini.getContext('2d');
  raycaster = new THREE.Raycaster(); groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  buildTerrain(); buildMinimapBg();
  rangeRing = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.5, depthWrite: false })); rangeRing.rotation.x = -Math.PI / 2; rangeRing.position.y = 0.08; rangeRing.visible = false; scene.add(rangeRing);
  aimMarker = new THREE.Mesh(geo.disc, new THREE.MeshBasicMaterial({ color: 0xffb35a, transparent: true, opacity: 0.35, depthWrite: false })); aimMarker.rotation.x = -Math.PI / 2; aimMarker.position.y = 0.09; aimMarker.visible = false; scene.add(aimMarker);
  moveMarker = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0x7aff7a, transparent: true, opacity: 0, depthWrite: false })); moveMarker.rotation.x = -Math.PI / 2; moveMarker.position.y = 0.1; scene.add(moveMarker);
  myRing = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0x7aff7a, transparent: true, opacity: 0.8, depthWrite: false })); myRing.rotation.x = -Math.PI / 2; myRing.scale.setScalar(1.3); myRing.position.y = 0.06; scene.add(myRing);
  for (let i = 0; i < 24; i++) { const g = new THREE.Group(); const r = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.8, depthWrite: false })); const d = new THREE.Mesh(geo.disc, new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.25, depthWrite: false })); r.rotation.x = d.rotation.x = -Math.PI / 2; d.position.y = 0.01; g.add(r, d); g.position.y = 0.12; g.visible = false; scene.add(g); G.zoneMeshes.push(g); }
  window.addEventListener('resize', resize); bindInput(); requestAnimationFrame(frame);
}
function resize() {
  if (!renderer) return; const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio, 2); overlay.width = w * dpr; overlay.height = h * dpr; overlay.style.width = w + 'px'; overlay.style.height = h + 'px'; octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  $('rotateHint').classList.toggle('hidden', !(h > w && w < 700));
}
function hash2(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
function buildTerrain() {
  const W = DW.MAP.W * 2 + 30, H = DW.MAP.H * 2 + 30, sx = 110, sz = 125;
  const g = new THREE.PlaneGeometry(W, H, sx, sz); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3); const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), ld = DW.laneDist(x, z), n = hash2(Math.round(x), Math.round(z));
    const base = Math.abs(z) > 100 && Math.abs(x) < 26;
    if (base) c.setHSL(0.08, 0.08, 0.42 + n * 0.06);
    else if (ld < 5) c.setHSL(0.09, 0.35, 0.36 + n * 0.05);
    else if (ld < 7.5) c.setHSL(0.17, 0.35, 0.33 + n * 0.05);
    else c.setHSL(0.27 + n * 0.03, 0.45, 0.26 + n * 0.06 - (Math.abs(x) > DW.MAP.W || Math.abs(z) > DW.MAP.H ? 0.1 : 0));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    if (ld > 9 && !base) pos.setY(i, -0.05 + n * 0.25 * Math.min(1, (ld - 9) / 8));
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  // trees
  const avoid = [...DW.MAP.towns, ...DW.MAP.bosses, ...DW.MAP.camps, DW.MAP.secretShop, DW.MAP.forge, ...DW.MAP.encSpots.map(p => ({ x: p[0], z: p[1] }))];
  const spots = []; let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 4200 && spots.length < 900; i++) {
    const x = (rnd() * 2 - 1) * (DW.MAP.W + 12), z = (rnd() * 2 - 1) * (DW.MAP.H + 12);
    const edge = Math.abs(x) > DW.MAP.W - 2 || Math.abs(z) > DW.MAP.H - 2;
    if (!edge) { if (DW.laneDist(x, z) < 11) continue; if (Math.abs(z) > 98 && Math.abs(x) < 32) continue; if (avoid.some(a => (a.x - x) ** 2 + (a.z - z) ** 2 < 110)) continue; if (rnd() < 0.55) continue; }
    spots.push([x, z, 0.8 + rnd() * 0.7, rnd()]);
  }
  const trunk = new THREE.InstancedMesh(geo.cyl, mat(0x5a3d22), spots.length), crown = new THREE.InstancedMesh(geo.cone, mat(0x2f6b2a), spots.length), crown2 = new THREE.InstancedMesh(geo.cone, mat(0x3c8034), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  spots.forEach((s, i) => {
    m4.compose(p3.set(s[0], 0.8 * s[2], s[1]), q, sc.set(0.5 * s[2], 1.6 * s[2], 0.5 * s[2])); trunk.setMatrixAt(i, m4);
    m4.compose(p3.set(s[0], 2.8 * s[2], s[1]), q, sc.set(2.6 * s[2], 3.2 * s[2], 2.6 * s[2])); crown.setMatrixAt(i, m4);
    m4.compose(p3.set(s[0], 4.3 * s[2], s[1]), q, sc.set(1.7 * s[2], 2.4 * s[2], 1.7 * s[2])); crown2.setMatrixAt(i, m4);
  });
  scene.add(trunk, crown, crown2);
  // rocks
  const rocks = new THREE.InstancedMesh(geo.ico, mat(0x7c7f86), 160);
  for (let i = 0; i < 160; i++) { const x = (rnd() * 2 - 1) * DW.MAP.W, z = (rnd() * 2 - 1) * DW.MAP.H; const ld = DW.laneDist(x, z); const s = ld < 9 ? 0.001 : 0.6 + rnd() * 1.8; m4.compose(p3.set(x, s * 0.2, z), q.setFromAxisAngle(p3.clone().set(0, 1, 0), rnd() * 6), sc.set(s, s * 0.7, s)); rocks.setMatrixAt(i, m4); }
  scene.add(rocks);
  // bases
  [[0, 112, 0x3a64a8], [0, -112, 0x8a2a3a]].forEach(([x, z, col]) => { const p = part('cyl', 0x8d8a82, 26, 0.4, 26, x, 0.1, z); scene.add(p); const r = part('torus', col, 26, 26, 6, x, 0.4, z, col); r.rotation.x = Math.PI / 2; scene.add(r); });
  const ft = grp(part('cyl', 0x9aa4b4, 3, 1.2, 3, 0, 0.6, 0), part('cyl', 0x4ab0ff, 2.4, 0.2, 2.4, 0, 1.25, 0, 0x2a70c0), part('oct', 0xbfe6ff, 0.8, 1.4, 0.8, 0, 2.6, 0, 0x4a90d0)); ft.position.set(DW.MAP.fountain.x, 0, DW.MAP.fountain.z + 3); scene.add(ft); G.fountain = ft;
  // ledger board at base
  const lb = grp(part('box', 0x5a3d22, 0.3, 3, 0.3, -1.6, 1.5, 0), part('box', 0x5a3d22, 0.3, 3, 0.3, 1.6, 1.5, 0), part('box', 0x8a6a3a, 3.8, 2, 0.2, 0, 2.6, 0), part('box', 0xe8d8a8, 3.2, 1.4, 0.05, 0, 2.6, 0.12));
  lb.position.set(8, 0, 104); lb.rotation.y = -0.4; scene.add(lb);
  // secret shop
  const ss = grp(part('cone4', 0x6a2a9a, 5, 4, 5, 0, 2, 0), part('box', 0x3a2a1a, 3.4, 0.6, 3.4, 0, 0.3, 0), part('oct', 0xd08aff, 0.7, 1, 0.7, 0, 4.8, 0, 0x8a3ad0));
  ss.position.set(DW.MAP.secretShop.x, 0, DW.MAP.secretShop.z); scene.add(ss); G.secretGem = ss.children[2];
  // hidden forge (not on minimap)
  const fg = grp(part('box', 0x4a4a52, 2.6, 1, 1.4, 0, 0.5, 0), part('box', 0x2a2a30, 3.4, 0.5, 1.8, 0, 1.25, 0), part('ico', 0x6a6a70, 1.5, 1.2, 1.5, -3, 0.6, 1), part('ico', 0x6a6a70, 1.2, 1.4, 1.2, 2.8, 0.6, -1.4), part('sph', 0xff6a20, 0.6, 0.4, 0.6, 0, 1.6, 0, 0xff4a00));
  fg.position.set(DW.MAP.forge.x, 0, DW.MAP.forge.z); scene.add(fg); G.forgeEmber = fg.children[4];
  // camp markers
  DW.MAP.camps.forEach(c => { const d = part('cyl', 0x6a5a3a, 5, 0.15, 5, c.x, 0.05, c.z); scene.add(d); });
}
const CREEP_LOOK = { bandit: [0x7a5a3a, 1], archer: [0x8a6a4a, 0.95], wolf: [0x8c8c94, 0.9], troll: [0x4a7a6a, 1.25], trollshaman: [0x5a6a9a, 1.1], ogre: [0x7a8a4a, 1.6], rockgolem: [0x7a7470, 1.7], sapling: [0x5a8a3a, 0.8], toad: [0x4a6a3a, 0.8] };
function buildModel(v, team) {
  const tc = team === 0 ? 0x3a7ae0 : team === 1 ? 0xc0303a : 0xc8a050;
  const k = v.split('_')[0], sub = v.slice(k.length + 1);
  let g;
  if (v === 'core') {
    const cc = team ? 0xff3a4a : 0x4a9aff;
    g = grp(part('cyl', 0x8a8a90, 6, 1.4, 6, 0, 0.7, 0), part('cyl', 0x6a6a70, 4, 1.4, 4, 0, 2, 0), part('oct', cc, 3, 5, 3, 0, 6, 0, team ? 0x801020 : 0x1a4a9a));
    g.userData.spin = g.children[2]; g.userData.h = 10;
  } else if (v === 'tower') {
    g = grp(part('cyl', 0x8a8478, 2.8, 7, 2.8, 0, 3.5, 0), part('cyl', 0x6a645a, 3.6, 0.8, 3.6, 0, 7.2, 0), part('cone', team ? 0x7a2030 : 0x2a4a8a, 3.6, 2.2, 3.6, 0, 8.7, 0), part('oct', team ? 0xff5a6a : 0x6ab0ff, 0.9, 1.3, 0.9, 0, 10.6, 0, team ? 0x801020 : 0x1a4a9a));
    g.userData.spin = g.children[3]; g.userData.h = 11;
  } else if (v === 'town') {
    g = new THREE.Group();
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + 0.4, r = 4.6; const hs = grp(part('box', 0xb8a080, 2.2, 1.8, 2.2, 0, 0.9, 0), part('cone4', 0x8a3a2a, 2.4, 1.6, 2.4, 0, 2.6, 0)); hs.children[1].rotation.y = Math.PI / 4; hs.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); hs.rotation.y = -a; g.add(hs); }
    const pole = part('cyl', 0x5a3d22, 0.2, 6, 0.2, 0, 3, 0); g.add(pole);
    const flagMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide }); const flag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), flagMat); flag.position.set(1, 5.3, 0); g.add(flag);
    const wall = part('torus', 0x8a8478, 7.2, 7.2, 6, 0, 0.3, 0); wall.rotation.x = Math.PI / 2; g.add(wall);
    const torch = part('sph', 0xffb040, 0.6, 0.6, 0.6, 0, 6.3, 0, 0xff8a20); g.add(torch);
    g.userData.flag = flagMat; g.userData.h = 7; g.userData.static = 1;
  } else if (k === 'h') {
    const H = DW.HEROES[sub]; const c = new THREE.Color(H.col).getHex();
    g = new THREE.Group();
    if (sub === 'ironvow') g.add(part('cyl', 0xb8c4d8, 1.1, 1.6, 1.1, 0, 1.2, 0), part('sph', 0xd8dce8, 0.75, 0.8, 0.75, 0, 2.35, 0), part('box', 0x2a4a9a, 1.2, 1.5, 0.12, 0, 1.4, -0.55), part('box', 0x3a6ad0, 1.1, 1.3, 0.25, -0.75, 1.3, 0.25), part('box', 0xe8e8f0, 0.12, 1.8, 0.12, 0.75, 1.5, 0.45));
    else if (sub === 'emberwitch') g.add(part('cone', 0xa02a1a, 1.4, 2.2, 1.4, 0, 1.1, 0), part('sph', 0xf0c8a8, 0.6, 0.6, 0.6, 0, 2.35, 0), part('cone', 0x3a1a1a, 1, 1.4, 1, 0, 3.1, 0), part('cyl', 0x5a3a2a, 0.1, 2.6, 0.1, 0.7, 1.4, 0.3), part('sph', 0xff6a20, 0.45, 0.45, 0.45, 0.7, 2.8, 0.3, 0xff4a10));
    else if (sub === 'thornshot') g.add(part('cyl', 0x3a6a2a, 0.9, 1.6, 0.9, 0, 1.1, 0), part('sph', 0xe0c0a0, 0.6, 0.6, 0.6, 0, 2.2, 0), part('cone', 0x2a5a1a, 0.9, 0.9, 0.9, 0, 2.6, 0), part('torus', 0x8a5a2a, 1.6, 1.6, 2, 0.6, 1.5, 0.3), part('box', 0x6a4a2a, 0.4, 1, 0.3, 0, 1.4, -0.5));
    else if (sub === 'bloodreaver') g.add(part('cyl', 0x5a1a1a, 1.3, 1.7, 1.2, 0, 1.2, 0), part('sph', 0xc09080, 0.7, 0.7, 0.7, 0, 2.4, 0), part('cone', 0xdddddd, 0.2, 0.6, 0.2, -0.3, 2.85, 0), part('cone', 0xdddddd, 0.2, 0.6, 0.2, 0.3, 2.85, 0), part('cyl', 0x4a3a2a, 0.12, 2.4, 0.12, 0.8, 1.4, 0.3), part('box', 0xb0b0b8, 0.2, 0.9, 1, 0.8, 2.4, 0.5));
    else g.add(part('cone', 0xf4ecd8, 1.4, 2.3, 1.4, 0, 1.15, 0), part('sph', 0xf0d0b0, 0.6, 0.6, 0.6, 0, 2.4, 0), part('torus', 0xffe080, 0.9, 0.9, 0.9, 0, 3.05, 0, 0xffc020), part('cyl', 0xd8c080, 0.1, 2.4, 0.1, 0.7, 1.3, 0.2), part('oct', 0xfff1a8, 0.4, 0.5, 0.4, 0.7, 2.7, 0.2, 0xffd040));
    if (sub === 'lumen') g.children[2].rotation.x = Math.PI / 2;
    if (sub === 'thornshot') g.children[3].rotation.y = Math.PI / 2;
    g.scale.setScalar(1.05); g.userData.h = 3.4; g.userData.hero = 1;
  } else if (k === 'ma' || k === 'me') {
    const body = k === 'ma' ? 0x4a7ad0 : 0xb03a4a, dark = k === 'ma' ? 0x2a4a8a : 0x6a1a2a;
    if (sub === 'siege') { g = grp(part('box', 0x6a4a2a, 1.8, 0.8, 2.4, 0, 0.8, 0), part('cyl', 0x3a3a3a, 0.9, 0.3, 0.9, 1, 0.45, 0.8), part('cyl', 0x3a3a3a, 0.9, 0.3, 0.9, -1, 0.45, 0.8), part('cyl', 0x3a3a3a, 0.9, 0.3, 0.9, 1, 0.45, -0.8), part('cyl', 0x3a3a3a, 0.9, 0.3, 0.9, -1, 0.45, -0.8), part('cyl', dark, 0.5, 1.8, 0.5, 0, 1.5, 0.3)); g.children.slice(1, 5).forEach(w => w.rotation.z = Math.PI / 2); g.children[5].rotation.x = -0.9; g.userData.h = 2.2; }
    else if (sub === 'ranged') { g = grp(part('cone', body, 0.9, 1.4, 0.9, 0, 0.7, 0), part('sph', 0xd8c0a8, 0.45, 0.45, 0.45, 0, 1.6, 0), part('sph', k === 'ma' ? 0x8ad0ff : 0xff8a6a, 0.3, 0.3, 0.3, 0.4, 1.4, 0.3, k === 'ma' ? 0x2a6aa0 : 0xa02a10)); g.userData.h = 2; }
    else { g = grp(part('cyl', body, 0.8, 1, 0.8, 0, 0.6, 0), part('sph', dark, 0.55, 0.55, 0.55, 0, 1.35, 0), part('box', 0xb0b0b8, 0.1, 0.8, 0.1, 0.45, 0.9, 0.3)); g.userData.h = 1.8; }
  } else if (k === 'c') {
    const lk = CREEP_LOOK[sub] || [0x7a6a5a, 1]; const s = lk[1];
    if (sub === 'wolf') g = grp(part('box', lk[0], 0.7, 0.7, 1.5, 0, 0.6, 0), part('box', lk[0], 0.5, 0.5, 0.6, 0, 0.8, 0.85), part('cone4', 0x5a5a60, 0.2, 0.3, 0.2, 0, 1.15, 0.8));
    else if (sub === 'rockgolem') g = grp(part('ico', lk[0], 2, 1.8, 1.6, 0, 1.4, 0), part('ico', 0x8a847e, 0.9, 0.9, 0.9, 0, 2.6, 0.2), part('ico', lk[0], 0.8, 1.2, 0.8, -1.2, 1.3, 0), part('ico', lk[0], 0.8, 1.2, 0.8, 1.2, 1.3, 0));
    else if (sub === 'sapling' || sub === 'toad') g = grp(part('sph', lk[0], 0.9, 0.8, 0.9, 0, 0.5, 0), part('cone', 0x3a7a2a, 0.5, 0.7, 0.5, 0, 1.15, 0));
    else g = grp(part('cyl', lk[0], 0.9 * s, 1.1 * s, 0.9 * s, 0, 0.65 * s, 0), part('sph', sub === 'troll' || sub === 'trollshaman' ? 0x6a9a7a : sub === 'ogre' ? 0x8a9a5a : 0xc8a888, 0.6 * s, 0.6 * s, 0.6 * s, 0, 1.5 * s, 0), part('box', 0x6a5a4a, 0.15 * s, 1 * s, 0.15 * s, 0.5 * s, 1 * s, 0.3 * s));
    g.userData.h = 2 * s;
  } else if (k === 'stalker') {
    g = grp(part('cone', 0x1a1428, 1.4, 2.4, 1.4, 0, 1.2, 0), part('sph', 0x2a2038, 0.8, 0.8, 0.8, 0, 2.5, 0), part('sph', 0xff2a2a, 0.15, 0.15, 0.15, -0.18, 2.6, 0.35, 0xff0000), part('sph', 0xff2a2a, 0.15, 0.15, 0.15, 0.18, 2.6, 0.35, 0xff0000));
    g.userData.h = 3.2;
  } else if (k === 'b') {
    if (sub === 'treant') g = grp(part('cyl', 0x5a3d22, 1.8, 4.5, 1.8, 0, 2.25, 0), part('ico', 0x3a7a2a, 4.5, 3.5, 4.5, 0, 5.5, 0), part('cyl', 0x5a3d22, 0.5, 3, 0.5, -1.6, 2.8, 0.2), part('cyl', 0x5a3d22, 0.5, 3, 0.5, 1.6, 2.8, 0.2), part('sph', 0xc0ff60, 0.3, 0.3, 0.3, -0.4, 3.6, 0.85, 0x80ff20), part('sph', 0xc0ff60, 0.3, 0.3, 0.3, 0.4, 3.6, 0.85, 0x80ff20));
    else if (sub === 'ogre') g = grp(part('sph', 0x7a8a4a, 3.2, 3, 2.8, 0, 2.2, 0), part('sph', 0x8a9a5a, 1.3, 1.3, 1.3, 0, 4.1, 0.4), part('cyl', 0x5a4030, 0.4, 3.5, 0.4, 1.8, 2.2, 0.6), part('sph', 0x5a4030, 1.2, 1.2, 1.2, 1.8, 3.9, 0.6), part('box', 0x6a3a2a, 3.2, 0.6, 2.8, 0, 1.2, 0));
    else if (sub === 'hydra') { g = grp(part('sph', 0x2a7a7a, 3.6, 2, 3.6, 0, 1, 0)); for (let i = -1; i <= 1; i++) { g.add(part('cyl', 0x3a8a8a, 0.6, 3.5, 0.6, i * 1.1, 2.8, 0.6), part('sph', 0x4a9a8a, 1, 0.8, 1.3, i * 1.1, 4.6, 0.9), part('sph', 0xffe040, 0.15, 0.15, 0.15, i * 1.1 + 0.3, 4.8, 1.5, 0xffc000)); } }
    else if (sub === 'bogwitch') g = grp(part('cone', 0x3a2a4a, 2.4, 3.6, 2.4, 0, 1.8, 0), part('sph', 0x7a9a6a, 1, 1, 1, 0, 3.9, 0), part('cone', 0x1a1a2a, 1.8, 2.2, 1.8, 0, 5.2, 0), part('cyl', 0x4a3a2a, 0.15, 4, 0.15, 1.2, 2, 0.4), part('sph', 0x9a4aff, 0.6, 0.6, 0.6, 1.2, 4.2, 0.4, 0x6a1ad0));
    else if (sub === 'golem') g = grp(part('box', 0x6a6e78, 3.2, 3, 2.4, 0, 3, 0), part('box', 0x7a7e88, 1.6, 1.3, 1.4, 0, 5.1, 0.2), part('box', 0x5a5e68, 1.1, 3, 1.1, -2.2, 2.6, 0), part('box', 0x5a5e68, 1.1, 3, 1.1, 2.2, 2.6, 0), part('box', 0x5a5e68, 1, 1.6, 1, -0.8, 0.8, 0), part('box', 0x5a5e68, 1, 1.6, 1, 0.8, 0.8, 0), part('sph', 0x6affff, 0.5, 0.3, 0.3, 0, 5.2, 0.9, 0x20c0c0));
    else g = grp(part('cyl', 0x1a1a22, 1.6, 2.6, 1.4, 0, 1.9, 0), part('box', 0x2a2a34, 1.2, 1.2, 1.2, 0, 3.8, 0), part('box', 0xff2020, 0.8, 0.12, 0.1, 0, 3.9, 0.62, 0xff0000), part('box', 0x6a0a10, 2.2, 2.2, 0.15, 0, 2.2, -0.75), part('box', 0xb0b0c0, 0.25, 3.6, 0.25, 1.2, 2.6, 0.6), part('cyl', 0x1a1a22, 0.6, 2, 0.6, -0.5, 0.6, 0), part('cyl', 0x1a1a22, 0.6, 2, 0.6, 0.5, 0.6, 0));
    g.scale.setScalar(sub === 'golem' || sub === 'treant' ? 1.1 : 1); g.userData.h = 6.5; g.userData.boss = 1;
  } else if (k === 'e') {
    if (sub === 'chest') g = grp(part('box', 0x8a5a2a, 1.6, 1, 1.1, 0, 0.5, 0), part('box', 0xd0a030, 1.7, 0.2, 1.2, 0, 1, 0, 0x604010));
    else if (sub === 'shrine') g = grp(part('cyl', 0xb0b0b8, 2, 0.5, 2, 0, 0.25, 0), part('box', 0xc8c8d0, 0.6, 3, 0.6, 0, 1.8, 0), part('oct', 0x7af0ff, 0.8, 1, 0.8, 0, 3.8, 0, 0x30a0c0));
    else if (sub === 'merchant') g = grp(part('box', 0x8a6a3a, 2.4, 1, 1.6, 0, 1, 0), part('cyl', 0x3a2a1a, 1, 0.25, 1, 1, 0.5, 0.9), part('cyl', 0x3a2a1a, 1, 0.25, 1, -1, 0.5, 0.9), part('cone4', 0xd0a040, 2.8, 1.4, 2, 0, 2.2, 0), part('sph', 0xe0c0a0, 0.5, 0.5, 0.5, 1.6, 1.3, 0));
    else g = grp(part('sph', 0x3a6a2a, 2, 1.2, 2, 0, 0.5, 0), part('sph', 0x2a5a1a, 1.4, 1, 1.4, 1, 0.5, 0.6));
    g.userData.h = 2.5;
  } else if (v === 'wall') {
    g = grp(part('box', 0x8a8478, 9, 3.6, 1.6, 0, 1.8, 0)); for (let i = -4; i <= 4; i += 2) g.add(part('box', 0x7a746a, 1, 0.8, 1.7, i, 4, 0));
    g.userData.h = 4.5; g.userData.static = 1;
  } else if (v === 'turret') {
    g = grp(part('cyl', 0x8a8478, 2, 4.5, 2, 0, 2.25, 0), part('cyl', 0x6a645a, 2.6, 0.6, 2.6, 0, 4.7, 0), part('cone', 0x2a4a8a, 2.6, 1.6, 2.6, 0, 5.8, 0), part('oct', 0x6ab0ff, 0.6, 0.9, 0.6, 0, 7.2, 0, 0x1a4a9a));
    g.userData.spin = g.children[3]; g.userData.h = 7.5; g.userData.static = 1;
  } else if (v === 'ward') {
    g = grp(part('box', 0x6a4a2a, 0.3, 6, 0.3, -0.8, 3, -0.8), part('box', 0x6a4a2a, 0.3, 6, 0.3, 0.8, 3, 0.8), part('box', 0x6a4a2a, 0.3, 6, 0.3, -0.8, 3, 0.8), part('box', 0x6a4a2a, 0.3, 6, 0.3, 0.8, 3, -0.8), part('box', 0x8a6a3a, 2.4, 0.3, 2.4, 0, 6, 0), part('cone4', 0x5a3a2a, 2.8, 1.4, 2.8, 0, 7.6, 0), part('sph', 0x9fe0ff, 0.5, 0.5, 0.5, 0, 6.6, 0, 0x4aa0ff));
    g.children[5].rotation.y = Math.PI / 4; g.userData.h = 8; g.userData.static = 1;
  } else if (v === 'healpack') {
    g = grp(part('cyl', 0x9a9aa0, 1.6, 0.4, 1.6, 0, 0.2, 0), part('oct', 0x6aff8a, 0.8, 1.3, 0.8, 0, 1.5, 0, 0x2ac04a));
    g.userData.spin = g.children[1]; g.userData.h = 2.4; g.userData.static = 1; g.userData.heal = g.children[1];
  } else if (v === 'merc') {
    g = grp(part('cyl', 0x4a5a6a, 1, 1.5, 1, 0, 1.1, 0), part('sph', 0x8a9aaa, 0.65, 0.7, 0.65, 0, 2.2, 0), part('box', 0x3a7ae0, 1.1, 0.3, 1.1, 0, 1.75, 0), part('box', 0xc0c0c8, 0.15, 1.6, 0.15, 0.7, 1.4, 0.4), part('cyl', 0x6a5a3a, 0.9, 0.15, 0.9, -0.7, 1.2, 0.1));
    g.children[4].rotation.z = Math.PI / 2; g.userData.h = 2.8;
  } else if (k === 'loot') {
    if (sub === 'card') g = grp(part('box', 0xffd84a, 0.9, 0.06, 1.3, 0, 0.6, 0, 0xa07a10), new THREE.Mesh(geo.cyl, new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.35, depthWrite: false })));
    else { const col = new THREE.Color(DW.RARITY[+sub].col).getHex(); g = grp(part('sph', 0x8a6a3a, 0.7, 0.6, 0.7, 0, 0.35, 0), new THREE.Mesh(geo.cyl, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: +sub >= 3 ? 0.45 : 0.25, depthWrite: false }))); }
    const beam = g.children[1]; beam.scale.set(0.35, +sub >= 3 || sub === 'card' ? 9 : 4, 0.35); beam.position.y = beam.scale.y / 2; g.userData.static = 1; g.userData.h = 1; g.userData.loot = 1; g.userData.spin = g.children[0];
  } else g = grp(part('sph', 0xff00ff, 1, 1, 1, 0, 1, 0));
  // under-ring for night fury / team
  const nf = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.85, depthWrite: false })); nf.rotation.x = -Math.PI / 2; nf.position.y = 0.07; nf.visible = false; g.add(nf); g.userData.nf = nf;
  const stun = part('torus', 0xffe040, 0.8, 0.8, 0.8, 0, (g.userData.h || 2) + 0.4, 0, 0xc0a000); stun.rotation.x = Math.PI / 2; stun.visible = false; g.add(stun); g.userData.stun = stun;
  return g;
}
function clearWorld() {
  for (const [, m] of G.meshes) scene.remove(m); G.meshes.clear();
  for (const [, m] of G.projMeshes) scene.remove(m); G.projMeshes.clear();
  for (const f of G.fxList) scene.remove(f.obj); G.fxList = [];
}
// ---- effects ----
function spawnFx(f) {
  if (f[0] === 'n') { G.nums.push({ x: f[1], z: f[2], v: f[3], c: f[4], t: performance.now(), ox: (Math.random() - 0.5) * 20 }); if (G.nums.length > 90) G.nums.shift(); return; }
  const [, type, x, z, r, col] = f; let obj, dur = 0.6, upd;
  const c = new THREE.Color(col);
  if (type === 'burst' || type === 'ring' || type === 'lvl') {
    obj = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide })); obj.rotation.x = -Math.PI / 2; obj.position.set(x, type === 'lvl' ? 0.3 : 0.15, z);
    dur = type === 'lvl' ? 1.2 : 0.5;
    upd = p => { obj.scale.setScalar(r * (type === 'burst' ? 0.3 + p * 0.8 : 0.6 + p * 0.5)); obj.material.opacity = 1 - p; if (type === 'lvl') obj.position.y = 0.3 + p * 3; };
  } else if (type === 'pillar' || type === 'blink') {
    obj = new THREE.Mesh(geo.cyl, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, depthWrite: false })); obj.position.set(x, 3, z); dur = type === 'blink' ? 0.35 : 0.7;
    upd = p => { obj.scale.set(r * (1 - p * 0.5), type === 'blink' ? 4 : 8, r * (1 - p * 0.5)); obj.material.opacity = 0.7 * (1 - p); };
  } else if (type === 'meteor') {
    obj = new THREE.Mesh(geo.sph, new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false })); dur = 0.45;
    upd = p => { if (p < 0.5) { obj.position.set(x - 6 * (1 - p * 2), 14 * (1 - p * 2), z - 4 * (1 - p * 2)); obj.scale.setScalar(1.6); } else { obj.position.set(x, 0.5, z); obj.scale.setScalar(r * 2 * (p - 0.3)); obj.material.opacity = 1 - (p - 0.5) * 2; } };
  } else return;
  scene.add(obj); G.fxList.push({ obj, t0: performance.now(), dur, upd }); upd(0);
}

// ============================ INPUT ============================
const pointers = new Map(); let drag = null, pinch = null, lastTap = 0;
function screenToWorld(sx, sy) {
  const ndc = new THREE.Vector2(sx / window.innerWidth * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera); const p = new THREE.Vector3(); return raycaster.ray.intersectPlane(groundPlane, p) ? p : null;
}
function worldToScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, v.z]; }
function pickUnit(sx, sy, hostileOnly) {
  if (!G.cur) return null; let best = null, bd = 34 * 34;
  for (const e of G.cur.e) {
    const team = e[2], v = e[1]; if (e[8] & 8) continue; if (hostileOnly && team === 0) continue;
    const m = G.meshes.get(e[0]); if (!m) continue; const h = (m.userData.h || 2) * 0.5;
    const s = worldToScreen(m.position.x, h, m.position.z); const big = m.userData.boss || v === 'tower' || v === 'core' || v === 'town' ? 2.5 : 1;
    const dd = ((s[0] - sx) ** 2 + (s[1] - sy) ** 2) / big; if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}
function onTap(sx, sy) {
  const w = screenToWorld(sx, sy); if (!w || !G.me) return;
  if (G.aim >= 0) { const u = pickUnit(sx, sy, true); castAt(G.aim, w.x, w.z, u ? u[0] : undefined); setAim(-1); return; }
  const u = pickUnit(sx, sy, true);
  if (u) { send({ c: 'attack', id: u[0] }); flashMarker(u[3], u[4], 0xff5a4a); }
  else { send({ c: 'move', x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10 }); flashMarker(w.x, w.z, 0x7aff7a); }
}
function flashMarker(x, z, col) { moveMarker.position.x = x; moveMarker.position.z = z; moveMarker.material.color.setHex(col); moveMarker.userData.t = performance.now(); }
function castAt(k, x, z, id) { send({ c: 'cast', k, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, id }); }
function setAim(k) {
  G.aim = k; document.querySelectorAll('.ab').forEach((b, i) => b.classList.toggle('aiming', i === k));
  $('aimHint').classList.toggle('hidden', k < 0);
  if (k >= 0) { const ab = DW.HEROES[G.me.hid].ab[k]; $('aimHint').textContent = (ab.t === 'unit' ? 'Tap an enemy' : 'Tap a location') + ' to cast ' + ab.n + ' · tap the button again to cancel'; }
}
function pressAbility(k, quick) {
  if (!G.me || G.me.dead) return; const H = DW.HEROES[G.me.hid], ab = H.ab[k];
  if (!G.me.rk[k]) return toast('Learn ' + ab.n + ' first (tap +)', 'warn');
  if (G.me.cd[k] > 0) return toast(ab.n + ' is on cooldown', 'warn');
  if (ab.t === 'self') { castAt(k, G.me.x, G.me.z); setAim(-1); return; }
  if (quick) { castAt(k, G.mouse.wx, G.mouse.wz, (pickUnit(G.mouse.x, G.mouse.y, true) || [])[0]); return; }
  setAim(G.aim === k ? -1 : k);
}
function bindInput() {
  const cv = renderer.domElement; cv.style.touchAction = 'none';
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: G.zoom }; drag = null; }
    else drag = { x: e.clientX, y: e.clientY, moved: false };
  });
  cv.addEventListener('pointermove', e => {
    G.mouse.x = e.clientX; G.mouse.y = e.clientY; const w = screenToWorld(e.clientX, e.clientY); if (w) { G.mouse.wx = w.x; G.mouse.wz = w.z; }
    const p = pointers.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); G.zoom = Math.max(24, Math.min(80, pinch.z * pinch.d / Math.max(20, d))); return; }
    if (drag && (p.btn === 0 || e.pointerType !== 'mouse')) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 12) drag.moved = true;
      if (drag.moved) { const s = G.zoom / window.innerHeight * 1.5; G.camX -= dx * s; G.camZ -= dy * s * 1.4; G.follow = false; drag.x = e.clientX; drag.y = e.clientY; }
    }
  });
  const up = e => {
    const p = pointers.get(e.pointerId); pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (p && drag && !drag.moved) onTap(e.clientX, e.clientY);
    drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); drag = null; pinch = null; });
  cv.addEventListener('wheel', e => { G.zoom = Math.max(24, Math.min(80, G.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (!G.running || document.activeElement.tagName === 'INPUT') return;
    const k = e.key.toLowerCase(); const ai = 'qwer'.indexOf(k);
    if (ai >= 0 && !e.ctrlKey) { if (e.shiftKey || e.altKey) { send({ c: 'lvl', k: ai }); } else pressAbility(ai, true); }
    else if (k === ' ') { G.follow = true; e.preventDefault(); }
    else if (k === 's') send({ c: 'stop' });
    else if (k === 'b') openShop();
    else if (k === 'f') send({ c: 'potion' });
    else if (k === 't') pressRecall();
    else if (k === 'g') openTowns();
    else if (k === 'tab') { e.preventDefault(); openStats(); }
    else if (k === 'escape') { setAim(-1); closeModal(); }
  });
  // minimap
  const miniPos = e => { const r = mini.getBoundingClientRect(); return [((e.clientX - r.left) / r.width * 2 - 1) * DW.MAP.W, ((e.clientY - r.top) / r.height * 2 - 1) * DW.MAP.H]; };
  mini.addEventListener('pointerdown', e => { e.stopPropagation(); const [x, z] = miniPos(e); if (e.button === 2) { send({ c: 'move', x, z }); return; } G.camX = x; G.camZ = z + 10; G.follow = false; mini.setPointerCapture(e.pointerId); mini.dragging = true; });
  mini.addEventListener('pointermove', e => { if (!mini.dragging) return; const [x, z] = miniPos(e); G.camX = x; G.camZ = z + 10; });
  mini.addEventListener('pointerup', () => mini.dragging = false);
  mini.addEventListener('contextmenu', e => e.preventDefault());
  // HUD buttons
  document.querySelectorAll('.ab').forEach((b, i) => {
    let lp = null;
    b.addEventListener('pointerdown', e => { e.preventDefault(); lp = setTimeout(() => { lp = 'long'; showAbTip(i, b); }, 450); });
    b.addEventListener('pointerup', e => { e.preventDefault(); if (lp === 'long') { lp = null; return; } clearTimeout(lp); lp = null; pressAbility(i, false); });
    b.addEventListener('pointerleave', () => { if (lp && lp !== 'long') clearTimeout(lp); lp = null; });
    b.addEventListener('mouseenter', () => showAbTip(i, b)); b.addEventListener('mouseleave', () => $('abTip').classList.add('hidden'));
  });
  document.querySelectorAll('.lvlup').forEach((b, i) => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); send({ c: 'lvl', k: i }); }));
  $('attrBtn').onclick = () => send({ c: 'lvl', k: 4 });
  $('btnPot').onclick = () => send({ c: 'potion' });
  $('btnRecall').onclick = pressRecall;
  $('btnShop').onclick = openShop; $('btnTowns').onclick = openTowns; $('btnStats').onclick = openStats; $('btnHero').onclick = openHero;
  $('btnCenter').onclick = () => G.follow = true;
  $('btnStop').onclick = () => send({ c: 'stop' });
  $('btnMenu').onclick = () => openModal('<h2>Menu</h2><p class="muted">Controls: tap ground to move · tap enemy to attack · drag to pan · pinch/scroll to zoom · Q W E R abilities (Shift+key to level) · B shop · G towns · T recall · F potion · Space recenter · Tab stats</p><div class="row"><button class="btn" id="mResume">Resume</button><button class="btn danger" id="mQuit">Leave Match</button></div>', () => { $('mResume').onclick = closeModal; $('mQuit').onclick = () => { closeModal(); quitGame(); }; });
  $('modalBg').addEventListener('pointerdown', e => { if (e.target === $('modalBg')) closeModal(); });
}
function showAbTip(i, b) {
  if (!G.me) return; const ab = DW.HEROES[G.me.hid].ab[i]; const r = G.me.rk[i];
  const cd = Array.isArray(ab.cd) ? ab.cd.join('/') : ab.cd, cost = Array.isArray(ab.cost) ? ab.cost.join('/') : ab.cost;
  $('abTip').innerHTML = `<b>${ab.n}</b> <small>Rank ${r}/${ab.ult ? 3 : 5}</small><p>${ab.d}</p><small>Cooldown ${cd}s · Cost ${cost} ${DW.HEROES[G.me.hid].res.type}${ab.range ? ' · Range ' + ab.range : ''}</small>`;
  $('abTip').classList.remove('hidden');
}
function pressRecall() {
  if (!G.cur || !G.me) return;
  if (G.cur.ph === 'night') {
    const owned = G.cur.towns.filter(t => t.team === 0);
    openModal(`<h2>Waygate</h2><p class="muted">Travel instantly (2s channel) to base or any town you hold.</p><div class="list">${['<button class="btn wide" data-d="base">🏰 Main Base</button>', ...owned.map(t => `<button class="btn wide" data-d="${t.tid}">⚑ ${esc(t.n)}</button>`)].join('')}</div>`, () => document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { send({ c: 'way', dest: b.dataset.d }); closeModal(); }));
  } else send({ c: 'recall' });
}
// ============================ MODALS ============================
let modalRefresh = null;
function openModal(html, bind, refresh) { const full = '<button class="x" id="mClose">✕</button>' + html; if (!$('modalBg').classList.contains('hidden') && G.modalHtml === full) return; G.modalHtml = full; const sc = $('modal').scrollTop; $('modal').innerHTML = full; $('modal').scrollTop = sc; $('modalBg').classList.remove('hidden'); $('mClose').onclick = closeModal; if (bind) bind(); modalRefresh = refresh || null; }
function closeModal() { $('modalBg').classList.add('hidden'); modalRefresh = null; G.modalHtml = null; G.shopTab = G.shopTab; }
G.shopTab = 'basic';
function openShop() { renderShop(); }
function renderShop() {
  const me = G.me; if (!me) return; const acc = me.shop;
  const atForge = (me.x - DW.MAP.forge.x) ** 2 + (me.z - DW.MAP.forge.z) ** 2 < 49;
  const tabs = [['basic', 'Basic'], ['adv', 'Advanced'], ['secret', 'Secret'], ['merchant', 'Merchant'], ['inv', 'Inventory']];
  if (me.mem) tabs.splice(2, 0, ['vault', '★ Vault']);
  if (atForge) tabs.push(['forge', '⚒ Forge']);
  if ((G.shopTab === 'vault' && !me.mem) || (G.shopTab === 'forge' && !atForge)) G.shopTab = 'basic';
  const near = G.cur.encs.find(e => e.sub === 'merchant' && (e.x - me.x) ** 2 + (e.z - me.z) ** 2 < 49);
  let body = '';
  const itemCard = (key, it, canBuy, extra) => `<div class="item ${it.rar >= 0 ? 'r' + it.rar : ''}"><div><b style="color:${itemCol(it)}">${esc(it.n)}</b><small>${it.rar >= 0 ? DW.RARITY[it.rar].n + ' · ' : ''}${statLine(it.s)}</small></div><button class="btn sm" ${canBuy ? '' : 'disabled'} ${extra}>${it.c}g</button></div>`;
  if (G.shopTab === 'basic' || G.shopTab === 'adv') {
    const tier = G.shopTab === 'basic' ? 1 : 2;
    body = (tier === 1 ? `<div class="item"><div><b>Healing Potion</b><small>Restores 250 HP over 8s · carrying ${me.pots}/5</small></div><button class="btn sm" ${acc.any && me.g >= DW.POTION_COST && me.pots < 5 ? '' : 'disabled'} data-buy="potion">${DW.POTION_COST}g</button></div>` : '') +
      Object.keys(DW.ITEMS).filter(k => DW.ITEMS[k].tier === tier).map(k => itemCard(k, DW.ITEMS[k], acc.normal && me.g >= DW.ITEMS[k].c, `data-buy="${k}"`)).join('');
  } else if (G.shopTab === 'secret') {
    body = (G.cur.so ? (acc.secret ? '' : '<p class="muted">Travel to the Secret Shop behind the Treant\'s grove in the Wildwood to buy these.</p>') : '<p class="warnTxt">Locked — slay the Ancient Treant in the Wildwood lane.</p>') +
      Object.keys(DW.ITEMS).filter(k => DW.ITEMS[k].secret).map(k => itemCard(k, DW.ITEMS[k], acc.secret && me.g >= DW.ITEMS[k].c, `data-buy="${k}"`)).join('');
  } else if (G.shopTab === 'vault') {
    body = '<p class="muted">Members\' Vault — new stock every dawn. Buy at any shop.</p>' + G.cur.vault.map(k => itemCard(k, Object.assign({ rar: -2 }, DW.VAULT[k]), acc.any && me.g >= DW.VAULT[k].c, `data-vault="${k}"`)).join('');
  } else if (G.shopTab === 'forge') {
    G.forgeSel = (G.forgeSel || []).filter(i => me.it[i]);
    body = '<p class="muted">The ancient forge hungers. Offer three items of the same rarity…</p>' + me.it.map((it, i) => it ? `<div class="item ${it.rar >= 0 ? 'r' + it.rar : ''} ${G.forgeSel.includes(i) ? 'picked' : ''}" data-fsel="${i}"><div><b style="color:${itemCol(it)}">${esc(it.n)}</b><small>${it.rar >= 0 ? DW.RARITY[it.rar].n : 'Shop item — cannot be forged'}</small></div><span>${G.forgeSel.includes(i) ? '✔' : ''}</span></div>` : '').join('') + `<button class="btn wide" id="doForge" ${G.forgeSel.length === 3 ? '' : 'disabled'}>Forge (${G.forgeSel.length}/3)</button>`;
  } else if (G.shopTab === 'merchant') {
    body = near ? near.stock.map((it, i) => it ? itemCard('', Object.assign({}, it, { c: Math.round(it.c * 1.5) }), me.g >= Math.round(it.c * 1.5), `data-loot="${i}"`) : '<div class="item muted">Sold</div>').join('') : '<p class="muted">Wandering merchants appear in the jungle at dawn. Stand next to one to trade.</p>';
  } else {
    body = (me.mem ? '<p class="gold">★ Member Card holder</p>' : '') + me.it.map((it, i) => it ? `<div class="item ${it.rar >= 0 ? 'r' + it.rar : ''}"><div><b style="color:${itemCol(it)}">${esc(it.n)}</b><small>${it.rar >= 0 ? DW.RARITY[it.rar].n + ' · ' : ''}${statLine(it.s)}</small>${it.lore ? `<small class="lore">${esc(it.lore)}</small>` : ''}</div><button class="btn sm ghost" data-sell="${i}">${acc.any ? 'Sell' : 'Salvage'} ${Math.round(it.c * (acc.any ? 0.5 : 0.25))}g</button></div>` : '<div class="item muted">Empty slot</div>').join('');
  }
  const status = acc.secret ? '🟣 At the Secret Shop' : acc.any ? '🟢 Shop open' : G.cur.ph === 'night' ? '🔴 No shop here — go to base or a town you hold' : '🔴 Shop closed — base anytime, held towns at night';
  openModal(`<h2>Shop <span class="gold">◉ ${me.g}</span></h2><div class="status">${status}</div><div class="tabs">${tabs.map(t => `<button class="tab ${G.shopTab === t[0] ? 'on' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div><div class="list">${body}</div>`, () => {
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { G.shopTab = b.dataset.tab; renderShop(); });
    document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => send({ c: 'buy', item: b.dataset.buy }));
    document.querySelectorAll('[data-loot]').forEach(b => b.onclick = () => send({ c: 'buy', loot: +b.dataset.loot }));
    document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => send({ c: 'sell', slot: +b.dataset.sell }));
    document.querySelectorAll('[data-vault]').forEach(b => b.onclick = () => send({ c: 'buy', vault: b.dataset.vault }));
    document.querySelectorAll('[data-fsel]').forEach(b => b.onclick = () => { const i = +b.dataset.fsel; G.forgeSel = G.forgeSel.includes(i) ? G.forgeSel.filter(x => x !== i) : G.forgeSel.concat(i).slice(-3); renderShop(); });
    if ($('doForge')) $('doForge').onclick = () => { send({ c: 'forge', slots: G.forgeSel }); G.forgeSel = []; };
  }, G.shopTab === 'forge' ? null : renderShop);
}
G.wcTab = 'towns';
function openTowns() { renderTowns(); }
function renderTowns() {
  if (!G.cur || !G.me) return; const s = G.cur;
  let drain = 0; s.towns.forEach(t => { if (t.team === 0) drain += t.inv * DW.TIER_DRAIN; });
  const upk = s.towns.filter(t => t.team === 0).reduce((a, t) => a + t.up, 0);
  const rows = ['L', 'M', 'R'].map(ln => `<div class="laneHdr">${DW.LANE_INFO[ln].name}<small>${DW.LANE_INFO[ln].desc}</small></div>` + s.towns.filter(t => DW.MAP.towns.find(m => m.id === t.tid).lane === ln).map(t => {
    const B = DW.TOWN_BUFFS[t.tid], held = t.team === 0;
    const pips = [1, 2, 3].map(i => `<span class="pip ${t.inv >= i ? 'on' : ''}"></span>`).join('');
    const state = held ? `<span class="ok">Held</span>` : t.guards ? `<span class="muted">Guarded (${t.guards})</span>` : t.cap > 0 ? `<span class="gold">Capturing ${Math.round(t.cap / 4 * 100)}%</span>` : `<span class="muted">Unclaimed</span>`;
    const cur = t.inv ? statLine(B.s[t.inv - 1]) : 'No buff';
    const next = t.inv < 3 ? 'Next: ' + statLine(B.s[t.inv]) + ' for ' + ((t.inv + 1) * DW.TIER_DRAIN).toFixed(1) + 'g/s' : 'Max tier';
    return `<div class="town ${held ? 'held' : ''}"><div class="tTop"><b>⚑ ${esc(t.n)}</b>${state}</div>
      <div class="tMid"><span>${B.n} · ${B.d}</span>${pips}</div>
      <div class="tBot"><small>${held ? cur + ' · ' + (t.inv * DW.TIER_DRAIN).toFixed(1) + 'g/s each' : 'Capture it to fund buffs'}<br>${held ? next : ''}${t.mine ? '<br>⛏ Gold mine: +3g/s each by day' : ''}<br>Nightly upkeep ${t.up}g (split)</small>
      ${held ? `<span class="tierBtns"><button class="btn sm ghost" data-t="${t.tid}" data-d="-1" ${t.inv ? '' : 'disabled'}>−</button><button class="btn sm" data-t="${t.tid}" data-d="1" ${t.inv < 3 ? '' : 'disabled'}>+</button></span>` : ''}</div></div>`;
  }).join('')).join('');
  if (G.wcTab === 'base') return renderBase();
  openModal(`<h2>War Council <span class="gold">◉ ${G.me.g}</span></h2>${wcTabs()}<div class="status">Town funding drains <b class="gold">${drain.toFixed(1)}g/s</b> from each hero · nightly upkeep <b class="gold">${upk}g</b> (split) · ${s.ph === 'day' ? 'Night in ' + fmtT(DW.DAY - s.t % DW.CYC) : 'Dawn in ' + fmtT(DW.CYC - s.t % DW.CYC)}</div><div class="list">${rows}</div>`, () => {
    document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => send({ c: 'tier', tid: b.dataset.t, d: +b.dataset.d }));
    bindWcTabs();
  }, renderTowns);
}
function wcTabs() { return `<div class="tabs"><button class="tab ${G.wcTab === 'towns' ? 'on' : ''}" data-wc="towns">⚑ Towns</button><button class="tab ${G.wcTab === 'base' ? 'on' : ''}" data-wc="base">🏰 Base & Rails</button></div>`; }
function bindWcTabs() { document.querySelectorAll('[data-wc]').forEach(b => b.onclick = () => { G.wcTab = b.dataset.wc; renderTowns(); }); }
function renderBase() {
  const s = G.cur, me = G.me, U = DW.BASE_UPG, up = s.upg || {};
  const atBase = (me.x - DW.MAP.fountain.x) ** 2 + (me.z - DW.MAP.fountain.z) ** 2 < 18 * 18;
  const upCard = k => { const u = U[k], lv = up[k] || 0, max = u.c.length, cost = u.c[lv];
    return `<div class="town ${lv ? 'held' : ''}"><div class="tTop"><b>${u.n}</b><span>${max > 1 ? [...Array(max)].map((_, i) => `<span class="pip ${lv > i ? 'on' : ''}"></span>`).join('') : lv ? '<span class="ok">Built</span>' : ''}</span></div><div class="tBot"><small>${u.d}</small>${lv < max ? `<button class="btn sm" data-upg="${k}" ${me.g >= cost ? '' : 'disabled'}>${cost}g</button>` : ''}</div></div>`; };
  const rails = ['L', 'M', 'R'].map((ln, li) => {
    const k = 'rail' + ln, lv = up[k] || 0, st = s.rails[li], cost = U[k].c[lv];
    const here = st.findIndex((x, i) => i <= lv && x[3] && (me.x - x[1]) ** 2 + (me.z - x[2]) ** 2 < x[4] * x[4]);
    const line = st.map((x, i) => `<span class="station ${i <= lv ? 'built' : ''} ${x[3] ? 'ok' : ''}">${i ? '━ ' : ''}${esc(x[0])}</span>`).join(' ');
    const rides = here >= 0 ? st.map((x, i) => i !== here && i <= lv && x[3] ? `<button class="btn sm" data-ride="${ln}" data-to="${i}">Ride → ${esc(x[0])}</button>` : '').join('') : '';
    const nextOk = lv < 3 && st[lv + 1][3];
    return `<div class="town ${lv ? 'held' : ''}"><div class="tTop"><b>🚂 ${U[k].n}</b><span class="muted">${lv}/3 segments</span></div><div class="railLine">${line}</div>
      <div class="tBot"><small>${lv < 3 ? (nextOk ? 'Next segment to ' + esc(st[lv + 1][0]) : 'Next segment needs ' + esc(st[lv + 1][0]) + (lv + 1 === 3 ? ' (slay the Warden)' : ' held')) : 'Line complete'}</small>${lv < 3 ? `<button class="btn sm" data-upg="${k}" ${nextOk && me.g >= cost ? '' : 'disabled'}>${cost}g</button>` : ''}</div>${rides ? `<div class="rideRow">${rides}</div>` : ''}</div>`;
  }).join('');
  const myMercs = s.e.filter(e => e[1] === 'merc').length;
  openModal(`<h2>War Council <span class="gold">◉ ${me.g}</span></h2>${wcTabs()}
    <div class="status">${s.ph === 'night' && s.h.some(h => h.lvl >= 5) ? '⚠ Jungle warbands may strike the base at night.' : 'Once a hero reaches level 5, jungle warbands may raid the base at night.'}</div>
    <div class="laneHdr">Rails</div><div class="list">${rails}</div>
    <div class="laneHdr">Jungle</div><div class="list">${['sight', 'heal', 'merc'].map(upCard).join('')}
    ${up.merc ? `<div class="town"><div class="tBot"><small>Hire a mercenary (follows you, jungle only). ${atBase ? '' : 'Must be at base.'}</small><button class="btn sm" id="hireMerc" ${atBase && me.g >= DW.MERC_COST ? '' : 'disabled'}>Hire ${DW.MERC_COST}g</button></div></div>` : ''}</div>
    <div class="laneHdr">Base</div><div class="list">${['walls', 'drums', 'treasury'].map(upCard).join('')}</div>`, () => {
    document.querySelectorAll('[data-upg]').forEach(b => b.onclick = () => send({ c: 'upg', k: b.dataset.upg }));
    document.querySelectorAll('[data-ride]').forEach(b => b.onclick = () => { send({ c: 'rail', lane: b.dataset.ride, to: +b.dataset.to }); closeModal(); });
    if ($('hireMerc')) $('hireMerc').onclick = () => send({ c: 'merc' });
    bindWcTabs();
  }, renderTowns);
}
function openHero() {
  if (!G.me) return; const me = G.me, H = DW.HEROES[me.hid], sv = me.sv || {};
  const rows = [['HP', `${me.hp} / ${me.mhp}`], [H.res.type, `${me.res} / ${me.mres}`], ['Attack Damage', Math.round(sv.ad)], ['Ability Power', Math.round(sv.ap)], ['Movespeed', Math.round(sv.ms)], ['Attack Speed', (sv.as || 0).toFixed(2) + '/s'], ['Lifesteal', Math.round(sv.ls * 100) + '%'], ['Spell Vamp', Math.round(sv.sv * 100) + '%'], ['Crit Chance', Math.round(sv.crit * 100) + '%'], ['Armor', Math.round(sv.armor)], ['Magic Resist', Math.round(sv.mr)], ['Bonus Attribute Points', me.attr]];
  openModal(`<h2 style="color:${H.col}">${H.name} <small>Level ${me.lvl}</small></h2><div class="statGrid">${rows.map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('')}</div>${me.bf.length ? '<p class="muted">Active: ' + me.bf.map(b => b[0] + ' ' + b[1] + 's').join(', ') + '</p>' : ''}<div class="abList">${H.ab.map((a, i) => `<div class="abInfo"><b>${'QWER'[i]} · ${a.n}</b> <small>Rank ${me.rk[i]}</small><p>${a.d}</p></div>`).join('')}</div>`, null, openHero);
}
const STAT_ROWS = [['Level', s => s._lvl], ['Damage Dealt', s => s.dealt], ['· Physical', s => s.phys], ['· Magic', s => s.magic], ['· To Minions', s => s.toMinions], ['· To Jungle/Creeps', s => s.toCreeps], ['· To Bosses', s => s.toBosses], ['· To Structures', s => s.toStruct], ['Biggest Hit', s => s.maxHit], ['Critical Hits', s => s.crits], ['Damage Taken', s => s.taken, 1], ['Damage Mitigated', s => s.mitigated], ['Healing Done', s => s.healing], ['· Self Healing', s => s.selfHeal], ['CC Applied (s)', s => s.ccTime], ['Minions Killed', s => s.minionKills], ['Creeps Killed', s => s.creepKills], ['Bosses Slain', s => s.bossKills], ['Structures Razed', s => s.structKills], ['Deaths', s => s.deaths, 1], ['Gold Earned', s => s.goldEarned], ['Gold Spent', s => s.goldSpent], ['Upkeep & Funding Paid', s => s.upkeep], ['Towns Captured', s => s.towns], ['Abilities Cast', s => s.casts], ['Items Looted', s => s.looted], ['XP Earned', s => s.xp]];
function statsTable(snap) {
  const cols = snap.h.map(h => Object.assign({ _lvl: h.lvl, _n: h.n, _hid: h.hid }, G.stats[h.pid] || h.st || {}));
  return `<div class="tblWrap"><table class="stats"><thead><tr><th></th>${cols.map(c => `<th style="color:${DW.HEROES[c._hid].col}">${esc(c._n)}<small>${DW.HEROES[c._hid].name}</small></th>`).join('')}</tr></thead><tbody>${STAT_ROWS.map(([label, f, low]) => {
    const vals = cols.map(c => +f(c) || 0); const best = cols.length > 1 ? (low ? Math.min(...vals) : Math.max(...vals)) : null;
    return `<tr><td>${label}</td>${vals.map(v => `<td class="${best !== null && v === best && v > 0 ? 'best' : ''}">${fmtN(v)}</td>`).join('')}</tr>`;
  }).join('')}</tbody></table></div>`;
}
function openStats() { if (!G.cur) return; openModal('<h2>Battle Report</h2><p class="muted">Updates every few seconds.</p>' + statsTable(G.cur), null, openStats); }
function showEnd(s) {
  clearSession(); $('netOv').classList.add('hidden');
  closeModal(); show('end'); G.running = false; clearInterval(G.simTimer);
  $('endTitle').textContent = s.over.win ? 'Victory' : 'Defeat'; $('endTitle').className = s.over.win ? 'win' : 'lose';
  $('endSub').textContent = (s.over.win ? 'The enemy Core lies shattered.' : 'Our Core has fallen.') + ' Match time ' + fmtT(s.over.t) + ' · Day ' + s.cy;
  $('endStats').innerHTML = statsTable(s);
  $('btnEndMenu').onclick = () => { if (L.mode !== 'solo') leaveLobby(); else show('menu'); renderRejoin(); };
}

// ============================ FRAME ============================
let lastFrame = performance.now(), townPromptShown = false;
function dayFactor(t) { const pt = t % DW.CYC; if (t < 8) return 1; if (pt < 8) return pt / 8; if (pt < DW.DAY - 10) return 1; if (pt < DW.DAY) return 1 - (pt - (DW.DAY - 10)) / 10; return 0; }
const cDaySky = new THREE.Color(0x9cc7e8), cNightSky = new THREE.Color(0x0c1430), cDusk = new THREE.Color(0xd08a6a), tmpC = new THREE.Color();
function netWatchdog(now) {
  if (!G.running || G.mode !== 'client' || !G.cur) return;
  if (now - G.lastNet > 4000) {
    $('netOv').classList.remove('hidden'); $('netTxt').textContent = 'Connection lost — reconnecting…';
    if (!G.reconnecting || now - G.reconnectT > 6000) { G.reconnecting = true; G.reconnectT = now; try { openRoomChannel(); } catch (e) { } }
  }
}
function frame(now) {
  requestAnimationFrame(frame); netWatchdog(now);
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if (!G.running || !G.cur) { if (renderer && G.running) renderer.render(scene, camera); return; }
  const s = G.cur, a = Math.min(1.2, (now - G.recvT) / G.interval);
  // lighting
  const df = dayFactor(s.t + a * 0.1);
  tmpC.copy(cNightSky).lerp(cDaySky, df); if (df > 0 && df < 1) tmpC.lerp(cDusk, 0.35 * Math.sin(df * Math.PI));
  scene.background.copy(tmpC); scene.fog.color.copy(tmpC);
  hemi.intensity = 0.3 + 0.45 * df; hemi.color.setHex(df > 0.5 ? 0xdfefff : 0x8aa0ff); sun.intensity = 0.25 + 0.65 * df; sun.color.setHex(df > 0.3 ? 0xfff0d0 : 0x8aa8ff);
  if (s.ec) { scene.background.lerp(new THREE.Color(0x3a0a14), 0.4); }
  scene.fog.near = G.zoom * 1.2; scene.fog.far = G.zoom * 3.4;
  // entities
  const seen = new Set();
  for (const e of s.e) {
    const id = e[0]; seen.add(id); let m = G.meshes.get(id);
    if (!m || m.userData.v !== e[1]) { if (m) scene.remove(m); m = buildModel(e[1], e[2]); m.userData.v = e[1]; m.position.set(e[3], 0, e[4]); if (e[1] === 'wall') m.rotation.y = -e[7]; scene.add(m); G.meshes.set(id, m); }
    const p = G.prevMap.get(id); const t = Math.min(1, a);
    const x = p ? p[3] + (e[3] - p[3]) * t : e[3], z = p ? p[4] + (e[4] - p[4]) * t : e[4];
    if (Math.abs(x - m.position.x) > 15 || Math.abs(z - m.position.z) > 15) m.position.set(x, 0, z); else { m.position.x += (x - m.position.x) * Math.min(1, dt * 18); m.position.z += (z - m.position.z) * Math.min(1, dt * 18); }
    if (!m.userData.static && e[1] !== 'tower' && e[1] !== 'core') { const ty = Math.PI / 2 - e[7]; let d = ty - m.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.rotation.y += d * Math.min(1, dt * 12); }
    const f = e[8];
    m.position.y = (f & 16) && !m.userData.boss ? Math.abs(Math.sin(now / 90 + id)) * 0.18 : 0;
    if (f & 32) { m.scale.setScalar((m.userData.boss ? 1 : m.userData.hero ? 1.05 : 1) * 1.08); } else if (m.userData.hero) m.scale.setScalar(1.05); else if (!m.userData.boss) m.scale.setScalar(1);
    m.userData.nf.visible = !!(f & 2); if (f & 2) m.userData.nf.scale.setScalar(m.userData.boss ? 3 : 1.2 + 0.1 * Math.sin(now / 150));
    m.userData.stun.visible = !!(f & 1); if (f & 1) m.userData.stun.rotation.z = now / 200;
    if (m.userData.spin) m.userData.spin.rotation.y = now / 1200;
    if (m.userData.heal) m.userData.heal.visible = !(f & 256);
    if (m.userData.flag) m.userData.flag.color.setHex(e[2] === 0 ? 0x3a7ae0 : 0x9a9a9a);
    m.userData.ent = e;
  }
  for (const [id, m] of G.meshes) if (!seen.has(id)) { scene.remove(m); G.meshes.delete(id); }
  // projectiles
  const pseen = new Set();
  for (const p of s.p) {
    pseen.add(p[0]); let m = G.projMeshes.get(p[0]);
    if (!m) { m = new THREE.Mesh(geo.sph, new THREE.MeshBasicMaterial({ color: p[3] })); m.scale.setScalar(p[4] * 2); m.position.set(p[1], 1.5, p[2]); scene.add(m); G.projMeshes.set(p[0], m); }
    const pp = G.prevMap.get('p' + p[0]); const t = Math.min(1, a);
    const x = pp ? pp[1] + (p[1] - pp[1]) * t : p[1], z = pp ? pp[2] + (p[2] - pp[2]) * t : p[2]; m.position.x = x; m.position.z = z;
  }
  for (const [id, m] of G.projMeshes) if (!pseen.has(id)) { scene.remove(m); m.material.dispose(); G.projMeshes.delete(id); }
  // zones
  G.zoneMeshes.forEach((g, i) => {
    const z = s.z[i]; g.visible = !!z; if (!z) return;
    const prog = Math.min(1, z[3] + a * 0.1 / 1);
    g.position.x = z[0]; g.position.z = z[1]; g.children[0].scale.setScalar(z[2]); g.children[1].scale.setScalar(z[2] * (z[4] === 2 ? 1 : Math.max(0.05, prog)));
    const col = z[4] === 1 ? 0xff3a2a : z[4] === 2 ? 0xffe27a : 0xffa040; g.children[0].material.color.setHex(col); g.children[1].material.color.setHex(col);
  });
  // fx
  G.fxList = G.fxList.filter(f => { const p = (now - f.t0) / 1000 / f.dur; if (p >= 1) { scene.remove(f.obj); f.obj.material.dispose(); return false; } f.upd(p); return true; });
  // my hero / camera
  const myMesh = G.meshes.get(G.myHeroId);
  myRing.visible = !!myMesh; if (myMesh) { myRing.position.x = myMesh.position.x; myRing.position.z = myMesh.position.z; }
  if (G.follow && myMesh) { G.camX += (myMesh.position.x - G.camX) * Math.min(1, dt * 6); G.camZ += (myMesh.position.z - G.camZ) * Math.min(1, dt * 6); }
  else if (G.follow && G.me && G.me.dead) { /* stay */ }
  G.camX = Math.max(-DW.MAP.W, Math.min(DW.MAP.W, G.camX)); G.camZ = Math.max(-DW.MAP.H, Math.min(DW.MAP.H, G.camZ));
  camera.position.set(G.camX, G.zoom * 0.95, G.camZ + G.zoom * 0.62); camera.lookAt(G.camX, 0, G.camZ - 2);
  // aim ring
  if (G.aim >= 0 && G.me && myMesh) {
    const ab = DW.HEROES[G.me.hid].ab[G.aim]; rangeRing.visible = !!ab.range; if (ab.range) { rangeRing.scale.setScalar(Math.min(ab.range, 40)); rangeRing.position.x = myMesh.position.x; rangeRing.position.z = myMesh.position.z; }
    aimMarker.visible = ab.t === 'point'; if (aimMarker.visible) { aimMarker.scale.setScalar(2.5); aimMarker.position.x = G.mouse.wx; aimMarker.position.z = G.mouse.wz; }
  } else { rangeRing.visible = false; aimMarker.visible = false; }
  const mt = (now - (moveMarker.userData.t || 0)) / 500; moveMarker.material.opacity = mt < 1 ? 1 - mt : 0; moveMarker.scale.setScalar(1.2 - Math.min(1, mt) * 0.6);
  if (G.forgeEmber) G.forgeEmber.scale.setScalar(0.6 + 0.12 * Math.sin(now / 180));
  if (G.secretGem) G.secretGem.visible = s.so, G.secretGem.rotation.y = now / 600;
  renderer.render(scene, camera);
  drawOverlay(now); drawMinimap(); updateHUD(now);
}
function drawOverlay(now) {
  const W = window.innerWidth, H = window.innerHeight; octx.clearRect(0, 0, W, H);
  const s = G.cur;
  for (const [id, m] of G.meshes) {
    const e = m.userData.ent; if (!e || e[1].startsWith('e_') || e[1].startsWith('loot') || e[1] === 'ward' || e[1] === 'healpack') continue;
    if (e[1] === 'town') {
      const tw = s.towns.find(t => t.id === id); if (!tw) continue; const p = worldToScreen(m.position.x, 8.5, m.position.z); if (p[2] > 1 || p[0] < -60 || p[0] > W + 60 || p[1] < -30 || p[1] > H + 30) continue;
      octx.font = '600 12px Cinzel, serif'; octx.textAlign = 'center'; octx.fillStyle = tw.team === 0 ? '#9fd0ff' : '#e8d8a8'; octx.strokeStyle = '#000a'; octx.lineWidth = 3;
      const lbl = tw.n + (tw.inv ? ' ' + '★'.repeat(tw.inv) : ''); octx.strokeText(lbl, p[0], p[1]); octx.fillText(lbl, p[0], p[1]);
      if (tw.team === 0) bar(p[0], p[1] + 6, 70, 6, e[5] / e[6], '#4a9aff');
      else if (tw.cap > 0) bar(p[0], p[1] + 6, 70, 6, tw.cap / 4, '#ffd36b');
      continue;
    }
    const hgt = (m.userData.h || 2) * (m.scale.x || 1) + 0.6; const p = worldToScreen(m.position.x, hgt, m.position.z);
    if (p[2] > 1 || p[0] < -50 || p[0] > W + 50 || p[1] < -20 || p[1] > H + 20) continue;
    const team = e[2], hpP = e[5] / e[6]; const isHero = e[1].startsWith('h_'), boss = m.userData.boss, struct = e[1] === 'tower' || e[1] === 'core' || e[1] === 'wall' || e[1] === 'turret';
    if (!isHero && !boss && !struct && hpP >= 0.999 && team !== 1) continue;
    const w = isHero ? 56 : boss ? 90 : struct ? 76 : e[1].startsWith('c_') ? 32 : 24, hh = isHero || boss || struct ? 6 : 4;
    const col = id === G.myHeroId ? '#5aff5a' : team === 0 ? '#3ad06a' : team === 1 ? '#ff4a4a' : '#e8c040';
    bar(p[0], p[1], w, hh, hpP, col, (e[8] & 4) ? '#c0c0ff' : null);
    if (isHero || boss) {
      const hs = isHero ? s.h.find(h => h.id === id) : null; const label = isHero ? (hs ? hs.n + ' · ' + hs.lvl : '') : MAPBOSS[e[1]] || '';
      octx.font = '600 11px Inter, sans-serif'; octx.textAlign = 'center'; octx.strokeStyle = '#000c'; octx.lineWidth = 3; octx.fillStyle = boss ? ((e[8] & 128) ? '#ff6a4a' : '#ffd36b') : '#fff';
      octx.strokeText(label, p[0], p[1] - 5); octx.fillText(label, p[0], p[1] - 5);
      if (isHero && hs) { const H2 = DW.HEROES[hs.hid]; octx.fillStyle = '#123'; octx.fillRect(p[0] - w / 2, p[1] + hh + 1, w, 3); octx.fillStyle = H2.res.type === 'Rage' ? '#e04040' : H2.res.type === 'Energy' ? '#e8d040' : H2.res.type === 'Resolve' ? '#e8a040' : '#4a8aff'; octx.fillRect(p[0] - w / 2, p[1] + hh + 1, w * hs.res / Math.max(1, hs.mres), 3); }
    }
  }
  // damage numbers
  const NC = ['#ffffff', '#c58aff', '#ff5a5a', '#6aff8a', '#ffb02a', '#ffd700'];
  G.nums = G.nums.filter(n => {
    const age = (now - n.t) / 1000; if (age > 1) return false;
    const p = worldToScreen(n.x, 3, n.z); if (p[2] > 1) return true;
    const big = n.c === 4; octx.globalAlpha = 1 - age * age; octx.font = (big ? '800 18px' : '700 13px') + ' Inter, sans-serif'; octx.textAlign = 'center';
    const txt = (n.c === 3 ? '+' : n.c === 5 ? '+' : '') + n.v + (n.c === 5 ? 'g' : big ? '!' : '');
    octx.strokeStyle = '#000'; octx.lineWidth = 3; octx.strokeText(txt, p[0] + n.ox * age, p[1] - age * 40); octx.fillStyle = NC[n.c] || '#fff'; octx.fillText(txt, p[0] + n.ox * age, p[1] - age * 40);
    octx.globalAlpha = 1; return true;
  });
}
const MAPBOSS = {}; DW.MAP.bosses.forEach(b => MAPBOSS['b_' + b.id] = b.name + (b.warden ? ' (Warden)' : ''));
function bar(x, y, w, h, p, col, border) {
  octx.fillStyle = '#000b'; octx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  octx.fillStyle = col; octx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, p)), h);
  if (w > 40) { octx.fillStyle = '#0006'; const step = w > 70 ? w / 10 : w / 5; for (let i = step; i < w * p; i += step) octx.fillRect(x - w / 2 + i, y, 1, h); }
  if (border) { octx.strokeStyle = border; octx.lineWidth = 1; octx.strokeRect(x - w / 2 - 1, y - 1, w + 2, h + 2); }
}
function buildMinimapBg() {
  miniBg = document.createElement('canvas'); miniBg.width = 150; miniBg.height = 170; const c = miniBg.getContext('2d');
  c.fillStyle = '#1e3a1e'; c.fillRect(0, 0, 150, 170);
  const mx = x => (x / DW.MAP.W + 1) / 2 * 150, mz = z => (z / DW.MAP.H + 1) / 2 * 170;
  c.strokeStyle = '#8a6a3a'; c.lineWidth = 5; c.lineCap = 'round';
  for (const k in DW.LANES) { c.beginPath(); DW.LANES[k].forEach((p, i) => i ? c.lineTo(mx(p[0]), mz(p[1])) : c.moveTo(mx(p[0]), mz(p[1]))); c.stroke(); }
  c.fillStyle = '#2a4a8a'; c.beginPath(); c.arc(mx(0), mz(112), 12, 0, 7); c.fill(); c.fillStyle = '#7a1a2a'; c.beginPath(); c.arc(mx(0), mz(-112), 12, 0, 7); c.fill();
  c.fillStyle = '#6a2a9a'; c.fillRect(mx(DW.MAP.secretShop.x) - 3, mz(DW.MAP.secretShop.z) - 3, 6, 6);
  G.mx = mx; G.mz = mz;
}
function drawMinimap() {
  const c = mctx, s = G.cur; c.drawImage(miniBg, 0, 0); const mx = G.mx, mz = G.mz;
  if (s.ph === 'night') { c.fillStyle = '#0a102a66'; c.fillRect(0, 0, 150, 170); }
  for (const e of s.e) {
    const v = e[1], x = mx(e[3]), z = mz(e[4]);
    if (v === 'town') { const tw = s.towns.find(t => t.id === e[0]); c.fillStyle = tw && tw.team === 0 ? '#5ab0ff' : '#c8b080'; c.fillRect(x - 4, z - 4, 8, 8); c.strokeStyle = '#000'; c.strokeRect(x - 4, z - 4, 8, 8); continue; }
    if (v === 'ward') { c.fillStyle = '#9fe0ff'; c.fillRect(x - 2, z - 2, 4, 4); continue; }
    if (v === 'healpack') { c.fillStyle = e[8] & 256 ? '#2a5a3a' : '#6aff8a'; c.beginPath(); c.arc(x, z, 2.5, 0, 7); c.fill(); continue; }
    if (v === 'wall' || v === 'turret') { c.fillStyle = '#8ab0e0'; c.fillRect(x - 2, z - 2, 4, 4); continue; }
    if (v === 'tower' || v === 'core') { c.fillStyle = e[2] ? '#ff4a5a' : '#4a9aff'; c.fillRect(x - 3, z - 3, 6, 6); continue; }
    if (v.startsWith('b_')) { c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(x, z, 4, 0, 7); c.fill(); continue; }
    if (v.startsWith('e_')) { c.fillStyle = v === 'e_chest' ? '#ffd040' : v === 'e_shrine' ? '#7af0ff' : v === 'e_merchant' ? '#ffa040' : '#3a6a2a'; c.fillRect(x - 2, z - 2, 4, 4); continue; }
    if (v.startsWith('h_')) continue;
    if (v.startsWith('loot')) { const r = v === 'loot_card' ? 5 : +v.slice(5); if (r >= 2) { c.fillStyle = RAR_COL[r]; c.fillRect(x - 1.5, z - 1.5, 3, 3); } continue; }
    c.fillStyle = e[2] === 0 ? '#6ad07a' : e[2] === 1 ? (v === 'stalker' ? '#ff2a8a' : '#ff5a5a') : '#c8a050'; c.fillRect(x - 1, z - 1, 2, 2);
  }
  // fog of war
  if (s.vs) { const fc = G.fogC || (G.fogC = Object.assign(document.createElement('canvas'), { width: 150, height: 170 })), f = fc.getContext('2d');
    f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, 150, 170); f.fillStyle = 'rgba(0,0,0,0.55)'; f.fillRect(0, 0, 150, 170); f.globalCompositeOperation = 'destination-out';
    for (const v of s.vs) { f.beginPath(); f.arc(mx(v[0]), mz(v[1]), v[2] / DW.MAP.W * 75, 0, 7); f.fill(); } c.drawImage(fc, 0, 0); }
  for (const h of s.h) { if (h.dead) continue; c.fillStyle = DW.HEROES[h.hid].col; c.beginPath(); c.arc(mx(h.x), mz(h.z), h.pid === myPid ? 4.5 : 3.5, 0, 7); c.fill(); c.strokeStyle = h.pid === myPid ? '#fff' : '#000'; c.lineWidth = 1.5; c.stroke(); }
  // camera rect
  const vw = G.zoom * 0.9, vh = G.zoom * 0.7; c.strokeStyle = '#fff8'; c.lineWidth = 1; c.strokeRect(mx(G.camX - vw), mz(G.camZ - vh - 4), mx(vw) - mx(0) + mx(vw) - mx(0), (mz(vh) - mz(0)) * 2);
}
let hudT = 0;
function updateHUD(now) {
  if (now - hudT < 100) return; hudT = now;
  const s = G.cur, me = G.me; if (!me) return; const H = DW.HEROES[me.hid];
  const pt = s.t % DW.CYC, night = s.ph === 'night';
  $('clock').innerHTML = `<span class="${night ? 'moon' : 'sunI'}">${night ? '☾' : '☀'}</span> ${fmtT(s.t)} · Day ${s.cy}<small>${night ? 'Dawn in ' + fmtT(DW.CYC - pt) : 'Night in ' + fmtT(DW.DAY - pt)}${s.ec ? ' · ECLIPSE' : ''}</small>`;
  $('clock').classList.toggle('night', night);
  $('gold').textContent = '◉ ' + me.g;
  $('portrait').style.background = H.col; $('portrait').textContent = H.name[0]; $('lvl').textContent = me.lvl;
  $('hpFill').style.width = (me.hp / me.mhp * 100) + '%'; $('hpTxt').textContent = me.hp + ' / ' + me.mhp;
  $('resFill').style.width = (me.res / Math.max(1, me.mres) * 100) + '%'; $('resTxt').textContent = me.res + ' / ' + me.mres + ' ' + H.res.type; $('resFill').className = 'fill res-' + H.res.type;
  $('xpFill').style.width = (me.lvl >= 20 ? 100 : me.xp / me.xn * 100) + '%';
  // abilities
  document.querySelectorAll('.ab').forEach((b, i) => {
    const ab = H.ab[i], r = me.rk[i], cd = me.cd[i];
    b.querySelector('.abName').textContent = ab.n; b.querySelector('.abKey').textContent = 'QWER'[i];
    const maxCd = Array.isArray(ab.cd) ? ab.cd[Math.max(0, r - 1)] : ab.cd;
    b.querySelector('.cdOv').style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.72) ${cd / maxCd * 360}deg, transparent 0)` : 'none';
    b.querySelector('.cdTxt').textContent = cd > 0 ? Math.ceil(cd) : '';
    const cost = r ? (Array.isArray(ab.cost) ? ab.cost[r - 1] : ab.cost) : 0;
    b.classList.toggle('locked', !r); b.classList.toggle('nores', r > 0 && me.res < cost);
    b.querySelector('.pips').innerHTML = Array.from({ length: ab.ult ? 3 : 5 }, (_, j) => `<i class="${j < r ? 'on' : ''}"></i>`).join('');
    const canLv = me.pts > 0 && (i === 3 ? ([6, 11, 16][r] !== undefined && me.lvl >= [6, 11, 16][r]) : (r < 5 && r < Math.ceil(me.lvl / 2)));
    document.querySelectorAll('.lvlup')[i].classList.toggle('hidden', !canLv);
  });
  const anyLv = [0, 1, 2, 3].some(i => !document.querySelectorAll('.lvlup')[i].classList.contains('hidden'));
  $('attrBtn').classList.toggle('hidden', !(me.pts > 0 && !anyLv));
  $('potCount').textContent = me.pots;
  $('btnRecall').innerHTML = night ? '⛩<small>Waygate</small>' : '⌂<small>Recall</small>';
  $('btnShop').classList.toggle('glow', me.shop.any || (me.x - DW.MAP.forge.x) ** 2 + (me.z - DW.MAP.forge.z) ** 2 < 49);
  const atBase = (me.x - DW.MAP.fountain.x) ** 2 + (me.z - DW.MAP.fountain.z) ** 2 < 18 * 18;
  $('btnTowns').classList.toggle('glow', atBase);
  if (atBase && !me.dead && !G.townPromptDone && s.towns.some(t => t.team === 0) && $('modalBg').classList.contains('hidden')) { G.townPromptDone = true; toast('At base — tap Towns (G) to review the town budget', 'info'); }
  if (!atBase) G.townPromptDone = false;
  // recall bar
  if (me.rc) { $('channel').classList.remove('hidden'); $('channelFill').style.width = (100 - me.rc[1] / me.rc[2] * 100) + '%'; $('channelTxt').textContent = me.rc[0] === 'base' ? 'Recalling…' : 'Waygate…'; } else $('channel').classList.add('hidden');
  // rails & raids
  // death
  $('deathOv').classList.toggle('hidden', !me.dead); if (me.dead) $('deathTxt').textContent = 'Respawning in ' + me.rt + 's';
  // night warning
  const inLaneMe = DW.laneDist(me.x, me.z) < 13 && me.z > -98 && me.z < 98;
  $('nightWarn').classList.toggle('hidden', !(night || s.ec) || !inLaneMe || me.dead || me.tw);
  // allies
  $('allies').innerHTML = s.h.filter(h => h.pid !== myPid).map(h => `<div class="ally"><div class="hPort xs" style="background:${DW.HEROES[h.hid].col}">${DW.HEROES[h.hid].name[0]}</div><div class="aInfo"><span>${esc(h.n)} <b>${h.lvl}</b></span><div class="mini-bar"><div style="width:${h.dead ? 0 : h.hp / h.mhp * 100}%"></div></div>${h.dead ? `<small class="dead">☠ ${h.rt}s</small>` : ''}</div></div>`).join('');
  // inventory
  $('inv').innerHTML = me.it.map((it, i) => `<div class="slot" style="${it ? 'border-color:' + itemCol(it) + ';color:' + itemCol(it) : ''}" title="${it ? esc(it.n + ' — ' + statLine(it.s)) : ''}">${it ? esc(it.n.split(' ').map(w => w[0]).join('').slice(0, 3)) : ''}</div>`).join('');
  $('inv').onclick = () => { G.shopTab = 'inv'; renderShop(); };
  // buffs
  $('buffs').innerHTML = me.bf.map(b => `<span class="buff">${b[0]} ${b[1]}</span>`).join('') + (me.tw ? '<span class="buff ward">Town Ward</span>' : '');
  if (modalRefresh && now - (G.modalRefT || 0) > 1000) { G.modalRefT = now; modalRefresh(); }
}

// ============================ BOOT ============================
window.addEventListener('load', () => { initMenu(); show('menu'); $('netLeave').onclick = () => { quitGame(); }; });
window.addEventListener('online', () => { if (G.running && G.mode === 'client') { G.reconnectT = 0; G.lastNet = 0; } });
window.BOD = { G, L, send };
})();
