(() => {
'use strict';
const TD = window.TD;
const SB_URL = 'https://ucdwqexhkglvhilurqti.supabase.co', SB_KEY = 'sb_publishable_E9Iaftt5o7nK4Ph5FeoONw_QSfj7KeE';
const BUILD = window.TD_BUILD || 'dev', VER = window.TD_VER || '0.00';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('td_' + k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('td_' + k, v); } catch (e) { } } };
let myPid = store.get('pid', null); if (!myPid) { myPid = Math.random().toString(36).slice(2, 10); store.set('pid', myPid); }
let myName = (store.get('name', '') || '').slice(0, 16);
let myColor = store.get('color', 'blue'); if (!TD.COLORS.some(c => c.id === myColor)) myColor = 'blue';
const colHex = id => (TD.COLORS.find(c => c.id === id) || TD.COLORS[0]).c;
const fmtT = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const cleanName = t => String(t || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const randomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const MOBILE = window.matchMedia('(pointer:coarse)').matches;
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; $('toasts').appendChild(el); setTimeout(() => el.remove(), 2600); }
function show(id) { ['menu', 'lobby', 'game'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }
function openModal(html, bind) { $('modal').innerHTML = html; $('modalBg').classList.remove('hidden'); if (bind) bind(); }
function closeModal() { $('modalBg').classList.add('hidden'); }
function goFull() { try { if (MOBILE && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { } } // fullscreen only; any orientation works

let sb = null;
function getSB() { if (!sb && window.supabase) { try { sb = window.supabase.createClient(SB_URL, SB_KEY, { realtime: { params: { eventsPerSecond: 40 } } }); } catch (e) { } } return sb; }

// ============================ MENU ============================
let homeScreen = myName ? 'home' : 'name', menuErr = '';
function renderMenu() {
  const m = $('menuPanel');
  $('menuWho').innerHTML = myName ? `Playing as <b>${esc(myName)}</b> · <a href="#" data-act="rename" style="color:var(--gold2)">change name</a>` : '';
  if (homeScreen === 'name' || !myName) m.innerHTML = `<div class="eyebrow">${myName ? 'Change name' : 'Welcome'}</div><h2>${myName ? 'Change your name' : 'Choose your name'}</h2>
    <form id="nameForm" class="menuPanel"><input id="nameIn" class="textin" maxlength="16" placeholder="Your name" value="${esc(myName)}" autocomplete="off"><button class="btn primary" type="submit">Continue</button>${myName ? '<button class="btn ghost" type="button" data-act="home">Back</button>' : ''}</form><p class="err">${esc(menuErr)}</p>`;
  else if (homeScreen === 'host') m.innerHTML = `<div class="eyebrow">Host a lobby</div><h2>Name your lobby</h2>
    <form id="hostForm" class="menuPanel"><input id="lobbyIn" class="textin" maxlength="28" placeholder="${esc(myName)}'s Lobby" value="${esc(store.get('lobbyName', ''))}" autocomplete="off"><button class="btn primary" type="submit">Open lobby</button><button class="btn ghost" type="button" data-act="home">Back</button></form>`;
  else if (homeScreen === 'browse') m.innerHTML = `<div class="eyebrow">Lobby browser</div><h2>Open lobbies</h2>
    <div class="lobbyList">${!dir.ready ? '<div class="spin"></div>' : dir.list.length ? dir.list.map(l => `<button class="lobbyItem" data-join="${esc(l.code)}"><div class="grow"><b>${esc(l.name)}</b><small class="muted">${esc(mapName(l.mode))} · ${esc(l.heroes || '')} · host ${esc(l.host)}</small></div><span class="chip">${l.joined}/${l.n}</span></button>`).join('') : '<div class="empty">No open lobbies right now. Host one, or play vs AI.</div>'}</div>
    <div class="row" style="justify-content:space-between"><small class="muted">${esc(dir.err || 'Refreshes every 5 seconds')}</small><button class="btn ghost sm" data-act="home">Back</button></div>`;
  else if (homeScreen === 'search') m.innerHTML = `<div class="eyebrow">Find match</div><h2>Searching…</h2><div class="spin"></div><p class="muted" style="text-align:center">${esc(qm.status)}</p><button class="btn ghost" data-act="cancelSearch">Cancel</button>`;
  else if (homeScreen === 'joining') m.innerHTML = `<div class="eyebrow">Joining</div><h2>Joining lobby…</h2><div class="spin"></div><button class="btn ghost" data-act="cancelJoin">Cancel</button>`;
  else { const on = !!getSB(); m.innerHTML = `<div class="eyebrow">Play</div>
    <button class="btn primary big" data-act="find" ${on ? '' : 'disabled'}>Find Match<small>Join the next open lobby</small></button>
    <div class="row2"><button class="btn big" data-act="hostForm" ${on ? '' : 'disabled'}>Host Lobby</button><button class="btn big" data-act="browse" ${on ? '' : 'disabled'}>Browse Lobbies</button></div>
    <button class="btn big" data-act="vsai">Play vs AI<small>Defend your lane against an AI attacker</small></button>
    ${on ? '' : '<p class="err">Online play is unavailable (the game server didn\'t load). Play vs AI still works.</p>'}<p class="err">${esc(menuErr)}</p>`; }
  bindMenu();
}
const mapName = id => (TD.MAPS.find(m => m.id === id) || { n: id }).n;
function bindMenu() {
  const root = $('menu');
  root.querySelectorAll('[data-act]').forEach(b => b.onclick = e => { e.preventDefault(); menuAct(b.dataset.act); });
  root.querySelectorAll('[data-join]').forEach(b => b.onclick = () => { goFull(); stopBrowsing(); joinLobby(b.dataset.join); });
  const nf = $('nameForm'); if (nf) nf.onsubmit = e => { e.preventDefault(); const n = cleanName($('nameIn').value); if (!n) { menuErr = 'Enter a name.'; return renderMenu(); } myName = n; store.set('name', n); menuErr = ''; homeScreen = 'home'; renderMenu(); };
  const hf = $('hostForm'); if (hf) { $('lobbyIn').oninput = e => store.set('lobbyName', e.target.value.slice(0, 28)); hf.onsubmit = e => { e.preventDefault(); goFull(); hostLobby({ name: cleanName($('lobbyIn').value).slice(0, 28) }); }; }
}
function menuAct(a) {
  menuErr = '';
  if (a === 'rename') { homeScreen = 'name'; return renderMenu(); }
  if (a === 'home') { stopBrowsing(); homeScreen = 'home'; return renderMenu(); }
  if (a === 'hostForm') { homeScreen = 'host'; return renderMenu(); }
  if (a === 'browse') { homeScreen = 'browse'; startBrowsing(); return renderMenu(); }
  if (a === 'find') { goFull(); return startQuick(); }
  if (a === 'cancelSearch') { stopQuick(); homeScreen = 'home'; return renderMenu(); }
  if (a === 'cancelJoin') { leaveLobby(); return; }
  if (a === 'vsai') { goFull(); return enterSolo(); }
}

// ============================ LOBBY DIRECTORY ============================
let dir = { list: [], ready: false, err: '' }, browseTimer = null, hostBeat = null, advertised = null;
async function fetchLobbies() {
  const s = getSB(); if (!s) return [];
  const { data, error } = await s.rpc('bod_open_lobbies', { p_version: BUILD });
  dir.ready = true;
  if (error) dir.err = "Couldn't load lobbies. Retrying…"; else { dir.err = ''; dir.list = (data || []).filter(l => l.code !== L.code); }
  if (homeScreen === 'browse' && !$('menu').classList.contains('hidden')) renderMenu();
  return dir.list;
}
function startBrowsing() { stopBrowsing(); dir = { list: [], ready: false, err: '' }; fetchLobbies(); browseTimer = setInterval(fetchLobbies, 5000); }
function stopBrowsing() { if (browseTimer) clearInterval(browseTimer); browseTimer = null; }
const humanCap = () => LS.seats[0] === 'ai' ? TD.MAX_DEF : TD.MAX_DEF + 1;
const humansIn = () => L.players.length;
function lobbyRow() {
  const nd = LS.seats.slice(1).filter(Boolean).length;
  return { code: L.code, name: (L.lobbyName || `${myName}'s Lobby`).slice(0, 40), host: myName.slice(0, 20), mode: LS.map, n: humanCap(), joined: Math.max(1, humansIn()), heroes: (LS.seats[0] === 'ai' ? 'vs AI attacker' : '1v' + Math.max(1, nd)).slice(0, 120), version: BUILD };
}
function advertise() {
  const s = getSB(); if (!s || L.mode !== 'host' || L.started) return unadvertise();
  const beat = () => { if (L.mode !== 'host' || L.started || !L.code) return unadvertise(); s.from('bod_lobbies').upsert(lobbyRow(), { onConflict: 'code' }).then(({ error }) => { if (error) console.warn('lobby heartbeat failed', error.message); }); };
  advertised = L.code; beat(); if (!hostBeat) hostBeat = setInterval(beat, 5000);
}
function unadvertise() { if (hostBeat) clearInterval(hostBeat); hostBeat = null; const s = getSB(); if (advertised && s) { const c = advertised; advertised = null; s.from('bod_lobbies').delete().eq('code', c).then(() => { }, () => { }); } }
window.addEventListener('pagehide', () => { if (advertised) unadvertise(); });

// find match: join the fullest lobby with room; otherwise open a Quick Match lobby and keep watching for an older one to merge into
const qm = { timer: null, status: '' };
async function startQuick() {
  if (!getSB()) return; homeScreen = 'search'; qm.status = 'Looking for open lobbies.'; renderMenu();
  const list = (await fetchLobbies()).filter(l => l.joined < l.n).sort((a, b) => b.joined - a.joined || new Date(a.created_at) - new Date(b.created_at));
  if (homeScreen !== 'search') return;
  if (list.length) { qm.status = 'Joining ' + list[0].name + '…'; renderMenu(); return joinLobby(list[0].code); }
  hostLobby({ name: 'Quick Match', quick: true });
}
function stopQuick() { if (qm.timer) clearInterval(qm.timer); qm.timer = null; }
function quickWatch() {
  stopQuick();
  qm.timer = setInterval(async () => {
    if (!L.quick || L.mode !== 'host' || L.started || L.players.length > 1) return;
    const older = (await fetchLobbies()).filter(l => l.joined < l.n && l.name === 'Quick Match' && l.code !== L.code && new Date(l.created_at) < new Date(L.createdAt));
    if (older.length && L.quick && L.players.length <= 1 && !L.started) { stopQuick(); const c = older[0].code; leaveLobby(true); joinLobby(c); }
  }, 4000);
}

// ============================ LOBBY ROOM ============================
// L: my connection to a lobby. LS: the lobby's state (seats, map, picks), owned by the host and broadcast to everyone.
const L = { mode: null, code: null, ch: null, players: [], started: false, lobbyName: '', quick: false };
let LS = freshLS();
function freshLS() { return { map: 'greenvale', seats: [null, null, null, null, null], pl: {} }; }
const isHost = () => L.mode === 'host' || L.mode === 'solo';
function hostLobby(o) {
  if (!getSB()) { menuErr = 'Network unavailable'; return renderMenu(); }
  Object.assign(L, { mode: 'host', started: false, players: [], code: randomCode(), lobbyName: o.name || '', quick: !!o.quick, createdAt: new Date().toISOString(), joined: Date.now() });
  LS = freshLS(); LS.pl[myPid] = { name: myName, color: myColor, race: 'human', ready: true }; LS.seats[1] = myPid;
  homeScreen = 'home'; enterLobbyScreen(); openRoomChannel(); advertise(); if (L.quick) quickWatch();
}
function joinLobby(code) {
  if (!getSB()) { menuErr = 'Network unavailable'; return renderMenu(); }
  Object.assign(L, { mode: 'client', started: false, players: [], code: String(code).toUpperCase(), joined: Date.now(), seenHost: false, quick: false });
  LS = freshLS(); homeScreen = 'joining'; renderMenu(); openRoomChannel();
  clearTimeout(L.joinTimer); L.joinTimer = setTimeout(() => { if (!L.seenHost && L.mode === 'client' && !GS.running) { leaveLobby(); menuErr = 'That lobby is no longer open.'; renderMenu(); } }, 9000);
}
function enterSolo() {
  Object.assign(L, { mode: 'solo', started: false, code: null, lobbyName: 'Play vs AI', quick: false, players: [{ pid: myPid, name: myName }] });
  LS = freshLS(); LS.pl[myPid] = { name: myName, color: myColor === 'red' ? 'blue' : myColor, race: 'human', ready: true }; LS.seats[0] = 'ai'; LS.seats[1] = myPid;
  enterLobbyScreen();
}
function enterLobbyScreen() { show('lobby'); renderLobby(); }
function openRoomChannel() {
  const s = getSB(); if (L.ch) { try { s.removeChannel(L.ch); } catch (e) { } }
  const ch = s.channel('td-room-' + L.code, { config: { presence: { key: myPid }, broadcast: { self: false, ack: false } } });
  L.ch = ch;
  ch.on('presence', { event: 'sync' }, () => {
    if (ch !== L.ch) return;
    const st = ch.presenceState(), arr = [];
    for (const k in st) { const p = st[k][st[k].length - 1]; if (p) arr.push(p); }
    arr.sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.joined - b.joined);
    L.players = arr;
    const hostP = arr.find(p => p.host);
    if (!isHost()) {
      if (hostP && !L.seenHost && !GS.running) {
        if (hostP.v !== BUILD) { menuErr = 'That lobby is on a different version. Reload the page to update, then try again.'; leaveLobby(); return; }
        if (hostP.started) { menuErr = 'That match has already started.'; leaveLobby(); return; }
        L.seenHost = true; clearTimeout(L.joinTimer); enterLobbyScreen();
      }
      if (hostP) { clearTimeout(L.hostGone); L.hostGone = null; L.lobbyName = hostP.ln || L.lobbyName; }
      if (L.seenHost && !hostP && !L.hostGone) L.hostGone = setTimeout(() => { L.hostGone = null; if (L.players.some(p => p.host)) return; if (GS.running) { endGame(); openModal('<h2>The host left</h2><p class="muted">The match ran on the host\'s device, so it has ended.</p><button class="btn primary" id="mOk">Back to menu</button>', () => $('mOk').onclick = () => { closeModal(); leaveLobby(); }); } else { leaveLobby(); menuErr = 'The host closed the lobby.'; renderMenu(); } }, GS.running ? 15000 : 3000);
      return;
    }
    if (GS.running) return;
    // host: version check, capacity, seat bookkeeping
    arr.filter(p => !p.host && p.v !== BUILD).forEach(p => ch.send({ type: 'broadcast', event: 'kick', payload: { pid: p.pid, reason: 'Different game version. Reload the page to update.' } }));
    arr.filter(p => !p.host && p.v === BUILD).slice(humanCap() - 1).forEach(p => ch.send({ type: 'broadcast', event: 'kick', payload: { pid: p.pid, reason: 'That lobby is full.' } }));
    const here = new Set(arr.filter(p => p.v === BUILD).map(p => p.pid)); here.add(myPid);
    for (const pid in LS.pl) if (!here.has(pid)) { delete LS.pl[pid]; LS.seats = LS.seats.map(s => s === pid ? null : s); }
    for (const p of arr) if (p.v === BUILD && !LS.pl[p.pid]) {
      const taken = new Set(Object.values(LS.pl).map(q => q.color)), color = !taken.has(p.color) && TD.COLORS.some(c => c.id === p.color) ? p.color : (TD.COLORS.find(c => !taken.has(c.id)) || TD.COLORS[0]).id;
      LS.pl[p.pid] = { name: cleanName(p.name) || 'Player', color, race: 'human', ready: false };
      const open = LS.seats.findIndex((s, i) => i > 0 && !s); if (open > 0) LS.seats[open] = p.pid; else if (!LS.seats[0]) LS.seats[0] = p.pid;
    }
    lsChanged();
  });
  ch.on('broadcast', { event: 'ls' }, ({ payload }) => { if (isHost() || GS.running) return; LS = payload; if (L.seenHost) renderLobby(); });
  ch.on('broadcast', { event: 'rq' }, ({ payload }) => { if (L.mode === 'host' && !GS.running) { applyReq(payload.pid, payload.r); } });
  ch.on('broadcast', { event: 'start' }, ({ payload }) => { if (!isHost() && !GS.running && L.seenHost) { L.started = true; startGame(payload, 'client'); } });
  ch.on('broadcast', { event: 's' }, ({ payload }) => { if (GS.running && GS.mode === 'client') { GS.lastNet = performance.now(); applySnap(payload); } });
  ch.on('broadcast', { event: 'in' }, ({ payload }) => { if (GS.running && GS.mode === 'host' && GS.sim) GS.sim.input(payload.pid, payload.c); });
  ch.on('broadcast', { event: 'kick' }, ({ payload }) => { if (payload.pid === myPid && !isHost()) { leaveLobby(); menuErr = payload.reason || 'Removed from the lobby.'; renderMenu(); } });
  ch.subscribe(st => { if (st === 'SUBSCRIBED') pushPresence(); else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !GS.running) { menuErr = "Can't reach the game server. Check your connection."; renderMenu(); } });
}
function pushPresence() { if (L.ch) L.ch.track({ pid: myPid, name: myName, color: myColor, host: L.mode === 'host', joined: L.joined, v: BUILD, ln: L.mode === 'host' ? L.lobbyName : undefined, started: L.mode === 'host' ? L.started : undefined }); }
function lsChanged() { if (L.mode === 'host' && L.ch) { L.ch.send({ type: 'broadcast', event: 'ls', payload: LS }); advertise(); } renderLobby(); }
function req(r) { if (isHost()) applyReq(myPid, r); else if (L.ch) L.ch.send({ type: 'broadcast', event: 'rq', payload: { pid: myPid, r } }); }
function applyReq(pid, r) {
  const me = LS.pl[pid]; if (!me) return; const host = pid === myPid;
  if (r.a === 'seat') { const i = r.i | 0; if (i < 0 || i > 4 || LS.seats[i]) return; if (L.mode === 'solo' && i === 0) return; LS.seats = LS.seats.map(s => s === pid ? null : s); LS.seats[i] = pid; if (!host) me.ready = false; }
  else if (r.a === 'color') { if (!TD.COLORS.some(c => c.id === r.c) || Object.entries(LS.pl).some(([q, p]) => q !== pid && p.color === r.c) || (LS.seats[0] === 'ai' && r.c === 'red')) return; me.color = r.c; }
  else if (r.a === 'race') { if (!TD.RACES.some(x => x.id === r.race && x.on)) return; me.race = r.race; }
  else if (r.a === 'ready') me.ready = !!r.v;
  else if (host && r.a === 'map') { if (TD.MAPS.some(m => m.id === r.m && m.on)) LS.map = r.m; }
  else if (host && r.a === 'ai') { if (LS.seats[0] === 'ai') LS.seats[0] = null; else if (!LS.seats[0]) { LS.seats[0] = 'ai'; for (const p of Object.values(LS.pl)) if (p.color === 'red') p.color = (TD.COLORS.find(c => c.id !== 'red' && !Object.values(LS.pl).some(q => q.color === c.id)) || TD.COLORS[1]).id; } }
  else if (host && r.a === 'kick' && r.pid !== myPid) { if (L.ch) L.ch.send({ type: 'broadcast', event: 'kick', payload: { pid: r.pid, reason: 'The host removed you from the lobby.' } }); }
  if (pid === myPid && r.a === 'color') { myColor = r.c; store.set('color', r.c); }
  lsChanged();
}
function leaveLobby(silent) {
  stopQuick(); unadvertise(); clearTimeout(L.joinTimer); clearTimeout(L.hostGone); L.hostGone = null;
  if (L.ch) { try { L.ch.untrack(); getSB().removeChannel(L.ch); } catch (e) { } }
  L.ch = null; L.code = null; L.seenHost = false; L.quick = false; L.mode = null;
  if (silent) return; homeScreen = 'home'; show('menu'); renderMenu();
}
// ---------- lobby screen ----------
function seatRow(i) {
  const s = LS.seats[i], p = s && s !== 'ai' ? LS.pl[s] : null, mine = s === myPid;
  if (s === 'ai') return `<div class="seat"><div class="sw" style="background:${colHex('red')}"></div><div class="grow"><b>AI Attacker</b><small class="muted">Human · Red</small></div>${isHost() && L.mode !== 'solo' ? '<button class="btn ghost sm" data-ai>Remove AI</button>' : '<span class="tag ok">Ready</span>'}</div>`;
  if (!p) return `<div class="seat open" data-seat="${i}"><div class="sw" style="background:#0004"></div><div class="grow"><b>${i === 0 ? 'Open attacker seat' : 'Open defender seat'}</b><small>Tap to take this seat</small></div>${i === 0 && isHost() ? '<button class="btn sm" data-ai>Add AI attacker</button>' : ''}</div>`;
  const ishost = L.mode === 'solo' ? true : (L.players.find(q => q.pid === s) || {}).host || (isHost() && s === myPid);
  return `<div class="seat ${mine ? 'mine' : ''}"><div class="sw" style="background:${colHex(p.color)}"></div><div class="grow"><b>${esc(p.name)}${mine ? ' (you)' : ''}${ishost ? ' 👑' : ''}</b><small class="muted">${(TD.RACES.find(r => r.id === p.race) || TD.RACES[0]).n} · ${(TD.COLORS.find(c => c.id === p.color) || {}).n || ''}</small></div><span class="tag ${p.ready || ishost ? 'ok' : ''}">${ishost ? 'Host' : p.ready ? 'Ready' : 'Not ready'}</span>${isHost() && L.mode === 'host' && s !== myPid ? `<button class="btn ghost sm" data-kick="${esc(s)}">✕</button>` : ''}</div>`;
}
function startable() {
  const atk = LS.seats[0], defs = LS.seats.slice(1).filter(Boolean);
  if (!atk) return 'Fill the attacker seat (a player, or Add AI attacker).';
  if (!defs.length) return 'At least one defender is needed.';
  const seated = new Set(LS.seats.filter(s => s && s !== 'ai'));
  if (L.mode === 'host' && L.players.some(p => p.v === BUILD && !seated.has(p.pid))) return 'Everyone in the lobby needs a seat.';
  const notReady = [...seated].filter(pid => pid !== myPid && !(LS.pl[pid] || {}).ready); if (notReady.length) return 'Waiting for everyone to ready up…';
  return '';
}
function renderLobby() {
  if ($('lobby').classList.contains('hidden')) return;
  const me = LS.pl[myPid]; if (!me) { $('seats').innerHTML = '<div class="spin"></div>'; return; }
  const nd = LS.seats.slice(1).filter(Boolean).length;
  $('lobbyEyebrow').textContent = L.mode === 'solo' ? 'Practice' : (LS.seats[0] === 'ai' ? 'vs AI attacker' : '1v' + Math.max(1, nd)) + ' · ' + mapName(LS.map);
  $('lobbyTitle').textContent = L.mode === 'solo' ? 'Play vs AI' : (L.lobbyName || (((L.players.find(p => p.host) || {}).name) || myName) + "'s Lobby");
  $('mapPick').innerHTML = TD.MAPS.map(m => `<button class="mapCard ${LS.map === m.id ? 'on' : ''}" data-map="${m.id}" ${m.on && isHost() ? '' : 'disabled'}><div class="mapThumb" style="background:${m.on ? 'linear-gradient(135deg,#4f7a3a,#2f5a2a 60%,#b38f5c 61%,#b38f5c 66%,#4f7a3a 67%)' : '#2a2620'}"></div><b>${m.n}</b><small>${m.on ? (isHost() ? m.d : 'Host picks the map') : 'Coming soon'}</small></button>`).join('');
  $('seats').innerHTML = `<div class="seatHead">Attacker</div>${seatRow(0)}<div class="seatHead">Defenders</div>${[1, 2, 3, 4].map(seatRow).join('')}`;
  $('racePick').innerHTML = TD.RACES.map(r => `<button class="race ${me.race === r.id ? 'on' : ''}" data-race="${r.id}" ${r.on ? '' : 'disabled'}>${r.n}<small>${r.on ? 'Available' : 'Coming soon'}</small></button>`).join('');
  const taken = new Set(Object.entries(LS.pl).filter(([q]) => q !== myPid).map(([, p]) => p.color)); if (LS.seats[0] === 'ai') taken.add('red');
  $('colorPick').innerHTML = TD.COLORS.map(c => `<button class="swatch ${me.color === c.id ? 'on' : ''}" data-col="${c.id}" title="${c.n}" style="background:${c.c}" ${taken.has(c.id) ? 'disabled' : ''}></button>`).join('');
  const why = startable(), btn = $('btnReady');
  if (isHost()) { btn.textContent = L.mode === 'solo' ? 'Start' : 'Start match'; btn.disabled = !!why; btn.onclick = hostStart; $('lobbyHint').textContent = why || (L.mode === 'solo' ? 'You defend; the AI attacks. Tap an open defender seat to switch lanes.' : 'Ready to start. Keep this page open: your device runs the match.'); }
  else { btn.disabled = false; btn.textContent = me.ready ? 'Unready' : 'Ready'; btn.onclick = () => req({ a: 'ready', v: !me.ready }); $('lobbyHint').textContent = 'Tap an open seat to switch seats. The host starts the match.'; }
  $('btnLeave').textContent = L.mode === 'solo' ? 'Back' : L.mode === 'host' ? 'Close lobby' : 'Leave';
  $('btnLeave').onclick = () => { if (L.mode === 'solo') { L.mode = null; show('menu'); renderMenu(); } else leaveLobby(); };
  const lob = $('lobby');
  lob.querySelectorAll('[data-seat]').forEach(b => b.onclick = e => { if (e.target.closest('[data-ai]')) return; req({ a: 'seat', i: +b.dataset.seat }); });
  lob.querySelectorAll('[data-ai]').forEach(b => b.onclick = e => { e.stopPropagation(); req({ a: 'ai' }); });
  lob.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => req({ a: 'kick', pid: b.dataset.kick }));
  lob.querySelectorAll('[data-map]').forEach(b => b.onclick = () => req({ a: 'map', m: b.dataset.map }));
  lob.querySelectorAll('[data-race]').forEach(b => b.onclick = () => req({ a: 'race', race: b.dataset.race }));
  lob.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { if (!isHost()) { myColor = b.dataset.col; store.set('color', myColor); } req({ a: 'color', c: b.dataset.col }); });
}
function hostStart() {
  if (startable()) return; goFull();
  const players = [];
  const a = LS.seats[0]; players.push(a === 'ai' ? { pid: 'ai', name: 'AI Attacker', role: 'atk', color: 'red', race: 'human', bot: 1 } : { pid: a, name: LS.pl[a].name, role: 'atk', color: LS.pl[a].color, race: LS.pl[a].race });
  LS.seats.slice(1).forEach(s => { if (s && LS.pl[s]) players.push({ pid: s, name: LS.pl[s].name, role: 'def', color: LS.pl[s].color, race: LS.pl[s].race }); });
  const cfg = { seed: Math.floor(Math.random() * 2 ** 31), map: LS.map, players };
  if (L.mode === 'host') { L.started = true; stopQuick(); unadvertise(); pushPresence(); L.ch.send({ type: 'broadcast', event: 'start', payload: cfg }); }
  startGame(cfg, L.mode);
}

