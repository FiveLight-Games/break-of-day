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
    <div class="lobbyList">${!dir.ready ? '<div class="spin"></div>' : dir.list.length ? dir.list.map(l => `<button class="lobbyItem" data-join="${esc(l.code)}"><div class="grow"><b>${esc(l.name)}</b><small class="muted">${esc(mapName(l.mode))} · ${esc(String(l.heroes || '').split('|')[0])} · host ${esc(l.host)}</small></div><span class="chip">${esc(String(l.heroes || '').split('|')[1] || l.joined + '/' + l.n)}</span></button>`).join('') : '<div class="empty">No open lobbies right now. Host one, or play vs AI.</div>'}</div>
    <div class="row" style="justify-content:space-between"><small class="muted">${esc(dir.err || 'Refreshes every 5 seconds')}</small><button class="btn ghost sm" data-act="home">Back</button></div>`;
  else if (homeScreen === 'search') m.innerHTML = `<div class="eyebrow">Find match</div><h2>Searching…</h2><div class="spin"></div><p class="muted" style="text-align:center">${esc(qm.status)}</p><button class="btn ghost" data-act="cancelSearch">Cancel</button>`;
  else if (homeScreen === 'joining') m.innerHTML = `<div class="eyebrow">Joining</div><h2>Joining lobby…</h2><div class="spin"></div><button class="btn ghost" data-act="cancelJoin">Cancel</button>`;
  else { const on = !!getSB(); m.innerHTML = `<div class="eyebrow">Play</div>
    <button class="btn primary big" data-act="find" ${on ? '' : 'disabled'}>Find Match<small>Join the next open lobby</small></button>
    <div class="row2"><button class="btn big" data-act="hostForm" ${on ? '' : 'disabled'}>Host Lobby</button><button class="btn big" data-act="browse" ${on ? '' : 'disabled'}>Browse Lobbies</button></div>
    <div class="row2"><button class="btn big" data-act="vsai">Defend vs AI<small>Hold your lane against an AI attacker</small></button><button class="btn big" data-act="atkai">Attack vs AI<small>Break through AI defenders</small></button></div>
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
  if (a === 'find' || a === 'browse' || a === 'hostForm') checkVersion(); // an out-of-date page can't see (or be seen by) players on the new version
  if (a === 'rename') { homeScreen = 'name'; return renderMenu(); }
  if (a === 'home') { stopBrowsing(); homeScreen = 'home'; return renderMenu(); }
  if (a === 'hostForm') { homeScreen = 'host'; return renderMenu(); }
  if (a === 'browse') { homeScreen = 'browse'; startBrowsing(); return renderMenu(); }
  if (a === 'find') { goFull(); return startQuick(); }
  if (a === 'cancelSearch') { stopQuick(); homeScreen = 'home'; return renderMenu(); }
  if (a === 'cancelJoin') { leaveLobby(); return; }
  if (a === 'vsai') { goFull(); return enterSolo('def'); }
  if (a === 'atkai') { goFull(); return enterSolo('atk'); }
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
const humanCap = () => LS.seats.filter(s => s !== 'ai').length;
const humansIn = () => L.players.length;
function lobbyRow() {
  const nd = LS.seats.slice(1).filter(Boolean).length;
  // the shared directory table only allows 1-4 seats, but a lobby here can hold 5 people (attacker + 4 defenders).
  // Store a value that keeps the open/full test right (joined < n means open), and put the real count in the text.
  const cap = humanCap(), j = Math.max(1, humansIn()), n = Math.min(4, cap), open = j < cap;
  return { code: L.code, name: (L.lobbyName || `${myName}'s Lobby`).slice(0, 40), host: myName.slice(0, 20), mode: LS.map, n, joined: open ? Math.min(j, n - 1) : n, heroes: ((LS.seats[0] === 'ai' ? 'vs AI attacker' : '1v' + Math.max(1, nd)) + '|' + j + '/' + cap).slice(0, 120), version: BUILD };
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
function freshLS() { return { map: 'greenvale', seats: [null, null, null, null, null], pl: {}, aiCol: {} }; }
// colours in use by players and AI seats (the AI attacker is always red)
function usedColors(exceptPid) { const u = new Set(Object.entries(LS.pl).filter(([q]) => q !== exceptPid).map(([, p]) => p.color)); if (LS.seats[0] === 'ai') u.add('red'); for (const [i, c] of Object.entries(LS.aiCol || {})) if (LS.seats[i] === 'ai') u.add(c); return u; }
const aiName = i => 'AI Defender' + (LS.seats.slice(1).filter(s => s === 'ai').length > 1 ? ' ' + i : '');
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
function enterSolo(role) {
  Object.assign(L, { mode: 'solo', started: false, code: null, lobbyName: role === 'atk' ? 'Attack vs AI' : 'Defend vs AI', quick: false, players: [{ pid: myPid, name: myName }] });
  LS = freshLS();
  if (role === 'atk') { LS.pl[myPid] = { name: myName, color: myColor, race: 'human', ready: true }; LS.seats[0] = myPid; LS.seats[1] = 'ai'; LS.aiCol[1] = TD.COLORS.find(c => c.id !== myColor).id; }
  else { LS.pl[myPid] = { name: myName, color: myColor === 'red' ? 'blue' : myColor, race: 'human', ready: true }; LS.seats[0] = 'ai'; LS.seats[1] = myPid; }
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
  if (r.a === 'seat') { const i = r.i | 0; if (i < 0 || i > 4 || LS.seats[i]) return; LS.seats = LS.seats.map(s => s === pid ? null : s); LS.seats[i] = pid; if (!host) me.ready = false; }
  else if (r.a === 'color') { if (!TD.COLORS.some(c => c.id === r.c) || usedColors(pid).has(r.c)) return; me.color = r.c; }
  else if (r.a === 'race') { if (!TD.RACES.some(x => x.id === r.race && x.on)) return; me.race = r.race; }
  else if (r.a === 'ready') me.ready = !!r.v;
  else if (host && r.a === 'map') { if (TD.MAPS.some(m => m.id === r.m && m.on)) LS.map = r.m; }
  else if (host && r.a === 'ai' && (r.i | 0) > 0) { const i = r.i | 0; if (i > 4) return; if (LS.seats[i] === 'ai') { LS.seats[i] = null; delete LS.aiCol[i]; } else if (!LS.seats[i]) { const used = usedColors(null); LS.seats[i] = 'ai'; LS.aiCol[i] = (TD.COLORS.find(c => c.id !== 'red' && !used.has(c.id)) || TD.COLORS[1]).id; } }
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
  if (s === 'ai' && i === 0) return `<div class="seat"><div class="sw" style="background:${colHex('red')}"></div><div class="grow"><b>AI Attacker</b><small class="muted">Human · Red</small></div>${isHost() && L.mode !== 'solo' ? '<button class="btn ghost sm" data-ai="0">Remove AI</button>' : '<span class="tag ok">Ready</span>'}</div>`;
  if (s === 'ai') { const c = LS.aiCol[i] || 'blue'; return `<div class="seat"><div class="sw" style="background:${colHex(c)}"></div><div class="grow"><b>${aiName(i)}</b><small class="muted">Human · ${(TD.COLORS.find(q => q.id === c) || {}).n || ''}</small></div>${isHost() ? `<button class="btn ghost sm" data-ai="${i}">Remove AI</button>` : '<span class="tag ok">Ready</span>'}</div>`; }
  if (!p) return `<div class="seat open" data-seat="${i}"><div class="sw" style="background:#0004"></div><div class="grow"><b>${i === 0 ? 'Open attacker seat' : 'Open defender seat'}</b><small>Tap to take this seat</small></div>${isHost() && (i > 0 || L.mode !== 'solo') ? `<button class="btn sm" data-ai="${i}">${i === 0 ? 'Add AI attacker' : 'Add AI'}</button>` : ''}</div>`;
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
  $('lobbyEyebrow').textContent = (L.mode === 'solo' ? 'Practice · 1v' + Math.max(1, nd) : (LS.seats[0] === 'ai' ? 'vs AI attacker' : '1v' + Math.max(1, nd))) + ' · ' + mapName(LS.map);
  $('lobbyTitle').textContent = L.mode === 'solo' ? L.lobbyName : (L.lobbyName || (((L.players.find(p => p.host) || {}).name) || myName) + "'s Lobby");
  $('mapPick').innerHTML = TD.MAPS.map(m => `<button class="mapCard ${LS.map === m.id ? 'on' : ''}" data-map="${m.id}" ${m.on && isHost() ? '' : 'disabled'}><div class="mapThumb" style="background:${m.on ? 'linear-gradient(135deg,#4f7a3a,#2f5a2a 60%,#b38f5c 61%,#b38f5c 66%,#4f7a3a 67%)' : '#2a2620'}"></div><b>${m.n}</b><small>${m.on ? (isHost() ? m.d : 'Host picks the map') : 'Coming soon'}</small></button>`).join('');
  $('seats').innerHTML = `<div class="seatHead">Attacker</div>${seatRow(0)}<div class="seatHead">Defenders</div>${[1, 2, 3, 4].map(seatRow).join('')}`;
  $('racePick').innerHTML = TD.RACES.map(r => `<button class="race ${me.race === r.id ? 'on' : ''}" data-race="${r.id}" ${r.on ? '' : 'disabled'}>${r.n}<small>${r.on ? 'Available' : 'Coming soon'}</small></button>`).join('');
  const taken = usedColors(myPid);
  $('colorPick').innerHTML = TD.COLORS.map(c => `<button class="swatch ${me.color === c.id ? 'on' : ''}" data-col="${c.id}" title="${c.n}" style="background:${c.c}" ${taken.has(c.id) ? 'disabled' : ''}></button>`).join('');
  const why = startable(), btn = $('btnReady');
  if (isHost()) { btn.textContent = L.mode === 'solo' ? 'Start' : 'Start match'; btn.disabled = !!why; btn.onclick = hostStart; $('lobbyHint').textContent = why || (L.mode === 'solo' ? (LS.seats[0] === myPid ? 'You attack the AI defenders. Add AI to more seats for a bigger fight (each lane gets its own AI).' : 'You defend; the AI attacks. Add AI defenders as teammates, or tap a seat to switch lanes.') : 'Ready to start. Keep this page open: your device runs the match.'); }
  else { btn.disabled = false; btn.textContent = me.ready ? 'Unready' : 'Ready'; btn.onclick = () => req({ a: 'ready', v: !me.ready }); $('lobbyHint').textContent = 'Tap an open seat to switch seats. The host starts the match.'; }
  $('btnLeave').textContent = L.mode === 'solo' ? 'Back' : L.mode === 'host' ? 'Close lobby' : 'Leave';
  $('btnLeave').onclick = () => { if (L.mode === 'solo') { L.mode = null; show('menu'); renderMenu(); } else leaveLobby(); };
  const lob = $('lobby');
  lob.querySelectorAll('[data-seat]').forEach(b => b.onclick = e => { if (e.target.closest('[data-ai]')) return; req({ a: 'seat', i: +b.dataset.seat }); });
  lob.querySelectorAll('[data-ai]').forEach(b => b.onclick = e => { e.stopPropagation(); req({ a: 'ai', i: +b.dataset.ai || 0 }); });
  lob.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => req({ a: 'kick', pid: b.dataset.kick }));
  lob.querySelectorAll('[data-map]').forEach(b => b.onclick = () => req({ a: 'map', m: b.dataset.map }));
  lob.querySelectorAll('[data-race]').forEach(b => b.onclick = () => req({ a: 'race', race: b.dataset.race }));
  lob.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { if (!isHost()) { myColor = b.dataset.col; store.set('color', myColor); } req({ a: 'color', c: b.dataset.col }); });
}
function hostStart() {
  if (startable()) return; goFull();
  const players = [];
  const a = LS.seats[0]; players.push(a === 'ai' ? { pid: 'ai', name: 'AI Attacker', role: 'atk', color: 'red', race: 'human', bot: 1 } : { pid: a, name: LS.pl[a].name, role: 'atk', color: LS.pl[a].color, race: LS.pl[a].race });
  LS.seats.slice(1).forEach((s, j) => { const i = j + 1; if (s === 'ai') players.push({ pid: 'aid' + i, name: aiName(i), role: 'def', color: LS.aiCol[i] || 'blue', race: 'human', bot: 1 }); else if (s && LS.pl[s]) players.push({ pid: s, name: LS.pl[s].name, role: 'def', color: LS.pl[s].color, race: LS.pl[s].race }); });
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
  closeModal(); show('game'); GS.running = true; GS.mode = mode; GS.lastNet = performance.now(); audioInit(); musicStart();
  const defs = cfg.players.filter(p => p.role === 'def'), atk = cfg.players.find(p => p.role === 'atk'), Lo = TD.layout(cfg.map, defs.length);
  V = { cfg, L: Lo, defs: defs.map((p, i) => Object.assign({ slot: i, gold: 0, income: 0, kills: 0 }, p)), atk: Object.assign({ gold: 0, income: 0, invest: 0, investCost: 0, queue: [] }, atk),
    world: { W: Lo.W, H: Lo.H }, units: new Map(), towers: [], towerMap: new Map(), beams: [], t: 0, pulse: TD.RULES.pulse, wave: 0, hp: TD.RULES.hpPer * defs.length, hpMax: TD.RULES.hpPer * defs.length, closed: false, over: null,
    shots: [], fx: [], corpses: [], parts: [], tiles: new Map(), sel: null, baseFlash: -9, treeGone: new Set(), occ: new Uint8Array(Lo.cols * Lo.rows), meteors: [], fields: [], jets: new Map(), rings: [], shake: 0 };
  V.me = cfg.players.find(p => p.pid === myPid) || null; V.myDef = V.defs.find(d => d.pid === myPid) || null; V.isAtk = V.atk.pid === myPid;
  V.atkCol = colHex(V.atk.color);
  atkUI.target = 'all'; atkUI.qty = 1; build.on = false; build.drag = null;
  buildGround(); resize(); resetCamera();
  setTimeout(() => { if (V && V.t < TD.RULES.setup) toast(V.isAtk ? 'Setup: you can send units in ' + TD.RULES.setup + 's' : 'Setup: ' + TD.RULES.setup + 's to build before the attacker can send'); }, 400);
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
function endGame() { musicStop(); hissLevel(0); buildLoop(false); GS.running = false; clearInterval(GS.timer); GS.timer = null; GS.sim = null; hideSheet(); setBuild(false); }
function send(c) { if (!GS.running) return; if (GS.mode === 'client') { if (L.ch) L.ch.send({ type: 'broadcast', event: 'in', payload: { pid: myPid, c } }); } else if (GS.sim) GS.sim.input(myPid, c); }

// ---------- snapshots ----------
function unitXY(u) { const p = V.L.lanes[u.l].at(u.dr); u.x = p[0] + Math.cos(p[2] + Math.PI / 2) * u.off; u.y = p[1] + Math.sin(p[2] + Math.PI / 2) * u.off; u.a = p[2]; }
function addUnit(id, ki, l, off, sp, d) { if (V.units.has(id) || !V.L.lanes[l]) return; const u = { id, k: TD.UNIT_IDS[ki], l, off, sp, dr: d, err: 0, hp: 100, f: 0, ph: Math.random() * 6, z: 0, vz: 0 }; u.r = TD.UNITS[u.k].r; unitXY(u); V.units.set(id, u); }
function clearTrees(t) { const x0 = t.c * CELL - 8, y0 = t.r * CELL - 8, x1 = (t.c + FOOT) * CELL + 8, y1 = (t.r + FOOT) * CELL + 8; for (const tr of V.L.trees) if (!V.treeGone.has(tr.id) && tr.x > x0 && tr.x < x1 && tr.y > y0 && tr.y < y1 + 10) { V.treeGone.add(tr.id); if (onScreen(tr.x, tr.y, 60)) for (let i = 0; i < 8; i++) particle('dirt', tr.x, tr.y, rr(4, 20), rr(-60, 60), rr(-40, 40), rr(60, 160), rr(0.4, 0.8), tr.rock ? '#8a877e' : '#3a6a2e', rr(2, 4)); } }
function applySnap(s) {
  V.t = s.t; V.pulse = s.pu; V.wave = s.wv; V.closed = !!s.cl;
  if (s.hp < V.hp) V.baseFlash = V.clock || 0; V.hp = s.hp;
  V.atk.gold = s.a[0]; V.atk.income = s.a[1]; V.atk.invest = s.a[2]; V.atk.investCost = s.a[3]; V.atk.queue = s.a[4]; V.atk.speed = s.a[5] || 0; V.atk.speedCost = s.a[6] || 0;
  s.df.forEach((d, i) => { const D = V.defs[i]; if (!D) return; D.gold = d[0]; D.income = d[1]; D.kills = d[2]; if (d[3]) { D.scdAt = D.scdAt || {}; TD.SPELL_IDS.forEach((k, j) => D.scdAt[k] = (V.clock || 0) + d[3][j] / 10); } });
  if (s.tw) {
    const old = new Map(V.towers.map(t => [t.id, t])); V.occ.fill(0);
    V.towers = s.tw.map(a => { const prev = old.get(a[0]), o = prev || { aim: Math.PI / 2, kick: 0, born: V.clock || 0 }; const D = V.defs[a[1]] || V.defs[0];
      if (!o.arch) o.arch = archerSlots(); o.lvl = a[11] || 1;
      Object.assign(o, { id: a[0], slot: a[1], k: TD.TOWER_IDS[a[2]], c: a[3], r: a[4], prio: TD.PRIORITIES[a[5]] || 'first', kills: a[6], spent: a[7], x: (a[3] + FOOT / 2) * CELL, y: (a[4] + FOOT / 2) * CELL, col: colHex(D.color), owner: D.pid });
      if (a[9] > 0) o.offAt = (V.clock || 0) + a[9] / 100; else o.offAt = 0;
      o.refundAt = a[10] > 0 ? (V.clock || 0) + a[10] / 100 : 0;
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
  if (s.mv) for (let i = 0; i < s.mv.length; i += 3) { const u = V.units.get(s.mv[i]); if (u) { u.offT = s.mv[i + 1]; u.vel = s.mv[i + 2]; u.mvAt = V.clock; } }
  if (s.fr) for (let i = 0; i < s.fr.length; i += 3) { const u = V.units.get(s.fr[i]); if (u) { if (u.frAt === undefined || V.clock - u.frAt > 1) { u.fx = u.x; u.fy = u.y; } u.tx = s.fr[i + 1]; u.ty = s.fr[i + 2]; u.frAt = V.clock; } }
  if (s.jt) for (const a of s.jt) { const j = V.jets.get(a[0]); if (j) { j.aimT = a[1] / 100; j.fire = a[2]; } }
  V.beams = s.bm || [];
  if (s.stats) V.stats = s.stats;
  if (s.over && !V.over) { V.over = s.over; setBuild(false); setTimeout(showEnd, 1500); }
  renderHUD();
}
function handleEvent(e) {
  const k = e[0];
  if (k === 'u') addUnit(e[1], e[2], e[3], e[4], e[5], e[6]);
  else if (k === 'd') { const u = V.units.get(e[1]); if (u) { V.units.delete(e[1]); if (TD.UNITS[u.k].body === 'skel') sfx('bones', u.x, u.y); else if (e[2] !== 'blast' && e[2] !== 'meteor') sfx(e[2] === 'fire' ? 'burn' : 'die', u.x, u.y); if (onScreen(u.x, u.y, 200)) die(u, e[2], e[3], e[4]); else if (e[2] !== 'fire' && e[2] !== 'ice') stain(u.x, u.y, u.r * 1.6, BLOOD[0], 0.5); } }
  else if (k === 's') { const t = V.towerMap.get(e[1]), u = V.units.get(e[2]); if (t && u) { sfx(t.k === 'cannon' ? 'cannon' : t.k === 'frost' ? 'frost' : 'arrow', t.x, t.y); const w = e[4], m = t.k === 'archer' && w !== undefined ? archerMuzzles(t.lvl || 1)[w] || [0, -27] : [0, -30], ox = m[0], oy = m[1] + 14, a = Math.atan2(u.y - t.y, u.x - t.x); t.aim = a; t.kick = 1; if (w !== undefined && t.arch && t.arch[w]) { t.arch[w].aim = a; t.arch[w].kick = 1; } if (onScreen(t.x, t.y, 300)) V.shots.push({ k: t.k, x: t.x + ox, y: t.y + oy, sx: t.x + ox, sy: t.y + oy, u, tx: u.x, ty: u.y, T: e[3] / 100, age: 0 }); } }
  else if (k === 'z') { const t = V.towerMap.get(e[1]); if (t) { t.kick = 1; sfx('zap', t.x, t.y); const pts = [[t.x, t.y - 22]]; for (const id of e[2]) { const u = V.units.get(id); if (u) pts.push([u.x, u.y - u.r]); } if (pts.length > 1 && onScreen(t.x, t.y, 300)) V.fx.push({ k: 'bolt', pts, t0: V.clock }); } }
  else if (k === 'sl') sfx('coin'), V.fx.push({ k: 'boom', x: e[1], y: e[2], t0: V.clock, small: 1 });
  else if (k === 'lk') { sfx('leak'); V.units.delete(e[1]); V.fx.push({ k: 'leak', x: V.L.base.x + rr(-40, 40), y: V.L.base.y - 110, n: e[2], t0: V.clock }); }
  else if (k === 'sp') { if (e[1] === 0) { V.meteors.push({ x: e[2], y: e[3], t0: V.clock, dur: TD.SPELLS.meteor.fall, ox: 340, oz: 620 }); sfx('whoosh', e[2], e[3]); } else { V.jets.set(e[5], { id: e[5], x: e[2], y: e[3], t0: V.clock, aim: e[6] / 100, aimT: e[6] / 100, fire: 0 }); sfx('drop', e[2], e[3]); } }
  else if (k === 'mi') meteorImpact(e[1], e[2]);
  else if (k === 'sx') { const u = V.units.get(e[1]), t = V.towerMap.get(e[4]); if (u) { V.units.delete(e[1]); if (onScreen(u.x, u.y, 200)) blowApart(u, 0, -1, BLOODS.red, true); } if (t) t.offAt = Math.max(t.offAt || 0, V.clock + TD.UNITS.sapper.sapper.stun); sfx('boom', e[2], e[3]); sfx('cannon', e[2], e[3]);
    if (onScreen(e[2], e[3], 200)) { V.fx.push({ k: 'boom', x: e[2], y: e[3], t0: V.clock }); V.rings.push({ x: e[2], y: e[3], t0: V.clock, dur: 0.4, r0: 6, r1: 60, col: '255,200,120', w: 6 }); V.shake = Math.max(V.shake, 5); for (let i = 0; i < 18; i++) { const a = rr(0, 6.28), s2 = rr(60, 220); particle('ember', e[2], e[3], 10, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, rr(100, 260), rr(0.5, 1), '#ffb040', rr(1.5, 3)); } stain(e[2], e[3] + 10, 22, '#1c1612', 0.5); } }
  else if (k === 'rz') { sfx('raise', e[1], e[2]); if (onScreen(e[1], e[2], 100)) { V.rings.push({ x: e[1], y: e[2], t0: V.clock, dur: 0.6, r0: 4, r1: 26, col: '120,255,140', w: 4 }); for (let i = 0; i < 10; i++) particle('flame', e[1] + rr(-8, 8), e[2], rr(0, 6), rr(-10, 10), rr(-6, 6), rr(30, 70), rr(0.4, 0.8), '#6aff7a'); const n = V.units.get(e[3]); if (n) V.fx.push({ k: 'bolt', pts: [[n.x, n.y - n.r * 2], [e[1], e[2]]], t0: V.clock, col: 'rgba(110,255,130,.6)' }); } }
  else if (k === 'ch') { const u = V.units.get(e[1]); if (u) { sfx('charge', u.x, u.y); if (onScreen(u.x, u.y, 60)) for (let i = 0; i < 10; i++) particle('dust', u.x - Math.cos(u.a) * 8, u.y + u.r * 0.8, 2, rr(-40, 40), rr(-20, 20), rr(20, 60), rr(0.4, 0.8), '#9a8a6a', rr(2, 3.5)); } }
  else if (k === 'closed') toast('Time! No more units can be sent. Clear the field.');
  else if (k === 'w') { sfx('horn'); if (V.isAtk && e[2]) toast('Wave ' + e[1] + ' marches: ' + e[2] + ' units'); }
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
// ---------- standing / walking units (drawn once into cached sprites) ----------
const SKIN = '#e8c39a', OGRE_SKIN = '#9ab06a', ORC_SKIN = '#7a9a4a', BONE = '#e6e0cc', NAGA = '#3f8f7a', NAGA_SKIN = '#5aa88a', FUR = '#5a5048', HIDE = '#4a5a32';
function soldier(c, k, r, step, bodyCol, face) {
  const B = TD.UNITS[k].body;
  if (B === 'skel') return drawSkel(c, r, step, bodyCol, face);
  if (B === 'naga') return drawNagaUp(c, r, step, bodyCol, face);
  if (B === 'warg') return drawWargUp(c, r, step, bodyCol, face);
  if (B === 'beast') return drawBeastUp(c, r, step, bodyCol, face);
  if (HUM[k]) return drawHum(c, k, r, step, bodyCol, face);
  if (B === 'horse') return drawKnightUp(c, r, step, bodyCol, face);
  if (B === 'ent') return drawEntUp(c, r, step, bodyCol, face);
  if (B === 'ram') return drawRamUp(c, r, step, bodyCol, face);
  if (B === 'mammoth') return drawMammothUp(c, r, step, bodyCol, face);
  const ogre = B === 'ogre', chief = k === 'chief', scout = k === 'runner';
  if (chief) { c.fillStyle = mix(bodyCol.startsWith('#') ? bodyCol : '#888888', '#000000', 0.3); c.beginPath(); c.moveTo(-r * 0.7, -r * 0.5); c.lineTo(r * 0.7, -r * 0.5); c.lineTo(r * 0.85 - face * r * 0.2, r * 0.9); c.lineTo(-r * 0.85 - face * r * 0.2, r * 0.9); c.fill(); }
  c.strokeStyle = '#2a1e16'; c.lineWidth = r * (ogre ? 0.42 : 0.35); c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * 0.3, r * 0.3); c.lineTo(-r * 0.3 + step * r * 0.35, r * 0.95); c.moveTo(r * 0.3, r * 0.3); c.lineTo(r * 0.3 - step * r * 0.35, r * 0.95); c.stroke();
  c.fillStyle = bodyCol; c.beginPath(); c.ellipse(0, 0, r * 0.75, r * 0.85, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(r * 0.2, r * 0.15, r * 0.5, r * 0.6, 0, 0, 7); c.fill();
  if (chief) { c.fillStyle = '#8a8a94'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * r * 0.6, -r * 0.45, r * 0.32, r * 0.24, 0, 0, 7); c.fill(); } c.fillStyle = '#6a6a74'; c.fillRect(-r * 0.6, r * 0.05, r * 1.2, r * 0.18); }
  c.fillStyle = ogre ? OGRE_SKIN : SKIN; c.beginPath(); c.arc(0, -r * 0.95, r * 0.5, 0, 7); c.fill();
  if (scout) { c.fillStyle = mix(bodyCol.startsWith('#') ? bodyCol : '#888888', '#000000', 0.35); c.beginPath(); c.moveTo(-r * 0.55, -r * 0.8); c.quadraticCurveTo(0, -r * 1.9, r * 0.55, -r * 0.8); c.lineTo(r * 0.3, -r * 1.05); c.lineTo(-r * 0.3, -r * 1.05); c.closePath(); c.fill(); }
  else { c.fillStyle = chief ? '#7a7a84' : ogre ? '#4a4a52' : '#6a6a72'; c.beginPath(); c.arc(0, -r * 1.05, r * 0.52, Math.PI, 0); c.fill(); }
  if (ogre) { c.fillStyle = '#ddd'; c.beginPath(); c.moveTo(-r * 0.5, -r * 1.2); c.lineTo(-r * (chief ? 0.95 : 0.75), -r * (chief ? 1.85 : 1.65)); c.lineTo(-r * 0.3, -r * 1.3); c.moveTo(r * 0.5, -r * 1.2); c.lineTo(r * (chief ? 0.95 : 0.75), -r * (chief ? 1.85 : 1.65)); c.lineTo(r * 0.3, -r * 1.3); c.fill(); c.fillStyle = '#f4f0e0'; c.fillRect(-r * 0.22, -r * 0.62, r * 0.09, r * 0.16); c.fillRect(r * 0.13, -r * 0.62, r * 0.09, r * 0.16); }
  c.save(); c.rotate(face * (0.4 + step * 0.2));
  if (chief) { c.fillStyle = '#4a3020'; c.fillRect(r * 0.6 * face - r * 0.13, -r * 1.3, r * 0.26, r * 1.7); c.fillStyle = '#5a5a64'; c.beginPath(); c.arc(r * 0.6 * face, -r * 1.35, r * 0.42, 0, 7); c.fill(); c.fillStyle = '#c8c8d0'; for (let i = 0; i < 6; i++) { const a = i * 1.047; c.beginPath(); c.moveTo(r * 0.6 * face + Math.cos(a) * r * 0.38, -r * 1.35 + Math.sin(a) * r * 0.38); c.lineTo(r * 0.6 * face + Math.cos(a) * r * 0.62, -r * 1.35 + Math.sin(a) * r * 0.62); c.lineTo(r * 0.6 * face + Math.cos(a + 0.4) * r * 0.38, -r * 1.35 + Math.sin(a + 0.4) * r * 0.38); c.fill(); } }
  else if (ogre) { c.fillStyle = '#5a3a20'; c.fillRect(r * 0.6 * face - r * 0.15, -r * 1.2, r * 0.3, r * 1.6); c.fillStyle = '#9a9aa4'; c.fillRect(r * 0.6 * face - r * 0.55, -r * 1.4, r * 1.1, r * 0.7); }
  else if (scout) { c.strokeStyle = '#6a4a2a'; c.lineWidth = r * 0.18; c.beginPath(); c.arc(r * 0.7 * face, -r * 0.4, r * 0.7, -1.2, 1.2); c.stroke(); }
  else { c.fillStyle = '#c8c8d0'; c.fillRect(r * 0.7 * face - r * 0.14, -r * 1.1, r * 0.28, r * 1.3); }
  c.restore();
}
function drawSkel(c, r, step, col, face) {
  c.strokeStyle = BONE; c.lineWidth = r * 0.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * 0.28, r * 0.35); c.lineTo(-r * 0.28 + step * r * 0.4, r * 1.05); c.moveTo(r * 0.28, r * 0.35); c.lineTo(r * 0.28 - step * r * 0.4, r * 1.05); c.stroke();
  c.fillStyle = BONE; c.beginPath(); c.ellipse(0, 0, r * 0.55, r * 0.7, 0, 0, 7); c.fill();
  c.strokeStyle = '#7a7466'; c.lineWidth = r * 0.1; c.beginPath(); for (const y of [-0.35, -0.08, 0.2]) { c.moveTo(-r * 0.42, r * y); c.lineTo(r * 0.42, r * y); } c.moveTo(0, -r * 0.6); c.lineTo(0, r * 0.6); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-r * 0.35, -r * 0.1); c.lineTo(r * 0.35, -r * 0.1); c.lineTo(r * 0.3, r * 0.75); c.lineTo(r * 0.1, r * 0.55); c.lineTo(-r * 0.05, r * 0.8); c.lineTo(-r * 0.2, r * 0.55); c.lineTo(-r * 0.35, r * 0.7); c.fill();
  c.fillStyle = BONE; c.beginPath(); c.arc(0, -r * 1.0, r * 0.48, 0, 7); c.fill(); c.fillRect(-r * 0.25, -r * 0.7, r * 0.5, r * 0.25);
  c.fillStyle = '#1a1612'; c.beginPath(); c.arc(-r * 0.18, -r * 1.02, r * 0.13, 0, 7); c.arc(r * 0.18, -r * 1.02, r * 0.13, 0, 7); c.fill();
  c.save(); c.rotate(face * (0.4 + step * 0.2)); c.fillStyle = '#8a6a4a'; c.fillRect(r * 0.7 * face - r * 0.12, -r * 1.1, r * 0.24, r * 1.3); c.restore();
}
function drawNagaUp(c, r, step, col, face) {
  const sw = step * r * 0.35;
  c.lineCap = 'round'; c.strokeStyle = NAGA; c.lineWidth = r * 0.75; c.beginPath(); c.moveTo(0, r * 0.3); c.quadraticCurveTo(-face * r * 0.9 + sw, r * 1.05, face * r * 0.3, r * 1.2); c.stroke();
  c.lineWidth = r * 0.45; c.beginPath(); c.moveTo(face * r * 0.3, r * 1.2); c.quadraticCurveTo(face * r * 1.1 - sw, r * 1.25, face * r * 1.5, r * 0.85 + sw * 0.5); c.stroke();
  c.strokeStyle = '#a8c890'; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(0, r * 0.45); c.quadraticCurveTo(-face * r * 0.75 + sw, r * 1.05, face * r * 0.3, r * 1.15); c.stroke();
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -r * 0.05, r * 0.65, r * 0.72, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(r * 0.18, r * 0.1, r * 0.42, r * 0.5, 0, 0, 7); c.fill();
  c.fillStyle = NAGA_SKIN; c.beginPath(); c.arc(0, -r * 0.95, r * 0.45, 0, 7); c.fill();
  c.fillStyle = '#2a6a5a'; c.beginPath(); c.moveTo(-r * 0.35, -r * 1.15); c.lineTo(0, -r * 1.85); c.lineTo(r * 0.35, -r * 1.15); c.fill();
  c.fillStyle = '#ffd040'; c.fillRect(-r * 0.22, -r * 1.0, r * 0.12, r * 0.08); c.fillRect(r * 0.1, -r * 1.0, r * 0.12, r * 0.08);
  c.strokeStyle = '#c8b070'; c.lineWidth = r * 0.12; const tx = face * r * 0.75; c.beginPath(); c.moveTo(tx, r * 0.5); c.lineTo(tx, -r * 1.8); c.moveTo(tx - r * 0.25, -r * 1.55); c.lineTo(tx - r * 0.25, -r * 1.85); c.moveTo(tx + r * 0.25, -r * 1.55); c.lineTo(tx + r * 0.25, -r * 1.85); c.moveTo(tx - r * 0.25, -r * 1.55); c.lineTo(tx + r * 0.25, -r * 1.55); c.stroke();
}
function drawWargUp(c, r, step, col, face) {
  const f = face; c.lineCap = 'round';
  c.strokeStyle = '#3a332c'; c.lineWidth = r * 0.24; c.beginPath(); for (const [lx, ph] of [[0.7, 1], [0.45, -1], [-0.55, -1], [-0.8, 1]]) { c.moveTo(f * r * lx, r * 0.35); c.lineTo(f * r * lx + step * ph * r * 0.35, r * 0.95); } c.stroke();
  c.strokeStyle = FUR; c.lineWidth = r * 0.22; c.beginPath(); c.moveTo(-f * r * 1.05, r * 0.05); c.quadraticCurveTo(-f * r * 1.5, -r * 0.2 + step * r * 0.15, -f * r * 1.7, -r * 0.05); c.stroke();
  c.fillStyle = FUR; c.beginPath(); c.ellipse(0, r * 0.15, r * 1.15, r * 0.55, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, r * 0.35, r * 1.0, r * 0.3, 0, 0, 7); c.fill();
  const hx = f * r * 1.25, hy = -r * 0.2; c.fillStyle = FUR; c.beginPath(); c.ellipse(hx, hy, r * 0.48, r * 0.38, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(hx + f * r * 0.45, hy + r * 0.08, r * 0.3, r * 0.18, 0, 0, 7); c.fill();
  c.fillStyle = '#3a332c'; c.beginPath(); c.moveTo(hx - f * r * 0.15, hy - r * 0.3); c.lineTo(hx - f * r * 0.05, hy - r * 0.65); c.lineTo(hx + f * r * 0.15, hy - r * 0.3); c.fill(); c.fillStyle = '#ffcc40'; c.fillRect(hx + f * r * 0.1, hy - r * 0.12, r * 0.1, r * 0.08); c.fillStyle = '#f4f0e0'; c.fillRect(hx + f * r * 0.55, hy + r * 0.18, r * 0.08, r * 0.12);
  // orc rider
  c.fillStyle = col; c.beginPath(); c.ellipse(-f * r * 0.1, -r * 0.55, r * 0.42, r * 0.5, 0, 0, 7); c.fill();
  c.fillStyle = ORC_SKIN; c.beginPath(); c.arc(-f * r * 0.1, -r * 1.15, r * 0.32, 0, 7); c.fill(); c.fillStyle = '#f4f0e0'; c.fillRect(-f * r * 0.1 - r * 0.15, -r * 0.98, r * 0.07, r * 0.12); c.fillRect(-f * r * 0.1 + r * 0.08, -r * 0.98, r * 0.07, r * 0.12);
  c.save(); c.translate(f * r * 0.25, -r * 0.7); c.rotate(f * (-0.6 + step * 0.3)); c.fillStyle = '#5a3a20'; c.fillRect(-r * 0.07, -r * 0.9, r * 0.14, r * 1.0); c.fillStyle = '#b8b8c0'; c.beginPath(); c.moveTo(0, -r * 0.9); c.quadraticCurveTo(f * r * 0.5, -r * 0.8, f * r * 0.35, -r * 0.45); c.lineTo(0, -r * 0.55); c.fill(); c.restore();
}
function drawBeastUp(c, r, step, col, face) {
  const f = face; c.lineCap = 'round';
  c.strokeStyle = '#2e3a20'; c.lineWidth = r * 0.34; c.beginPath(); for (const [lx, ph] of [[0.75, 1], [0.45, -1], [-0.55, -1], [-0.85, 1]]) { c.moveTo(f * r * lx, r * 0.25); c.lineTo(f * r * lx + step * ph * r * 0.18, r * 0.85); } c.stroke();
  c.strokeStyle = HIDE; c.lineWidth = r * 0.36; c.beginPath(); c.moveTo(-f * r * 1.05, r * 0.1); c.quadraticCurveTo(-f * r * 1.6, r * 0.35 + step * r * 0.08, -f * r * 2.0, r * 0.55); c.stroke(); c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(-f * r * 1.9, r * 0.5); c.lineTo(-f * r * 2.15, r * 0.62); c.stroke();
  c.fillStyle = HIDE; c.beginPath(); c.ellipse(0, 0, r * 1.25, r * 0.72, 0, 0, 7); c.fill();
  c.fillStyle = '#8a8a5a'; c.beginPath(); c.ellipse(0, r * 0.35, r * 1.0, r * 0.3, 0, 0, 7); c.fill();
  c.fillStyle = '#e8dcc0'; for (let i = 0; i < 7; i++) { const sx = -f * r * 0.9 + f * i * r * 0.28, sy = -r * 0.62 + Math.abs(i - 3) * r * 0.05; c.beginPath(); c.moveTo(sx - r * 0.1, sy + r * 0.05); c.lineTo(sx + f * r * 0.05, sy - r * 0.4); c.lineTo(sx + r * 0.1, sy + r * 0.05); c.fill(); }
  for (const bx of [-0.45, 0.15]) { c.fillStyle = '#3a2a1a'; c.fillRect(f * r * bx - r * 0.03, -r * 1.45, r * 0.06, r * 0.9); c.fillStyle = col; c.beginPath(); c.moveTo(f * r * bx, -r * 1.45); c.lineTo(f * r * bx - f * r * 0.42, -r * 1.3); c.lineTo(f * r * bx, -r * 1.12); c.fill(); }
  c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(-f * r * 0.1, -r * 0.15, r * 0.55, r * 0.3, 0, 0, 7); c.fill(); c.globalAlpha = 1;
  const hx = f * r * 1.35, hy = -r * 0.15; c.fillStyle = HIDE; c.beginPath(); c.ellipse(hx, hy, r * 0.55, r * 0.45, 0, 0, 7); c.fill();
  c.fillStyle = '#2a1a12'; c.beginPath(); c.moveTo(hx + f * r * 0.1, hy + r * 0.1); c.lineTo(hx + f * r * 0.65, hy + r * 0.05 + step * r * 0.05); c.lineTo(hx + f * r * 0.55, hy + r * 0.32); c.fill();
  c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(hx - f * r * 0.1, hy - r * 0.3); c.quadraticCurveTo(hx - f * r * 0.5, hy - r * 0.9, hx - f * r * 0.15, hy - r * 1.05); c.lineTo(hx + f * r * 0.05, hy - r * 0.35); c.fill(); c.beginPath(); c.moveTo(hx + f * r * 0.15, hy - r * 0.32); c.quadraticCurveTo(hx + f * r * 0.1, hy - r * 0.85, hx + f * r * 0.45, hy - r * 0.95); c.lineTo(hx + f * r * 0.3, hy - r * 0.3); c.fill();
  c.fillStyle = '#ffb030'; c.beginPath(); c.arc(hx + f * r * 0.2, hy - r * 0.08, r * 0.08, 0, 7); c.fill();
}
// ---------- more units ----------
const BARK = '#5a4028', LEAF = '#4a7a32', METAL = '#7a7f88', HORSE = '#7a5030';
const HUM = {
  zombie: { skin: '#8aa070', head: 'zombie', weapon: 'none', reach: 1, legs: '#3a3a2a', torn: 1, blood: 'rot' },
  gnoll: { skin: '#b0905a', head: 'gnoll', weapon: 'spear', legs: '#5a4028' },
  sapper: { skin: '#6a9a40', head: 'goblin', weapon: 'none', bomb: 1, legs: '#3a2a1a' },
  shield: { skin: SKIN, head: 'human', weapon: 'shield', legs: '#2a1e16' },
  troll: { skin: '#5a8a8a', head: 'troll', weapon: 'club', legs: '#2a3a3a', lanky: 1 },
  necro: { skin: '#c8c0b0', head: 'cowl', weapon: 'staff', robe: 1, legs: '#1a1a22' },
  golem: { skin: METAL, head: 'golem', weapon: 'none', legs: '#5a5f68', metal: 1, blood: 'none' },
};
const dk = (col, a) => mix(col && col.startsWith('#') ? col : '#888888', '#000000', a);
function drawHum(c, k, r, step, col, face) {
  const H = HUM[k], f = face; c.lineCap = 'round';
  if (H.bomb) { c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(-f * r * 0.55, -r * 0.25, r * 0.6, 0, 7); c.fill(); c.strokeStyle = '#8a6a3a'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(-f * r * 0.55, -r * 0.85); c.quadraticCurveTo(-f * r * 0.3, -r * 1.2, -f * r * 0.5, -r * 1.35); c.stroke(); c.fillStyle = '#ffcc33'; c.beginPath(); c.arc(-f * r * 0.5, -r * 1.38, r * 0.16, 0, 7); c.fill(); }
  if (H.robe) { c.fillStyle = dk(col, 0.45); c.beginPath(); c.moveTo(-r * 0.6, -r * 0.2); c.lineTo(r * 0.6, -r * 0.2); c.lineTo(r * 0.75 + step * r * 0.12, r * 1.0); c.lineTo(-r * 0.75 + step * r * 0.12, r * 1.0); c.fill(); }
  else { c.strokeStyle = H.legs; c.lineWidth = r * (H.metal ? 0.5 : 0.35); c.beginPath(); const lg = H.lanky ? 1.15 : 0.95; c.moveTo(-r * 0.3, r * 0.3); c.lineTo(-r * 0.3 + step * r * 0.35, r * lg); c.moveTo(r * 0.3, r * 0.3); c.lineTo(r * 0.3 - step * r * 0.35, r * lg); c.stroke(); }
  c.fillStyle = H.metal ? H.skin : H.robe ? dk(col, 0.2) : col; c.beginPath(); c.ellipse(0, 0, r * (H.metal ? 0.85 : 0.72), r * (H.lanky ? 0.95 : 0.85), 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(r * 0.2, r * 0.15, r * 0.5, r * 0.6, 0, 0, 7); c.fill();
  if (H.metal) { c.fillStyle = col; c.fillRect(-r * 0.42, -r * 0.45, r * 0.84, r * 0.55); c.fillStyle = '#4a4f58'; for (const [px, py] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.4], [0.6, 0.4]]) { c.beginPath(); c.arc(px * r, py * r, r * 0.08, 0, 7); c.fill(); } }
  if (H.torn) { c.fillStyle = H.skin; for (const [px, py, s] of [[-0.3, 0.2, 0.18], [0.35, -0.2, 0.15], [0.1, 0.5, 0.14]]) { c.beginPath(); c.arc(px * r, py * r, s * r, 0, 7); c.fill(); } }
  if (H.robe) { c.fillStyle = col; c.fillRect(-r * 0.08, -r * 0.6, r * 0.16, r * 1.5); }
  // arms / weapon
  c.save(); const sw = step * r * 0.2;
  if (H.reach) { c.strokeStyle = H.skin; c.lineWidth = r * 0.26; c.beginPath(); c.moveTo(f * r * 0.4, -r * 0.45); c.lineTo(f * r * 1.25, -r * 0.5 + sw); c.moveTo(-f * r * 0.2, -r * 0.4); c.lineTo(f * r * 1.05, -r * 0.3 - sw); c.stroke(); }
  else if (H.weapon === 'spear') { c.strokeStyle = '#6a4a2a'; c.lineWidth = r * 0.14; c.beginPath(); c.moveTo(f * r * 0.55, r * 0.7); c.lineTo(f * r * 0.95, -r * 1.9); c.stroke(); c.fillStyle = '#c8c8d0'; c.beginPath(); c.moveTo(f * r * 0.85, -r * 1.85); c.lineTo(f * r * 1.0, -r * 2.35); c.lineTo(f * r * 1.1, -r * 1.85); c.fill(); }
  else if (H.weapon === 'shield') { c.fillStyle = col; c.strokeStyle = '#d8c070'; c.lineWidth = r * 0.12; c.beginPath(); c.rect(f > 0 ? r * 0.2 : -r * 0.85, -r * 0.95, r * 0.65, r * 1.55); c.fill(); c.stroke(); c.fillStyle = '#d8c070'; c.beginPath(); c.arc(f * r * 0.52, -r * 0.18, r * 0.13, 0, 7); c.fill(); }
  else if (H.weapon === 'club') { c.rotate(f * (0.4 + step * 0.2)); c.fillStyle = '#5a3a20'; c.fillRect(r * 0.65 * f - r * 0.14, -r * 1.3, r * 0.28, r * 1.7); c.fillStyle = '#7a5a3a'; c.beginPath(); c.ellipse(r * 0.65 * f, -r * 1.35, r * 0.32, r * 0.45, 0, 0, 7); c.fill(); }
  else if (H.weapon === 'staff') { c.strokeStyle = '#3a2a1a'; c.lineWidth = r * 0.14; c.beginPath(); c.moveTo(f * r * 0.7, r * 0.9); c.lineTo(f * r * 0.7, -r * 1.7); c.stroke(); c.fillStyle = BONE; c.beginPath(); c.arc(f * r * 0.7, -r * 1.85, r * 0.26, 0, 7); c.fill(); c.fillStyle = '#6aff7a'; c.beginPath(); c.arc(f * r * 0.7 - r * 0.08, -r * 1.88, r * 0.06, 0, 7); c.arc(f * r * 0.7 + r * 0.08, -r * 1.88, r * 0.06, 0, 7); c.fill(); }
  else if (H.metal) { c.fillStyle = '#6a6f78'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.95, r * 0.15 + sx * sw, r * 0.3, 0, 7); c.fill(); } }
  c.restore();
  // head
  c.save(); c.translate(0, H.lanky ? -r * 1.1 : -r * 0.95); drawUpHead(c, H.head, r, f, H.skin, col); c.restore();
}
function drawUpHead(c, t, r, f, skin, col) {
  const hr = r * 0.48;
  if (t === 'zombie') { c.fillStyle = skin; c.beginPath(); c.arc(f * r * 0.1, 0, hr, 0, 7); c.fill(); c.fillStyle = '#3a3a2a'; c.beginPath(); c.arc(f * r * 0.05, -hr * 0.55, hr * 0.7, Math.PI, 0); c.fill(); c.fillStyle = '#1a1a10'; c.fillRect(f * r * 0.15, -hr * 0.1, hr * 0.25, hr * 0.25); }
  else if (t === 'gnoll') { c.fillStyle = skin; c.beginPath(); c.arc(0, 0, hr, 0, 7); c.fill(); c.beginPath(); c.ellipse(f * hr * 0.9, hr * 0.25, hr * 0.55, hr * 0.35, 0, 0, 7); c.fill(); c.fillStyle = '#5a4028'; c.beginPath(); c.moveTo(-hr * 0.6, -hr * 0.5); c.lineTo(-hr * 0.4, -hr * 1.4); c.lineTo(-hr * 0.1, -hr * 0.7); c.moveTo(hr * 0.2, -hr * 0.7); c.lineTo(hr * 0.5, -hr * 1.4); c.lineTo(hr * 0.7, -hr * 0.5); c.fill(); c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(-hr * 0.3, hr * 0.3, hr * 0.15, 0, 7); c.arc(hr * 0.1, -hr * 0.2, hr * 0.12, 0, 7); c.fill(); c.fillStyle = '#1a120c'; c.beginPath(); c.arc(f * hr * 1.4, hr * 0.2, hr * 0.14, 0, 7); c.fill(); }
  else if (t === 'goblin') { c.fillStyle = skin; c.beginPath(); c.arc(0, 0, hr * 0.85, 0, 7); c.fill(); c.beginPath(); c.moveTo(-hr * 0.6, -hr * 0.1); c.lineTo(-hr * 1.7, -hr * 0.5); c.lineTo(-hr * 0.6, hr * 0.3); c.moveTo(hr * 0.6, -hr * 0.1); c.lineTo(hr * 1.7, -hr * 0.5); c.lineTo(hr * 0.6, hr * 0.3); c.fill(); c.fillStyle = '#5a3a20'; c.beginPath(); c.arc(0, -hr * 0.25, hr * 0.85, Math.PI, 0); c.fill(); c.fillStyle = '#ffdd44'; c.fillRect(f * hr * 0.2, -hr * 0.05, hr * 0.2, hr * 0.15); }
  else if (t === 'troll') { c.fillStyle = skin; c.beginPath(); c.arc(0, 0, hr, 0, 7); c.fill(); c.beginPath(); c.ellipse(f * hr * 0.9, hr * 0.15, hr * 0.4, hr * 0.22, 0, 0, 7); c.fill(); c.fillStyle = '#2a4a4a'; c.beginPath(); c.moveTo(-hr, -hr * 0.2); c.lineTo(-hr * 0.4, -hr * 1.6); c.lineTo(0, -hr * 0.8); c.lineTo(hr * 0.4, -hr * 1.5); c.lineTo(hr, -hr * 0.2); c.fill(); c.fillStyle = '#f4f0e0'; c.fillRect(f * hr * 0.35, hr * 0.45, hr * 0.15, hr * 0.4); c.fillRect(f * hr * 0.75, hr * 0.4, hr * 0.15, hr * 0.38); }
  else if (t === 'cowl') { c.fillStyle = dk(col, 0.35); c.beginPath(); c.moveTo(-hr * 1.1, hr * 0.6); c.quadraticCurveTo(0, -hr * 2.2, hr * 1.1, hr * 0.6); c.fill(); c.fillStyle = '#120e10'; c.beginPath(); c.arc(f * hr * 0.15, hr * 0.15, hr * 0.6, 0, 7); c.fill(); c.fillStyle = '#6aff7a'; c.fillRect(f * hr * 0.05 - hr * 0.25, 0, hr * 0.16, hr * 0.12); c.fillRect(f * hr * 0.05 + hr * 0.12, 0, hr * 0.16, hr * 0.12); }
  else if (t === 'golem') { c.fillStyle = METAL; c.fillRect(-hr, -hr * 0.9, hr * 2, hr * 1.7); c.fillStyle = '#5a5f68'; c.fillRect(-hr, -hr * 0.9, hr * 2, hr * 0.3); c.fillStyle = '#ff9a30'; c.fillRect(f * hr * 0.1 - hr * 0.55, -hr * 0.2, hr * 1.1, hr * 0.22); }
  else { c.fillStyle = skin; c.beginPath(); c.arc(0, 0, hr, 0, 7); c.fill(); c.fillStyle = '#6a6a72'; c.beginPath(); c.arc(0, -r * 0.1, hr * 1.04, Math.PI, 0); c.fill(); }
}
function drawKnightUp(c, r, step, col, face) {
  const f = face; c.lineCap = 'round';
  c.strokeStyle = '#4a3020'; c.lineWidth = r * 0.22; c.beginPath(); for (const [lx, ph] of [[0.75, 1], [0.5, -1], [-0.55, -1], [-0.8, 1]]) { c.moveTo(f * r * lx, r * 0.3); c.lineTo(f * r * lx + step * ph * r * 0.4, r * 1.05); } c.stroke();
  c.strokeStyle = '#3a2a1a'; c.lineWidth = r * 0.18; c.beginPath(); c.moveTo(-f * r * 1.05, -r * 0.05); c.quadraticCurveTo(-f * r * 1.45, r * 0.2, -f * r * 1.4, r * 0.65); c.stroke();
  c.fillStyle = HORSE; c.beginPath(); c.ellipse(0, r * 0.1, r * 1.1, r * 0.5, 0, 0, 7); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(-r * 0.8, -r * 0.25); c.lineTo(r * 0.7, -r * 0.25); c.lineTo(r * 0.8, r * 0.55); c.lineTo(-r * 0.9, r * 0.55); c.fill(); c.fillStyle = '#d8c070'; c.fillRect(-r * 0.85, r * 0.45, r * 1.65, r * 0.08);
  c.save(); c.translate(f * r * 1.05, -r * 0.35); c.rotate(f * -0.5); c.fillStyle = HORSE; c.fillRect(-r * 0.2, -r * 0.4, r * 0.4, r * 0.7); c.beginPath(); c.ellipse(f * r * 0.15, -r * 0.5, r * 0.45, r * 0.22, f * 0.3, 0, 7); c.fill(); c.fillStyle = '#3a2a1a'; c.fillRect(-r * 0.2, -r * 0.55, r * 0.12, r * 0.6); c.restore();
  c.fillStyle = '#9aa0aa'; c.beginPath(); c.ellipse(-f * r * 0.1, -r * 0.6, r * 0.38, r * 0.45, 0, 0, 7); c.fill();
  c.fillStyle = '#b8bec8'; c.beginPath(); c.arc(-f * r * 0.1, -r * 1.15, r * 0.3, 0, 7); c.fill(); c.fillStyle = '#2a2a2a'; c.fillRect(-f * r * 0.1 - r * 0.2, -r * 1.18, r * 0.4, r * 0.07); c.fillStyle = col; c.beginPath(); c.moveTo(-f * r * 0.1, -r * 1.42); c.quadraticCurveTo(-f * r * 0.6, -r * 1.7, -f * r * 0.75, -r * 1.25); c.lineTo(-f * r * 0.1, -r * 1.3); c.fill();
  c.strokeStyle = '#c8b090'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(-f * r * 0.4, -r * 0.45); c.lineTo(f * r * 2.0, -r * 0.95); c.stroke(); c.fillStyle = col; c.beginPath(); c.moveTo(f * r * 0.15, -r * 0.6); c.lineTo(f * r * 0.15, -r * 0.3); c.lineTo(f * r * 0.45, -r * 0.6); c.fill();
}
function drawEntUp(c, r, step, col, face) {
  const f = face; c.lineCap = 'round';
  c.strokeStyle = BARK; c.lineWidth = r * 0.28; c.beginPath(); for (const [lx, ph] of [[-0.35, 1], [0.05, -1], [0.4, 1]]) { c.moveTo(r * lx, r * 0.4); c.lineTo(r * lx * 1.4 + step * ph * r * 0.25, r * 1.0); } c.stroke();
  c.fillStyle = BARK; c.beginPath(); c.ellipse(0, -r * 0.05, r * 0.48, r * 0.8, 0, 0, 7); c.fill();
  c.strokeStyle = '#3a2a18'; c.lineWidth = r * 0.06; c.beginPath(); for (const x0 of [-0.2, 0.05, 0.25]) { c.moveTo(r * x0, -r * 0.7); c.lineTo(r * x0 + r * 0.05, r * 0.6); } c.stroke();
  c.fillStyle = col; c.fillRect(-r * 0.48, -r * 0.05, r * 0.96, r * 0.14);
  c.strokeStyle = BARK; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(-r * 0.35, -r * 0.45); c.lineTo(-r * 0.9, -r * 0.2 + step * r * 0.15); c.lineTo(-r * 1.05, r * 0.15); c.moveTo(r * 0.35, -r * 0.45); c.lineTo(r * 0.95, -r * 0.6 - step * r * 0.15); c.lineTo(r * 1.15, -r * 0.95); c.stroke();
  c.fillStyle = '#ffb030'; c.fillRect(f * r * 0.12 - r * 0.2, -r * 0.4, r * 0.1, r * 0.06); c.fillRect(f * r * 0.12 + r * 0.05, -r * 0.4, r * 0.1, r * 0.06);
  for (const [px, py, s, cl] of [[0, -1.25, 0.65, LEAF], [-0.5, -1.0, 0.45, '#3e6a2a'], [0.5, -1.05, 0.5, '#3e6a2a'], [0.15, -1.45, 0.4, '#5a8a3a'], [-0.2, -1.4, 0.35, '#5a8a3a']]) { c.fillStyle = cl; c.beginPath(); c.arc(px * r, py * r, s * r, 0, 7); c.fill(); }
}
function drawRamUp(c, r, step, col, face) {
  const f = face;
  c.fillStyle = '#2a1e16'; for (const lx of [-0.6, -0.2, 0.2, 0.6]) c.fillRect(r * lx - r * 0.05, r * 0.25, r * 0.1, r * 0.45 + Math.abs(step) * r * 0.05);
  c.strokeStyle = '#3a2a1a'; c.lineWidth = r * 0.5; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-f * r * 0.7, -r * 0.1); c.lineTo(f * r * 1.35, -r * 0.1); c.stroke();
  c.fillStyle = '#5a5f68'; c.beginPath(); c.moveTo(f * r * 1.3, -r * 0.4); c.lineTo(f * r * 1.7, -r * 0.25); c.lineTo(f * r * 1.7, r * 0.05); c.lineTo(f * r * 1.3, r * 0.2); c.fill();
  c.fillStyle = '#6a4a2a'; c.fillRect(-r * 1.0, -r * 0.55, r * 2.0, r * 0.9); c.strokeStyle = '#4a3218'; c.lineWidth = r * 0.06; c.beginPath(); for (let i = -0.8; i <= 0.8; i += 0.4) { c.moveTo(r * i, -r * 0.55); c.lineTo(r * i, r * 0.35); } c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-r * 1.15, -r * 0.5); c.lineTo(0, -r * 1.1); c.lineTo(r * 1.15, -r * 0.5); c.fill(); c.fillStyle = dk(col, 0.3); c.beginPath(); c.moveTo(0, -r * 1.1); c.lineTo(r * 1.15, -r * 0.5); c.lineTo(r * 0.4, -r * 0.5); c.fill();
  c.fillStyle = '#3a2a1a'; for (const wx of [-0.7, 0.7]) { c.beginPath(); c.arc(r * wx, r * 0.4, r * 0.3, 0, 7); c.fill(); c.fillStyle = '#8a8f98'; c.beginPath(); c.arc(r * wx, r * 0.4, r * 0.08, 0, 7); c.fill(); c.fillStyle = '#3a2a1a'; }
}
function drawMammothUp(c, r, step, col, face) {
  const f = face, FURC = '#6a4a30'; c.lineCap = 'round';
  c.strokeStyle = '#4a3220'; c.lineWidth = r * 0.3; c.beginPath(); for (const [lx, ph] of [[0.6, 1], [0.35, -1], [-0.45, -1], [-0.7, 1]]) { c.moveTo(f * r * lx, r * 0.3); c.lineTo(f * r * lx + step * ph * r * 0.12, r * 0.9); } c.stroke();
  c.fillStyle = FURC; c.beginPath(); c.ellipse(0, 0, r * 1.0, r * 0.68, 0, 0, 7); c.fill(); c.fillStyle = '#5a3c26'; c.beginPath(); c.ellipse(0, r * 0.35, r * 0.85, r * 0.3, 0, 0, 7); c.fill();
  const hx = f * r * 0.95, hy = -r * 0.15; c.fillStyle = FURC; c.beginPath(); c.ellipse(hx, hy, r * 0.45, r * 0.42, 0, 0, 7); c.fill();
  c.strokeStyle = '#5a3c26'; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(hx + f * r * 0.3, hy + r * 0.1); c.quadraticCurveTo(hx + f * r * 0.55, hy + r * 0.6, hx + f * r * 0.35 + step * r * 0.05, hy + r * 0.85); c.stroke();
  c.strokeStyle = '#f4ecd8'; c.lineWidth = r * 0.09; c.beginPath(); c.moveTo(hx + f * r * 0.2, hy + r * 0.2); c.quadraticCurveTo(hx + f * r * 0.8, hy + r * 0.55, hx + f * r * 0.85, hy + r * 0.05); c.stroke();
  c.fillStyle = '#1a120c'; c.beginPath(); c.arc(hx + f * r * 0.12, hy - r * 0.1, r * 0.05, 0, 7); c.fill();
  c.fillStyle = '#6a4a2a'; c.fillRect(-r * 0.55, -r * 1.05, r * 0.95, r * 0.5); c.fillStyle = col; c.beginPath(); c.moveTo(-r * 0.65, -r * 1.05); c.lineTo(-r * 0.08, -r * 1.45); c.lineTo(r * 0.5, -r * 1.05); c.fill();
  c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(-r * 0.7, -r * 0.55); c.lineTo(r * 0.55, -r * 0.55); c.lineTo(r * 0.5, r * 0.05); c.lineTo(-r * 0.65, r * 0.05); c.fill(); c.globalAlpha = 1;
  c.fillStyle = SKIN; c.beginPath(); c.arc(-r * 0.3, -r * 1.12, r * 0.09, 0, 7); c.arc(r * 0.15, -r * 1.12, r * 0.09, 0, 7); c.fill();
}

