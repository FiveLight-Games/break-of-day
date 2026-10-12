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
let myName = (store.get('name', '') || '').slice(0, 16);
let myHero = store.get('hero', 'ironvow'); if (!DW.HEROES[myHero]) myHero = 'ironvow';
const fmtT = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
const RAR_COL = DW.RARITY.map(r => r.col);
const itemCol = it => it.rar >= 0 ? RAR_COL[it.rar] : it.rar === -2 ? '#7ae8ff' : '#f0e2b6';
function statLine(s) { return Object.keys(s).map(k => '+' + (DW.PCT[k] ? Math.round(s[k] * 100) + '%' : Math.round(s[k] * 10) / 10) + ' ' + (DW.STAT_NAMES[k] || k)).join(', '); }
function toast(t, c) { const el = document.createElement('div'); el.className = 'toast ' + (c || ''); el.textContent = t; $('toasts').appendChild(el); setTimeout(() => el.remove(), 2600); }
function show(id) { ['menu', 'lobby', 'game', 'end'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }

// ============================ NETWORK / LOBBY ============================
// Same flow as Connect War: choose a name, then Find match / Host lobby / Find lobby / Play solo.
// Open lobbies live in the Supabase table "bod_lobbies": the host refreshes its row every 5s while the
// lobby is open; Find lobby re-reads the list every 5s and only shows rows refreshed in the last 20s.
let sb = null;
function getSB() { if (!sb && window.supabase) sb = window.supabase.createClient(SB_URL, SB_KEY, { realtime: { params: { eventsPerSecond: 40 } } }); return sb; }
const L = { gm: DW.MODES[store.get('gm', 'standard')] ? store.get('gm', 'standard') : 'standard', mode: null, code: null, ch: null, players: [], host: false, ready: false, started: false, lobbyName: '', max: 4, quick: false };
let homeScreen = myName ? 'home' : 'name', menuErr = '', updateReady = null;
const cleanName = t => String(t || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const randomCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const modeName = k => (DW.MODES[k] || DW.MODES.standard).name;

/* ---------- main menu ---------- */
function renderMenu() {
  const m = $('menuPanel'); if (!m) return;
  $('menuWho').innerHTML = myName ? `Playing as <b>${esc(myName)}</b> <button class="linkbtn" data-act="rename">Change</button>` : '';
  if (homeScreen === 'name' || !myName) m.innerHTML = nameScreen();
  else if (homeScreen === 'host') m.innerHTML = hostScreen();
  else if (homeScreen === 'browse') m.innerHTML = browseScreen();
  else if (homeScreen === 'search') m.innerHTML = searchScreen();
  else if (homeScreen === 'joining') m.innerHTML = joiningScreen();
  else m.innerHTML = homeScreenHtml();
  $('menuBanner').classList.toggle('hidden', !updateReady); $('menuBanner').textContent = 'A new version is ready — reloading…';
  bindMenu();
}
function modeCards() {
  return `<div class="modes">${Object.keys(DW.MODES).map(k => `<button class="mode ${L.gm === k ? 'on' : ''}" data-gm="${k}" aria-pressed="${L.gm === k}"><span class="mn">${DW.MODES[k].name}</span><span class="md">${DW.MODES[k].desc}</span></button>`).join('')}</div>`;
}
function homeScreenHtml() {
  const sess = getSession(), on = !!getSB();
  return `<div class="eyebrow">New game</div>
    ${modeCards()}
    <button class="btn primary big" data-act="quick" ${on ? '' : 'disabled'}><span class="bi">⚔</span>Find Match<small>Join the next war party heading out</small></button>
    <div class="row2">
      <button class="btn stone" data-act="hostform" ${on ? '' : 'disabled'}><span class="bi">👑</span>Host Lobby</button>
      <button class="btn stone" data-act="browse" ${on ? '' : 'disabled'}><span class="bi">🔍</span>Find Lobby</button>
    </div>
    <button class="btn stone" data-act="solo"><span class="bi">🛡</span>Play Solo</button>
    ${sess && !sess.host ? `<button class="btn rejoin" data-act="rejoin">↻ Rejoin match ${esc(sess.code)}</button>` : ''}
    ${on ? '' : `<p class="err">Online play is unavailable: the game server didn't load. Solo still works.</p>`}
    <p class="err">${esc(menuErr)}</p>`;
}
function nameScreen() {
  return `<div class="eyebrow">${myName ? 'Change your name' : 'Welcome, warrior'}</div>
    <h2>${myName ? 'Change your name' : 'Choose your name'}</h2>
    <p class="muted">Other players see this in lobbies and during matches.</p>
    <form id="nameForm" class="stack"><input id="nameIn" class="textin" maxlength="16" placeholder="Your name" autocomplete="nickname" value="${esc(myName)}"><button class="btn primary" type="submit">Save</button></form>
    ${myName ? `<button class="btn ghost" data-act="home">Back</button>` : ''}
    <p class="err">${esc(menuErr)}</p>`;
}
function hostScreen() {
  return `<div class="eyebrow">Host a lobby · ${esc(modeName(L.gm))}</div>
    <h2>Raise your banner</h2>
    <form id="hostForm" class="stack">
      <label class="muted small" for="lobbyIn">Lobby name</label>
      <input id="lobbyIn" class="textin" maxlength="28" placeholder="${esc(myName)}'s Lobby" autocomplete="off" value="${esc(store.get('lobbyName', ''))}">
      <div class="seg"><span class="seg-l">Players</span>${[2, 3, 4].map(n => `<button type="button" class="${L.max === n ? 'on' : ''}" data-max="${n}">${n}</button>`).join('')}</div>
      ${modeCards()}
      <button class="btn primary" type="submit">Open Lobby</button>
    </form>
    <button class="btn ghost" data-act="home">Back</button>`;
}
function browseScreen() {
  const d = dir, list = d.list;
  return `<div class="eyebrow">Find lobby</div>
    <h2>Open lobbies</h2>
    ${!d.ready ? `<p class="muted">Loading lobbies…</p>` : list.length ? `<ul class="lobbies">${list.map(l => `
      <li><button class="lobby" data-joinlobby="${esc(l.code)}">
        <span class="lb-name">${esc(l.name)}</span>
        <span class="lb-meta">${esc(modeName(l.mode))} · hosted by ${esc(l.host)}</span>
        <span class="lb-heroes">${String(l.heroes || '').split(',').filter(h => DW.HEROES[h]).map(h => `<i>${window.BOD_ICONS.hero(h)}</i>`).join('')}</span>
        <span class="lb-seats">${l.joined}/${l.n}</span></button></li>`).join('')}</ul>`
      : `<p class="muted">No open lobbies right now. Host one, or try Find Match.</p>`}
    <div class="refreshrow"><span class="muted small">${d.err ? esc(d.err) : d.ready ? 'Refreshes every 5 seconds' : ''}</span><button class="linkbtn" data-act="refresh">Refresh now</button></div>
    <button class="btn ghost" data-act="home">Back</button>
    <p class="err">${esc(menuErr)}</p>`;
}
function searchScreen() {
  return `<div class="eyebrow">${esc(modeName(L.gm))} · Find match</div>
    <div class="radar" aria-hidden="true"><i></i><i></i><i></i></div>
    <h2>Finding a war party…</h2>
    <p class="muted">${esc(qm.status || 'Searching for open lobbies.')}</p>
    <button class="btn ghost" data-act="mm-cancel">Cancel</button>
    <p class="err">${esc(menuErr)}</p>`;
}
function joiningScreen() {
  return `<div class="eyebrow">Lobby</div><div class="radar" aria-hidden="true"><i></i><i></i><i></i></div>
    <h2>Joining…</h2><p class="muted">${esc(menuErr || 'Connecting to the host.')}</p>
    <button class="btn ghost" data-act="cancel-join">Cancel</button>`;
}
function bindMenu() {
  const root = $('menu');
  root.querySelectorAll('[data-act]').forEach(b => b.onclick = e => { e.preventDefault(); menuAct(b.dataset.act); });
  root.querySelectorAll('[data-gm]').forEach(b => b.onclick = e => { e.preventDefault(); L.gm = b.dataset.gm; store.set('gm', L.gm); renderMenu(); });
  root.querySelectorAll('[data-max]').forEach(b => b.onclick = e => { e.preventDefault(); L.max = +b.dataset.max; const v = $('lobbyIn') && $('lobbyIn').value; renderMenu(); if (v !== undefined && $('lobbyIn')) $('lobbyIn').value = v; });
  root.querySelectorAll('[data-joinlobby]').forEach(b => b.onclick = () => { landscapeLock(); stopBrowsing(); joinLobby(b.dataset.joinlobby); });
  const nf = $('nameForm'); if (nf) { nf.onsubmit = e => { e.preventDefault(); const n = cleanName($('nameIn').value); if (!n) { menuErr = 'Enter a name.'; return renderMenu(); } myName = n; store.set('name', n); menuErr = ''; homeScreen = 'home'; renderMenu(); }; setTimeout(() => $('nameIn') && $('nameIn').focus(), 50); }
  if ($('lobbyIn')) $('lobbyIn').oninput = e => store.set('lobbyName', e.target.value.replace(/[<>]/g, '').slice(0, 28));
  const hf = $('hostForm'); if (hf) hf.onsubmit = e => { e.preventDefault(); landscapeLock(); const ln = String($('lobbyIn').value || '').replace(/[<>]/g, '').trim().slice(0, 28); store.set('lobbyName', ln); hostLobby({ name: ln }); };
}
function menuAct(a) {
  menuErr = '';
  if (a === 'rename') { homeScreen = 'name'; return renderMenu(); }
  if (a === 'home') { stopBrowsing(); homeScreen = 'home'; return renderMenu(); }
  if (a === 'hostform') { homeScreen = 'host'; return renderMenu(); }
  if (a === 'browse') { homeScreen = 'browse'; startBrowsing(); return renderMenu(); }
  if (a === 'refresh') return fetchLobbies();
  if (a === 'solo') { landscapeLock(); return enterSolo(); }
  if (a === 'quick') { landscapeLock(); return startQuick(); }
  if (a === 'mm-cancel') { stopQuick(); homeScreen = 'home'; return renderMenu(); }
  if (a === 'cancel-join') { leaveLobby(); return; }
  if (a === 'rejoin') { const s = getSession(); if (s) { landscapeLock(); rejoin(s); } return; }
}

/* ---------- lobby directory ---------- */
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
function lobbyRow() {
  const ps = L.players.slice(0, L.max);
  return { code: L.code, name: (L.lobbyName || `${myName}'s Lobby`).slice(0, 40), host: myName.slice(0, 20), mode: L.gm, n: L.max, joined: Math.max(1, ps.length), heroes: ps.map(p => p.hero).join(',').slice(0, 120), version: BUILD };
}
function advertise() {
  const s = getSB(); if (!s || !L.host || L.mode !== 'host' || L.started) return unadvertise();
  const beat = () => {
    if (!L.host || L.started || !L.code) return unadvertise();
    s.from('bod_lobbies').upsert(lobbyRow(), { onConflict: 'code' }).then(({ error }) => { if (error) console.warn('lobby heartbeat failed', error.message); });
  };
  advertised = L.code; beat();
  if (!hostBeat) hostBeat = setInterval(beat, 5000);
}
function unadvertise() {
  if (hostBeat) clearInterval(hostBeat); hostBeat = null;
  const s = getSB(); if (advertised && s) { const c = advertised; advertised = null; s.from('bod_lobbies').delete().eq('code', c).then(() => { }, () => { }); }
}
window.addEventListener('pagehide', () => { if (advertised) unadvertise(); });

/* ---------- find match (quick join) ---------- */
// Joins the fullest open lobby for the chosen mode. If none exists, opens a "Quick Match" lobby and keeps
// watching: if an older quick-match lobby appears, it closes its own and joins that one, so players gather.
const qm = { timer: null, status: '' };
async function startQuick() {
  if (!getSB()) return;
  homeScreen = 'search'; qm.status = 'Searching for open lobbies.'; renderMenu();
  const list = (await fetchLobbies()).filter(l => l.mode === L.gm && l.joined < l.n).sort((a, b) => b.joined - a.joined || new Date(a.created_at) - new Date(b.created_at));
  if (homeScreen !== 'search') return;
  if (list.length) { qm.status = 'Found ' + list[0].name + '. Joining…'; renderMenu(); return joinLobby(list[0].code); }
  hostLobby({ name: 'Quick Match', quick: true });
}
function stopQuick() { if (qm.timer) clearInterval(qm.timer); qm.timer = null; }
function quickWatch() {
  stopQuick();
  qm.timer = setInterval(async () => {
    if (!L.quick || !L.host || L.started || L.players.length > 1) return;
    const older = (await fetchLobbies()).filter(l => l.mode === L.gm && l.joined < l.n && l.name === 'Quick Match' && l.code !== L.code && new Date(l.created_at) < new Date(L.createdAt));
    if (older.length && L.quick && L.players.length <= 1 && !L.started) { stopQuick(); const c = older[0].code; leaveLobby(true); joinLobby(c); }
  }, 4000);
}

/* ---------- lobby room ---------- */
function hostLobby(o) {
  if (!getSB()) { menuErr = 'Network unavailable'; return renderMenu(); }
  L.mode = 'host'; L.host = true; L.ready = true; L.started = false; L.players = []; L.code = randomCode(); L.lobbyName = o.name || ''; L.quick = !!o.quick; L.createdAt = new Date().toISOString();
  if (L.quick) L.max = 4;
  L.joined = Date.now(); homeScreen = 'home';
  enterLobbyScreen(); openRoomChannel(); advertise(); if (L.quick) quickWatch();
}
function joinLobby(code) {
  if (!getSB()) { menuErr = 'Network unavailable'; return renderMenu(); }
  L.mode = 'client'; L.host = false; L.ready = false; L.started = false; L.players = []; L.code = String(code).toUpperCase(); L.joined = Date.now(); L.seenHost = false; L.quick = false;
  homeScreen = 'joining'; renderMenu();
  openRoomChannel();
  clearTimeout(L.joinTimer); L.joinTimer = setTimeout(() => { if (!L.seenHost && L.mode === 'client' && !G.running) { leaveLobby(); menuErr = 'That lobby is no longer open.'; renderMenu(); } }, 9000);
}
function enterSolo() {
  L.mode = 'solo'; L.host = true; L.ready = true; L.started = false; L.code = null; L.lobbyName = 'Solo Expedition'; L.quick = false; L.max = 1;
  L.players = [{ pid: myPid, name: myName, hero: myHero, ready: true, host: true }];
  enterLobbyScreen();
}
function enterLobbyScreen() {
  show('lobby'); renderHeroPick(); renderLobby();
  $('btnInvite').classList.toggle('hidden', L.mode === 'solo' || !L.code);
  $('btnInvite').onclick = () => { const url = location.origin + location.pathname + '#' + L.code; (navigator.share && MOBILE ? navigator.share({ title: 'Break of Day', text: 'Join my war party', url }) : navigator.clipboard.writeText(url)).then(() => toast('Invite link ready', 'info'), () => toast(url, 'info')); };
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
    const hostP = arr.find(p => p.host);
    if (hostP) {
      if (!L.seenHost && !L.host && !G.running) {
        if (hostP.v !== BUILD) { menuErr = 'That lobby is on a different version. Reload the page to update, then try again.'; leaveLobby(); return; }
        if (hostP.started) { menuErr = 'That match has already started.'; leaveLobby(); return; }
        L.seenHost = true; clearTimeout(L.joinTimer); L.ready = false; enterLobbyScreen(); pushPresence();
      }
      L.seenHost = true; clearTimeout(L.hostGone); L.hostGone = null;
      if (!L.host) { L.gm = hostP.gm || L.gm; L.max = hostP.max || 4; L.lobbyName = hostP.ln || ''; }
    }
    if (!L.host && L.seenHost && !hostP && !L.hostGone) {
      L.hostGone = setTimeout(() => { L.hostGone = null; if (L.players.some(p => p.host)) return; toast('The host has left — the lobby closed'); clearSession(); if (G.running) quitGame(); else { leaveLobby(); menuErr = 'The host closed the lobby.'; renderMenu(); } }, G.running ? 20000 : 3000);
    }
    if (G.running) return;
    if (L.host) {
      // reject wrong versions and overflow
      arr.filter(p => !p.host && p.v !== BUILD).forEach(p => ch.send({ type: 'broadcast', event: 'kick', payload: { pid: p.pid, reason: 'Different game version. Reload the page to update.' } }));
      arr.filter(p => !p.host).slice(L.max - 1).forEach(p => ch.send({ type: 'broadcast', event: 'kick', payload: { pid: p.pid, reason: 'That lobby is full.' } }));
      if (L.mode === 'host') advertise();
    }
    if (L.seenHost || L.host) renderLobby();
  });
  ch.on('broadcast', { event: 'start' }, ({ payload }) => { if (!L.host && !G.running && L.seenHost) { L.started = true; startGame('client', payload); } });
  ch.on('broadcast', { event: 's' }, ({ payload }) => { if (G.running && G.mode === 'client') applySnap(payload); });
  ch.on('broadcast', { event: 'in' }, ({ payload }) => { if (G.running && G.mode === 'host' && G.sim) G.sim.input(payload.pid, payload.c); });
  ch.on('broadcast', { event: 'kick' }, ({ payload }) => { if (payload.pid === myPid && !L.host) { leaveLobby(); menuErr = payload.reason || 'Removed from the lobby.'; renderMenu(); } });
  ch.subscribe(st => { if (st === 'SUBSCRIBED') pushPresence(); else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !G.running) { menuErr = "Can't reach the game server. Check your connection."; renderMenu(); } });
}
function pushPresence() { if (L.ch) L.ch.track({ pid: myPid, name: myName, hero: myHero, ready: L.ready, host: L.host, joined: L.joined, v: BUILD, gm: L.host ? L.gm : undefined, max: L.host ? L.max : undefined, ln: L.host ? L.lobbyName : undefined, started: L.host ? L.started : undefined }); }
function leaveLobby(silent) {
  stopQuick(); unadvertise(); clearTimeout(L.joinTimer);
  if (L.ch) { try { L.ch.untrack(); getSB().removeChannel(L.ch); } catch (e) { } }
  L.ch = null; L.code = null; L.seenHost = false; L.quick = false; clearTimeout(L.hostGone); L.hostGone = null; L.mode = null;
  if (silent) return;
  homeScreen = 'home'; show('menu'); renderMenu();
}
// ---- session / rejoin ----
function saveSession() { if (L.mode === 'solo') return; store.set('session', JSON.stringify({ code: L.code, host: L.host, t: Date.now() })); }
function clearSession() { store.set('session', ''); }
function getSession() { try { const s = JSON.parse(store.get('session', '') || 'null'); if (s && Date.now() - s.t < 45 * 60000) return s; } catch (e) { } return null; }
function rejoin(sess) {
  if (sess.host) { menuErr = 'Matches end when the host leaves.'; clearSession(); return renderMenu(); }
  if (!getSB()) return;
  L.mode = 'client'; L.host = false; L.ready = true; L.started = true; L.code = sess.code; L.joined = Date.now(); L.seenHost = true;
  openRoomChannel(); startGame('client', { players: [], rejoin: 1 });
  $('netOv').classList.remove('hidden'); $('netTxt').textContent = 'Rejoining match ' + sess.code + '…';
  setTimeout(() => { if (G.running && !G.cur) { clearSession(); quitGame(); menuErr = 'Match not found — it may have ended.'; renderMenu(); } }, 15000);
}
function renderRejoin() { renderMenu(); }
function trackRoom() { if (L.mode === 'host') advertise(); }
/* ---------- lobby screen ---------- */
function renderHeroPick() {
  $('heroPick').innerHTML = DW.HERO_IDS.map(id => { const h = DW.HEROES[id]; return `<button class="heroCard ${id === myHero ? 'sel' : ''}" data-h="${id}" style="--hc:${h.col}"><div class="hPort">${window.BOD_ICONS.hero(id)}</div><div><b>${h.name}</b><small>${h.role} · ${h.res.type}</small></div></button>`; }).join('');
  $('heroPick').querySelectorAll('.heroCard').forEach(b => b.onclick = () => { myHero = b.dataset.h; store.set('hero', myHero); renderHeroPick(); if (L.mode === 'solo') L.players[0].hero = myHero; pushPresence(); renderLobby(); });
  renderHeroInfo(myHero, $('heroInfo'));
}
function renderHeroInfo(id, el) {
  const h = DW.HEROES[id], b = h.base;
  el.innerHTML = `<h3 style="color:${h.col}">${h.name} <small>${h.title}</small></h3>
  <div class="statGrid">${[['HP', b.hp], ['Attack Dmg', b.ad], ['Armor', b.armor], ['Magic Resist', b.mr], ['Movespeed', b.ms], ['Range', b.range > 4 ? 'Ranged' : 'Melee'], ['Resource', h.res.type], ['Crit', Math.round(b.crit * 100) + '%']].map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('')}</div>
  ${h.ab.map((a, i) => `<div class="abInfo withIcon"><div class="tipIcon">${window.BOD_ICONS.ability(id, i)}</div><div><b>${a.n}</b>${a.ult ? ' <i>(Ultimate · lvl 6/11/16)</i>' : ''}<p>${a.d}</p></div></div>`).join('')}`;
}
function renderLobby() {
  const solo = L.mode === 'solo', n = solo ? 1 : L.max;
  $('lobbyEyebrow').textContent = solo ? 'Solo' : modeName(L.gm) + ' · Lobby' + (L.quick ? ' · Quick match' : '');
  $('lobbyTitle').textContent = solo ? 'Solo Expedition' : (L.lobbyName || ((L.players.find(p => p.host) || {}).name || myName) + "'s Lobby");
  $('lobbyCode').textContent = solo ? '' : 'Code ' + (L.code || '');
  $('modePick').innerHTML = Object.keys(DW.MODES).map(k => `<button class="mode sm ${L.gm === k ? 'on' : ''}" data-lgm="${k}" ${L.host ? '' : 'disabled'}><span class="mn">${DW.MODES[k].name}</span><span class="md">${DW.MODES[k].desc}</span></button>`).join('');
  $('modePick').querySelectorAll('[data-lgm]').forEach(b => b.onclick = () => { if (!L.host) return; L.gm = b.dataset.lgm; store.set('gm', L.gm); pushPresence(); advertise(); renderLobby(); });
  const ps = L.players.slice(0, n);
  $('playerList').innerHTML = [...Array(n).keys()].map(i => { const p = ps[i]; if (!p) return `<li class="seat empty"><div class="hPort sm ghostp"></div><span class="muted">Waiting for player…</span></li>`;
    const h = DW.HEROES[p.hero] || DW.HEROES.ironvow;
    return `<li class="seat ${p.ready ? 'rdy' : ''}"><div class="hPort sm">${window.BOD_ICONS.hero(p.hero in DW.HEROES ? p.hero : 'ironvow')}</div><span class="sn"><b>${esc(p.name)}${p.pid === myPid ? ' (you)' : ''}</b>${p.host ? ' <span class="crown">👑</span>' : ''}<small style="color:${h.col}">${h.name} · ${h.role}</small></span><span class="${p.ready ? 'ok' : 'muted'}">${p.ready ? 'Ready' : 'Picking…'}</span>${L.host && !p.host && L.mode === 'host' ? `<button class="btn sm ghost" data-kick="${p.pid}">✕</button>` : ''}</li>`; }).join('');
  $('playerList').querySelectorAll('[data-kick]').forEach(b => b.onclick = () => L.ch.send({ type: 'broadcast', event: 'kick', payload: { pid: b.dataset.kick, reason: 'The host removed you from the lobby.' } }));
  const btn = $('btnReady');
  if (L.host) { const all = ps.every(p => p.ready); btn.textContent = solo ? 'Begin the Battle' : 'Begin the Battle (' + ps.length + '/' + n + ')'; btn.disabled = !all; btn.onclick = hostStart;
    $('lobbyHint').textContent = solo ? '' : !all ? 'Waiting for everyone to ready up…' : ps.length < n ? 'You can start now, or wait for more players. Your lobby is listed under Find Lobby. Keep this page open: your device runs the match.' : 'Everyone is ready.'; }
  else { btn.disabled = false; btn.textContent = L.ready ? 'Unready' : 'Ready'; btn.onclick = () => { landscapeLock(); L.ready = !L.ready; pushPresence(); renderLobby(); }; $('lobbyHint').textContent = 'The host starts the match when everyone is ready.'; }
  $('btnLeave').textContent = solo ? 'Back' : L.host ? 'Close lobby' : 'Leave lobby';
  $('btnLeave').onclick = () => { if (solo) { L.mode = null; show('menu'); renderMenu(); } else leaveLobby(); };
}
function hostStart() {
  landscapeLock();
  const players = L.players.slice(0, L.mode === 'solo' ? 1 : L.max).map(p => ({ pid: p.pid, name: p.name, hero: p.hero }));
  const seed = Math.floor(Math.random() * 2 ** 31);
  if (L.mode === 'host') { L.started = true; stopQuick(); unadvertise(); pushPresence(); L.ch.send({ type: 'broadcast', event: 'start', payload: { seed, players, mode: L.gm } }); }
  startGame(L.mode, { seed, players, mode: L.gm });
}
/* ---------- updates (same as Connect War: reload into a new build from the menu) ---------- */
function tryReload(v) { let tried = null; try { tried = sessionStorage.getItem('bod_reload_for'); } catch (e) { } if (tried === v) return false; try { sessionStorage.setItem('bod_reload_for', v); } catch (e) { } location.replace(location.pathname + '?v=' + v + location.hash); return true; }
async function checkVersion() {
  if (BUILD === 'dev' || location.protocol === 'file:') return;
  try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); const v = (await res.json()).version;
    if (!v || v === BUILD) return;
    const idle = !G.running && !L.mode;
    if (idle && tryReload(v)) return;
    if (updateReady !== v) { updateReady = v; if (!G.running && $('menu') && !$('menu').classList.contains('hidden')) renderMenu(); }
  } catch (e) { }
}
setInterval(checkVersion, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
function initMenu() {
  $('ver').textContent = 'v' + DW.VERSION + ' · build ' + BUILD;
  $('menuWho').addEventListener('click', e => { if (e.target.dataset.act === 'rename') { homeScreen = 'name'; renderMenu(); } });
  $('menuHeroes').innerHTML = DW.HERO_IDS.map(id => `<div class="mh" style="--hc:${DW.HEROES[id].col}" title="${DW.HEROES[id].name}">${window.BOD_ICONS.hero(id)}<span>${DW.HEROES[id].name}</span></div>`).join('');
  renderMenu(); checkVersion();
  const hash = location.hash.replace('#', '').trim().toUpperCase();
  if (hash.length >= 4 && hash.length <= 8 && myName && getSB()) { history.replaceState(null, '', location.pathname); joinLobby(hash); }
}

// ============================ GAME STATE ============================
const G = { running: false, mode: null, sim: null, cur: null, prev: null, prevMap: new Map(), recvT: 0, interval: 100, me: null, stats: {}, aim: null,
  camX: 0, camZ: 100, panning: false, panX: 0, panZ: 0, zoom: 1, mouse: { x: 0, y: 0, wx: 0, wz: 0, in: false }, meshes: new Map(), projMeshes: new Map(), zoneMeshes: [], fxList: [], nums: [], ended: false };
let renderer, scene, camera, hemi, sun, moonFill, heroLight, overlay, octx, mini, mctx, miniBg, raycaster, groundPlane, rangeRing, aimArrow, aimCircle, tgtRing, myRing, waterMat, lampMat;

function landscapeLock() {
  try { const el = document.documentElement; if (window.matchMedia('(pointer:coarse)').matches && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); }).catch(() => { }); } catch (e) { }
}
function startGame(mode, cfg) {
  if (!renderer) { show('game'); $('loading').classList.remove('hidden'); setTimeout(() => { try { init3D(); } finally { $('loading').classList.add('hidden'); } startGame(mode, cfg); }, 60); return; }
  G.mode = mode; G.running = true; G.ended = false; G.cur = G.prev = null; G.stats = {}; G.nums = []; G.aim = null; G.myHeroId = null; G.panning = false;
  G.players = cfg.players; G.recvT = 0; G.lastNet = performance.now();
  saveSession();
  show('game'); $('feed').innerHTML = '';
  if (!renderer) init3D();
  clearWorld(); buildHUD(); fogReset();
  introStart(!cfg.rejoin && !window.BOD_NO_INTRO, cfg.mode);
  if (mode !== 'client') {
    G.sim = new DW.Sim({ seed: cfg.seed, players: cfg.players, mode: cfg.mode }); G.stepN = 0; G.sim.reveal = !!G.intro;
    clearInterval(G.simTimer); let last = performance.now(), acc = 0, introTick = 0;
    G.simTimer = setInterval(() => {
      const now = performance.now();
      if (G.intro) { // world is frozen during the opening cinematic; keep clients fed with a full, unfogged view
        last = now; acc = 0;
        if (introTick++ % 10 === 0) { const snap = G.sim.snapshot(true); if (mode === 'host' && L.ch) L.ch.send({ type: 'broadcast', event: 's', payload: snap }); applySnap(snap); }
        return;
      }
      if (G.sim.reveal) G.sim.reveal = false;
      acc += Math.min(0.5, (now - last) / 1000); last = now;
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
// ---------- opening cinematic ----------
const INTRO_TITLE = 2.0, INTRO_BLEND = 1.1;
const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function introShots() {
  const C1 = DW.MAP.cores.find(c => c.team === 1), shots = [];
  // the ground rises steeply past the map edge; tight fog keeps that wall sky-coloured in low shots
  shots.push({ d: 3.0, cap: ['The Enemy Core', 'Shatter it to win'], fog: () => [34, 80],
    pos: t => { const a = -0.6 + ease(t) * 1.2; return [C1.x + Math.sin(a) * 34, 17 - t * 4, C1.z + Math.cos(a) * 34]; }, look: () => [C1.x, 3.5, C1.z] });
  [['L', 2], ['M', 1], ['R', 0]].forEach(([k, tier]) => {
    const cz = DW.LANE_CAMPS[tier].z, cx = DW.laneX(k, cz), side = k === 'L' ? -9 : k === 'R' ? 9 : 6, I = DW.LANE_INFO[k];
    shots.push({ d: 2.4, cap: [I.name + ' · ' + I.theme, DW.CAMP_NAMES[k][tier]], fog: () => [50, 140],
      pos: t => { const e = ease(t), z = cz + 44 - e * 20; return [DW.laneX(k, z) + side * (1 - e * 0.35), 21 - e * 8, z]; }, look: t => [cx, 1.5, cz - 1 - t * 2] });
  });
  const hs = G.cur && G.cur.h && G.cur.h.length ? G.cur.h : null, C0 = DW.MAP.cores.find(c => c.team === 0);
  const hx = hs ? hs.reduce((a, h) => a + h.x, 0) / hs.length : 0, hz = hs ? hs.reduce((a, h) => a + h.z, 0) / hs.length : 186;
  const cxm = hx + (hx <= C0.x ? 2.8 : -2.8), mid = hx * 0.55 + C0.x * 0.45; // offset so the Core stands beside the heroes, not hidden behind them
  const A = [hx + 13, 17, hz - 30], B = [cxm + 1.2, 0.9, hz - 10], C = [cxm, 0.42, hz - 7.6];
  shots.push({ d: 4.4, cap: null, hero: 1, fog: t => t < 0.42 ? [34, 90] : [30 - 6 * ease((t - 0.42) / 0.58), 66],
    pos: t => t < 0.42 ? lerp3(A, B, ease(t / 0.42)) : lerp3(B, C, ease((t - 0.42) / 0.58)),
    look: t => t < 0.42 ? lerp3([hx, 1.5, hz - 4], [hx, 2.4, hz], ease(t / 0.42)) : lerp3([hx, 2.4, hz], [mid, 4.2, hz + 5], ease((t - 0.42) / 0.58)) });
  return shots;
}
function introStart(on, mode) {
  const el = $('intro'), game = $('game');
  if (!on) { G.intro = null; el.classList.add('hidden'); game.classList.remove('intro'); if (FOG.uni) FOG.uni.fogOn.value = 1; return; }
  G.intro = { el: 0, shots: null, shot: -1 };
  el.classList.remove('hidden', 'out'); game.classList.add('intro'); if (FOG.uni) FOG.uni.fogOn.value = 0;
  $('introTitle').style.opacity = 1; $('introFade').style.opacity = 0; $('introCap').style.opacity = 0;
  const t = $('introTitle').querySelector('.title'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  $('introMode').textContent = (DW.MODES[mode] || DW.MODES.standard).name;
}
function introEnd() {
  if (!G.intro) return; G.intro = null;
  $('game').classList.remove('intro'); $('intro').classList.add('hidden'); if (FOG.uni) FOG.uni.fogOn.value = 1;
}
// camera pose for the cinematic at time `now`, or null when it's over. `game` is the normal gameplay pose to blend into.
function introPose(dt, game) {
  const I = G.intro; if (!I) return null;
  if (!I.shots) { if (!G.cur) return { p: [0, 30, 0], l: [0, 0, -40], fog: [40, 120] }; I.shots = introShots(); }
  I.el += Math.min(dt, 0.05); const el = I.el, S = I.shots, total = S.reduce((a, s) => a + s.d, 0);
  $('introTitle').style.opacity = el < INTRO_TITLE ? 1 : Math.max(0, 1 - (el - INTRO_TITLE) / 0.6);
  let t = Math.max(0, el - INTRO_TITLE), i = 0; while (i < S.length - 1 && t > S[i].d) { t -= S[i].d; i++; }
  if (el - INTRO_TITLE > total + INTRO_BLEND) { introEnd(); return null; }
  const sh = S[i], u = Math.min(1, t / sh.d);
  if (i !== I.shot) { I.shot = i; const c = $('introCap'); if (sh.cap) { c.querySelector('b').textContent = sh.cap[0]; c.querySelector('small').textContent = sh.cap[1]; } if (sh.hero) $('intro').classList.add('out'); }
  $('introCap').style.opacity = sh.cap ? Math.min(1, u * 5, (1 - u) * 5) : 0;
  // quick dip to black on each cut
  let fade = 0; for (let k = 1, acc = S[0].d; k < S.length; acc += S[k].d, k++) fade = Math.max(fade, 1 - Math.abs(el - INTRO_TITLE - acc) / 0.2);
  $('introFade').style.opacity = Math.max(0, fade);
  let p = sh.pos(u), l = sh.look(u), fog = sh.fog(u);
  const over = el - INTRO_TITLE - total;
  if (over > 0) { const b = ease(over / INTRO_BLEND); p = lerp3(p, game.p, b); l = lerp3(l, game.l, b); fog = [fog[0] + (game.fog[0] - fog[0]) * b, fog[1] + (game.fog[1] - fog[1]) * b]; }
  return { p, l, fog };
}
function quitGame() {
  introEnd();
  clearSession(); $('netOv').classList.add('hidden');
  G.running = false; clearInterval(G.simTimer); G.sim = null; joyEnd(); cancelAim();
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
  if (L.mode !== 'solo') leaveLobby(); else { L.mode = null; show('menu'); renderMenu(); }
}
function send(c) {
  if (!G.running || G.intro) return;
  if (G.mode === 'client') { if (L.ch) L.ch.send({ type: 'broadcast', event: 'in', payload: { pid: myPid, c } }); }
  else if (G.sim) G.sim.input(myPid, c);
}
function applySnap(s) {
  if (G.cur) { G.prev = G.cur; G.prevMap = new Map(); for (const e of G.prev.e) G.prevMap.set(e[0], e); for (const p of G.prev.p) G.prevMap.set('p' + p[0], p); }
  G.cur = s; const now = performance.now(); G.lastNet = now; if (!$('netOv').classList.contains('hidden')) { $('netOv').classList.add('hidden'); if (G.reconnecting) toast('Reconnected', 'info'); G.reconnecting = false; } if (G.recvT) G.interval = G.interval * 0.8 + Math.min(300, now - G.recvT) * 0.2; G.recvT = now;
  for (const h of s.h) { if (h.st) G.stats[h.pid] = h.st; if (h.pid === myPid) { G.me = h; G.myHeroId = h.id; if (h.ac) { G.atkReadyAt = now + h.ac[0] * 1000; G.atkPeriod = h.ac[1]; } } }
  for (const f of s.fx) spawnFx(f);
  for (const m of s.m) addMsg(m[0], m[1]);
  if (s.over && !G.ended) { G.ended = true; setTimeout(() => showEnd(s), 2500); }
}
function addMsg(text, c) {
  if (c[0] === 'p') { if (c.slice(1) !== myPid || /cooldown|Not enough (Mana|Energy|Rage|Resolve)|Stunned|No target|not learned/i.test(text)) return; if (/^(Picked up|Forged)/.test(text)) { hint(text); return; } hint(text); return; }
  const el = document.createElement('div'); el.className = 'msg c-' + c; el.textContent = text; $('feed').prepend(el);
  while ($('feed').children.length > 3) $('feed').lastChild.remove();
  setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 800); }, 4500);
}

// ============================ 3D WORLD ============================
const MOBILE = window.matchMedia('(pointer:coarse)').matches;
const matCache = new Map();
function mat(col, o) {
  o = o || {}; const k = col + '|' + (o.e || 0) + '|' + (o.m || 0) + '|' + (o.r || 0) + '|' + (o.t || 0);
  if (!matCache.has(k)) { const m = new THREE.MeshStandardMaterial({ color: col, emissive: o.e || 0, emissiveIntensity: o.ei || 1, metalness: o.m || 0, roughness: o.r || 0.82, flatShading: true, transparent: !!o.t, opacity: o.t || 1 }); m.userData.cached = 1; fogPatch(m); matCache.set(k, m); }
  return matCache.get(k);
}
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6), cone: new THREE.ConeGeometry(0.5, 1, 10), cone4: new THREE.ConeGeometry(0.5, 1, 4), cone6: new THREE.ConeGeometry(0.5, 1, 6),
  sph: new THREE.SphereGeometry(0.5, 14, 10), hemi: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), oct: new THREE.OctahedronGeometry(0.5), ico: new THREE.IcosahedronGeometry(0.5, 0), ico1: new THREE.IcosahedronGeometry(0.5, 1),
  torus: new THREE.TorusGeometry(0.5, 0.07, 8, 24), torusHalf: new THREE.TorusGeometry(0.5, 0.05, 6, 16, Math.PI), ring: new THREE.RingGeometry(0.86, 1, 48), disc: new THREE.CircleGeometry(1, 48),
  frus: new THREE.CylinderGeometry(0.38, 0.5, 1, 10), plane: new THREE.PlaneGeometry(1, 1)
};
function part(g, col, sx, sy, sz, x, y, z, o) { const m = new THREE.Mesh(geo[g], mat(col, o)); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; return m; }
function grp(...parts) { const g = new THREE.Group(); parts.forEach(p => p && g.add(p)); return g; }
const WX = DW.MAP.W + 18, WZ = DW.MAP.H + 18;
// Region theme per terrain cell (0 Blightwood/undead, 1 Warpath/orc, 2 Tidemarsh/naga) + lane distance cache
let THEME = null, LDG = null;
function initThemeGrid() {
  if (THEME) return; const T = DW.TER; THEME = new Uint8Array(T.cols * T.rows); LDG = new Float32Array(T.cols * T.rows);
  for (let r = 0; r < T.rows; r++) for (let c = 0; c < T.cols; c++) { const x = T.ox + (c + 0.5) * T.cs, z = T.oz + (r + 0.5) * T.cs, a = DW.laneDistK('L', x, z), b = DW.laneDistK('M', x, z), d = DW.laneDistK('R', x, z), i = r * T.cols + c; THEME[i] = a <= b && a <= d ? 0 : d <= b ? 2 : 1; LDG[i] = Math.min(a, b, d); }
}
const cellIx = (x, z) => { const T = DW.TER; const c = Math.max(0, Math.min(T.cols - 1, Math.floor((x - T.ox) / T.cs))), r = Math.max(0, Math.min(T.rows - 1, Math.floor((z - T.oz) / T.cs))); return r * T.cols + c; };
const themeAt = (x, z) => THEME[cellIx(x, z)];
const ldAt = (x, z) => LDG[cellIx(x, z)];
const TH = ['L', 'M', 'R'];