// ============================ GAME ============================
const GS = { running: false, mode: null, sim: null, timer: null, lastNet: 0 };
let V = null; // what this screen shows, built from snapshots
const cv = $('view'), x = cv.getContext('2d'), X0 = x;
const DPR = Math.min(2, window.devicePixelRatio || 1);
let VW = 960, VH = 540;
const rr = (a, b) => a + Math.random() * (b - a);
const mix = (a, b, t) => { const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const CELL = TD.CELL, FOOT = TD.FOOT;

function startGame(cfg, mode) {
  closeModal(); show('game'); GS.running = true; GS.mode = mode; GS.lastNet = performance.now();
  const defs = cfg.players.filter(p => p.role === 'def'), atk = cfg.players.find(p => p.role === 'atk'), Lo = TD.layout(cfg.map, defs.length);
  V = { cfg, L: Lo, defs: defs.map((p, i) => Object.assign({ slot: i, gold: 0, income: 0, kills: 0 }, p)), atk: Object.assign({ gold: 0, income: 0, invest: 0, investCost: 0, queue: [] }, atk),
    world: { W: Lo.W, H: Lo.H }, units: new Map(), towers: [], towerMap: new Map(), beams: [], t: 0, pulse: TD.RULES.pulse, wave: 0, hp: TD.RULES.hpPer * defs.length, hpMax: TD.RULES.hpPer * defs.length, closed: false, over: null,
    shots: [], fx: [], corpses: [], parts: [], tiles: new Map(), sel: null, baseFlash: -9, treeGone: new Set(), occ: new Uint8Array(Lo.cols * Lo.rows) };
  V.me = cfg.players.find(p => p.pid === myPid) || null; V.myDef = V.defs.find(d => d.pid === myPid) || null; V.isAtk = V.atk.pid === myPid;
  V.atkCol = colHex(V.atk.color);
  atkUI.target = 'all'; atkUI.qty = 1; build.on = false; build.drag = null;
  buildGround(); resize(); resetCamera();
  $('buildBtn').classList.toggle('hidden', !V.myDef); $('buildTray').classList.add('hidden'); $('atkPanel').classList.toggle('hidden', !V.isAtk);
  if (mode !== 'client') {
    GS.sim = new TD.Sim({ seed: cfg.seed, map: cfg.map, players: cfg.players });
    clearInterval(GS.timer); let last = performance.now(), acc = 0;
    applySnap(GS.sim.snapshot(true));
    GS.timer = setInterval(() => {
      const now = performance.now(); acc += Math.min(0.5, (now - last) / 1000); last = now;
      while (acc >= 0.05) {
        acc -= 0.05; GS.sim.step(0.05);
        if (GS.sim.tick % 4 === 0 || GS.sim.over) {
          const snap = GS.sim.snapshot(GS.sim.tick % 100 === 0);
          if (mode === 'host' && L.ch) L.ch.send({ type: 'broadcast', event: 's', payload: snap });
          applySnap(snap);
          if (GS.sim.over) { clearInterval(GS.timer); GS.timer = null; break; }
        }
      }
    }, 25);
  }
  renderHUD(true);
}
function endGame() { GS.running = false; clearInterval(GS.timer); GS.timer = null; GS.sim = null; hideSheet(); setBuild(false); }
function send(c) { if (!GS.running) return; if (GS.mode === 'client') { if (L.ch) L.ch.send({ type: 'broadcast', event: 'in', payload: { pid: myPid, c } }); } else if (GS.sim) GS.sim.input(myPid, c); }

// ---------- snapshots ----------
function unitXY(u) { const p = V.L.lanes[u.l].at(u.dr); u.x = p[0] + Math.cos(p[2] + Math.PI / 2) * u.off; u.y = p[1] + Math.sin(p[2] + Math.PI / 2) * u.off; u.a = p[2]; }
function addUnit(id, ki, l, off, sp, d) { if (V.units.has(id) || !V.L.lanes[l]) return; const u = { id, k: TD.UNIT_IDS[ki], l, off, sp, dr: d, err: 0, hp: 100, f: 0, ph: Math.random() * 6 }; u.r = TD.UNITS[u.k].r; unitXY(u); V.units.set(id, u); }
function clearTrees(t) { const x0 = t.c * CELL - 8, y0 = t.r * CELL - 8, x1 = (t.c + FOOT) * CELL + 8, y1 = (t.r + FOOT) * CELL + 8; for (const tr of V.L.trees) if (!V.treeGone.has(tr.id) && tr.x > x0 && tr.x < x1 && tr.y > y0 && tr.y < y1 + 10) { V.treeGone.add(tr.id); if (onScreen(tr.x, tr.y, 60)) for (let i = 0; i < 8; i++) particle('dirt', tr.x, tr.y, rr(4, 20), rr(-60, 60), rr(-40, 40), rr(60, 160), rr(0.4, 0.8), tr.rock ? '#8a877e' : '#3a6a2e', rr(2, 4)); } }
function applySnap(s) {
  V.t = s.t; V.pulse = s.pu; V.wave = s.wv; V.closed = !!s.cl;
  if (s.hp < V.hp) V.baseFlash = V.clock || 0; V.hp = s.hp;
  V.atk.gold = s.a[0]; V.atk.income = s.a[1]; V.atk.invest = s.a[2]; V.atk.investCost = s.a[3]; V.atk.queue = s.a[4]; V.atk.speed = s.a[5] || 0; V.atk.speedCost = s.a[6] || 0;
  s.df.forEach((d, i) => { const D = V.defs[i]; if (!D) return; D.gold = d[0]; D.income = d[1]; D.kills = d[2]; });
  if (s.tw) {
    const old = new Map(V.towers.map(t => [t.id, t])); V.occ.fill(0);
    V.towers = s.tw.map(a => { const prev = old.get(a[0]), o = prev || { aim: Math.PI / 2, kick: 0, born: V.clock || 0 }; const D = V.defs[a[1]] || V.defs[0];
      Object.assign(o, { id: a[0], slot: a[1], k: TD.TOWER_IDS[a[2]], c: a[3], r: a[4], prio: TD.PRIORITIES[a[5]] || 'first', kills: a[6], spent: a[7], x: (a[3] + FOOT / 2) * CELL, y: (a[4] + FOOT / 2) * CELL, col: colHex(D.color), owner: D.pid });
      const left = a[8] / 100; if (left > 0) o.readyAt = (V.clock || 0) + left; else if (o.readyAt && o.readyAt > (V.clock || 0)) o.readyAt = V.clock || 0;
      if (!prev) clearTrees(o);
      for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) V.occ[(o.r + j) * V.L.cols + o.c + i] = 1;
      return o; });
    V.towerMap = new Map(V.towers.map(t => [t.id, t]));
    for (const [id, t] of old) if (!V.towerMap.has(id) && V.sel && V.sel.tower === id) hideSheet();
  }
  if (s.units) for (const a of s.units) addUnit(a[0], a[1], a[2], a[3], a[4], a[5]);
  for (const e of s.ev) handleEvent(e);
  const seen = new Set();
  for (let i = 0; i < s.u.length; i += 4) { const u = V.units.get(s.u[i]); if (!u) continue; seen.add(u.id); u.err = s.u[i + 1] - u.dr; if (Math.abs(u.err) > 60) { u.dr = s.u[i + 1]; u.err = 0; } u.hp = s.u[i + 2]; u.f = s.u[i + 3]; }
  for (const [id] of V.units) if (!seen.has(id)) V.units.delete(id);
  V.beams = s.bm || [];
  if (s.stats) V.stats = s.stats;
  if (s.over && !V.over) { V.over = s.over; setBuild(false); setTimeout(showEnd, 1500); }
  renderHUD();
}
function handleEvent(e) {
  const k = e[0];
  if (k === 'u') addUnit(e[1], e[2], e[3], e[4], e[5], e[6]);
  else if (k === 'd') { const u = V.units.get(e[1]); if (u) { V.units.delete(e[1]); if (onScreen(u.x, u.y, 200)) die(u, e[2], e[3], e[4]); else if (e[2] !== 'fire' && e[2] !== 'ice') stain(u.x, u.y, u.r * 1.6, BLOOD[0], 0.5); } }
  else if (k === 's') { const t = V.towerMap.get(e[1]), u = V.units.get(e[2]); if (t && u) { t.aim = Math.atan2(u.y - t.y, u.x - t.x); t.kick = 1; if (onScreen(t.x, t.y, 300)) V.shots.push({ k: t.k, x: t.x, y: t.y - 16, sx: t.x, sy: t.y - 16, u, tx: u.x, ty: u.y, T: e[3] / 100, age: 0 }); } }
  else if (k === 'z') { const t = V.towerMap.get(e[1]); if (t) { t.kick = 1; const pts = [[t.x, t.y - 22]]; for (const id of e[2]) { const u = V.units.get(id); if (u) pts.push([u.x, u.y - u.r]); } if (pts.length > 1 && onScreen(t.x, t.y, 300)) V.fx.push({ k: 'bolt', pts, t0: V.clock }); } }
  else if (k === 'sl') V.fx.push({ k: 'boom', x: e[1], y: e[2], t0: V.clock, small: 1 });
  else if (k === 'lk') { V.units.delete(e[1]); V.fx.push({ k: 'leak', x: V.L.base.x + rr(-40, 40), y: V.L.base.y - 110, n: e[2], t0: V.clock }); }
  else if (k === 'closed') toast('Time! No more units can be sent. Clear the field.');
  else if (k === 'w') { if (V.isAtk && e[2]) toast('Wave ' + e[1] + ' marches: ' + e[2] + ' units'); }
}