const STATE_COL = { flash: '#ffffff', slow: '#8ad0ff', burn: '#e8602a', wet: '#5a9ad0' };
function sprite(k, state, face, frame, col) {
  const key = k + state + face + frame + col; let s = SPR.get(key); if (s) return s;
  const r = TD.UNITS[k].r, size = Math.ceil(r * 4.4), ss = Math.max(1, Math.min(SS, 90 / size)), c = document.createElement('canvas'); c.width = c.height = Math.ceil(size * ss); const cx = c.getContext('2d');
  cx.scale(ss, ss); cx.translate(size / 2, size * 0.6);
  const body = state === 'dead' ? mix(col, '#3a2a22', 0.35) : STATE_COL[state] || col;
  soldier(cx, k, r, frame < 0 ? 0 : Math.sin(frame / WALK * Math.PI * 2), body, face);
  s = { c, size, oy: size * 0.6 }; SPR.set(key, s); return s;
}
function drawSprite(s, px, py, rot, c = X0) { const sz = s.size; if (!rot) { c.drawImage(s.c, px - sz / 2, py - s.oy, sz, sz); return; } c.save(); c.translate(px, py); c.rotate(rot); c.drawImage(s.c, -sz / 2, -s.oy, sz, sz); c.restore(); }

// ---------- jointed bodies for deaths: limbs flail in the air, settle into a sprawl, can tear off ----------
// a rig lists the body's parts in its own frame (head toward -y). Each limb: attach point, length, width, colours, rest-angle range.
const BLOODS = { red: ['#7a0f0f', '#8e1414', '#6a0a0a'], naga: ['#1f4a3a', '#2a5a44', '#183a2e'], rot: ['#3a2a14', '#4a3a1a', '#2a1e10'], sap: ['#8a5a1a', '#a06a20', '#6a4a14'], none: null };
function rigFor(k, r, col) {
  const B = k === 'rider' || k === 'knightRider' ? 'human' : TD.UNITS[k].body, L = (j, x, y, len, w, c, end, endCol, side, lo, hi, o = {}) => Object.assign({ j, at: [x * r, y * r], len: len * r, w: w * r, col: c, end: end * r, endCol, side, lo, hi }, o);
  if (B === 'skel') return { B, blood: 'none', torso: { rx: 0.55 * r, ry: 0.7 * r, col: BONE, ribs: 1, cloth: col }, head: { type: 'skull', y: -0.95 * r, r: 0.48 * r },
    parts: [L('lL', -0.28, 0.5, 1.05, 0.2, BONE, 0.12, BONE, -1, 0, 0.9, { back: 1 }), L('lR', 0.28, 0.5, 1.05, 0.2, BONE, 0.12, BONE, 1, 0, 0.9, { back: 1 }), L('aL', -0.55, -0.35, 0.9, 0.17, BONE, 0.12, BONE, -1, 0.2, 2.6, { back: 1 }), L('aR', 0.55, -0.35, 0.9, 0.17, BONE, 0.12, BONE, 1, 0.2, 2.6, { weapon: 'rusty' })] };
  if (B === 'naga') return { B, blood: 'naga', torso: { rx: 0.65 * r, ry: 0.72 * r, col }, head: { type: 'naga', y: -0.95 * r, r: 0.45 * r },
    parts: [L('tl', 0, 0.55, 2.3, 0.7, NAGA, 0, NAGA, 0, 0, 1.4, { back: 1, curl: 1, belly: '#a8c890' }), L('aL', -0.6, -0.35, 0.9, 0.32, NAGA_SKIN, 0.2, NAGA_SKIN, -1, 0.2, 2.5, { back: 1 }), L('aR', 0.6, -0.35, 0.9, 0.32, NAGA_SKIN, 0.2, NAGA_SKIN, 1, 0.2, 2.5, { weapon: 'trident' })] };
  if (B === 'warg') return { B, blood: 'red', quad: 1, torso: { rx: 0.55 * r, ry: 1.1 * r, col: FUR, under: '#7a6e62' }, head: { type: 'wolf', y: -1.35 * r, r: 0.42 * r },
    parts: [L('fL', -0.42, -0.6, 0.8, 0.24, '#3a332c', 0.14, '#2a241e', -1, 0.1, 1.4, { back: 1 }), L('fR', 0.42, -0.6, 0.8, 0.24, '#3a332c', 0.14, '#2a241e', 1, 0.1, 1.4, { back: 1 }), L('bL', -0.42, 0.65, 0.8, 0.26, '#3a332c', 0.14, '#2a241e', -1, 0.1, 1.3, { back: 1 }), L('bR', 0.42, 0.65, 0.8, 0.26, '#3a332c', 0.14, '#2a241e', 1, 0.1, 1.3, { back: 1 }), L('tl', 0, 1.05, 0.9, 0.22, FUR, 0.1, FUR, 0, 0, 1.2, { back: 1, curl: 1 })] };
  if (B === 'beast') return { B, blood: 'red', quad: 1, torso: { rx: 0.85 * r, ry: 1.25 * r, col: HIDE, under: '#8a8a5a', spikes: 1, cloth: col }, head: { type: 'beast', y: -1.5 * r, r: 0.55 * r },
    parts: [L('fL', -0.7, -0.65, 0.75, 0.34, '#2e3a20', 0.2, '#22301a', -1, 0.2, 1.2, { back: 1 }), L('fR', 0.7, -0.65, 0.75, 0.34, '#2e3a20', 0.2, '#22301a', 1, 0.2, 1.2, { back: 1 }), L('bL', -0.7, 0.75, 0.75, 0.36, '#2e3a20', 0.2, '#22301a', -1, 0.2, 1.1, { back: 1 }), L('bR', 0.7, 0.75, 0.75, 0.36, '#2e3a20', 0.2, '#22301a', 1, 0.2, 1.1, { back: 1 }), L('tl', 0, 1.2, 1.3, 0.36, HIDE, 0.1, HIDE, 0, 0, 1.0, { back: 1, curl: 1 })] };
  if (B === 'ent') return { B, blood: 'sap', torso: { rx: 0.48 * r, ry: 0.85 * r, col: BARK, bark: 1, cloth: col }, head: { type: 'crown', y: -1.25 * r, r: 0.75 * r },
    parts: [L('lL', -0.3, 0.6, 0.8, 0.26, BARK, 0, BARK, -1, 0.1, 1.0, { back: 1 }), L('lM', 0, 0.7, 0.7, 0.24, BARK, 0, BARK, 0, 0, 0.5, { back: 1 }), L('lR', 0.3, 0.6, 0.8, 0.26, BARK, 0, BARK, 1, 0.1, 1.0, { back: 1 }), L('aL', -0.4, -0.45, 1.15, 0.17, BARK, 0, BARK, -1, 0.3, 2.2, { back: 1, curl: 1 }), L('aR', 0.4, -0.45, 1.15, 0.17, BARK, 0, BARK, 1, 0.3, 2.2, { curl: 1 })] };
  if (B === 'mammoth') return { B, blood: 'red', quad: 1, torso: { rx: 0.7 * r, ry: 1.0 * r, col: '#6a4a30', under: '#5a3c26', howdah: col }, head: { type: 'mammoth', y: -1.25 * r, r: 0.45 * r },
    parts: [L('fL', -0.55, -0.55, 0.6, 0.3, '#4a3220', 0.16, '#3a2414', -1, 0.2, 1.1, { back: 1 }), L('fR', 0.55, -0.55, 0.6, 0.3, '#4a3220', 0.16, '#3a2414', 1, 0.2, 1.1, { back: 1 }), L('bL', -0.55, 0.6, 0.6, 0.3, '#4a3220', 0.16, '#3a2414', -1, 0.2, 1.0, { back: 1 }), L('bR', 0.55, 0.6, 0.6, 0.3, '#4a3220', 0.16, '#3a2414', 1, 0.2, 1.0, { back: 1 }), L('tl', 0, 1.0, 0.45, 0.1, '#4a3220', 0.06, '#3a2414', 0, 0, 1, { back: 1 })] };
  if (B === 'horse') return { B, blood: 'red', quad: 1, torso: { rx: 0.48 * r, ry: 1.05 * r, col, under: HORSE }, head: { type: 'horse', y: -1.3 * r, r: 0.38 * r },
    parts: [L('fL', -0.36, -0.6, 0.85, 0.2, '#4a3020', 0.12, '#2a1a10', -1, 0.1, 1.4, { back: 1 }), L('fR', 0.36, -0.6, 0.85, 0.2, '#4a3020', 0.12, '#2a1a10', 1, 0.1, 1.4, { back: 1 }), L('bL', -0.36, 0.65, 0.85, 0.22, '#4a3020', 0.12, '#2a1a10', -1, 0.1, 1.3, { back: 1 }), L('bR', 0.36, 0.65, 0.85, 0.22, '#4a3020', 0.12, '#2a1a10', 1, 0.1, 1.3, { back: 1 }), L('tl', 0, 1.05, 0.7, 0.18, '#3a2a1a', 0.08, '#3a2a1a', 0, 0, 1.2, { back: 1, curl: 1 })] };
  const H = HUM[k];
  if (H) return { B: 'human', blood: H.blood || 'red', torso: { rx: (H.metal ? 0.85 : 0.72) * r, ry: 0.82 * r, col: H.metal ? H.skin : H.robe ? mix(col.startsWith('#') ? col : '#888888', '#000000', 0.25) : col, plate: H.metal ? col : null }, head: { type: H.head, y: -0.95 * r, r: 0.5 * r, skin: H.skin, col },
    parts: [L('lL', -0.32, 0.5, 1.05, H.metal ? 0.5 : 0.4, H.robe ? mix(col.startsWith('#') ? col : '#888888', '#000000', 0.45) : H.legs, 0.22, H.metal ? '#4a4f58' : '#1a120c', -1, 0, 0.9, { back: 1 }), L('lR', 0.32, 0.5, 1.05, H.metal ? 0.5 : 0.4, H.robe ? mix(col.startsWith('#') ? col : '#888888', '#000000', 0.45) : H.legs, 0.22, H.metal ? '#4a4f58' : '#1a120c', 1, 0, 0.9, { back: 1 }),
      L('aL', -0.62, -0.35, H.lanky ? 1.2 : 0.95, H.metal ? 0.45 : 0.32, H.metal || H.reach ? H.skin : col, H.metal ? 0.3 : 0.2, H.skin, -1, 0.2, 2.6, { back: 1 }), L('aR', 0.62, -0.35, H.lanky ? 1.2 : 0.95, H.metal ? 0.45 : 0.32, H.metal || H.reach ? H.skin : col, H.metal ? 0.3 : 0.2, H.skin, 1, 0.2, 2.6, { weapon: H.weapon })] };
  const ogre = B === 'ogre', chief = k === 'chief', rider = k === 'rider', knightR = k === 'knightRider', skin = ogre ? OGRE_SKIN : rider ? ORC_SKIN : SKIN;
  if (knightR) return { B: 'human', blood: 'red', torso: { rx: 0.72 * r, ry: 0.82 * r, col: '#9aa0aa', plate: col }, head: { type: 'knight', y: -0.95 * r, r: 0.5 * r, col },
    parts: [L('lL', -0.32, 0.5, 1.05, 0.42, '#7a808a', 0.22, '#5a5f68', -1, 0, 0.9, { back: 1 }), L('lR', 0.32, 0.5, 1.05, 0.42, '#7a808a', 0.22, '#5a5f68', 1, 0, 0.9, { back: 1 }), L('aL', -0.62, -0.35, 0.95, 0.34, '#9aa0aa', 0.22, '#7a808a', -1, 0.2, 2.6, { back: 1 }), L('aR', 0.62, -0.35, 0.95, 0.34, '#9aa0aa', 0.22, '#7a808a', 1, 0.2, 2.6, { weapon: 'lance' })] };
  return { B: 'human', blood: 'red', torso: { rx: 0.72 * r, ry: 0.82 * r, col, armor: chief }, head: { type: chief ? 'chief' : ogre ? 'ogre' : rider ? 'orc' : k === 'runner' ? 'scout' : 'human', y: -0.95 * r, r: 0.5 * r, hood: col },
    parts: [L('lL', -0.32, 0.5, 1.05, ogre ? 0.5 : 0.42, '#2a1e16', 0.22, '#1a120c', -1, 0, 0.9, { back: 1 }), L('lR', 0.32, 0.5, 1.05, ogre ? 0.5 : 0.42, '#2a1e16', 0.22, '#1a120c', 1, 0, 0.9, { back: 1 }),
      L('aL', -0.62, -0.35, 0.95, ogre ? 0.42 : 0.34, ogre ? skin : col, 0.22, skin, -1, 0.2, 2.6, { back: 1 }), L('aR', 0.62, -0.35, 0.95, ogre ? 0.42 : 0.34, ogre ? skin : col, 0.22, skin, 1, 0.2, 2.6, { weapon: chief ? 'mace' : ogre ? 'club' : rider ? 'axe' : k === 'runner' ? 'bow' : 'sword' })] };
}
function restPose(rig) { const p = {}; for (const q of rig.parts) { let a = rr(q.lo, q.hi); if (q.side) { a *= q.side; if (Math.random() < 0.18) a = -a * 0.4; } else a *= Math.random() < 0.5 ? -1 : 1; p[q.j] = a; } p.hd = rr(-0.5, 0.5); return p; }
function drawWeapon(c, w, r) {
  if (w === 'sword' || w === 'rusty') { c.fillStyle = w === 'rusty' ? '#8a6a4a' : '#c8c8d0'; c.fillRect(-r * 0.12, -r * 0.2, r * 0.24, r * 1.4); c.fillStyle = '#5a3a20'; c.fillRect(-r * 0.28, -r * 0.25, r * 0.56, r * 0.12); }
  else if (w === 'bow') { c.strokeStyle = '#6a4a2a'; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, r * 0.4, r * 0.7, -1.2, 1.2); c.stroke(); }
  else if (w === 'club') { c.fillStyle = '#5a3a20'; c.fillRect(-r * 0.12, -r * 0.2, r * 0.24, r * 1.3); c.fillStyle = '#7a5a3a'; c.beginPath(); c.ellipse(0, r * 1.15, r * 0.3, r * 0.42, 0, 0, 7); c.fill(); }
  else if (w === 'mace') { c.fillStyle = '#4a3020'; c.fillRect(-r * 0.1, -r * 0.2, r * 0.2, r * 1.2); c.fillStyle = '#5a5a64'; c.beginPath(); c.arc(0, r * 1.1, r * 0.35, 0, 7); c.fill(); }
  else if (w === 'axe') { c.fillStyle = '#5a3a20'; c.fillRect(-r * 0.08, -r * 0.2, r * 0.16, r * 1.2); c.fillStyle = '#b8b8c0'; c.beginPath(); c.moveTo(0, r * 0.8); c.quadraticCurveTo(r * 0.6, r * 0.9, r * 0.45, r * 1.25); c.lineTo(0, r * 1.1); c.fill(); }
  else if (w === 'spear') { c.strokeStyle = '#6a4a2a'; c.lineWidth = r * 0.14; c.beginPath(); c.moveTo(0, -r * 0.6); c.lineTo(0, r * 2.0); c.stroke(); c.fillStyle = '#c8c8d0'; c.beginPath(); c.moveTo(-r * 0.12, r * 1.95); c.lineTo(0, r * 2.4); c.lineTo(r * 0.12, r * 1.95); c.fill(); }
  else if (w === 'lance') { c.strokeStyle = '#c8b090'; c.lineWidth = r * 0.14; c.beginPath(); c.moveTo(0, -r * 0.8); c.lineTo(0, r * 2.8); c.stroke(); }
  else if (w === 'staff') { c.strokeStyle = '#3a2a1a'; c.lineWidth = r * 0.14; c.beginPath(); c.moveTo(0, -r * 0.6); c.lineTo(0, r * 2.0); c.stroke(); c.fillStyle = BONE; c.beginPath(); c.arc(0, r * 2.15, r * 0.26, 0, 7); c.fill(); }
  else if (w === 'shield') { c.fillStyle = '#5a4a3a'; c.strokeStyle = '#d8c070'; c.lineWidth = r * 0.12; c.beginPath(); c.rect(-r * 0.32, r * 0.1, r * 0.65, r * 1.4); c.fill(); c.stroke(); }
  else if (w === 'trident') { c.strokeStyle = '#c8b070'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(0, -r * 0.6); c.lineTo(0, r * 1.9); c.moveTo(-r * 0.25, r * 1.6); c.lineTo(r * 0.25, r * 1.6); c.moveTo(-r * 0.25, r * 1.6); c.lineTo(-r * 0.25, r * 1.95); c.moveTo(r * 0.25, r * 1.6); c.lineTo(r * 0.25, r * 1.95); c.stroke(); }
}
function stumpAt(c, x0, y0, w, bl) { c.fillStyle = bl ? bl[1] : BONE; c.beginPath(); c.arc(x0, y0, w * 0.55, 0, 7); c.fill(); if (bl) { c.fillStyle = '#e8d0c0'; c.beginPath(); c.arc(x0, y0, w * 0.2, 0, 7); c.fill(); } }
function drawLimb(c, q, ang, bl, severed) {
  c.save(); c.translate(q.at[0], q.at[1]); c.rotate(ang); c.strokeStyle = q.col; c.lineWidth = q.w; c.lineCap = 'round';
  if (q.curl) { // tails bend along their length
    const n = 4, sl = q.len / n; let px = 0, py = 0, a = 0; c.beginPath(); c.moveTo(0, 0); for (let i = 0; i < n; i++) { a += ang * 0.35; px += Math.sin(-a) * sl; py += Math.cos(a) * sl; c.lineWidth = q.w * (1 - i / n * 0.6); c.lineTo(px, py); c.stroke(); c.beginPath(); c.moveTo(px, py); }
    if (q.belly) { c.strokeStyle = q.belly; c.lineWidth = q.w * 0.25; c.beginPath(); c.moveTo(0, 0); px = 0; py = 0; a = 0; for (let i = 0; i < n - 1; i++) { a += ang * 0.35; px += Math.sin(-a) * sl; py += Math.cos(a) * sl; c.lineTo(px, py); } c.stroke(); }
  } else { c.beginPath(); c.moveTo(0, 0); c.lineTo(0, q.len); c.stroke(); if (q.end) { c.fillStyle = q.endCol; c.beginPath(); c.arc(0, q.len, q.end, 0, 7); c.fill(); } }
  if (severed) stumpAt(c, 0, 0, q.w, bl);
  c.restore();
}
function drawHead(c, h, up, r) {
  const t = h.type, hr = h.r;
  if (t === 'skull') { c.fillStyle = BONE; c.beginPath(); c.arc(0, 0, hr, 0, 7); c.fill(); if (up) { c.fillStyle = '#1a1612'; c.beginPath(); c.arc(-hr * 0.38, -hr * 0.05, hr * 0.26, 0, 7); c.arc(hr * 0.38, -hr * 0.05, hr * 0.26, 0, 7); c.fill(); c.fillRect(-hr * 0.35, hr * 0.45, hr * 0.7, hr * 0.15); } return; }
  if (t === 'wolf') { c.fillStyle = FUR; c.beginPath(); c.ellipse(0, 0, hr * 0.9, hr * 1.1, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(0, -hr * 1.1, hr * 0.5, hr * 0.7, 0, 0, 7); c.fill(); c.fillStyle = '#2a241e'; c.beginPath(); c.arc(0, -hr * 1.7, hr * 0.22, 0, 7); c.fill(); c.beginPath(); c.moveTo(-hr * 0.7, hr * 0.3); c.lineTo(-hr * 1.1, hr * 0.9); c.lineTo(-hr * 0.3, hr * 0.6); c.moveTo(hr * 0.7, hr * 0.3); c.lineTo(hr * 1.1, hr * 0.9); c.lineTo(hr * 0.3, hr * 0.6); c.fill(); if (up) { c.fillStyle = '#f4f0e0'; c.fillRect(-hr * 0.3, -hr * 1.4, hr * 0.15, hr * 0.3); c.fillRect(hr * 0.15, -hr * 1.4, hr * 0.15, hr * 0.3); } return; }
  if (t === 'beast') { c.fillStyle = HIDE; c.beginPath(); c.ellipse(0, 0, hr * 0.95, hr * 1.1, 0, 0, 7); c.fill(); c.fillStyle = '#2a1a12'; c.beginPath(); c.ellipse(0, -hr * 0.9, hr * 0.55, hr * 0.45, 0, 0, 7); c.fill(); c.fillStyle = '#e8dcc0'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * hr * 0.5, hr * 0.2); c.quadraticCurveTo(sx * hr * 1.5, hr * 0.4, sx * hr * 1.6, hr * 1.3); c.lineTo(sx * hr * 0.7, hr * 0.6); c.fill(); } if (up) { c.fillStyle = '#ffb030'; c.beginPath(); c.arc(-hr * 0.4, -hr * 0.2, hr * 0.12, 0, 7); c.arc(hr * 0.4, -hr * 0.2, hr * 0.12, 0, 7); c.fill(); } return; }
  if (['zombie', 'gnoll', 'goblin', 'troll', 'cowl', 'golem'].includes(t)) { drawUpHead(c, t, hr / 0.48, 1, h.skin, h.col || '#666666'); if (!up && t !== 'golem') { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(0, 0, hr * 0.9, 0, 7); c.fill(); } return; }
  if (t === 'crown') { for (const [px, py, s2, cl] of [[0, 0, 0.75, LEAF], [-0.55, 0.3, 0.5, '#3e6a2a'], [0.55, 0.25, 0.55, '#3e6a2a'], [0.1, -0.5, 0.45, '#5a8a3a'], [-0.3, -0.35, 0.35, '#5a8a3a']]) { c.fillStyle = cl; c.beginPath(); c.arc(px * hr, py * hr, s2 * hr, 0, 7); c.fill(); } return; }
  if (t === 'horse') { c.fillStyle = HORSE; c.beginPath(); c.ellipse(0, -hr * 0.4, hr * 0.7, hr * 1.4, 0, 0, 7); c.fill(); c.fillStyle = '#3a2a1a'; c.fillRect(-hr * 0.15, -hr * 0.2, hr * 0.3, hr * 1.3); c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(-hr * 0.2, -hr * 1.6, hr * 0.12, 0, 7); c.arc(hr * 0.2, -hr * 1.6, hr * 0.12, 0, 7); c.fill(); return; }
  if (t === 'mammoth') { c.fillStyle = '#6a4a30'; c.beginPath(); c.arc(0, 0, hr * 1.1, 0, 7); c.fill(); c.strokeStyle = '#5a3c26'; c.lineWidth = hr * 0.35; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -hr * 0.6); c.quadraticCurveTo(hr * 0.3, -hr * 1.6, 0, -hr * 2.2); c.stroke(); c.strokeStyle = '#f4ecd8'; c.lineWidth = hr * 0.2; c.beginPath(); c.moveTo(-hr * 0.5, -hr * 0.6); c.quadraticCurveTo(-hr * 1.4, -hr * 1.5, -hr * 0.7, -hr * 2.0); c.moveTo(hr * 0.5, -hr * 0.6); c.quadraticCurveTo(hr * 1.4, -hr * 1.5, hr * 0.7, -hr * 2.0); c.stroke(); return; }
  if (t === 'knight') { c.fillStyle = '#b8bec8'; c.beginPath(); c.arc(0, 0, hr, 0, 7); c.fill(); if (up) { c.fillStyle = '#2a2a2a'; c.fillRect(-hr * 0.6, -hr * 0.1, hr * 1.2, hr * 0.18); } c.fillStyle = h.col || '#aa3333'; c.beginPath(); c.ellipse(0, hr * 0.9, hr * 0.3, hr * 0.7, 0, 0, 7); c.fill(); return; }
  const skin = t === 'naga' ? NAGA_SKIN : t === 'orc' ? ORC_SKIN : (t === 'ogre' || t === 'chief') ? OGRE_SKIN : SKIN;
  if (up) { c.fillStyle = skin; c.beginPath(); c.arc(0, -hr * 0.1, hr, 0, 7); c.fill(); c.fillStyle = '#2a1a10'; c.fillRect(-hr * 0.45, -hr * 0.1, hr * 0.2, hr * 0.2); c.fillRect(hr * 0.25, -hr * 0.1, hr * 0.2, hr * 0.2); }
  else { c.fillStyle = skin; c.beginPath(); c.arc(0, -hr * 0.1, hr, 0, 7); c.fill(); }
  if (t === 'human') { c.fillStyle = '#6a6a72'; if (up) { c.beginPath(); c.arc(0, -hr * 0.3, hr * 1.04, Math.PI, 0); c.fill(); } else { c.beginPath(); c.arc(0, -hr * 0.1, hr * 1.08, 0, 7); c.fill(); c.fillStyle = '#55555c'; c.fillRect(-hr * 0.15, -hr * 1.1, hr * 0.3, hr * 2); } }
  else if (t === 'scout') { c.fillStyle = mix(h.hood && h.hood.startsWith('#') ? h.hood : '#666666', '#000000', 0.35); c.beginPath(); c.arc(0, up ? -hr * 0.45 : -hr * 0.1, hr * 1.08, up ? Math.PI : 0, up ? 0 : 7); c.fill(); }
  else if (t === 'ogre' || t === 'chief' || t === 'orc') { if (t === 'chief') { c.fillStyle = '#7a7a84'; c.beginPath(); c.arc(0, -hr * 0.3, hr * 1.05, Math.PI, 0); c.fill(); } c.fillStyle = '#ddd'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * hr * 0.7, -hr * 0.5); c.lineTo(sx * hr * (t === 'chief' ? 1.9 : 1.4), -hr * (t === 'chief' ? 1.4 : 1.1)); c.lineTo(sx * hr * 0.4, -hr * 0.8); c.fill(); } if (up) { c.fillStyle = '#f4f0e0'; c.fillRect(-hr * 0.42, hr * 0.5, hr * 0.16, hr * 0.32); c.fillRect(hr * 0.26, hr * 0.5, hr * 0.16, hr * 0.32); } }
  else if (t === 'naga') { c.fillStyle = '#2a6a5a'; c.beginPath(); c.moveTo(-hr * 0.7, -hr * 0.4); c.lineTo(0, -hr * 1.9); c.lineTo(hr * 0.7, -hr * 0.4); c.fill(); if (up) { c.fillStyle = '#ffd040'; c.fillRect(-hr * 0.5, -hr * 0.1, hr * 0.25, hr * 0.15); c.fillRect(hr * 0.25, -hr * 0.1, hr * 0.25, hr * 0.15); } }
}
function drawTorso(c, b) {
  const T = b.rig.torso, up = b.faceUp, rx = T.rx, ry = T.ry;
  c.fillStyle = up && T.under ? T.under : up ? T.col : mix(T.col.startsWith('#') ? T.col : '#888888', '#000000', 0.25); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill();
  if (b.rig.B === 'human') { if (up) { c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(rx * 0.2, ry * 0.2, rx * 0.6, ry * 0.6, 0, 0, 7); c.fill(); c.fillStyle = '#5a3a20'; c.fillRect(-rx, ry * 0.15, rx * 2, ry * 0.2); } else { c.strokeStyle = '#5a3a20'; c.lineWidth = rx * 0.22; c.beginPath(); c.moveTo(-rx * 0.7, -ry * 0.7); c.lineTo(rx * 0.7, ry * 0.7); c.stroke(); } if (T.armor) { c.fillStyle = '#8a8a94'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * rx * 0.8, -ry * 0.5, rx * 0.42, ry * 0.3, 0, 0, 7); c.fill(); } } }
  if (T.plate) { c.fillStyle = T.plate; c.fillRect(-rx * 0.5, -ry * 0.5, rx, ry * 0.65); }
  if (T.bark) { c.strokeStyle = '#3a2a18'; c.lineWidth = rx * 0.12; c.beginPath(); for (const x0 of [-0.4, 0, 0.4]) { c.moveTo(rx * x0, -ry * 0.8); c.lineTo(rx * x0 + rx * 0.1, ry * 0.8); } c.stroke(); c.fillStyle = T.cloth; c.fillRect(-rx, -ry * 0.05, rx * 2, ry * 0.16); }
  if (T.howdah && !up) { c.fillStyle = '#6a4a2a'; c.fillRect(-rx * 0.6, -ry * 0.45, rx * 1.2, ry * 0.8); c.fillStyle = T.howdah; c.fillRect(-rx * 0.5, -ry * 0.35, rx, ry * 0.6); }
  if (T.ribs) { c.strokeStyle = '#7a7466'; c.lineWidth = rx * 0.15; c.beginPath(); for (const y of [-0.45, -0.1, 0.25]) { c.moveTo(-rx * 0.8, ry * y); c.lineTo(rx * 0.8, ry * y); } c.moveTo(0, -ry * 0.85); c.lineTo(0, ry * 0.85); c.stroke(); c.fillStyle = T.cloth; c.globalAlpha = 0.85; c.fillRect(-rx * 0.6, -ry * 0.1, rx * 1.2, ry * 0.8); c.globalAlpha = 1; }
  if (T.spikes && !up) { c.fillStyle = '#e8dcc0'; for (let i = 0; i < 6; i++) { const y = -ry * 0.75 + i * ry * 0.3; c.beginPath(); c.moveTo(-rx * 0.15, y); c.lineTo(0, y - ry * 0.22); c.lineTo(rx * 0.15, y); c.fill(); } c.fillStyle = T.cloth; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(0, ry * 0.1, rx * 0.6, ry * 0.35, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
}
function drawRag(c, b) {
  const rig = b.rig, p = b.pose, bl = BLOODS[rig.blood], r = b.r;
  c.save(); c.translate(b.x, b.y - b.z); c.rotate(b.rot); if (b.tint) c.globalAlpha *= 1;
  for (const q of rig.parts) if (q.back) { if (b.miss[q.j]) stumpAt(c, q.at[0], q.at[1], q.w, bl); else drawLimb(c, q, p[q.j] || 0, bl); }
  drawTorso(c, b);
  for (const q of rig.parts) if (!q.back) { if (b.miss[q.j]) { stumpAt(c, q.at[0], q.at[1], q.w, bl); continue; } drawLimb(c, q, p[q.j] || 0, bl); if (q.weapon && b.weapon) { c.save(); c.translate(q.at[0], q.at[1]); c.rotate(p[q.j] || 0); c.translate(0, q.len); c.rotate(1.2); drawWeapon(c, q.weapon, r); c.restore(); } }
  if (!b.miss.hd) { c.save(); c.translate(0, rig.head.y); c.rotate(p.hd || 0); drawHead(c, rig.head, b.faceUp, r); c.restore(); } else stumpAt(c, 0, rig.head.y + rig.head.r * 0.6, rig.head.r, bl);
  c.restore();
}
// a severed piece: a limb, a head, a weapon or a chunk
function drawPiece(c, p) {
  const s = p.piece, bl = BLOODS[s.blood]; c.save(); c.translate(p.x, p.y - p.z); c.rotate(p.rot);
  if (s.kind === 'limb') { c.translate(-s.q.at[0], -s.q.at[1] - s.q.len * 0.5); drawLimb(c, s.q, s.ang || 0, bl, true); }
  else if (s.kind === 'head') { drawHead(c, s.h, s.up, s.r); if (bl) { c.fillStyle = bl[0]; c.fillRect(-s.h.r * 0.5, s.h.r * 0.75, s.h.r, s.h.r * 0.3); } }
  else if (s.kind === 'weapon') drawWeapon(c, s.w, s.r);
  else if (s.kind === 'chunk') { c.fillStyle = s.col; c.beginPath(); c.ellipse(0, 0, s.r * 0.45, s.r * 0.35, 0, 0, 7); c.fill(); if (bl) { c.fillStyle = bl[1]; c.beginPath(); c.ellipse(0, -s.r * 0.15, s.r * 0.3, s.r * 0.15, 0, 0, 7); c.fill(); } }
  c.restore();
}

// ---------- towers: each fits inside its 2x2 cells (48x48), skinny bodies on wider bases ----------
// local box: x -24..24, y -24..24, ground at y +14
// ---------- Archer Post: five levels, each a different build (from the level demo) ----------
function archerMuzzles(l) {
  if (l === 1) return [[0, -27]];
  if (l === 2) return [[-6, -27], [6, -27]];
  if (l === 3) return [[-10, -33], [0, -33], [10, -33]];
  if (l === 4) return [[-13, -37], [-4.5, -37], [4.5, -37], [13, -37]];
  return [[-10, -5], [0, -5], [10, -5], [-10, -19], [10, -19]];   // level 5: arrow slits, two floors
}

function archerMan(c, ax, ay, aim, kick, col) {
  c.save(); c.translate(ax, ay);
  c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 3.4, 3, 0, 0, 7); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.arc(0, -4.2, 2.2, 0, 7); c.fill(); c.fillStyle = mix(col, '#000000', 0.35); c.beginPath(); c.arc(0, -4.8, 2.3, Math.PI, 0); c.fill();
  c.rotate(aim); c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.2; c.beginPath(); c.arc(3.5 - kick * 1.5, 0, 3.6, -1.3, 1.3); c.stroke();
  c.strokeStyle = '#d8d0c0'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(3.5 - kick * 1.5 + Math.cos(-1.3) * 3.6, Math.sin(-1.3) * 3.6); c.lineTo(1 - kick * 2, 0); c.lineTo(3.5 - kick * 1.5 + Math.cos(1.3) * 3.6, Math.sin(1.3) * 3.6); c.stroke();
  c.restore();
}
function archerPennant(c, px, py, h, col, t) { c.fillStyle = '#3a2a1a'; c.fillRect(px - 0.7, py - h, 1.4, h); c.fillStyle = col; const w = Math.sin(t * 4 + px) * 1.2; c.beginPath(); c.moveTo(px + 0.7, py - h); c.quadraticCurveTo(px + 5, py - h + 1.5 + w, px + 9, py - h + 2.5 + w); c.lineTo(px + 0.7, py - h + 5); c.fill(); }
function archerLvl(c, T, t, COL) {
  const L = T.lvl, A = T.archers; c.save(); c.translate(T.x, T.y);
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(3, 14, L >= 4 ? 21 : 18, 6, 0, 0, 7); c.fill();
  if (L <= 2) {
    // wooden four-post watchtower (today's tower)
    c.fillStyle = '#5a3d22'; c.beginPath(); c.ellipse(0, 14, 17, 5, 0, 0, 7); c.fill();
    c.strokeStyle = '#7a5530'; c.lineWidth = 3; for (const [px, py] of [[-13, 15], [13, 15], [-9, 10], [9, 10]]) { c.beginPath(); c.moveTo(px, py); c.lineTo(px * 0.75, -6); c.stroke(); }
    c.strokeStyle = '#5a3d22'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-12, 13); c.lineTo(9, -4); c.moveTo(12, 13); c.lineTo(-9, -4); c.moveTo(-12, 4); c.lineTo(12, 4); c.stroke();
    c.fillStyle = '#8a6238'; c.fillRect(-14, -9, 28, 5); c.fillStyle = '#6a4a28'; c.fillRect(-14, -4, 28, 2);
    archerMuzzles(L).forEach((m, i) => archerMan(c, m[0], m[1] + 14, A[i].aim, A[i].kick, COL));
    c.fillStyle = '#9a7244'; for (let i = -13; i <= 11; i += 4) c.fillRect(i, -15, 2.4, 6); c.fillRect(-14, -15, 28, 1.6);
    archerPennant(c, -14, -15, 10, COL, t);
  } else if (L === 3) {
    // solid timber tower: planked walls, archers on a roofed platform
    c.fillStyle = '#5a3d22'; c.beginPath(); c.moveTo(-16, 15); c.lineTo(16, 15); c.lineTo(13, -10); c.lineTo(-13, -10); c.fill();
    c.fillStyle = '#7a5530'; c.beginPath(); c.moveTo(-15, 14); c.lineTo(15, 14); c.lineTo(12.5, -9); c.lineTo(-12.5, -9); c.fill();
    c.strokeStyle = '#5a3d22'; c.lineWidth = 0.8; for (let i = -12; i <= 12; i += 3) { c.beginPath(); c.moveTo(i * 1.15, 14); c.lineTo(i, -9); c.stroke(); }
    c.fillStyle = '#4a3218'; c.fillRect(-15, 3, 30, 2); c.fillRect(-14, -4, 28, 1.6);
    c.fillStyle = '#2a1a0e'; c.fillRect(-3, 6, 6, 8); c.fillStyle = '#8a6238'; c.fillRect(-16, -13, 32, 4);
    c.fillStyle = '#6a4a28'; for (const px of [-15, 15]) c.fillRect(px - 1.2, -34, 2.4, 22);
    archerMuzzles(3).forEach((m, i) => archerMan(c, m[0], m[1] + 14, A[i].aim, A[i].kick, COL));
    c.fillStyle = '#9a7244'; c.fillRect(-16, -18, 32, 1.8); for (let i = -15; i <= 13; i += 4) c.fillRect(i, -18, 2, 5);
    c.save(); c.translate(0, 2);
    { // thatch: a lumpy straw cone with a ragged hem, sagging a little, one patch in the player's colour
      c.fillStyle = '#b8913e'; c.beginPath(); c.moveTo(-23, -35); c.quadraticCurveTo(-14, -47, -2, -55); c.quadraticCurveTo(2, -56, 4, -54); c.quadraticCurveTo(15, -47, 23, -36);
      for (let i = 0; i <= 12; i++) { const hx = 23 - i * 46 / 12, hy = -34 + (i % 2 ? 2.4 : 0) + Math.sin(i * 1.7) * 0.8; c.lineTo(hx, hy); } c.closePath(); c.fill();
      c.strokeStyle = '#8a6a2a'; c.lineWidth = 0.6; for (let i = -18; i <= 18; i += 3) { c.beginPath(); c.moveTo(i, -34.5 + Math.abs(i) * 0.04); c.lineTo(i * 0.25 + 1, -52 + Math.abs(i) * 0.3); c.stroke(); }
      c.strokeStyle = '#6a4a1a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-20, -39); c.quadraticCurveTo(0, -42, 20, -39.5); c.stroke(); c.beginPath(); c.moveTo(-12, -46); c.quadraticCurveTo(1, -48.5, 13, -46.5); c.stroke();
      c.fillStyle = COL; c.beginPath(); c.moveTo(6, -44); c.lineTo(13, -43); c.lineTo(12, -38); c.lineTo(5.5, -38.5); c.fill(); c.strokeStyle = '#e8dcc6'; c.lineWidth = 0.4; c.setLineDash([0.8, 0.8]); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#3a2a1a'; c.fillRect(0, -58, 1.4, 5);
    }
    c.restore(); archerPennant(c, 0.7, -55, 7, COL, t);
  } else if (L === 4) {
    // shabby stone: uneven blocks, gaps, moss; a timber hoarding on top
    c.fillStyle = '#5c5850'; c.beginPath(); c.moveTo(-18, 15); c.lineTo(18, 15); c.lineTo(15, -14); c.lineTo(-15, -14); c.fill();
    const rows = [[15, 9], [9, 3], [3, -3], [-3, -9], [-9, -14]], seed = [3, 7, 2, 9, 5, 1, 8, 4, 6, 0, 7, 3, 5, 2];
    rows.forEach(([y0, y1], ri) => { let xx = -18 + ri * 0.6 + (ri % 2) * 3; const half = 18 - ri * 0.7; let k = 0; while (xx < half - 1) { const w = 5 + seed[(ri * 3 + k) % 14] * 0.6, xe = Math.min(half, xx + w); const shade = ['#8a857a', '#7c776c', '#948f83', '#6f6a60'][(ri + k) % 4]; c.fillStyle = shade; c.fillRect(xx + 0.5, y1 + 0.5, xe - xx - 1, y0 - y1 - 1); if ((ri + k) % 5 === 2) { c.fillStyle = '#5a7a3a'; c.fillRect(xx + 1, y0 - 2, 3, 1.4); } xx = xe + 0.4; k++; } });
    c.strokeStyle = '#3a3630'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(6, -12); c.lineTo(8, -5); c.lineTo(6.5, 1); c.moveTo(-10, 8); c.lineTo(-7, 12); c.stroke();
    c.fillStyle = '#2a2420'; c.beginPath(); c.moveTo(-3, 15); c.lineTo(-3, 8); c.quadraticCurveTo(0, 5, 3, 8); c.lineTo(3, 15); c.fill();
    c.fillStyle = '#6a4a28'; c.fillRect(-18, -18, 36, 4.5); c.fillStyle = '#5a3d22'; for (const px of [-16, -6, 6, 16]) { c.beginPath(); c.moveTo(px, -14); c.lineTo(px + (px < 0 ? 3 : -3), -6); c.lineWidth = 1.4; c.strokeStyle = '#5a3d22'; c.stroke(); }
    archerMuzzles(4).forEach((m, i) => archerMan(c, m[0], m[1] + 14, A[i].aim, A[i].kick, COL));
    c.fillStyle = '#8a6238'; c.fillRect(-18, -23, 36, 1.8); for (let i = -17; i <= 15; i += 3.4) c.fillRect(i, -23, 1.8, 5.5);
    c.strokeStyle = '#5a3d22'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-17, -22); c.lineTo(-16.4, -36); c.moveTo(17, -22); c.lineTo(16, -36.5); c.stroke();
    c.fillStyle = mix(COL, '#000000', 0.25); c.beginPath(); c.moveTo(-22, -35); c.lineTo(0, -49); c.lineTo(22, -35); c.closePath(); c.fill();
    c.fillStyle = COL; c.beginPath(); c.moveTo(-22, -35); c.lineTo(0, -49); c.lineTo(0, -35); c.fill();
    c.strokeStyle = mix(COL, '#000000', 0.45); c.lineWidth = 0.6; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-22 + i * 3.8, -35 - i * 2.55 + 0.2); c.lineTo(22 - i * 3.8, -35 - i * 2.55 + 0.2); c.stroke(); }
    archerPennant(c, 0, -49, 8, COL, t);
    c.fillStyle = COL; c.beginPath(); c.moveTo(14, -8); c.lineTo(19, -8); c.lineTo(19, 2); c.lineTo(17.5, 0); c.lineTo(16, 3); c.lineTo(14, 0); c.fill();
  } else {
    // solid stone keep: clean courses, arrow slits on two floors, crenellations, a conical cap in the player's colour
    const g = c.createLinearGradient(-16, 0, 16, 0); g.addColorStop(0, '#9a968c'); g.addColorStop(0.55, '#b8b4aa'); g.addColorStop(1, '#827e74');
    c.fillStyle = '#6a665e'; c.fillRect(-19, 9, 38, 6);
    c.fillStyle = g; c.fillRect(-16, -26, 32, 36);
    c.strokeStyle = 'rgba(60,56,50,.55)'; c.lineWidth = 0.6; for (let y = 6; y > -26; y -= 4.5) { c.beginPath(); c.moveTo(-16, y); c.lineTo(16, y); c.stroke(); const off = (Math.round(y) % 2) ? 0 : 4; for (let xx = -16 + off; xx < 16; xx += 8) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y - 4.5); c.stroke(); } }
    c.fillStyle = '#a8a49a'; c.fillRect(-18, -30, 36, 4); for (let k = 0; k < 7; k++) c.fillRect(-18 + k * 5.5, -35, 3, 5);
    c.fillStyle = mix(COL, '#000000', 0.3); c.beginPath(); c.moveTo(-14, -35); c.lineTo(0, -52); c.lineTo(14, -35); c.fill(); c.fillStyle = COL; c.beginPath(); c.moveTo(-14, -35); c.lineTo(0, -52); c.lineTo(0, -35); c.fill();
    archerPennant(c, 0, -52, 9, COL, t);
    c.fillStyle = COL; c.fillRect(-4, -24, 8, 11); c.fillStyle = '#e8d070'; c.beginPath(); c.moveTo(-2, -21); c.lineTo(0, -17); c.lineTo(2, -21); c.fill();
    c.fillStyle = '#2a2420'; c.beginPath(); c.moveTo(-3.5, 15); c.lineTo(-3.5, 6); c.quadraticCurveTo(0, 2.5, 3.5, 6); c.lineTo(3.5, 15); c.fill();
    // arrow slits; the archer inside shows as a shadow and a glint when they loose
    archerMuzzles(5).forEach((m, i) => { const sx = m[0], sy = m[1]; c.fillStyle = '#1a1612'; c.fillRect(sx - 1, sy - 4, 2, 8); c.fillRect(sx - 2.5, sy - 0.8, 5, 1.6); if (A[i].kick > 0.4) { c.fillStyle = `rgba(255,230,170,${A[i].kick * 0.8})`; c.fillRect(sx - 0.8, sy - 3, 1.6, 6); } else { c.fillStyle = mix(COL, '#000000', 0.5); c.fillRect(sx - 0.8, sy - 1, 1.6, 2.5); } });
  }
  c.restore();
}
// ---------- 3-second construction: the tower rises behind scaffolding while workers do the job that fits its material ----------