function init3D() {
  renderer = new THREE.WebGLRenderer({ antialias: !MOBILE || window.devicePixelRatio < 2.5, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.75 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('view').appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x9cc7e8, 40, 95); scene.background = new THREE.Color(0x9cc7e8);
  camera = new THREE.PerspectiveCamera(40, 1, 1, 260);
  hemi = new THREE.HemisphereLight(0xe8f4ff, 0x4a5a2a, 0.55); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d8, 1.05); sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
  moonFill = new THREE.AmbientLight(0x404a70, 0.18); scene.add(moonFill);
  heroLight = new THREE.PointLight(0xffb060, 0, 22, 1.6); heroLight.position.y = 5; scene.add(heroLight);
  overlay = $('overlay'); octx = overlay.getContext('2d');
  mini = $('minimap'); mctx = mini.getContext('2d');
  raycaster = new THREE.Raycaster(); groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const _t0 = performance.now(); fogInit(); particlesInit(); buildTerrain(); const _t1 = performance.now(); buildDecor(); const _t2 = performance.now(); buildMinimapBg(); window.__perf = [Math.round(_t1 - _t0), Math.round(_t2 - _t1), Math.round(performance.now() - _t2)];
  const ov = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  rangeRing = new THREE.Mesh(geo.ring, ov(0x9fe0ff, 0.55)); rangeRing.rotation.x = -Math.PI / 2; rangeRing.position.y = 0.12; rangeRing.visible = false; scene.add(rangeRing);
  aimArrow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), ov(0x9fe0ff, 0.38)); aimArrow.rotation.x = -Math.PI / 2; aimArrow.position.y = 0.14; aimArrow.visible = false; scene.add(aimArrow);
  aimCircle = new THREE.Mesh(geo.disc, ov(0xffb35a, 0.35)); aimCircle.rotation.x = -Math.PI / 2; aimCircle.position.y = 0.15; aimCircle.visible = false; scene.add(aimCircle);
  tgtRing = new THREE.Mesh(geo.ring, ov(0xff4a3a, 0.9)); tgtRing.rotation.x = -Math.PI / 2; tgtRing.position.y = 0.1; tgtRing.visible = false; scene.add(tgtRing);
  myRing = new THREE.Mesh(geo.ring, ov(0x6aff8a, 0.85)); myRing.rotation.x = -Math.PI / 2; myRing.scale.setScalar(1.6); myRing.position.y = 0.08; scene.add(myRing);
  for (let i = 0; i < 24; i++) { const g = new THREE.Group(); const r = new THREE.Mesh(geo.ring, ov(0xff4a3a, 0.85)); const d = new THREE.Mesh(geo.disc, ov(0xff4a3a, 0.22)); r.rotation.x = d.rotation.x = -Math.PI / 2; d.position.y = 0.01; g.add(r, d); g.position.y = 0.16; g.visible = false; scene.add(g); G.zoneMeshes.push(g); }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200)); if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  bindInput(); requestAnimationFrame(frame);
}
function resize() {
  if (!renderer) return; const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h;
  camera.fov = w / h < 1.3 ? 58 : w / h < 1.7 ? 46 : 40; camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio, 2); overlay.width = w * dpr; overlay.height = h * dpr; overlay.style.width = w + 'px'; overlay.style.height = h + 'px'; octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const portrait = h > w && MOBILE; $('rotateHint').classList.toggle('hidden', !portrait || !G.running);
  document.documentElement.style.setProperty('--ui', Math.max(0.72, Math.min(1.15, Math.min(h / 412, w / 900))).toFixed(3));
}
function hash2(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
function srand(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
// ---------- painted ground ----------
function buildTerrain() {
  const T = DW.TER, M = DW.MAP;
  const S = renderer.capabilities.maxTextureSize >= 8192 || !MOBILE ? 4096 : 2048, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  const px = x => (x + WX) / (2 * WX) * S, pz = z => (z + WZ) / (2 * WZ) * S, pu = u => u / (2 * WX) * S, pv = u => u / (2 * WZ) * S, R = srand(7);
  initThemeGrid();
  // base color per region, blended smoothly between regions
  const BASE = ['#33283a', '#3c6424', '#3a6656'], bc = document.createElement('canvas'); bc.width = T.cols; bc.height = T.rows; const bx = bc.getContext('2d');
  for (let r = 0; r < T.rows; r++) for (let q = 0; q < T.cols; q++) { bx.fillStyle = BASE[THEME[r * T.cols + q]]; bx.fillRect(q, r, 1, 1); }
  const mc2 = document.createElement('canvas'); mc2.width = T.cols * 3; mc2.height = T.rows * 3; const m2 = mc2.getContext('2d'); m2.imageSmoothingEnabled = true; m2.filter = 'blur(4px)'; m2.drawImage(bc, 0, 0, mc2.width, mc2.height); m2.filter = 'none';
  c.imageSmoothingEnabled = true; c.drawImage(mc2, px(T.ox), pz(T.oz), pu(T.cols * T.cs), pv(T.rows * T.cs));
  const PAL = [['#2a1e2e', '#3e2e40', '#24182a', '#4a3a48', '#30283a', '#3a3036'], ['#33571e', '#4a7a2c', '#3e6a26', '#527e30', '#2e501c', '#5a6a28'], ['#36624f', '#4a7a66', '#2e5a50', '#5a8a70', '#5e7e62', '#6a8466']];
  const PAL2 = [['#3a2a3e', '#22162a', '#4a3c44', '#2e2832'], ['#4e8434', '#2e541a', '#5a8a36', '#28501a', '#6a7a32'], ['#4a8a70', '#2a5a4e', '#5a9078', '#3e7062']];
  const thAtPx = (X, Y) => themeAt(X / S * 2 * WX - WX, Y / S * 2 * WZ - WZ);
  const blot = (n, pals, rmin, rmax, a) => { for (let i = 0; i < n; i++) { const X = R() * S, Y = R() * S, cols = pals[thAtPx(X, Y)]; c.globalAlpha = a; c.fillStyle = cols[Math.floor(R() * cols.length)]; c.beginPath(); c.ellipse(X, Y, pu(rmin + R() * (rmax - rmin)), pv(rmin + R() * (rmax - rmin)), R() * 3, 0, 7); c.fill(); } c.globalAlpha = 1; };
  blot(1600, PAL, 3, 16, 0.38); blot(3600, PAL2, 0.6, 2.5, 0.35);
  // forest floor under blocked forest
  const FLOOR = ['#170f1c', '#22361a', '#1a3a30'];
  for (let r = 0; r < T.rows; r++) for (let q = 0; q < T.cols; q++) { const i = r * T.cols + q, b = T.blk[i]; if (b !== 1) continue; const x = T.ox + (q + 0.5) * T.cs, z = T.oz + (r + 0.5) * T.cs; c.fillStyle = FLOOR[THEME[i]]; c.globalAlpha = 0.55; c.beginPath(); c.arc(px(x), pz(z), pu(T.cs * 1.15), 0, 7); c.fill(); }
  c.globalAlpha = 1;
  // Scourge blight (undead region): black-violet creep with glowing green veins
  for (let i = 0; i < 2600; i++) { const x = (R() * 2 - 1) * WX, z = (R() * 2 - 1) * WZ; if (themeAt(x, z) !== 0) continue; c.globalAlpha = 0.55; c.fillStyle = R() < 0.5 ? '#140a1a' : '#26142e'; c.beginPath(); c.ellipse(px(x), pz(z), pu(1.5 + R() * 4), pv(1.2 + R() * 3), R() * 3, 0, 7); c.fill(); }
  c.lineCap = 'round';
  for (let i = 0; i < 1400; i++) { let x = (R() * 2 - 1) * WX, z = (R() * 2 - 1) * WZ; if (themeAt(x, z) !== 0) continue; c.strokeStyle = R() < 0.7 ? '#5aff7a' : '#b06bff'; c.globalAlpha = 0.18 + R() * 0.22; c.lineWidth = Math.max(1, pu(0.12 + R() * 0.15)); c.beginPath(); c.moveTo(px(x), pz(z)); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 3; z += (R() - 0.5) * 3; c.lineTo(px(x), pz(z)); } c.stroke(); }
  c.globalAlpha = 1;
  // Tidemarsh shallows (naga region): teal pools with pale rims and lily pads
  for (let i = 0; i < 900; i++) { const x = (R() * 2 - 1) * WX, z = (R() * 2 - 1) * WZ; if (themeAt(x, z) !== 2 || DW.blocked(x, z)) continue; const ld = ldAt(x, z); if (ld < 7 || ld > 40 && R() < 0.7) continue; const rx = 1.5 + R() * 4, rz = 1.2 + R() * 3, a = R() * 3;
    c.globalAlpha = 0.85; c.fillStyle = '#9ab89a'; c.beginPath(); c.ellipse(px(x), pz(z), pu(rx + 0.5), pv(rz + 0.5), a, 0, 7); c.fill(); c.fillStyle = '#2a6a76'; c.beginPath(); c.ellipse(px(x), pz(z), pu(rx), pv(rz), a, 0, 7); c.fill(); c.fillStyle = '#3a8a90'; c.beginPath(); c.ellipse(px(x - rx * 0.2), pz(z - rz * 0.2), pu(rx * 0.55), pv(rz * 0.5), a, 0, 7); c.fill();
    if (R() < 0.5) { c.fillStyle = '#5aa04a'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(px(x + (R() - 0.5) * rx), pz(z + (R() - 0.5) * rz), pu(0.3 + R() * 0.25), 0.4, 6.2); c.fill(); } } }
  c.globalAlpha = 1;
  // river
  const riverPath = (w, col) => { c.strokeStyle = col; c.lineWidth = pv(w); c.lineCap = 'round'; c.beginPath(); for (let x = -WX; x <= WX; x += 2) { const z = DW.RIVER(x); x === -WX ? c.moveTo(px(x), pz(z)) : c.lineTo(px(x), pz(z)); } c.stroke(); };
  riverPath(16, '#8a7a52'); riverPath(13, '#6a6a4a'); riverPath(10, '#3a5a5a');
  // jungle trails (cleared but not lane): lighter worn grass
  for (let r = 0; r < T.rows; r += 1) for (let q = 0; q < T.cols; q += 1) { const i = r * T.cols + q; if (T.blk[i]) continue; const x = T.ox + (q + 0.5) * T.cs, z = T.oz + (r + 0.5) * T.cs; const ld = LDG[i]; if (ld < 12) continue; let nb = 0; for (const o of [-1, 1, -T.cols, T.cols]) if (T.blk[i + o] === 1) nb++; if (nb >= 1) { c.fillStyle = 'rgba(70,58,34,.18)'; c.fillRect(px(x - 1), pz(z - 1), pu(2), pv(2)); } }
  // lanes
  for (const k in DW.LANES) {
    const P = DW.LANES[k], line = (w, col, j) => { c.strokeStyle = col; c.lineWidth = pu(w); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); P.forEach((p, i) => { const x = px(p[0] + (j ? (R() - 0.5) * j : 0)), z = pz(p[1] + (j ? (R() - 0.5) * j : 0)); i ? c.lineTo(x, z) : c.moveTo(x, z); }); c.stroke(); };
    if (k === 'L') { line(14, '#1a1020', 0); line(12, '#2e2430', 0); line(10.5, '#4a3e44', 0); line(8, '#5a4e50', 1); line(5, '#6a5c5c', 1.5); }
    else if (k === 'M') { line(13.5, '#4a5a24', 0); line(12, '#5a4a2c', 0); line(10.5, '#7a5e3c', 0); line(8, '#8a6c46', 1); line(5, '#967850', 1.5); }
    else { line(15, '#2a6a76', 0); line(12.5, '#8a9a88', 0); line(10.5, '#4e5e62', 0); }
  }
  // lane surface detail: bones & ash (undead), dirt & pebbles (orc), fitted causeway stones (naga)
  for (let i = 0; i < 60000; i++) { const x = (R() * 2 - 1) * WX, z = (R() * 2 - 1) * WZ, ld = ldAt(x, z); if (ld > 6) continue; const th = themeAt(x, z);
    if (th === 2) { if (ld > 5.2) continue; c.globalAlpha = 0.9; c.fillStyle = ['#5a666a', '#6a7676', '#4e5a5e', '#727c7a'][i & 3]; c.strokeStyle = '#2e3a3e'; c.lineWidth = Math.max(1, pu(0.12)); c.beginPath(); c.ellipse(px(x), pz(z), pu(0.6 + R() * 0.5), pv(0.5 + R() * 0.4), R() * 3, 0, 7); c.fill(); c.stroke(); }
    else if (th === 0) { c.globalAlpha = 0.6; c.fillStyle = R() < 0.25 ? '#d8d0c0' : R() < 0.5 ? '#2a2026' : '#6a5a5a'; c.beginPath(); c.ellipse(px(x), pz(z), pu(0.12 + R() * 0.25), pv(0.08 + R() * 0.12), R() * 3, 0, 7); c.fill(); }
    else { c.globalAlpha = 0.45; c.fillStyle = R() < 0.5 ? '#6a5236' : '#b09068'; c.beginPath(); c.ellipse(px(x), pz(z), pu(0.12 + R() * 0.2), pv(0.1 + R() * 0.16), R() * 3, 0, 7); c.fill(); } }
  c.globalAlpha = 1;
  const plaza = (x, z, r, col, trim) => { c.fillStyle = '#5a5650'; c.beginPath(); c.ellipse(px(x), pz(z), pu(r + 0.8), pv(r + 0.8), 0, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(px(x), pz(z), pu(r), pv(r), 0, 0, 7); c.fill();
    c.save(); c.beginPath(); c.ellipse(px(x), pz(z), pu(r), pv(r), 0, 0, 7); c.clip(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = Math.max(1, pu(0.12));
    for (let rr = 2; rr < r; rr += 2.2) { c.beginPath(); c.ellipse(px(x), pz(z), pu(rr), pv(rr), 0, 0, 7); c.stroke(); }
    for (let a = 0; a < 6.28; a += 0.2) { c.beginPath(); c.moveTo(px(x), pz(z)); c.lineTo(px(x + Math.cos(a) * r), pz(z + Math.sin(a) * r)); c.stroke(); } c.restore();
    if (trim) { c.strokeStyle = trim; c.lineWidth = pu(0.8); c.beginPath(); c.ellipse(px(x), pz(z), pu(r - 1.4), pv(r - 1.4), 0, 0, 7); c.stroke(); } };
  plaza(0, M.fountain.z + 4, 34, '#8c877c', '#3a6ab0'); plaza(0, -M.fountain.z - 4, 34, '#7a7470', '#a03040');
  M.towns.forEach(t => plaza(t.x, t.z, 12, ['#5e5458', '#8a8274', '#7a8a88'][themeAt(t.x, t.z)]));
  M.camps.forEach(cp => { c.fillStyle = 'rgba(96,74,44,.75)'; c.beginPath(); c.ellipse(px(cp.x), pz(cp.z), pu(8), pv(8), 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(40,30,20,.6)'; c.lineWidth = pu(0.5); c.stroke(); });
  M.bosses.forEach(b => { c.fillStyle = 'rgba(70,60,50,.7)'; c.beginPath(); c.ellipse(px(b.x), pz(b.z), pu(12), pv(12), 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(120,30,20,.4)'; c.lineWidth = pu(0.4); for (let a = 0; a < 6.28; a += 1.05) { c.beginPath(); c.moveTo(px(b.x), pz(b.z)); c.lineTo(px(b.x + Math.cos(a) * 11), pz(b.z + Math.sin(a) * 11)); c.stroke(); } });
  T.ruins.forEach(r => r.pts.forEach(p => { c.fillStyle = 'rgba(110,104,96,.5)'; c.beginPath(); c.ellipse(px(p[0]), pz(p[1]), pu(2.2), pv(2.2), 0, 0, 7); c.fill(); }));
  c.lineWidth = Math.max(1, pu(0.08)); c.lineCap = 'round';
  const GRASS = [['#5a4a4e', '#3a2e36', '#6a5a52', '#4a3a44'], ['#5a9038', '#2a5018', '#6aa040', '#3a6a22'], ['#4a8a6a', '#2a6a5a', '#5a9a7a', '#7aa070']];
  for (let i = 0; i < (MOBILE ? 90000 : 200000); i++) { const x = R() * S, y = R() * S; const wx = x / S * 2 * WX - WX, wz = y / S * 2 * WZ - WZ; if (ldAt(wx, wz) < 6 || Math.abs(wz - DW.RIVER(wx)) < 7) continue; c.strokeStyle = GRASS[themeAt(wx, wz)][i & 3]; c.globalAlpha = 0.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * pu(0.35), y - pv(0.4 + R() * 0.4)); c.stroke(); }
  c.globalAlpha = 1;
  // map edge: the ground rises into cliffs there — paint it as dark layered rock rather than letting plazas/grass run up the slope
  { const H = M.H, Wm = M.W, RK = ['#3e3832', '#4a423a', '#36302c', '#524840', '#2e2a26'], R2 = srand(91);
    const band = (horiz, sgn) => {
      const a0 = (horiz ? H : Wm) - 9, a1 = (horiz ? WZ : WX);
      const g = horiz ? c.createLinearGradient(0, pz(sgn * a0), 0, pz(sgn * (a0 + 6))) : c.createLinearGradient(px(sgn * a0), 0, px(sgn * (a0 + 6)), 0);
      g.addColorStop(0, 'rgba(58,52,46,0)'); g.addColorStop(1, 'rgba(58,52,46,1)'); c.fillStyle = g;
      if (horiz) c.fillRect(0, Math.min(pz(sgn * a0), pz(sgn * a1)), S, Math.abs(pz(sgn * a1) - pz(sgn * a0))); else c.fillRect(Math.min(px(sgn * a0), px(sgn * a1)), 0, Math.abs(px(sgn * a1) - px(sgn * a0)), S);
      for (let d = a0 + 5; d < a1; d += 0.35 + R2() * 0.5) { // strata
        c.fillStyle = RK[Math.floor(R2() * RK.length)]; const w = 0.15 + R2() * 0.3;
        if (horiz) c.fillRect(0, pz(sgn * d) - pv(w) / 2, S, pv(w)); else c.fillRect(px(sgn * d) - pu(w) / 2, 0, pu(w), S);
      }
    };
    band(true, 1); band(true, -1); band(false, 1); band(false, -1); }
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const g = new THREE.PlaneGeometry(2 * WX, 2 * WZ, 200, 260); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), rd = Math.abs(z - DW.RIVER(x));
    let y = 0; const edge = Math.max(0, Math.max(Math.abs(x) - M.W + 6, Math.abs(z) - M.H + 6));
    if (DW.blocked(x, z) && edge <= 0) y += 0.25 + hash2(Math.round(x), Math.round(z)) * 0.35;
    y += edge * edge * 0.5; if (rd < 6) y -= (1 - rd / 6) * 1.1;
    pos.setY(i, y);
  }
  g.computeVertexNormals();
  const gm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }); fogPatch(gm);
  const ground = new THREE.Mesh(g, gm); ground.receiveShadow = true; scene.add(ground);
  // water
  const wv = [], wi = [];
  for (let x = -WX, i = 0; x <= WX; x += 3, i++) { const z = DW.RIVER(x); wv.push(x, -0.35, z - 5.5, x, -0.35, z + 5.5); if (i) { const a = (i - 1) * 2; wi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3)); wg.setIndex(wi); wg.computeVertexNormals();
  const wcv = document.createElement('canvas'); wcv.width = wcv.height = 128; const wc = wcv.getContext('2d'); wc.fillStyle = '#2a7aa0'; wc.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) { wc.strokeStyle = 'rgba(200,240,255,' + (0.15 + R() * 0.25) + ')'; wc.lineWidth = 1.5; wc.beginPath(); const x = R() * 128, y = R() * 128; wc.moveTo(x, y); wc.quadraticCurveTo(x + 8, y - 3, x + 16, y); wc.stroke(); }
  const wt = new THREE.CanvasTexture(wcv); wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  const uvs = []; for (let k = 0; k < wv.length / 3; k++) uvs.push(wv[k * 3] / 12, wv[k * 3 + 2] / 12); wg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  waterMat = new THREE.MeshStandardMaterial({ color: 0x5ab0d8, map: wt, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.1 }); fogPatch(waterMat);
  const water = new THREE.Mesh(wg, waterMat); water.receiveShadow = true; scene.add(water);
  // bridges where lanes cross the river
  for (const k in DW.LANES) {
    const P = DW.LANES[k]; let bx = null, bz = 0;
    for (let i = 0; i < P.length - 1 && bx === null; i++) for (let t = 0; t <= 1; t += 0.01) { const x = P[i][0] + (P[i + 1][0] - P[i][0]) * t, z = P[i][1] + (P[i + 1][1] - P[i][1]) * t; if (Math.abs(z - DW.RIVER(x)) < 0.6) { bx = x; bz = DW.RIVER(x); break; } }
    if (bx === null) continue;
    const br = new THREE.Group();
    for (let i = -7; i <= 7; i++) br.add(part('box', i % 2 ? 0x8a6038 : 0x7a5430, 10, 0.35, 0.95, 0, 0.15, i));
    for (const sx of [-5.1, 5.1]) { br.add(part('box', 0x5a3a20, 0.3, 0.9, 15, sx, 0.7, 0)); for (let i = -7; i <= 7; i += 3.5) br.add(part('box', 0x4a3018, 0.4, 1.4, 0.4, sx, 0.5, i)); }
    br.position.set(bx, 0, bz); scene.add(br);
  }
}
// ---------- decor ----------
const CHUNK = 64; const chunks = [];
function inst(geomKey, color, list, opts) {
  opts = opts || {}; const by = new Map();
  for (const t of list) { const k = Math.floor(t[0] / CHUNK) + ',' + Math.floor(t[2] / CHUNK); if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  let mt = opts.mat; if (!mt) { mt = mat(color, opts).clone(); mt.userData = {}; } fogPatch(mt);
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(0, 0, 0, opts.order || 'XYZ');
  if (!list.length) return;
  for (const [k, arr] of by) {
    const m = new THREE.InstancedMesh(geo[geomKey], mt, arr.length);
    arr.forEach((t, i) => { e.set(t[6] || 0, t[4] || 0, t[7] || 0, opts.order || 'XYZ'); q.setFromEuler(e); M4.compose(p.set(t[0], t[1], t[2]), q, s.set(t[3], t[5] !== undefined ? t[5] : t[3], t[8] !== undefined ? t[8] : t[3])); m.setMatrixAt(i, M4); if (opts.cols) m.setColorAt(i, new THREE.Color(opts.cols[(i + Math.floor(t[0])) % opts.cols.length])); });
    m.castShadow = opts.shadow !== false; m.receiveShadow = !!opts.recv; m.frustumCulled = false; scene.add(m);
    const [cx, cz] = k.split(',').map(Number); chunks.push({ m, x: (cx + 0.5) * CHUNK, z: (cz + 0.5) * CHUNK });
  }
}
function cullChunks(x, z, far) { for (const c of chunks) c.m.visible = Math.abs(c.x - x) < far + CHUNK / 2 && c.z - z < far * 0.55 + CHUNK / 2 && z - c.z < far * 1.15 + CHUNK / 2; }
function buildDecor() {
  const R = srand(11), M = DW.MAP, T = DW.TER;
  initThemeGrid();
  const pines = [], broad = [], dead = [], palms = [], mangr = [];
  const addTree = (x, y, z, s, rot, kind) => { const th = themeAt(x, z); if (th === 0) dead.push([x, y, z, s, rot]); else if (th === 2) (kind ? mangr : palms).push([x, y, z, s, rot]); else (kind ? broad : pines).push([x, y, z, s, rot]); };
  T.trees.forEach(t => addTree(t[0], 0.2, t[1], t[2], t[4] * 6, t[3]));
  for (let i = 0; i < 2600; i++) { const x = (R() * 2 - 1) * WX, z = (R() * 2 - 1) * WZ; if (Math.abs(x) < M.W - 2 && Math.abs(z) < M.H - 2) continue; const y = Math.max(0, Math.max(Math.abs(x) - M.W + 6, Math.abs(z) - M.H + 6)) ** 2 * 0.5; addTree(x, y, z, 1 + R() * 0.6, R() * 6, R() < 0.4 ? 1 : 0); }
  // Warpath (orc): green pines + broadleaf
  inst('cyl6', 0x5a3a22, pines.map(t => [t[0], t[1] + 0.9 * t[3], t[2], 0.45 * t[3], t[4], 1.8 * t[3]]));
  inst('cone6', 0x2a5a2a, pines.map(t => [t[0], t[1] + 2.7 * t[3], t[2], 3.6 * t[3], t[4], 3 * t[3]]), { cols: [0x2a5a2a, 0x2f6a30, 0x24502a, 0x346e2e] });
  inst('cone6', 0x346e30, pines.map(t => [t[0], t[1] + 4.3 * t[3], t[2], 2.8 * t[3], t[4] + 0.5, 2.6 * t[3]]), { cols: [0x346e30, 0x3a7a34, 0x2c602c] });
  inst('cone6', 0x3c8038, pines.map(t => [t[0], t[1] + 5.7 * t[3], t[2], 1.8 * t[3], t[4] + 1, 2.1 * t[3]]), { cols: [0x3c8038, 0x44883a] });
  inst('cyl6', 0x6a4428, broad.map(t => [t[0], t[1] + 1.2 * t[3], t[2], 0.55 * t[3], t[4], 2.4 * t[3]]));
  inst('ico1', 0x4a8a34, broad.map(t => [t[0], t[1] + 3.4 * t[3], t[2], 3.8 * t[3], t[4], 3 * t[3]]), { cols: [0x4a8a34, 0x5a9a3a, 0x3e7a2e, 0x6a9a3a, 0x7a8a2a] });
  inst('ico1', 0x5a9a3a, broad.map(t => [t[0] + 0.9 * t[3], t[1] + 4.4 * t[3], t[2] - 0.4 * t[3], 2.3 * t[3], t[4], 1.9 * t[3]]), { cols: [0x5a9a3a, 0x6aaa44, 0x4a8a34] });
  // Blightwood (undead): dead, leafless trees with crooked branches
  const branches = [];
  dead.forEach((t, i) => { const s = t[3] * 1.15; for (let k = 0; k < 4; k++) { const a = t[4] + k * 1.7 + (i % 3) * 0.4, tilt = 0.7 + ((i + k) % 3) * 0.22, len = (1.4 + ((i * 7 + k) % 4) * 0.35) * s, h = (2.4 + k * 0.75) * s; branches.push([t[0] - Math.cos(a) * Math.sin(tilt) * len / 2, t[1] + h + Math.cos(tilt) * len / 2, t[2] + Math.sin(a) * Math.sin(tilt) * len / 2, 0.13 * s, a, len, 0, tilt]); } });
  inst('cyl6', 0x3e3438, dead.map(t => [t[0], t[1] + 2.2 * t[3] * 1.15, t[2], 0.42 * t[3] * 1.15, t[4], 4.6 * t[3] * 1.15, 0.06, 0.05]), { cols: [0x3e3438, 0x4a4044, 0x332a2e, 0x52464a] });
  inst('cyl6', 0x3a3034, branches, { cols: [0x3a3034, 0x4a4044, 0x2e262a] });
  // Tidemarsh (naga): leaning palms + mangroves
  const fronds = [];
  palms.forEach((t, i) => { const s = t[3], tilt = 0.18, h = 5.4 * s, tx = t[0] - Math.cos(t[4]) * Math.sin(tilt) * h, tz = t[2] + Math.sin(t[4]) * Math.sin(tilt) * h, ty = t[1] + Math.cos(tilt) * h; t.top = [tx, ty, tz];
    for (let k = 0; k < 7; k++) { const a = t[4] + k * 0.9, d = 0.5, L = 3.2 * s; fronds.push({ x: tx + Math.sin(a) * Math.cos(d) * L / 2, y: ty - Math.sin(d) * L / 2 + 0.2, z: tz + Math.cos(a) * Math.cos(d) * L / 2, a, d, L }); } });
  inst('cyl6', 0x8a6a48, palms.map(t => [t[0] - Math.cos(t[4]) * Math.sin(0.18) * 2.7 * t[3], t[1] + Math.cos(0.18) * 2.7 * t[3], t[2] + Math.sin(t[4]) * Math.sin(0.18) * 2.7 * t[3], 0.42 * t[3], t[4], 5.4 * t[3], 0, 0.18]), { cols: [0x8a6a48, 0x7a5c3e, 0x9a7a52] });
  inst('box', 0x3a8a4a, fronds.map(f => [f.x, f.y, f.z, 0.9, f.a, 0.07, f.d, 0, f.L]), { cols: [0x3a8a4a, 0x2e7a40, 0x4a9a52, 0x3a7a3a], order: 'YXZ' });
  inst('ico1', 0x3e7a5e, palms.map(t => [t.top[0], t.top[1], t.top[2], 0.7 * t[3]]), { cols: [0x5a3a22] });
  inst('cyl6', 0x5a4a3a, mangr.map(t => [t[0], t[1] + 1.1 * t[3], t[2], 0.5 * t[3], t[4], 2.2 * t[3]]));
  const roots = []; mangr.forEach(t => { for (let k = 0; k < 4; k++) { const a = t[4] + k * 1.57; roots.push([t[0] - Math.cos(a) * 0.7 * t[3], t[1] + 0.5 * t[3], t[2] + Math.sin(a) * 0.7 * t[3], 0.14 * t[3], a, 1.6 * t[3], 0, 0.7]); } });
  inst('cyl6', 0x4a3a2e, roots);
  inst('ico1', 0x2e6a52, mangr.map(t => [t[0], t[1] + 3.2 * t[3], t[2], 4.4 * t[3], t[4], 2.4 * t[3]]), { cols: [0x2e6a52, 0x3a7a5e, 0x2a5e4e, 0x4a8060] });
  // ruins + rocks, tinted per region
  const RCOL = [[0x4a4048, 0x3a3238, 0x544a52], [0x8a847a, 0x7a746a, 0x948e82, 0x6e6a60], [0x6a7a80, 0x5a6a70, 0x7a8a8e]];
  const blocks = [[], [], []], rubble = [[], [], []], rocks = [[], [], []];
  T.ruins.forEach(r => r.pts.forEach((p, i) => { const th = themeAt(p[0], p[1]), h = 1.4 + p[2] * 2.2; blocks[th].push([p[0], h / 2, p[1], 1.6, -r.a, h, 0, 0, 1.3]); if (i % 2) blocks[th].push([p[0], h + 0.3, p[1], 1.2, -r.a + 0.2, 0.6, 0, 0, 1.1]); for (let k = 0; k < 2; k++) rubble[th].push([p[0] + (R() - 0.5) * 3.5, 0.15, p[1] + (R() - 0.5) * 3.5, 0.3 + R() * 0.5, R() * 6, 0.25 + R() * 0.3]); }));
  T.rocks.forEach(r => rocks[themeAt(r[0], r[1])].push([r[0], r[2] * 0.5, r[1], r[2] * 2.1, r[0] * 3, r[2] * 1.6, 0.2, 0.1]));
  for (let th = 0; th < 3; th++) { inst('box', RCOL[th][0], blocks[th], { cols: RCOL[th], recv: true }); inst('ico', RCOL[th][1], rubble[th], { cols: RCOL[th] }); inst('ico', RCOL[th][0], rocks[th], { cols: RCOL[th], recv: true }); }
  // ground cover per region
  const gc = { bushL: [], tuftL: [], bones: [], crystals: [], bush: [], tufts: [], flowers: [], mush: [], coral: [], reeds: [], shells: [] };
  for (let i = 0; i < 18000; i++) {
    const x = (R() * 2 - 1) * M.W, z = (R() * 2 - 1) * M.H; if (DW.blocked(x, z)) continue; const ld = ldAt(x, z);
    if (ld < 6.5 || Math.abs(z - DW.RIVER(x)) < 6) continue; if (Math.abs(z) > M.H - 34 && Math.abs(x) < 40) continue;
    const th = themeAt(x, z), nearForest = DW.blocked(x + 2.5, z) || DW.blocked(x - 2.5, z) || DW.blocked(x, z + 2.5) || DW.blocked(x, z - 2.5);
    if (th === 0) { if (nearForest && R() < 0.3) gc.bushL.push([x, 0.3, z, 0.8 + R() * 0.8, R() * 6, 0.55]); else if (R() < 0.45) gc.tuftL.push([x, 0, z, 0.2 + R() * 0.15, R() * 6, 0.5 + R() * 0.5]); if (R() < 0.05) gc.bones.push([x, 0.12, z, 0.12, R() * 6, 0.12, 0, Math.PI / 2, 0.9 + R()]); if (R() < 0.012) gc.crystals.push([x, 0.6, z, 0.5 + R() * 0.4, R() * 6, 1.3 + R()]); }
    else if (th === 2) { if (nearForest && R() < 0.3) gc.coral.push([x, 0.5, z, 0.35 + R() * 0.3, R() * 6, 1 + R() * 1.2, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5]); else if (R() < 0.55) gc.reeds.push([x, 0.6, z, 0.12, R() * 6, 1.2 + R() * 1.1, (R() - 0.5) * 0.3]); if (R() < 0.05) gc.shells.push([x, 0.05, z, 0.25 + R() * 0.15, R() * 6, 0.18]); }
    else { if (nearForest && R() < 0.35) gc.bush.push([x, 0.35, z, 0.9 + R() * 1, R() * 6, 0.7]); else if (R() < 0.5) gc.tufts.push([x, 0, z, 0.24 + R() * 0.2, R() * 6, 0.6 + R() * 0.7]); if (R() < 0.12) gc.flowers.push([x + R(), 0.15, z + R(), 0.16 + R() * 0.1, 0]); if (nearForest && R() < 0.04) gc.mush.push([x, 0.2, z, 0.35, 0, 0.3]); }
  }
  inst('ico1', 0x3a3236, gc.bushL, { cols: [0x3a3236, 0x2e2830, 0x46383e] });
  inst('cone4', 0x5a4a44, gc.tuftL, { cols: [0x5a4a44, 0x4a3e3e, 0x6a5a4e], shadow: false });
  inst('cyl6', 0xe0d8c8, gc.bones, { cols: [0xe0d8c8, 0xd0c8b4], shadow: false });
  inst('oct', 0x6aff8a, gc.crystals, { mat: new THREE.MeshStandardMaterial({ color: 0x5aff7a, emissive: 0x20c040, emissiveIntensity: 0.9, flatShading: true }), shadow: false });
  inst('ico1', 0x3a7a2c, gc.bush, { cols: [0x3a7a2c, 0x4a8a34, 0x2e6a26, 0x5a8a30] });
  inst('cone4', 0x5a9a3a, gc.tufts, { cols: [0x5a9a3a, 0x6aaa44, 0x4a8a30, 0x7ab84a], shadow: false });
  inst('sph', 0xffffff, gc.flowers, { cols: [0xffe04a, 0xff7ab0, 0xffffff, 0xb08aff, 0xff6a4a], shadow: false });
  inst('hemi', 0xd04a3a, gc.mush, { cols: [0xd04a3a, 0xe0c8a0], shadow: false });
  inst('cone6', 0xe07a6a, gc.coral, { cols: [0xe07a6a, 0xff9a7a, 0xb05ab0, 0xf0b05a, 0x5ac0c0] });
  inst('cone4', 0x5a9a7a, gc.reeds, { cols: [0x5a9a7a, 0x7aaa6a, 0x4a8a6a], shadow: false });
  inst('hemi', 0xf0d0c0, gc.shells, { cols: [0xf0d0c0, 0xffb0a0, 0xe0e0d0], shadow: false });
  // Tidemarsh ponds (walkable shallows)
  const ponds = [];
  for (let i = 0; i < 2500 && ponds.length < 90; i++) { const x = (R() * 2 - 1) * M.W, z = (R() * 2 - 1) * M.H; if (themeAt(x, z) !== 2 || DW.blocked(x, z)) continue; const ld = ldAt(x, z); if (ld < 9 || ld > 45) continue; if (M.towns.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 400) || M.camps.some(c2 => (c2.x - x) ** 2 + (c2.z - z) ** 2 < 150) || M.bosses.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < 260)) continue; const r = 2 + R() * 3.5; ponds.push([x, 0.07, z, r, 0, r, -Math.PI / 2]); }
  inst('disc', 0, ponds, { mat: waterMat, shadow: false });
  // lane-side props
  const props = { graves: [], obel: [], obelTop: [], spikes: [], banners: [], poles: [], skulls: [], stones: [], stoneCap: [] };
  for (const k in DW.LANES) { const P = DW.LANES[k];
    for (let i = 2; i < P.length - 2; i += 3) { const a = P[i], b = P[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
      for (const side of [-1, 1]) { if (R() < 0.45) continue; const off = 8 + R() * 2.5, x = a[0] + nx * off * side, z = a[1] + nz * off * side; if (DW.blocked(x, z) || Math.abs(z) > M.H - 34 || Math.abs(z - DW.RIVER(x)) < 8 || M.towns.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 330)) continue; const ang = Math.atan2(nx, nz);
        if (k === 'L') { if (R() < 0.8) props.graves.push([x, 0.6, z, 0.85, ang + (R() - 0.5) * 0.4, 1.3 + R() * 0.5, (R() - 0.5) * 0.25, (R() - 0.5) * 0.2, 0.25]); else { props.obel.push([x, 1.8, z, 0.9, R() * 3, 3.6]); props.obelTop.push([x, 3.9, z, 0.45, 0, 0.7]); } }
        else if (k === 'M') { if (R() < 0.6) { for (let q = -1; q <= 1; q++) props.spikes.push([x + Math.cos(ang) * q * 0.9, 0.9, z - Math.sin(ang) * q * 0.9, 0.22, ang, 2.2, 0.55 * side, 0]); } else { props.poles.push([x, 2.2, z, 0.15, 0, 4.4]); props.banners.push([x + 0.55, 3.2, z, 0.05, 0, 1.6, 0, 0, 1]); props.skulls.push([x, 4.6, z, 0.45, ang, 0.5]); } }
        else { props.stones.push([x, 1.6, z, 1, ang + (R() - 0.5), 3.2 + R() * 1.2, (R() - 0.5) * 0.2, (R() - 0.5) * 0.15, 0.8]); if (R() < 0.4) props.stoneCap.push([x, 0.25, z, 1.6, R() * 3, 0.3]); } } } }
  inst('box', 0x7a7480, props.graves, { cols: [0x7a7480, 0x6a6470, 0x5a5460, 0x8a8490], recv: true });
  inst('cone4', 0x2a2230, props.obel, { cols: [0x2a2230, 0x342a3a] });
  inst('oct', 0x5aff7a, props.obelTop, { mat: new THREE.MeshStandardMaterial({ color: 0x5aff7a, emissive: 0x30d050, emissiveIntensity: 1, flatShading: true }), shadow: false });
  inst('cone6', 0x7a5430, props.spikes, { cols: [0x7a5430, 0x6a4628, 0x8a6038] });
  inst('cyl6', 0x4a3018, props.poles);
  inst('box', 0xa02a20, props.banners, { cols: [0xa02a20, 0x8a1a14, 0x2a2a2a] });
  inst('sph', 0xe0d8c8, props.skulls);
  inst('box', 0x6a7a80, props.stones, { cols: [0x6a7a80, 0x5a6a72, 0x7a8a90, 0x4e6068], recv: true });
  inst('cyl6', 0x5a6a6e, props.stoneCap, { cols: [0x5a6a6e, 0x6a7a7e] });
  // lamps: ghost-fire (undead), braziers (orc), tide crystals (naga)
  const lamps = [[], [], []];
  for (const k in DW.LANES) { const P = DW.LANES[k], ti = TH.indexOf(k); for (let i = 1; i < P.length - 1; i += 6) { const a = P[i], b = P[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len, side = (Math.floor(i / 6) % 2 ? 1 : -1) * 6.8, x = a[0] + nx * side, z = a[1] + nz * side; if (Math.abs(z) > M.H - 30 || Math.abs(z - DW.RIVER(x)) < 8 || M.towns.some(tw => (tw.x - x) ** 2 + (tw.z - z) ** 2 < 300) || DW.blocked(x, z)) continue; lamps[ti].push([x, 0, z]); } }
  G.lampMats = [new THREE.MeshStandardMaterial({ color: 0x8affa0, emissive: 0x30ff60, emissiveIntensity: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xffd080, emissive: 0xffa040, emissiveIntensity: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x9ae8ff, emissive: 0x30b8ff, emissiveIntensity: 0.4 })];
  lampMat = G.lampMats[1];
  const all = [].concat(...lamps);
  inst('cyl6', 0x2a2a30, all.map(l => [l[0], 1.6, l[2], 0.18, 0, 3.2]));
  inst('box', 0x2a2a30, all.map(l => [l[0], 3.3, l[2], 0.6, 0, 0.15]));
  lamps.forEach((arr, ti) => inst('oct', 0, arr.map(l => [l[0], 3.7, l[2], 0.55, 0, 0.75]), { mat: G.lampMats[ti], shadow: false }));
  // base ring walls (gates are entities)
  const wallSeg = [[], []], crenel = [[], []];
  for (const b of DW.BASES) { const step = 2.3 / b.R;
    for (let th = -Math.PI; th < Math.PI; th += step) { if (b.gates.some(g => { let da = Math.abs(th - g.ang); if (da > Math.PI) da = 2 * Math.PI - da; return da * b.R < DW.GATE_HALF + 1.6; })) continue;
      const x = b.x + Math.cos(th) * b.R, z = b.z + Math.sin(th) * b.R; if (Math.abs(z) > M.H + 4 || Math.abs(x) > M.W + 4) continue; const yaw = -Math.atan2(Math.cos(th), -Math.sin(th));
      wallSeg[b.team].push([x, 2.2, z, 2.5, yaw, 4.4, 0, 0, 2.2]); crenel[b.team].push([x, 4.75, z, 1.1, yaw, 0.7, 0, 0, 2.3]); } }
  inst('box', 0x8a8478, wallSeg[0], { cols: [0x8a8478, 0x7e786e, 0x948e82], recv: true }); inst('box', 0x7a746a, crenel[0]);
  inst('box', 0x6a6460, wallSeg[1], { cols: [0x6a6460, 0x5e5854, 0x726c66], recv: true }); inst('box', 0x5a5450, crenel[1]);
  // lane war camps: tents, palisade and banner per camp
  const WC = [[0x2a1e2e, 0x5aff7a], [0x6a3a22, 0xa02a20], [0x2e5a5e, 0x5ac8ff]];
  DW.LANE_CAMPS.forEach((cd, ti) => ['L', 'M', 'R'].forEach((ln, li) => {
    const z = cd.z, x = DW.laneX(ln, z), g = new THREE.Group(); g.position.set(x, 0, z);
    for (const sd of [-1, 1]) { const tx = sd * (8.5 + ti), t = grp(part('cone4', WC[li][0], 3.2, 2.8, 3.2, 0, 1.4, 0), part('box', 0x1a1410, 0.8, 1.2, 0.05, 0, 0.6, 1.12)); t.children[0].rotation.y = Math.PI / 4; t.position.set(tx, 0, (ti - 1) * 2); t.rotation.y = sd * 0.4; if (!DW.blocked(x + tx, z)) g.add(t); }
    for (let k = -2; k <= 2; k++) { const sp = part('cone6', 0x5a3a20, 0.3, 2.2, 0.3, k * 1.2 + 9.5, 1, -6); sp.rotation.x = -0.4; if (!DW.blocked(x + 9.5, z - 6)) g.add(sp); const sp2 = sp.clone(); sp2.position.x = -sp2.position.x; if (!DW.blocked(x - 9.5, z - 6)) g.add(sp2); }
    const pole = grp(part('cyl6', 0x2a2020, 0.16, 6, 0.16, 0, 3, 0), part('box', WC[li][1], 0.06, 1.8, 1.2, 0, 4.8, 0.62, { e: WC[li][1], ei: 0.25 })); pole.position.set(6.8, 0, -4); g.add(pole);
    g.traverse(o => { if (o.material) fogPatch(o.material); }); scene.add(g);
  }));
  // jungle camps: campfire, tents, banner, stone ring
  const CAMPCOL = { wolves: 0x4a9a4a, trolls: 0x3a6ac0, ogres: 0xc03a2a };
  G.campFires = [];
  M.camps.forEach((cp, i) => {
    const g = new THREE.Group(); g.position.set(cp.x, 0, cp.z);
    for (let a = 0; a < 6.28; a += 0.5) g.add(part('ico', 0x7a7470, 0.9, 0.6, 0.9, Math.cos(a) * 7.6, 0.2, Math.sin(a) * 7.6));
    for (let a = 0; a < 6.28; a += 1.26) { const l = part('cyl6', 0x5a3a20, 0.22, 1.4, 0.22, Math.cos(a) * 0.5, 0.15, Math.sin(a) * 0.5); l.rotation.z = Math.PI / 2; l.rotation.y = a; g.add(l); }
    const cth = themeAt(cp.x, cp.z), FC = [[0x6aff8a, 0x20c040, '#6aff8a'], [0xff8a2a, 0xff5a00, '#ff8a2a'], [0x7ad8ff, 0x2a90ff, '#7ad8ff']][cth];
    const fire = part('cone', FC[0], 0.9, 1.4, 0.9, 0, 0.75, 0, { e: FC[1], ei: 1 }); fire.castShadow = false; fire.userData.col = FC[2]; g.add(fire); G.campFires.push(fire);
    const ang = Math.atan2(-cp.z, -cp.x);
    [[0.9, 1], [-0.9, 0.85]].forEach(([o, sc]) => { const t = grp(part('cone4', [0x3a2a3e, 0x8a7a5a, 0x4a7a7a][cth], 3 * sc, 2.6 * sc, 3 * sc, 0, 1.3 * sc, 0), part('box', 0x3a2a1a, 0.8 * sc, 1.2 * sc, 0.05, 0, 0.6 * sc, 1.06 * sc)); t.children[0].rotation.y = Math.PI / 4; t.position.set(Math.cos(ang + Math.PI + o) * 5, 0, Math.sin(ang + Math.PI + o) * 5); t.rotation.y = -(ang + Math.PI + o) - Math.PI / 2; g.add(t); });
    const pole = grp(part('cyl6', 0x4a3018, 0.15, 5, 0.15, 0, 2.5, 0), part('box', CAMPCOL[cp.t], 0.05, 1.4, 1, 0, 4.2, 0.55), part('sph', 0xe8e0d0, 0.5, 0.55, 0.5, 0, 5.2, 0));
    pole.position.set(Math.cos(ang) * 6, 0, Math.sin(ang) * 6); g.add(pole);
    g.traverse(o => { if (o.material) fogPatch(o.material); }); scene.add(g);
  });
  // boss lairs: standing stones
  M.bosses.forEach(b => { for (let a = 0; a < 6.28; a += 0.75) { const s = 0.9 + Math.abs(Math.sin(a * 7)) * 0.8, st = part('box', 0x6a6660, 1.2 * s, 3.4 * s, 0.9 * s, b.x + Math.cos(a) * 12.5, 1.5 * s, b.z + Math.sin(a) * 12.5); st.rotation.y = -a; st.rotation.z = (Math.sin(a * 5)) * 0.12; fogPatch(st.material); scene.add(st); } });
  // base decor: fountain, banners, stall, ledger
  const F = M.fountain;
  const ft = grp(part('cyl', 0xa8a49a, 7, 0.9, 7, 0, 0.45, 0), part('cyl', 0x4aa0d0, 6.2, 0.2, 6.2, 0, 0.92, 0, { r: 0.2, m: 0.1 }), part('cyl', 0x9a968c, 1.2, 2.6, 1.2, 0, 1.6, 0), part('cyl', 0xa8a49a, 3, 0.4, 3, 0, 2.9, 0), part('oct', 0xbfe6ff, 1, 1.6, 1, 0, 4.4, 0, { e: 0x4a90d0, ei: 0.6 }));
  ft.position.set(F.x, 0, F.z + 2); scene.add(ft); G.fountainGem = ft.children[4];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const b = grp(part('cyl6', 0x3a3a40, 0.25, 7, 0.25, 0, 3.5, 0), part('box', 0x2a5ab0, 0.06, 3.4, 1.6, 0.12, 5, 0.8, { e: 0x0a1a40 }), part('cone4', 0xd8b050, 0.5, 0.6, 0.5, 0, 7.2, 0, { m: 0.6, r: 0.4 })); b.position.set(sx * 20, 0, F.z + 4 + sz * 16); scene.add(b);
    const r = grp(part('cyl6', 0x3a3a40, 0.25, 7, 0.25, 0, 3.5, 0), part('box', 0xb02a3a, 0.06, 3.4, 1.6, 0.12, 5, 0.8, { e: 0x400a10 })); r.position.set(sx * 20, 0, -F.z - 4 + sz * 16); scene.add(r);
  });
  const stall = grp(part('box', 0x7a5430, 5, 1.1, 2.2, 0, 0.55, 0), part('box', 0xd8c8a0, 5.4, 0.12, 2.6, 0, 1.15, 0), part('cyl6', 0x5a3a20, 0.18, 3.2, 0.18, -2.4, 1.6, -1), part('cyl6', 0x5a3a20, 0.18, 3.2, 0.18, 2.4, 1.6, -1), part('box', 0xc03a3a, 5.6, 0.12, 3, 0, 3.3, -0.2), part('box', 0xf0e0c0, 5.6, 0.1, 1, 0, 3.32, -0.2), part('box', 0x6a8ac0, 0.6, 0.6, 0.6, -1.2, 1.5, 0), part('sph', 0xe04040, 0.6, 0.6, 0.6, 0.6, 1.5, 0.2), part('box', 0xd0a040, 0.5, 0.4, 0.5, 1.6, 1.4, 0));
  stall.children[4].rotation.x = 0.25; stall.position.set(DW.MAP.shop.x, 0, DW.MAP.shop.z); stall.rotation.y = 0.4; scene.add(stall);
  const sring = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.45, depthWrite: false })); sring.rotation.x = -Math.PI / 2; sring.scale.setScalar(8); sring.position.set(DW.MAP.shop.x, 0.12, DW.MAP.shop.z); scene.add(sring);
  const coin = grp(part('cyl', 0xffd36b, 1.2, 0.18, 1.2, 0, 0, 0, { m: 0.8, r: 0.25, e: 0x604010, ei: 0.5 })); coin.children[0].rotation.x = Math.PI / 2; coin.position.set(DW.MAP.shop.x, 6, DW.MAP.shop.z); scene.add(coin); G.shopCoin = coin;
  const lb = grp(part('box', 0x5a3d22, 0.3, 3, 0.3, -1.6, 1.5, 0), part('box', 0x5a3d22, 0.3, 3, 0.3, 1.6, 1.5, 0), part('box', 0x8a6a3a, 3.8, 2, 0.2, 0, 2.6, 0), part('box', 0xe8d8a8, 3.2, 1.4, 0.05, 0, 2.6, 0.12));
  lb.position.set(F.x + 11, 0, F.z - 9); lb.rotation.y = -0.4; scene.add(lb);
  const ss = grp(part('cone4', 0x5a2a8a, 6, 4.5, 6, 0, 3.2, 0), part('box', 0x3a2a1a, 4.2, 1, 4.2, 0, 0.5, 0), part('box', 0x1a0a2a, 1.4, 1.8, 0.1, 0, 1.4, 2.12), part('oct', 0xd08aff, 0.9, 1.3, 0.9, 0, 6.6, 0, { e: 0x8a3ad0, ei: 0.8 }));
  ss.children[0].rotation.y = Math.PI / 4; ss.position.set(M.secretShop.x, 0, M.secretShop.z); scene.add(ss); G.secretGem = ss.children[3];
  const fg = grp(part('box', 0x4a4a52, 2.6, 1, 1.4, 0, 0.5, 0, { m: 0.5, r: 0.5 }), part('box', 0x2a2a30, 3.4, 0.5, 1.8, 0, 1.25, 0, { m: 0.6, r: 0.4 }), part('ico', 0x6a6a70, 1.8, 1.4, 1.8, -3, 0.6, 1), part('ico', 0x6a6a70, 1.4, 1.6, 1.4, 2.8, 0.6, -1.4), part('sph', 0xff6a20, 0.7, 0.45, 0.7, 0, 1.6, 0, { e: 0xff4a00 }), part('cyl6', 0x5a5a60, 0.9, 3.5, 0.9, -1.8, 1.75, -1.6));
  fg.position.set(M.forge.x, 0, M.forge.z); scene.add(fg); G.forgeEmber = fg.children[4];
  [ft, stall, lb, ss, fg].forEach(o => o.traverse(x => { if (x.material) fogPatch(x.material); }));
}
// ---------- fog of war ----------
const FOG = { cv: null, ctx: null, ex: null, exc: null, tex: null, uni: null, t: 0 };
function fogInit() {
  const T = DW.TER; FOG.cv = document.createElement('canvas'); FOG.cv.width = T.cols; FOG.cv.height = T.rows; FOG.ctx = FOG.cv.getContext('2d');
  FOG.ex = document.createElement('canvas'); FOG.ex.width = T.cols; FOG.ex.height = T.rows; FOG.exc = FOG.ex.getContext('2d');
  FOG.ctx.fillStyle = '#000'; FOG.ctx.fillRect(0, 0, T.cols, T.rows); FOG.exc.fillStyle = '#000'; FOG.exc.fillRect(0, 0, T.cols, T.rows);
  FOG.tex = new THREE.CanvasTexture(FOG.cv); FOG.tex.flipY = false; FOG.tex.magFilter = FOG.tex.minFilter = THREE.LinearFilter; FOG.tex.generateMipmaps = false;
  FOG.uni = { fogTex: { value: FOG.tex }, fogB: { value: new THREE.Vector4(T.ox, T.oz, T.cols * T.cs, T.rows * T.cs) }, fogOn: { value: 1 } };
}
function fogReset() { if (!FOG.ctx) return; const T = DW.TER; FOG.exc.fillStyle = '#000'; FOG.exc.fillRect(0, 0, T.cols, T.rows); }
function fogPatch(m) {
  if (!m || m.userData.fog || !m.isMeshStandardMaterial) return; m.userData.fog = 1; if (!FOG.uni) fogInit();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, FOG.uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFogW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 fw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nfw = instanceMatrix * fw;\n#endif\nvFogW = (modelMatrix * fw).xz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFogW; uniform sampler2D fogTex; uniform vec4 fogB; uniform float fogOn;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (fogOn > 0.5) { vec2 fuv = (vFogW - fogB.xy) / fogB.zw; float vis = texture2D(fogTex, clamp(fuv, 0.0, 1.0)).r; vec3 g = vec3(dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11))); vec3 seen = mix(g, gl_FragColor.rgb, 0.4) * 0.42; vec3 dark = gl_FragColor.rgb * 0.035; gl_FragColor.rgb = vis < 0.5 ? mix(dark, seen, smoothstep(0.0, 0.5, vis)) : mix(seen, gl_FragColor.rgb, smoothstep(0.5, 1.0, vis)); }');
  };
  m.needsUpdate = true;
}
function fogUpdate(now) {
  if (!G.cur || !G.cur.vs || now - FOG.t < 140) return; FOG.t = now;
  const T = DW.TER, c = FOG.ctx, e = FOG.exc, cs = T.cs, toX = x => (x - T.ox) / cs, toZ = z => (z - T.oz) / cs;
  c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.fillStyle = '#000'; c.fillRect(0, 0, T.cols, T.rows);
  c.globalAlpha = 0.5; c.drawImage(FOG.ex, 0, 0); c.globalAlpha = 1;
  c.fillStyle = '#fff'; e.fillStyle = '#fff';
  for (const v of G.cur.vs) {
    const [x, z, r, L] = v;
    c.beginPath(); e.beginPath();
    if (!L) { c.ellipse(toX(x), toZ(z), r / cs, r / cs, 0, 0, 7); e.ellipse(toX(x), toZ(z), r / cs, r / cs, 0, 0, 7); }
    else {
      const N = 72;
      for (let i = 0; i <= N; i++) {
        const a = i / N * 6.2832, dx = Math.cos(a), dz = Math.sin(a); let d = 0.5;
        while (d < r) { if (DW.blocked(x + dx * d, z + dz * d)) { d += 1.6; break; } d += 0.9; }
        d = Math.min(d, r); const px = toX(x + dx * d), pz = toZ(z + dz * d); i ? (c.lineTo(px, pz), e.lineTo(px, pz)) : (c.moveTo(px, pz), e.moveTo(px, pz));
      }
    }
    c.fill(); e.fill();
  }
  FOG.tex.needsUpdate = true;
}
// ---------- particles ----------
const PT = { max: 3000, n: 0 };
function particlesInit() {
  const N = PT.max, g = new THREE.BufferGeometry();
  PT.pos = new Float32Array(N * 3); PT.col = new Float32Array(N * 3); PT.size = new Float32Array(N); PT.alpha = new Float32Array(N);
  PT.vel = new Float32Array(N * 3); PT.life = new Float32Array(N); PT.max0 = new Float32Array(N); PT.s0 = new Float32Array(N); PT.s1 = new Float32Array(N); PT.grav = new Float32Array(N); PT.drag = new Float32Array(N); PT.next = 0;
  g.setAttribute('position', new THREE.BufferAttribute(PT.pos, 3)); g.setAttribute('pcol', new THREE.BufferAttribute(PT.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(PT.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(PT.alpha, 1));
  PT.uni = { scale: { value: 400 } };
  const m = new THREE.ShaderMaterial({ uniforms: PT.uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float size; attribute float alpha; attribute vec3 pcol; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC=pcol; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; float a = vA * smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC * a, a); }' });
  PT.geo = g; PT.points = new THREE.Points(g, m); PT.points.frustumCulled = false; scene.add(PT.points);
}
const _pc = new THREE.Color();
function emit(x, y, z, o) {
  const i = PT.next; PT.next = (PT.next + 1) % PT.max; _pc.set(o.c || '#ffffff');
  PT.pos[i * 3] = x; PT.pos[i * 3 + 1] = y; PT.pos[i * 3 + 2] = z;
  PT.vel[i * 3] = o.vx || 0; PT.vel[i * 3 + 1] = o.vy || 0; PT.vel[i * 3 + 2] = o.vz || 0;
  PT.col[i * 3] = _pc.r; PT.col[i * 3 + 1] = _pc.g; PT.col[i * 3 + 2] = _pc.b;
  PT.life[i] = PT.max0[i] = o.life || 0.6; PT.s0[i] = o.s || 1; PT.s1[i] = o.s1 !== undefined ? o.s1 : (o.s || 1) * 0.3; PT.grav[i] = o.g || 0; PT.drag[i] = o.d || 0;
}
function burstP(x, y, z, n, col, spd, size, life, up, grav) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = spd * (0.4 + Math.random() * 0.8); emit(x, y, z, { vx: Math.cos(a) * s, vy: (up || 0) * (0.5 + Math.random()), vz: Math.sin(a) * s, c: col, s: size * (0.6 + Math.random() * 0.6), life: life * (0.6 + Math.random() * 0.6), g: grav || 0, d: 2 }); } }
function particlesUpdate(dt) {
  for (let i = 0; i < PT.max; i++) {
    if (PT.life[i] <= 0) { if (PT.alpha[i]) PT.alpha[i] = 0; continue; }
    PT.life[i] -= dt; const k = Math.max(0, PT.life[i] / PT.max0[i]), dr = Math.max(0, 1 - PT.drag[i] * dt);
    PT.vel[i * 3] *= dr; PT.vel[i * 3 + 2] *= dr; PT.vel[i * 3 + 1] = PT.vel[i * 3 + 1] * dr - PT.grav[i] * dt;
    PT.pos[i * 3] += PT.vel[i * 3] * dt; PT.pos[i * 3 + 1] += PT.vel[i * 3 + 1] * dt; PT.pos[i * 3 + 2] += PT.vel[i * 3 + 2] * dt;
    if (PT.pos[i * 3 + 1] < 0.05) { PT.pos[i * 3 + 1] = 0.05; PT.vel[i * 3 + 1] *= -0.3; }
    PT.size[i] = PT.s1[i] + (PT.s0[i] - PT.s1[i]) * k; PT.alpha[i] = Math.min(1, k * 2.2);
  }
  PT.geo.attributes.position.needsUpdate = true; PT.geo.attributes.size.needsUpdate = true; PT.geo.attributes.alpha.needsUpdate = true; PT.geo.attributes.pcol.needsUpdate = true;
  PT.uni.scale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
}
// ---------- characters ----------
const TEAMC = [0x2f6ad8, 0xc02a3a, 0xb08a40];
function limb(col, w, len, x, y, o) { const g = new THREE.Group(); g.position.set(x, y, 0); const m = part('box', col, w, len, w * 1.05, 0, -len / 2, 0, o); g.add(m); return g; }
function rig(o) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const hip = o.legLen || 0.95, legW = o.legW || 0.3, tw = o.tw || 0.95, th = o.th || 0.95;
  const legL = limb(o.legs, legW, hip, -0.23 * tw, hip), legR = limb(o.legs, legW, hip, 0.23 * tw, hip);
  if (o.boots) { legL.add(part('box', o.boots, legW * 1.15, 0.28, legW * 1.4, 0, -hip + 0.12, 0.05)); legR.add(part('box', o.boots, legW * 1.15, 0.28, legW * 1.4, 0, -hip + 0.12, 0.05)); }
  const torso = part(o.round ? 'sph' : 'box', o.torso, tw, th, 0.55 * (o.depth || 1), 0, hip + th / 2, 0, o.tm);
  if (o.round) torso.scale.set(tw * 1.2, th * 1.15, 0.9 * (o.depth || 1));
  body.add(legL, legR, torso);
  if (o.belt) body.add(part('box', o.belt, tw * 1.03, 0.16, 0.58 * (o.depth || 1), 0, hip + 0.08, 0));
  const sy = hip + th - 0.05, aw = o.armW || 0.24, al = o.armLen || 0.92;
  const armL = limb(o.arms, aw, al, -(tw / 2 + aw / 2), sy, o.am), armR = limb(o.arms, aw, al, tw / 2 + aw / 2, sy, o.am);
  if (o.hands) { armL.add(part('sph', o.hands, aw * 1.25, aw * 1.25, aw * 1.25, 0, -al, 0)); armR.add(part('sph', o.hands, aw * 1.25, aw * 1.25, aw * 1.25, 0, -al, 0)); }
  if (o.pads) { armL.add(part('sph', o.pads, aw * 2, aw * 1.5, aw * 2, 0, 0, 0, o.am)); armR.add(part('sph', o.pads, aw * 2, aw * 1.5, aw * 2, 0, 0, 0, o.am)); }
  body.add(armL, armR);
  const head = new THREE.Group(); head.position.y = sy + 0.38; body.add(head);
  if (o.skin !== null) head.add(part('sph', o.skin || 0xf0c8a0, 0.6, 0.64, 0.6, 0, 0, 0));
  if (o.eyes) { head.add(part('box', o.eyes, 0.1, 0.07, 0.04, -0.13, 0.04, 0.29, { e: o.eyesE || 0 }), part('box', o.eyes, 0.1, 0.07, 0.04, 0.13, 0.04, 0.29, { e: o.eyesE || 0 })); }
  return { g, body, legL, legR, armL, armR, head, torso, hip, top: sy + 0.8 };
}
function weaponSword(col, len) { return grp(part('box', 0x5a3a20, 0.1, 0.32, 0.1, 0, 0, 0), part('box', 0xd8b050, 0.42, 0.08, 0.12, 0, 0.18, 0, { m: 0.7, r: 0.35 }), part('box', col || 0xdde4f0, 0.1, len || 1.2, 0.04, 0, 0.22 + (len || 1.2) / 2, 0, { m: 0.85, r: 0.25 })); }
function hold(arm, item, ang) { item.position.set(0, -0.9, 0.12); item.rotation.x = ang !== undefined ? ang : Math.PI / 2; arm.add(item); return item; }
function skirt(r, col, h, y, o) { return part('cone', col, r, h, r, 0, y, 0, o); }
// ---------- heroes: rounded low-poly with smooth shading + outline ----------
const HG = { sph: new THREE.SphereGeometry(0.5, 16, 12), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14), tap: new THREE.CylinderGeometry(0.5, 0.38, 1, 14), tapUp: new THREE.CylinderGeometry(0.38, 0.5, 1, 14), cone: new THREE.ConeGeometry(0.5, 1, 16), hemi: new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), tor: new THREE.TorusGeometry(0.5, 0.07, 8, 28), torHalf: new THREE.TorusGeometry(0.5, 0.045, 6, 20, Math.PI), box: new THREE.BoxGeometry(1, 1, 1, 1, 1, 1), capsule: new THREE.SphereGeometry(0.5, 14, 10) };
const smat = new Map();
function matS(col, o) { o = o || {}; const k = col + '|' + (o.m || 0) + '|' + (o.r || 0) + '|' + (o.e || 0); if (!smat.has(k)) { const m = new THREE.MeshStandardMaterial({ color: col, metalness: (o.m || 0) * 0.35, roughness: o.m ? Math.max(0.35, o.r || 0.4) : (o.r || 0.6), emissive: o.e || 0, emissiveIntensity: o.ei || 1 }); m.userData.cached = 1; fogPatch(m); smat.set(k, m); } return smat.get(k); }
function hp(g, col, sx, sy, sz, x, y, z, o) { const m = new THREE.Mesh(HG[g], matS(col, o)); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; return m; }
function hlimb(col, w, len, x, y, o, joint) { const g = new THREE.Group(); g.position.set(x, y, 0); g.add(hp('sph', joint || col, w * 1.15, w * 1.15, w * 1.15, 0, 0, 0, o), hp('tap', col, w, len, w, 0, -len / 2, 0, o), hp('sph', col, w * 0.95, w * 0.95, w * 0.95, 0, -len, 0, o)); return g; }
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0a0806, side: THREE.BackSide });
function addOutline(root, k) { const list = []; root.traverse(o => { if (o.isMesh && !o.userData.noOutline && o.material !== OUTLINE) list.push(o); }); list.forEach(o => { const ol = new THREE.Mesh(o.geometry, OUTLINE); ol.scale.setScalar(k); ol.userData.noOutline = 1; ol.castShadow = false; o.add(ol); }); }
function heroRig(o) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const hip = o.hip || 1, lw = o.lw || 0.32, tw = o.tw || 1, th = o.th || 1, aw = o.aw || 0.26, al = o.al || 0.95;
  const legL = hlimb(o.legs, lw, hip * 0.98, -0.24 * tw, hip, o.lm), legR = hlimb(o.legs, lw, hip * 0.98, 0.24 * tw, hip, o.lm);
  if (o.boots) for (const L of [legL, legR]) L.add(hp('sph', o.boots, lw * 1.35, lw * 0.9, lw * 1.8, 0, -hip + 0.1, 0.08, o.bm));
  const pelvis = hp('sph', o.pelvis || o.legs, 0.62 * tw, 0.42, 0.48, 0, hip + 0.06, 0, o.lm);
  const torso = hp('tapUp', o.torso, 0.82 * tw, th, 0.52 * (o.depth || 1), 0, hip + th / 2 + 0.05, 0, o.tm);
  const chest = hp('sph', o.torso, 0.9 * tw, 0.55 * th, 0.6 * (o.depth || 1), 0, hip + th * 0.78, 0.02, o.tm);
  body.add(legL, legR, pelvis, torso, chest);
  const sy = hip + th * 0.92;
  const armL = hlimb(o.arms, aw, al, -(0.47 * tw + aw * 0.3), sy, o.am, o.joint), armR = hlimb(o.arms, aw, al, 0.47 * tw + aw * 0.3, sy, o.am, o.joint);
  if (o.hands) { armL.add(hp('sph', o.hands, aw * 1.35, aw * 1.2, aw * 1.35, 0, -al - 0.05, 0)); armR.add(hp('sph', o.hands, aw * 1.35, aw * 1.2, aw * 1.35, 0, -al - 0.05, 0)); }
  body.add(armL, armR);
  const head = new THREE.Group(); head.position.y = sy + 0.42; body.add(head, hp('cyl', o.skin || 0xf0c8a0, 0.22, 0.3, 0.22, 0, sy + 0.1, 0));
  if (o.skin !== null) head.add(hp('sph', o.skin || 0xf0c8a0, 0.6, 0.66, 0.6, 0, 0, 0));
  if (o.eyes) head.add(hp('sph', o.eyes, 0.09, 0.11, 0.05, -0.13, 0.04, 0.28, { e: o.eyesE || 0 }), hp('sph', o.eyes, 0.09, 0.11, 0.05, 0.13, 0.04, 0.28, { e: o.eyesE || 0 }));
  return { g, body, legL, legR, armL, armR, head, torso, hip, top: sy + 0.8 };
}
function heroHold(arm, item, ang) { item.position.set(0, -0.98, 0.1); item.rotation.x = ang !== undefined ? ang : Math.PI / 2; arm.add(item); return item; }
function buildHero(hid, team) {
  let R; const G2 = (...p) => { const g = new THREE.Group(); p.forEach(x => g.add(x)); return g; };
  if (hid === 'ironvow') { // armored knight: huge pauldrons, great helm with plume, kite shield, cape
    const steel = { m: 0.85, r: 0.28 };
    R = heroRig({ legs: 0x8a94a8, lm: steel, torso: 0xc8d2e4, tm: steel, arms: 0xb8c4d8, am: steel, joint: 0x5a6274, hands: 0x6a7488, boots: 0x4a5264, bm: steel, skin: 0xb8c4d8, tw: 1.22, th: 1.05, lw: 0.36, aw: 0.3 });
    R.body.add(hp('tor', 0x2a5ad0, 1.1, 1.1, 0.7, 0, R.hip + 0.12, 0, { m: 0.4 })); R.body.children[R.body.children.length - 1].rotation.x = Math.PI / 2;
    R.body.add(hp('box', 0x2448a8, 0.95, 0.9, 0.06, 0, R.hip + 0.55, 0.3), hp('box', 0xd8b050, 0.18, 0.75, 0.07, 0, R.hip + 0.58, 0.32, { m: 0.8, r: 0.3 }));
    for (const A of [R.armL, R.armR]) A.add(hp('sph', 0xd0dcee, 0.78, 0.6, 0.78, 0, 0.12, 0, steel), hp('tor', 0x2a5ad0, 0.62, 0.62, 0.62, 0, 0.02, 0, { m: 0.5 }));
    R.armL.children[R.armL.children.length - 1].rotation.x = Math.PI / 2; R.armR.children[R.armR.children.length - 1].rotation.x = Math.PI / 2;
    R.head.add(hp('cyl', 0xd0dcee, 0.66, 0.7, 0.66, 0, 0, 0, steel), hp('hemi', 0xd0dcee, 0.66, 0.4, 0.66, 0, 0.35, 0, steel), hp('box', 0x0a0c14, 0.5, 0.07, 0.08, 0, 0.04, 0.31), hp('box', 0x0a0c14, 0.06, 0.32, 0.08, 0, -0.1, 0.31));
    for (let i = 0; i < 4; i++) R.head.add(hp('sph', 0x3a7aff, 0.22 - i * 0.03, 0.42, 0.22 - i * 0.03, 0, 0.6 + i * 0.1, -0.12 - i * 0.18, { e: 0x0a1a50 }));
    const cape = hp('box', 0x2a5ad0, 1.15, 1.7, 0.06, 0, R.hip + 0.2, -0.36, { e: 0x050a20 }); cape.rotation.x = 0.12; R.body.add(cape);
    const sh = G2(hp('sph', 0xc8d2e4, 1.05, 1.45, 0.22, 0, 0, 0, steel), hp('sph', 0x2a5ad0, 0.85, 1.2, 0.2, 0, 0, 0.03), hp('box', 0xd8b050, 0.14, 0.95, 0.06, 0, 0, 0.13, { m: 0.8 }), hp('box', 0xd8b050, 0.6, 0.14, 0.06, 0, 0.18, 0.13, { m: 0.8 }));
    sh.position.set(-0.2, -0.65, 0.3); sh.rotation.y = -0.3; R.armL.add(sh);
    heroHold(R.armR, G2(hp('cyl', 0x4a3020, 0.1, 0.42, 0.1, 0, 0, 0), hp('box', 0xd8b050, 0.5, 0.09, 0.14, 0, 0.24, 0, { m: 0.8, r: 0.3 }), hp('box', 0xeef2fa, 0.13, 1.45, 0.05, 0, 1.02, 0, { m: 0.9, r: 0.2 }), hp('cone', 0xeef2fa, 0.13, 0.25, 0.05, 0, 1.86, 0, { m: 0.9, r: 0.2 })));
    R.atkStyle = 'swing'; R.trail = '#bfe0ff';
  } else if (hid === 'emberwitch') { // slender witch: flared robe, wide-brim crooked hat, flame staff
    R = heroRig({ legs: 0x2a1414, torso: 0x9a1e14, tm: { r: 0.5 }, arms: 0x8a1a12, hands: 0xf0c8a8, skin: 0xf2c8a8, tw: 0.8, th: 0.95, lw: 0.24, aw: 0.2, eyes: 0x2a1010 });
    R.body.add(hp('cone', 0x7a140e, 1.75, 1.45, 1.75, 0, R.hip * 0.55, 0, { r: 0.55 }), hp('tor', 0xff8a2a, 1.62, 1.62, 1.62, 0, R.hip * 0.0 + 0.1, 0, { e: 0x802000, ei: 0.8 }), hp('tor', 0xd8a040, 0.78, 0.78, 0.78, 0, R.hip + 0.08, 0, { m: 0.7 }));
    R.body.children[R.body.children.length - 2].rotation.x = Math.PI / 2; R.body.children[R.body.children.length - 1].rotation.x = Math.PI / 2;
    R.head.add(hp('sph', 0xe0601a, 0.7, 0.55, 0.5, 0, 0.05, -0.2), hp('box', 0xe0601a, 0.62, 0.9, 0.18, 0, -0.35, -0.28));
    const hat = G2(hp('cyl', 0x221010, 1.7, 0.05, 1.7, 0, 0, 0), hp('tor', 0xc84a1a, 0.66, 0.66, 0.66, 0, 0.06, 0, { e: 0x401000 }), hp('cone', 0x221010, 0.72, 0.85, 0.72, 0, 0.45, 0), hp('cone', 0x221010, 0.38, 0.75, 0.38, 0.12, 1.05, -0.12));
    hat.children[1].rotation.x = Math.PI / 2; hat.children[3].rotation.z = -0.5; hat.children[3].rotation.x = -0.3; hat.position.y = 0.28; R.head.add(hat);
    const st = G2(hp('cyl', 0x3a2418, 0.09, 2.6, 0.09, 0, 0.45, 0), hp('tor', 0xd8a040, 0.42, 0.42, 0.42, 0, 1.78, 0, { m: 0.8 }), hp('sph', 0xff6a1a, 0.48, 0.48, 0.48, 0, 1.9, 0, { e: 0xff4a00, ei: 1.2 }));
    heroHold(R.armR, st, 0.25); R.glow = st.children[2]; R.atkStyle = 'cast'; R.castCol = '#ff7a2a';
  } else if (hid === 'thornshot') { // hooded ranger: long cloak, tall longbow, quiver
    R = heroRig({ legs: 0x5a4028, torso: 0x2e6a26, tm: { r: 0.8 }, arms: 0x3a5a2a, hands: 0x6a4a2a, boots: 0x3a2a1a, skin: 0xe0b890, tw: 0.86, th: 1, lw: 0.27, aw: 0.21, hip: 1.08, eyes: 0x1a1a10 });
    R.head.add(hp('sph', 0x24521e, 0.78, 0.8, 0.8, 0, 0.06, -0.06, { r: 0.85 }), hp('cone', 0x24521e, 0.36, 0.55, 0.36, 0, 0.4, -0.32, { r: 0.85 }), hp('sph', 0x101808, 0.5, 0.42, 0.18, 0, 0.0, 0.25));
    R.head.children[R.head.children.length - 2].rotation.x = -0.7;
    const cloak = hp('cone', 0x24521e, 1.35, 1.9, 1.2, 0, R.hip + 0.45, -0.12, { r: 0.85 }); R.body.add(cloak);
    for (let i = -2; i <= 2; i++) R.body.add(hp('cone', 0x1e461a, 0.3, 0.5, 0.2, i * 0.26, R.hip - 0.55, -0.5, { r: 0.85 }));
    R.body.children.slice(-5).forEach(c => c.rotation.x = Math.PI);
    const q = G2(hp('cyl', 0x6a4a2a, 0.36, 1.05, 0.36, 0, 0, 0), ...[-1, 0, 1].map(i => hp('cone', 0xe8e0c8, 0.09, 0.32, 0.09, i * 0.09, 0.68, i * 0.04)), ...[-1, 0, 1].map(i => hp('box', 0xc83a2a, 0.12, 0.14, 0.02, i * 0.09, 0.56, i * 0.04))); q.position.set(0.25, R.hip + 0.65, -0.42); q.rotation.z = 0.35; R.body.add(q);
    const bow = G2(hp('torHalf', 0x8a5a2a, 2.3, 2.3, 3, 0, 0, 0), hp('cyl', 0xeeeeee, 0.015, 2.3, 0.015, 0, 0, 0), hp('box', 0x4a2a1a, 0.14, 0.4, 0.14, 0, 0, 0.06));
    bow.children[0].rotation.z = Math.PI / 2; bow.position.set(0, -0.95, 0.25); bow.rotation.y = Math.PI / 2; R.armL.add(bow); R.bow = bow;
    R.atkStyle = 'bow';
  } else if (hid === 'bloodreaver') { // hulking berserker: bare chest, war paint, horned helm, fur mantle, greataxe
    R = heroRig({ legs: 0x3a2018, torso: 0xc89078, tm: { r: 0.55 }, arms: 0xc89078, hands: 0x3a2018, boots: 0x2a1a14, skin: 0xc89078, tw: 1.42, th: 1.12, lw: 0.4, aw: 0.36, al: 1.02, eyes: 0xff2a2a, eyesE: 0xc00000 });
    for (let i = 0; i < 3; i++) R.body.add(hp('box', 0x9a0a10, 0.9, 0.07, 0.03, 0, R.hip + 0.4 + i * 0.22, 0.3, { e: 0x300000 }));
    R.body.add(hp('ico1', 0x5a4030, 1.9, 0.75, 1.1, 0, R.hip + 1.08, -0.06, { r: 0.95 }), hp('tor', 0x3a2418, 0.95, 0.95, 0.75, 0, R.hip + 0.1, 0));
    R.body.children[R.body.children.length - 1].rotation.x = Math.PI / 2;
    R.body.children[R.body.children.length - 2].geometry = new THREE.IcosahedronGeometry(0.5, 1);
    R.head.add(hp('hemi', 0x3a3a44, 0.72, 0.62, 0.72, 0, 0.06, 0, { m: 0.7, r: 0.35 }));
    for (const sx of [-1, 1]) { const horn = G2(hp('cone', 0xe8dcc0, 0.2, 0.55, 0.2, 0, 0.27, 0), hp('cone', 0xe8dcc0, 0.13, 0.45, 0.13, sx * -0.12, 0.62, 0)); horn.children[1].rotation.z = sx * 0.6; horn.position.set(sx * 0.36, 0.22, 0); horn.rotation.z = -sx * 0.9; R.head.add(horn); }
    heroHold(R.armR, G2(hp('cyl', 0x4a3020, 0.13, 2.6, 0.13, 0, 0.75, 0), hp('sph', 0xb8b8c4, 0.24, 1.05, 0.95, 0, 1.8, 0.42, { m: 0.85, r: 0.25 }), hp('sph', 0xb8b8c4, 0.24, 0.9, 0.75, 0, 1.8, -0.36, { m: 0.85, r: 0.25 }), hp('sph', 0x8a0a10, 0.18, 0.2, 0.18, 0, 2.15, 0, { e: 0x400000 })));
    R.atkStyle = 'cleave'; R.trail = '#ff3a4a';
  } else { // Lumen: priestess, flowing white/gold robe, halo, light wings, orb staff
    R = heroRig({ legs: 0xece4d0, torso: 0xf6f0e0, tm: { r: 0.45 }, arms: 0xf6f0e0, hands: 0xf0d0b0, skin: 0xf2d4b4, tw: 0.84, th: 0.95, lw: 0.25, aw: 0.21, eyes: 0x3a2a1a });
    R.body.add(hp('cone', 0xf4ecd8, 1.7, 1.45, 1.7, 0, R.hip * 0.55, 0, { r: 0.45 }), hp('tor', 0xe8b84a, 1.58, 1.58, 1.58, 0, 0.12, 0, { m: 0.7 }), hp('box', 0xe8b84a, 0.22, 1.25, 0.05, 0, R.hip + 0.32, 0.3, { m: 0.6 }));
    R.body.children[R.body.children.length - 2].rotation.x = Math.PI / 2;
    R.head.add(hp('sph', 0xfaf0c0, 0.7, 0.5, 0.66, 0, 0.18, -0.06), hp('box', 0xfaf0c0, 0.6, 0.85, 0.16, 0, -0.32, -0.26));
    const halo = hp('tor', 0xffe27a, 1, 1, 1, 0, 0.75, 0, { e: 0xffc020, ei: 1.2 }); halo.rotation.x = Math.PI / 2; halo.userData.noOutline = 1; R.head.add(halo); R.halo = halo;
    const wingM = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xffe08a, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }); fogPatch(wingM);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(HG.sph, wingM); w.scale.set(0.12, 1.3, 0.62); w.position.set(sx * 0.48, R.hip + 1.1, -0.42); w.rotation.z = -sx * 0.55; w.rotation.y = sx * 0.3; w.userData.noOutline = 1; R.body.add(w); R['wing' + (sx < 0 ? 'L' : 'R')] = w; }
    const st = G2(hp('cyl', 0xd8c080, 0.08, 2.5, 0.08, 0, 0.42, 0, { m: 0.6 }), hp('tor', 0xe8b84a, 0.5, 0.5, 0.5, 0, 1.78, 0, { m: 0.8 }), hp('sph', 0xfff1a8, 0.45, 0.45, 0.45, 0, 1.78, 0, { e: 0xffd040, ei: 1.2 }));
    heroHold(R.armR, st, 0.25); R.glow = st.children[2]; R.atkStyle = 'cast'; R.castCol = '#fff1a8';
  }
  addOutline(R.g, 1.07);
  R.g.scale.setScalar(1.45); R.h = R.top * 1.45 + 0.4; R.hero = 1;
  return R;
}
// ---- themed enemies: Undead (L), Orc (M), Naga (R) ----
function nagaTail(R, col, belly) {
  R.body.remove(R.legL, R.legR); R.legL = R.legR = null;
  const tail = new THREE.Group(); R.body.add(tail);
  tail.add(part('cyl', col, 0.78, R.hip, 0.7, 0, R.hip / 2, 0), part('box', belly, 0.5, R.hip * 0.9, 0.1, 0, R.hip / 2, 0.33));
  const segs = [[0.66, -0.55], [0.56, -1.2], [0.44, -1.8], [0.32, -2.3]];
  segs.forEach(([w, z], i) => { const sg = part('cyl', i % 2 ? col : belly === col ? col : col, w, 0.75, w * 0.85, 0, 0.28 - i * 0.03, z); sg.rotation.x = Math.PI / 2; tail.add(sg); });
  const tip = part('cone', col, 0.26, 0.7, 0.22, 0, 0.18, -2.85); tip.rotation.x = -Math.PI / 2; tail.add(tip);
  R.tail = tail; return R;
}
function finCrest(R, col) { const f = part('cone4', col, 0.12, 0.9, 0.7, 0, 0.45, -0.05); f.rotation.x = -0.3; R.head.add(f); R.head.add(part('cone4', col, 0.5, 0.35, 0.06, -0.36, 0.05, 0), part('cone4', col, 0.5, 0.35, 0.06, 0.36, 0.05, 0)); }
function claws(arm, len) { for (let k = -1; k <= 1; k++) { const c = part('cone', 0xe8e0c8, 0.07, len, 0.07, k * 0.08, -1.05 - len / 2, 0.06); c.rotation.x = Math.PI; arm.add(c); } }
function buildUndead(base, s0) {
  let R;
  if (base === 'ghoul' || base === 'troll' || base === 'sapling' || base === 'toad') {
    R = rig({ legs: 0x5a6a5a, torso: 0x7a8a78, arms: 0x8a9a88, hands: 0x8a9a88, skin: 0x9aa898, tw: 0.82, armLen: 1.15, armW: 0.2, legW: 0.26, eyes: 0xffe040, eyesE: 0xc0a000, belt: 0x3a2a20 });
    R.body.rotation.x = 0.38; claws(R.armL, 0.4); claws(R.armR, 0.4);
    for (let k = 0; k < 4; k++) R.body.add(part('cone', 0xb0b8a8, 0.12, 0.25, 0.12, 0, R.hip + 0.3 + k * 0.22, -0.3));
    R.head.add(part('box', 0x2a1a1a, 0.4, 0.1, 0.06, 0, -0.18, 0.3), part('cone', 0xf0e8d0, 0.05, 0.14, 0.05, -0.1, -0.15, 0.31), part('cone', 0xf0e8d0, 0.05, 0.14, 0.05, 0.1, -0.15, 0.31));
    s0 *= base === 'troll' ? 1.25 : base === 'ghoul' ? 0.95 : 0.8;
  } else if (base === 'acolyte' || base === 'trollshaman') {
    const necro = base === 'trollshaman';
    R = rig({ legs: 0x1e1428, torso: necro ? 0x3a1020 : 0x2e1a40, arms: necro ? 0x3a1020 : 0x2e1a40, hands: 0x8a9a88, skin: 0x5a6a5a, tw: 0.78, eyes: 0x7aff6a, eyesE: 0x30c040 });
    R.body.add(skirt(1.45, necro ? 0x2a0a18 : 0x24142e, 1.2, R.hip * 0.6, {}), part('box', 0x6aff7a, 0.12, 0.9, 0.04, 0, R.hip + 0.4, 0.29, { e: 0x20a040 }));
    R.head.add(part('cone', necro ? 0x2a0a18 : 0x24142e, 0.8, 1.15, 0.8, 0, 0.2, -0.05), part('box', 0x050308, 0.42, 0.42, 0.05, 0, 0, 0.3));
    hold(R.armR, grp(part('cyl6', 0x2a2a2a, 0.08, 2.3, 0.08, 0, 0.4, 0), part('torusHalf', 0xb0b8c0, 0.8, 0.8, 1.6, 0.2, 1.6, 0, { m: 0.7 }), part('sph', 0x6aff6a, 0.32, 0.32, 0.32, 0, 1.55, 0, { e: 0x30d040 })), 0.25);
    s0 *= necro ? 1.1 : 0.92;
  } else if (base === 'bandit' || base === 'archer' || base === 'skeleton') {
    R = rig({ legs: 0xd8d0c0, torso: 0x2a2428, arms: 0xd8d0c0, hands: 0xd8d0c0, skin: 0xe8e0d0, tw: 0.7, armW: 0.14, legW: 0.15, eyes: 0x40ff60, eyesE: 0x20c040, belt: 0x5a4030 });
    for (let k = 0; k < 4; k++) R.body.add(part('box', 0xd8d0c0, 0.72, 0.08, 0.5, 0, R.hip + 0.25 + k * 0.2, 0.02));
    R.body.add(part('cyl6', 0xd8d0c0, 0.12, 0.95, 0.12, 0, R.hip + 0.47, -0.2));
    R.head.add(part('box', 0x1a1a1a, 0.34, 0.12, 0.05, 0, -0.2, 0.29), part('hemi', 0x5a4a3a, 0.66, 0.45, 0.66, 0, 0.1, 0, { m: 0.5 }));
    if (base === 'archer') { const bow = part('torusHalf', 0x5a4030, 1.4, 1.4, 2.4, 0, -0.9, 0.25); bow.rotation.set(0, Math.PI / 2, Math.PI / 2); R.armL.add(bow); }
    else { hold(R.armR, weaponSword(0x8a6a4a, 0.8)); R.armL.add(part('cyl', 0x5a4a3a, 0.8, 0.12, 0.8, -0.1, -0.6, 0.2)); R.armL.children[R.armL.children.length - 1].rotation.z = Math.PI / 2; }
  } else if (base === 'wolf') {
    R = buildCreep('wolf', 2, 1, [0xd8d0c0, 0x3a3236, 0x6aff7a]);
  } else if (base === 'ogre') {
    R = rig({ legs: 0x8a7070, torso: 0xc0a0a0, arms: 0xb89898, hands: 0xb89898, skin: 0xa88888, round: 1, tw: 1.2, armW: 0.36, eyes: 0xffe040, eyesE: 0xa08000 });
    for (let k = 0; k < 5; k++) R.body.add(part('box', 0x3a1a1a, 0.04, 0.5, 0.04, -0.4 + k * 0.2, R.hip + 0.55, 0.58));
    R.body.add(part('box', 0x3a1a1a, 1.1, 0.04, 0.04, 0, R.hip + 0.55, 0.59), part('cyl', 0x6a3a3a, 0.4, 0.5, 0.4, 0.3, R.hip + 0.3, 0.55));
    hold(R.armR, grp(part('cyl6', 0x4a3020, 0.12, 0.9, 0.12, 0, 0.2, 0), part('box', 0x9a9aa8, 0.1, 0.9, 0.9, 0, 0.9, 0.3, { m: 0.7 }))); hold(R.armL, grp(part('torusHalf', 0x8a8a90, 0.6, 0.6, 0.6, 0, 0.4, 0, { m: 0.7 })));
    s0 *= 1.6;
  } else if (base === 'rockgolem') {
    R = rig({ legs: 0x2e2238, torso: 0x3a2a44, arms: 0x2e2238, skin: 0x3a2a44, tw: 1, armW: 0.34, eyes: 0x6aff7a, eyesE: 0x30d040 });
    for (const sx of [-1, 1]) { const w = part('box', 0x2a1e34, 0.06, 1.4, 1.6, sx * 0.55, R.hip + 0.9, -0.5); w.rotation.y = sx * 0.6; w.rotation.z = sx * -0.4; R.body.add(w); }
    R.head.add(part('cone', 0x2a1e34, 0.12, 0.45, 0.12, -0.22, 0.38, 0), part('cone', 0x2a1e34, 0.12, 0.45, 0.12, 0.22, 0.38, 0));
    s0 *= 1.55;
  } else return null;
  R.g.scale.setScalar(s0); R.h = (R.top || 2) * s0 + 0.3; return R;
}
function buildOrc(base, s0) {
  let R;
  if (base === 'grunt') {
    R = rig({ legs: 0x3a2a20, torso: 0x6a1a14, tm: { m: 0.3, r: 0.6 }, arms: 0x5a8a3a, hands: 0x5a8a3a, pads: 0x2a2a2a, am: { m: 0.5, r: 0.5 }, skin: 0x5a8a3a, tw: 1.12, th: 1, armW: 0.3, eyes: 0xff3a1a, eyesE: 0xa01000, belt: 0x2a1a10, boots: 0x2a1a10 });
    R.head.add(part('cone', 0xf0e8d0, 0.08, 0.26, 0.08, -0.15, -0.2, 0.3), part('cone', 0xf0e8d0, 0.08, 0.26, 0.08, 0.15, -0.2, 0.3), part('cone', 0x1a1a1a, 0.18, 0.5, 0.18, 0, 0.45, -0.1));
    R.armL.add(part('cone', 0xb0b0b8, 0.12, 0.35, 0.12, 0, 0.25, 0)); R.armR.add(part('cone', 0xb0b0b8, 0.12, 0.35, 0.12, 0, 0.25, 0));
    hold(R.armR, grp(part('cyl6', 0x4a3020, 0.1, 1.5, 0.1, 0, 0.5, 0), part('box', 0xb0b0b8, 0.08, 0.7, 0.8, 0, 1.15, 0.35, { m: 0.8, r: 0.3 }), part('box', 0xb0b0b8, 0.08, 0.5, 0.5, 0, 1.15, -0.25, { m: 0.8 })));
    s0 *= 0.98;
  } else if (base === 'headhunter') {
    R = rig({ legs: 0x5a8aa0, torso: 0x5a8aa0, arms: 0x5a8aa0, hands: 0x5a8aa0, skin: 0x6a9ab0, tw: 0.72, legLen: 1.1, armW: 0.18, legW: 0.22, eyes: 0xffe040, eyesE: 0xa08000, belt: 0x6a4a2a });
    R.body.add(part('box', 0x6a4a2a, 0.5, 0.5, 0.1, 0, R.hip - 0.15, 0.24));
    R.head.add(part('box', 0xc02a2a, 0.1, 0.35, 0.65, 0, 0.42, -0.05), part('cone', 0x6a9ab0, 0.1, 0.5, 0.1, -0.38, 0.06, 0), part('cone', 0x6a9ab0, 0.1, 0.5, 0.1, 0.38, 0.06, 0), part('cone', 0xf0e8d0, 0.06, 0.2, 0.06, -0.1, -0.22, 0.3), part('cone', 0xf0e8d0, 0.06, 0.2, 0.06, 0.1, -0.22, 0.3));
    R.head.children[R.head.children.length - 4].rotation.z = Math.PI / 2; R.head.children[R.head.children.length - 3].rotation.z = -Math.PI / 2;
    hold(R.armR, grp(part('cyl6', 0x6a4a2a, 0.06, 2.2, 0.06, 0, 0.4, 0), part('cone4', 0xd0d0d8, 0.14, 0.45, 0.14, 0, 1.7, 0, { m: 0.8 })), 0.3);
    s0 *= 0.95;
  } else return null;
  R.g.scale.setScalar(s0); R.h = R.top * s0 + 0.3; return R;
}
function buildNaga(base, s0) {
  let R;
  if (base === 'myrmidon' || base === 'troll') {
    R = rig({ legs: 0x2a8a7a, torso: 0x2a8a7a, arms: 0x2a8a7a, hands: 0x2a8a7a, skin: 0x3a9a8a, tw: 0.95, armW: 0.24, eyes: 0xffe040, eyesE: 0xc0a000, legLen: 1.25 });
    nagaTail(R, 0x2a7a6a, 0xc8d8a0); finCrest(R, 0x1a5a6a);
    R.body.add(part('box', 0xc8d8a0, 0.5, 0.7, 0.08, 0, R.hip + 0.45, 0.28), part('box', 0xd8b050, 1.05, 0.14, 0.6, 0, R.hip + 0.05, 0, { m: 0.7 }));
    hold(R.armR, grp(part('cyl6', 0xd8b050, 0.07, 2.4, 0.07, 0, 0.5, 0, { m: 0.7 }), part('cone4', 0xe8c860, 0.1, 0.5, 0.1, 0, 1.9, 0, { m: 0.8 }), part('cone4', 0xe8c860, 0.08, 0.35, 0.08, -0.2, 1.75, 0, { m: 0.8 }), part('cone4', 0xe8c860, 0.08, 0.35, 0.08, 0.2, 1.75, 0, { m: 0.8 })), 0.2);
    s0 *= base === 'troll' ? 1.2 : 1;
  } else if (base === 'siren' || base === 'trollshaman' || base === 'archer') {
    R = rig({ legs: 0x3a7aa0, torso: 0x3a7aa0, arms: 0x4a8ab0, hands: 0x4a8ab0, skin: 0x5a9ac0, tw: 0.75, armW: 0.18, eyes: 0xffffff, eyesE: 0x80c0ff, legLen: 1.2 });
    nagaTail(R, 0x2a6a8a, 0xb0d0c8); R.head.add(part('box', 0x6a3a8a, 0.66, 1.1, 0.2, 0, -0.25, -0.3)); finCrest(R, 0x6a3a8a);
    R.body.add(part('box', 0xd8b050, 0.8, 0.12, 0.5, 0, R.hip + 0.7, 0.02, { m: 0.7 }));
    hold(R.armR, grp(part('cyl6', 0xc0a050, 0.06, 2, 0.06, 0, 0.35, 0, { m: 0.6 }), part('sph', 0x5ac8ff, 0.38, 0.38, 0.38, 0, 1.45, 0, { e: 0x2a80d0 })), 0.25);
    s0 *= base === 'archer' ? 0.9 : 1;
  } else if (base === 'bandit') {
    R = rig({ legs: 0x3a7a6a, torso: 0x4a8a7a, arms: 0x4a8a7a, hands: 0x4a8a7a, skin: 0x5a9a8a, tw: 0.8, eyes: 0xffe040, eyesE: 0xc0a000 });
    R.head.scale.set(1.25, 1.05, 1.25); R.head.add(part('cone4', 0xc04a3a, 0.12, 0.7, 0.8, 0, 0.42, -0.1), part('box', 0x1a2a2a, 0.36, 0.08, 0.05, 0, -0.18, 0.3));
    hold(R.armR, grp(part('cyl6', 0x6a5030, 0.06, 1.8, 0.06, 0, 0.35, 0), part('cone4', 0xc0c0c8, 0.12, 0.35, 0.12, 0, 1.35, 0)), 0.3);
    s0 *= 0.9;
  } else if (base === 'wolf') {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(part('sph', 0xc0603a, 1.7, 0.7, 1.3, 0, 0.75, 0), part('sph', 0xe0805a, 1.3, 0.3, 1, 0, 1.05, 0), part('box', 0xff3a1a, 0.08, 0.08, 0.08, -0.2, 1.05, 0.6, { e: 0x801000 }), part('box', 0xff3a1a, 0.08, 0.08, 0.08, 0.2, 1.05, 0.6, { e: 0x801000 }));
    for (const sx of [-1, 1]) { const cl = grp(part('box', 0xc0603a, 0.25, 0.25, 0.8, 0, 0, 0.3), part('box', 0xd0704a, 0.45, 0.35, 0.5, 0, 0, 0.85)); cl.position.set(sx * 0.65, 0.8, 0.5); cl.rotation.y = -sx * 0.4; body.add(cl); }
    const legs = [[-0.7, 0.2], [0.7, 0.2], [-0.7, -0.35], [0.7, -0.35]].map(([x, z]) => { const l = limb(0xa0502a, 0.12, 0.7, x, 0.7); l.position.z = z; l.rotation.z = x > 0 ? -0.5 : 0.5; body.add(l); return l; });
    R = { g, body, legL: legs[0], legR: legs[1], legL2: legs[3], legR2: legs[2], h: 1.6, quad: 1 }; g.scale.setScalar(s0); R.h *= s0; return R;
  } else if (base === 'ogre') {
    R = rig({ legs: 0x3a5a6a, torso: 0x5a8a9a, arms: 0x5a8a9a, hands: 0x5a8a9a, skin: 0x6a9aaa, tw: 1.15, armW: 0.34, eyes: 0xffffff, eyesE: 0x80c0ff, belt: 0x3a6a3a });
    R.head.add(part('box', 0x3a7a3a, 0.5, 0.6, 0.12, 0, -0.35, 0.28), part('box', 0x2a6a2a, 0.12, 0.7, 0.1, -0.15, -0.5, 0.3));
    hold(R.armR, grp(part('cyl6', 0x5a5a60, 0.12, 1.8, 0.12, 0, 0.5, 0, { m: 0.7 }), part('torusHalf', 0x5a5a60, 1.1, 1.1, 1.4, 0, 1.4, 0, { m: 0.7 })));
    s0 *= 1.6;
  } else if (base === 'rockgolem') {
    R = rig({ legs: 0xd07a7a, torso: 0xe08a8a, arms: 0xc07070, skin: 0xe08a8a, tw: 1, armW: 0.34, eyes: 0x5affff, eyesE: 0x20c0c0 });
    [[0x5ac0c0, -0.3, 0.9], [0xf0b05a, 0.3, 1.1], [0xb05ab0, 0, 1.4], [0x5ac0c0, 0.4, 0.6]].forEach(([c, x, y]) => R.body.add(part('cone6', c, 0.25, 0.8, 0.25, x, R.hip + y, -0.25)));
    s0 *= 1.55;
  } else return null;
  R.g.scale.setScalar(s0); R.h = R.top * s0 + 0.3; return R;
}
function buildEnemyMinion(base, th) {
  if (base === 'siege') {
    if (th === 'R') { const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
      body.add(part('hemi', 0x4a6a3a, 2.6, 1.8, 3, 0, 0.6, 0), part('cyl', 0x8a7a4a, 2.5, 0.35, 2.9, 0, 0.6, 0), part('sph', 0x5a8a5a, 0.9, 0.8, 1.1, 0, 1, 1.6), part('box', 0xffe040, 0.1, 0.08, 0.05, -0.2, 1.15, 2.1, { e: 0xa08000 }), part('box', 0xffe040, 0.1, 0.08, 0.05, 0.2, 1.15, 2.1, { e: 0xa08000 }));
      for (let k = 0; k < 5; k++) body.add(part('cone', 0x2a3a2a, 0.3, 0.5, 0.3, (k - 2) * 0.4, 1.95 - Math.abs(k - 2) * 0.15, -0.2 + (k % 2) * 0.5));
      const legs = [[-1, 0.8], [1, 0.8], [-1, -0.8], [1, -0.8]].map(([x, z]) => { const l = limb(0x5a8a5a, 0.4, 0.6, x, 0.6); l.position.z = z; body.add(l); return l; });
      return { g, body, legL: legs[0], legR: legs[1], legL2: legs[3], legR2: legs[2], h: 3, quad: 1 }; }
    const L = th === 'L', g = grp(part('box', L ? 0x3a2a24 : 0x6a4a2a, 1.8, 0.7, 2.6, 0, 0.9, 0), part('box', L ? 0x2a2026 : 0x8a1a14, 1.9, 0.12, 2.7, 0, 1.3, 0));
    for (const [x, z] of [[1, 0.9], [-1, 0.9], [1, -0.9], [-1, -0.9]]) { const w = part('cyl', 0x3a2a1a, 0.95, 0.25, 0.95, x, 0.48, z); w.rotation.z = Math.PI / 2; g.add(w); }
    if (L) for (let k = 0; k < 4; k++) { const rib = part('torusHalf', 0xd8d0c0, 1.6, 1.6, 1.6, 0, 1.35, -0.9 + k * 0.6); g.add(rib); }
    else for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const sp = part('cone', 0xd0d0d8, 0.15, 0.5, 0.15, sx * 0.95, 1, -0.8 + k * 0.8); sp.rotation.z = -sx * Math.PI / 2; g.add(sp); }
    const arm = grp(part('box', L ? 0x4a3a34 : 0x5a3a20, 0.25, 2.2, 0.25, 0, 1.1, 0), L ? part('ico', 0xc07a7a, 0.7, 0.6, 0.7, 0, 2.3, 0) : part('ico', 0x6a6a6a, 0.6, 0.6, 0.6, 0, 2.3, 0)); arm.position.set(0, 1.3, -0.6); arm.rotation.x = -0.6; g.add(arm);
    if (!L) g.add(part('box', 0xa02a20, 0.05, 1.2, 0.8, 0.95, 2.1, 0.8));
    return { g, body: g, h: 2.8, arm };
  }
  if (base === 'elite') { const E = th === 'L' ? buildUndead('ogre', 0.85) : th === 'M' ? buildOrc('grunt', 1.5) : buildNaga('ogre', 0.85); E.elite = 1; return E; }
  if (base === 'lieut') {
    const E = th === 'L' ? buildUndead('acolyte', 2) : th === 'M' ? buildOrc('grunt', 2) : buildNaga('siren', 1.9);
    const crown = grp(...[0, 1, 2, 3, 4].map(i => part('cone4', th === 'L' ? 0x5aff7a : 0xffd36b, 0.12, 0.35, 0.12, Math.cos(i * 1.256) * 0.3, 0.55, Math.sin(i * 1.256) * 0.3, { e: th === 'L' ? 0x30c040 : 0x806010, m: 0.6 })));
    E.head.add(crown); if (th === 'M') E.head.add(part('cone', 0xe8e0d0, 0.18, 0.7, 0.18, -0.42, 0.3, 0), part('cone', 0xe8e0d0, 0.18, 0.7, 0.18, 0.42, 0.3, 0));
    E.boss = 1; E.lieut = 1; return E;
  }
  const map = { L: { melee: 'ghoul', ranged: 'acolyte' }, M: { melee: 'grunt', ranged: 'headhunter' }, R: { melee: 'myrmidon', ranged: 'siren' } }[th];
  const b = map && map[base]; if (!b) return null;
  return th === 'L' ? buildUndead(b, 1) : th === 'M' ? buildOrc(b, 1) : buildNaga(b, 1);
}
function buildMinion(sub, team) {
  if (team === 1 && sub.includes('_')) { const [b0, th] = sub.split('_'); const E = buildEnemyMinion(b0, th); if (E) return E; sub = b0; }
  const col = TEAMC[team], dark = team ? 0x5a1018 : 0x14306a;
  if (sub === 'siege') {
    const g = grp(part('box', 0x6a4a2a, 1.8, 0.7, 2.6, 0, 0.9, 0), part('box', col, 1.9, 0.12, 2.7, 0, 1.3, 0));
    for (const [x, z] of [[1, 0.9], [-1, 0.9], [1, -0.9], [-1, -0.9]]) { const w = part('cyl', 0x3a2a1a, 0.95, 0.25, 0.95, x, 0.48, z); w.rotation.z = Math.PI / 2; g.add(w); }
    const arm = grp(part('box', 0x5a3a20, 0.25, 2.2, 0.25, 0, 1.1, 0), part('hemi', 0x4a4a4a, 0.6, 0.4, 0.6, 0, 2.2, 0)); arm.position.set(0, 1.3, -0.6); arm.rotation.x = -0.6; g.add(arm);
    return { g, body: g, h: 2.8, arm };
  }
  const R = rig({ legs: dark, torso: col, arms: col, hands: 0xd8b090, belt: 0x4a3018, boots: 0x2a2018, skin: 0xd8b090, tw: 0.85, eyes: 0x101010 });
  R.head.add(part('hemi', team ? 0x5a1a1a : 0x6a7890, 0.66, 0.5, 0.66, 0, 0.08, 0, { m: 0.6, r: 0.4 }));
  if (sub === 'ranged') { R.body.add(skirt(1.3, col, 1, R.hip * 0.6, {})); const st = grp(part('cyl6', 0x5a3a20, 0.07, 1.8, 0.07, 0, 0.3, 0), part('sph', team ? 0xff7a4a : 0x7ac8ff, 0.32, 0.32, 0.32, 0, 1.25, 0, { e: team ? 0xa02a10 : 0x2a6aa0 })); hold(R.armR, st, 0.25); }
  else { hold(R.armR, weaponSword(0xd0d4dc, 0.8)); const sh = part('box', col, 0.6, 0.75, 0.1, -0.12, -0.6, 0.2); R.armL.add(sh); }
  R.g.scale.setScalar(0.88); R.h = R.top * 0.88 + 0.3; return R;
}
function buildCreep(sub, team, scaleMul, wolfCols) {
  let R; let s0 = scaleMul || 1;
  if (sub.includes('_')) { const [b0, th] = sub.split('_'); sub = b0; if (th === 'L') { const U = buildUndead(b0, s0); if (U) return U; } else if (th === 'R') { const N = buildNaga(b0, s0); if (N) return N; } }
  if (sub === 'wolf') {
    const WC = wolfCols || [0x8c8c94, 0x7c7c84, 0xffc040];
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(part('box', WC[0], 0.8, 0.75, 1.7, 0, 1, 0), part('box', WC[0], 0.6, 0.55, 0.7, 0, 1.25, 1.05), part('box', WC[1], 0.32, 0.3, 0.45, 0, 1.12, 1.55), part('cone4', WC[1], 0.2, 0.32, 0.2, -0.18, 1.6, 1), part('cone4', WC[1], 0.2, 0.32, 0.2, 0.18, 1.6, 1), part('box', WC[1], 0.18, 0.18, 0.8, 0, 1.15, -1.1), part('box', WC[2], 0.08, 0.06, 0.04, -0.15, 1.32, 1.4, { e: WC[2] }), part('box', WC[2], 0.08, 0.06, 0.04, 0.15, 1.32, 1.4, { e: WC[2] }));
    if (wolfCols) for (let k = 0; k < 4; k++) body.add(part('box', 0x1a1418, 0.84, 0.06, 0.12, 0, 0.95, -0.4 + k * 0.28));
    body.children[5].rotation.x = 0.5;
    const legs = [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]].map(([x, z]) => { const l = limb(WC[1], 0.22, 0.75, x, 0.75); l.position.z = z; body.add(l); return l; });
    R = { g, body, legL: legs[0], legR: legs[1], legL2: legs[3], legR2: legs[2], h: 2.1, quad: 1 };
    g.scale.setScalar(s0); R.h *= s0; return R;
  }
  if (sub === 'sapling' || sub === 'toad') {
    const g = grp(part('ico1', sub === 'toad' ? 0x4a6a3a : 0x5a8a3a, 1, 0.8, 1, 0, 0.45, 0), part('cone', 0x3a7a2a, 0.5, 0.7, 0.5, 0, 1.1, 0), part('box', 0xffe04a, 0.1, 0.1, 0.05, -0.16, 0.6, 0.45, { e: 0xa08000 }), part('box', 0xffe04a, 0.1, 0.1, 0.05, 0.16, 0.6, 0.45, { e: 0xa08000 }));
    return { g, body: g, h: 1.6 };
  }
  const L = {
    bandit: { legs: 0x4a3a2a, torso: 0x7a5a3a, arms: 0x6a4a30, skin: 0xd0a080, hood: 0x5a3a2a, wpn: 'dagger', s: 1 },
    archer: { legs: 0x4a3a2a, torso: 0x6a6a3a, arms: 0x5a5a30, skin: 0xd0a080, hood: 0x4a4a2a, wpn: 'bow', s: 0.98 },
    troll: { legs: 0x4a3a2a, torso: 0x5a8a6a, arms: 0x5a8a6a, skin: 0x6a9a7a, tusks: 1, wpn: 'club', s: 1.25 },
    trollshaman: { legs: 0x3a2a3a, torso: 0x4a5a8a, arms: 0x6a9a7a, skin: 0x6a9a7a, tusks: 1, wpn: 'staff', s: 1.15, robe: 0x3a4a7a },
    ogre: { legs: 0x5a4030, torso: 0x8a9a5a, arms: 0x8a9a5a, skin: 0x8a9a5a, round: 1, wpn: 'club', s: 1.6 },
    rockgolem: { legs: 0x6e6a66, torso: 0x7a7470, arms: 0x6e6a66, skin: 0x8a847e, rock: 1, s: 1.6 },
    stalker: { legs: 0x1a1428, torso: 0x221a34, arms: 0x1a1428, skin: 0x2a2038, robe: 0x140e22, eyes: 0xff2a2a, s: 1.3 },
  }[sub] || { legs: 0x4a3a2a, torso: 0x7a6a5a, arms: 0x6a5a4a, skin: 0xd0a080, s: 1 };
  R = rig({ legs: L.legs, torso: L.torso, arms: L.arms, hands: L.skin, skin: L.skin, round: L.round, tw: L.round ? 1.1 : 0.9, eyes: L.eyes || 0x101010, eyesE: L.eyes ? 0xff0000 : 0, armW: L.round || L.rock ? 0.34 : 0.24, belt: L.rock ? null : 0x3a2a1a });
  if (L.hood) R.head.add(part('sph', L.hood, 0.72, 0.72, 0.72, 0, 0.06, -0.06), part('box', 0x2a2018, 0.6, 0.22, 0.1, 0, -0.12, 0.28));
  if (L.tusks) R.head.add(part('cone', 0xf0e8d0, 0.1, 0.32, 0.1, -0.14, -0.2, 0.3), part('cone', 0xf0e8d0, 0.1, 0.32, 0.1, 0.14, -0.2, 0.3), part('box', L.skin, 0.2, 0.3, 0.1, 0, 0.04, 0.33));
  if (L.robe) R.body.add(skirt(1.4, L.robe, 1.1, R.hip * 0.6, {}));
  if (L.rock) { R.body.add(part('ico', 0x8a847e, 0.7, 0.6, 0.6, -0.3, R.hip + 0.9, 0.2), part('ico', 0x5a5650, 0.6, 0.5, 0.6, 0.35, R.hip + 0.5, 0.2), part('sph', 0x6affd0, 0.25, 0.25, 0.1, 0, R.hip + 0.6, 0.3, { e: 0x20a080 })); }
  if (sub === 'stalker') { const w = part('cone', 0x3a2a5a, 1.4, 1.6, 1.4, 0, R.hip * 0.55, 0, { t: 0.55, e: 0x2a1a4a }); R.body.add(w); R.head.add(part('cone', 0x140e22, 0.75, 0.9, 0.75, 0, 0.3, -0.1)); }
  if (L.wpn === 'dagger') hold(R.armR, weaponSword(0xc8c8d0, 0.55));
  else if (L.wpn === 'club') hold(R.armR, grp(part('cyl6', 0x5a3a20, 0.14, 1, 0.14, 0, 0.3, 0), part('ico', 0x6a4a2a, 0.45, 0.8, 0.45, 0, 1, 0)));
  else if (L.wpn === 'staff') hold(R.armR, grp(part('cyl6', 0x4a3020, 0.07, 1.9, 0.07, 0, 0.3, 0), part('sph', 0x7aff6a, 0.32, 0.32, 0.32, 0, 1.3, 0, { e: 0x2a8a1a })), 0.25);
  else if (L.wpn === 'bow') { const bow = part('torusHalf', 0x7a5030, 1.4, 1.4, 2.4, 0, -0.9, 0.25); bow.rotation.set(0, Math.PI / 2, Math.PI / 2); R.armL.add(bow); }
  const s = L.s * s0; R.g.scale.setScalar(s); R.h = R.top * s + 0.3; return R;
}
function buildBoss(sub) {
  let R;
  if (sub === 'treant') {
    R = rig({ legs: 0x3e3438, torso: 0x4a4044, arms: 0x3e3438, skin: null, tw: 1.2, th: 1.4, armW: 0.3, armLen: 1.3, legW: 0.4 });
    R.head.add(part('ico1', 0x3a2a40, 2.6, 2, 2.6, 0, 0.8, 0), part('ico1', 0x4a3050, 1.6, 1.3, 1.6, 0.8, 1.5, 0.3), part('box', 0xc0ff60, 0.16, 0.12, 0.05, -0.22, 0, 0.62, { e: 0x80ff20 }), part('box', 0xc0ff60, 0.16, 0.12, 0.05, 0.22, 0, 0.62, { e: 0x80ff20 }), part('box', 0x5a3d22, 0.8, 0.9, 0.7, 0, -0.1, 0.1));
    R.g.scale.setScalar(2.5);
  } else if (sub === 'ogre') {
    R = buildCreep('ogre', 2, 1.7); R.head.add(part('hemi', 0x6a6a74, 0.7, 0.5, 0.7, 0, 0.12, 0, { m: 0.6 })); R.torso.material = mat(0x7a8a4a); R.body.add(part('box', 0x6a3a2a, 1.4, 0.4, 1.1, 0, R.hip + 0.2, 0));
    R.h = 7.4; return R;
  } else if (sub === 'hydra') {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(part('sph', 0x2a7a7a, 4.2, 2.4, 4.6, 0, 1.3, 0), part('cone', 0x2a6a6a, 1, 2.2, 1, 0, 1.4, -2.6));
    body.children[1].rotation.x = -Math.PI / 2;
    const necks = [];
    for (let i = -1; i <= 1; i++) { const n = new THREE.Group(); n.position.set(i * 1.2, 2, 1.2); n.add(part('cyl', 0x3a8a8a, 0.6, 3.6, 0.6, 0, 1.8, 0), part('sph', 0x4a9a8a, 1.1, 0.85, 1.5, 0, 3.7, 0.3), part('box', 0xffe040, 0.15, 0.12, 0.05, -0.25, 3.85, 0.95, { e: 0xffc000 }), part('box', 0xffe040, 0.15, 0.12, 0.05, 0.25, 3.85, 0.95, { e: 0xffc000 })); n.rotation.z = i * 0.25; body.add(n); necks.push(n); }
    return { g, body, h: 7, necks };
  } else if (sub === 'bogwitch') {
    R = rig({ legs: 0x2a1a2a, torso: 0x3a2a4a, arms: 0x5a7a4a, hands: 0x7a9a6a, skin: 0x7a9a6a, tw: 0.9, eyes: 0xffe040, eyesE: 0xc0a000 });
    R.body.add(skirt(1.8, 0x2a1a3a, 1.4, R.hip * 0.6, {}));
    R.head.add(part('cyl', 0x1a1a2a, 1.4, 0.06, 1.4, 0, 0.22, 0), part('cone', 0x1a1a2a, 0.7, 1.4, 0.7, 0, 0.9, -0.15), part('cone', 0x7a9a6a, 0.12, 0.3, 0.12, 0, -0.05, 0.36));
    R.head.children[3].rotation.x = Math.PI / 2;
    hold(R.armR, grp(part('cyl6', 0x4a3a2a, 0.09, 2.6, 0.09, 0, 0.4, 0), part('sph', 0x9a4aff, 0.5, 0.5, 0.5, 0, 1.8, 0, { e: 0x6a1ad0 })), 0.25);
    R.g.scale.setScalar(2.2);
  } else if (sub === 'golem') {
    R = rig({ legs: 0x5a5e68, torso: 0x6a6e78, tm: { m: 0.6, r: 0.5 }, arms: 0x5a5e68, am: { m: 0.6, r: 0.5 }, pads: 0x7a7e88, skin: 0x7a7e88, tw: 1.4, th: 1.2, armW: 0.42, legW: 0.45, eyes: 0x6affff, eyesE: 0x20c0c0 });
    R.body.add(part('sph', 0x6affff, 0.4, 0.4, 0.2, 0, R.hip + 0.7, 0.32, { e: 0x20c0c0 }));
    R.g.scale.setScalar(2.3);
  } else {
    R = rig({ legs: 0x1a1a22, torso: 0x22222c, tm: { m: 0.7, r: 0.35 }, arms: 0x1a1a22, am: { m: 0.7, r: 0.35 }, pads: 0x2a2a34, boots: 0x111118, skin: 0x2a2a34, tw: 1.05, eyes: 0xff2020, eyesE: 0xff0000 });
    R.head.add(part('box', 0x22222c, 0.7, 0.72, 0.7, 0, 0.04, 0, { m: 0.7 }), part('box', 0xff2020, 0.5, 0.06, 0.05, 0, 0.06, 0.36, { e: 0xff0000 }), part('cone', 0x8a0a10, 0.15, 0.7, 0.15, 0, 0.6, 0));
    R.body.add(part('box', 0x6a0a10, 1, 1.6, 0.06, 0, R.hip + 0.2, -0.34, { e: 0x200004 }));
    hold(R.armR, weaponSword(0xb0b0c0, 2));
    R.g.scale.setScalar(2.3);
  }
  R.h = R.top * R.g.scale.x + 0.6; return R;
}
function buildModel(v, team, wx, wz) {
  const k = v.split('_')[0], sub = v.slice(k.length + 1); let R;
  if (v === 'core') {
    const cc = team ? 0xff3a4a : 0x4a9aff, ce = team ? 0x801020 : 0x1a4a9a;
    const g = grp(part('cyl6', 0x8a8a90, 8, 1, 8, 0, 0.5, 0), part('cyl6', 0x6a6a72, 6, 1.4, 6, 0, 1.7, 0), part('cyl6', 0x9a9aa2, 4.4, 0.6, 4.4, 0, 2.7, 0), part('oct', cc, 3.2, 5.4, 3.2, 0, 6.6, 0, { e: ce, ei: 0.9, m: 0.2, r: 0.3 }));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(part('box', 0x7a7a82, 0.9, 3.6, 0.9, Math.cos(a) * 3.4, 2.8, Math.sin(a) * 3.4), part('oct', cc, 0.5, 0.8, 0.5, Math.cos(a) * 3.4, 5.1, Math.sin(a) * 3.4, { e: ce })); }
    const ring = part('torus', cc, 5.4, 5.4, 5.4, 0, 6.4, 0, { e: ce }); ring.rotation.x = Math.PI / 2; g.add(ring);
    R = { g, body: g, h: 11, spin: g.children[3], ring, static: 1 };
  } else if (v === 'tower' || v === 'turret') {
    const sc = v === 'turret' ? 0.72 : 1, cc = team ? 0xff5a6a : 0x6ab0ff, roof = team ? 0x7a2030 : 0x2a4a8a;
    const g = grp(part('cyl6', 0x8a8478, 3.6, 1, 3.6, 0, 0.5, 0), part('cyl6', 0x9a9488, 2.8, 6.4, 2.8, 0, 4, 0), part('cyl6', 0x6a645a, 3.6, 0.7, 3.6, 0, 7.4, 0), part('cone6', roof, 3.8, 2.6, 3.8, 0, 9, 0), part('oct', cc, 0.9, 1.4, 0.9, 0, 11.1, 0, { e: team ? 0x801020 : 0x1a4a9a }));
    for (let a = 0; a < 6.28; a += 1.047) g.add(part('box', 0x2a2a30, 0.4, 0.7, 0.1, Math.cos(a) * 1.42, 5, Math.sin(a) * 1.42));
    g.add(part('box', team ? 0xb02a3a : 0x2a5ab0, 0.06, 2.2, 1.2, 1.45, 5.6, 0)); g.scale.setScalar(sc);
    R = { g, body: g, h: 12 * sc, spin: g.children[4], static: 1 };
  } else if (v === 'gate') {
    const tc = team ? 0xa02a3a : 0x2a5ab0, g = new THREE.Group();
    for (const sx of [-1, 1]) { g.add(part('box', 0x8a8478, 1.8, 6.4, 2.6, sx * 4.4, 3.2, 0), part('box', 0x6a645a, 2.3, 0.6, 3, sx * 4.4, 6.6, 0), part('cone4', tc, 2.2, 1.6, 2.2, sx * 4.4, 7.7, 0)); }
    g.add(part('box', 0x6a645a, 10.6, 1.2, 2.4, 0, 6.8, 0));
    for (const sx of [-1, 1]) { const door = grp(part('box', 0x5a3a22, 3.4, 5.4, 0.5, 0, 0, 0), part('box', 0x2a2a30, 3.5, 0.3, 0.6, 0, 1.6, 0, { m: 0.7 }), part('box', 0x2a2a30, 3.5, 0.3, 0.6, 0, -1.6, 0, { m: 0.7 }), part('sph', 0xc0a050, 0.3, 0.3, 0.3, -sx * 1.3, 0, 0.3, { m: 0.8 })); door.position.set(sx * 1.75, 2.7, 0); g.add(door); }
    g.add(part('box', tc, 0.08, 2.4, 1.6, 0, 4.6, 1.3, { e: team ? 0x300008 : 0x08142e }));
    R = { g, body: g, h: 8.5, static: 1 };
  } else if (v === 'wall') {
    const g = grp(part('box', 0x8a8478, 9.4, 3.4, 1.8, 0, 1.7, 0), part('box', 0x7a746a, 9.6, 0.4, 2, 0, 3.5, 0));
    for (let i = -4; i <= 4; i += 1.6) g.add(part('box', 0x8a8478, 0.9, 0.8, 2, i, 4.1, 0));
    for (let i = -4; i <= 4; i += 2) g.add(part('box', 0x6a645a, 1.4, 0.5, 1.9, i + (i % 4 ? 0.6 : 0), 0.8 + (i % 3) * 0.4, 0.02));
    R = { g, body: g, h: 5, static: 1 };
  } else if (v === 'town') {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.5, r = 5.2, big = i % 2; const hs = grp(part('box', big ? 0xc8b090 : 0xb8a080, 2.4, big ? 2.4 : 1.9, 2.6, 0, big ? 1.2 : 0.95, 0), part('cone4', big ? 0x8a3a2a : 0x6a4a2a, 2.6, 1.7, 3.6, 0, big ? 3.25 : 2.75, 0), part('box', 0x4a3020, 0.6, 1, 0.08, 0, 0.5, 1.31), part('box', 0xffd890, 0.45, 0.45, 0.06, 0.7, 1.3, 1.31, { e: 0x604010 }));
      hs.children[1].rotation.y = Math.PI / 4; hs.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); hs.rotation.y = -a - Math.PI / 2; if (wx !== undefined && DW.laneDist(wx + Math.cos(a) * r, wz + Math.sin(a) * r) < 5.5) continue; g.add(hs); }
    g.add(part('cyl6', 0x8a8478, 1.6, 0.9, 1.6, 0, 0.45, 0), part('cyl6', 0x2a5a8a, 1.2, 0.1, 1.2, 0, 0.92, 0), part('cyl6', 0x5a3d22, 0.2, 7, 0.2, 0, 3.5, 0));
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide, roughness: 0.9 }); const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), flagMat); flag.position.set(1.2, 6.2, 0); flag.castShadow = true; g.add(flag);
    const torch = part('sph', 0xffb040, 0.55, 0.55, 0.55, 0, 7.2, 0, { e: 0xff8a20 }); g.add(torch);
    const fort = new THREE.Group();
    for (let a = 0; a < 6.283; a += 0.13) { const px = Math.cos(a) * 13, pz = Math.sin(a) * 13; if (wx !== undefined && DW.laneDist(wx + px, wz + pz) < 6.5) continue; const post = part('cyl6', 0x6a4a2a, 0.75, 4 + Math.sin(a * 9) * 0.3, 0.75, px, 2, pz); fort.add(post, part('cone6', 0x5a3a20, 0.75, 0.8, 0.75, px, 4.4, pz)); }
    if (wx !== undefined) for (const sgn of [-1, 1]) { const gz = sgn * 13; let gx = 0; for (let x = -12; x <= 12; x += 0.5) if (DW.laneDist(wx + x, wz + gz) < 1) { gx = x; break; }
      for (const side of [-1, 1]) { const tw = sgn < 0 ? grp(part('box', 0x7a5a3a, 1.6, 5.6, 1.6, 0, 2.8, 0), part('box', 0x5a3a20, 2.3, 0.35, 2.3, 0, 5.7, 0), part('cone4', 0x2a4a8a, 2.6, 1.6, 2.6, 0, 6.7, 0), part('box', 0x2f6ad8, 0.06, 1.5, 0.9, 0.85, 4.4, 0)) : grp(part('cyl6', 0x6a4a2a, 0.9, 4.6, 0.9, 0, 2.3, 0), part('cone6', 0x5a3a20, 1, 0.9, 1, 0, 5, 0)); if (sgn < 0) tw.children[2].rotation.y = Math.PI / 4; tw.position.set(gx + side * 6.5, 0, gz); fort.add(tw); } }
    g.add(fort);
    R = { g, body: g, h: 8, flag: flagMat, flagMesh: flag, static: 1, fort };
  } else if (k === 'h') R = buildHero(sub, team);
  else if (k === 'ma' || k === 'me') R = buildMinion(sub, k === 'me' ? 1 : 0);
  else if (k === 'c') R = buildCreep(sub, team);
  else if (k === 'stalker') R = buildCreep('stalker', 1);
  else if (k === 'b') { R = buildBoss(sub); R.boss = 1; }
  else if (v === 'merc' || v === 'garrison') {
    R = rig({ legs: 0x4a4a52, torso: 0x5a6a7a, tm: { m: 0.5, r: 0.4 }, arms: 0x4a5a6a, pads: 0x2f6ad8, belt: 0x5a3a20, boots: 0x2a2a30, skin: 0xd0a080, eyes: 0x101010 });
    R.head.add(part('hemi', 0x7a8a9a, 0.68, 0.55, 0.68, 0, 0.08, 0, { m: 0.6 })); if (v === 'garrison') { R.body.add(part('box', 0x2f6ad8, 0.75, 0.9, 0.06, 0, R.hip + 0.45, 0.29)); hold(R.armR, grp(part('cyl6', 0x5a3a20, 0.08, 2.6, 0.08, 0, 0.6, 0), part('cone4', 0xd8dce4, 0.2, 0.5, 0.2, 0, 2, 0, { m: 0.8 }))); } else hold(R.armR, weaponSword(0xd8dce4, 1)); R.armL.add(part('cyl', 0x6a5a3a, 0.9, 0.14, 0.9, -0.1, -0.6, 0.15));
    R.armL.children[R.armL.children.length - 1].rotation.z = Math.PI / 2; R.g.scale.setScalar(1.05); R.h = R.top * 1.05 + 0.3;
  } else if (v === 'ward') {
    const g = grp(part('box', 0x6a4a2a, 0.3, 6, 0.3, -0.8, 3, -0.8), part('box', 0x6a4a2a, 0.3, 6, 0.3, 0.8, 3, 0.8), part('box', 0x6a4a2a, 0.3, 6, 0.3, -0.8, 3, 0.8), part('box', 0x6a4a2a, 0.3, 6, 0.3, 0.8, 3, -0.8), part('box', 0x8a6a3a, 2.4, 0.3, 2.4, 0, 6, 0), part('cone4', 0x5a3a2a, 2.8, 1.4, 2.8, 0, 7.6, 0), part('sph', 0x9fe0ff, 0.6, 0.6, 0.6, 0, 6.6, 0, { e: 0x4aa0ff }));
    g.children[5].rotation.y = Math.PI / 4; R = { g, body: g, h: 8, static: 1 };
  } else if (v === 'healpack') {
    const g = grp(part('cyl6', 0x9a9aa0, 1.8, 0.4, 1.8, 0, 0.2, 0), part('oct', 0x6aff8a, 0.9, 1.4, 0.9, 0, 1.6, 0, { e: 0x2ac04a, ei: 0.9 })); R = { g, body: g, h: 2.6, spin: g.children[1], heal: g.children[1], static: 1 };
  } else if (k === 'e') {
    let g;
    if (sub === 'chest') g = grp(part('box', 0x8a5a2a, 1.6, 1, 1.1, 0, 0.5, 0), part('box', 0xd0a030, 1.7, 0.2, 1.2, 0, 1.05, 0, { m: 0.7, r: 0.3, e: 0x604010, ei: 0.4 }), part('box', 0xd0a030, 0.25, 0.35, 0.06, 0, 0.75, 0.57, { m: 0.7 }));
    else if (sub === 'shrine') g = grp(part('cyl6', 0xb0b0b8, 2.4, 0.5, 2.4, 0, 0.25, 0), part('box', 0xc8c8d0, 0.7, 3, 0.7, 0, 1.8, 0), part('oct', 0x7af0ff, 0.9, 1.2, 0.9, 0, 3.9, 0, { e: 0x30a0c0 }));
    else if (sub === 'merchant') { g = grp(part('box', 0x8a6a3a, 2.4, 1, 1.6, 0, 1, 0), part('cone4', 0xd0a040, 2.8, 1.4, 2, 0, 2.2, 0)); for (const [x, z] of [[1, 0.9], [-1, 0.9]]) { const w = part('cyl', 0x3a2a1a, 1, 0.25, 1, x, 0.5, z); w.rotation.x = Math.PI / 2; g.add(w); } const mr = rig({ legs: 0x4a3a5a, torso: 0x8a4aa0, arms: 0x8a4aa0, skin: 0xe0b890, eyes: 0x101010 }); mr.head.add(part('cone', 0x6a2a8a, 0.7, 0.7, 0.7, 0, 0.45, 0)); mr.g.position.set(1.9, 0, 0.4); mr.g.scale.setScalar(0.9); g.add(mr.g); }
    else g = grp(part('ico1', 0x3a6a2a, 2.2, 1.3, 2.2, 0, 0.5, 0), part('ico1', 0x2a5a1a, 1.5, 1.1, 1.5, 1.1, 0.5, 0.6));
    R = { g, body: g, h: 2.8, static: 1 };
  } else if (k === 'loot') {
    const card = sub === 'card', rr = card ? 5 : +sub, col = new THREE.Color(DW.RARITY[rr].col).getHex();
    const g = grp(card ? part('box', 0xffd84a, 0.9, 0.06, 1.3, 0, 0.7, 0, { e: 0xa07a10 }) : part('ico1', 0x8a6a3a, 0.8, 0.7, 0.8, 0, 0.4, 0), new THREE.Mesh(geo.cyl, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: rr >= 3 || card ? 0.45 : 0.22, depthWrite: false })));
    const beam = g.children[1]; beam.scale.set(0.35, rr >= 3 || card ? 9 : 3.5, 0.35); beam.position.y = beam.scale.y / 2;
    R = { g, body: g, h: 1.2, spin: g.children[0], static: 1, loot: 1 };
  } else R = { g: grp(part('sph', 0xff00ff, 1, 1, 1, 0, 1, 0)), h: 2 };
  if (!R.body) R.body = R.g;
  if (!R.atkStyle && /ranged|shaman|archer|siren|acolyte/.test(v)) R.atkStyle = /archer/.test(v) ? 'bow' : 'cast';
  // night-fury ring + stun stars
  const nf = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.85, depthWrite: false })); nf.rotation.x = -Math.PI / 2; nf.position.y = 0.09; nf.visible = false; nf.scale.setScalar(R.boss ? 4 : 1.4);
  const stun = new THREE.Mesh(geo.torus, new THREE.MeshBasicMaterial({ color: 0xffe040 })); stun.rotation.x = Math.PI / 2; stun.position.y = R.h + 0.3; stun.visible = false;
  const holder = new THREE.Group(); holder.add(R.g, nf, stun); R.nf = nf; R.stun = stun; R.root = holder;
  return R;
}
function clearWorld() {
  for (const [, m] of G.meshes) scene.remove(m.root); G.meshes.clear();
  for (const [, m] of G.projMeshes) scene.remove(m); G.projMeshes.clear();
  for (const f of G.fxList) scene.remove(f.obj); G.fxList = [];
}
// ---- effects ----
G.attach = []; G.leaps = new Map();
function addTimed(obj, dur, upd) { scene.add(obj); G.fxList.push({ obj, t0: performance.now(), dur, upd }); upd(0); }
const addM = (c, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: o === undefined ? 1 : o, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
function ringFx(x, z, r, col, dur, grow, y) { const g = new THREE.Group(), ring = new THREE.Mesh(geo.ring, addM(col)), disc = new THREE.Mesh(geo.disc, addM(col, 0.35)); ring.rotation.x = disc.rotation.x = -Math.PI / 2; g.add(ring, disc); g.position.set(x, y || 0.2, z); addTimed(g, dur, p => { g.scale.setScalar(r * ((grow ? 0.25 : 0.7) + p * (grow ? 0.85 : 0.35))); ring.material.opacity = 1 - p; disc.material.opacity = 0.35 * (1 - p); }); }
function columnFx(x, z, r, h, col, dur) { const m = new THREE.Mesh(geo.cyl, addM(col, 0.7)); m.position.set(x, h / 2, z); addTimed(m, dur, p => { m.scale.set(r * (1 - p * 0.6), h * (0.6 + p * 0.4), r * (1 - p * 0.6)); m.material.opacity = 0.7 * (1 - p); }); }
function slashFx(x, z, ang, r, col, dur, full) {
  const g = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r, 32, 1, 0, full ? Math.PI * 2 : Math.PI * 0.9), addM(col, 0.9)); g.rotation.x = -Math.PI / 2; g.position.set(x, 1.2, z);
  addTimed(g, dur, p => { g.rotation.z = -ang - Math.PI * 0.45 + (full ? p * 6.28 : p * 1.6); g.material.opacity = 0.9 * (1 - p); g.scale.setScalar(0.8 + p * 0.3); });
}
function domeFx(id, dur, col, r) { const m = new THREE.Mesh(geo.hemi, new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: false })); m.scale.set(r * 2, r * 1.6, r * 2); G.attach.push({ id, until: performance.now() + dur * 1000, obj: m, upd: (mm, now) => { m.material.opacity = 0.16 + 0.08 * Math.sin(now / 120); m.rotation.y = now / 800; } }); scene.add(m); }
function auraFx(id, dur, col, rate, up) { G.attach.push({ id, until: performance.now() + dur * 1000, upd: (mm, now, dt) => { if (Math.random() < rate * dt * 60) { const a = Math.random() * 6.283, r = 0.6 + Math.random() * 1; emit(mm.root.position.x + Math.cos(a) * r, 0.4 + Math.random() * 2, mm.root.position.z + Math.sin(a) * r, { vy: up || 2.5, c: col, s: 0.6, s1: 0.1, life: 0.8 }); } } }); }
function sigilFx(x, z, r, col, dur) {
  const g = new THREE.Group(); const ring = new THREE.Mesh(geo.ring, addM(col, 0.8)), ring2 = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 48), addM(col, 0.8));
  const star = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 3), addM(col, 0.7)), star2 = star.clone(); star2.rotation.z = Math.PI;
  [ring, ring2, star, star2].forEach(m => { m.rotation.x = -Math.PI / 2; g.add(m); }); g.position.set(x, 0.18, z); g.scale.setScalar(r);
  addTimed(g, dur, p => { g.rotation.y = p * 3; const a = p < 0.1 ? p * 10 : p > 0.85 ? (1 - p) / 0.15 : 1; g.children.forEach(m => m.material.opacity = 0.8 * a); if (Math.random() < 0.5) { const aa = Math.random() * 6.28, rr = Math.random() * r; emit(x + Math.cos(aa) * rr, 0.3, z + Math.sin(aa) * rr, { vy: 2, c: col, s: 0.5, life: 0.9 }); } });
}
function beamFx(x, z, col, h, dur) { const m = new THREE.Mesh(geo.cyl, addM(col, 0.85)); m.position.set(x, h / 2, z); addTimed(m, dur, p => { const w = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8; m.scale.set(1.4 * w + 0.1, h, 1.4 * w + 0.1); m.material.opacity = 0.85 * w; }); burstP(x, 0.4, z, 24, col, 5, 0.8, 0.7, 4, 3); }
function shakeCam(a) { G.shake = Math.max(G.shake || 0, a); }
function flashScreen(col) { const f = $('flash'); f.style.background = col; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function heroPos(id) { const m = G.meshes.get(id); return m ? m.root.position : null; }
function abilityFx(ev) {
  const [, id, hid, k, fx, fz, tx, tz, tg] = ev; const m = G.meshes.get(id), dist = Math.hypot(tx - fx, tz - fz), ang = Math.atan2(tz - fz, tx - fx);
  if (m) m.castT = performance.now();
  const T = G.cur && G.cur.e.find(e => e[0] === tg), tpx = T ? T[3] : tx, tpz = T ? T[4] : tz;
  const key = hid + k;
  switch (key) {
    case 'ironvow0': burstP(tpx, 1.4, tpz, 26, '#cfe0ff', 7, 0.9, 0.45, 2); ringFx(tpx, tpz, 2.2, '#9fc8ff', 0.35, 1, 1); shakeCam(0.25); break;
    case 'ironvow1': ringFx(fx, fz, 10, '#ffd36b', 0.7, 1); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = Math.random() * 9; emit(fx + Math.cos(a) * r, 0.3, fz + Math.sin(a) * r, { vy: 4 + Math.random() * 3, c: '#ffe27a', s: 0.7, life: 0.9 }); } break;
    case 'ironvow2': G.leaps.set(id, { t0: performance.now(), dur: dist / 32, kind: 'charge' }); break;
    case 'ironvow3': domeFx(id, 6, '#ffd36b', 2.6); auraFx(id, 6, '#ffb03a', 0.5, 1.5); ringFx(fx, fz, 4.5, '#ffd36b', 0.5, 1); break;
    case 'emberwitch0': burstP(fx + Math.cos(ang), 2, fz + Math.sin(ang), 10, '#ff8a2a', 4, 0.8, 0.3, 1); break;
    case 'emberwitch1': for (let i = 0; i < 16; i++) emit(tx + (Math.random() - 0.5) * 3, 0.2, tz + (Math.random() - 0.5) * 3, { vy: 1.5, c: '#ff6a1a', s: 0.6, life: 0.8 }); break;
    case 'emberwitch2': burstP(fx, 1.5, fz, 30, '#ff7ad0', 4, 0.8, 0.5, 2); burstP(tx, 1.5, tz, 30, '#ffb0e8', 4, 0.8, 0.6, 2); ringFx(tx, tz, 2.4, '#ff7ad0', 0.4, 1); break;
    case 'emberwitch3': ringFx(tx, tz, 7, '#ff4a10', 3.2, 0); break;
    case 'thornshot1': burstP(fx + Math.cos(ang) * 1.5, 1.8, fz + Math.sin(ang) * 1.5, 14, '#c8ff7a', 5, 0.6, 0.3, 1); break;
    case 'thornshot2': G.leaps.set(id, { t0: performance.now(), dur: dist / 26, kind: 'roll' }); for (let i = 0; i < 12; i++) emit(fx, 0.4, fz, { vx: (Math.random() - 0.5) * 4, vy: 2, vz: (Math.random() - 0.5) * 4, c: '#7aca4a', s: 0.5, life: 0.6, g: 6 }); break;
    case 'thornshot3': ringFx(fx, fz, 3, '#eaff5a', 0.5, 1); shakeCam(0.2); break;
    case 'bloodreaver0': slashFx(fx, fz, 0, 4.6, '#ff3a4a', 0.35, true); burstP(fx, 1.2, fz, 30, '#c0101a', 8, 0.7, 0.5, 1.5, 8); break;
    case 'bloodreaver1': auraFx(id, 5, '#ff2a3a', 0.7, 3); ringFx(fx, fz, 2.4, '#ff3a4a', 0.4, 1); break;
    case 'bloodreaver2': G.leaps.set(id, { t0: performance.now(), dur: Math.max(0.25, dist / 22), kind: 'leap', tx, tz }); break;
    case 'bloodreaver3': auraFx(id, 8, '#ff1a2a', 1.2, 4); columnFx(fx, fz, 2.2, 8, '#ff1a2a', 0.6); flashScreen('rgba(160,0,10,.35)'); break;
    case 'lumen0': beamFx(tx, tz, '#fff1a8', 18, 0.5); break;
    case 'lumen1': break;
    case 'lumen2': sigilFx(tx, tz, 6, '#ffe27a', 4); break;
    case 'lumen3': flashScreen('rgba(255,240,180,.5)'); ringFx(fx, fz, 8, '#fff1a8', 0.8, 1); if (G.cur) G.cur.h.forEach(h => { if (!h.dead) beamFx(h.x, h.z, '#fff1a8', 22, 0.8); }); break;
  }
}
function spawnFx(f) {
  if (f[0] === 'n') {
    G.nums.push({ x: f[1], z: f[2], v: f[3], c: f[4], t: performance.now(), ox: (Math.random() - 0.5) * 24 }); if (G.nums.length > 90) G.nums.shift();
    if (f[4] !== 3 && f[4] !== 5) burstP(f[1], 1.4, f[2], f[4] === 4 ? 10 : 4, f[4] === 1 ? '#c58aff' : f[4] === 4 ? '#ffb02a' : '#fff0c0', 4, 0.35, 0.25, 2, 6);
    else if (f[4] === 3 && f[3] > 30) for (let i = 0; i < 4; i++) emit(f[1] + (Math.random() - 0.5), 0.8, f[2] + (Math.random() - 0.5), { vy: 2.5, c: '#6aff8a', s: 0.5, life: 0.7 });
    return;
  }
  if (f[0] === 'a') return abilityFx(f);
  if (f[0] === 'd') return deathFx(f);
  const [, type, x, z, r, col] = f;
  if (type === 'burst') { ringFx(x, z, r, col, 0.5, 1); burstP(x, 1, z, Math.min(40, 10 + r * 6), col, r * 2.4, 0.9, 0.5, 2.5, 4); }
  else if (type === 'ring') { ringFx(x, z, r, col, 0.55, 0); burstP(x, 0.5, z, 20, col, r * 1.5, 0.6, 0.5, 1.5); }
  else if (type === 'lvl') { ringFx(x, z, 2.5, '#ffe27a', 1, 1); for (let i = 0; i < 40; i++) { const a = i / 40 * 12.56; emit(x + Math.cos(a) * 1.4, 0.2 + i * 0.1, z + Math.sin(a) * 1.4, { vy: 2, c: '#ffe27a', s: 0.6, life: 1 }); } }
  else if (type === 'pillar') { columnFx(x, z, r, 9, col, 0.7); for (let i = 0; i < 30; i++) emit(x + (Math.random() - 0.5) * r * 1.6, 0.3, z + (Math.random() - 0.5) * r * 1.6, { vy: 5 + Math.random() * 5, c: col, s: 0.8, life: 0.8 }); }
  else if (type === 'blink') { columnFx(x, z, r * 0.8, 4, col, 0.35); burstP(x, 1.5, z, 20, col, 3, 0.6, 0.5, 2); }
  else if (type === 'meteor') {
    const m = new THREE.Mesh(geo.sph, addM('#ff8a2a', 1)); addTimed(m, 0.45, p => { m.position.set(x - 8 * (1 - p), 0.6 + 18 * (1 - p), z - 6 * (1 - p)); m.scale.setScalar(1.8); if (Math.random() < 0.9) emit(m.position.x, m.position.y, m.position.z, { c: '#ff6a1a', s: 1.4, life: 0.4 }); });
    setTimeout(() => { ringFx(x, z, r, '#ff4a10', 0.5, 1); burstP(x, 0.5, z, 30, '#ff7a2a', 9, 1, 0.6, 5, 12); shakeCam(0.35); }, 430);
  }
  else if (type === 'capture') { ringFx(x, z, r, '#ffd36b', 1.2, 1); for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, rr = Math.random() * r; emit(x + Math.cos(a) * rr, 0.3, z + Math.sin(a) * rr, { vy: 5 + Math.random() * 6, c: i % 2 ? '#ffd36b' : '#6ab0ff', s: 0.9, life: 1.2 }); } }
  else if (type === 'ruin') { for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28, rr = Math.random() * r; emit(x + Math.cos(a) * rr, 0.5, z + Math.sin(a) * rr, { vy: 3 + Math.random() * 4, c: i % 3 ? '#ff6a2a' : '#5a5a5a', s: 1.6, s1: 2.5, life: 1.6, d: 1 }); } shakeCam(0.4); }
  else if (type === 'spawn') { beamFx(x, z, '#fff1a8', 14, 0.9); }
}
function deathFx(f) {
  const [, v, x, z, face, team, id] = f; const old = G.meshes.get(id);
  if (v === 'tower' || v === 'core' || v === 'turret' || v === 'wall') { for (let i = 0; i < 90; i++) { const a = Math.random() * 6.28; emit(x + Math.cos(a) * 2, 1 + Math.random() * 8, z + Math.sin(a) * 2, { vx: Math.cos(a) * 6, vy: 4 + Math.random() * 6, vz: Math.sin(a) * 6, c: i % 3 ? '#8a847a' : '#ff8a2a', s: 1.5, life: 1.4, g: 9 }); } shakeCam(0.7); return; }
  if (!old || old.static) { burstP(x, 1, z, 12, '#d8d0c0', 3, 0.7, 0.6, 1); return; }
  G.meshes.delete(id); const root = old.root; old.nf.visible = false; old.stun.visible = false;
  const axis = Math.random() < 0.5 ? 1 : -1;
  G.fxList.push({ obj: root, t0: performance.now(), dur: 1.6, keep: true, upd: p => {
    const fall = Math.min(1, p / 0.3); old.g.rotation.x = axis * fall * (Math.PI / 2) * 0.95; old.body.position.y = 0;
    root.position.y = -Math.max(0, p - 0.55) * 2.2;
    if (p > 0.6) root.traverse(o => { if (o.material && !o.material.userData.fade) { o.material = o.material.clone(); o.material.transparent = true; o.material.userData.fade = 1; } if (o.material && o.material.userData.fade) o.material.opacity = Math.max(0, 1 - (p - 0.6) / 0.4); });
  } });
  burstP(x, 0.6, z, 14, team === 1 ? '#a0303a' : '#a09080', 3, 0.9, 0.7, 1, 3);
}
const PSTY = { a: 'arrow', A: 'arrow', M: 'arrow', f: 'fire', F: 'fire', h: 'holy', b: 'bolt', o: 'orb', g: 'orb', v: 'orb', p: 'orb', r: 'rock', S: 'spear', w: 'orb', m: 'meat' };
const PCOL = { g: '#7aff6a', w: '#5ac8ff', p: '#b06bff', v: '#5ac8ff' };
function projMesh(st, col, size) {
  const kind = PSTY[st] || 'orb'; let m; col = PCOL[st] || col;
  if (kind === 'spear') { m = grp(part('cyl6', 0x6a4a2a, 0.07, 2, 0.07, 0, 0, 0), part('cone4', 0xd0d0d8, 0.16, 0.45, 0.16, 0, 1.1, 0, { m: 0.8 })); m.children.forEach(c => { c.rotation.x = Math.PI / 2; c.position.z = c.position.y; c.position.y = 0; }); m.userData.kind = 'arrow'; m.userData.st = 'a'; m.userData.col = col; return m; }
  if (kind === 'meat') { m = part('ico', 0xc07a7a, 0.9, 0.8, 0.9); m.userData.kind = 'rock'; m.userData.st = st; m.userData.col = '#c07a7a'; return m; }
  if (kind === 'arrow') { const big = st === 'M' ? 2.2 : st === 'A' ? 1.3 : 1; m = grp(part('box', 0x8a6a3a, 0.08 * big, 0.08 * big, 1.4 * big, 0, 0, 0), part('cone4', 0xdde4f0, 0.2 * big, 0.4 * big, 0.2 * big, 0, 0, 0.8 * big, { m: 0.8 }), part('box', 0xffffff, 0.3 * big, 0.02, 0.3 * big, 0, 0, -0.6 * big)); m.children[1].rotation.x = Math.PI / 2; if (st !== 'a') m.add(new THREE.Mesh(geo.sph, addM(col, 0.6))), m.children[3].scale.setScalar(0.5 * big); }
  else if (kind === 'rock') m = part('ico', 0x6a5a4a, 0.8, 0.8, 0.8);
  else if (kind === 'bolt') { m = grp(new THREE.Mesh(geo.sph, addM(col, 1)), new THREE.Mesh(geo.sph, addM('#ffffff', 0.9))); m.children[0].scale.set(0.9, 0.9, 2.2); m.children[1].scale.setScalar(0.45); }
  else { m = grp(new THREE.Mesh(geo.sph, addM(col, 0.95)), new THREE.Mesh(geo.sph, addM('#ffffff', 0.9))); m.children[0].scale.setScalar(size * 2.4); m.children[1].scale.setScalar(size * 1.1); }
  m.userData.kind = kind; m.userData.st = st; m.userData.col = col; return m;
}