// ---------- ground (painted once per map + defender count) ----------
let groundBg = null, groundKey = '', gridBg = null;
function buildGround() {
  const key = V.cfg.map + ':' + V.defs.length; if (groundKey === key && groundBg) return; groundKey = key;
  const Lo = V.L, W = Lo.W, H = Lo.H, top = TD.STAGE_H, RH = H + top;
  const c = document.createElement('canvas'); c.width = W; c.height = RH; const g = c.getContext('2d'); groundBg = c;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, W, RH);
  for (let i = 0; i < 5200; i++) { g.fillStyle = ['#5b8a42', '#47703a', '#628f48', '#3f6633'][i % 4]; g.globalAlpha = 0.5; const r = 6 + rnd() * 30; g.beginPath(); g.ellipse(rnd() * W, rnd() * RH, r, r * 0.6, rnd() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const sg = g.createLinearGradient(0, 0, 0, top + 40); sg.addColorStop(0, '#5a4630'); sg.addColorStop(0.8, '#6b5536'); sg.addColorStop(1, 'rgba(107,85,54,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, top + 40);
  for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < 0.5 ? '#4a3a26' : '#7a6444'; g.beginPath(); g.arc(rnd() * W, rnd() * top, 1 + rnd() * 3, 0, 7); g.fill(); }
  g.save(); g.translate(0, top);
  const roads = (w, col) => { g.lineJoin = g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = col; for (const L of Lo.lanes) { g.beginPath(); L.P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); } };
  roads(TD.LANE * 2 + 12, '#3b2f20'); roads(TD.LANE * 2 + 2, '#9c7a4c'); roads(TD.LANE * 2 - 18, '#b38f5c');
  for (const L of Lo.lanes) for (let i = 0; i < 1100; i++) { const [px, py] = L.at(rnd() * L.total); g.fillStyle = rnd() < 0.5 ? '#8a6a40' : '#c9a774'; g.beginPath(); g.arc(px + (rnd() - .5) * TD.LANE * 2, py + (rnd() - .5) * TD.LANE * 2, 1 + rnd() * 2.5, 0, 7); g.fill(); }
  // courtyard around the keep
  g.fillStyle = '#8c877c'; g.beginPath(); g.ellipse(Lo.base.x, Lo.base.y, 170, 120, 0, 0, 7); g.fill(); g.strokeStyle = '#6a665e'; g.lineWidth = 6; g.stroke();
  g.restore();
  // build grid overlay at half resolution: lines + red tint on cells you can't build on
  const k = 0.5, gc = document.createElement('canvas'); gc.width = W * k; gc.height = H * k; const gg = gc.getContext('2d'); gridBg = gc; gg.scale(k, k);
  gg.fillStyle = 'rgba(220,60,40,.28)'; for (let r = 0; r < Lo.rows; r++) for (let cc = 0; cc < Lo.cols; cc++) if (Lo.blocked[r * Lo.cols + cc]) gg.fillRect(cc * CELL, r * CELL, CELL, CELL);
  gg.strokeStyle = 'rgba(255,255,255,.22)'; gg.lineWidth = 1.4; gg.beginPath(); for (let cc = 0; cc <= Lo.cols; cc++) { gg.moveTo(cc * CELL, 0); gg.lineTo(cc * CELL, Lo.rows * CELL); } for (let r = 0; r <= Lo.rows; r++) { gg.moveTo(0, r * CELL); gg.lineTo(Lo.cols * CELL, r * CELL); } gg.stroke();
}
// trees and rocks are drawn live so towers can clear them; each variant is drawn once and reused
const TREE_SPR = new Map();
function treeSprite(v, rock) {
  const key = v + (rock ? 'r' : 't'); let s = TREE_SPR.get(key); if (s) return s;
  const c = document.createElement('canvas'), S = 2; c.width = 60 * S; c.height = 60 * S; const g = c.getContext('2d'); g.scale(S, S); g.translate(30, 40);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(6, 10, 18, 8, 0, 0, 7); g.fill();
  if (!rock) { const P = [['#2f5a2a', '#356a2e', '#3a7232', '#4a8a3a'], ['#2a5226', '#33622c', '#3e7834', '#4c8e3c'], ['#365e2a', '#3c6c30', '#447a34', '#56923e'], ['#2c5630', '#346634', '#3c7438', '#4a8840']][v]; g.fillStyle = '#5a3a20'; g.fillRect(-3, -2, 6, 12); [[0, -14, 18, P[0]], [-7, -8, 13, P[1]], [8, -9, 12, P[2]], [2, -18, 11, P[3]]].forEach(([ox, oy, r, cc]) => { g.fillStyle = cc; g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill(); }); }
  else { g.fillStyle = '#7d7a72'; g.beginPath(); g.moveTo(-14, 6); g.lineTo(-8, -8); g.lineTo(6, -10); g.lineTo(15, 4); g.closePath(); g.fill(); g.fillStyle = '#9a978d'; g.beginPath(); g.moveTo(-8, -8); g.lineTo(6, -10); g.lineTo(2, -1); g.closePath(); g.fill(); }
  s = { c, S }; TREE_SPR.set(key, s); return s;
}
function drawTree(tr) { const s = treeSprite(tr.v, tr.rock), z = tr.s; x.drawImage(s.c, tr.x - 30 * z, tr.y - 40 * z, 60 * z, 60 * z); }