const ARCHER_TOPS = [0, -30, -30, -55, -50, -54];
function bWorker(c, wx, wy, f, tool, swing) { // tiny labourer: tunic, cap, and whatever tool
  c.save(); c.translate(wx, wy);
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-1, 2); c.lineTo(-1.6, 5); c.moveTo(1, 2); c.lineTo(1.6, 5); c.stroke();
  c.fillStyle = '#b07a3a'; c.beginPath(); c.ellipse(0, 0, 2.6, 2.8, 0, 0, 7); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.arc(0, -3.6, 1.8, 0, 7); c.fill(); c.fillStyle = '#e0b030'; c.beginPath(); c.arc(0, -4, 1.9, Math.PI, 0); c.fill();
  c.translate(f * 1.6, -0.8);
  if (tool === 'saw') { c.translate(swing * 2.4 * f, 0); c.fillStyle = '#c8ccd2'; c.beginPath(); c.moveTo(0, 0); c.lineTo(f * 8, 1.5); c.lineTo(f * 8, 3); c.lineTo(0, 1.6); c.fill(); c.fillStyle = '#6a4a2a'; c.fillRect(-f * 1.6 - 0.8, -0.4, 1.8, 2.6); }
  else { c.rotate(f * (-1.2 + swing * 1.5)); c.fillStyle = '#6a4a2a'; c.fillRect(-0.45, -6, 0.9, 6.5); c.fillStyle = tool === 'mallet' ? '#8a6a44' : '#5a5f68'; c.fillRect(-1.7, -7.4, 3.4, tool === 'mallet' ? 2.4 : 1.7); }
  c.restore();
}
// stateless flying bits: chips, dust or sawdust thrown up at a point, timed to the tool strikes
function bBits(c, px, py, t, rate, col, n, spread) { for (let k = 0; k < n; k++) { const ph = (t * rate + k / n) % 1, dir = ((k * 7919) % 13) / 13 - 0.5; c.globalAlpha = 1 - ph; c.fillStyle = col; c.fillRect(px + dir * spread * ph * 2, py - Math.sin(ph * Math.PI) * spread * 0.7 + ph * 3, 1.1, 1.1); } c.globalAlpha = 1; }
function archerBuild(c, T, t, COL) {
  const L = T.lvl, p = Math.max(0, Math.min(1, 1 - T.build / (L > 1 ? TD.RULES.levelTime : TD.RULES.buildTime))), top = ARCHER_TOPS[L], cutY = 15 + (top - 15) * p, solid = { ...T, build: 0 };
  c.save(); c.globalAlpha = 0.16; archerLvl(c, solid, t, COL); c.restore();
  c.save(); c.beginPath(); c.rect(T.x - 45, T.y + cutY, 90, 15 - cutY + 6); c.clip(); archerLvl(c, solid, t, COL); c.restore();
  c.save(); c.translate(T.x, T.y);
  // scaffold climbs with the build
  const sTop = Math.min(10, cutY - 3); c.strokeStyle = '#a07a48'; c.lineWidth = 1.1;
  for (const px of [-20, 20]) { c.beginPath(); c.moveTo(px, 15); c.lineTo(px, sTop); c.stroke(); }
  for (let y = 9; y > sTop; y -= 9) { c.fillStyle = '#8a6238'; c.fillRect(-21, y, 42, 1.4); c.strokeStyle = '#7a5530'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-20, y); c.lineTo(20, y - 9 > sTop ? y - 9 : sTop); c.stroke(); }
  const hit = Math.abs(Math.sin(t * 9 + L)), saw = Math.sin(t * 13), lift = (t * 0.5) % 1;
  if (L <= 3) { // a log on trestles being sawn
    c.fillStyle = '#5a3d22'; for (const tx of [-27, -17]) { c.fillRect(tx - 0.6, 9, 1.2, 6); c.fillRect(tx - 2.5, 9, 5, 1); }
    c.fillStyle = '#8a6238'; c.fillRect(-30, 6.5, 16, 3); c.fillStyle = '#c8a070'; c.beginPath(); c.arc(-30, 8, 1.5, 0, 7); c.fill();
    bWorker(c, -13, 6, -1, 'saw', saw); bBits(c, -21, 10, t, 2.2, '#e8d0a0', 7, 6);
  }
  if (L === 3 || L === 2) { // someone up on the scaffold nailing planks
    const y = Math.max(sTop + 2, -4); bWorker(c, 15, y - 5, -1, 'hammer', hit > 0.85 ? 1 : hit); if (hit > 0.92) { c.fillStyle = '#fff4c0'; c.fillRect(10.5, y - 7, 1.2, 1.2); }
  }
  if (L === 4) { // rough stone: a mason knocks blocks into shape with a mallet and chisel
    c.fillStyle = '#8a857a'; c.fillRect(-31, 6, 9, 7); c.fillStyle = '#6f6a60'; c.fillRect(-31, 6, 9, 1.6);
    bWorker(c, -18, 7, -1, 'mallet', hit); bBits(c, -24, 7, t, 1.8, '#b8b4aa', 6, 7);
    bWorker(c, 14, Math.max(sTop + 2, -6) - 5, -1, 'hammer', Math.abs(Math.sin(t * 7 + 2)));
  }
  if (L === 5) { // the keep: blocks hoisted up a crane while a mason dresses stone below
    c.strokeStyle = '#6a4a28'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(26, 15); c.lineTo(26, -52); c.lineTo(6, -52); c.stroke(); c.lineWidth = 0.8; c.beginPath(); c.moveTo(26, -40); c.lineTo(18, -52); c.stroke();
    const by = 12 + (cutY - 10 - 12) * (lift < 0.8 ? lift / 0.8 : 1); c.strokeStyle = '#d8d0c0'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(8, -52); c.lineTo(8, by - 3); c.stroke();
    c.fillStyle = '#b8b4aa'; c.fillRect(5, by - 3, 6, 4.5); c.fillStyle = '#9a968c'; c.fillRect(5, by - 3, 6, 1);
    c.fillStyle = '#b8b4aa'; c.fillRect(-31, 7, 8, 6); bWorker(c, -18, 7, -1, 'hammer', hit); bBits(c, -23, 7, t, 2, '#d8d4ca', 6, 6);
  }
  // progress bar
  c.fillStyle = '#000a'; c.fillRect(-16, 18, 32, 3.5); c.fillStyle = '#f0c419'; c.fillRect(-15.5, 18.5, 31 * p, 2.5);
  c.restore();
}