// ============================ CONTROLS ============================
const AOE = { ironvow: [0, 10, 2.6, 4.5], emberwitch: [2.6, 3.5, 1.2, 7], thornshot: [1, 0, 1.2, 1.6], bloodreaver: [4.5, 0, 3.6, 0], lumen: [3.5, 12, 6, 8] };
const J = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false, lastSent: 0, lastAng: null };
function screenToWorld(sx, sy) {
  const ndc = new THREE.Vector2(sx / window.innerWidth * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera); const p = new THREE.Vector3(); return raycaster.ray.intersectPlane(groundPlane, p) ? p : null;
}
function worldToScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, v.z]; }
function pickUnit(sx, sy) {
  if (!G.cur) return null; let best = null, bd = 44 * 44;
  for (const e of G.cur.e) {
    if (e[8] & 8 || e[2] === 0) continue; const m = G.meshes.get(e[0]); if (!m) continue;
    const s = worldToScreen(m.root.position.x, m.h * 0.5, m.root.position.z); const big = m.boss || m.static ? 3 : 1;
    const dd = ((s[0] - sx) ** 2 + (s[1] - sy) ** 2) / big; if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}
// ---- joystick ----
function joyStart(id, x, y) { J.id = id; J.ox = x; J.oy = y; J.x = x; J.y = y; J.active = true; const b = $('joy'); b.classList.add('on'); b.style.left = x + 'px'; b.style.top = y + 'px'; $('joyKnob').style.transform = 'translate(-50%,-50%)'; }
function joyMove(x, y) {
  const R = 52 * uiScale(); let dx = x - J.ox, dy = y - J.oy; const l = Math.hypot(dx, dy);
  if (l > R) { J.ox += dx / l * (l - R); J.oy += dy / l * (l - R); dx = x - J.ox; dy = y - J.oy; $('joy').style.left = J.ox + 'px'; $('joy').style.top = J.oy + 'px'; }
  $('joyKnob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  J.x = x; J.y = y; joySend(dx, dy, Math.hypot(dx, dy));
}
function joySend(dx, dy, l) {
  const now = performance.now();
  if (l < 9) { if (J.lastAng !== null) { send({ c: 'dir', x: 0, z: 0 }); J.lastAng = null; } return; }
  const ang = Math.atan2(dy, dx); let da = J.lastAng === null ? 9 : Math.abs(Math.atan2(Math.sin(ang - J.lastAng), Math.cos(ang - J.lastAng)));
  if (da > 0.1 || (da > 0.02 && now - J.lastSent > 120)) { J.lastAng = ang; J.lastSent = now; send({ c: 'dir', x: Math.round(Math.cos(ang) * 100) / 100, z: Math.round(Math.sin(ang) * 100) / 100 }); }
}
function joyEnd() { if (!J.active) return; J.active = false; J.id = null; $('joy').classList.remove('on'); $('joyKnob').style.transform = 'translate(-50%,-50%)'; if (J.lastAng !== null) send({ c: 'dir', x: 0, z: 0 }); J.lastAng = null; }
const uiScale = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
// ---- ability aim ----
function abInfo(k) { const H = DW.HEROES[G.me.hid]; return { ab: H.ab[k], aoe: (AOE[G.me.hid] || [])[k] || 0 }; }
function startAim(k, btn, e) {
  if (!G.me || G.me.dead) return; const { ab } = abInfo(k);
  const r = btn.getBoundingClientRect();
  G.aim = { k, id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, t0: performance.now(), moved: false, dx: 0, dy: 0, ratio: 0, cancel: false, tip: false, btn };
  G.aim.tipT = setTimeout(() => { if (G.aim && !G.aim.moved) { G.aim.tip = true; showAbTip(k, btn); } }, 420);
}
function moveAim(e) {
  const A = G.aim; if (!A || e.pointerId !== A.id) return;
  const dx = e.clientX - A.cx, dy = e.clientY - A.cy, l = Math.hypot(dx, dy);
  const DZ = 26 * uiScale();
  if (!A.moved && l > DZ) { A.moved = true; clearTimeout(A.tipT); hideAbTip(); A.btn.classList.add('aimingAb'); }
  if (!A.moved) return;
  A.cancel = l < DZ; A.btn.classList.toggle('cancelling', A.cancel);
  if (!A.cancel) { A.dx = dx; A.dy = dy; A.ratio = Math.min(1, (l - DZ) / (90 * uiScale())); }
}
function aimPoint(A) {
  A = A || G.aim; const me = G.me; const { ab } = abInfo(A.k); const l = Math.hypot(A.dx, A.dy) || 1, ux = A.dx / l, uz = A.dy / l;
  const range = ab.range || 6; const d = ab.t === 'dir' ? range : Math.max(1.5, range * A.ratio * (ab.t === 'point' ? 1.6 : 1));
  const m = G.meshes.get(G.myHeroId), hx = m ? m.root.position.x : me.x, hz = m ? m.root.position.z : me.z;
  return { x: hx + ux * d, z: hz + uz * d, hx, hz, ux, uz, range };
}
function endAim(e) {
  const A = G.aim; if (!A || (e && e.pointerId !== A.id)) return; clearTimeout(A.tipT); A.btn.classList.remove('aimingAb', 'cancelling');
  G.aim = null;
  if (A.tip) return; // tooltip shown: no cast
  const k = A.k, { ab } = abInfo(k);
  if (!G.me.rk[k]) { shake(A.btn); hint('Learn ' + ab.n + ' first — tap the +'); return; }
  if (G.me.cd[k] > 0) { shake(A.btn); return; }
  if (A.cancel) { hint('Cancelled'); return; }
  if (!A.moved || ab.t === 'self') { send({ c: 'cast', k, auto: 1, x: G.me.x, z: G.me.z }); pulse(A.btn); return; }
  const p = aimPoint(A); let id;
  if (ab.t === 'unit') { let best = 1e9; for (const e2 of G.cur.e) { if (e2[2] === 0 || e2[8] & 8) continue; const dd = (e2[3] - p.x) ** 2 + (e2[4] - p.z) ** 2; if (dd < best && dd < 16) { best = dd; id = e2[0]; } } }
  send({ c: 'cast', k, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, id }); pulse(A.btn);
}
function cancelAim() { if (G.aim) { clearTimeout(G.aim.tipT); G.aim.btn.classList.remove('aimingAb', 'cancelling'); G.aim = null; } }
function shake(b) { if (!b) return; b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }
function hint(t) { const h = $('hint'); h.textContent = t; h.classList.remove('show'); void h.offsetWidth; h.classList.add('show'); }
function pulse(b) { if (!b) return; b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire'); }
function showAbTip(k, btn) {
  if (!G.me) return; const H = DW.HEROES[G.me.hid], ab = H.ab[k], r = G.me.rk[k];
  const cd = Array.isArray(ab.cd) ? ab.cd.join(' / ') : ab.cd, cost = Array.isArray(ab.cost) ? ab.cost.join(' / ') : ab.cost;
  $('abTip').innerHTML = `<div class="tipHead"><div class="tipIcon">${window.BOD_ICONS.ability(G.me.hid, k)}</div><div><b>${ab.n}</b><small>${ab.ult ? 'Ultimate · ' : ''}Rank ${r}/${ab.ult ? 3 : 5}</small></div></div><p>${ab.d}</p><small>Cooldown ${cd}s · Cost ${cost || 0} ${H.res.type}${ab.range ? ' · Range ' + ab.range : ''}</small><small class="muted">Tap anywhere to close</small>`;
  $('abTip').classList.remove('hidden'); G.tipOpen = performance.now();
}
function hideAbTip() { $('abTip').classList.add('hidden'); G.tipOpen = 0; }
// ---- input binding ----
function bindInput() {
  const cv = renderer.domElement; cv.style.touchAction = 'none';
  document.addEventListener('contextmenu', e => { if (G.running) e.preventDefault(); });
  // global: dismiss tooltip on any tap outside it
  document.addEventListener('pointerdown', e => { if (G.tipOpen && performance.now() - G.tipOpen > 120 && !$('abTip').contains(e.target)) hideAbTip(); }, true);
  cv.addEventListener('pointerdown', e => {
    if (G.intro) return;
    if (!G.running) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 2) { const w = screenToWorld(e.clientX, e.clientY); const u = pickUnit(e.clientX, e.clientY); if (u) send({ c: 'atk', id: u[0] }); else if (w) send({ c: 'move', x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10 }); return; }
      const u = pickUnit(e.clientX, e.clientY); if (u) { send({ c: 'atk', id: u[0] }); return; }
      const w = screenToWorld(e.clientX, e.clientY); if (w) send({ c: 'move', x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10 }); return;
    }
    if (e.clientX < window.innerWidth * 0.5 && !J.active) { try { cv.setPointerCapture(e.pointerId); } catch (er) { } joyStart(e.pointerId, e.clientX, e.clientY); return; }
    if (!G.look) { try { cv.setPointerCapture(e.pointerId); } catch (er) { } G.look = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false }; }
  });
  cv.addEventListener('pointermove', e => {
    G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.mouse.in = true; const w = screenToWorld(e.clientX, e.clientY); if (w) { G.mouse.wx = w.x; G.mouse.wz = w.z; }
    if (J.active && e.pointerId === J.id) joyMove(e.clientX, e.clientY);
    const Lk = G.look; if (Lk && e.pointerId === Lk.id) {
      if (!Lk.moved && Math.hypot(e.clientX - Lk.sx, e.clientY - Lk.sy) > 14) { Lk.moved = true; G.panning = true; G.panX = G.camX; G.panZ = G.camZ - 4; }
      if (Lk.moved) { const a = screenToWorld(Lk.x, Lk.y), b = screenToWorld(e.clientX, e.clientY); if (a && b) { G.panX = Math.max(-DW.MAP.W, Math.min(DW.MAP.W, G.panX - (b.x - a.x))); G.panZ = Math.max(-DW.MAP.H, Math.min(DW.MAP.H, G.panZ - (b.z - a.z))); } }
      Lk.x = e.clientX; Lk.y = e.clientY;
    }
  });
  const up = e => {
    if (J.active && e.pointerId === J.id) joyEnd();
    const Lk = G.look; if (Lk && e.pointerId === Lk.id) { G.look = null; if (Lk.moved) G.panning = false; else { const u = pickUnit(e.clientX, e.clientY); if (u) { G.lock = u[0]; send({ c: 'atk', id: u[0] }); } } }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { G.zoom = Math.max(0.75, Math.min(1.6, G.zoom * (e.deltaY > 0 ? 1.08 : 0.93))); e.preventDefault(); }, { passive: false });
  window.addEventListener('pointermove', moveAim); window.addEventListener('pointerup', endAim); window.addEventListener('pointercancel', () => cancelAim());
  // keyboard (desktop)
  const keys = new Set();
  const keyDir = () => { const x = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), z = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0); send({ c: 'dir', x, z }); };
  window.addEventListener('keydown', e => {
    if (!G.running || document.activeElement.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if ('wasd'.includes(k) && k.length === 1 && !e.repeat) { keys.add(k); keyDir(); return; }
    const ai = 'qert'.indexOf(k) >= 0 ? 'qer'.indexOf(k) : -1; const map = { '1': 0, '2': 1, '3': 2, '4': 3, q: 0, e: 1, r: 2, f: 3 };
    if (k in map && !e.repeat) { const i = map[k]; if (e.shiftKey) { send({ c: 'lvl', k: i }); return; } const ab = DW.HEROES[G.me.hid].ab[i]; if (ab.t === 'self' || !G.mouse.in) send({ c: 'cast', k: i, auto: 1 }); else send({ c: 'cast', k: i, x: Math.round(G.mouse.wx * 10) / 10, z: Math.round(G.mouse.wz * 10) / 10, id: (pickUnit(G.mouse.x, G.mouse.y) || [])[0] }); return; }
    if (k === ' ') { if (!e.repeat) send({ c: 'atk', hold: 1 }); e.preventDefault(); }
    else if (k === 'b') openShop(); else if (k === 'i' || k === 'enter') interact(); else if (k === 'h') send({ c: 'potion' }); else if (k === 'g') openTowns(); else if (k === 'x') send({ c: 'stop' });
    else if (k === 'tab') { e.preventDefault(); openStats(); } else if (k === 'escape') { cancelAim(); closeModal(); hideAbTip(); }
    else if (k === 'backspace') pressRecall();
  });
  window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === ' ' && G.running) send({ c: 'atkEnd' }); if (keys.has(k)) { keys.delete(k); keyDir(); } });
  window.addEventListener('blur', () => { keys.clear(); joyEnd(); });
  // minimap: hold to pan camera
  const miniPos = e => { const r = mini.getBoundingClientRect(); return [((e.clientX - r.left) / r.width * 2 - 1) * DW.MAP.W, ((e.clientY - r.top) / r.height * 2 - 1) * DW.MAP.H]; };
  mini.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); const [x, z] = miniPos(e); if (e.button === 2) { send({ c: 'move', x, z }); return; } G.panning = true; G.panX = x; G.panZ = z; mini.setPointerCapture(e.pointerId); });
  mini.addEventListener('pointermove', e => { if (!G.panning) return; const [x, z] = miniPos(e); G.panX = x; G.panZ = z; });
  const mup = () => { G.panning = false; }; mini.addEventListener('pointerup', mup); mini.addEventListener('pointercancel', mup);
  // HUD buttons
  document.querySelectorAll('.ab').forEach((b, i) => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startAim(i, b, e); });
    b.addEventListener('mouseenter', () => { if (!MOBILE) showAbTip(i, b); }); b.addEventListener('mouseleave', () => { if (!MOBILE) hideAbTip(); });
  });
  document.querySelectorAll('.lvlup').forEach((b, i) => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); send({ c: 'lvl', k: i }); pulse(b); }));
  let atkHold = null;
  $('btnAtk').addEventListener('pointerdown', e => { e.preventDefault(); send({ c: 'atk', hold: 1, id: G.lock || undefined }); pulse($('btnAtk')); $('btnAtk').classList.add('held'); clearInterval(atkHold); atkHold = setInterval(() => send({ c: 'atk', hold: 1, keep: 1 }), 400); });
  const atkUp = () => { if (!atkHold) return; clearInterval(atkHold); atkHold = null; $('btnAtk').classList.remove('held'); send({ c: 'atkEnd' }); }; $('btnAtk').addEventListener('pointerup', atkUp); $('btnAtk').addEventListener('pointercancel', atkUp); $('btnAtk').addEventListener('pointerleave', atkUp);
  $('attrBtn').onclick = () => send({ c: 'lvl', k: 4 });
  $('btnPot').onclick = () => send({ c: 'potion' });
  $('btnInteract').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); interact(); });
  $('btnRecall').onclick = pressRecall;
  $('btnShop').onclick = openShop; $('btnTowns').onclick = openTowns; $('btnStats').onclick = openStats; $('hPortrait').onclick = openHero;
  $('inv').onclick = () => { G.shopTab = 'inv'; renderShop(); };
  $('introSkip').onclick = introEnd;
  $('btnMenu').onclick = () => openModal('<h2>Menu</h2><p class="muted"><b>Touch:</b> left thumb anywhere on the left half = joystick · Attack button auto-targets (hold to keep attacking) · drag an ability to aim, tap it to quick-cast, drag onto ✕ to cancel · hold an ability for its tooltip · hold the minimap to look around.<br><b>Keyboard:</b> WASD move · Space attack · Q E R F abilities at the cursor (Shift+key to level) · B shop · G council · H potion · Backspace recall · Tab stats.</p><div class="row"><button class="btn" id="mResume">Resume</button><button class="btn danger" id="mQuit">Leave Match</button></div>', () => { $('mResume').onclick = closeModal; $('mQuit').onclick = () => { closeModal(); quitGame(); }; });
  $('modalBg').addEventListener('pointerdown', e => { if (e.target === $('modalBg')) closeModal(); });
}
function buildHUD() {
  const me = G.players && G.players.find(p => p.pid === myPid); const hid = me && DW.HEROES[me.hero] ? me.hero : (G.me && G.me.hid) || 'ironvow';
  G.hudHero = hid;
  document.querySelectorAll('.ab').forEach((b, i) => { b.querySelector('.abIcon').innerHTML = window.BOD_ICONS.ability(hid, i); b.querySelector('.abKey').textContent = MOBILE ? '' : ['Q', 'E', 'R', 'F'][i]; });
  $('hPortrait').innerHTML = window.BOD_ICONS.hero(hid);
}
function interactables() {
  const me = G.me, s = G.cur; if (!me || !s || me.dead) return null; const d2 = (x, z) => (me.x - x) ** 2 + (me.z - z) ** 2, F = DW.MAP.fountain;
  if (s.so && d2(DW.MAP.secretShop.x, DW.MAP.secretShop.z) < 64) return { k: 'secret', icon: '🔮', n: 'Secret Shop' };
  if ((me.x - DW.MAP.forge.x) ** 2 + (me.z - DW.MAP.forge.z) ** 2 < 49) return { k: 'forge', icon: '⚒', n: 'Forge' };
  if (d2(DW.MAP.shop.x, DW.MAP.shop.z) < 64) return { k: 'shop', icon: '🛒', n: 'Shop' };
  if (d2(F.x + 11, F.z - 9) < 49) return { k: 'council', icon: '⚑', n: 'War Council' };
  if (s.encs.some(e => e.sub === 'merchant' && d2(e.x, e.z) < 49)) return { k: 'merchant', icon: '🧳', n: 'Merchant' };
  if (s.ph === 'night' && s.towns.some(t => t.team === 0 && d2(t.x, t.z) < 81)) return { k: 'shop', icon: '🏘', n: 'Town Shop' };
  return null;
}
function interact() {
  const it = interactables(); if (!it) return;
  if (it.k === 'council') { G.wcTab = 'towns'; return openTowns(); }
  G.shopTab = it.k === 'shop' ? 'basic' : it.k; renderShop();
}
function pressRecall() {
  if (!G.cur || !G.me) return;
  if (G.cur.ph === 'night') {
    const owned = G.cur.towns.filter(t => t.team === 0);
    openModal(`<h2>Waygate</h2><p class="muted">Travel (2s channel) to base or any town you hold.</p><div class="list">${['<button class="btn wide" data-d="base">🏰 Main Base</button>', ...owned.map(t => `<button class="btn wide" data-d="${t.tid}">⚑ ${esc(t.n)}</button>`)].join('')}</div>`, () => document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { send({ c: 'way', dest: b.dataset.d }); closeModal(); }));
  } else send({ c: 'recall' });
}