// ---------- ground layer for blood and bodies (tiles created where needed) ----------
const TILE = 256, TS = 1.5;
function tileAt(tx, ty) { const key = tx + ',' + ty; let t = V.tiles.get(key); if (!t) { const c = document.createElement('canvas'); c.width = c.height = TILE * TS; t = { c, g: c.getContext('2d'), x: tx * TILE, y: ty * TILE, faded: V.clock || 0 }; V.tiles.set(key, t); } return t; }
function onGround(x0, y0, x1, y1, fn) { for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++) for (let tx = Math.max(0, Math.floor(x0 / TILE)); tx <= Math.floor(x1 / TILE); tx++) { const t = tileAt(tx, ty); t.g.setTransform(TS, 0, 0, TS, -t.x * TS, -t.y * TS); fn(t.g); t.g.globalAlpha = 1; } }
const BLOOD = ['#7a0f0f', '#8e1414', '#6a0a0a'];
function stain(px, py, r, col, alpha) { const blobs = []; for (let i = 0; i < 5; i++) { const a = rr(0, 6.28), d = rr(0, r * 0.7); blobs.push([px + Math.cos(a) * d, py + Math.sin(a) * d * 0.6, r * rr(0.4, 0.8), r * rr(0.25, 0.5), rr(0, 3)]); } onGround(px - r * 1.6, py - r * 1.2, px + r * 1.6, py + r * 1.2, g => { g.globalAlpha = alpha; g.fillStyle = col; g.beginPath(); for (const [bx, by, rx, ry, ro] of blobs) { g.moveTo(bx + rx, by); g.ellipse(bx, by, rx, ry, ro, 0, 7); } g.fill(); }); }

// ---------- soldier sprites (cached per kind/state/facing/pose/color) ----------
const SPR = new Map(), SS = 3, WALK = 24;
function soldier(c, k, r, step, bodyCol, face) {
  const ogre = k === 'brute', scout = k === 'runner';
  c.strokeStyle = '#2a1e16'; c.lineWidth = r * 0.35; c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * 0.3, r * 0.3); c.lineTo(-r * 0.3 + step * r * 0.35, r * 0.95); c.moveTo(r * 0.3, r * 0.3); c.lineTo(r * 0.3 - step * r * 0.35, r * 0.95); c.stroke();
  c.fillStyle = bodyCol; c.beginPath(); c.ellipse(0, 0, r * 0.75, r * 0.85, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(r * 0.2, r * 0.15, r * 0.5, r * 0.6, 0, 0, 7); c.fill();
  c.fillStyle = ogre ? '#9ab06a' : '#e8c39a'; c.beginPath(); c.arc(0, -r * 0.95, r * 0.5, 0, 7); c.fill();
  if (scout) { c.fillStyle = mix(bodyCol.startsWith('#') ? bodyCol : '#888888', '#000000', 0.35); c.beginPath(); c.moveTo(-r * 0.55, -r * 0.8); c.quadraticCurveTo(0, -r * 1.9, r * 0.55, -r * 0.8); c.lineTo(r * 0.3, -r * 1.05); c.lineTo(-r * 0.3, -r * 1.05); c.closePath(); c.fill(); }
  else { c.fillStyle = ogre ? '#4a4a52' : '#6a6a72'; c.beginPath(); c.arc(0, -r * 1.05, r * 0.52, Math.PI, 0); c.fill(); }
  if (ogre) { c.fillStyle = '#ddd'; c.beginPath(); c.moveTo(-r * 0.5, -r * 1.2); c.lineTo(-r * 0.75, -r * 1.65); c.lineTo(-r * 0.3, -r * 1.3); c.moveTo(r * 0.5, -r * 1.2); c.lineTo(r * 0.75, -r * 1.65); c.lineTo(r * 0.3, -r * 1.3); c.fill(); }
  c.save(); c.rotate(face * (0.4 + step * 0.2));
  if (ogre) { c.fillStyle = '#5a3a20'; c.fillRect(r * 0.6 * face - r * 0.15, -r * 1.2, r * 0.3, r * 1.6); c.fillStyle = '#9a9aa4'; c.fillRect(r * 0.6 * face - r * 0.55, -r * 1.4, r * 1.1, r * 0.7); }
  else if (scout) { c.strokeStyle = '#6a4a2a'; c.lineWidth = r * 0.18; c.beginPath(); c.arc(r * 0.7 * face, -r * 0.4, r * 0.7, -1.2, 1.2); c.stroke(); }
  else { c.fillStyle = '#c8c8d0'; c.fillRect(r * 0.7 * face - r * 0.14, -r * 1.1, r * 0.28, r * 1.3); }
  c.restore();
}
const STATE_COL = { flash: '#ffffff', slow: '#8ad0ff', burn: '#e8602a' };
function sprite(k, state, face, frame, col) {
  const key = k + state + face + frame + col; let s = SPR.get(key); if (s) return s;
  const r = TD.UNITS[k].r, size = Math.ceil(r * 4.4), c = document.createElement('canvas'); c.width = c.height = size * SS; const cx = c.getContext('2d');
  cx.scale(SS, SS); cx.translate(size / 2, size * 0.6);
  const body = state === 'dead' ? mix(col, '#3a2a22', 0.35) : STATE_COL[state] || col;
  soldier(cx, k, r, frame < 0 ? 0 : Math.sin(frame / WALK * Math.PI * 2), body, face);
  s = { c, size, oy: size * 0.6 }; SPR.set(key, s); return s;
}
function drawSprite(s, px, py, rot, c = X0) { const sz = s.size; if (!rot) { c.drawImage(s.c, px - sz / 2, py - s.oy, sz, sz); return; } c.save(); c.translate(px, py); c.rotate(rot); c.drawImage(s.c, -sz / 2, -s.oy, sz, sz); c.restore(); }