const archerSlots = () => [0, 1, 2, 3, 4].map(() => ({ aim: 1.1, kick: 0 }));
function towerBody(c, k, col, aim, now, kick, seed, lvl) {
  if (k === 'archer') { archerLvl(c, { lvl: lvl || 1, x: 0, y: 0, archers: Array.isArray(aim) ? aim : archerSlots().map(a => (a.aim = aim, a)) }, now, col); return; }
  const dark = mix(col, '#000000', 0.35), light = mix(col, '#ffffff', 0.25);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(3, 16, 22, 7, 0, 0, 7); c.fill();
  if (k === 'cannon') {
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
    FB.draw(c, { lvl: lvl || 1, col, ph: now * 4.2 + seed, pos: now * 1.1 + seed, att: 0 }, now);
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
// ===== Firebreather (ported from the approved demo; flat vector, drawn in the tower's local space) =====
const FB = (() => {
  let COL = '#3a7bd5'; const SC = 1.45; // flame licks a bit bigger than the demo: game ranges are longer
  let capK = 1; // thins every flame stream when lots of Firebreathers fire at once
function srand(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function makeStones(L, seed) {
  const R = srand(seed), out = [], sh = ['#8e8a82', '#a29e95', '#77736b', '#968b7b', '#6d6a64'];
  const poly = sz => { const n = 5 + Math.floor(R() * 3), v = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R() * 0.5; v.push([Math.cos(a) * sz * (0.75 + R() * 0.4), Math.sin(a) * sz * 0.62 * (0.75 + R() * 0.4)]); } return v; };
  if (L < 4) {
    const n = 12; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + (R() - 0.5) * 0.25, sz = 2.2 + R() * 2.4; out.push({ a, x: Math.cos(a) * 20, y: Math.sin(a) * 8, z: 0, v: poly(sz), c: i % 3 === 1 ? COL : sh[Math.floor(R() * sh.length)], h: 1.6 + R() * 2 }); }
  } else {
    // five stacked piles with gaps between them
    for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2 + 0.35, n = 3 + (R() < 0.5 ? 1 : 0); let z = 0; for (let j = 0; j < n; j++) { const sz = (4.2 - j * 0.9) * (0.85 + R() * 0.3); out.push({ a, x: Math.cos(a) * 20 + (R() - 0.5) * 1.5, y: Math.sin(a) * 8, z, v: poly(sz), c: j === Math.floor((n - 1) / 2) ? COL : sh[Math.floor(R() * sh.length)], h: 1.8 + R() * 0.8 }); z += sz * 0.55 + 0.6; } }
  }
  return out;
}
// ---------- palette per level ----------
function pal(L) {
  return {
    outer: '#d9431e', mid: '#f2891c', core: L >= 3 ? '#ffe680' : '#ffd23f',
    white: [0, 0, 0.45, 0.75, 1][L - 1],   // white tinge at the base of fire
    blue: L >= 5 ? 1 : 0,
  };
}
// a flickering flame: layered teardrops, base at (fx, fy)
function flame(c, fx0, fy0, h, w, t, P, seed, hot) {
  const fl = k => Math.sin(t * (9 + k) + seed * 3.1 + k) * 0.5 + Math.sin(t * (14 + k * 2) + seed) * 0.5;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(fx0, fy0 - h * 0.35, 0, fx0, fy0 - h * 0.35, h * 1.3); g.addColorStop(0, 'rgba(255,150,40,.35)'); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(fx0, fy0 - h * 0.35, h * 1.3, 0, 7); c.fill(); c.restore();
  const tongue = (hh, ww, col, k) => { const sway = fl(k) * ww * 0.5, hgt = hh * (0.85 + 0.15 * fl(k + 3)); c.fillStyle = col; c.beginPath(); c.moveTo(fx0 - ww, fy0); c.bezierCurveTo(fx0 - ww * 1.05, fy0 - hgt * 0.45, fx0 + sway - ww * 0.25, fy0 - hgt * 0.7, fx0 + sway, fy0 - hgt); c.bezierCurveTo(fx0 + sway + ww * 0.25, fy0 - hgt * 0.7, fx0 + ww * 1.05, fy0 - hgt * 0.45, fx0 + ww, fy0); c.quadraticCurveTo(fx0, fy0 + ww * 0.45, fx0 - ww, fy0); c.fill(); };
  tongue(h, w, P.outer, 0); tongue(h * 0.55, w * 0.5, P.outer, 5); tongue(h * 0.78, w * 0.72, P.mid, 1); tongue(h * 0.5, w * 0.45, P.core, 2);
  const wt = Math.max(P.white, hot || 0);
  if (wt > 0) tongue(h * (0.18 + wt * 0.2), w * (0.22 + wt * 0.16), `rgba(255,253,244,${0.55 + wt * 0.45})`, 4);
  if (P.blue) { tongue(h * 0.12, w * 0.5, 'rgba(110,180,255,.85)', 6); tongue(h * 0.08, w * 0.26, 'rgba(225,242,255,.95)', 7); }
}
function stone(c, s) {
  c.save(); c.translate(s.x, s.y - s.z);
  c.fillStyle = 'rgba(0,0,0,.25)'; if (!s.z) { c.beginPath(); c.ellipse(0.8, 0.8, 4, 1.6, 0, 0, 7); c.fill(); }
  // side (darker) then top face
  c.fillStyle = shade(s.c, -0.3); c.beginPath(); s.v.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
  c.translate(0, -s.h); c.fillStyle = s.c; c.beginPath(); s.v.forEach((p, i) => i ? c.lineTo(p[0] * 0.92, p[1] * 0.92) : c.moveTo(p[0] * 0.92, p[1] * 0.92)); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(-s.v[0][0] * 0.2, -1, 1.4, 0.7, 0, 0, 7); c.fill();
  c.restore();
}
function shade(h, k) { const p = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return '#' + p.map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))).toString(16).padStart(2, '0')).join(''); }
function firePit(c, L, t, P) {
  if (L <= 2) {
    // small campfire: ash ring + two crossed logs
    c.fillStyle = '#3b3029'; c.beginPath(); c.ellipse(0, 0, 6, 2.6, 0, 0, 7); c.fill(); c.fillStyle = '#5a2d16'; c.beginPath(); c.ellipse(0, -0.3, 4, 1.6, 0, 0, 7); c.fill();
    log(c, -4.5, 1, 4.5, -1.2, 1.3); log(c, -4, -1.2, 4.2, 1, 1.3);
    flame(c, 0, -1, 9, 3.3, t, P, 1);
  } else {
    // pyre: a log crib, taller at level 5
    const layers = L >= 5 ? 5 : 3, lw = L >= 5 ? 1.6 : 1.5;
    c.fillStyle = '#3b3029'; c.beginPath(); c.ellipse(0, 0.5, 8.5, 3.4, 0, 0, 7); c.fill();
    for (let i = 0; i < layers; i++) { const y = -i * 1.9, wd = 6.2 - i * 0.35; if (i % 2 === 0) { log(c, -wd, y + 1.2, wd, y + 1.2, lw); log(c, -wd, y - 1.0, wd, y - 1.0, lw); } else { log(c, -wd * 0.6, y + 2, -wd * 0.6, y - 1.8, lw); log(c, wd * 0.6, y + 2, wd * 0.6, y - 1.8, lw); } }
    const top = -layers * 1.9 + 1;
    { const gy = top + layers * 0.95, g = c.createRadialGradient(0, gy, 0, 0, gy, 6); g.addColorStop(0, 'rgba(255,190,80,.55)'); g.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, gy, 6, layers * 1.1, 0, 0, 7); c.fill(); }
    flame(c, 0, top + 2, L >= 5 ? 22 : 15, L >= 5 ? 6.5 : 5.5, t, P, 2);
  }
}
function log(c, x1, y1, x2, y2, w) { c.strokeStyle = '#5b3a1f'; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = '#7a5130'; c.lineWidth = w * 0.4; c.beginPath(); c.moveTo(x1, y1 - w * 0.2); c.lineTo(x2, y2 - w * 0.2); c.stroke(); c.lineCap = 'butt'; }
function torchTo(c, hx, hy, ex, ey, t, P, seed, L, big) {
  const a = Math.atan2(ey - hy, ex - hx);
  c.strokeStyle = '#5b3a1f'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(hx - Math.cos(a) * 1.5, hy - Math.sin(a) * 1.5); c.lineTo(ex, ey); c.stroke();
  c.fillStyle = '#2b2018'; c.beginPath(); c.ellipse(ex, ey, 1.1, 1.3, a, 0, 7); c.fill();
  if (big < 0.85) flame(c, ex, ey, 5.2 * (1 - big), 1.6 * (1 - big * 0.6), t, P, seed, L >= 5 ? 1 : 0);
  else { c.fillStyle = '#ff7a2a'; c.beginPath(); c.arc(ex, ey, 0.6, 0, 7); c.fill(); } // just embers on the wraps
}
// headdress by level: none at 1, three feathers at 2, a full fan at 3, gold band at 4, ornate gold crown at 5
const GOLD = '#e8b923', GOLD_D = '#a87a12', GOLD_L = '#fff0a0';
function feather(c, x0, y0, ang, len, col, tip) {
  const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len, nx = -Math.sin(ang), ny = Math.cos(ang);
  c.fillStyle = col; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + ex) / 2 + nx * 0.9, (y0 + ey) / 2 + ny * 0.9, ex, ey); c.quadraticCurveTo((x0 + ex) / 2 - nx * 0.9, (y0 + ey) / 2 - ny * 0.9, x0, y0); c.fill();
  if (tip) { c.fillStyle = tip; c.beginPath(); c.arc(ex - Math.cos(ang) * 0.5, ey - Math.sin(ang) * 0.5, 0.55, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey); c.stroke();
}
function headdress(c, hx, hy, f, L, t) {
  if (L <= 1) return;
  const by = hy - 1.6, sway = Math.sin(t * 3) * 0.04, cols = [COL, '#f2ead8', '#d98a2b'];
  // feathers fan up and slightly back from the band
  const n = [0, 0, 3, 6, 6, 9][L], spread = [0, 0, 0.5, 1.2, 1.1, 1.9][L], len = [0, 0, 4.4, 4.8, 4.6, 5.6][L];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1) - 0.5, ang = -Math.PI / 2 - f * 0.35 + k * spread + sway, ln = len * (1 - Math.abs(k) * 0.45);
    const col = L >= 5 ? (i % 2 ? '#f6efe0' : COL) : cols[i % 3], tip = L >= 5 ? GOLD : L >= 4 && i % 2 === 0 ? GOLD : null;
    const base = L === 2 ? 0.6 : 2.2; // level 2's three feathers share one root on his head
    feather(c, hx + k * base, by + Math.abs(k) * (L === 2 ? 0.2 : 0.8), ang, ln, col, tip);
  }
  if (L >= 4) {
    // gold headband; level 5 adds a raised crest, a gem in the owner's colour and hanging gold strands
    c.fillStyle = GOLD_D; c.beginPath(); c.ellipse(hx, by + 0.4, 2.35, 0.8, 0, 0, 7); c.fill();
    c.fillStyle = GOLD; c.beginPath(); c.ellipse(hx, by + 0.15, 2.3, 0.6, 0, 0, 7); c.fill();
    if (L >= 5) {
      c.fillStyle = GOLD; c.beginPath(); c.moveTo(hx - 1.8, by); c.lineTo(hx - 1.2, by - 1.6); c.lineTo(hx - 0.6, by - 0.6); c.lineTo(hx, by - 2.2); c.lineTo(hx + 0.6, by - 0.6); c.lineTo(hx + 1.2, by - 1.6); c.lineTo(hx + 1.8, by); c.closePath(); c.fill();
      c.fillStyle = GOLD_L; for (const dx of [-1.2, 0, 1.2]) { c.beginPath(); c.arc(hx + dx, by - (dx ? 1.6 : 2.2), 0.3, 0, 7); c.fill(); }
      c.fillStyle = COL; c.beginPath(); c.ellipse(hx + f * 0.3, by + 0.05, 0.55, 0.45, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(hx + f * 0.15, by - 0.1, 0.15, 0, 7); c.fill();
      c.strokeStyle = GOLD; c.lineWidth = 0.35; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(hx + sx * 2.1, by + 0.4); c.quadraticCurveTo(hx + sx * 2.5, by + 2, hx + sx * 2.2, by + 3.4 + Math.sin(t * 4 + sx) * 0.2); c.stroke(); c.fillStyle = GOLD_L; c.beginPath(); c.arc(hx + sx * 2.2, by + 3.6 + Math.sin(t * 4 + sx) * 0.2, 0.35, 0, 7); c.fill(); }
    } else {
      c.fillStyle = GOLD_L; c.beginPath(); c.arc(hx + f * 0.4, by + 0.1, 0.35, 0, 7); c.fill();
    }
  }
}

