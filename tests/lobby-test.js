// End-to-end: 3 players (host / browse / find), seats, colors, map + race pickers, a real match, then vs AI.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/td-shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(__dirname, '..', 'index.html'))); }).listen(8780);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], pages = new Set();
  async function mk(tag, name, vp) {
    const ctx = await b.newContext({ viewport: vp || { width: 1000, height: 560 }, hasTouch: !!vp, isMobile: !!vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000);
    p.on('pageerror', e => errs.push(tag + ': ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts/.test(m.text())) errs.push(tag + ' console: ' + m.text()); });
    await p.route('**/supabase-js@*/**', r => r.fulfill({ body: fs.readFileSync(__dirname + '/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.route('**/fonts.g*/**', r => r.abort());
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); await p.goto('http://localhost:8780/');
    await p.fill('#nameIn', name); await p.click('#nameForm button[type=submit]'); await sleep(100); return p;
  }
  const A = await mk('A', 'Elijah'), B = await mk('B', 'Raider', { width: 390, height: 844 }), C = await mk('C', 'Warden', { width: 390, height: 844 });
  // A hosts
  await A.click('[data-act=hostForm]'); await A.fill('#lobbyIn', 'Test Lobby'); await A.click('#hostForm button[type=submit]'); await sleep(800);
  check(await A.isVisible('#lobby'), 'host lands in the lobby');
  check(await A.evaluate(() => document.querySelectorAll('.mapCard:not([disabled])').length === 1 && document.querySelectorAll('.mapCard').length === 3), 'map picker: Greenvale available, 2 coming soon');
  check(await A.evaluate(() => [...document.querySelectorAll('.race')].map(b => b.textContent.split(/Available|Coming/)[0] + (b.disabled ? '-' : '+')).join(',')) === 'Human+,Orc-,Elf-,Dwarf-', 'races: Human on, Orc/Elf/Dwarf greyed');
  check(await A.evaluate(() => document.querySelectorAll('.swatch').length) === 10, '10 colors');
  // B browses and joins
  await B.click('[data-act=browse]'); await sleep(1500);
  check(await B.evaluate(() => document.querySelector('.lobbyItem') && document.querySelector('.lobbyItem').textContent.includes('Test Lobby')), 'lobby browser lists the lobby');
  await B.click('.lobbyItem'); await sleep(1500);
  check(await B.isVisible('#lobby'), 'B joined from the browser');
  // B takes the attacker seat and picks a color
  await B.click('.seat.open[data-seat="0"]'); await sleep(600);
  check(await A.evaluate(() => window.TDC.LS.seats[0]) === await B.evaluate(() => localStorage.getItem('td_pid')), 'B is the attacker');
  await B.click('.swatch[title="Purple"]'); await sleep(600);
  // C finds a match
  await C.click('[data-act=find]'); await sleep(2500);
  check(await C.isVisible('#lobby'), 'C joined via Find Match');
  check(await C.evaluate(() => document.querySelector('.swatch[title="Purple"]').disabled), "C can't pick B's color");
  const cols = await A.evaluate(() => Object.values(window.TDC.LS.pl).map(p => p.color)); check(new Set(cols).size === cols.length, 'every player has a different color: ' + cols.join(','));
  await C.click('.swatch[title="Green"]'); await sleep(400);
  await A.screenshot({ path: OUT + '/lobby-host.png' }); await C.screenshot({ path: OUT + '/lobby-guest.png' });
  check(await A.evaluate(() => document.getElementById('btnReady').disabled), 'host cannot start before everyone is ready');
  await B.click('#btnReady'); await C.click('#btnReady'); await sleep(700);
  check(!(await A.evaluate(() => document.getElementById('btnReady').disabled)), 'host can start once ready');
  await A.click('#btnReady'); await sleep(1500);
  for (const [p, t] of [[A, 'A'], [B, 'B'], [C, 'C']]) check(await p.evaluate(() => !!(window.TDC.V && window.TDC.GS.running)), t + ' is in the match');
  // free 2x2 spots near my lane, scored by distance to the lane point at path distance d
  const spots = (P, n, d) => P.evaluate(([n, d]) => { const V = window.TDC.V, L = V.L, lane = L.lanes[V.myDef.slot], pt = lane.at(d), out = [], occ = V.occ.slice();
    const cand = []; for (let r = 0; r < L.rows - 1; r++) for (let c = 0; c < L.cols - 1; c++) { const x = (c + 1) * 24, y = (r + 1) * 24, dd = Math.hypot(x - pt[0], y - pt[1]); if (dd < 260) cand.push([dd, c, r]); }
    cand.sort((a, b) => a[0] - b[0]); for (const [, c, r] of cand) { if (out.length >= n) break; if (TD.footFree(L, c, r, occ)) { out.push([c, r]); for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) occ[(r + j) * L.cols + c + i] = 1; } } return out; }, [n, d]);
  check(await A.evaluate(() => window.TDC.V.hp === 500 && window.TDC.V.hpMax === 500), 'shared base HP = 250 x 2 defenders');
  check(await A.evaluate(() => document.getElementById('hpChip').textContent.includes('500')), 'HP chip shows 500');
  check(await B.evaluate(() => document.getElementById('buildBtn').classList.contains('hidden')), 'attacker has no Build button');
  // C: real drag from the tray onto the field (mouse pointer, so no finger offset)
  await C.click('#buildBtn'); await sleep(300);
  check(await C.isVisible('#buildTray'), 'build mode opens the tray');
  const g0 = await C.evaluate(() => window.TDC.V.myDef.gold);
  const [[tc, tr]] = await spots(C, 1, 450);
  await C.evaluate(([c, r]) => { const cam = window.TDC.cam; cam.x = (c + 1) * 24; cam.y = (r + 1) * 24; }, [tc, tr]); await sleep(200);
  const card = await C.locator('#buildTray [data-tw=archer]').boundingBox();
  await C.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await C.mouse.down();
  await C.mouse.move(195, 600, { steps: 5 }); await C.mouse.move(195, 422, { steps: 5 }); await sleep(250);
  const dr = await C.evaluate(() => { const d = window.TDC.build.drag; return d && { ok: d.ok, c: d.c, r: d.r }; });
  check(dr && dr.ok, 'drag over a free spot is valid: ' + JSON.stringify(dr));
  await C.screenshot({ path: OUT + '/build-drag.png' });
  check(await C.evaluate(() => window.TDC.V.myDef.gold) === g0, 'no gold spent while dragging');
  await C.mouse.up(); await sleep(600);
  check(await C.evaluate(() => window.TDC.V.towers.length) === 1, 'tower placed on release');
  await C.screenshot({ path: OUT + '/build-construct.png' });
  check(await C.evaluate(g0 => window.TDC.V.myDef.gold <= g0 - 60 + 2, g0), 'gold spent on build');
  // drag onto the occupied spot shows red / invalid, then drop back on the tray cancels
  await C.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await C.mouse.down(); await C.mouse.move(195, 422, { steps: 6 }); await sleep(150);
  check(await C.evaluate(() => !window.TDC.build.drag.ok), 'occupied cells are invalid');
  await C.screenshot({ path: OUT + '/build-blocked.png' });
  await C.mouse.move(card.x + card.width / 2, card.y + 10, { steps: 6 }); await C.mouse.up(); await sleep(400);
  check(await C.evaluate(() => window.TDC.V.towers.length) === 1, 'dropping back on the tray cancels');
  // a tower on a road cell is refused by the host
  await A.evaluate(() => { const L = window.TDC.V.L, p = L.lanes[0].at(600); window.TDC.send({ c: 'build', k: 'archer', c2: Math.round(p[0] / 24 - 1), r: Math.round(p[1] / 24 - 1) }); });
  // both defenders build more via input
  for (const P of [A, C]) { const sp = await spots(P, 2, 300); await P.evaluate(sp => sp.forEach(([c, r], i) => window.TDC.send({ c: 'build', k: ['cannon', 'archer'][i], c2: c, r })), sp); }
  await sleep(800);
  const nt = await C.evaluate(() => window.TDC.V.towers.length);
  check(nt === 5, 'towers from both defenders show on every screen, road build refused: ' + nt);
  check(await C.evaluate(() => window.TDC.V.towers.some(t => t.readyAt > window.TDC.V.clock)), 'new towers are under construction');
  await C.click('#buildBtn'); await sleep(200);
  check(!(await C.isVisible('#buildTray')), 'Done closes build mode');
  await B.evaluate(() => { window.TDC.send({ c: 'send', k: 'grunt', lane: 'all', n: 10 }); window.TDC.send({ c: 'send', k: 'brute', lane: 0, n: 1 }); });
  await sleep(1200);
  check(await B.evaluate(() => window.TDC.V.atk.queue.length) === 21, 'attacker queue shows the wave');
  const goldBefore = await Promise.all([A, C].map(P => P.evaluate(() => window.TDC.V.myDef.gold)));
  check(!(await C.evaluate(() => !!document.getElementById('voteBtn'))), 'no Start Now button');
  await C.waitForFunction(() => window.TDC.V.wave >= 1 && window.TDC.V.units.size > 0, null, { timeout: 20000 });
  await C.evaluate(() => { window.__maxDead = 0; setInterval(() => { window.__maxDead = Math.max(window.__maxDead, (window.TDC.V.deadBars || []).length); }, 50); });
  const st = await C.evaluate(() => ({ units: window.TDC.V.units.size, wave: window.TDC.V.wave, gold: window.TDC.V.myDef.gold }));
  check(st.wave >= 1 && st.units > 0, 'first wave marched on the timer: ' + JSON.stringify(st));
  await sleep(9000);
  check(await C.evaluate(() => window.__maxDead) > 0, 'empty health bars linger after kills: max ' + await C.evaluate(() => window.__maxDead));
  const ks = await A.evaluate(() => window.TDC.GS.sim.defs.map(d => ({ kills: d.kills, shared: d.shared })));
  check(ks.some(k => k.kills > 0) && ks[0].shared === ks[1].shared && ks[0].shared > 0, 'kill gold is shared equally: ' + JSON.stringify(ks));
  await C.evaluate(() => window.TDC.lookAtLane(window.TDC.V.myDef.slot)); await sleep(300);
  await C.screenshot({ path: OUT + '/game-defender.png' }); await B.screenshot({ path: OUT + '/game-attacker.png' }); await A.screenshot({ path: OUT + '/game-host.png' });
  await A.evaluate(() => { const c = window.TDC.cam, b = window.TDC.V.L.base; c.x = b.x; c.y = b.y - 120; c.z = 1.3; }); await sleep(300); await A.screenshot({ path: OUT + '/game-base.png' });
  await A.evaluate(() => { const t = window.TDC.V.towers.filter(t => t.slot === 0), c = window.TDC.cam; c.x = t.reduce((s, o) => s + o.x, 0) / t.length; c.y = t.reduce((s, o) => s + o.y, 0) / t.length; c.z = 2.2; }); await sleep(300); await A.screenshot({ path: OUT + '/game-towers.png' });
  // attacker speed upgrade: affects units sent afterwards
  await A.evaluate(() => { window.TDC.GS.sim.atk.gold += 600; }); await sleep(600);
  const spBefore = await A.evaluate(() => Math.max(...window.TDC.GS.sim.units.filter(u => u.k === 'runner').map(u => u.sp), 0));
  await B.click('[data-speed]'); await sleep(600);
  check(await B.evaluate(() => window.TDC.V.atk.speed) === 1 && await A.evaluate(() => window.TDC.GS.sim.atk.speed) === 1, 'attacker bought speed level 1');
  check(await B.evaluate(() => document.querySelector('[data-speed]').textContent.includes('2/5')), 'speed button advances to 2/5');
  await B.screenshot({ path: OUT + '/game-attacker-speed.png' });
  // portrait: tapping a tower hides the Build button, closing the sheet brings it back
  await C.evaluate(() => { const t = window.TDC.V.towers.find(t => t.owner === window.TDC.V.myDef.pid) || window.TDC.V.towers[0]; window.TDC.cam.x = t.x; window.TDC.cam.y = t.y; window.TDC.onTap(t.x, t.y); }); await sleep(300);
  check(await C.isVisible('#sheet') && !(await C.isVisible('#buildBtn')), 'tower sheet open, Build button hidden');
  await C.screenshot({ path: OUT + '/tower-sheet-portrait.png' });
  await C.click('#sheet [data-close]'); await sleep(200);
  check(await C.isVisible('#buildBtn'), 'Build button back after closing the sheet');
  check(await C.evaluate(() => !window.TDC.V.over), 'match running');
  // vs AI
  const D = await mk('D', 'Solo', { width: 390, height: 844 });
  await D.click('[data-act=vsai]'); await sleep(300);
  check(await D.evaluate(() => window.TDC.LS.seats[0] === 'ai'), 'vs AI: AI takes the attacker seat');
  await D.click('#btnReady'); await sleep(500);
  { const sp = await spots(D, 5, 400); await D.evaluate(sp => sp.forEach(([c, r]) => window.TDC.send({ c: 'build', k: 'archer', c2: c, r })), sp); }
  check(await D.evaluate(() => window.TDC.V.hpMax) === 250, 'solo base HP = 250');
  await sleep(20000);
  const sd = await D.evaluate(() => ({ units: window.TDC.V.units.size, towers: window.TDC.V.towers.length, wave: window.TDC.V.wave, hp: window.TDC.V.hp }));
  check(sd.wave >= 1 && sd.towers >= 3, 'vs AI match runs: ' + JSON.stringify(sd));
  await D.screenshot({ path: OUT + '/game-vsai.png' });
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  console.log(fails ? 'LOBBY FAIL ' + fails : 'LOBBY OK');
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