// ---------- towers: each fits inside its 2x2 cells (48x48), skinny bodies on wider bases ----------
// local box: x -24..24, y -24..24, ground at y +14
function towerBody(c, k, col, aim, now, kick, seed) {
  const dark = mix(col, '#000000', 0.35), light = mix(col, '#ffffff', 0.25);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(3, 16, 22, 7, 0, 0, 7); c.fill();
  if (k === 'archer') {
    // wooden four-post watchtower, two archers on the platform
    c.fillStyle = '#5a3d22'; c.beginPath(); c.ellipse(0, 14, 17, 5, 0, 0, 7); c.fill();
    const posts = [[-13, 15], [13, 15], [-9, 10], [9, 10]];
    c.strokeStyle = '#7a5530'; c.lineWidth = 3; c.lineCap = 'butt';
    for (const [px, py] of posts) { c.beginPath(); c.moveTo(px, py); c.lineTo(px * 0.75, -6); c.stroke(); }
    c.strokeStyle = '#5a3d22'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-12, 13); c.lineTo(9, -4); c.moveTo(12, 13); c.lineTo(-9, -4); c.moveTo(-12, 4); c.lineTo(12, 4); c.stroke();
    c.fillStyle = '#8a6238'; c.fillRect(-14, -9, 28, 5); c.fillStyle = '#6a4a28'; c.fillRect(-14, -4, 28, 2);
    c.fillStyle = '#9a7244'; for (let i = -13; i <= 11; i += 4) c.fillRect(i, -15, 2.4, 6); c.fillRect(-14, -15, 28, 1.6);
    for (const sx of [-6, 6]) { // archers
      c.save(); c.translate(sx, -13);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 3.4, 3, 0, 0, 7); c.fill();
      c.fillStyle = '#e8c39a'; c.beginPath(); c.arc(0, -4.2, 2.2, 0, 7); c.fill(); c.fillStyle = dark; c.beginPath(); c.arc(0, -4.8, 2.3, Math.PI, 0); c.fill();
      c.rotate(aim + (sx < 0 ? 0.05 : -0.05)); c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.2; c.beginPath(); c.arc(3.5 - kick * 1.5, 0, 3.6, -1.3, 1.3); c.stroke();
      c.restore();
    }
    c.fillStyle = '#3a2a1a'; c.fillRect(-14, -24, 1.4, 10); c.fillStyle = col; c.beginPath(); c.moveTo(-12.6, -24); c.lineTo(-5, -21.5); c.lineTo(-12.6, -19); c.fill();
  } else if (k === 'cannon') {
    // bombard: wide round plinth, slim stone column, swivel gun on top
    c.fillStyle = '#6e6b64'; c.beginPath(); c.ellipse(0, 13, 20, 7, 0, 0, 7); c.fill(); c.fillStyle = '#8f8c84'; c.fillRect(-20, 8, 40, 5); c.beginPath(); c.ellipse(0, 8, 20, 7, 0, 0, 7); c.fill();
    c.fillStyle = col; c.fillRect(-20, 9, 40, 2.5);
    c.fillStyle = '#9a978f'; c.fillRect(-7, -8, 14, 17); c.fillStyle = '#7d7a72'; c.fillRect(3, -8, 4, 17); c.strokeStyle = '#6a675f'; c.lineWidth = 0.8; for (let y = -4; y < 8; y += 4) { c.beginPath(); c.moveTo(-7, y); c.lineTo(7, y); c.stroke(); }
    c.fillStyle = col; c.beginPath(); c.ellipse(0, -8, 10, 4, 0, 0, 7); c.fill(); c.fillStyle = '#4a4e56'; c.beginPath(); c.ellipse(0, -10, 8, 3.4, 0, 0, 7); c.fill();
    c.save(); c.translate(0, -12); c.rotate(aim); c.fillStyle = '#2a2d33'; c.fillRect(-4 - kick * 2, -3.4, 18, 6.8); c.fillStyle = '#1a1c20'; c.beginPath(); c.arc(14 - kick * 2, 0, 3.6, 0, 7); c.fill(); c.fillStyle = '#4a4e56'; c.beginPath(); c.arc(-3, 0, 4.5, 0, 7); c.fill(); c.restore();
  } else if (k === 'frost') {
    // frost obelisk: rune-carved hexagonal base, slender ice shard, orbiting slivers
    c.fillStyle = '#5a6a78'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; c.lineTo(Math.cos(a) * 18, 12 + Math.sin(a) * 6); } c.closePath(); c.fill();
    c.fillStyle = '#7a8a98'; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; c.lineTo(Math.cos(a) * 15, 9 + Math.sin(a) * 5); } c.closePath(); c.fill();
    c.fillStyle = col; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.5; c.fillRect(Math.cos(a) * 13 - 1.5, 9 + Math.sin(a) * 4.5 - 1.5, 3, 3); }
    const g = c.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#e8f8ff'); g.addColorStop(0.5, '#9ad8f4'); g.addColorStop(1, '#5aa8d8');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -24); c.lineTo(6, -6); c.lineTo(4, 9); c.lineTo(-4, 9); c.lineTo(-6, -6); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(0, -22); c.lineTo(-2.5, -6); c.lineTo(-1, 6); c.lineTo(0.5, -6); c.closePath(); c.fill();
    for (let i = 0; i < 3; i++) { const a = now * 1.4 + i * 2.094, sx = Math.cos(a) * 12, sy = -8 + Math.sin(a) * 4; c.fillStyle = Math.sin(a) > 0 ? '#d8f4ff' : '#9ad0ec'; c.beginPath(); c.moveTo(sx, sy - 4); c.lineTo(sx + 1.8, sy); c.lineTo(sx, sy + 4); c.lineTo(sx - 1.8, sy); c.closePath(); c.fill(); }
  } else if (k === 'flame') {
    // fire brazier: iron tripod, slim pole, fire bowl with hanging colored cloths
    c.strokeStyle = '#2a2622'; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-15, 15); c.lineTo(0, -2); c.moveTo(15, 15); c.lineTo(0, -2); c.moveTo(0, 11); c.lineTo(0, -2); c.stroke();
    c.fillStyle = '#3a3430'; c.beginPath(); c.ellipse(0, 13, 6, 2.4, 0, 0, 7); c.fill();
    c.fillStyle = '#3a3430'; c.fillRect(-1.6, -12, 3.2, 12);
    c.fillStyle = col; c.beginPath(); c.moveTo(-9, -12); c.lineTo(-7, 0); c.lineTo(-5, -12); c.fill(); c.beginPath(); c.moveTo(5, -12); c.lineTo(7, -1); c.lineTo(9, -12); c.fill();
    c.fillStyle = '#4a423c'; c.beginPath(); c.moveTo(-11, -15); c.lineTo(11, -15); c.lineTo(7, -10); c.lineTo(-7, -10); c.closePath(); c.fill(); c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(0, -15, 11, 3, 0, 0, 7); c.fill();
    const f = 0.8 + 0.2 * Math.sin(now * 17 + seed);
    c.fillStyle = '#ff6a1a'; c.beginPath(); c.moveTo(-8, -15); c.quadraticCurveTo(-3, -26 * f, 0, -24 * f - 1); c.quadraticCurveTo(4, -27 * f, 8, -15); c.fill();
    c.fillStyle = '#ffd36a'; c.beginPath(); c.moveTo(-4, -15); c.quadraticCurveTo(0, -22 * f, 4, -15); c.fill();
  } else {
    // tesla coil: dark octagonal base, lattice stem, stacked coils, big conductor sphere
    c.fillStyle = '#2e3238'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; c.lineTo(Math.cos(a) * 17, 12 + Math.sin(a) * 6); } c.closePath(); c.fill();
    c.fillStyle = '#454b54'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; c.lineTo(Math.cos(a) * 13, 8 + Math.sin(a) * 4.5); } c.closePath(); c.fill();
    c.fillStyle = col; c.fillRect(-13, 9, 26, 2);
    c.strokeStyle = '#6a7078'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, 8); c.lineTo(-2, -12); c.moveTo(4, 8); c.lineTo(2, -12); for (let y = 6; y > -12; y -= 4) { c.moveTo(-4 + (8 - y) * 0.1, y); c.lineTo(4 - (8 - y) * 0.1, y - 4); } c.stroke();
    for (const [y, w] of [[2, 9], [-4, 8], [-10, 7]]) { c.fillStyle = '#b07a3a'; c.beginPath(); c.ellipse(0, y, w, 2.4, 0, 0, 7); c.fill(); c.fillStyle = '#d89a4a'; c.beginPath(); c.ellipse(0, y - 0.8, w, 1.5, 0, 0, 7); c.fill(); }
    const hot = kick > 0.2;
    c.fillStyle = hot ? '#ffffff' : '#8a9aa8'; c.beginPath(); c.arc(0, -17, 6.5, 0, 7); c.fill(); c.fillStyle = hot ? '#bfe6ff' : '#c8d4dc'; c.beginPath(); c.arc(-2, -19, 2.6, 0, 7); c.fill();
    if (hot || Math.sin(now * 7 + seed * 3) > 0.92) { c.strokeStyle = '#bfe6ff'; c.lineWidth = 1; c.beginPath(); let px = 0, py = -17; for (let i = 0; i < 4; i++) { px += rr(-4, 4); py += rr(-3, 2); c.lineTo(px, py); } c.stroke(); }
  }
}
function drawTower(t, now, c = X0) {
  const building = t.readyAt && t.readyAt > now;
  c.save(); c.translate(t.x, t.y);
  if (building) drawConstruction(c, t, 1 - (t.readyAt - now) / TD.RULES.buildTime, now);
  else towerBody(c, t.k, t.col, t.aim, now, t.kick || 0, t.id || 0);
  c.restore();
}
// 3-second build: the tower's ghost, scaffold rising, a worker sawing a log
function drawConstruction(c, t, p, now) {
  c.globalAlpha = 0.22; towerBody(c, t.k, t.col, Math.PI / 2, now, 0, 0); c.globalAlpha = 1;
  c.fillStyle = 'rgba(90,70,40,.5)'; c.beginPath(); c.ellipse(0, 13, 20, 7, 0, 0, 7); c.fill();
  const h = 6 + p * 30; c.strokeStyle = '#8a6238'; c.lineWidth = 2;
  for (const sx of [-11, 11]) { c.beginPath(); c.moveTo(sx, 14); c.lineTo(sx, 14 - h); c.stroke(); }
  c.lineWidth = 1.2; for (let y = 10; y > 14 - h; y -= 7) { c.beginPath(); c.moveTo(-11, y); c.lineTo(11, y); c.stroke(); }
  // the log on two trestles and the saw going back and forth
  c.fillStyle = '#6a4a28'; c.fillRect(-14, 16, 2, 5); c.fillRect(-2, 16, 2, 5);
  c.fillStyle = '#a07040'; c.fillRect(-17, 13, 20, 4); c.fillStyle = '#d8b080'; c.beginPath(); c.ellipse(3, 15, 1.5, 2, 0, 0, 7); c.fill();
  const sw = Math.sin(now * 18) * 3; c.save(); c.translate(-8 + sw, 11); c.rotate(-0.25); c.fillStyle = '#c8ccd2'; c.fillRect(-5, -1, 10, 2.4); c.fillStyle = '#6a4a28'; c.fillRect(5, -1.6, 3, 3.6); c.restore();
  c.fillStyle = t.col; c.beginPath(); c.ellipse(-4 + sw, 6, 2.6, 2.4, 0, 0, 7); c.fill(); c.fillStyle = '#e8c39a'; c.beginPath(); c.arc(-4 + sw, 2.4, 1.8, 0, 7); c.fill();
  if (Math.random() < 0.3) particle('dust', t.x - 8 + sw, t.y + 13, 2, rr(-20, 20), rr(-5, 10), rr(20, 50), 0.4, '#d8b080', 1.2);
  // progress bar
  c.fillStyle = '#000a'; c.fillRect(-15, 20, 30, 4); c.fillStyle = '#ffd36b'; c.fillRect(-14, 21, 28 * Math.min(1, p), 2);
}
function drawBase() {
  const Lo = V.L, cx = Lo.base.x, cy = Lo.base.y - 20, fl = V.clock - V.baseFlash < 0.25;
  x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(cx, cy + 70, 120, 32, 0, 0, 7); x.fill();
  x.fillStyle = fl ? '#d8a0a0' : '#8c8a84'; x.fillRect(cx - 95, cy - 40, 190, 104);
  x.fillStyle = '#a4a29b'; for (let i = 0; i < 10; i++) x.fillRect(cx - 95 + i * 19.5, cy - 54, 13, 14);
  const cols = V.defs.map(d => colHex(d.color));
  [-1, 1].forEach((sx, i) => { x.fillStyle = '#9a978f'; x.fillRect(cx + sx * 95 - 20, cy - 74, 40, 138); x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(cx + sx * 95 - 25, cy - 74); x.lineTo(cx + sx * 95, cy - 112); x.lineTo(cx + sx * 95 + 25, cy - 74); x.fill(); });
  x.fillStyle = '#4a3020'; x.beginPath(); x.moveTo(cx - 24, cy + 64); x.lineTo(cx - 24, cy + 18); x.arc(cx, cy + 18, 24, Math.PI, 0); x.lineTo(cx + 24, cy + 64); x.fill();
  cols.forEach((col, i) => { const bx = cx - (cols.length - 1) * 22 + i * 44; x.fillStyle = '#3a2a1a'; x.fillRect(bx - 1, cy - 120, 3, 64); x.fillStyle = col; x.beginPath(); x.moveTo(bx + 2, cy - 120); x.lineTo(bx + 32, cy - 110); x.lineTo(bx + 2, cy - 100); x.fill(); });
  // hp bar over the keep
  const w = 200, p = V.hp / V.hpMax; x.fillStyle = '#000b'; x.fillRect(cx - w / 2 - 3, cy - 150, w + 6, 16); x.fillStyle = p > 0.5 ? '#6ae06a' : p > 0.25 ? '#f0c419' : '#e0503a'; x.fillRect(cx - w / 2, cy - 147, w * p, 10);
  x.font = '800 16px Inter'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(Math.ceil(V.hp) + ' / ' + V.hpMax, cx, cy - 156);
}
function drawCamp(L, i) {
  const gx = L.gate[0], gy = -60, col = V.atkCol;
  for (const [ox, oy, s] of [[-150, -150, 1], [140, -170, 0.9], [-200, -60, 0.8], [200, -70, 0.85], [-80, -230, 0.8], [90, -250, 0.75]]) { const tx = gx + ox, ty = gy + oy; if (tx < 20 || tx > V.world.W - 20) continue; x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(tx + 6, ty + 18 * s, 34 * s, 12 * s, 0, 0, 7); x.fill(); x.fillStyle = col; x.beginPath(); x.moveTo(tx - 32 * s, ty + 16 * s); x.lineTo(tx, ty - 26 * s); x.lineTo(tx + 32 * s, ty + 16 * s); x.fill(); x.fillStyle = mix(col, '#000000', 0.35); x.beginPath(); x.moveTo(tx, ty - 26 * s); x.lineTo(tx + 32 * s, ty + 16 * s); x.lineTo(tx + 8 * s, ty + 16 * s); x.fill(); x.fillStyle = '#2a1a10'; x.beginPath(); x.moveTo(tx - 7 * s, ty + 16 * s); x.lineTo(tx, ty); x.lineTo(tx + 7 * s, ty + 16 * s); x.fill(); }
  for (const sx of [-1, 1]) { const px = gx + sx * (TD.LANE + 20); x.fillStyle = '#4a3020'; x.fillRect(px - 5, gy - 80, 10, 90); x.fillStyle = col; x.fillRect(px - 16, gy - 74, 32, 44); x.fillStyle = mix(col, '#000000', 0.3); x.beginPath(); x.moveTo(px - 16, gy - 30); x.lineTo(px, gy - 20); x.lineTo(px + 16, gy - 30); x.fill(); }
  const D = V.defs[i]; if (D) { x.font = '800 22px Inter'; x.textAlign = 'center'; x.fillStyle = '#000a'; x.fillText(D.name + "'s lane", gx + 1, gy + 41); x.fillStyle = colHex(D.color); x.fillText(D.name + "'s lane", gx, gy + 40); }
}