// the firebreather: feet at (0,0); dance = phase, att = 0..1 blend into the breathing pose, aim = world angle
function man(c, s, dance, att, aim, t, P, L) {
  c.save(); c.scale(s, s);
  const ax = Math.cos(aim), ay = Math.sin(aim) * 0.6, px = -ay, py = ax; // aim on screen (squashed for the 3/4 view) and its perpendicular
  const faceIdle = Math.cos(dance + Math.PI / 2) >= 0 ? 1 : -1, f = att > 0.5 ? (ax >= 0 ? 1 : -1) : faceIdle;
  const bob = (1 - att) * Math.abs(Math.sin(dance * 2)) * 1.6, hipY = -6 - bob + att * 0.9; // knees bend when he braces
  const SK = '#a5653c', SKD = '#7f4a2a', PAINT = '#d9552a';
  const lx = ax * 2.4 * att, ly = (ay * 1.4 + 1.8) * att; // the hunch: upper body leans toward the target and drops
  const sh = hipY - 5.2, hx = lx * 1.35, hy = sh - 2.2 + ly * 1.3;
  const mouth = [hx + f * 1.9 * (1 - att * 0.4) + ax * 1.3 * att, hy + 0.7 + ay * 1.1 * att];
  const conv = [mouth[0] + ax * 3.4, mouth[1] + ay * 3.4 + 0.3 * att]; // the torch tips cross here, just in front of the mouth
  const two = L >= 2, lift = [0, 1.4];
  // torch grips: idle (waving overhead) and breathing (crossed in front of the mouth)
  const idleH = two ? [[-3.6 + Math.sin(dance * 2) * 1.2, sh - 4.5 - Math.cos(dance * 2) * 1.5], [3.6 - Math.sin(dance * 2) * 1.2, sh - 4.5 + Math.cos(dance * 2) * 1.5]] : [[f * 3.4 + Math.sin(dance * 2) * 1.5, sh - 5 - Math.abs(Math.cos(dance * 2)) * 1.2], [-f * 4, sh + 2.5 + Math.cos(dance * 2) * 1.2]];
  const idleT = idleH.map((h, i) => { const a = -Math.PI / 2 + (i ? 0.28 : -0.28) * (two ? 1 : f) + Math.sin(dance * 2 + i) * 0.2; return [h[0] + Math.cos(a) * 6.5, h[1] + Math.sin(a) * 6.5]; });
  const attH = two ? [[conv[0] + px * 3.8 - ax * 5 + lift[0], conv[1] + py * 3.8 - ay * 5 + lift[1]], [conv[0] - px * 3.8 - ax * 5 + lift[0], conv[1] - py * 3.8 - ay * 5 + lift[1]]] : [[conv[0] + px * 2.4 - ax * 5.5, conv[1] + py * 2.4 - ay * 5.5 + lift[1]], [-f * 2.6 + lx, sh + 3.6]];
  const attT = two ? [[conv[0] - px * 1.1, conv[1] - py * 1.1], [conv[0] + px * 1.1, conv[1] + py * 1.1]] : [conv, null];
  const L2 = (a, b) => [a[0] + (b[0] - a[0]) * att, a[1] + (b[1] - a[1]) * att];
  const hands = idleH.map((h, i) => L2(h, attH[i])), tips = idleT.map((p, i) => attT[i] ? L2(p, attT[i]) : null);
  const shL = [-2.4 + lx, sh + 0.8 + ly], shR = [2.4 + lx, sh + 0.8 + ly];
  const arm = (shp, hand) => { c.strokeStyle = SK; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(shp[0], shp[1]); c.quadraticCurveTo((shp[0] + hand[0]) / 2 + (hand[0] > shp[0] ? -0.6 : 0.6), (shp[1] + hand[1]) / 2 + 1, hand[0], hand[1]); c.stroke(); };
  const torches = () => { for (let i = 0; i < (two ? 2 : 1); i++) torchTo(c, hands[i][0], hands[i][1], tips[i][0], tips[i][1], t, P, i + 3, L, att); };
  const arms = () => { const lh = hands[0][0] <= hands[1][0] ? hands[0] : hands[1], rh = lh === hands[0] ? hands[1] : hands[0]; arm(shL, lh); arm(shR, rh); }; // each shoulder takes the hand on its own side, so the arms never cross
  const back = ay < -0.05 && att > 0.5; // aiming up the screen: torches go behind him
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(lx * 0.3, 0.4, 4 + att, 1.4, 0, 0, 7); c.fill();
  if (back) { torches(); arms(); }
  // legs: hopping dance or a wide, bent, braced stance
  const lk = Math.sin(dance * 2) * (1 - att), lf = [-2.2 - att * 1.2 + lk * 1.2, -Math.max(0, lk) * 2.4], rf = [2.2 + att * 1.2 + lk * 1.2, -Math.max(0, -lk) * 2.4];
  c.strokeStyle = SKD; c.lineWidth = 1.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-1, hipY); c.quadraticCurveTo(-2.4 - att, hipY + 2.4, lf[0], lf[1]); c.moveTo(1, hipY); c.quadraticCurveTo(2.4 + att, hipY + 2.4, rf[0], rf[1]); c.stroke();
  // torso (leaning), war paint, bone necklace
  c.fillStyle = SK; c.beginPath(); c.moveTo(-2, hipY); c.lineTo(-2.6 + lx, sh + 0.6 + ly); c.quadraticCurveTo(lx, sh - 0.8 + ly, 2.6 + lx, sh + 0.6 + ly); c.lineTo(2, hipY); c.closePath(); c.fill();
  c.strokeStyle = PAINT; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-1.6 + lx * 0.3, hipY - 1.6 + ly * 0.3); c.lineTo(1.6 + lx * 0.3, hipY - 2.4 + ly * 0.3); c.moveTo(-1.8 + lx * 0.55, hipY - 3 + ly * 0.55); c.lineTo(1.8 + lx * 0.55, hipY - 3.8 + ly * 0.55); c.stroke();
  c.fillStyle = '#efe6cf'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 0.9 + lx * 0.9, sh + 1.6 - Math.abs(i) * 0.25 + ly * 0.9, 0.38, 0, 7); c.fill(); }
  c.fillStyle = COL; c.beginPath(); c.moveTo(-2.3, hipY - 0.6); c.lineTo(2.3, hipY - 0.6); c.lineTo(1.5, hipY + 2.6); c.lineTo(-1.5, hipY + 2.6); c.closePath(); c.fill();
  c.fillStyle = '#6b4a2a'; c.fillRect(-2.4, hipY - 1, 4.8, 0.8);
  // head, pushed forward and down when he blows; cheeks puff out
  c.fillStyle = SK; c.beginPath(); c.arc(hx, hy, 2.1, 0, 7); c.fill();
  c.fillStyle = '#21140c'; c.beginPath(); c.arc(hx, hy - 0.4, 2.2, Math.PI * 1.02, Math.PI * 1.98); c.fill(); c.beginPath(); c.arc(hx - f * 0.6, hy - 2.4, 0.9, 0, 7); c.fill();
  c.strokeStyle = PAINT; c.lineWidth = 0.5; c.beginPath(); c.moveTo(hx + f * 0.5, hy - 0.2); c.lineTo(hx + f * 1.8, hy - 0.2); c.stroke();
  headdress(c, hx, hy, f, L, t);
  c.fillStyle = SKD; c.beginPath(); c.arc(hx + f * 1.9, hy + 0.3, 0.55 + att * 0.35, 0, 7); c.fill();
  if (!back) { arms(); torches(); }
  c.restore();
  return { conv: [conv[0] * s, conv[1] * s] };
}
// flame breath: a stream of burning puffs that leave the crossed torch tips, swell, cool and turn to smoke
const BREATH = {
  1: [[0, '#ffbe3a'], [0.22, '#f7861e'], [0.55, '#de4a1a'], [0.85, '#a82814']],                                   // deep orange-red
  2: [[0, '#fff27a'], [0.3, '#ffc63a'], [0.62, '#f5741c'], [0.88, '#c93618']],                                    // bright yellow-orange
  3: [[0, '#ffffff'], [0.22, '#fff3b0'], [0.45, '#ffc93a'], [0.72, '#f5741c'], [0.92, '#c93618']],                // white core
  4: [[0, '#ffffff'], [0.42, '#fffbea'], [0.6, '#ffe070'], [0.8, '#f5841c'], [0.95, '#c93618']],                  // mostly white
  5: [[0, '#3f8cff'], [0.18, '#8cc4ff'], [0.36, '#e8f4ff'], [0.55, '#ffffff'], [0.75, '#ffd24a'], [0.92, '#f0641c']], // blue into white-hot
};
const LEN = [0, 1, 1.1, 1.2, 1.3, 1.4]; // flame length (and reach), by level
const COUNT = [0, 1, 1.1, 1.2, 1.3, 1.4 * 1.4]; // flame licks in the stream, by level
const WIDE = [0, 1, 1.1, 1.2, 1.3, 1.4]; // cone width by level
const SPEED = [0, 0.5, 0.675, 0.85, 1.025, 1.2]; // how fast the breath moves, by level (range stays the same)
function breathCol(L, u) { const st = BREATH[L]; let i = 0; while (i < st.length - 1 && st[i + 1][0] <= u) i++; if (i === st.length - 1) return st[i][1]; const [u0, a] = st[i], [u1, b] = st[i + 1]; return mixC(a, b, (u - u0) / (u1 - u0)); }
function mixC(a, b, k) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
function emitBreath(T, dt) {
  T.fp = T.fp || []; if (T.cone < 0.3) return;
  const m = SPEED[T.lvl]; T.emit = (T.emit || 0) + dt * 150 * m * COUNT[T.lvl] * LEN[T.lvl] * capK; // longer flames get proportionally more licks, so density only ever goes up
  while (T.emit >= 1) { T.emit--; const a = T.aim + (Math.random() - 0.5) * 2 * T.half * 0.85, sp = T.reach / 0.5 * m * (0.85 + Math.random() * 0.25); T.fp.push({ x: T.mouthW[0], y: T.mouthW[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: (0.42 + Math.random() * 0.14) / m, sd: Math.random() * 6 }); }
}
function stepBreath(T, dt) { if (!T.fp) return; const m = SPEED[T.lvl]; for (const p of T.fp) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 0.6 * m; p.vy *= 1 - dt * 0.6 * m; p.vy -= 6 * dt * m * m; } T.fp = T.fp.filter(p => p.life < p.max + 0.35 / m); }
function drawBreath(c, T, t) {
  if (!T.fp || !T.fp.length) return;
  // smoke trails off the far end
  for (const p of T.fp) { const u = p.life / p.max; if (u < 0.85) continue; const k = Math.min(1, (u - 0.85) / 0.75); c.fillStyle = `rgba(55,45,40,${0.13 * (1 - k)})`; c.beginPath(); c.arc(p.x, p.y - k * 4, (2.5 + k * 3) * SC, 0, 7); c.fill(); }
  // burning tongues: stretched along their flight, hottest colour at the torch tips
  const list = T.fp.filter(p => p.life < p.max).sort((a, b) => b.life / b.max - a.life / a.max);
  for (const p of list) {
    const u = p.life / p.max, r = (1.1 + u * 3.8) * SC + Math.sin(t * 30 * SPEED[T.lvl] + p.sd) * 0.3, al = (u < 0.06 ? u / 0.06 : 1) * Math.pow(1 - u, 0.5) * 0.97 * 0.75, a = Math.atan2(p.vy, p.vx);
    c.globalAlpha = al; c.fillStyle = breathCol(T.lvl, u); c.beginPath(); c.ellipse(p.x, p.y, r * (1.9 - u * 0.7), r * 0.8, a, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  if (T.cone > 0.3) { const P = BREATH[T.lvl][0][1]; c.globalAlpha = 0.9; c.fillStyle = P; c.beginPath(); c.ellipse(T.mouthW[0], T.mouthW[1], 2.6, 1.9, T.aim, 0, 7); c.fill(); c.globalAlpha = 1; }
}

  const STONES = new Map();
  function draw(c, T, t) {
    const L = Math.max(1, Math.min(5, T.lvl || 1)), P = pal(L); COL = T.col || COL;
    const key = L + '|' + COL; let stones = STONES.get(key); if (!stones) STONES.set(key, stones = makeStones(L, 7 + L * 31));
    c.save(); c.translate(0, 4);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(1.5, 2, 25, 10, 0, 0, 7); c.fill();
    c.fillStyle = '#7d6446'; c.beginPath(); c.ellipse(0, 0, 21, 8.5, 0, 0, 7); c.fill(); c.fillStyle = '#6d5539'; c.beginPath(); c.ellipse(0, 0.5, 15, 5.8, 0, 0, 7); c.fill();
    const torches = L >= 4 ? [0, 1, 2, 3, 4].map(p => { const a = p / 5 * Math.PI * 2 + 0.35 + 0.42; return { a, x: Math.cos(a) * 25, y: Math.sin(a) * 10.5 }; }) : [];
    const pos = T.pos || 0, ph = T.ph || 0, att = T.att || 0, aim = T.aimS !== undefined ? T.aimS : Math.PI / 2;
    const dx = Math.cos(pos) * 11, dy = Math.sin(pos) * 4.4, items = [];
    stones.forEach(s => items.push([s.y + s.z * 0.01, () => stone(c, s)]));
    torches.forEach((q, i) => items.push([q.y, () => { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(q.x + 0.8, q.y + 0.6, 1.8, 0.8, 0, 0, 7); c.fill(); c.strokeStyle = '#5b3a1f'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x, q.y - 9); c.stroke(); c.fillStyle = '#2b2018'; c.beginPath(); c.ellipse(q.x, q.y - 9.5, 1.2, 1.5, 0, 0, 7); c.fill(); flame(c, q.x, q.y - 9.6, 5.5, 1.7, t, P, 10 + i, L >= 5 ? 1 : 0); }]));
    items.push([0, () => firePit(c, L, t, P)]);
    let m = null;
    items.push([dy + 0.1, () => { c.save(); c.translate(dx, dy); m = man(c, 1 + (L - 1) * 0.07, ph, att, aim, t, P, L); c.restore(); }]);
    items.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
    c.restore();
    if (m && T.x !== undefined) T.mouthW = [T.x + dx + m.conv[0], T.y + 4 + dy + m.conv[1]];
  }
  // per-frame state: aim at the target the host says we're burning, dance when idle, breathe when firing
  function update(T, dt, tgt, visible) {
    T.lvl = T.lvl || 1; if (T.aimS === undefined) { T.aimS = Math.PI / 2; T.pos = (T.id || 0) * 1.7; T.ph = T.pos; T.att = 0; T.cone = 0; }
    T.reach = TD.towerRange('flame', T.lvl); T.half = TD.towerCone('flame', T.lvl);
    const mx = T.mouthW ? T.mouthW[0] : T.x, my = T.mouthW ? T.mouthW[1] : T.y - 12;
    if (tgt) { const want = Math.atan2(tgt.y - (tgt.r || 6) - my, tgt.x - mx); let d = want - T.aimS; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; T.aimS += d * Math.min(1, dt * 6); T.att = Math.min(1, T.att + dt * 5); T.cone = T.att >= 0.8 ? Math.min(1, T.cone + dt * 4) : 0; }
    else { T.att = Math.max(0, T.att - dt * 3); T.cone = Math.max(0, T.cone - dt * 6); }
    if (T.att < 0.05) { T.pos += dt * 1.1; T.ph += dt * 4.2; }
    T.aim = T.aimS;
    if (visible && T.mouthW) emitBreath(T, dt); else if (!visible) T.fp = null;
    stepBreath(T, dt);
  }
  // keep the total number of flame licks on screen in check
  function budget(towers) { let n = 0; for (const T of towers) if (T.fp) n += T.fp.length; capK = n > 2600 ? Math.max(0.3, capK * 0.9) : Math.min(1, capK * 1.02 + 0.001); }
  return { draw, update, drawBreath, budget };
})();
function drawTower(t, now, c = X0) {
  const building = t.readyAt && t.readyAt > now;
  c.save(); c.translate(t.x, t.y);
  if (building && t.k === 'archer') archerBuild(c, { lvl: t.lvl || 1, x: 0, y: 0, archers: t.arch || archerSlots(), build: t.readyAt - now }, now, t.col);
  else if (building) drawConstruction(c, t, 1 - (t.readyAt - now) / ((t.lvl || 1) > 1 ? TD.RULES.levelTime : TD.RULES.buildTime), now);
  else if (t.k === 'archer') towerBody(c, t.k, t.col, t.arch || archerSlots(), now, 0, t.id || 0, t.lvl);
  else if (t.k === 'flame') FB.draw(c, t, now);
  else towerBody(c, t.k, t.col, t.aim, now, t.kick || 0, t.id || 0);
  if (t.offAt > now) { const left = t.offAt - now, tot = TD.UNITS.sapper.sapper.stun; c.fillStyle = 'rgba(15,15,15,.45)'; c.beginPath(); c.ellipse(0, -2, 20, 24, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(0, -30, 7, 0, 7); c.stroke(); c.strokeStyle = '#ffcc40'; c.beginPath(); c.arc(0, -30, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / tot); c.stroke(); if (Math.random() < 0.5) { c.strokeStyle = '#bfe6ff'; c.lineWidth = 1.2; c.beginPath(); const a = rr(0, 6.28); c.moveTo(Math.cos(a) * 6, -10 + Math.sin(a) * 6); c.lineTo(Math.cos(a) * 14 + rr(-3, 3), -10 + Math.sin(a) * 14); c.stroke(); } }
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
function bleed(px, py, dirx, diry, n, force, col) { for (let i = 0; i < n; i++) { const a = Math.atan2(diry, dirx) + rr(-0.9, 0.9), s = rr(20, 90) * force; particle('blood', px, py, rr(2, 8), Math.cos(a) * s, Math.sin(a) * s * 0.7, rr(30, 140) * force, 2, col || null, rr(0.8, 2)); } }
function die(u, type, sx, sy) {
  const U = TD.UNITS[u.k], B = U.body, X = u.x, Y = u.y, face = Math.cos(u.a) >= 0 ? 1 : -1, dx = X - sx, dy = Y - sy, l = Math.hypot(dx, dy) || 1, nx = dx / l, ny = dy / l, dist = l;
  const base = { x: X, y: Y, r: u.r, k: u.k, face, t: 0 };
  (V.deadBars || (V.deadBars = [])).push({ x: X, y: Y, r: u.r, t: V.clock || 0 });
  if (type === 'fire') { V.corpses.push(Object.assign(base, { kind: 'ash' })); stain(X, Y + u.r * 0.6, u.r * 1.6, '#1e1a16', 0.5); return; }
  if (type === 'ice') { V.corpses.push(Object.assign(base, { kind: 'freeze' })); stain(X, Y + u.r * 0.6, u.r * 2, '#d8f2ff', 0.35); return; }
  const bl = BLOODS[B === 'skel' || B === 'ram' ? 'none' : B === 'naga' ? 'naga' : B === 'ent' ? 'sap' : HUM[u.k] && HUM[u.k].blood ? HUM[u.k].blood : 'red'];
  // how violent was it? arrows topple, shells and the meteor throw (and tear), the meteor's center blows apart
  let push, vz, tear = 0, gib = false, twitch = 0, hold = 0;
  if (type === 'shock') { push = rr(10, 30); vz = rr(40, 80); hold = 0.4; }
  else if (type === 'water') { push = rr(90, 150); vz = rr(60, 110); }
  else if (type === 'blast') { const f = Math.max(0, 1 - dist / 50); gib = dist < 14 && Math.random() < 0.7; push = 70 + 200 * f * rr(0.7, 1.1); vz = 140 + 160 * f; tear = 0.12 + 0.3 * f; }
  else if (type === 'meteor') { const core = TD.SPELLS.meteor.core; if (dist < core) gib = true; else if (dist < 105) { push = rr(330, 500) * (1 - dist / 220); vz = rr(300, 460); tear = 0.45; } else { push = rr(110, 190); vz = rr(110, 190); tear = 0.08; twitch = Math.random() < 0.45 ? rr(0.6, 1.6) : 0; } }
  else { push = rr(55, 95); vz = rr(90, 150); tear = 0.03; twitch = Math.random() < 0.12 ? rr(0.4, 1) : 0; }
  if (!gib) { const heavy = Math.min(1, 5.5 / u.r); push *= Math.sqrt(heavy); vz *= Math.sqrt(heavy) * 0.6 + 0.4; }
  const ang = Math.atan2(ny, nx) + rr(-0.35, 0.35), burning = type === 'meteor' && Math.random() < 0.6;
  if (B === 'skel') { // no blood: the bones just come apart
    const rig = rigFor(u.k, u.r, V.atkCol), sp = gib ? 1 : Math.min(1, (push || 40) / 200);
    for (const q of rig.parts) piece({ kind: 'limb', q, blood: 'none' }, X + q.at[0], Y + q.at[1], 6, nx * (40 + 260 * sp) + rr(-50, 50), ny * (40 + 200 * sp) + rr(-40, 40), rr(60, 160) + 260 * sp, q.len, false, burning);
    piece({ kind: 'head', h: rig.head, up: Math.random() < 0.6, r: u.r, blood: 'none' }, X, Y - u.r, u.r, nx * (60 + 280 * sp) + rr(-50, 50), ny * (60 + 220 * sp) + rr(-40, 40), rr(90, 200) + 280 * sp, u.r, false, burning);
    piece({ kind: 'chunk', col: BONE, r: u.r, blood: 'none' }, X, Y, 4, nx * 60 * sp + rr(-20, 20), ny * 50 * sp + rr(-20, 20), rr(40, 120), u.r, false);
    for (let i = 0; i < 6; i++) particle('dust', X, Y, rr(2, 8), rr(-40, 40), rr(-30, 30), rr(20, 70), rr(0.4, 0.8), '#d8d0b8', rr(1.5, 3));
    if (Math.random() < 0.5) onGround(X - 8, Y - 8, X + 8, Y + 8, g => { g.fillStyle = BONE; g.globalAlpha = 0.7; for (let i = 0; i < 3; i++) g.fillRect(X + rr(-5, 5), Y + rr(-4, 4), rr(2, 4), 1); g.globalAlpha = 1; });
    return;
  }
  if (gib && u.r < 11 && B !== 'ram') return blowApart(u, nx, ny, bl, burning);
  if (B === 'ram') { // timber, wheels and the iron head come apart; no body
    const W2 = '#6a4a2a';
    for (let i = 0; i < 7; i++) { const a = rr(0, 6.28), s2 = rr(60, 200) * (gib ? 1.6 : 1); piece({ kind: 'chunk', col: i < 2 ? '#3a2a1a' : i === 2 ? '#5a5f68' : W2, r: u.r * 0.7, blood: 'none' }, X + rr(-u.r, u.r), Y + rr(-u.r * 0.5, u.r * 0.5), 6, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, rr(120, 300), u.r, false, Math.random() < 0.3); }
    piece({ kind: 'chunk', col: V.atkCol, r: u.r * 0.8, blood: 'none' }, X, Y, 8, rr(-60, 60), rr(-40, 40), rr(150, 260), u.r, false);
    for (let i = 0; i < 10; i++) particle('dust', X + rr(-u.r, u.r), Y, rr(2, 10), rr(-50, 50), rr(-30, 30), rr(20, 80), rr(0.5, 1), '#8a7a62', rr(2, 4));
    stain(X, Y, u.r * 1.2, '#3a2a1a', 0.35); if (onScreen(X, Y, 200)) { V.shake = Math.max(V.shake, 5); sfx('thud', X, Y); } return;
  }
  if (B === 'horse') { // the horse and the knight go separate ways
    makeRag(u.k, u.r, V.atkCol, X, Y, 0, Math.cos(ang) * push, Math.sin(ang) * push * 0.7, vz, tear, { twitch, hold, rot: face > 0 ? Math.PI / 2 : -Math.PI / 2, burning });
    makeRag('knightRider', u.r * 0.75, V.atkCol, X, Y - u.r * 0.6, u.r * 0.6, Math.cos(ang) * push * 0.6 + Math.cos(u.a) * 110, Math.sin(ang) * push * 0.45 + Math.sin(u.a) * 80, vz + 70, tear, { twitch: Math.random() < 0.3 ? 1 : 0, hold, hideHold: 1, burning });
    bleed(X, Y - u.r, nx, ny, 6, 1); return;
  }
  if (B === 'beast' || u.r >= 11) { // too heavy to throw: it topples and slides to a stop
    const tb = makeRag(u.k, u.r, V.atkCol, X, Y, 0, nx * 25, ny * 20, 40, 0, { twitch: 1.6, hold, rot: face > 0 ? Math.PI / 2 : -Math.PI / 2, vr: rr(-0.8, 0.8), bigPool: 1 }); tb.faceUp = B !== 'beast' && B !== 'mammoth' ? Math.random() < 0.5 : false; tb.maxB = 0;
    if (bl) stain(X, Y, u.r * 1.6, bl[0], 0.6); else for (let i = 0; i < 8; i++) particle('dust', X + rr(-u.r, u.r), Y, rr(2, 10), rr(-40, 40), rr(-30, 30), rr(20, 70), rr(0.5, 1), '#9a9a9a', rr(2, 4)); if (onScreen(X, Y, 200)) { V.shake = Math.max(V.shake, u.r >= 18 ? 6 : 4); sfx('thud', X, Y); }
    return;
  }
  if (B === 'warg') { // wolf and rider go separate ways
    makeRag(u.k, u.r, V.atkCol, X, Y, 0, Math.cos(ang) * push, Math.sin(ang) * push * 0.7, vz, tear, { twitch, hold, rot: face > 0 ? Math.PI / 2 : -Math.PI / 2, burning });
    const fx2 = Math.cos(u.a), fy2 = Math.sin(u.a);
    makeRag('rider', u.r * 0.8, V.atkCol, X, Y - u.r * 0.6, u.r * 0.6, Math.cos(ang) * push * 0.6 + fx2 * 90, Math.sin(ang) * push * 0.45 + fy2 * 70, vz + 60, tear, { twitch: Math.random() < 0.3 ? 1 : 0, hold, hideHold: 1, burning });
    bleed(X, Y - u.r, nx, ny, 6, 1); return;
  }
  makeRag(u.k, u.r, V.atkCol, X, Y, 0, Math.cos(ang) * push, Math.sin(ang) * push * 0.7, vz, tear, { twitch, hold, burning });
  if (bl) bleed(X, Y - u.r, nx, ny, tear > 0.2 ? 10 : 5, tear > 0.2 ? 1.6 : 0.9, bl[1]);
}
function piece(spec, x0, y0, z, vx, vy, vz, size, bloody, burning) { const bl = BLOODS[spec.blood]; V.parts.push({ piece: spec, x: x0, y: y0, z, vx, vy, vz, rot: rr(0, 6.28), vr: rr(-18, 18), life: 0, gib: bloody && bl ? 1 : 0, bcol: bl ? bl[1] : null, r: size, burning }); }
function makeRag(k, r, col, X, Y, z, vx, vy, vz, tear, o) {
  const rig = rigFor(k, r, col), bl = BLOODS[rig.blood], rest = restPose(rig), pose = {}; for (const j in rest) pose[j] = rest[j] * 0.2;
  const b = { kind: 'rag', k, r, rig, x: X, y: Y, z, vx, vy, vz, rot: o.rot || 0, vr: o.vr !== undefined ? o.vr : rr(-1, 1) * Math.min(16, 3 + Math.hypot(vx, vy) / 25), pose, rest, faceUp: Math.random() < 0.5, miss: {}, bleed: [], t: 0, bounces: 0, maxB: Math.hypot(vx, vy) > 200 ? 5 : 3, weapon: true, twitch: o.twitch || 0, hold: o.hold || 0, hideHold: o.hideHold, burning: o.burning, bigPool: o.bigPool, face: Math.cos(o.rot || 0) >= 0 ? 1 : -1 };
  const sp = Math.hypot(vx, vy), dir = Math.atan2(vy, vx);
  for (const q of rig.parts.concat([{ j: 'hd' }])) if (Math.random() < tear * (q.j === 'hd' ? 0.45 : 0.55)) {
    b.miss[q.j] = 1; b.bleed.push(q.j); const a = dir + rr(-1.2, 1.2), s2 = sp * rr(0.6, 1.1) + rr(60, 140);
    if (q.j === 'hd') piece({ kind: 'head', h: rig.head, up: Math.random() < 0.5, r, blood: rig.blood }, X, Y - r, z + r, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, vz * rr(0.9, 1.3) + 60, r, true, o.burning);
    else { piece({ kind: 'limb', q, blood: rig.blood, ang: rr(-0.5, 0.5) }, X + q.at[0], Y + q.at[1], z + 4, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, vz * rr(0.9, 1.3) + 60, q.len, true, o.burning); if (q.weapon) b.weapon = false; }
  }
  const wq = rig.parts.find(q => q.weapon); if (wq && b.weapon && !b.miss[wq.j] && Math.random() < (sp > 100 ? 0.65 : 0.25)) { b.weapon = false; piece({ kind: 'weapon', w: wq.weapon, r }, X, Y, z + 4, vx * rr(0.8, 1.3) + rr(-50, 50), vy * rr(0.8, 1.3) + rr(-40, 40), vz * rr(0.9, 1.2) + 40, r * 1.4, false); }
  if (bl && b.bleed.length) bleed(X, Y - r, Math.cos(dir), Math.sin(dir), 8 + b.bleed.length * 3, 1.6, bl[1]);
  V.corpses.push(b); return b;
}
function blowApart(u, nx, ny, bl, burning) {
  const rig = rigFor(u.k, u.r, V.atkCol), r = u.r, X = u.x, Y = u.y;
  for (const q of rig.parts) { const a = Math.atan2(ny, nx) + rr(-1.4, 1.4), s2 = rr(220, 420); piece({ kind: 'limb', q, blood: rig.blood, ang: rr(-0.6, 0.6) }, X + q.at[0], Y + q.at[1], 6, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, rr(260, 480), q.len, true, burning && Math.random() < 0.6); }
  { const a = Math.atan2(ny, nx) + rr(-1, 1), s2 = rr(240, 440); piece({ kind: 'head', h: rig.head, up: Math.random() < 0.5, r, blood: rig.blood }, X, Y - r, r, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, rr(300, 520), r, true, burning); }
  for (let i = 0; i < 3; i++) { const a = Math.atan2(ny, nx) + rr(-1.6, 1.6), s2 = rr(150, 360); piece({ kind: 'chunk', col: rig.torso.col, r, blood: rig.blood }, X, Y, 4, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, rr(220, 420), r, true, burning); }
  const wq = rig.parts.find(q => q.weapon); if (wq) piece({ kind: 'weapon', w: wq.weapon, r }, X, Y, 6, nx * rr(150, 300) + rr(-80, 80), ny * rr(120, 240) + rr(-60, 60), rr(250, 420), r * 1.4, false);
  if (u.k === 'warg') { const rr2 = rigFor('rider', r * 0.8, V.atkCol); piece({ kind: 'head', h: rr2.head, up: true, r: r * 0.8, blood: 'red' }, X, Y - r, r, nx * 300 + rr(-80, 80), ny * 220 + rr(-60, 60), rr(320, 520), r, true); }
  if (bl) { bleed(X, Y, nx, ny, 16, 2.2, bl[1]); stain(X, Y, r * 2.2, bl[0], 0.75); }
}
function stepRag(b, dt) {
  b.t += dt; if (b.t > 6) { b.settled = 1; b.twitch = 0; }
  if (b.hold > 0) { b.hold -= dt; return; }
  if (b.settled) { if (b.twitch > 0) { b.twitch -= dt; if (Math.random() < 0.15) { const q = b.rig.parts[(Math.random() * b.rig.parts.length) | 0]; b.pose[q.j] = (b.pose[q.j] || 0) + rr(-0.4, 0.4); } } else b.done = 1; return; }
  const air = b.z > 0.5 || b.vz > 0, bl = BLOODS[b.rig.blood];
  b.vz -= 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.rot += b.vr * dt;
  const kk = air ? 0 : Math.min(1, dt * 7);
  for (const q of b.rig.parts) b.pose[q.j] = air ? (b.pose[q.j] || 0) + Math.sin(b.t * 17 + q.at[0] * 3 + q.at[1]) * dt * 9 : (b.pose[q.j] || 0) + (b.rest[q.j] - (b.pose[q.j] || 0)) * kk;
  b.pose.hd = air ? (b.pose.hd || 0) + Math.sin(b.t * 13) * dt * 4 : (b.pose.hd || 0) + (b.rest.hd - (b.pose.hd || 0)) * kk;
  if (b.burning && Math.random() < 0.8) { particle('flame', b.x + rr(-3, 3), b.y, b.z + b.r, rr(-10, 10), rr(-6, 6), rr(10, 40), rr(0.25, 0.45), '#ff9a2a'); if (Math.random() < 0.3) particle('smoke', b.x, b.y, b.z + b.r, rr(-8, 8), rr(-5, 5), rr(20, 40), rr(0.6, 1.1), '#2a2420', rr(2, 4)); }
  if (bl && b.bleed.length && b.t < 1.2 && Math.random() < 0.3) { const a = b.rot + rr(0, 6.28); particle('blood', b.x, b.y, b.z + b.r * 0.5, Math.cos(a) * rr(30, 80), Math.sin(a) * rr(30, 80), rr(40, 110), 2, bl[1], rr(0.7, 1.4)); }
  if (b.z <= 0) { b.z = 0;
    if (b.vz < -70 && b.bounces < b.maxB) { b.bounces++; b.vz = -b.vz * 0.35; b.vx *= 0.5; b.vy *= 0.5; b.vr *= rr(-0.6, 0.6); if (bl) stain(b.x, b.y, b.r * 0.9, bl[2], 0.5); if (Math.random() < 0.4 && b.rig.B !== 'beast' && b.rig.B !== 'mammoth') b.faceUp = !b.faceUp; }
    else { b.vz = 0; b.vx *= 0.86; b.vy *= 0.86; b.vr *= 0.8;
      if (bl && b.bleed.length && Math.hypot(b.vx, b.vy) > 25) stain(b.x, b.y, b.r * 0.6, bl[0], 0.25); // drag smear
      if (Math.abs(b.vx) + Math.abs(b.vy) < 4) { b.settled = 1; if (bl) stain(b.x, b.y + b.r * 0.3, b.r * (b.bigPool ? 3.2 : b.bleed.length ? 2.6 : 1.8), bl[0], 0.55); } } }
}
function stepFx(dt) {
  for (const u of V.units.values()) { const k = Math.min(1, dt * 5), pushed = u.mvAt !== undefined && V.clock - u.mvAt < 0.35; u.dr += (pushed ? u.vel : u.sp * ((u.f & 1) ? 0.5 : 1) * ((u.f & 8) ? 0 : 1)) * dt * (u.dr > 0 ? V.L.lanes[u.l].pace(u.dr, u.off) : 1) + u.err * k; u.err -= u.err * k; if (u.offT !== undefined) u.off += (u.offT - u.off) * Math.min(1, dt * 10); if ((u.f & 8) && !u.hop && !(u.z > 0)) { u.hop = 1; u.vz = 170; u.z = 0.1; } if (!(u.f & 8)) u.hop = 0; if (u.z > 0) { u.vz -= 900 * dt; u.z = Math.max(0, u.z + u.vz * dt); } if (u.frAt !== undefined && V.clock - u.frAt < 0.45) { const ddx = u.tx - u.x, ddy = u.ty - u.y; u.x += ddx * Math.min(1, dt * 8); u.y += ddy * Math.min(1, dt * 8); if (Math.abs(ddx) + Math.abs(ddy) > 0.5) u.a = Math.atan2(ddy, ddx); if (Math.random() < 0.3 && onScreen(u.x, u.y, 30)) particle('dust', u.x, u.y + u.r * 0.8, 1, rr(-20, 20), rr(-10, 10), rr(10, 30), rr(0.3, 0.5), '#9a8a6a', rr(1, 2)); } else unitXY(u); if ((u.f & 2) && Math.random() < 0.25 && onScreen(u.x, u.y, 40)) particle('flame', u.x + rr(-u.r, u.r) * 0.6, u.y, rr(3, u.r * 1.6), rr(-8, 8), rr(-5, 5), rr(25, 50), rr(0.3, 0.5), '#ff9a2a', 0); }
  for (const t of V.towers) { if (t.offAt > V.clock && Math.random() < 0.25 && onScreen(t.x, t.y, 40)) particle('smoke', t.x + rr(-8, 8), t.y - 10, 20, rr(-6, 6), rr(-4, 4), rr(20, 40), rr(0.8, 1.4), '#2a2622', rr(4, 7)); t.kick = Math.max(0, (t.kick || 0) - dt * 4); if (t.arch) for (const q of t.arch) if (q.kick) q.kick = Math.max(0, q.kick - dt * 4); if (t.readyAt && t.readyAt <= V.clock && !t.doneFx) { t.doneFx = 1; if (V.clock - t.readyAt < 1 && onScreen(t.x, t.y, 60)) sfx('done', t.x, t.y), V.fx.push({ k: 'build', x: t.x, y: t.y + 10, t0: V.clock, col: t.col }); } }
  { const fire = new Map(); for (let i = 0; i < V.beams.length; i += 2) { const t = V.towerMap.get(V.beams[i]), u = V.units.get(V.beams[i + 1]); if (t && u) { t.aim = Math.atan2(u.y - t.y, u.x - t.x); fire.set(t.id, u); } }
    const fbs = V.towers.filter(t => t.k === 'flame'); for (const t of fbs) FB.update(t, dt, !(t.readyAt > V.clock) && !(t.offAt > V.clock) ? fire.get(t.id) : null, onScreen(t.x, t.y, 260)); FB.budget(fbs); }
  for (const s of V.shots) {
    s.age += dt; if (s.u && V.units.has(s.u.id)) { s.tx = s.u.x; s.ty = s.u.y; }
    const f = Math.min(1, s.age / Math.max(0.05, s.T)); s.x = s.sx + (s.tx - s.sx) * f; s.y = s.sy + 16 + (s.ty - s.sy - 16) * f; s.a = Math.atan2(s.ty - s.sy - 16, s.tx - s.sx); s.h = s.k === 'cannon' ? 22 + Math.sin(f * Math.PI) * 30 - f * 22 : 22 * (1 - f) + 6 * f;
    if (f >= 1) { s.done = 1; if (s.k === 'cannon') { sfx('boom', s.x, s.y); V.fx.push({ k: 'boom', x: s.x, y: s.y, t0: V.clock }); stain(s.x, s.y, 16, '#2a2218', 0.35); for (let i = 0; i < 6; i++) particle('dirt', s.x, s.y, 2, rr(-90, 90), rr(-90, 90), rr(120, 240), rr(0.5, 0.9), '#6b5232', rr(2, 4)); } else if (s.k === 'frost') V.fx.push({ k: 'ice', x: s.x, y: s.y, t0: V.clock }); else if (!V.units.has(s.u.id)) { const ax = s.x, ay = s.y, aa = s.a; onGround(ax - 10, ay - 10, ax + 10, ay + 10, g => { g.save(); g.translate(ax, ay); g.rotate(aa); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-7, -2); g.lineTo(2, 0); g.stroke(); g.restore(); }); } else if (Math.random() < 0.5) bleed(s.tx, s.ty - s.u.r, Math.cos(s.a), Math.sin(s.a), 2, 0.6); }
  }
  V.shots = V.shots.filter(s => !s.done);
  stepSpellFx(dt);
  V.fx = V.fx.filter(f => V.clock - f.t0 < (f.k === 'mboom' ? 0.7 : f.k === 'boom' ? 0.45 : f.k === 'bolt' ? 0.22 : f.k === 'leak' ? 1.2 : f.k === 'build' ? 0.6 : 0.35));
  V.pool = V.pool || [];
  for (const p of V.parts) {
    p.life += dt;
    if (p.p) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt; if (p.kind === 'blood') { p.vz -= 700 * dt; if (p.z <= 0) { stain(p.x, p.y, p.size * 2.2, p.col || BLOOD[(p.x | 0) % 3], 0.8); p.life = p.max; } } else if (p.kind === 'water' || p.kind === 'drop') { p.vz -= 260 * dt; if (p.z <= 0) { p.life = p.max; if (Math.random() < 0.12) particle('mist', p.x, p.y, 1, rr(-20, 20), rr(-12, 12), rr(10, 30), rr(0.3, 0.6), '#e0f2ff', rr(2, 4)); } } else { p.vz -= (p.kind === 'ash' || p.kind === 'flame' || p.kind === 'smoke' || p.kind === 'mist' ? -10 : 420) * dt; if (p.z < 0) p.z = 0; if (p.kind === 'ash') p.vx += Math.sin(p.life * 6 + p.rot) * 30 * dt; } continue; }
    if (p.rest) continue;
    p.vz -= 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.burning && p.z > 2 && Math.random() < 0.6) particle('flame', p.x, p.y, p.z, rr(-8, 8), rr(-5, 5), rr(10, 30), rr(0.2, 0.4), '#ff9a2a');
    if (p.gib && p.z > 4 && Math.random() < (p.piece ? 0.18 : 0.35)) particle('blood', p.x, p.y, p.z, p.vx * 0.2, p.vy * 0.2, 0, 1.5, p.bcol || null, rr(0.7, 1.4));
    if (p.z <= 0) { p.z = 0; if (p.vz < -90) { p.vz = -p.vz * 0.35; p.vx *= 0.55; p.vy *= 0.55; p.vr *= 0.5; if (p.gib) stain(p.x, p.y, p.r * 0.9, p.bcol || BLOOD[1], 0.7); } else { p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; p.vr *= 0.6; if (Math.abs(p.vx) + Math.abs(p.vy) < 8) { p.rest = 1; if (p.gib) stain(p.x, p.y, p.r * 0.5, p.bcol || BLOOD[0], 0.5); } } }
  }
  for (const p of V.parts) if (!p.p && p.rest && !p.baked) { p.baked = 1; const m = (p.r || p.size || 6) * 2; onGround(p.x - m, p.y - m, p.x + m, p.y + m, g => drawGib(p, g)); }
  V.parts = V.parts.filter(p => { if (p.baked) return false; if (p.p && p.life >= p.max) { V.pool.push(p); return false; } return p.p || p.life < 8; });
  if (V.parts.length > 2500) V.parts.splice(0, V.parts.length - 2500);
  for (const c of V.corpses) {
    c.t += dt;
    if (c.kind === 'rag') stepRag(c, dt);
    if (c.kind === 'flop' && !c.rest) { c.vz -= 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.rot += c.vr * dt; if (c.z <= 0) { c.z = 0; if (c.vz < -70 && c.bounces < (c.maxB || 3)) { c.bounces++; c.vz = -c.vz * 0.38; c.vx *= 0.5; c.vy *= 0.5; c.vr = c.vr * -0.35 + c.dir * rr(2, 5); stain(c.x, c.y + c.r * 0.5, c.r * 0.9, BLOOD[2], 0.5); } else { c.vz = 0; c.vx *= 0.82; c.vy *= 0.82; const lie = c.dir * Math.PI / 2, d = lie - c.rot; c.rot += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 10); if (Math.abs(c.vx) + Math.abs(c.vy) < 4) { c.rest = 1; c.rot = lie; stain(c.x, c.y + c.r * 0.4, c.r * 1.8, BLOOD[0], 0.55); } } } }
    if (c.burning && !c.rest && Math.random() < 0.8) { particle('flame', c.x + rr(-3, 3), c.y, c.z + c.r, rr(-10, 10), rr(-6, 6), rr(10, 40), rr(0.25, 0.45), '#ff9a2a'); if (Math.random() < 0.3) particle('smoke', c.x, c.y, c.z + c.r, rr(-8, 8), rr(-5, 5), rr(20, 40), rr(0.6, 1.1), '#2a2420', rr(2, 4)); }
    if (c.kind === 'ash' && c.t > 0.35 && c.t < 1.2 && Math.random() < 0.6) particle('ash', c.x + rr(-c.r, c.r) * 0.7, c.y, rr(0, c.r * 2.2) * (1 - (c.t - 0.35) / 0.85), rr(-15, 15), rr(-8, 8), rr(25, 60), rr(0.8, 1.5), Math.random() < 0.25 ? '#ff8a2a' : '#3a3530', rr(1, 2.2));
    if (c.kind === 'freeze' && c.t > 0.45 && !c.shattered) { c.shattered = 1; for (let i = 0; i < 7; i++) { const a = rr(0, 6.28), s = rr(40, 110); V.parts.push({ shape: 'shard', x: c.x, y: c.y, z: rr(2, c.r * 2), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rr(80, 200), rot: rr(0, 6), vr: rr(-12, 12), life: 0, size: rr(2, 4) * c.r / 6 }); } }
  }
  for (const c of V.corpses) if (!c.baked && c.kind === 'rag' && c.done) { c.baked = 1; const m = c.r * 4; onGround(c.x - m, c.y - m, c.x + m, c.y + m, g => drawRag(g, c)); }
  for (const c of V.corpses) if (!c.baked && ((c.kind === 'flop' && c.rest && c.t > 0.3) || (c.kind === 'shock' && c.t > 0.9))) { c.baked = 1; const m = c.r * 3; onGround(c.x - m, c.y - m, c.x + m, c.y + m, g => drawSprite(sprite(c.k, 'dead', c.face, -1, V.atkCol), c.x, c.y + c.r * 0.3, c.kind === 'flop' ? c.rot : c.dir * Math.PI / 2, g)); }
  V.corpses = V.corpses.filter(c => !c.baked && (c.kind === 'rag' || c.t < (c.kind === 'ash' ? 1.3 : c.kind === 'freeze' ? 0.5 : 6)));
  if (V.corpses.length > 300) V.corpses.splice(0, V.corpses.length - 300);
  if (!V.fadeQ || !V.fadeQ.length) V.fadeQ = [...V.tiles.values()];
  for (let n = 0; n < 2 && V.fadeQ.length; n++) { const t = V.fadeQ.pop(), el = V.clock - t.faded; if (el < 1) continue; t.faded = V.clock; t.g.setTransform(1, 0, 0, 1, 0, 0); t.g.globalCompositeOperation = 'destination-out'; t.g.fillStyle = `rgba(0,0,0,${Math.min(0.5, 0.025 * el)})`; t.g.fillRect(0, 0, t.c.width, t.c.height); t.g.globalCompositeOperation = 'source-over'; }
}