// ============================ MODALS ============================
let modalRefresh = null;
function morph(a, b) {
  // Patch element a to match b in place (same structure → update text/attributes; otherwise replace the child)
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b.cloneNode(true)); return; }
  if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.nodeType !== 1) return;
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  if (a.tagName === 'INPUT') return;
  const ac = [...a.childNodes], bc = [...b.childNodes];
  if (ac.length !== bc.length) { a.innerHTML = b.innerHTML; return; }
  for (let i = 0; i < ac.length; i++) morph(ac[i], bc[i]);
}
function openModal(html, bind, refresh) {
  const full = '<button class="x" id="mClose">✕</button>' + html, open = !$('modalBg').classList.contains('hidden');
  if (open && G.modalHtml === full) return;
  if (open && refresh && refresh === modalRefresh) {
    G.modalHtml = full; const t = document.createElement('div'); t.innerHTML = full;
    const box = $('modal'); if (box.childNodes.length === t.childNodes.length) { [...box.childNodes].forEach((n, i) => morph(n, t.childNodes[i])); $('mClose').onclick = closeModal; if (bind) bind(); return; }
  }
  G.modalHtml = full; const sc = $('modal').scrollTop; $('modal').innerHTML = full; $('modal').scrollTop = sc; $('modalBg').classList.remove('hidden'); $('mClose').onclick = closeModal; if (bind) bind(); modalRefresh = refresh || null; }
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
  const itemCard = (key, it, canBuy, extra) => `<div class="item ${it.rar >= 0 ? 'r' + it.rar : ''}"><div class="iIcon">${window.BOD_ICONS.item(it)}</div><div class="iTxt"><b style="color:${itemCol(it)}">${esc(it.n)}</b><small>${it.rar >= 0 ? DW.RARITY[it.rar].n + ' · ' : ''}${statLine(it.s)}</small></div><button class="btn sm" ${canBuy ? '' : 'disabled'} ${extra}>${it.c}g</button></div>`;
  if (G.shopTab === 'basic' || G.shopTab === 'adv') {
    const tier = G.shopTab === 'basic' ? 1 : 2;
    body = (tier === 1 ? `<div class="item"><div class="iIcon">${window.BOD_ICONS.item({ s: { hp: 1 }, rar: -1 })}</div><div class="iTxt"><b>Healing Potion</b><small>Restores 250 HP over 8s · carrying ${me.pots}/5</small></div><button class="btn sm" ${acc.any && me.g >= DW.POTION_COST && me.pots < 5 ? '' : 'disabled'} data-buy="potion">${DW.POTION_COST}g</button></div>` : '') +
      Object.keys(DW.ITEMS).filter(k => DW.ITEMS[k].tier === tier).map(k => itemCard(k, DW.ITEMS[k], acc.normal && me.g >= DW.ITEMS[k].c, `data-buy="${k}"`)).join('');
  } else if (G.shopTab === 'secret') {
    body = (G.cur.so ? (acc.secret ? '' : '<p class="muted">Travel to the Secret Shop behind the Treant\'s grove in the Wildwood to buy these.</p>') : '<p class="warnTxt">Locked — slay the Ancient Treant in the Wildwood lane.</p>') +
      Object.keys(DW.ITEMS).filter(k => DW.ITEMS[k].secret).map(k => itemCard(k, DW.ITEMS[k], acc.secret && me.g >= DW.ITEMS[k].c, `data-buy="${k}"`)).join('');
  } else if (G.shopTab === 'vault') {
    body = '<p class="muted">Members\' Vault — new stock every dawn. Buy at any shop.</p>' + G.cur.vault.map(k => itemCard(k, Object.assign({ rar: -2 }, DW.VAULT[k]), acc.any && me.g >= DW.VAULT[k].c, `data-vault="${k}"`)).join('');
  } else if (G.shopTab === 'forge') {
    G.forgeSel = (G.forgeSel || []).filter(i => me.it[i]);
    body = '<p class="muted">The ancient forge hungers. Offer three items of the same rarity…</p>' + me.it.map((it, i) => it ? `<div class="item ${it.rar >= 0 ? 'r' + it.rar : ''} ${G.forgeSel.includes(i) ? 'picked' : ''}" data-fsel="${i}"><div class="iIcon">${window.BOD_ICONS.item(it)}</div><div class="iTxt"><b style="color:${itemCol(it)}">${esc(it.n)}</b><small>${it.rar >= 0 ? DW.RARITY[it.rar].n : 'Shop item — cannot be forged'}</small></div><span>${G.forgeSel.includes(i) ? '✔' : ''}</span></div>` : '').join('') + `<button class="btn wide" id="doForge" ${G.forgeSel.length === 3 ? '' : 'disabled'}>Forge (${G.forgeSel.length}/3)</button>`;
  } else if (G.shopTab === 'merchant') {
    body = near ? near.stock.map((it, i) => it ? itemCard('', Object.assign({}, it, { c: Math.round(it.c * 1.5) }), me.g >= Math.round(it.c * 1.5), `data-loot="${i}"`) : '<div class="item muted">Sold</div>').join('') : '<p class="muted">Wandering merchants appear in the jungle at dawn. Stand next to one to trade.</p>';
  } else {
    body = (me.mem ? '<p class="gold">★ Member Card holder</p>' : '') + me.it.map((it, i) => it ? `<div class="item ${it.rar >= 0 ? 'r' + it.rar : ''}"><div class="iIcon">${window.BOD_ICONS.item(it)}</div><div class="iTxt"><b style="color:${itemCol(it)}">${esc(it.n)}</b><small>${it.rar >= 0 ? DW.RARITY[it.rar].n + ' · ' : ''}${statLine(it.s)}</small>${it.lore ? `<small class="lore">${esc(it.lore)}</small>` : ''}</div><button class="btn sm ghost" data-sell="${i}">${acc.any ? 'Sell' : 'Salvage'} ${Math.round(it.c * (acc.any ? 0.5 : 0.25))}g</button></div>` : '<div class="item muted">Empty slot</div>').join('');
  }
  const status = acc.secret ? '🟣 At the Secret Shop' : acc.any ? '🟢 Shop open' : '🔴 Shop closed — stand at the Shop stall in your base' + (G.cur.ph === 'night' ? ' or in a town you hold' : ' (held towns open their shops at night)');
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
  openModal(`<h2>War Council <span class="gold">◉ ${G.me.g}</span></h2>${wcTabs()}<div class="status">Town funding drains <b class="gold">${drain.toFixed(1)}g/s</b> from each hero · nightly upkeep <b class="gold">${upk}g</b> (split) · ${s.ph === 'day' ? 'Night in ' + fmtT(s.md[1] - s.t % s.md[2]) : 'Dawn in ' + fmtT(s.md[2] - s.t % s.md[2])}</div><div class="list">${rows}</div>`, () => {
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
    <div class="laneHdr">Base</div><div class="list">${['walls', 'treasury'].map(upCard).join('')}</div>`, () => {
    document.querySelectorAll('[data-upg]').forEach(b => b.onclick = () => send({ c: 'upg', k: b.dataset.upg }));
    document.querySelectorAll('[data-ride]').forEach(b => b.onclick = () => { send({ c: 'rail', lane: b.dataset.ride, to: +b.dataset.to }); closeModal(); });
    if ($('hireMerc')) $('hireMerc').onclick = () => send({ c: 'merc' });
    bindWcTabs();
  }, renderTowns);
}
function openHero() {
  if (!G.me) return; const me = G.me, H = DW.HEROES[me.hid], sv = me.sv || {};
  const rows = [['HP', `${me.hp} / ${me.mhp}`], [H.res.type, `${me.res} / ${me.mres}`], ['Attack Damage', Math.round(sv.ad)], ['Ability Power', Math.round(sv.ap)], ['Movespeed', Math.round(sv.ms)], ['Attack Speed', (sv.as || 0).toFixed(2) + '/s'], ['Lifesteal', Math.round(sv.ls * 100) + '%'], ['Spell Vamp', Math.round(sv.sv * 100) + '%'], ['Crit Chance', Math.round(sv.crit * 100) + '%'], ['Armor', Math.round(sv.armor)], ['Magic Resist', Math.round(sv.mr)], ['Bonus Attribute Points', me.attr]];
  openModal(`<div class="heroHead"><div class="tipIcon big">${window.BOD_ICONS.hero(me.hid)}</div><h2 style="color:${H.col}">${H.name} <small>Level ${me.lvl} · ${H.title}</small></h2></div><div class="statGrid">${rows.map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('')}</div>${me.bf.length ? '<p class="muted">Active: ' + me.bf.map(b => b[0] + ' ' + b[1] + 's').join(', ') + '</p>' : ''}<div class="abList">${H.ab.map((a, i) => `<div class="abInfo withIcon"><div class="tipIcon">${window.BOD_ICONS.ability(me.hid, i)}</div><div><b>${a.n}</b> <small>Rank ${me.rk[i]}${a.ult ? ' · Ultimate' : ''}</small><p>${a.d}</p></div></div>`).join('')}</div>`, null, openHero);
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
  $('endSub').textContent = (s.over.win ? 'The enemy Core lies shattered.' : 'Our Core has fallen.') + ' ' + DW.MODES[s.md[0]].name + ' · Match time ' + fmtT(s.over.t) + ' · Day ' + s.cy;
  $('endStats').innerHTML = statsTable(s);
  $('btnEndMenu').onclick = () => { if (L.mode !== 'solo') leaveLobby(); else { L.mode = null; show('menu'); renderMenu(); } };
}

// ============================ FRAME ============================
let lastFrame = performance.now();
function dayFactor(t, D, C) { const pt = t % C; if (t < 8) return 1; if (pt < 8) return pt / 8; if (pt < D - 12) return 1; if (pt < D) return 1 - (pt - (D - 12)) / 12; if (pt > C - 8) return (pt - (C - 8)) / 8 * 0.4; return 0; }
const cDaySky = new THREE.Color(0x9fcbe8), cNightSky = new THREE.Color(0x101a3a), cDusk = new THREE.Color(0xe08a5a), cEclipse = new THREE.Color(0x3a0a14), tmpC = new THREE.Color();
const cSunDay = new THREE.Color(0xfff0d8), cMoon = new THREE.Color(0x8aa8ff);
function animateRig(m, f, now, dt, id) {
  if (m.static) { if (m.spin) m.spin.rotation.y = now / 900; if (m.ring) m.ring.rotation.z = now / 2000; return; }
  const walking = f & 16, atk = f & 32;
  m.ph = (m.ph || (id % 7)) + dt * (walking ? 10 : 2);
  const sw = walking ? Math.sin(m.ph) : 0, amp = m.quad ? 0.6 : 0.65;
  if (m.legL) { m.legL.rotation.x = sw * amp; m.legR.rotation.x = -sw * amp; }
  if (m.legL2) { m.legL2.rotation.x = -sw * amp; m.legR2.rotation.x = sw * amp; }
  if (atk && !m.atkOn) { m.atkT = now; m.struck = false; } m.atkOn = !!atk;
  // attack timeline: wind-up → strike → follow-through → recover
  const dur = m.hero ? 420 : 320, ap = m.atkT ? Math.min(1, (now - m.atkT) / dur) : 1, style = m.atkStyle || (m.quad ? 'bite' : 'swing');
  const ease = t => t * t * (3 - 2 * t);
  const wind = ap < 0.16 ? ease(ap / 0.16) : ap < 0.34 ? 1 - ease((ap - 0.16) / 0.18) : 0;      // 1 at top of wind-up
  const strike = ap < 0.16 ? 0 : ap < 0.34 ? ease((ap - 0.16) / 0.18) : 1 - ease((ap - 0.34) / 0.66); // 1 at impact
  const active = ap < 1;
  m.body.position.y = walking ? Math.abs(Math.sin(m.ph)) * 0.08 : Math.sin(now / 600 + id) * 0.02;
  m.body.position.z = active ? strike * (style === 'bow' || style === 'cast' ? 0.08 : 0.38) - wind * 0.12 : 0;
  m.body.rotation.y = active && (style === 'swing' || style === 'cleave') ? -0.45 * wind + 0.5 * strike : 0;
  if (style === 'cleave' && active) m.body.position.y -= strike * 0.22;
  if (m.armL) {
    const idleL = walking ? -sw * 0.5 : Math.sin(now / 700 + id) * 0.05, idleR = walking ? sw * 0.5 : 0;
    m.armL.rotation.set(idleL, 0, 0); m.armR.rotation.set(idleR, 0, 0);
    if (active) {
      if (style === 'swing') { m.armR.rotation.x = idleR - 2.5 * wind + 1.1 * strike - 0.3; m.armR.rotation.z = 0.5 * wind - 0.4 * strike; m.armL.rotation.x = -0.5 * strike; }
      else if (style === 'cleave') { const x = -2.9 * wind + 1.3 * strike; m.armR.rotation.x = x; m.armL.rotation.x = x; m.armL.rotation.z = -0.35; m.armR.rotation.z = 0.35; }
      else if (style === 'bow') { m.armL.rotation.x = -1.55; m.armL.rotation.z = -0.15; m.armR.rotation.x = -1.4 + 0.3 * strike; m.armR.rotation.z = -0.6 * wind - 0.2; }
      else if (style === 'cast') { m.armR.rotation.x = -0.6 - 1.4 * wind - 0.6 * strike; m.armL.rotation.x = -0.9 * strike; m.armL.rotation.z = 0.3 * strike; }
      else { m.armR.rotation.x = -1.9 * strike; }
    }
  }
  if (m.hero && active && !m.struck && ap >= 0.3) {
    m.struck = true; const R = m.root.position, fa = m.faceA || 0;
    if (style === 'swing' || style === 'cleave') { slashFx(R.x + Math.cos(fa) * 1.5, R.z + Math.sin(fa) * 1.5, fa, style === 'cleave' ? 3.2 : 2.5, m.trail || '#ffffff', 0.26); burstP(R.x + Math.cos(fa) * 2.2, 1.4, R.z + Math.sin(fa) * 2.2, style === 'cleave' ? 18 : 10, m.trail || '#ffffff', 6, 0.5, 0.3, 2, 6); if (style === 'cleave' && m === G.meshes.get(G.myHeroId)) shakeCam(0.12); }
    else if (style === 'cast' && m.glow) { const p = new THREE.Vector3(); m.glow.getWorldPosition(p); burstP(p.x, p.y, p.z, 14, m.castCol || '#ffffff', 4, 0.6, 0.35, 1); }
    else if (style === 'bow') { burstP(R.x + Math.cos(fa) * 1.6, 2.4, R.z + Math.sin(fa) * 1.6, 6, '#e8ffd0', 3, 0.35, 0.25, 0.5); }
  }
  if (m.arm) m.arm.rotation.x = -0.6 - strike * 1.4 + wind * 0.4;
  if (m.necks) m.necks.forEach((n, i) => { n.rotation.x = Math.sin(now / 500 + i) * 0.15 - strike * 0.7 * (i === 1 ? 1 : 0.5) + wind * 0.4; });
  if (m.tail) m.tail.rotation.y = walking ? Math.sin(m.ph) * 0.35 : Math.sin(now / 500 + id) * 0.12;
  if (m.halo) m.halo.position.y = 0.75 + Math.sin(now / 400) * 0.06;
  if (m.wingL) { const fl = Math.sin(now / 260) * 0.12; m.wingL.rotation.z = 0.55 + fl; m.wingR.rotation.z = -0.55 - fl; }
  if (m.glow) m.glow.scale.setScalar(0.45 * (1 + Math.sin(now / 160) * 0.12) * (1 + strike * 0.6));
}
function frame(now) {
  requestAnimationFrame(frame); netWatchdog(now);
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if (!G.running || !G.cur) { if (renderer && G.running) renderer.render(scene, camera); return; }
  const s = G.cur, a = Math.min(1.2, (now - G.recvT) / G.interval);
  // lighting
  const df = dayFactor(s.t + a * 0.1, s.md[1], s.md[2]);
  tmpC.copy(cNightSky).lerp(cDaySky, df); if (df > 0 && df < 1) tmpC.lerp(cDusk, 0.4 * Math.sin(df * Math.PI)); if (s.ec) tmpC.lerp(cEclipse, 0.45);
  scene.background.copy(tmpC); scene.fog.color.copy(tmpC);
  hemi.intensity = 0.2 + 0.32 * df; sun.intensity = 0.32 + 0.68 * df; sun.color.copy(cMoon).lerp(cSunDay, df); moonFill.intensity = 0.32 * (1 - df);
  heroLight.intensity = (1 - df) * 1.4; (G.lampMats || [lampMat]).forEach(m => m.emissiveIntensity = 0.35 + (1 - df) * 1.6);
  if (waterMat.map) waterMat.map.offset.set(now / 40000, now / 25000);
  // entities
  const seen = new Set();
  for (const e of s.e) {
    const id = e[0]; seen.add(id); let m = G.meshes.get(id);
    if (!m || m.v !== e[1]) { if (m) scene.remove(m.root); m = buildModel(e[1], e[2], e[3], e[4]); m.v = e[1]; m.root.position.set(e[3], 0, e[4]); if (e[1] === 'wall' || e[1] === 'gate') m.g.rotation.y = -e[7]; scene.add(m.root); G.meshes.set(id, m); if (m.flagMesh) m.flagMesh.userData.phase = id; }
    const p = G.prevMap.get(id); const t = Math.min(1, a);
    const x = p ? p[3] + (e[3] - p[3]) * t : e[3], z = p ? p[4] + (e[4] - p[4]) * t : e[4], R = m.root.position;
    if (Math.abs(x - R.x) > 15 || Math.abs(z - R.z) > 15) R.set(x, 0, z); else { R.x += (x - R.x) * Math.min(1, dt * 16); R.z += (z - R.z) * Math.min(1, dt * 16); }
    if (!m.static) { const ty = Math.PI / 2 - e[7]; let d = ty - m.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.g.rotation.y += d * Math.min(1, dt * 14); }
    const f = e[8]; m.faceA = e[7]; animateRig(m, f, now, dt, id);
    const LP = G.leaps.get(id);
    if (LP) { const p = (now - LP.t0) / 1000 / LP.dur;
      if (p >= 1 || (!(f & 512) && p > 0.3)) { G.leaps.delete(id); R.y = 0; m.g.rotation.x = 0; if (LP.kind === 'leap') { ringFx(R.x, R.z, 3.6, '#ff3a4a', 0.5, 1); burstP(R.x, 0.3, R.z, 34, '#7a5a3a', 8, 1, 0.7, 5, 14); burstP(R.x, 0.5, R.z, 16, '#ff2a3a', 5, 0.8, 0.5, 2); shakeCam(0.45); } }
      else if (LP.kind === 'leap') { R.y = Math.sin(p * Math.PI) * 5; m.g.rotation.x = -0.4 + p * 0.6; }
      else if (LP.kind === 'roll') { m.g.rotation.x = p * Math.PI * 2; }
      else if (LP.kind === 'charge') { if (Math.random() < 0.9) emit(R.x + (Math.random() - 0.5) * 1.5, 0.3, R.z + (Math.random() - 0.5) * 1.5, { vy: 1.2, c: '#a08a6a', s: 1.4, s1: 2.2, life: 0.6, d: 2 }); }
    } else if (R.y) R.y = 0;
    m.slashOn = !!(f & 32);
    if ((f & 2) && Math.random() < 0.08) emit(R.x + (Math.random() - 0.5) * 1.5, 0.5, R.z + (Math.random() - 0.5) * 1.5, { vy: 2, c: '#ff3a2a', s: 0.5, life: 0.7 });
    m.nf.visible = !!(f & 2); if (f & 2) m.nf.material.opacity = 0.6 + 0.3 * Math.sin(now / 150);
    m.stun.visible = !!(f & 1); if (f & 1) m.stun.rotation.z = now / 200;
    if (m.heal) m.heal.visible = !(f & 256);
    if (m.flag) { m.flag.color.setHex(e[2] === 0 ? 0x2f6ad8 : 0x9a9a9a); m.flagMesh.rotation.y = Math.sin(now / 500 + id) * 0.25; if (m.fort) m.fort.visible = e[2] === 0; }
    m.ent = e;
  }
  for (const [id, m] of G.meshes) if (!seen.has(id)) { scene.remove(m.root); G.meshes.delete(id); }
  // projectiles
  const pseen = new Set();
  for (const p of s.p) {
    pseen.add(p[0]); let m = G.projMeshes.get(p[0]);
    if (!m) { m = projMesh(p[5] || 'o', p[3], p[4]); m.position.set(p[1], 1.8, p[2]); scene.add(m); G.projMeshes.set(p[0], m); }
    const pp = G.prevMap.get('p' + p[0]); const t = Math.min(1, a);
    const nx = pp ? pp[1] + (p[1] - pp[1]) * t : p[1], nz = pp ? pp[2] + (p[2] - pp[2]) * t : p[2];
    if (Math.abs(nx - m.position.x) + Math.abs(nz - m.position.z) > 0.01) m.rotation.y = Math.atan2(nx - m.position.x, nz - m.position.z);
    m.position.x = nx; m.position.z = nz; m.position.y = m.userData.kind === 'rock' ? 1.5 + Math.sin(now / 200) * 0.6 : 1.8;
    const k2 = m.userData.kind; if (k2 !== 'arrow' || m.userData.st !== 'a') { if (Math.random() < (k2 === 'fire' ? 1 : 0.6)) emit(nx + (Math.random() - 0.5) * 0.3, 1.8, nz + (Math.random() - 0.5) * 0.3, { c: k2 === 'fire' ? (Math.random() < 0.5 ? '#ff8a2a' : '#ffd040') : m.userData.col, s: k2 === 'fire' ? 0.9 : 0.5, life: 0.35, vy: 0.5 }); }
  }
  for (const [id, m] of G.projMeshes) if (!pseen.has(id)) { scene.remove(m); m.traverse(o => { if (o.material && !o.material.userData.cached) o.material.dispose(); }); G.projMeshes.delete(id); }
  // telegraphs
  G.zoneMeshes.forEach((g, i) => {
    const z = s.z[i]; g.visible = !!z; if (!z) return;
    g.position.x = z[0]; g.position.z = z[1]; g.children[0].scale.setScalar(z[2]); g.children[1].scale.setScalar(z[2] * (z[4] === 2 ? 1 : Math.max(0.05, Math.min(1, z[3]))));
    const col = z[4] === 1 ? 0xff3a2a : z[4] === 2 ? 0xffe27a : 0xffa040; g.children[0].material.color.setHex(col); g.children[1].material.color.setHex(col);
  });
  G.fxList = G.fxList.filter(f => { const p = (now - f.t0) / 1000 / f.dur; if (p >= 1) { scene.remove(f.obj); f.obj.traverse(o => { if (o.material && !o.material.userData.cached) o.material.dispose(); }); return false; } f.upd(p); return true; });
  G.attach = G.attach.filter(A => { const mm = G.meshes.get(A.id); if (now > A.until || !mm) { if (A.obj) { scene.remove(A.obj); A.obj.material.dispose(); } return false; } if (A.obj) A.obj.position.copy(mm.root.position); A.upd(mm, now, dt); return true; });
  particlesUpdate(dt); fogUpdate(now);
  if (G.campFires) G.campFires.forEach((f, i) => { f.scale.set(0.9 + Math.sin(now / 90 + i) * 0.12, 1.4 + Math.sin(now / 70 + i * 3) * 0.25, 0.9); if (Math.random() < 0.15) emit(f.parent.position.x + (Math.random() - 0.5), 1.4, f.parent.position.z + (Math.random() - 0.5), { vy: 2.5, c: f.userData.col || '#ff8a2a', s: 0.4, life: 0.8 }); });
  for (const h of s.h) if (h.rc && !h.dead && Math.random() < 0.6) { const a = now / 150 + Math.random(), mm = G.meshes.get(h.id); if (mm) emit(mm.root.position.x + Math.cos(a) * 1.4, 0.3 + Math.random() * 2.5, mm.root.position.z + Math.sin(a) * 1.4, { vy: 1.5, c: h.rc[0] === 'base' ? '#7ac8ff' : '#c8a0ff', s: 0.5, life: 0.6 }); }
  // camera: locked to hero; minimap hold pans
  const myM = G.meshes.get(G.myHeroId); const hx = myM ? myM.root.position.x : G.me ? G.me.x : 0, hz = myM ? myM.root.position.z : G.me ? G.me.z : 100;
  myRing.visible = !!myM; if (myM) { myRing.position.x = hx; myRing.position.z = hz; }
  const lookAhead = (camera.aspect < 1.3 ? 5 : 4) * G.zoom, tx = G.panning ? G.panX : hx, tz = G.panning ? G.panZ + 4 : hz - lookAhead;
  const k = G.panning ? Math.min(1, dt * 10) : Math.min(1, dt * 9);
  G.camX += (tx - G.camX) * k; G.camZ += (tz - G.camZ) * k;
  const Z = G.zoom * (MOBILE ? 1 : 1.12), aspect = camera.aspect;
  const dist = (aspect < 1.3 ? 32 : 24) * Z;
  const sk = G.shake || 0; G.shake = Math.max(0, sk - dt * 1.8); const shx = (Math.random() - 0.5) * sk * 1.2, shz = (Math.random() - 0.5) * sk * 1.2;
  const ip = G.intro ? introPose(dt, { p: [G.camX, dist * 0.79, G.camZ + dist * 0.62], l: [G.camX, 0, G.camZ - 1], fog: [dist * 1.15, dist * 3.2] }) : null;
  if (ip) {
    G.camX = tx; G.camZ = tz; // gameplay pose waits, settled on the hero, for the final blend
    camera.position.set(ip.p[0], ip.p[1], ip.p[2]); camera.lookAt(ip.l[0], ip.l[1], ip.l[2]);
    cullChunks(ip.l[0], ip.l[2] + 20, 150);
    sun.position.set(ip.l[0] - 22, 48, ip.l[2] + 18); sun.target.position.set(ip.l[0], 0, ip.l[2] - 4); sun.target.updateMatrixWorld();
    scene.fog.near = ip.fog[0]; scene.fog.far = ip.fog[1];
  } else {
    camera.position.set(G.camX + shx, dist * 0.79, G.camZ + dist * 0.62 + shz); camera.lookAt(G.camX + shx, 0, G.camZ - 1 + shz);
    cullChunks(G.camX, G.camZ, dist * 1.7);
    sun.position.set(G.camX - 22, 48, G.camZ + 18); sun.target.position.set(G.camX, 0, G.camZ - 4); sun.target.updateMatrixWorld();
    scene.fog.near = dist * 1.15; scene.fog.far = dist * 3.2;
  }
  heroLight.position.set(hx, 6, hz + 1);
  // target ring
  const tg = G.me && G.me.tg ? G.meshes.get(G.me.tg) : null; tgtRing.visible = !!tg;
  if (tg) { tgtRing.position.x = tg.root.position.x; tgtRing.position.z = tg.root.position.z; tgtRing.scale.setScalar((tg.boss ? 4.2 : tg.static ? 3.5 : 1.4) * (1 + 0.06 * Math.sin(now / 120))); }
  // aim indicator
  if (G.aim && G.aim.moved && G.me && myM) {
    const A = G.aim, { ab, aoe } = abInfo(A.k), P = aimPoint(); const col = A.cancel ? 0xff4a4a : 0x9fe0ff;
    rangeRing.visible = true; rangeRing.scale.setScalar(Math.min(ab.range || 6, 40)); rangeRing.position.x = hx; rangeRing.position.z = hz; rangeRing.material.color.setHex(col);
    const len = Math.hypot(P.x - hx, P.z - hz);
    aimArrow.visible = ab.t === 'dir' || (ab.t === 'point' && aoe < 2); aimArrow.material.color.setHex(col);
    if (aimArrow.visible) { aimArrow.position.set(hx, 0.14, hz); aimArrow.scale.set(Math.max(1, (aoe || 1) * 1.4), len, 1); aimArrow.rotation.set(-Math.PI / 2, 0, Math.atan2(P.ux, P.uz) + Math.PI); }
    aimCircle.visible = ab.t === 'point' || ab.t === 'unit'; aimCircle.material.color.setHex(A.cancel ? 0xff4a4a : 0xffb35a);
    if (aimCircle.visible) { aimCircle.position.x = P.x; aimCircle.position.z = P.z; aimCircle.scale.setScalar(Math.max(1.2, aoe || 1.5)); }
  } else { rangeRing.visible = false; aimArrow.visible = false; aimCircle.visible = false; }
  if (G.forgeEmber) G.forgeEmber.scale.set(0.7 + 0.12 * Math.sin(now / 180), 0.45, 0.7);
  if (G.secretGem) { G.secretGem.visible = s.so; G.secretGem.rotation.y = now / 600; }
  if (G.fountainGem) G.fountainGem.rotation.y = now / 900;
  if (G.shopCoin) { G.shopCoin.rotation.y = now / 500; G.shopCoin.position.y = 6 + Math.sin(now / 400) * 0.3; }
  { const left = Math.max(0, (G.atkReadyAt || 0) - now) / 1000, P = G.atkPeriod || 1, b = $('btnAtk'); if (b) { b.style.setProperty('--acd', (Math.min(1, left / P) * 360).toFixed(0) + 'deg'); b.classList.toggle('atkReady', left <= 0.01); } }
  renderer.render(scene, camera); if (window.__dbg) window.__ri = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  drawOverlay(now); drawMinimap(); updateHUD(now);
}
const MAPBOSS = {}; DW.MAP.bosses.forEach(b => MAPBOSS['b_' + b.id] = b.name + (b.warden ? ' · Warden' : '')); ['L', 'M', 'R'].forEach(l => MAPBOSS['me_lieut_' + l] = DW.LIEUT_NAMES[l]);
function drawOverlay(now) {
  const W = window.innerWidth, H = window.innerHeight; octx.clearRect(0, 0, W, H); const s = G.cur, u = uiScale();
  for (const [id, m] of G.meshes) {
    const e = m.ent; if (!e || e[1].startsWith('e_') || e[1].startsWith('loot') || e[1] === 'ward' || e[1] === 'healpack') continue;
    if (e[1] === 'town') {
      const tw = s.towns.find(t => t.id === id); if (!tw) continue; const p = worldToScreen(m.root.position.x, 9, m.root.position.z); if (p[2] > 1 || p[0] < -80 || p[0] > W + 80 || p[1] < -30 || p[1] > H + 30) continue;
      octx.font = `700 ${Math.round(12 * u)}px Cinzel, serif`; octx.textAlign = 'center'; octx.fillStyle = tw.team === 0 ? '#9fd0ff' : '#f0e2b6'; octx.strokeStyle = '#000c'; octx.lineWidth = 3;
      const lbl = tw.n + (tw.inv ? ' ' + '★'.repeat(tw.inv) : ''); octx.strokeText(lbl, p[0], p[1]); octx.fillText(lbl, p[0], p[1]);
      if (tw.team === 0) bar(p[0], p[1] + 5, 64 * u, 5, e[5] / e[6], '#4a9aff'); else if (tw.cap > 0) bar(p[0], p[1] + 5, 64 * u, 5, tw.cap / 4, '#ffd36b');
      continue;
    }
    const p = worldToScreen(m.root.position.x, m.h + 0.4, m.root.position.z);
    if (p[2] > 1 || p[0] < -60 || p[0] > W + 60 || p[1] < -20 || p[1] > H + 20) continue;
    const team = e[2], hpP = e[5] / e[6], isHero = e[1].startsWith('h_'), boss = m.boss, struct = m.static;
    if (!isHero && !boss && !struct && hpP >= 0.999 && team !== 1) continue;
    const w = (isHero ? 66 : boss ? 100 : struct ? 80 : m.elite ? 54 : e[1].startsWith('c_') ? 38 : 30) * u, hh = (isHero ? 7 : boss || struct ? 6 : 4) * Math.max(0.85, u);
    const col = id === G.myHeroId ? '#62ff6a' : team === 0 ? '#3ac0ff' : team === 1 ? '#ff4040' : '#f0c040';
    bar(p[0], p[1], w, hh, hpP, col, (e[8] & 4) ? '#c0c0ff' : null);
    if (isHero) {
      const hs = s.h.find(h => h.id === id);
      if (hs) { const H2 = DW.HEROES[hs.hid];
        octx.fillStyle = '#0b0b10'; octx.fillRect(p[0] - w / 2, p[1] + hh + 1, w, 3); octx.fillStyle = H2.res.type === 'Rage' ? '#e04040' : H2.res.type === 'Energy' ? '#f0d840' : H2.res.type === 'Resolve' ? '#f0a040' : '#4a8aff'; octx.fillRect(p[0] - w / 2, p[1] + hh + 1, w * hs.res / Math.max(1, hs.mres), 3);
        const bx = p[0] - w / 2 - 9 * u; octx.fillStyle = '#1a1208'; octx.beginPath(); octx.arc(bx, p[1] + hh / 2, 8 * u, 0, 7); octx.fill(); octx.strokeStyle = '#d9b25f'; octx.lineWidth = 1.5; octx.stroke();
        octx.fillStyle = '#f0d68a'; octx.font = `800 ${Math.round(9 * u)}px Inter, sans-serif`; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(hs.lvl, bx, p[1] + hh / 2 + 0.5); octx.textBaseline = 'alphabetic';
        octx.font = `700 ${Math.round(11 * u)}px Inter, sans-serif`; octx.strokeStyle = '#000d'; octx.lineWidth = 3; octx.fillStyle = id === G.myHeroId ? '#d8ffd8' : '#fff'; octx.strokeText(hs.n, p[0], p[1] - 5); octx.fillText(hs.n, p[0], p[1] - 5); }
    } else if (boss) {
      octx.font = `700 ${Math.round(11 * u)}px Cinzel, serif`; octx.textAlign = 'center'; octx.strokeStyle = '#000d'; octx.lineWidth = 3; octx.fillStyle = (e[8] & 128) ? '#ff6a4a' : '#ffd36b';
      octx.strokeText(MAPBOSS[e[1]] || '', p[0], p[1] - 5); octx.fillText(MAPBOSS[e[1]] || '', p[0], p[1] - 5);
    }
  }
  { const sp = worldToScreen(DW.MAP.shop.x, 8.2, DW.MAP.shop.z); if (sp[2] < 1 && sp[0] > -40 && sp[0] < W + 40 && sp[1] > -20 && sp[1] < H + 20) { octx.font = `800 ${Math.round(12 * u)}px Cinzel, serif`; octx.textAlign = 'center'; octx.strokeStyle = '#000d'; octx.lineWidth = 3; octx.fillStyle = '#ffd36b'; octx.strokeText('SHOP', sp[0], sp[1]); octx.fillText('SHOP', sp[0], sp[1]); } }
  const NC = ['#ffffff', '#d08aff', '#ff5a5a', '#6aff8a', '#ffb02a', '#ffd700'];
  G.nums = G.nums.filter(n => {
    const age = (now - n.t) / 1000; if (age > 1) return false;
    const p = worldToScreen(n.x, 3.5, n.z); if (p[2] > 1) return true;
    const big = n.c === 4, sc = age < 0.12 ? 1 + (0.12 - age) * 4 : 1; octx.globalAlpha = 1 - age * age;
    octx.font = `${big ? 900 : 800} ${Math.round((big ? 19 : 13) * u * sc)}px Inter, sans-serif`; octx.textAlign = 'center';
    const txt = (n.c === 3 || n.c === 5 ? '+' : n.c === 2 ? '-' : '') + n.v + (n.c === 5 ? 'g' : big ? '!' : '');
    octx.strokeStyle = '#000'; octx.lineWidth = 3.5; octx.strokeText(txt, p[0] + n.ox * age, p[1] - age * 46); octx.fillStyle = NC[n.c] || '#fff'; octx.fillText(txt, p[0] + n.ox * age, p[1] - age * 46);
    octx.globalAlpha = 1; return true;
  });
}
function bar(x, y, w, h, p, col, border) {
  octx.fillStyle = '#000c'; octx.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3);
  octx.fillStyle = '#3a0a0a'; octx.fillRect(x - w / 2, y, w, h);
  octx.fillStyle = col; octx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, p)), h);
  octx.fillStyle = 'rgba(255,255,255,.25)'; octx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, p)), Math.max(1, h * 0.35));
  if (w > 50) { octx.fillStyle = '#0007'; const step = w / 10; for (let i = step; i < w * p - 1; i += step) octx.fillRect(x - w / 2 + i, y, 1, h); }
  if (border) { octx.strokeStyle = border; octx.lineWidth = 1; octx.strokeRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3); }
}
function buildMinimapBg() {
  const Wd = 200, Hd = 225; miniBg = document.createElement('canvas'); miniBg.width = Wd; miniBg.height = Hd; const c = miniBg.getContext('2d');
  const mx = x => (x / DW.MAP.W + 1) / 2 * Wd, mz = z => (z / DW.MAP.H + 1) / 2 * Hd;
  c.fillStyle = '#24401c'; c.fillRect(0, 0, Wd, Hd);
  for (let i = 0; i < 260; i++) { c.fillStyle = i % 2 ? '#1c3416' : '#2c4a22'; c.beginPath(); c.arc(Math.random() * Wd, Math.random() * Hd, 2 + Math.random() * 6, 0, 7); c.fill(); }
  c.strokeStyle = '#3a6a8a'; c.lineWidth = 6; c.beginPath(); for (let x = -DW.MAP.W; x <= DW.MAP.W; x += 3) { const z = DW.RIVER(x); x === -DW.MAP.W ? c.moveTo(mx(x), mz(z)) : c.lineTo(mx(x), mz(z)); } c.stroke();
  c.strokeStyle = '#8a7048'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const k in DW.LANES) { c.beginPath(); DW.LANES[k].forEach((p, i) => i ? c.lineTo(mx(p[0]), mz(p[1])) : c.moveTo(mx(p[0]), mz(p[1]))); c.stroke(); }
  c.fillStyle = '#2a4a8a'; c.beginPath(); c.arc(mx(0), mz(111), 15, 0, 7); c.fill(); c.fillStyle = '#7a1a2a'; c.beginPath(); c.arc(mx(0), mz(-111), 15, 0, 7); c.fill();
  c.fillStyle = '#7a3aaa'; c.fillRect(mx(DW.MAP.secretShop.x) - 3, mz(DW.MAP.secretShop.z) - 3, 6, 6);
  const T = DW.TER; c.fillStyle = 'rgba(10,30,8,.65)'; for (let r = 0; r < T.rows; r += 1) for (let q = 0; q < T.cols; q += 1) if (T.blk[r * T.cols + q]) c.fillRect(mx(T.ox + q * T.cs), mz(T.oz + r * T.cs), Wd / T.cols + 0.6, Hd / T.rows + 0.6);
  DW.MAP.camps.forEach(cp => { const col = { wolves: '#5ac85a', trolls: '#4a8aff', ogres: '#ff5a3a' }[cp.t]; c.fillStyle = '#000a'; c.beginPath(); c.arc(mx(cp.x), mz(cp.z), 5.5, 0, 7); c.fill(); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); c.fillStyle = col; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText({ wolves: 'W', trolls: 'T', ogres: 'O' }[cp.t], mx(cp.x), mz(cp.z) + 0.5); });
  c.lineWidth = 2.5; for (const b of DW.BASES) { c.strokeStyle = b.team ? '#a05a5a' : '#8aa8d8'; c.beginPath(); c.ellipse(mx(b.x), mz(b.z), b.R / DW.MAP.W * Wd / 2, b.R / DW.MAP.H * Hd / 2, 0, 0, 7); c.stroke(); }
  G.mx = mx; G.mz = mz; G.mW = Wd; G.mH = Hd;
}
function drawMinimap() {
  const c = mctx, s = G.cur, mx = G.mx, mz = G.mz; if (mini.width !== G.mW) { mini.width = G.mW; mini.height = G.mH; }
  c.drawImage(miniBg, 0, 0); if (s.ph === 'night') { c.fillStyle = '#0a102a55'; c.fillRect(0, 0, G.mW, G.mH); }
  for (const e of s.e) {
    const v = e[1], x = mx(e[3]), z = mz(e[4]);
    if (v === 'town') { const tw = s.towns.find(t => t.id === e[0]); c.fillStyle = tw && tw.team === 0 ? '#5ab0ff' : '#d8c090'; c.fillRect(x - 5, z - 5, 10, 10); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.strokeRect(x - 5, z - 5, 10, 10); continue; }
    if (v === 'gate') { c.fillStyle = e[2] ? '#ff8a6a' : '#9ad0ff'; c.save(); c.translate(x, z); c.rotate(e[7]); c.fillRect(-5, -2, 10, 4); c.restore(); continue; }
    if (v.startsWith('me_lieut')) { c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(x, z, 4.5, 0, 7); c.fill(); c.strokeStyle = '#ffd36b'; c.lineWidth = 1.5; c.stroke(); continue; }
    if (v === 'tower' || v === 'core') { c.fillStyle = e[2] ? '#ff4a5a' : '#4a9aff'; c.beginPath(); c.arc(x, z, v === 'core' ? 6 : 4, 0, 7); c.fill(); c.strokeStyle = '#000'; c.stroke(); continue; }
    if (v.startsWith('b_')) { c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(x, z, 5, 0, 7); c.fill(); c.strokeStyle = '#000'; c.stroke(); continue; }
    if (v.startsWith('e_')) { c.fillStyle = v === 'e_chest' ? '#ffd040' : v === 'e_shrine' ? '#7af0ff' : v === 'e_merchant' ? '#ffa040' : '#3a6a2a'; c.fillRect(x - 2.5, z - 2.5, 5, 5); continue; }
    if (v === 'ward') { c.fillStyle = '#9fe0ff'; c.fillRect(x - 2.5, z - 2.5, 5, 5); continue; }
    if (v === 'healpack') { c.fillStyle = e[8] & 256 ? '#2a5a3a' : '#6aff8a'; c.beginPath(); c.arc(x, z, 3, 0, 7); c.fill(); continue; }
    if (v === 'wall' || v === 'turret') { c.fillStyle = '#8ab0e0'; c.fillRect(x - 2.5, z - 2.5, 5, 5); continue; }
    if (v.startsWith('h_')) continue;
    if (v.startsWith('loot')) { const r = v === 'loot_card' ? 5 : +v.slice(5); if (r >= 2) { c.fillStyle = RAR_COL[r]; c.fillRect(x - 2, z - 2, 4, 4); } continue; }
    c.fillStyle = e[2] === 0 ? '#6ae07a' : e[2] === 1 ? (v === 'stalker' ? '#ff2a8a' : '#ff5050') : '#d0a850'; c.fillRect(x - 1.5, z - 1.5, 3, 3);
  }
  if (FOG.cv) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 1; c.drawImage(FOG.cv, mx(DW.TER.ox) , mz(DW.TER.oz), mx(DW.TER.ox + DW.TER.cols * DW.TER.cs) - mx(DW.TER.ox), mz(DW.TER.oz + DW.TER.rows * DW.TER.cs) - mz(DW.TER.oz)); c.restore(); }
  for (const h of s.h) { if (h.dead) continue; const me = h.pid === myPid; c.fillStyle = DW.HEROES[h.hid].col; c.beginPath(); c.arc(mx(h.x), mz(h.z), me ? 6 : 5, 0, 7); c.fill(); c.strokeStyle = me ? '#fff' : '#000'; c.lineWidth = 2; c.stroke(); }
  // view frustum
  const tl = screenToWorld(0, 0), br = screenToWorld(window.innerWidth, window.innerHeight);
  if (tl && br) { c.strokeStyle = G.panning ? '#ffd36b' : '#ffffffaa'; c.lineWidth = 1.5; c.strokeRect(mx(Math.max(-DW.MAP.W, tl.x)), mz(Math.max(-DW.MAP.H, tl.z)), mx(br.x) - mx(tl.x), mz(br.z) - mz(tl.z)); }
}
let hudT = 0;
function updateHUD(now) {
  if (now - hudT < 90) return; hudT = now;
  const s = G.cur, me = G.me; if (!me) return; const H = DW.HEROES[me.hid];
  if (G.hudHero !== me.hid) buildHUD();
  const pt = s.t % s.md[2], night = s.ph === 'night';
  $('clock').innerHTML = `<span class="${night ? 'moon' : 'sunI'}">${night ? '☾' : '☀'}</span><b>${fmtT(s.t)}</b><small>${night ? 'Dawn ' + fmtT(s.md[2] - pt) : 'Night ' + fmtT(s.md[1] - pt)}${s.ec ? ' · ECLIPSE' : ''}</small>`;
  $('clock').classList.toggle('night', night);
  $('gold').textContent = me.g;
  $('lvl').textContent = me.lvl;
  $('hpFill').style.width = (me.hp / me.mhp * 100) + '%'; $('hpTxt').textContent = me.hp + ' / ' + me.mhp;
  $('resFill').style.width = (me.res / Math.max(1, me.mres) * 100) + '%'; $('resTxt').textContent = me.res + ' / ' + me.mres; $('resFill').className = 'fill res-' + H.res.type;
  $('xpRing').style.setProperty('--p', (me.lvl >= 20 ? 100 : me.xp / me.xn * 100).toFixed(1));
  document.querySelectorAll('.ab').forEach((b, i) => {
    const ab = H.ab[i], r = me.rk[i], cd = me.cd[i];
    const maxCd = Array.isArray(ab.cd) ? ab.cd[Math.max(0, r - 1)] : ab.cd;
    b.querySelector('.cdOv').style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,.7) ${cd / maxCd * 360}deg, rgba(0,0,0,.25) 0)` : 'none';
    b.querySelector('.cdTxt').textContent = cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
    const cost = r ? (Array.isArray(ab.cost) ? ab.cost[r - 1] : ab.cost) : 0;
    b.classList.toggle('locked', !r); b.classList.toggle('nores', r > 0 && cd <= 0 && me.res < cost); b.classList.toggle('ready', r > 0 && cd <= 0 && me.res >= cost);
    b.parentNode.querySelector('.pips').innerHTML = Array.from({ length: ab.ult ? 3 : 5 }, (_, j) => `<i class="${j < r ? 'on' : ''}"></i>`).join('');
    const canLv = me.pts > 0 && (i === 3 ? ([6, 11, 16][r] !== undefined && me.lvl >= [6, 11, 16][r]) : (r < 5 && r < Math.ceil(me.lvl / 2)));
    document.querySelectorAll('.lvlup')[i].classList.toggle('hidden', !canLv);
  });
  const anyLv = [...document.querySelectorAll('.lvlup')].some(b => !b.classList.contains('hidden'));
  $('attrBtn').classList.toggle('hidden', !(me.pts > 0 && !anyLv));
  $('potCount').textContent = me.pots; $('btnPot').classList.toggle('empty', !me.pots);
  $('btnRecall').innerHTML = night ? '<span>⛩</span><small>Waygate</small>' : '<span>⌂</span><small>Recall</small>';
  const atForge = (me.x - DW.MAP.forge.x) ** 2 + (me.z - DW.MAP.forge.z) ** 2 < 49;
  $('btnShop').classList.toggle('glow', me.shop.any || atForge);
  { const it = interactables(), b = $('btnInteract'); b.classList.toggle('hidden', !it); if (it && b.dataset.k !== it.n) { b.dataset.k = it.n; b.innerHTML = '<span>' + it.icon + '</span><small>' + it.n + '</small>'; } }
  const atBase = (me.x - DW.MAP.fountain.x) ** 2 + (me.z - DW.MAP.fountain.z) ** 2 < 18 * 18;
  $('btnTowns').classList.toggle('glow', atBase);
  if (atBase && !me.dead && !G.townPromptDone && s.towns.some(t => t.team === 0) && $('modalBg').classList.contains('hidden')) { G.townPromptDone = true; toast('At base — open the Council (⚑) to review town budgets', 'info'); }
  if (!atBase) G.townPromptDone = false;
  if (me.rc) { $('channel').classList.remove('hidden'); $('channelFill').style.width = (100 - me.rc[1] / me.rc[2] * 100) + '%'; $('channelTxt').textContent = me.rc[0] === 'base' ? 'Recalling…' : 'Waygate…'; }
  else if (me.rail) { $('channel').classList.remove('hidden'); $('channelFill').style.width = '100%'; $('channelTxt').textContent = 'Riding the rail…'; }
  else $('channel').classList.add('hidden');
  $('deathOv').classList.toggle('hidden', !me.dead); if (me.dead) $('deathTxt').textContent = 'Respawning in ' + me.rt + 's';
  document.body.classList.toggle('dead', !!me.dead);
  const inLaneMe = DW.laneDist(me.x, me.z) < 13 && me.z > -98 && me.z < 98;
  $('nightWarn').classList.toggle('hidden', !(night || s.ec) || !inLaneMe || me.dead || me.tw);
  $('allies').innerHTML = s.h.filter(h => h.pid !== myPid).map(h => `<div class="ally ${h.dead ? 'isDead' : ''}"><div class="aPort">${window.BOD_ICONS.hero(h.hid)}<b>${h.lvl}</b></div><div class="aInfo"><span>${esc(h.n)}</span><div class="mini-bar"><div style="width:${h.dead ? 0 : h.hp / h.mhp * 100}%"></div></div>${h.dead ? `<small class="dead">${h.rt}s</small>` : ''}</div></div>`).join('');
  const invSig = me.it.map(it => it ? it.n : '').join('|');
  if (invSig !== G.invSig) { G.invSig = invSig; $('inv').innerHTML = me.it.map(it => `<div class="slot" style="${it ? 'border-color:' + itemCol(it) : ''}">${it ? window.BOD_ICONS.item(it) : ''}</div>`).join(''); }
  $('buffs').innerHTML = me.bf.map(b => `<span class="buff">${b[0]} ${b[1]}</span>`).join('') + (me.tw ? '<span class="buff ward">Town Ward</span>' : '') + (me.mem ? '<span class="buff mem">★ Member</span>' : '');
  if (modalRefresh && now - (G.modalRefT || 0) > 1000) { G.modalRefT = now; modalRefresh(); }
}
function netWatchdog(now) {
  if (!G.running || G.mode !== 'client' || !G.cur) return;
  if (now - G.lastNet > 4000) {
    $('netOv').classList.remove('hidden'); $('netTxt').textContent = 'Connection lost — reconnecting…';
    if (!G.reconnecting || now - G.reconnectT > 6000) { G.reconnecting = true; G.reconnectT = now; try { openRoomChannel(); } catch (e) { } }
  }
}

// ============================ BOOT ============================
window.addEventListener('load', () => { initMenu(); show('menu'); $('netLeave').onclick = () => { quitGame(); }; });
window.addEventListener('online', () => { if (G.running && G.mode === 'client') { G.reconnectT = 0; G.lastNet = 0; } });
window.BOD = { G, L, send, FOG, get scene() { return scene; }, get camera() { return camera; } };
})();