// ---------- deaths & gore ----------
function particle(kind, px, py, pz, vx, vy, vz, life, col, size) { const o = (V.pool && V.pool.pop()) || {}; Object.assign(o, { p: 1, kind, x: px, y: py, z: pz, vx, vy, vz, life: 0, max: life, col, size, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, gib: 0, rest: 0, baked: 0, shape: null }); V.parts.push(o); return o; }
function bleed(px, py, dirx, diry, n, force) { for (let i = 0; i < n; i++) { const a = Math.atan2(diry, dirx) + rr(-0.9, 0.9), s = rr(20, 90) * force; particle('blood', px, py, rr(2, 8), Math.cos(a) * s, Math.sin(a) * s * 0.7, rr(30, 140) * force, 2, null, rr(0.8, 2)); } }
function die(u, type, sx, sy) {
  const X = u.x, Y = u.y, face = Math.cos(u.a) >= 0 ? 1 : -1, dx = X - sx, dy = Y - sy, l = Math.hypot(dx, dy) || 1, nx = dx / l, ny = dy / l;
  const base = { x: X, y: Y, r: u.r, k: u.k, face, t: 0 };
  (V.deadBars || (V.deadBars = [])).push({ x: X, y: Y, r: u.r, t: V.clock || 0 });
  if (type === 'blast') {
    const power = rr(220, 340);
    for (const [shape, ox, oy] of [['body', 0, 0], ['head', 0, -u.r * 0.95], ['leg', -u.r * 0.3, u.r * 0.6], ['leg', u.r * 0.3, u.r * 0.6], ['weapon', u.r * 0.8, -u.r * 0.4]]) { const ang = Math.atan2(ny, nx) + rr(-0.6, 0.6), s = power * rr(0.55, 1.1); V.parts.push({ shape, k: u.k, r: u.r, x: X + ox * 0.3, y: Y + oy * 0.2, z: u.r - oy, vx: Math.cos(ang) * s * 0.5, vy: Math.sin(ang) * s * 0.5, vz: rr(160, 300), rot: 0, vr: rr(-14, 14), life: 0, gib: 1 }); }
    bleed(X, Y, nx, ny, 12, 1.6); stain(X, Y, u.r * 2.2, BLOOD[0], 0.75);
  } else if (type === 'fire') { V.corpses.push(Object.assign(base, { kind: 'ash' })); stain(X, Y + u.r * 0.6, u.r * 1.6, '#1e1a16', 0.5); }
  else if (type === 'ice') { V.corpses.push(Object.assign(base, { kind: 'freeze' })); stain(X, Y + u.r * 0.6, u.r * 2, '#d8f2ff', 0.35); }
  else if (type === 'shock') { V.corpses.push(Object.assign(base, { kind: 'shock', dir: nx >= 0 ? 1 : -1 })); stain(X, Y + u.r * 0.6, u.r * 1.4, '#2a2420', 0.35); }
  else { const push = rr(55, 95) * (u.k === 'brute' ? 0.6 : 1), dir = nx >= 0 ? 1 : -1; V.corpses.push(Object.assign(base, { kind: 'flop', z: 0, vx: nx * push, vy: ny * push * 0.6, vz: rr(90, 150) * (u.k === 'brute' ? 0.7 : 1), rot: 0, vr: dir * rr(7, 11), dir, bounces: 0 })); bleed(X, Y - u.r, nx, ny, 6, 0.9); }
}
function stepFx(dt) {
  for (const u of V.units.values()) { const k = Math.min(1, dt * 5); u.dr += u.sp * ((u.f & 1) ? 0.5 : 1) * dt + u.err * k; u.err -= u.err * k; unitXY(u); if ((u.f & 2) && Math.random() < 0.25 && onScreen(u.x, u.y, 40)) particle('flame', u.x + rr(-u.r, u.r) * 0.6, u.y, rr(3, u.r * 1.6), rr(-8, 8), rr(-5, 5), rr(25, 50), rr(0.3, 0.5), '#ff9a2a', 0); }
  for (const t of V.towers) { t.kick = Math.max(0, (t.kick || 0) - dt * 4); if (t.readyAt && t.readyAt <= V.clock && !t.doneFx) { t.doneFx = 1; if (V.clock - t.readyAt < 1 && onScreen(t.x, t.y, 60)) V.fx.push({ k: 'build', x: t.x, y: t.y + 10, t0: V.clock, col: t.col }); } }
  for (let i = 0; i < V.beams.length; i += 2) { const t = V.towerMap.get(V.beams[i]), u = V.units.get(V.beams[i + 1]); if (t && u) t.aim = Math.atan2(u.y - t.y, u.x - t.x); }
  for (const s of V.shots) {
    s.age += dt; if (s.u && V.units.has(s.u.id)) { s.tx = s.u.x; s.ty = s.u.y; }
    const f = Math.min(1, s.age / Math.max(0.05, s.T)); s.x = s.sx + (s.tx - s.sx) * f; s.y = s.sy + 16 + (s.ty - s.sy - 16) * f; s.a = Math.atan2(s.ty - s.sy - 16, s.tx - s.sx); s.h = s.k === 'cannon' ? 22 + Math.sin(f * Math.PI) * 30 - f * 22 : 22 * (1 - f) + 6 * f;
    if (f >= 1) { s.done = 1; if (s.k === 'cannon') { V.fx.push({ k: 'boom', x: s.x, y: s.y, t0: V.clock }); stain(s.x, s.y, 16, '#2a2218', 0.35); for (let i = 0; i < 6; i++) particle('dirt', s.x, s.y, 2, rr(-90, 90), rr(-90, 90), rr(120, 240), rr(0.5, 0.9), '#6b5232', rr(2, 4)); } else if (s.k === 'frost') V.fx.push({ k: 'ice', x: s.x, y: s.y, t0: V.clock }); else if (!V.units.has(s.u.id)) { const ax = s.x, ay = s.y, aa = s.a; onGround(ax - 10, ay - 10, ax + 10, ay + 10, g => { g.save(); g.translate(ax, ay); g.rotate(aa); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-7, -2); g.lineTo(2, 0); g.stroke(); g.restore(); }); } else if (Math.random() < 0.5) bleed(s.tx, s.ty - s.u.r, Math.cos(s.a), Math.sin(s.a), 2, 0.6); }
  }
  V.shots = V.shots.filter(s => !s.done);
  V.fx = V.fx.filter(f => V.clock - f.t0 < (f.k === 'boom' ? 0.45 : f.k === 'bolt' ? 0.22 : f.k === 'leak' ? 1.2 : f.k === 'build' ? 0.6 : 0.35));
  V.pool = V.pool || [];
  for (const p of V.parts) {
    p.life += dt;
    if (p.p) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt; if (p.kind === 'blood') { p.vz -= 700 * dt; if (p.z <= 0) { stain(p.x, p.y, p.size * 2.2, BLOOD[(p.x | 0) % 3], 0.8); p.life = p.max; } } else { p.vz -= (p.kind === 'ash' || p.kind === 'flame' ? -10 : 420) * dt; if (p.z < 0) p.z = 0; if (p.kind === 'ash') p.vx += Math.sin(p.life * 6 + p.rot) * 30 * dt; } continue; }
    if (p.rest) continue;
    p.vz -= 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.gib && p.z > 4 && Math.random() < 0.35) particle('blood', p.x, p.y, p.z, p.vx * 0.2, p.vy * 0.2, 0, 1.5, null, rr(0.7, 1.4));
    if (p.z <= 0) { p.z = 0; if (p.vz < -90) { p.vz = -p.vz * 0.35; p.vx *= 0.55; p.vy *= 0.55; p.vr *= 0.5; if (p.gib) stain(p.x, p.y, p.r * 0.9, BLOOD[1], 0.7); } else { p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; p.vr *= 0.6; if (Math.abs(p.vx) + Math.abs(p.vy) < 8) p.rest = 1; } }
  }
  for (const p of V.parts) if (!p.p && p.rest && !p.baked) { p.baked = 1; const m = (p.r || p.size || 6) * 2; onGround(p.x - m, p.y - m, p.x + m, p.y + m, g => drawGib(p, g)); }
  V.parts = V.parts.filter(p => { if (p.baked) return false; if (p.p && p.life >= p.max) { V.pool.push(p); return false; } return p.p || p.life < 8; });
  if (V.parts.length > 2500) V.parts.splice(0, V.parts.length - 2500);
  for (const c of V.corpses) {
    c.t += dt;
    if (c.kind === 'flop' && !c.rest) { c.vz -= 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.rot += c.vr * dt; if (c.z <= 0) { c.z = 0; if (c.vz < -70 && c.bounces < 3) { c.bounces++; c.vz = -c.vz * 0.38; c.vx *= 0.5; c.vy *= 0.5; c.vr = c.vr * -0.35 + c.dir * rr(2, 5); stain(c.x, c.y + c.r * 0.5, c.r * 0.9, BLOOD[2], 0.5); } else { c.vz = 0; c.vx *= 0.82; c.vy *= 0.82; const lie = c.dir * Math.PI / 2, d = lie - c.rot; c.rot += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 10); if (Math.abs(c.vx) + Math.abs(c.vy) < 4) { c.rest = 1; c.rot = lie; stain(c.x, c.y + c.r * 0.4, c.r * 1.8, BLOOD[0], 0.55); } } } }
    if (c.kind === 'ash' && c.t > 0.35 && c.t < 1.2 && Math.random() < 0.6) particle('ash', c.x + rr(-c.r, c.r) * 0.7, c.y, rr(0, c.r * 2.2) * (1 - (c.t - 0.35) / 0.85), rr(-15, 15), rr(-8, 8), rr(25, 60), rr(0.8, 1.5), Math.random() < 0.25 ? '#ff8a2a' : '#3a3530', rr(1, 2.2));
    if (c.kind === 'freeze' && c.t > 0.45 && !c.shattered) { c.shattered = 1; for (let i = 0; i < 7; i++) { const a = rr(0, 6.28), s = rr(40, 110); V.parts.push({ shape: 'shard', x: c.x, y: c.y, z: rr(2, c.r * 2), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rr(80, 200), rot: rr(0, 6), vr: rr(-12, 12), life: 0, size: rr(2, 4) * c.r / 6 }); } }
  }
  for (const c of V.corpses) if (!c.baked && ((c.kind === 'flop' && c.rest && c.t > 0.3) || (c.kind === 'shock' && c.t > 0.9))) { c.baked = 1; const m = c.r * 3; onGround(c.x - m, c.y - m, c.x + m, c.y + m, g => drawSprite(sprite(c.k, 'dead', c.face, -1, V.atkCol), c.x, c.y + c.r * 0.3, c.kind === 'flop' ? c.rot : c.dir * Math.PI / 2, g)); }
  V.corpses = V.corpses.filter(c => !c.baked && c.t < (c.kind === 'ash' ? 1.3 : c.kind === 'freeze' ? 0.5 : 6));
  if (V.corpses.length > 300) V.corpses.splice(0, V.corpses.length - 300);
  if (!V.fadeQ || !V.fadeQ.length) V.fadeQ = [...V.tiles.values()];
  for (let n = 0; n < 2 && V.fadeQ.length; n++) { const t = V.fadeQ.pop(), el = V.clock - t.faded; if (el < 1) continue; t.faded = V.clock; t.g.setTransform(1, 0, 0, 1, 0, 0); t.g.globalCompositeOperation = 'destination-out'; t.g.fillStyle = `rgba(0,0,0,${Math.min(0.5, 0.025 * el)})`; t.g.fillRect(0, 0, t.c.width, t.c.height); t.g.globalCompositeOperation = 'source-over'; }
}
function drawCorpse(c) {
  const r = c.r; x.globalAlpha = Math.max(0, Math.min(1, 6 - c.t));
  if (c.kind === 'flop') drawSprite(sprite(c.k, 'dead', c.face, -1, V.atkCol), c.x, c.y + r * 0.3 - c.z, c.rot);
  else if (c.kind === 'shock') { const tt = Math.max(0, c.t - 0.4), fall = Math.min(1, tt / 0.28); if (c.t < 0.4) drawSprite(sprite(c.k, Math.floor(c.t * 30) % 2 ? 'flash' : 'slow', c.face, -1, V.atkCol), c.x + rr(-1, 1), c.y, 0); else drawSprite(sprite(c.k, 'dead', c.face, -1, V.atkCol), c.x, c.y + r * 0.3, c.dir * Math.PI / 2 * fall * fall); }
  else if (c.kind === 'ash') { const charT = Math.min(1, c.t / 0.35), crumble = Math.max(0, (c.t - 0.35) / 0.85); x.save(); x.translate(c.x, c.y); x.beginPath(); x.rect(-r * 2, -r * 2.2 + crumble * r * 3.2, r * 4, r * 4); x.clip(); soldier(x, c.k, r, 0, mix(V.atkCol, '#1a1614', charT), c.face); x.restore(); }
  else if (c.kind === 'freeze') { x.save(); x.translate(c.x, c.y); soldier(x, c.k, r, 0, mix(V.atkCol, '#bfe8ff', Math.min(1, c.t / 0.15)), c.face); x.globalAlpha = 0.5; x.fillStyle = '#e8f8ff'; x.beginPath(); x.moveTo(-r, r); x.lineTo(-r * 1.1, -r * 0.6); x.lineTo(-r * 0.2, -r * 1.9); x.lineTo(r * 0.9, -r * 0.9); x.lineTo(r, r); x.closePath(); x.fill(); x.restore(); }
  x.globalAlpha = 1;
}
function drawGib(p, c = X0) {
  const r = p.r; c.globalAlpha = Math.max(0, Math.min(1, 8 - p.life));
  c.save(); c.translate(p.x, p.y - p.z); c.rotate(p.rot);
  if (p.shape === 'body') { c.fillStyle = mix(V.atkCol, '#4a1010', 0.3); c.beginPath(); c.ellipse(0, 0, r * 0.75, r * 0.85, 0, 0, 7); c.fill(); c.fillStyle = BLOOD[1]; c.beginPath(); c.ellipse(0, -r * 0.6, r * 0.5, r * 0.25, 0, 0, 7); c.fill(); }
  else if (p.shape === 'head') { c.fillStyle = p.k === 'brute' ? '#9ab06a' : '#e8c39a'; c.beginPath(); c.arc(0, 0, r * 0.5, 0, 7); c.fill(); c.fillStyle = BLOOD[0]; c.fillRect(-r * 0.3, r * 0.35, r * 0.6, r * 0.2); }
  else if (p.shape === 'leg') { c.strokeStyle = '#2a1e16'; c.lineWidth = r * 0.35; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -r * 0.35); c.lineTo(0, r * 0.35); c.stroke(); c.fillStyle = BLOOD[1]; c.beginPath(); c.arc(0, -r * 0.4, r * 0.2, 0, 7); c.fill(); }
  else if (p.shape === 'weapon') { c.fillStyle = p.k === 'brute' ? '#9a9aa4' : '#c8c8d0'; c.fillRect(-r * 0.14, -r * 0.65, r * 0.28, r * 1.3); }
  else if (p.shape === 'shard') { c.fillStyle = '#d8f4ff'; c.beginPath(); c.moveTo(0, -p.size); c.lineTo(p.size * 0.6, p.size * 0.4); c.lineTo(-p.size * 0.5, p.size * 0.6); c.closePath(); c.fill(); }
  c.restore(); c.globalAlpha = 1;
}