// ---------- spells: meteor and water jet (visuals; the host decides damage) ----------
const M_SP = () => TD.SPELLS.meteor, J_SP = () => TD.SPELLS.jet;
function meteorImpact(mx, my) {
  let bi = -1, bd = 1e9; V.meteors.forEach((m, i) => { const d = Math.hypot(m.x - mx, m.y - my); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) V.meteors.splice(bi, 1);
  const M = M_SP(), vis = onScreen(mx, my, 300);
  V.fields.push({ x: mx, y: my, r: M.fireR, t0: V.clock, dur: M.fireDur, flames: Array.from({ length: 34 }, () => { const a = rr(0, 6.28), r = Math.sqrt(Math.random()) * M.fireR * 0.95; return [mx + Math.cos(a) * r, my + Math.sin(a) * r, rr(0.6, 1.25), rr(0, 6)]; }).sort((a, b) => a[1] - b[1]) });
  stain(mx, my, M.fireR * 1.15, '#1c1612', 0.75); stain(mx, my, M.fireR * 0.6, '#0e0b09', 0.8);
  onGround(mx - 60, my - 40, mx + 60, my + 40, g => { g.globalAlpha = 0.9; g.fillStyle = '#2a211a'; g.beginPath(); g.ellipse(mx, my, 34, 22, 0, 0, 7); g.fill(); g.fillStyle = '#4a3a2a'; g.beginPath(); g.ellipse(mx - 3, my - 3, 26, 15, 0, 0, 7); g.fill(); g.fillStyle = '#3a2a1e'; g.beginPath(); g.ellipse(mx + 2, my + 2, 18, 10, 0, 0, 7); g.fill(); g.globalAlpha = 1; });
  sfx('meteor', mx, my);
  if (!vis) return;
  V.shake = Math.max(V.shake, 14);
  V.rings.push({ x: mx, y: my, t0: V.clock, dur: 0.55, r0: 20, r1: M.edge * 1.5, col: '255,230,170', w: 10 }, { x: mx, y: my, t0: V.clock, dur: 0.9, r0: 10, r1: M.edge * 2.2, col: '255,255,255', w: 3 });
  V.fx.push({ k: 'mboom', x: mx, y: my, t0: V.clock });
  for (let i = 0; i < 40; i++) { const a = rr(0, 6.28), s2 = rr(120, 420); particle('dirt', mx, my, 4, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, rr(200, 520), rr(0.7, 1.3), Math.random() < 0.5 ? '#5a4430' : '#3a2e22', rr(2, 5)); }
  for (let i = 0; i < 26; i++) { const a = rr(0, 6.28), s2 = rr(60, 300); particle('ember', mx, my, 6, Math.cos(a) * s2, Math.sin(a) * s2 * 0.7, rr(150, 420), rr(0.6, 1.4), '#ffb040', rr(1.5, 3)); }
  for (let i = 0; i < 14; i++) { const a = rr(0, 6.28), s2 = rr(10, 70); particle('smoke', mx + Math.cos(a) * 30, my + Math.sin(a) * 18, rr(5, 30), Math.cos(a) * s2, Math.sin(a) * s2 * 0.6, rr(30, 70), rr(1.6, 2.8), '#2e2822', rr(9, 18)); }
}
function stepSpellFx(dt) {
  V.shake = Math.max(0, V.shake - dt * 40);
  for (const m of V.meteors) { const p = Math.min(1, (V.clock - m.t0) / m.dur); if (V.clock - m.t0 > 3) m.gone = 1; if (p >= 1 || !onScreen(m.x, m.y, 500)) continue; const mx = m.x + m.ox * (1 - p), mz = m.oz * (1 - p); for (let i = 0; i < 4; i++) particle('flame', mx + rr(-6, 6), m.y + rr(-3, 3), mz + rr(-6, 6), rr(20, 60), rr(-10, 10), rr(60, 140), rr(0.25, 0.5), '#ff9a2a'); if (Math.random() < 0.8) particle('smoke', mx + rr(-5, 5), m.y, mz + rr(4, 14), rr(30, 70), rr(-8, 8), rr(70, 120), rr(0.8, 1.5), '#3a322a', rr(6, 11)); }
  V.meteors = V.meteors.filter(m => !m.gone);
  for (const f of V.fields) { const age = V.clock - f.t0; if (age > f.dur - 0.6 || !onScreen(f.x, f.y, 120)) continue; for (let i = 0; i < 3; i++) { const fl = f.flames[(Math.random() * f.flames.length) | 0]; particle('flame', fl[0] + rr(-3, 3), fl[1], rr(2, 8), rr(-6, 6), rr(-3, 3), rr(30, 70), rr(0.3, 0.6), '#ff9a2a'); } if (Math.random() < 0.35) { const fl = f.flames[(Math.random() * f.flames.length) | 0]; particle('smoke', fl[0], fl[1], 14, rr(-6, 6), rr(-4, 4), rr(25, 45), rr(1.2, 2), '#2a2420', rr(6, 12)); } }
  V.fields = V.fields.filter(f => V.clock - f.t0 < f.dur);
  const J = J_SP();
  for (const j of V.jets.values()) {
    const age = V.clock - j.t0; if (age > J.unfold + J.life + 0.8) { V.jets.delete(j.id); continue; }
    let da = j.aimT - j.aim; da = Math.atan2(Math.sin(da), Math.cos(da)); j.aim += da * Math.min(1, dt * 10);
    if (age > J.drop && !j.landed) { j.landed = 1; sfx('thud', j.x, j.y); stain(j.x, j.y + 4, 22, '#2a2218', 0.3); if (onScreen(j.x, j.y, 100)) { V.shake = Math.max(V.shake, 4); V.rings.push({ x: j.x, y: j.y, t0: V.clock, dur: 0.35, r0: 8, r1: 60, col: '230,215,190', w: 5 }); for (let i = 0; i < 16; i++) { const a = rr(0, 6.28), s2 = rr(40, 140); particle('dirt', j.x, j.y, 2, Math.cos(a) * s2, Math.sin(a) * s2 * 0.6, rr(60, 160), rr(0.5, 0.9), '#6b5232', rr(1.5, 3.5)); } } }
    if (age > J.unfold && age < J.unfold + J.life && j.fire && onScreen(j.x, j.y, J.r + 40)) {
      const ca = Math.cos(j.aim), sa = Math.sin(j.aim), nx = j.x + ca * 16, ny = j.y + sa * 16;
      for (let i = 0; i < 9; i++) { const a = j.aim + rr(-J.cone, J.cone) * rr(0.2, 1), s2 = rr(380, 520); particle('water', nx, ny, 22, Math.cos(a) * s2, Math.sin(a) * s2, rr(-20, 40), J.r / s2 * rr(0.8, 1.05), '#bfe4ff', rr(1.2, 2.4)); }
      if (Math.random() < 0.3) { const r = rr(J.r * 0.4, J.r * 0.95), a = j.aim + rr(-J.cone, J.cone) * 0.7; stain(j.x + Math.cos(a) * r, j.y + Math.sin(a) * r, rr(5, 10), '#3a5a72', 0.12); }
    }
  }
  V.rings = V.rings.filter(r => V.clock - r.t0 < r.dur);
}
function drawPod() { x.fillStyle = '#5a6470'; x.fillRect(-9, -14, 18, 18); x.fillStyle = '#3d76b8'; x.fillRect(-9, -8, 18, 4); x.fillStyle = '#e8b030'; x.fillRect(-2, -14, 4, 18); x.fillStyle = '#2e343b'; x.fillRect(-9, 2, 18, 2); }
function drawJet(j) {
  const now = V.clock, J = J_SP(), age = now - j.t0, X = j.x, Y = j.y;
  if (age < J.drop) { const p = age / J.drop, z = 420 * (1 - p * p); x.fillStyle = `rgba(0,0,0,${0.15 + p * 0.25})`; x.beginPath(); x.ellipse(X + 3, Y + 6, 10 + p * 6, 4 + p * 2, 0, 0, 7); x.fill(); x.save(); x.translate(X, Y - z); x.rotate(Math.sin(age * 20) * 0.05); drawPod(); x.restore(); x.strokeStyle = 'rgba(200,230,255,.5)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(X - 4, Y - z - 60); x.lineTo(X - 4, Y - z - 14); x.moveTo(X + 4, Y - z - 70); x.lineTo(X + 4, Y - z - 14); x.stroke(); return; }
  const unf = Math.min(1, (age - 0.75) / 0.7), out = Math.max(0, age - J.unfold - J.life) / 0.8, k = Math.max(0, Math.min(1, unf) - out);
  x.save(); x.translate(X, Y); x.globalAlpha = 1 - Math.max(0, out - 0.5) * 2;
  x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(4, 12, 24, 9, 0, 0, 7); x.fill();
  const fo = k * 13; x.fillStyle = '#5a6470'; for (const [fx2, fy2, w, h] of [[-12 - fo, -4, 10, 16], [2 + fo, -4, 10, 16], [-9, -10 - fo * 0.55, 18, 7], [-9, 11 + fo * 0.45, 18, 6]]) x.fillRect(fx2, fy2, w, h);
  x.fillStyle = '#3d76b8'; x.fillRect(-12 - fo, 2, 10, 3); x.fillRect(2 + fo, 2, 10, 3);
  if (age < 0.75) { drawPod(); x.restore(); x.globalAlpha = 1; return; }
  x.fillStyle = '#4a525c'; x.beginPath(); x.ellipse(0, 6, 13, 6, 0, 0, 7); x.fill();
  const rise = k * 18; x.fillStyle = '#2f6aa8'; x.fillRect(-8, 6 - rise, 16, rise); x.fillStyle = '#4b8fd6'; x.beginPath(); x.ellipse(0, 6 - rise, 8, 3.5, 0, 0, 7); x.fill(); x.fillStyle = '#9fd0ff'; x.fillRect(-5, 4 - rise * 0.8, 2.5, rise * 0.7);
  x.translate(0, 4 - rise); x.fillStyle = '#6a737e'; x.beginPath(); x.arc(0, 0, 5.5 * k, 0, 7); x.fill();
  x.rotate(j.aim); const nl = 6 + 14 * k, kick = j.fire ? Math.sin(now * 60) * 0.6 : 0; x.fillStyle = '#c0c6cc'; x.fillRect(0, -2.6, nl + kick, 5.2); x.fillStyle = '#e8b030'; x.fillRect(nl - 3 + kick, -3.4, 4, 6.8);
  x.restore(); x.globalAlpha = 1;
}
function drawFieldGlow(f) { const age = V.clock - f.t0, fade = Math.min(1, age / 0.2) * Math.max(0, Math.min(1, (f.dur - age) / 0.8)), g = x.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 1.1); g.addColorStop(0, `rgba(255,140,40,${0.35 * fade})`); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.beginPath(); x.arc(f.x, f.y, f.r * 1.1, 0, 7); x.fill(); }
function drawFlame(px, py, s2, ph, fade) { const now = V.clock, fl = 0.75 + 0.25 * Math.sin(now * 13 + ph) + 0.12 * Math.sin(now * 29 + ph * 2), h = 14 * s2 * fl * fade, w = 5 * s2 * fade, sw = Math.sin(now * 7 + ph) * 2 * s2; if (h < 0.5) return; for (const [c, m] of [['#e8401a', 1], ['#ff9a2a', 0.72], ['#ffe08a', 0.42]]) { x.fillStyle = c; x.beginPath(); x.moveTo(px - w * m, py); x.quadraticCurveTo(px - w * m, py - h * m * 0.55, px + sw * m, py - h * m); x.quadraticCurveTo(px + w * m, py - h * m * 0.55, px + w * m, py); x.closePath(); x.fill(); } }
function drawMeteor(m) {
  const now = V.clock, M = M_SP(), p = Math.min(1, (now - m.t0) / m.dur), mx = m.x + m.ox * (1 - p), mz = m.oz * (1 - p);
  x.strokeStyle = `rgba(255,80,40,${0.35 + 0.4 * Math.abs(Math.sin(now * 14))})`; x.lineWidth = 2.5; x.beginPath(); x.arc(m.x, m.y, M.core, 0, 7); x.stroke();
  x.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * p})`; x.beginPath(); x.ellipse(m.x, m.y, 10 + 24 * p, (10 + 24 * p) * 0.6, 0, 0, 7); x.fill();
  const R0 = 20 + 6 * p, g = x.createRadialGradient(mx, m.y - mz, 2, mx, m.y - mz, R0 * 3.2); g.addColorStop(0, 'rgba(255,220,140,.9)'); g.addColorStop(0.4, 'rgba(255,120,40,.45)'); g.addColorStop(1, 'rgba(255,60,20,0)'); x.fillStyle = g; x.beginPath(); x.arc(mx, m.y - mz, R0 * 3.2, 0, 7); x.fill();
  x.save(); x.translate(mx, m.y - mz); x.rotate(now * 4); x.fillStyle = '#3a2a22'; x.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = R0 * (0.82 + 0.18 * Math.sin(i * 2.7)); i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
  x.fillStyle = '#ff7a2a'; x.beginPath(); x.arc(-R0 * 0.25, R0 * 0.2, R0 * 0.38, 0, 7); x.fill(); x.fillStyle = '#ffd27a'; x.beginPath(); x.arc(-R0 * 0.3, R0 * 0.25, R0 * 0.18, 0, 7); x.fill(); x.restore();
}
function drawSpellAim() {
  const a = spell.aimAt || (spell.armed && spell.hover ? { k: spell.armed, x: spell.hover[0], y: spell.hover[1] } : null); if (!a) return;
  x.globalAlpha = a.bad ? 0.35 : 1;
  if (a.k === 'meteor') { const M = M_SP(); x.strokeStyle = 'rgba(255,90,40,.95)'; x.lineWidth = 2; x.setLineDash([6, 5]); x.beginPath(); x.arc(a.x, a.y, M.edge, 0, 7); x.stroke(); x.setLineDash([]); x.fillStyle = 'rgba(255,90,40,.2)'; x.beginPath(); x.arc(a.x, a.y, M.core, 0, 7); x.fill(); x.stroke(); }
  else { const J = J_SP(); x.strokeStyle = 'rgba(120,190,255,.95)'; x.lineWidth = 2; x.setLineDash([6, 5]); x.beginPath(); x.arc(a.x, a.y, J.r, 0, 7); x.stroke(); x.setLineDash([]); x.fillStyle = 'rgba(120,190,255,.45)'; x.beginPath(); x.arc(a.x, a.y, 12, 0, 7); x.fill(); x.save(); x.translate(a.x, a.y); x.globalAlpha *= 0.7; drawPod(); x.restore(); }
  x.globalAlpha = 1;
}

function drawCorpse(c) {
  if (c.kind === 'rag') { if (c.hold > 0) { if (!c.hideHold) drawSprite(sprite(c.k, Math.floor(c.t * 30 + c.hold * 30) % 2 ? 'flash' : 'slow', c.face, -1, V.atkCol), c.x + rr(-1, 1), c.y, 0); return; } if (c.z > 1) { x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(c.x, c.y + 2, c.r * 1.1, c.r * 0.45, 0, 0, 7); x.fill(); } drawRag(x, c); return; }
  const r = c.r; x.globalAlpha = Math.max(0, Math.min(1, 6 - c.t));
  if (c.kind === 'flop') drawSprite(sprite(c.k, 'dead', c.face, -1, V.atkCol), c.x, c.y + r * 0.3 - c.z, c.rot);
  else if (c.kind === 'shock') { const tt = Math.max(0, c.t - 0.4), fall = Math.min(1, tt / 0.28); if (c.t < 0.4) drawSprite(sprite(c.k, Math.floor(c.t * 30) % 2 ? 'flash' : 'slow', c.face, -1, V.atkCol), c.x + rr(-1, 1), c.y, 0); else drawSprite(sprite(c.k, 'dead', c.face, -1, V.atkCol), c.x, c.y + r * 0.3, c.dir * Math.PI / 2 * fall * fall); }
  else if (c.kind === 'ash') { const charT = Math.min(1, c.t / 0.35), crumble = Math.max(0, (c.t - 0.35) / 0.85); x.save(); x.translate(c.x, c.y); x.beginPath(); x.rect(-r * 2, -r * 2.2 + crumble * r * 3.2, r * 4, r * 4); x.clip(); soldier(x, c.k, r, 0, mix(V.atkCol, '#1a1614', charT), c.face); x.restore(); }
  else if (c.kind === 'freeze') { x.save(); x.translate(c.x, c.y); soldier(x, c.k, r, 0, mix(V.atkCol, '#bfe8ff', Math.min(1, c.t / 0.15)), c.face); x.globalAlpha = 0.5; x.fillStyle = '#e8f8ff'; x.beginPath(); x.moveTo(-r, r); x.lineTo(-r * 1.1, -r * 0.6); x.lineTo(-r * 0.2, -r * 1.9); x.lineTo(r * 0.9, -r * 0.9); x.lineTo(r, r); x.closePath(); x.fill(); x.restore(); }
  x.globalAlpha = 1;
}
function drawGib(p, c = X0) {
  if (p.piece) { c.globalAlpha = Math.max(0, Math.min(1, 8 - p.life)); drawPiece(c, p); c.globalAlpha = 1; return; }
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
function clampCam() { if (!V) return; cam.z = Math.max(minZ(), Math.min(2.5, cam.z)); const hw = VW / 2 / cam.z, hh = VH / 2 / cam.z, W = V.world.W, top = -TD.STAGE_H, H = V.world.H, padB = (build.on ? bottomCover() + 40 : 60) / cam.z, padX = 40 / cam.z; cam.x = hw * 2 > W + padX * 2 ? W / 2 : Math.max(hw - padX, Math.min(W - hw + padX, cam.x)); cam.y = hh * 2 > H - top + padB ? (top + H + padB) / 2 : Math.max(top + hh, Math.min(H - hh + padB, cam.y)); }
function bottomCover() { const T = $('buildTray'); return T && !T.classList.contains('hidden') ? Math.max(0, innerHeight - T.getBoundingClientRect().top) : 0; }
function resetCamera() { if (V.myDef) { cam.z = Math.min(1.1, VW > VH ? VW / 1100 : VH / 1250); const p = V.L.lanes[V.myDef.slot].at(500); cam.x = p[0]; cam.y = p[1]; } else { cam.z = minZ(); cam.x = V.world.W / 2; cam.y = (V.world.H - TD.STAGE_H) / 2; } clampCam(); }
function lookAtLane(slot) { const L2 = V.L.lanes[slot]; if (!L2) return; cam.z = Math.max(cam.z, Math.min(1, Math.max(VW, VH * 0.75) / 1300)); const p = L2.at(400); cam.x = p[0]; cam.y = p[1]; clampCam(); }
const s2w = (sx, sy) => [cam.x + (sx - VW / 2) / cam.z, cam.y + (sy - VH / 2) / cam.z];
const onScreen = (px, py, m) => { const hw = VW / 2 / cam.z + m, hh = VH / 2 / cam.z + m; return Math.abs(px - cam.x) < hw && Math.abs(py - cam.y) < hh; };
const ptrs = new Map(); let pinch0 = null, tap = null;
cv.addEventListener('pointerdown', e => { if (build.drag || (typeof spell !== 'undefined' && spell.drag)) return; try { cv.setPointerCapture(e.pointerId); } catch (er) { } ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 1) tap = { x: e.clientX, y: e.clientY }; else tap = null; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z }; } });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; if (ptrs.size === 1) { cam.x -= (e.clientX - p[0]) / cam.z; cam.y -= (e.clientY - p[1]) / cam.z; clampCam(); if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null; } ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; cam.z = pinch0.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0.d; clampCam(); } });
const pup = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; if (tap && e.type === 'pointerup' && ptrs.size === 0) onTap(...s2w(e.clientX, e.clientY)); tap = null; };
cv.addEventListener('pointerup', pup); cv.addEventListener('pointercancel', pup);
cv.addEventListener('wheel', e => { e.preventDefault(); const before = s2w(e.clientX, e.clientY); cam.z *= e.deltaY > 0 ? 0.9 : 1.1; clampCam(); const after = s2w(e.clientX, e.clientY); cam.x += before[0] - after[0]; cam.y += before[1] - after[1]; clampCam(); }, { passive: false });
function onTap(wx, wy) {
  if (!V || V.over) return;
  if (spell.armed) return castSpell(spell.armed, wx, wy);
  const t = V.towers.find(t => Math.abs(t.x - wx) < CELL && Math.abs(t.y - wy) < CELL);
  if (t) { V.sel = { tower: t.id }; return showTowerSheet(t); }
  V.sel = null; hideSheet();
}


// ---------- spells: drag from the button onto the map, or tap the button then tap the map ----------
const spell = { drag: null, armed: null, aimAt: null, hover: null, local: {} };
function spellLeft(k) { const D = V && V.myDef; if (!D) return 0; return Math.max(0, Math.max((D.scdAt && D.scdAt[k]) || 0, spell.local[k] || 0) - V.clock); }
function castSpell(k, wx, wy) { if (V.myDef.gold < TD.SPELLS[k].cost) { spell.armed = null; return toast(TD.SPELLS[k].n + ' costs ' + TD.SPELLS[k].cost + 'g'); } sfx('cast'); send({ c: 'spell', k, x: Math.round(wx), y: Math.round(wy) }); spell.local[k] = V.clock + TD.SPELLS[k].cd; spell.armed = null; spell.hover = null; }
function spellPoint(e, d) { return s2w(e.clientX, e.clientY - (d && d.touch ? 70 : 0)); }
document.querySelectorAll('#spellBar [data-spell]').forEach(b => b.onpointerdown = e => {
  e.preventDefault(); e.stopPropagation(); if (!V || !V.myDef || V.over) return; const k = b.dataset.spell;
  if (spellLeft(k) > 0) { toast(TD.SPELLS[k].n + ' ready in ' + Math.ceil(spellLeft(k)) + 's'); return; }
  if (V.myDef.gold < TD.SPELLS[k].cost) { toast(TD.SPELLS[k].n + ' costs ' + TD.SPELLS[k].cost + 'g'); return; }
  spell.drag = { k, sx: e.clientX, sy: e.clientY, touch: e.pointerType !== 'mouse', moved: false };
  window.addEventListener('pointermove', spellMove); window.addEventListener('pointerup', spellUp); window.addEventListener('pointercancel', spellCancel);
});
function spellMove(e) { const d = spell.drag; if (!d) return; if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 10) { d.moved = true; spell.armed = null; } if (!d.moved) return; d.over = !!document.elementFromPoint(e.clientX, e.clientY)?.closest('#spellBar'); const [wx, wy] = spellPoint(e, d); spell.aimAt = { k: d.k, x: wx, y: wy, bad: d.over }; }
function spellUp(e) { const d = spell.drag; spellStop(); if (!d) return; spell.aimAt = null; if (!d.moved) { spell.armed = spell.armed === d.k ? null : d.k; if (spell.armed) toast('Tap the map to cast ' + TD.SPELLS[d.k].n); return; } if (d.over) return; const [wx, wy] = spellPoint(e, d); castSpell(d.k, wx, wy); }
function spellCancel() { spellStop(); spell.aimAt = null; }
function spellStop() { spell.drag = null; window.removeEventListener('pointermove', spellMove); window.removeEventListener('pointerup', spellUp); window.removeEventListener('pointercancel', spellCancel); }
cv.addEventListener('pointermove', e => { if (spell.armed && e.pointerType === 'mouse') spell.hover = s2w(e.clientX, e.clientY); });
function renderSpellBar() {
  const bar = $('spellBar'), show = !!(V && V.myDef && !V.over && !build.on && sheetKind !== 'tower'); bar.classList.toggle('hidden', !show); if (!show) return;
  bar.querySelectorAll('[data-spell]').forEach(b => { const k = b.dataset.spell, l = spellLeft(k), cd = TD.SPELLS[k].cd; b.querySelector('.cd').style.setProperty('--p', (l / cd * 100) + '%'); b.querySelector('.n').textContent = l > 0 ? Math.ceil(l) : ''; const poor = V.myDef.gold < TD.SPELLS[k].cost; b.classList.toggle('armed', spell.armed === k); b.classList.toggle('ready', l <= 0 && !poor); b.classList.toggle('poor', poor); b.querySelector('small').textContent = TD.SPELLS[k].cost + 'g'; });
}

// ---------- build mode: drag a tower from the tray onto the grid ----------
const build = { on: false, drag: null, sel: 'archer' };
function setBuild(on) {
  build.on = !!on && !!(V && V.myDef) && !(V && V.over); build.drag = null; if (build.on) spell.armed = null;
  $('buildBtn').classList.toggle('on', build.on); $('buildBtn').innerHTML = build.on ? '✕ Done' : '🔨 Build';
  $('buildTray').classList.toggle('hidden', !build.on); if (build.on) { hideSheet(); renderTray(true); } else $('buildBtn').style.bottom = ''; requestAnimationFrame(clampCam);
}
// keep Done just above the tray, whatever height the tray ends up
function placeBuildBtn() { if (!build.on) return; const T = $('buildTray').getBoundingClientRect(); $('buildBtn').style.bottom = (innerHeight - T.top + 8) + 'px'; }
addEventListener('resize', () => requestAnimationFrame(placeBuildBtn));
function towerStats(k) { const T = TD.TOWERS[k]; if (T.cone) return [T.dps + ' dmg/s cone', 'burns ' + T.burn + 's', 'range ' + T.r + ' · 5 levels']; if (TD.LEVELS[k]) return [TD.towerDmg(k, 1) + ' dmg × ' + TD.towerVolley(k, 1), 'every ' + T.cd + 's', 'range ' + T.r + ' · 5 levels']; return [T.dps ? T.dps + '/s dmg' : T.volley ? T.dmg + '×' + T.volley + ' dmg' : T.dmg + ' dmg', T.dps ? 'constant beam' : 'every ' + T.cd + 's', 'range ' + T.r]; }
function updateStrip() { const T = $('buildTray'), k = build.sel, S = T.querySelector('.strip'); T.querySelectorAll('[data-tw]').forEach(b => b.classList.toggle('sel', b.dataset.tw === k)); if (!S) return; const st = towerStats(k); S.innerHTML = `<b>${TD.TOWERS[k].n}</b> — ${esc(TD.TOWERS[k].tip)}<div class="st"><span>⚔ ${st[0]}</span><span>⏱ ${st[1]}</span><span>◎ ${st[2]}</span></div>`; }
$('buildBtn').onclick = () => setBuild(!build.on);
function renderTray(force) {
  if (!build.on || !V || !V.myDef) return; const T = $('buildTray'), D = V.myDef, key = TD.TOWER_IDS.map(k => D.gold >= TD.TOWERS[k].cost ? 1 : 0).join('');
  if (!force && T.dataset.key === key) return; T.dataset.key = key;
  T.innerHTML = `<div class="sheetHead"><b>Drag a tower onto the field</b><span class="muted small">Drop it back here to cancel</span></div><div class="cards">${TD.TOWER_IDS.map(k => `<button class="card ${D.gold < TD.TOWERS[k].cost ? 'off' : ''}" data-tw="${k}" title="${esc(TD.TOWERS[k].d)}"><span data-prev="${k}"></span><b>${TD.TOWERS[k].n}</b><span class="cost">${TD.TOWERS[k].cost}g</span></button>`).join('')}</div><div class="strip"></div>`;
  updateStrip(); requestAnimationFrame(placeBuildBtn);
  T.querySelectorAll('[data-prev]').forEach(s => s.replaceWith(previewCanvas(g => { g.translate(42, 33); g.scale(1.15, 1.15); towerBody(g, s.dataset.prev, colHex(D.color), 0.6, V.clock || 0, 0, 1); })));
  T.querySelectorAll('[data-tw]').forEach(b => b.onpointerdown = e => { e.preventDefault(); build.sel = b.dataset.tw; updateStrip(); if (!b.classList.contains('off')) startDrag(b.dataset.tw, e); else toast('Not enough gold'); });
}
function startDrag(k, e) {
  document.body.classList.add('dragging');
  build.drag = { k, sx: e.clientX, sy: e.clientY, touch: e.pointerType !== 'mouse', id: e.pointerId };
  moveDrag(e);
  window.addEventListener('pointermove', moveDrag); window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', cancelDrag);
}
function dragCell(e) { const off = build.drag.touch ? 70 : 0, [wx, wy] = s2w(e.clientX, e.clientY - off); return [Math.round(wx / CELL - FOOT / 2), Math.round(wy / CELL - FOOT / 2), wx, wy]; }
function moveDrag(e) { const d = build.drag; if (!d) return; d.x = e.clientX; d.y = e.clientY; const [c, r] = dragCell(e); d.c = c; d.r = r; d.overTray = !!document.elementFromPoint(e.clientX, e.clientY)?.closest('#dragCancel'); $('dragCancel').classList.toggle('hot', d.overTray); d.ok = !d.overTray && TD.footFree(V.L, c, r, V.occ) && V.myDef.gold >= TD.TOWERS[d.k].cost; }
function endDrag(e) { const d = build.drag; if (d) moveDrag(e); stopDragListeners(); document.body.classList.remove('dragging'); $('dragCancel').classList.remove('hot'); if (!d) return; build.drag = null; if (d.overTray) return; if (d.ok) { send({ c: 'build', k: d.k, c2: d.c, r: d.r }); for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) V.occ[(d.r + j) * V.L.cols + d.c + i] = 1; } else toast(V.myDef.gold < TD.TOWERS[d.k].cost ? 'Not enough gold' : "Can't build there"); }
function cancelDrag() { stopDragListeners(); build.drag = null; document.body.classList.remove('dragging'); $('dragCancel').classList.remove('hot'); }
function stopDragListeners() { window.removeEventListener('pointermove', moveDrag); window.removeEventListener('pointerup', endDrag); window.removeEventListener('pointercancel', cancelDrag); }

// ---------- HUD ----------
const atkUI = { target: 'all', qty: 1 };
let sheetKind = null;
function sellLabel(t) { return t.refundAt > V.clock ? `Refund ${t.spent}g · ${Math.ceil(t.refundAt - V.clock)}s` : `Sell +${Math.floor(t.spent * TD.RULES.sell)}g`; }
function hideSheet() { $('sheet').classList.add('hidden'); document.body.classList.remove('sheetOpen'); sheetKind = null; if (V) V.sel = null; if (V && V.myDef && !V.over) $('buildBtn').classList.remove('hidden'); }
function previewCanvas(draw) { const c = document.createElement('canvas'); c.width = 168; c.height = 124; const g = c.getContext('2d'); g.scale(2, 2); draw(g); return c; }
function levelBlock(t, mine) {
  const T = TD.TOWERS[t.k], Lv = TD.LEVELS[t.k], lvl = t.lvl || 1, n = TD.towerVolley(t.k, lvl), dmg = TD.towerDmg(t.k, lvl), rng = Math.round(TD.towerRange(t.k, lvl));
  if (!Lv) return `<p class="muted small" style="margin:0 0 8px">${esc(T.d)} Range ${T.r}. <i>Levels coming soon.</i></p>`;
  const cone = !!T.cone, wide = l => Math.round((TD.LEVELS[t.k].wide ? TD.LEVELS[t.k].wide[l - 1] : 1) * 100 - 100);
  const stat = cone ? `${TD.towerDps(t.k, lvl)} dmg/s to everything in the cone · burns ${T.burn}s · range ${rng}` : `${n} archer${n > 1 ? 's' : ''} · ${dmg} dmg each · ${n * dmg} dmg/s · range ${rng}`, busy = t.readyAt > V.clock;
  let up = '';
  if (lvl < 5) { const cost = Lv.cost[lvl], nn = TD.towerVolley(t.k, lvl + 1), nd = TD.towerDmg(t.k, lvl + 1), nr = Math.round(TD.towerRange(t.k, lvl + 1));
    up = `<div class="lvUp"><div><b>Level ${lvl + 1} · ${Lv.names[lvl]}</b><small>${cone ? `${TD.towerDps(t.k, lvl + 1)} dmg/s · cone +${wide(lvl + 1)}% wider` : `${nn} archers · ${nd} dmg each`}${nr > rng ? ' · range ' + nr : ''}</small></div>${mine ? `<button class="btn sm primary" data-level ${busy || V.myDef.gold < cost ? 'disabled' : ''}>⬆ ${cost}g</button>` : ''}</div>`; }
  else up = `<div class="lvUp"><div><b>Max level</b><small>Promotions will take it further.</small></div></div>`;
  const promos = (TD.PROMOTIONS[t.k] || []).map(q => `<div class="promo"><span>🔒</span><div><b>${q.n}</b><small>Requires Level ${q.need} · coming soon</small></div></div>`).join('');
  return `<div class="lvRow"><span class="lvPips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</span><b>Level ${lvl} · ${Lv.names[lvl - 1]}</b>${busy ? '<span class="tag">Building…</span>' : ''}</div><p class="muted small" style="margin:2px 0 8px">${stat}</p>${up}${promos ? `<div class="promos">${promos}</div>` : ''}`;
}
function showTowerSheet(t) {
  sheetKind = 'tower'; const sh = $('sheet'), mine = t.owner === myPid, T = TD.TOWERS[t.k], owner = V.defs[t.slot] || V.defs[0];
  sh.classList.remove('hidden'); document.body.classList.add('sheetOpen'); $('buildBtn').classList.add('hidden');
  sh.innerHTML = `<div class="sheetHead"><b>${T.n}</b><span class="muted small">${esc(owner.name)} · ${t.kills} kills</span><button class="btn ghost sm x" data-close>✕</button></div>
    ${levelBlock(t, mine)}
    ${mine ? `<div class="row"><span class="small muted">Target</span><div class="prios">${TD.PRIORITIES.map(p => `<button data-prio="${p}" class="${t.prio === p ? 'on' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div><button class="btn sm danger" data-sell style="margin-left:auto">${sellLabel(t)}</button></div>` : ''}`;
  sh.querySelector('[data-close]').onclick = hideSheet;
  sh.querySelectorAll('[data-prio]').forEach(b => b.onclick = () => { send({ c: 'prio', id: t.id, p: b.dataset.prio }); t.prio = b.dataset.prio; showTowerSheet(t); });
  const sb2 = sh.querySelector('[data-sell]'); if (sb2) sb2.onclick = () => { send({ c: 'sell', id: t.id }); hideSheet(); };
  const lb = sh.querySelector('[data-level]'); if (lb) lb.onclick = () => { send({ c: 'level', id: t.id }); lb.disabled = true; };
  sh.dataset.lv = (t.lvl || 1) + ':' + (t.readyAt > V.clock ? 1 : 0) + ':' + (V.myDef && TD.LEVELS[t.k] ? +(V.myDef.gold >= (TD.LEVELS[t.k].cost[t.lvl || 1] || 1e9)) : 0);
}
let hudT = 0;
function renderHUD(force) {
  if (!V) return; const now = performance.now(); if (!force && now - hudT < 150) return; hudT = now;
  const left = TD.RULES.setup + TD.RULES.length - V.t;
  $('clock').innerHTML = V.closed ? `⏱ Final push · ${V.units.size} left` : V.t < TD.RULES.setup ? `🛠 Setup <b>${fmtT(TD.RULES.setup - V.t)}</b>` : `⏱ ${fmtT(left)}` + (ph => ph.open ? ` <span class="phase go">⚔ Sending ${Math.ceil(ph.left)}s</span>` : ` <span class="phase hold">⏸ Pause ${Math.ceil(ph.left)}s</span>`)(TD.sendPhase(V.t));
  $('hpChip').innerHTML = `🏰 <b style="color:${V.hp > V.hpMax * .5 ? '#9ff08a' : V.hp > V.hpMax * .25 ? '#f0c419' : '#ff7a6a'}">${Math.ceil(V.hp)}</b><small>/ ${V.hpMax}</small>`;
  $('defChips').innerHTML = V.defs.map(d => `<div class="dchip ${d.pid === myPid ? 'me' : ''}" data-lane="${d.slot}"><span class="sw" style="background:${colHex(d.color)}"></span>${esc(d.name)}<span class="lv" style="color:var(--muted)">${d.kills} kills</span></div>`).join('') + `<div class="dchip" style="cursor:default"><span class="sw" style="background:${V.atkCol}"></span>${esc(V.atk.name)}<span class="lv" style="color:var(--muted)">attacker</span></div>`;
  $('defChips').querySelectorAll('[data-lane]').forEach(b => b.onclick = () => lookAtLane(+b.dataset.lane));
  const tb = $('topBar').getBoundingClientRect(), narrow = innerWidth <= 640; $('defChips').style.top = narrow ? (tb.bottom + 6) + 'px' : ''; $('ecoBar').style.top = narrow ? (tb.bottom + 6) + 'px' : '';
  if (V.myDef) { const D = V.myDef; $('ecoBar').innerHTML = `<div class="chip">💰 ${D.gold}<small>+${D.income}/s</small></div>`; renderTray(); }
  else if (V.isAtk) { $('ecoBar').innerHTML = ''; renderAtk(); }
  else $('ecoBar').innerHTML = '<div class="chip">Spectating</div>';
}
const fmtInc = v => v >= 1 ? (Math.round(v * 10) / 10) + '' : v >= 0.1 ? v.toFixed(2) : v.toFixed(3);
function renderAtk() {
  const A = V.atk, P = $('atkPanel'); P.classList.remove('hidden');
  const lanes = atkUI.target === 'all' ? V.defs.length : 1, mt = V.t - TD.RULES.setup, open = TD.UNIT_IDS.filter(k => mt >= TD.UNITS[k].unlock * 60).length, setup = V.t < TD.RULES.setup, ph = TD.sendPhase(V.t), shut = !ph.open;
  // rebuild only when the layout changes; numbers update in place so the unit row keeps its scroll position
  const skey = JSON.stringify([open, atkUI, V.closed, lanes, setup]);
  if (P.dataset.skey !== skey) {
    P.dataset.skey = skey; const old = P.querySelector('.cards'), sl = old ? old.scrollLeft : 0;
    if (V.closed) { P.innerHTML = '<div class="qrow">Time is up. Your last units are on the field.</div>'; return; }
    P.innerHTML = `<div class="targets"><span class="small muted">Send to</span><button data-tg="all" class="${atkUI.target === 'all' ? 'on' : ''}">All lanes</button>${V.defs.map(d => `<button data-tg="${d.slot}" class="${atkUI.target === d.slot ? 'on' : ''}"><span class="sw" style="background:${colHex(d.color)}"></span>${esc(d.name)}</button>`).join('')}
      <span style="margin-left:auto" class="chip" data-gold></span></div>
      <div class="cards atkCards">${TD.UNIT_IDS.map(k => { const U = TD.UNITS[k], lock = mt < U.unlock * 60; return `<button class="card ${lock ? 'locked' : ''}" data-unit="${k}" title="${esc(U.d)}"><span data-uprev="${k}"></span><b>${U.n}${U.pack ? ' ×' + U.pack : ''}</b><span class="cost">${lock ? '🔒 ' + fmtT(U.unlock * 60) : U.cost * lanes * atkUI.qty + 'g'}</span>${lock ? '' : `<small class="inc">+${fmtInc(U.cost * lanes * atkUI.qty * TD.RULES.sendIncome)}/s</small>`}</button>`; }).join('')}</div>
      <div class="row"><div class="prios">${[1, 5, 10].map(n => `<button data-qty="${n}" class="${atkUI.qty === n ? 'on' : ''}">×${n}</button>`).join('')}</div>
        <button class="btn sm" data-speed style="margin-left:auto" title="Units you send from now on move ${Math.round(TD.RULES.speedStep * 100)}% faster"></button>
        <button class="btn sm" data-invest></button></div><div class="qrow" data-setup></div>`;
    P.querySelectorAll('[data-uprev]').forEach(s => s.replaceWith(previewCanvas(g => { const S = sprite(s.dataset.uprev, 'n', 1, 0, V.atkCol), sz = Math.min(64, 100 * S.size / (TD.UNITS.brute.r * 4.4)); g.drawImage(S.c, 42 - sz / 2, 66 - sz * 0.72, sz, sz); })));
    P.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { atkUI.target = b.dataset.tg === 'all' ? 'all' : +b.dataset.tg; if (atkUI.target !== 'all') lookAtLane(atkUI.target); renderAtk(); });
    P.querySelectorAll('[data-qty]').forEach(b => b.onclick = () => { atkUI.qty = +b.dataset.qty; renderAtk(); });
    P.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => { if (b.classList.contains('off')) return; send({ c: 'send', k: b.dataset.unit, lane: atkUI.target, n: atkUI.qty }); b.classList.remove('sent'); void b.offsetWidth; b.classList.add('sent'); });
    P.querySelector('[data-speed]').onclick = () => send({ c: 'speed' });
    P.querySelector('[data-invest]').onclick = () => send({ c: 'invest' });
    const row = P.querySelector('.cards'); row.scrollLeft = sl;
    row.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    P.dataset.key = '';
  }
  if (V.closed) return;
  const key = JSON.stringify([A.gold, A.income, A.investCost, A.speed, A.speedCost, Math.ceil(ph.left), shut]); if (P.dataset.key === key) return; P.dataset.key = key;
  P.querySelector('[data-gold]').innerHTML = `💰 ${A.gold}<small>+${A.income}/s</small>`;
  P.querySelectorAll('[data-unit]').forEach(b => { const U = TD.UNITS[b.dataset.unit], lock = mt < U.unlock * 60; b.classList.toggle('off', shut || lock || A.gold < U.cost * lanes * atkUI.qty); });
  const su = P.querySelector('[data-setup]'); if (su) { su.classList.toggle('hold', shut); su.textContent = setup ? `Setup: you can send units in ${Math.ceil(ph.left)}s` : shut ? `⏸ Pause: sending reopens in ${Math.ceil(ph.left)}s` : `⚔ Sending open: ${Math.ceil(ph.left)}s left, then a ${TD.RULES.sendOff}s pause. Every unit you send raises your income.`; }
  const spb = P.querySelector('[data-speed]'), maxed = A.speed >= TD.RULES.speedMax; spb.disabled = maxed || A.gold < A.speedCost; spb.innerHTML = maxed ? '👢 Speed maxed' : `👢 Speed ${A.speed + 1}/${TD.RULES.speedMax} · ${A.speedCost}g`;
  const iv = P.querySelector('[data-invest]'); iv.disabled = A.gold < A.investCost; iv.innerHTML = `Invest ${A.investCost}g<small style="font-weight:600">&nbsp;+${Math.round(TD.RULES.investGain * V.defs.length * 10) / 10}/s</small>`;
}

$('menuBtn').onclick = () => openModal(`<h2>Menu</h2><p class="muted">One finger drags the map, two fingers pinch to zoom.${V && V.myDef ? ' Tap Build, then drag a tower from the tray onto the grid (white cells = it fits). Tap a tower to set its target or sell it. Drag a spell from its button onto the map to cast it (or tap the button, then tap the map).' : ''}${V && V.isAtk ? ' Pick a lane and tap a unit: it marches out right away. Sending runs ' + TD.RULES.sendOn + 's on, ' + TD.RULES.sendOff + 's paused. Every unit you send raises your income.' : ''}</p><div class="row" style="margin-bottom:10px"><button class="btn" id="mMus">🎵 Music: ${AU.musOn ? 'On' : 'Off'}</button><button class="btn" id="mSfx">🔊 Sound: ${AU.sfxOn ? 'On' : 'Off'}</button></div><div class="row"><button class="btn" id="mResume">Resume</button><button class="btn danger" id="mQuit">Leave match</button></div>`, () => { $('mResume').onclick = closeModal; $('mMus').onclick = () => { setMusic(!AU.musOn); $('mMus').textContent = '🎵 Music: ' + (AU.musOn ? 'On' : 'Off'); }; $('mSfx').onclick = () => { setSfx(!AU.sfxOn); $('mSfx').textContent = '🔊 Sound: ' + (AU.sfxOn ? 'On' : 'Off'); }; $('mQuit').onclick = () => { closeModal(); quitGame(); }; });
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
  const z = cam.z, shx = V.shake ? rr(-V.shake, V.shake) / z : 0, shy = V.shake ? rr(-V.shake, V.shake) / z : 0, vx0 = cam.x + shx - VW / 2 / z, vy0 = cam.y + shy - VH / 2 / z, vx1 = vx0 + VW / z, vy1 = vy0 + VH / z, inView = (px, py, m) => px > vx0 - m && px < vx1 + m && py > vy0 - m && py < vy1 + m;
  x.setTransform(DPR, 0, 0, DPR, 0, 0); x.fillStyle = '#1a1712'; x.fillRect(0, 0, VW, VH);
  x.setTransform(DPR * z, 0, 0, DPR * z, -vx0 * DPR * z, -vy0 * DPR * z);
  const top = -TD.STAGE_H, sx = Math.max(0, vx0), sy = Math.max(top, vy0), ex = Math.min(V.world.W, vx1), ey = Math.min(V.world.H, vy1);
  if (ex > sx && ey > sy) x.drawImage(groundBg, sx, sy - top, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
  for (const t of V.tiles.values()) if (t.x < vx1 && t.x + TILE > vx0 && t.y < vy1 && t.y + TILE > vy0) x.drawImage(t.c, t.x, t.y, TILE, TILE);
  if (build.on && ex > sx && ey > Math.max(0, sy)) { const y0 = Math.max(0, sy); x.drawImage(gridBg, sx * 0.5, y0 * 0.5, (ex - sx) * 0.5, (ey - y0) * 0.5, sx, y0, ex - sx, ey - y0); }
  for (const f of V.fields) if (inView(f.x, f.y, f.r + 20)) drawFieldGlow(f);
  V.L.lanes.forEach((L2, i) => { if (inView(L2.gate[0], -150, 300)) drawCamp(L2, i); });
  drawSpellAim();
  if (V.sel && V.sel.tower) { const t = V.towerMap.get(V.sel.tower); if (t) { x.fillStyle = 'rgba(255,224,138,.08)'; x.strokeStyle = 'rgba(255,224,138,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(t.x, t.y, TD.towerRange(t.k, t.lvl), 0, 7); x.fill(); x.stroke(); } }
  // drag preview: cells this tower would take light up white, or red where blocked
  const d = build.drag;
  if (d && !d.overTray && d.c !== undefined) { for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) { const cc = d.c + i, r = d.r + j, bad = cc < 0 || r < 0 || cc >= V.L.cols || r >= V.L.rows || V.L.blocked[r * V.L.cols + cc] || V.occ[r * V.L.cols + cc]; x.fillStyle = bad ? 'rgba(235,50,40,.78)' : d.ok ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)'; x.fillRect(cc * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); } x.strokeStyle = 'rgba(255,224,138,.5)'; x.lineWidth = 1.5; x.beginPath(); x.arc((d.c + 1) * CELL, (d.r + 1) * CELL, TD.TOWERS[d.k].r, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); for (const u of V.units.values()) if (inView(u.x, u.y, 20)) { const qd = u.k === 'warg' || u.k === 'tarrasque' ? 1.7 : 1.1; x.moveTo(u.x + 3 + u.r * qd, u.y + u.r * 0.9); x.ellipse(u.x + 3, u.y + u.r * 0.9, u.r * qd, u.r * 0.45, 0, 0, 7); } x.fill();
  if (z > 0.45) { const sr = TD.UNITS.sapper.sapper.r; x.setLineDash([5, 6]); x.lineWidth = 1.5; for (const u of V.units.values()) if (u.k === 'sapper' && !(u.frAt !== undefined && V.clock - u.frAt < 0.45) && inView(u.x, u.y, sr)) { x.strokeStyle = 'rgba(255,200,80,.28)'; x.beginPath(); x.arc(u.x, u.y, sr, 0, 7); x.stroke(); } x.setLineDash([]); }
  const list = [];
  for (const tr of V.L.trees) if (!V.treeGone.has(tr.id) && inView(tr.x, tr.y, 40)) list.push([tr.y, 4, tr]);
  list.push([V.L.base.y + 40, 5, null]);
  for (const t of V.towers) if (inView(t.x, t.y, 40)) list.push([t.y + 14, 0, t]);
  for (const u of V.units.values()) if (inView(u.x, u.y, 20)) list.push([u.y, 1, u]);
  for (const c of V.corpses) if (inView(c.x, c.y, 30)) list.push([c.y, 2, c]);
  for (const p of V.parts) if (!p.p && !p.rest && inView(p.x, p.y, 30)) list.push([p.y, 3, p]);
  for (const j of V.jets.values()) if (inView(j.x, j.y, 60)) list.push([j.y + 8, 6, j]);
  for (const f of V.fields) if (inView(f.x, f.y, f.r + 30)) { const age = V.clock - f.t0, fade = Math.min(1, age / 0.25) * Math.max(0, Math.min(1, (f.dur - age) / 1.2)); for (const fl of f.flames) list.push([fl[1], 7, [fl, fade]]); }
  list.sort((a, b) => a[0] - b[0]);
  for (const [, k, o] of list) {
    if (k === 0) drawTower(o, V.clock);
    else if (k === 1) { const ph = V.clock * o.sp / 6 + o.ph, fr = Math.floor(((ph / (Math.PI * 2)) % 1 + 1) % 1 * WALK), st = (o.f & 2) ? 'burn' : (o.f & 4) ? 'wet' : (o.f & 1) ? 'slow' : 'n', air = o.z > 0; drawSprite(sprite(o.k, st, Math.cos(o.a) >= 0 ? 1 : -1, air ? -1 : fr, V.atkCol), o.x, o.y - (o.z || 0) - (air ? 0 : Math.abs(Math.sin(ph)) * 1.5), air ? -Math.min(0.9, o.z / 30) * Math.sign(o.vel || 1) : 0); }
    else if (k === 2) drawCorpse(o); else if (k === 3) drawGib(o); else if (k === 4) drawTree(o); else if (k === 6) drawJet(o); else if (k === 7) drawFlame(o[0][0], o[0][1], o[0][2], o[0][3], o[1]); else if (inView(V.L.base.x, V.L.base.y, 200)) drawBase();
  }
  if (d && !d.overTray && d.c !== undefined) { x.globalAlpha = 0.75; x.save(); x.translate((d.c + 1) * CELL, (d.r + 1) * CELL); towerBody(x, d.k, colHex(V.myDef.color), -Math.PI / 2, V.clock, 0, 1); x.restore(); x.globalAlpha = 1; }
  if (z > 0.5) { x.fillStyle = '#000a'; for (const u of V.units.values()) if (u.hp < 100 && inView(u.x, u.y, 20)) x.fillRect(u.x - u.r * 1.3 - 0.5, u.y - u.r * 2.3 - 0.5, u.r * 2.6 + 1, 3); for (const u of V.units.values()) if (u.hp < 100 && inView(u.x, u.y, 20)) { x.fillStyle = u.hp > 40 ? '#6ae06a' : '#e0503a'; x.fillRect(u.x - u.r * 1.3, u.y - u.r * 2.3, u.r * 2.6 * u.hp / 100, 2); }
    if (V.deadBars && V.deadBars.length) { for (const b of V.deadBars) if (inView(b.x, b.y, 20)) { x.fillStyle = '#000'; x.fillRect(b.x - b.r * 1.3 - 0.5, b.y - b.r * 2.3 - 0.5, b.r * 2.6 + 1, 3); x.fillStyle = '#5a1a14'; x.fillRect(b.x - b.r * 1.3, b.y - b.r * 2.3, b.r * 2.6, 2); } } }
  for (const t of V.towers) if (t.k === 'flame' && t.fp && t.fp.length && inView(t.x, t.y, 260)) FB.drawBreath(x, t, V.clock);
  for (let i = 0; i < V.beams.length; i += 2) { const t = V.towerMap.get(V.beams[i]), b = V.units.get(V.beams[i + 1]); if (!t || t.k === 'flame' || !b || !inView(t.x, t.y, 200)) continue; const fl = 0.7 + 0.3 * Math.sin(V.clock * 40); x.strokeStyle = `rgba(255,90,40,${0.45 * fl})`; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(t.x, t.y - 20); x.lineTo(b.x, b.y - b.r); x.stroke(); x.strokeStyle = '#fff0c0'; x.lineWidth = 2; x.stroke(); }
  for (const s of V.shots) { if (!inView(s.x, s.y, 20)) continue; if (s.k === 'cannon') { x.fillStyle = '#1e1e22'; x.beginPath(); x.arc(s.x, s.y - s.h + 6, 4.5, 0, 7); x.fill(); continue; } x.save(); x.translate(s.x, s.y - s.h + 16); x.rotate(s.a || 0); if (s.k === 'archer') { x.strokeStyle = '#3a2a1a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-8, 0); x.lineTo(6, 0); x.stroke(); x.fillStyle = '#ccc'; x.fillRect(5, -1.5, 3, 3); } else { x.fillStyle = '#c8f0ff'; x.beginPath(); x.moveTo(7, 0); x.lineTo(0, -3.5); x.lineTo(-5, 0); x.lineTo(0, 3.5); x.fill(); } x.restore(); }
  for (const p of V.parts) { if (!p.p || !inView(p.x, p.y, 20)) continue; const q = p.life / p.max; x.globalAlpha = 1 - q * q;
    if (p.kind === 'blood') { x.fillStyle = p.col || BLOOD[1]; x.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size); }
    else if (p.kind === 'ash' || p.kind === 'dust') { x.fillStyle = p.col; x.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size); }
    else if (p.kind === 'water') { x.strokeStyle = 'rgba(214,238,255,.9)'; x.lineWidth = p.size * 1.25; x.lineCap = 'round'; x.beginPath(); x.moveTo(p.x, p.y - p.z); x.lineTo(p.x - p.vx * 0.03, p.y - p.z - p.vy * 0.03 + p.vz * 0.03); x.stroke(); }
    else if (p.kind === 'mist' || p.kind === 'smoke') { x.globalAlpha *= p.kind === 'mist' ? 0.5 : 0.55; x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y - p.z, p.size * (p.kind === 'mist' ? 0.6 + q : 0.5 + q * 1.2), 0, 7); x.fill(); }
    else if (p.kind === 'ember') { x.fillStyle = q < 0.5 ? '#ffe08a' : '#ff6a2a'; x.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size); }
    else if (p.kind === 'flame') { x.fillStyle = q < 0.4 ? '#ffe08a' : '#ff7a2a'; x.beginPath(); x.arc(p.x, p.y - p.z, 2.5 * (1 - q) + 0.8, 0, 7); x.fill(); }
    else { x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y - p.z, p.size * (1 - q * 0.5), 0, 7); x.fill(); } }
  x.globalAlpha = 1;
  for (const r of V.rings) { const p = (V.clock - r.t0) / r.dur, rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - p) * (1 - p)); x.strokeStyle = `rgba(${r.col},${(1 - p) * 0.8})`; x.lineWidth = r.w * (1 - p) + 1; x.beginPath(); x.arc(r.x, r.y, rad, 0, 7); x.stroke(); }
  for (const m of V.meteors) if (inView(m.x, m.y, 500)) drawMeteor(m);
  for (const f of V.fx) {
    const dur = f.k === 'mboom' ? 0.7 : f.k === 'boom' ? 0.45 : f.k === 'bolt' ? 0.22 : f.k === 'leak' ? 1.2 : f.k === 'build' ? 0.6 : 0.35, p = (V.clock - f.t0) / dur; x.globalAlpha = Math.max(0, 1 - p);
    if (f.k === 'mboom') { const e = 1 - (1 - p) * (1 - p); x.globalAlpha = Math.max(0, 1 - p * 1.1); for (const [c, a0, b0, lift] of [['#ff6a20', 30, 110, 20], ['#ffb040', 22, 75, 26], ['#fff4c8', 16, 40, 30]]) { x.fillStyle = c; x.beginPath(); x.ellipse(f.x, f.y - lift * e, a0 + e * b0, (a0 + e * b0) * 0.8, 0, 0, 7); x.fill(); } if (p < 0.12) { x.save(); x.setTransform(DPR, 0, 0, DPR, 0, 0); x.globalAlpha = (0.12 - p) * 5; x.fillStyle = '#fff6dc'; x.fillRect(0, 0, VW, VH); x.restore(); } }
    else if (f.k === 'boom') { const r = f.small ? 0.5 : 1; x.fillStyle = '#ffb040'; x.beginPath(); x.arc(f.x, f.y, (10 + p * 40) * r, 0, 7); x.fill(); x.fillStyle = '#fff2b0'; x.beginPath(); x.arc(f.x, f.y, (6 + p * 18) * r, 0, 7); x.fill(); }
    else if (f.k === 'ice') { x.strokeStyle = '#bff0ff'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047; x.moveTo(f.x, f.y); x.lineTo(f.x + Math.cos(a) * (5 + p * 13), f.y + Math.sin(a) * (5 + p * 13)); } x.stroke(); }
    else if (f.k === 'bolt') { for (const [w, c] of [[5, f.col || 'rgba(120,200,255,.5)'], [2, f.col ? '#d8ffdc' : '#ffffff']]) { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); f.pts.forEach((pt, i) => { if (!i) { x.moveTo(pt[0], pt[1]); return; } const a = f.pts[i - 1]; for (let k2 = 1; k2 <= 4; k2++) { const t = k2 / 4, j = k2 < 4 ? 6 : 0; x.lineTo(a[0] + (pt[0] - a[0]) * t + rr(-j, j), a[1] + (pt[1] - a[1]) * t + rr(-j, j)); } }); x.stroke(); } }
    else if (f.k === 'build') { x.strokeStyle = f.col; x.lineWidth = 3; x.beginPath(); x.ellipse(f.x, f.y, 14 + p * 26, (14 + p * 26) * 0.45, 0, 0, 7); x.stroke(); }
    else if (f.k === 'leak') { x.font = '900 30px Inter'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText('-' + f.n, f.x + 2, f.y - p * 40 + 2); x.fillStyle = '#ff5a4a'; x.fillText('-' + f.n, f.x, f.y - p * 40); }
    x.globalAlpha = 1;
  }
  if (V.beams.length) { const t = V.towerMap.get(V.beams[0]); if (t) sfx('crackle', t.x, t.y); }
  for (const f of V.fields) if (V.clock - f.t0 < f.dur - 0.5) sfx('burn', f.x, f.y);
  { let lv = 0; for (const j of V.jets.values()) if (j.fire && V.clock - j.t0 > TD.SPELLS.jet.unfold && onScreen(j.x, j.y, 150)) lv = 1; hissLevel(lv); }
  if (sheetKind === 'tower' && V.sel) { const t0 = V.towerMap.get(V.sel.tower); if (t0) { const k2 = (t0.lvl || 1) + ':' + (t0.readyAt > V.clock ? 1 : 0) + ':' + (V.myDef && TD.LEVELS[t0.k] ? +(V.myDef.gold >= (TD.LEVELS[t0.k].cost[t0.lvl || 1] || 1e9)) : 0); if ($('sheet').dataset.lv !== k2) showTowerSheet(t0); } }
  if (sheetKind === 'tower' && V.sel) { const t = V.towerMap.get(V.sel.tower), b = $('sheet').querySelector('[data-sell]'); if (t && b) { const l = sellLabel(t); if (b.textContent !== l) b.textContent = l; } }
  buildLoop(V.towers.some(t => t.readyAt > V.clock && onScreen(t.x, t.y, 120)));
  renderSpellBar();
  renderHUD();
}
requestAnimationFrame(frame);


// ============================ AUDIO ============================
// Everything is synthesized: no files to load. Sounds are throttled per kind so hundreds of units don't turn into noise.
const AU = { ctx: null, sfxOn: true, musOn: true, last: {}, hiss: null, mus: null };
try { AU.sfxOn = localStorage.getItem('td_sfx') !== '0'; AU.musOn = localStorage.getItem('td_mus') !== '0'; } catch (e) { }
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => { }); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const c = AU.ctx = new AC(), comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(c.destination);
  AU.out = comp; AU.sfx = c.createGain(); AU.sfx.gain.value = AU.sfxOn ? 0.55 : 0; AU.sfx.connect(comp); AU.musG = c.createGain(); AU.musG.gain.value = AU.musOn ? 0.32 : 0; AU.musG.connect(comp);
  const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = n;
  if (GS.running) musicStart();
}
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, audioInit, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!AU.ctx) return; if (document.hidden) AU.ctx.suspend().catch(() => { }); else AU.ctx.resume().catch(() => { }); });
function setSfx(on) { AU.sfxOn = on; try { localStorage.setItem('td_sfx', on ? '1' : '0'); } catch (e) { } if (AU.sfx) AU.sfx.gain.setTargetAtTime(on ? 0.55 : 0, AU.ctx.currentTime, 0.05); }
function setMusic(on) { AU.musOn = on; try { localStorage.setItem('td_mus', on ? '1' : '0'); } catch (e) { } if (AU.musG) AU.musG.gain.setTargetAtTime(on ? 0.32 : 0, AU.ctx.currentTime, 0.3); }
// building blocks
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function tone(type, f0, f1, t, a, dec, vol, dest, q) { const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + dec); env(g, t, a, vol, dec); o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + a + dec + 0.05); return o; }
function noise(t, dur, vol, ftype, f0, f1, q, dest, a) { const c = AU.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = AU.noise; s.loop = true; f.type = ftype; f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1; env(g, t, a || 0.005, vol, dur); s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random()); s.stop(t + (a || 0.005) + dur + 0.05); }
const SFX_GAP = { arrow: 0.05, cannon: 0.08, boom: 0.09, frost: 0.08, zap: 0.1, die: 0.045, bones: 0.06, raise: 0.15, charge: 0.3, crackle: 0.13, leak: 0.25, coin: 0.1, build: 0.2, done: 0.2, burn: 0.18 };
function sfx(k, wx, wy) {
  if (!AU.ctx || !AU.sfxOn || AU.ctx.state !== 'running') return;
  if (wx !== undefined && V && !onScreen(wx, wy, 120)) return;
  const c = AU.ctx, t = c.currentTime, gap = SFX_GAP[k] || 0; if (gap && t - (AU.last[k] || 0) < gap) return; AU.last[k] = t;
  const v = Math.min(1, 0.55 + cam.z * 0.35); // a bit louder zoomed in
  switch (k) {
    case 'arrow': noise(t, 0.07, 0.12 * v, 'bandpass', 3200, 1400, 2); tone('triangle', 900, 260, t, 0.004, 0.08, 0.05 * v); break;
    case 'cannon': tone('sine', 120, 38, t, 0.005, 0.32, 0.5 * v); noise(t, 0.25, 0.22 * v, 'lowpass', 1200, 300, 0.8); break;
    case 'boom': tone('sine', 90, 34, t, 0.005, 0.4, 0.42 * v); noise(t, 0.4, 0.26 * v, 'lowpass', 900, 160, 0.7); break;
    case 'frost': tone('sine', 1760, 1500, t, 0.003, 0.35, 0.07 * v); tone('sine', 2637, 2200, t, 0.003, 0.25, 0.05 * v); noise(t, 0.12, 0.05 * v, 'highpass', 5000, 5000, 0.7); break;
    case 'zap': { const o = tone('sawtooth', 160, 90, t, 0.004, 0.22, 0.12 * v); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 55; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.3); noise(t, 0.18, 0.12 * v, 'highpass', 3000, 6000, 0.8); break; }
    case 'crackle': for (let i = 0; i < 3; i++) noise(t + Math.random() * 0.1, 0.03, 0.06 * v, 'bandpass', 1200 + Math.random() * 2000, 0, 3); noise(t, 0.15, 0.04 * v, 'lowpass', 700, 500, 0.5); break;
    case 'burn': for (let i = 0; i < 4; i++) noise(t + Math.random() * 0.15, 0.025, 0.07 * v, 'bandpass', 900 + Math.random() * 2500, 0, 4); break;
    case 'bones': for (let i = 0; i < 4; i++) tone('square', 1400 + Math.random() * 1600, 900, t + i * 0.025 + Math.random() * 0.02, 0.001, 0.025, 0.03 * v); break;
    case 'die': noise(t, 0.09, 0.14 * v, 'lowpass', 1400, 400, 1); tone('sine', 150, 70, t, 0.004, 0.1, 0.12 * v); break;
    case 'leak': tone('square', 196, 98, t, 0.01, 0.45, 0.07); tone('sine', 98, 49, t, 0.01, 0.5, 0.25); break;
    case 'coin': tone('triangle', 1318, 1318, t, 0.003, 0.08, 0.07); tone('triangle', 1975, 1975, t + 0.07, 0.003, 0.14, 0.07); break;
    case 'build': for (let i = 0; i < 3; i++) { tone('square', 420, 300, t + i * 0.16, 0.002, 0.05, 0.05 * v); noise(t + i * 0.16, 0.05, 0.08 * v, 'bandpass', 1800, 900, 2); } break;
    case 'done': tone('triangle', 659, 659, t, 0.005, 0.12, 0.07 * v); tone('triangle', 988, 988, t + 0.09, 0.005, 0.2, 0.07 * v); break;
    case 'horn': { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1400, t + 0.5); f.frequency.linearRampToValueAtTime(500, t + 1.6); f.connect(AU.sfx); for (const [fr, vol] of [[146.8, 0.12], [220, 0.08], [147.6, 0.1]]) tone('sawtooth', fr, fr, t, 0.35, 1.3, vol, f); break; }
    case 'whoosh': noise(t, 0.75, 0.32, 'bandpass', 250, 1600, 1.5, null, 0.6); tone('sawtooth', 70, 140, t, 0.6, 0.15, 0.05); break;
    case 'meteor': tone('sine', 70, 24, t, 0.005, 1.4, 0.9); noise(t, 1.8, 0.55, 'lowpass', 1600, 120, 0.6); noise(t, 0.12, 0.4, 'highpass', 2500, 1200, 0.6); tone('triangle', 45, 30, t + 0.05, 0.05, 1.8, 0.3); break;
    case 'drop': tone('sine', 1400, 380, t, 0.02, 0.5, 0.06); break;
    case 'thud': tone('sine', 110, 42, t, 0.004, 0.3, 0.5); noise(t, 0.2, 0.2, 'lowpass', 700, 200, 0.8); tone('square', 600, 600, t + 0.05, 0.002, 0.04, 0.03); break;
    case 'raise': tone('sine', 180, 420, t, 0.05, 0.5, 0.06 * v); noise(t, 0.4, 0.04 * v, 'bandpass', 600, 1800, 3); break;
    case 'charge': tone('sawtooth', 220, 330, t, 0.05, 0.35, 0.05 * v); noise(t, 0.3, 0.06 * v, 'lowpass', 400, 200, 0.7); break;
    case 'cast': tone('sine', 520, 1040, t, 0.01, 0.15, 0.06); break;
  }
}
// continuous hiss while any water jet sprays on screen
const BLOOP = { buf: null, src: null, g: null, loading: false };
function buildLoop(on) {
  if (!AU.ctx || AU.ctx.state !== 'running') return; const c = AU.ctx;
  if (!BLOOP.buf) { if (!BLOOP.loading && window.TD_ASSETS) { BLOOP.loading = true; fetch(window.TD_ASSETS.buildLoop).then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(b => { BLOOP.buf = b; }).catch(() => { }); } return; }
  if (!BLOOP.g) { BLOOP.g = c.createGain(); BLOOP.g.gain.value = 0; BLOOP.g.connect(AU.sfx); }
  if (on && !BLOOP.src) { const s2 = c.createBufferSource(); s2.buffer = BLOOP.buf; s2.loop = true; s2.connect(BLOOP.g); s2.start(0, Math.random() * BLOOP.buf.duration); BLOOP.src = s2; }
  BLOOP.g.gain.setTargetAtTime(on ? 0.8 : 0, c.currentTime, on ? 0.05 : 0.15);
  if (!on && BLOOP.src && BLOOP.g.gain.value < 0.01) { try { BLOOP.src.stop(); } catch (e) { } BLOOP.src = null; }
}
function hissLevel(lv) {
  if (!AU.ctx || AU.ctx.state !== 'running') return; const c = AU.ctx;
  if (!AU.hiss) { const s = c.createBufferSource(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(); s.buffer = AU.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.6; f2.type = 'lowpass'; f2.frequency.value = 6000; g.gain.value = 0; s.connect(f); f.connect(f2); f2.connect(g); g.connect(AU.sfx); s.start(); AU.hiss = g; }
  AU.hiss.gain.setTargetAtTime(lv * 0.104, c.currentTime, 0.08);
}
// ---- music: generative, tense, minor key; drums get busier as the field fills up ----
const MUS = { bpm: 84, step: 0, next: 0, timer: null };
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
// D phrygian-ish progression, two bars each: Dm, Bb, Gm, A
const CHORDS = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
const OST = [0, 0, 1, 0, 0, 0, -2, 0]; // low ostinato offsets from the root (semitones): D D Eb D D D C D
const HORN = [[69, 2], [70, 2], [69, 4], [65, 2], [67, 2], [69, 4], [62, 8]];
function musicStart() {
  if (!AU.ctx || MUS.timer) return; const c = AU.ctx;
  // drone: two detuned saws through a slowly breathing lowpass
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 2; const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.16, c.currentTime, 2); f.connect(g); g.connect(AU.musG);
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  const oscs = [NOTE(38), NOTE(38) * 1.004, NOTE(45) * 0.998].map(fr => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
  MUS.drone = { g, oscs: oscs.concat(lfo) };
  MUS.step = 0; MUS.next = c.currentTime + 0.1;
  MUS.timer = setInterval(musicTick, 90);
}
function musicStop() { if (!MUS.timer) return; clearInterval(MUS.timer); MUS.timer = null; if (MUS.drone && AU.ctx) { const t = AU.ctx.currentTime; MUS.drone.g.gain.setTargetAtTime(0, t, 0.4); MUS.drone.oscs.forEach(o => { try { o.stop(t + 2); } catch (e) { } }); } MUS.drone = null; }
function musicTick() {
  const c = AU.ctx; if (!c || c.state !== 'running') return;
  const e8 = 60 / MUS.bpm / 2, busy = V ? Math.min(1, V.units.size / 120) : 0;
  while (MUS.next < c.currentTime + 0.35) {
    const t = MUS.next, s = MUS.step, bar = Math.floor(s / 8), beat = s % 8, chord = CHORDS[Math.floor(bar / 2) % 4], root = chord[0] - 12;
    const out = AU.musG;
    // low string ostinato (eighths)
    tone('triangle', NOTE(root + OST[beat]), NOTE(root + OST[beat]), t, 0.01, e8 * 0.9, 0.11, out);
    tone('sawtooth', NOTE(root + OST[beat] + 12), NOTE(root + OST[beat] + 12), t, 0.01, e8 * 0.5, 0.018, out);
    // pad on each chord change
    if (s % 16 === 0) for (const n of chord) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.connect(out); for (const det of [0.997, 1.003]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = NOTE(n) * det; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + e8 * 16); o.connect(g); g.connect(fl); o.start(t); o.stop(t + e8 * 16 + 0.1); } }
    // war drums: downbeats always, more hits as the field fills up
    const drum = beat === 0 || beat === 4 || (beat === 6 && bar % 2) || (busy > 0.3 && beat === 3) || (busy > 0.6 && (beat === 7 || beat === 2));
    if (drum) { tone('sine', beat === 0 ? 82 : 98, 42, t, 0.003, 0.45, beat === 0 ? 0.5 : 0.32, out); noise(t, 0.12, 0.08, 'lowpass', 500, 200, 0.7, out); }
    if (busy > 0.15 && beat % 2 === 1) noise(t, 0.04, 0.03 + busy * 0.03, 'highpass', 6000, 6000, 0.7, out);
    // horn line every 8 bars
    const hb = s % 64; if (hb >= 32) { let at = 32; for (const [n, len] of HORN) { if (hb === at) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(600, t); fl.frequency.linearRampToValueAtTime(1500, t + 0.3); fl.connect(out); const o = tone('sawtooth', NOTE(n - 12), NOTE(n - 12), t, 0.12, e8 * len, 0.045, fl); const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5; vg.gain.value = 2.5; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + e8 * len + 0.2); } at += len; } }
    MUS.next += e8; MUS.step++;
  }
}

// ============================ BOOT ============================
function tryReload(v) { let tried = null; try { tried = sessionStorage.getItem('td_reload_for'); } catch (e) { } if (tried === v) return false; try { sessionStorage.setItem('td_reload_for', v); } catch (e) { } location.replace(location.pathname + '?v=' + v); return true; }
async function checkVersion() { if (BUILD === 'dev' || location.protocol === 'file:') return; try { const v = (await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json()).version; if (v && v !== BUILD && !GS.running && !L.mode) tryReload(v); } catch (e) { } }
setInterval(checkVersion, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
$('netLeave').onclick = () => { $('netOv').classList.add('hidden'); quitGame(); };
window.addEventListener('load', () => { $('ver').textContent = 'v' + VER; $('ver').title = 'build ' + BUILD; show('menu'); renderMenu(); checkVersion(); });
window.TDC = { get V() { return V; }, GS, L, get LS() { return LS; }, cam, send, req, onTap, lookAtLane, renderAtk, build, setBuild, spell, AU, MUS, sfx, hissLevel };
})();