// ---------- camera & input ----------
const cam = { x: 600, y: 600, z: 0.7 };
function resize() { VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; clampCam(); }
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 250));
const minZ = () => V ? Math.max(0.1, Math.min(VW / V.world.W, VH / (V.world.H + TD.STAGE_H)) * 0.95) : 0.3;
function clampCam() { if (!V) return; cam.z = Math.max(minZ(), Math.min(2.5, cam.z)); const hw = VW / 2 / cam.z, hh = VH / 2 / cam.z, W = V.world.W, top = -TD.STAGE_H, H = V.world.H; cam.x = hw * 2 > W ? W / 2 : Math.max(hw, Math.min(W - hw, cam.x)); cam.y = hh * 2 > H - top ? (top + H) / 2 : Math.max(top + hh, Math.min(H - hh, cam.y)); }
function resetCamera() { if (V.myDef) { cam.z = Math.min(1.1, VW > VH ? VW / 1100 : VH / 1250); const p = V.L.lanes[V.myDef.slot].at(500); cam.x = p[0]; cam.y = p[1]; } else { cam.z = minZ(); cam.x = V.world.W / 2; cam.y = (V.world.H - TD.STAGE_H) / 2; } clampCam(); }
function lookAtLane(slot) { const L2 = V.L.lanes[slot]; if (!L2) return; cam.z = Math.max(cam.z, Math.min(1, Math.max(VW, VH * 0.75) / 1300)); const p = L2.at(400); cam.x = p[0]; cam.y = p[1]; clampCam(); }
const s2w = (sx, sy) => [cam.x + (sx - VW / 2) / cam.z, cam.y + (sy - VH / 2) / cam.z];
const onScreen = (px, py, m) => { const hw = VW / 2 / cam.z + m, hh = VH / 2 / cam.z + m; return Math.abs(px - cam.x) < hw && Math.abs(py - cam.y) < hh; };
const ptrs = new Map(); let pinch0 = null, tap = null;
cv.addEventListener('pointerdown', e => { if (build.drag) return; try { cv.setPointerCapture(e.pointerId); } catch (er) { } ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 1) tap = { x: e.clientX, y: e.clientY }; else tap = null; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z }; } });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; if (ptrs.size === 1) { cam.x -= (e.clientX - p[0]) / cam.z; cam.y -= (e.clientY - p[1]) / cam.z; clampCam(); if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null; } ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; cam.z = pinch0.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0.d; clampCam(); } });
const pup = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; if (tap && e.type === 'pointerup' && ptrs.size === 0) onTap(...s2w(e.clientX, e.clientY)); tap = null; };
cv.addEventListener('pointerup', pup); cv.addEventListener('pointercancel', pup);
cv.addEventListener('wheel', e => { e.preventDefault(); const before = s2w(e.clientX, e.clientY); cam.z *= e.deltaY > 0 ? 0.9 : 1.1; clampCam(); const after = s2w(e.clientX, e.clientY); cam.x += before[0] - after[0]; cam.y += before[1] - after[1]; clampCam(); }, { passive: false });
function onTap(wx, wy) {
  if (!V || V.over) return;
  const t = V.towers.find(t => Math.abs(t.x - wx) < CELL && Math.abs(t.y - wy) < CELL);
  if (t) { V.sel = { tower: t.id }; return showTowerSheet(t); }
  V.sel = null; hideSheet();
}

// ---------- build mode: drag a tower from the tray onto the grid ----------
const build = { on: false, drag: null };
function setBuild(on) {
  build.on = !!on && !!(V && V.myDef) && !(V && V.over); build.drag = null;
  $('buildBtn').classList.toggle('on', build.on); $('buildBtn').innerHTML = build.on ? '✕ Done' : '🔨 Build';
  $('buildTray').classList.toggle('hidden', !build.on); if (build.on) { hideSheet(); renderTray(true); }
}
$('buildBtn').onclick = () => setBuild(!build.on);
function renderTray(force) {
  if (!build.on || !V || !V.myDef) return; const T = $('buildTray'), D = V.myDef, key = TD.TOWER_IDS.map(k => D.gold >= TD.TOWERS[k].cost ? 1 : 0).join('');
  if (!force && T.dataset.key === key) return; T.dataset.key = key;
  T.innerHTML = `<div class="sheetHead"><b>Drag a tower onto the field</b><span class="muted small">Drop it back here to cancel</span></div><div class="cards">${TD.TOWER_IDS.map(k => `<button class="card" data-tw="${k}" ${D.gold < TD.TOWERS[k].cost ? 'disabled' : ''} title="${esc(TD.TOWERS[k].d)}"><span data-prev="${k}"></span><b>${TD.TOWERS[k].n}</b><span class="cost">${TD.TOWERS[k].cost}g</span></button>`).join('')}</div>`;
  T.querySelectorAll('[data-prev]').forEach(s => s.replaceWith(previewCanvas(g => { g.translate(42, 33); g.scale(1.15, 1.15); towerBody(g, s.dataset.prev, colHex(D.color), 0.6, V.clock || 0, 0, 1); })));
  T.querySelectorAll('[data-tw]').forEach(b => b.onpointerdown = e => { if (b.disabled) return; e.preventDefault(); startDrag(b.dataset.tw, e); });
}
function startDrag(k, e) {
  build.drag = { k, sx: e.clientX, sy: e.clientY, touch: e.pointerType !== 'mouse', id: e.pointerId };
  moveDrag(e);
  window.addEventListener('pointermove', moveDrag); window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', cancelDrag);
}
function dragCell(e) { const off = build.drag.touch ? 70 : 0, [wx, wy] = s2w(e.clientX, e.clientY - off); return [Math.round(wx / CELL - FOOT / 2), Math.round(wy / CELL - FOOT / 2), wx, wy]; }
function moveDrag(e) { const d = build.drag; if (!d) return; d.x = e.clientX; d.y = e.clientY; const [c, r] = dragCell(e); d.c = c; d.r = r; d.overTray = !!document.elementFromPoint(e.clientX, e.clientY)?.closest('#buildTray'); d.ok = !d.overTray && TD.footFree(V.L, c, r, V.occ) && V.myDef.gold >= TD.TOWERS[d.k].cost; }
function endDrag(e) { const d = build.drag; stopDragListeners(); if (!d) return; moveDrag(e); build.drag = null; if (d.overTray) return; if (d.ok) { send({ c: 'build', k: d.k, c2: d.c, r: d.r }); for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) V.occ[(d.r + j) * V.L.cols + d.c + i] = 1; } else toast(V.myDef.gold < TD.TOWERS[d.k].cost ? 'Not enough gold' : "Can't build there"); }
function cancelDrag() { stopDragListeners(); build.drag = null; }
function stopDragListeners() { window.removeEventListener('pointermove', moveDrag); window.removeEventListener('pointerup', endDrag); window.removeEventListener('pointercancel', cancelDrag); }

// ---------- HUD ----------
const atkUI = { target: 'all', qty: 1 };
let sheetKind = null;
function hideSheet() { $('sheet').classList.add('hidden'); sheetKind = null; if (V) V.sel = null; if (V && V.myDef && !V.over) $('buildBtn').classList.remove('hidden'); }
function previewCanvas(draw) { const c = document.createElement('canvas'); c.width = 168; c.height = 124; const g = c.getContext('2d'); g.scale(2, 2); draw(g); return c; }
function showTowerSheet(t) {
  sheetKind = 'tower'; const sh = $('sheet'), mine = t.owner === myPid, T = TD.TOWERS[t.k], owner = V.defs[t.slot] || V.defs[0];
  sh.classList.remove('hidden'); $('buildBtn').classList.add('hidden');
  sh.innerHTML = `<div class="sheetHead"><b>${T.n}</b><span class="muted small">${esc(owner.name)} · ${t.kills} kills</span><button class="btn ghost sm x" data-close>✕</button></div>
    <p class="muted small" style="margin:0 0 8px">${esc(T.d)} Range ${T.r}.</p>
    ${mine ? `<div class="row"><span class="small muted">Target</span><div class="prios">${TD.PRIORITIES.map(p => `<button data-prio="${p}" class="${t.prio === p ? 'on' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div><button class="btn sm danger" data-sell style="margin-left:auto">Sell +${Math.floor(t.spent * TD.RULES.sell)}g</button></div>` : ''}`;
  sh.querySelector('[data-close]').onclick = hideSheet;
  sh.querySelectorAll('[data-prio]').forEach(b => b.onclick = () => { send({ c: 'prio', id: t.id, p: b.dataset.prio }); t.prio = b.dataset.prio; showTowerSheet(t); });
  const sb2 = sh.querySelector('[data-sell]'); if (sb2) sb2.onclick = () => { send({ c: 'sell', id: t.id }); hideSheet(); };
}
let hudT = 0;
function renderHUD(force) {
  if (!V) return; const now = performance.now(); if (!force && now - hudT < 150) return; hudT = now;
  const left = TD.RULES.length - V.t;
  $('clock').innerHTML = V.closed ? `⏱ Final push · ${V.units.size} left` : `⏱ ${fmtT(left)}`;
  $('hpChip').innerHTML = `🏰 <b style="color:${V.hp > V.hpMax * .5 ? '#9ff08a' : V.hp > V.hpMax * .25 ? '#f0c419' : '#ff7a6a'}">${Math.ceil(V.hp)}</b><small>/ ${V.hpMax}</small>`;
  $('waveChip').innerHTML = V.closed ? 'No more waves' : `Wave ${V.wave + 1} in <b>${fmtT(V.pulse)}</b>`;
  $('defChips').innerHTML = V.defs.map(d => `<div class="dchip ${d.pid === myPid ? 'me' : ''}" data-lane="${d.slot}"><span class="sw" style="background:${colHex(d.color)}"></span>${esc(d.name)}<span class="lv" style="color:var(--muted)">${d.kills} kills</span></div>`).join('') + `<div class="dchip" style="cursor:default"><span class="sw" style="background:${V.atkCol}"></span>${esc(V.atk.name)}<span class="lv" style="color:var(--muted)">attacker</span></div>`;
  $('defChips').querySelectorAll('[data-lane]').forEach(b => b.onclick = () => lookAtLane(+b.dataset.lane));
  const tb = $('topBar').getBoundingClientRect(), narrow = innerWidth <= 640; $('defChips').style.top = narrow ? (tb.bottom + 6) + 'px' : ''; $('ecoBar').style.top = narrow ? (tb.bottom + 6) + 'px' : '';
  if (V.myDef) { const D = V.myDef; $('ecoBar').innerHTML = `<div class="chip">💰 ${D.gold}<small>+${D.income}/s</small></div>`; renderTray(); }
  else if (V.isAtk) { $('ecoBar').innerHTML = ''; renderAtk(); }
  else $('ecoBar').innerHTML = '<div class="chip">Spectating</div>';
}
function renderAtk() {
  const A = V.atk, P = $('atkPanel'); P.classList.remove('hidden');
  const lanes = atkUI.target === 'all' ? V.defs.length : 1;
  const q = {}; for (const v of A.queue) { const k = TD.UNIT_IDS[Math.floor(v / 10)]; q[k] = (q[k] || 0) + 1; }
  const key = JSON.stringify([A.gold, A.income, A.investCost, A.speed, A.speedCost, atkUI, V.closed, q]);
  if (P.dataset.key === key) return; P.dataset.key = key;
  if (V.closed) { P.innerHTML = '<div class="qrow">Time is up. Your last units are on the field.</div>'; return; }
  P.innerHTML = `<div class="targets"><span class="small muted">Send to</span><button data-tg="all" class="${atkUI.target === 'all' ? 'on' : ''}">All lanes</button>${V.defs.map(d => `<button data-tg="${d.slot}" class="${atkUI.target === d.slot ? 'on' : ''}"><span class="sw" style="background:${colHex(d.color)}"></span>${esc(d.name)}</button>`).join('')}
    <span style="margin-left:auto" class="chip">💰 ${A.gold}<small>+${A.income}/s</small></span></div>
    <div class="cards">${TD.UNIT_IDS.map(k => { const cost = TD.UNITS[k].cost * lanes * atkUI.qty; return `<button class="card" data-unit="${k}" ${A.gold < cost ? 'disabled' : ''} title="${esc(TD.UNITS[k].d)}"><span data-uprev="${k}"></span><b>${TD.UNITS[k].n}${q[k] ? ' · ' + q[k] : ''}</b><span class="cost">${cost}g</span></button>`; }).join('')}</div>
    <div class="row"><div class="prios">${[1, 5, 10].map(n => `<button data-qty="${n}" class="${atkUI.qty === n ? 'on' : ''}">×${n}</button>`).join('')}</div>
      <button class="btn sm" data-speed ${A.speed >= TD.RULES.speedMax || A.gold < A.speedCost ? 'disabled' : ''} style="margin-left:auto" title="Units you send from now on move ${Math.round(TD.RULES.speedStep * 100)}% faster">${A.speed >= TD.RULES.speedMax ? '👢 Speed maxed' : `👢 Speed ${A.speed + 1}/${TD.RULES.speedMax} · ${A.speedCost}g`}</button>
      <button class="btn sm" data-invest ${A.gold < A.investCost ? 'disabled' : ''}>Invest ${A.investCost}g<small style="font-weight:600">&nbsp;+${Math.round(TD.RULES.investGain * V.defs.length * 10) / 10}/s</small></button></div>
    <div class="qrow">Next wave: ${Object.keys(q).length ? Object.entries(q).map(([k, n]) => n + ' ' + TD.UNITS[k].n).join(', ') : 'nothing queued yet'}</div>`;
  P.querySelectorAll('[data-uprev]').forEach(s => s.replaceWith(previewCanvas(g => { const S = sprite(s.dataset.uprev, 'n', 1, 0, V.atkCol), sz = 100 * S.size / (TD.UNITS.brute.r * 4.4); g.drawImage(S.c, 42 - sz / 2, 66 - sz * 0.72, sz, sz); })));
  P.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { atkUI.target = b.dataset.tg === 'all' ? 'all' : +b.dataset.tg; if (atkUI.target !== 'all') lookAtLane(atkUI.target); P.dataset.key = ''; renderAtk(); });
  P.querySelectorAll('[data-qty]').forEach(b => b.onclick = () => { atkUI.qty = +b.dataset.qty; P.dataset.key = ''; renderAtk(); });
  P.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => send({ c: 'send', k: b.dataset.unit, lane: atkUI.target, n: atkUI.qty }));
  const spb = P.querySelector('[data-speed]'); if (spb) spb.onclick = () => send({ c: 'speed' });
  const iv = P.querySelector('[data-invest]'); if (iv) iv.onclick = () => send({ c: 'invest' });
}
$('menuBtn').onclick = () => openModal(`<h2>Menu</h2><p class="muted">One finger drags the map, two fingers pinch to zoom.${V && V.myDef ? ' Tap Build, then drag a tower from the tray onto the grid (white cells = it fits). Tap a tower to set its target or sell it.' : ''}${V && V.isAtk ? ' Pick a lane, tap units to queue them; the queue marches out every ' + TD.RULES.pulse + ' seconds.' : ''}</p><div class="row"><button class="btn" id="mResume">Resume</button><button class="btn danger" id="mQuit">Leave match</button></div>`, () => { $('mResume').onclick = closeModal; $('mQuit').onclick = () => { closeModal(); quitGame(); }; });
function quitGame() { endGame(); V = null; $('atkPanel').classList.add('hidden'); if (L.mode === 'solo') { L.mode = null; show('menu'); renderMenu(); } else leaveLobby(); }
function showEnd() {
  if (!V || !V.over) return; const atkWin = V.over.winner === 'atk', won = V.isAtk ? atkWin : (V.me && !atkWin), st = V.stats;
  openModal(`<div class="eyebrow">${V.me ? (won ? 'Victory' : 'Defeat') : 'Match over'}</div><h2>${atkWin ? esc(V.atk.name) + ' broke the keep' : 'The keep held with ' + Math.ceil(V.hp) + ' HP'}</h2>
    ${st ? `<table class="stats"><tr><th>Defender</th><th>Kills</th><th>Towers</th><th>Damage</th></tr>${V.defs.map((d, i) => `<tr><td><span style="color:${colHex(d.color)}">■</span> ${esc(d.name)}</td><td>${st.defs[i].kills}</td><td>${st.defs[i].built}</td><td>${st.defs[i].dmg}</td></tr>`).join('')}</table>
    <p class="muted small">${esc(V.atk.name)} sent ${st.atk.sent} units; ${st.atk.leaked} reached the keep for ${st.atk.dmg} damage.</p>` : ''}
    <button class="btn primary" id="mBack">Back to menu</button>`, () => { $('mBack').onclick = () => { closeModal(); quitGame(); }; });
}

// ---------- frame ----------
let lastF = performance.now();
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ms - lastF) / 1000); lastF = ms;
  if (!GS.running || !V) return;
  V.clock = (V.clock || 0) + dt;
  if (V.deadBars && V.deadBars.length) V.deadBars = V.deadBars.filter(b => V.clock - b.t < 0.25);
  if (!V.over) stepFx(dt);
  if (GS.mode === 'client' && performance.now() - GS.lastNet > 6000) { $('netOv').classList.remove('hidden'); $('netTxt').textContent = 'Waiting for the host…'; } else $('netOv').classList.add('hidden');
  const z = cam.z, vx0 = cam.x - VW / 2 / z, vy0 = cam.y - VH / 2 / z, vx1 = cam.x + VW / 2 / z, vy1 = cam.y + VH / 2 / z, inView = (px, py, m) => px > vx0 - m && px < vx1 + m && py > vy0 - m && py < vy1 + m;
  x.setTransform(DPR, 0, 0, DPR, 0, 0); x.fillStyle = '#1a1712'; x.fillRect(0, 0, VW, VH);
  x.setTransform(DPR * z, 0, 0, DPR * z, -vx0 * DPR * z, -vy0 * DPR * z);
  const top = -TD.STAGE_H, sx = Math.max(0, vx0), sy = Math.max(top, vy0), ex = Math.min(V.world.W, vx1), ey = Math.min(V.world.H, vy1);
  if (ex > sx && ey > sy) x.drawImage(groundBg, sx, sy - top, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
  for (const t of V.tiles.values()) if (t.x < vx1 && t.x + TILE > vx0 && t.y < vy1 && t.y + TILE > vy0) x.drawImage(t.c, t.x, t.y, TILE, TILE);
  if (build.on && ex > sx && ey > Math.max(0, sy)) { const y0 = Math.max(0, sy); x.drawImage(gridBg, sx * 0.5, y0 * 0.5, (ex - sx) * 0.5, (ey - y0) * 0.5, sx, y0, ex - sx, ey - y0); }
  V.L.lanes.forEach((L2, i) => { if (inView(L2.gate[0], -150, 300)) drawCamp(L2, i); });
  if (V.sel && V.sel.tower) { const t = V.towerMap.get(V.sel.tower); if (t) { x.fillStyle = 'rgba(255,224,138,.08)'; x.strokeStyle = 'rgba(255,224,138,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(t.x, t.y, TD.TOWERS[t.k].r, 0, 7); x.fill(); x.stroke(); } }
  // drag preview: cells this tower would take light up white, or red where blocked
  const d = build.drag;
  if (d && !d.overTray && d.c !== undefined) { for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) { const cc = d.c + i, r = d.r + j, bad = cc < 0 || r < 0 || cc >= V.L.cols || r >= V.L.rows || V.L.blocked[r * V.L.cols + cc] || V.occ[r * V.L.cols + cc]; x.fillStyle = bad ? 'rgba(235,50,40,.78)' : d.ok ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)'; x.fillRect(cc * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); } x.strokeStyle = 'rgba(255,224,138,.5)'; x.lineWidth = 1.5; x.beginPath(); x.arc((d.c + 1) * CELL, (d.r + 1) * CELL, TD.TOWERS[d.k].r, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); for (const u of V.units.values()) if (inView(u.x, u.y, 20)) { x.moveTo(u.x + 3 + u.r * 1.1, u.y + u.r * 0.9); x.ellipse(u.x + 3, u.y + u.r * 0.9, u.r * 1.1, u.r * 0.45, 0, 0, 7); } x.fill();
  const list = [];
  for (const tr of V.L.trees) if (!V.treeGone.has(tr.id) && inView(tr.x, tr.y, 40)) list.push([tr.y, 4, tr]);
  list.push([V.L.base.y + 40, 5, null]);
  for (const t of V.towers) if (inView(t.x, t.y, 40)) list.push([t.y + 14, 0, t]);
  for (const u of V.units.values()) if (inView(u.x, u.y, 20)) list.push([u.y, 1, u]);
  for (const c of V.corpses) if (inView(c.x, c.y, 30)) list.push([c.y, 2, c]);
  for (const p of V.parts) if (!p.p && !p.rest && inView(p.x, p.y, 30)) list.push([p.y, 3, p]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, k, o] of list) {
    if (k === 0) drawTower(o, V.clock);
    else if (k === 1) { const ph = V.clock * o.sp / 6 + o.ph, fr = Math.floor(((ph / (Math.PI * 2)) % 1 + 1) % 1 * WALK), st = (o.f & 1) ? 'slow' : (o.f & 2) ? 'burn' : 'n'; drawSprite(sprite(o.k, st, Math.cos(o.a) >= 0 ? 1 : -1, fr, V.atkCol), o.x, o.y - Math.abs(Math.sin(ph)) * 1.5, 0); }
    else if (k === 2) drawCorpse(o); else if (k === 3) drawGib(o); else if (k === 4) drawTree(o); else if (inView(V.L.base.x, V.L.base.y, 200)) drawBase();
  }
  if (d && !d.overTray && d.c !== undefined) { x.globalAlpha = 0.75; x.save(); x.translate((d.c + 1) * CELL, (d.r + 1) * CELL); towerBody(x, d.k, colHex(V.myDef.color), -Math.PI / 2, V.clock, 0, 1); x.restore(); x.globalAlpha = 1; }
  if (z > 0.5) { x.fillStyle = '#000a'; for (const u of V.units.values()) if (u.hp < 100 && inView(u.x, u.y, 20)) x.fillRect(u.x - u.r * 1.3 - 0.5, u.y - u.r * 2.3 - 0.5, u.r * 2.6 + 1, 3); for (const u of V.units.values()) if (u.hp < 100 && inView(u.x, u.y, 20)) { x.fillStyle = u.hp > 40 ? '#6ae06a' : '#e0503a'; x.fillRect(u.x - u.r * 1.3, u.y - u.r * 2.3, u.r * 2.6 * u.hp / 100, 2); }
    if (V.deadBars && V.deadBars.length) { for (const b of V.deadBars) if (inView(b.x, b.y, 20)) { x.fillStyle = '#000'; x.fillRect(b.x - b.r * 1.3 - 0.5, b.y - b.r * 2.3 - 0.5, b.r * 2.6 + 1, 3); x.fillStyle = '#5a1a14'; x.fillRect(b.x - b.r * 1.3, b.y - b.r * 2.3, b.r * 2.6, 2); } } }
  for (let i = 0; i < V.beams.length; i += 2) { const t = V.towerMap.get(V.beams[i]), b = V.units.get(V.beams[i + 1]); if (!t || !b || !inView(t.x, t.y, 200)) continue; const fl = 0.7 + 0.3 * Math.sin(V.clock * 40); x.strokeStyle = `rgba(255,90,40,${0.45 * fl})`; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(t.x, t.y - 20); x.lineTo(b.x, b.y - b.r); x.stroke(); x.strokeStyle = '#fff0c0'; x.lineWidth = 2; x.stroke(); }
  for (const s of V.shots) { if (!inView(s.x, s.y, 20)) continue; if (s.k === 'cannon') { x.fillStyle = '#1e1e22'; x.beginPath(); x.arc(s.x, s.y - s.h + 6, 4.5, 0, 7); x.fill(); continue; } x.save(); x.translate(s.x, s.y - s.h + 16); x.rotate(s.a || 0); if (s.k === 'archer') { x.strokeStyle = '#3a2a1a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-8, 0); x.lineTo(6, 0); x.stroke(); x.fillStyle = '#ccc'; x.fillRect(5, -1.5, 3, 3); } else { x.fillStyle = '#c8f0ff'; x.beginPath(); x.moveTo(7, 0); x.lineTo(0, -3.5); x.lineTo(-5, 0); x.lineTo(0, 3.5); x.fill(); } x.restore(); }
  for (const p of V.parts) { if (!p.p || !inView(p.x, p.y, 20)) continue; const q = p.life / p.max; x.globalAlpha = 1 - q * q;
    if (p.kind === 'blood') { x.fillStyle = BLOOD[1]; x.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size); }
    else if (p.kind === 'ash' || p.kind === 'dust') { x.fillStyle = p.col; x.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size); }
    else if (p.kind === 'flame') { x.fillStyle = q < 0.4 ? '#ffe08a' : '#ff7a2a'; x.beginPath(); x.arc(p.x, p.y - p.z, 2.5 * (1 - q) + 0.8, 0, 7); x.fill(); }
    else { x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y - p.z, p.size * (1 - q * 0.5), 0, 7); x.fill(); } }
  x.globalAlpha = 1;
  for (const f of V.fx) {
    const dur = f.k === 'boom' ? 0.45 : f.k === 'bolt' ? 0.22 : f.k === 'leak' ? 1.2 : f.k === 'build' ? 0.6 : 0.35, p = (V.clock - f.t0) / dur; x.globalAlpha = Math.max(0, 1 - p);
    if (f.k === 'boom') { const r = f.small ? 0.5 : 1; x.fillStyle = '#ffb040'; x.beginPath(); x.arc(f.x, f.y, (10 + p * 40) * r, 0, 7); x.fill(); x.fillStyle = '#fff2b0'; x.beginPath(); x.arc(f.x, f.y, (6 + p * 18) * r, 0, 7); x.fill(); }
    else if (f.k === 'ice') { x.strokeStyle = '#bff0ff'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047; x.moveTo(f.x, f.y); x.lineTo(f.x + Math.cos(a) * (5 + p * 13), f.y + Math.sin(a) * (5 + p * 13)); } x.stroke(); }
    else if (f.k === 'bolt') { for (const [w, c] of [[5, 'rgba(120,200,255,.5)'], [2, '#ffffff']]) { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); f.pts.forEach((pt, i) => { if (!i) { x.moveTo(pt[0], pt[1]); return; } const a = f.pts[i - 1]; for (let k2 = 1; k2 <= 4; k2++) { const t = k2 / 4, j = k2 < 4 ? 6 : 0; x.lineTo(a[0] + (pt[0] - a[0]) * t + rr(-j, j), a[1] + (pt[1] - a[1]) * t + rr(-j, j)); } }); x.stroke(); } }
    else if (f.k === 'build') { x.strokeStyle = f.col; x.lineWidth = 3; x.beginPath(); x.ellipse(f.x, f.y, 14 + p * 26, (14 + p * 26) * 0.45, 0, 0, 7); x.stroke(); }
    else if (f.k === 'leak') { x.font = '900 30px Inter'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText('-' + f.n, f.x + 2, f.y - p * 40 + 2); x.fillStyle = '#ff5a4a'; x.fillText('-' + f.n, f.x, f.y - p * 40); }
    x.globalAlpha = 1;
  }
  renderHUD();
}
requestAnimationFrame(frame);


// ============================ BOOT ============================
function tryReload(v) { let tried = null; try { tried = sessionStorage.getItem('td_reload_for'); } catch (e) { } if (tried === v) return false; try { sessionStorage.setItem('td_reload_for', v); } catch (e) { } location.replace(location.pathname + '?v=' + v); return true; }
async function checkVersion() { if (BUILD === 'dev' || location.protocol === 'file:') return; try { const v = (await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json()).version; if (v && v !== BUILD && !GS.running && !L.mode) tryReload(v); } catch (e) { } }
setInterval(checkVersion, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
$('netLeave').onclick = () => { $('netOv').classList.add('hidden'); quitGame(); };
window.addEventListener('load', () => { $('ver').textContent = 'v' + VER; $('ver').title = 'build ' + BUILD; show('menu'); renderMenu(); checkVersion(); });
window.TDC = { get V() { return V; }, GS, L, get LS() { return LS; }, cam, send, req, onTap, lookAtLane, renderAtk, build, setBuild };
})();
