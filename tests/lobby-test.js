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
  // defenders build on the first pads; attacker sends
  for (const P of [A, C]) await P.evaluate(() => { const V = window.TDC.V, D = V.myDef; for (const i of [3, 6, 9]) { window.TDC.send({ c: 'build', k: ['archer', 'cannon', 'frost'][i % 3], pad: i }); } });
  await B.evaluate(() => { window.TDC.send({ c: 'send', k: 'grunt', lane: 'all', n: 10 }); window.TDC.send({ c: 'send', k: 'brute', lane: 0, n: 1 }); });
  await sleep(1200);
  check(await C.evaluate(() => window.TDC.V.towers.length) === 6, 'towers from both defenders show on every screen');
  check(await B.evaluate(() => window.TDC.V.atk.queue.length) === 21, 'attacker queue shows the wave');
  // everyone votes to start early
  for (const P of [A, B, C]) await P.evaluate(() => window.TDC.send({ c: 'vote' }));
  await sleep(1500);
  const st = await C.evaluate(() => ({ units: window.TDC.V.units.size, wave: window.TDC.V.wave, gold: window.TDC.V.myDef.gold }));
  check(st.wave >= 1 && st.units > 0, 'early vote launched the wave: ' + JSON.stringify(st));
  await sleep(6000);
  await sleep(600);
  await C.screenshot({ path: OUT + '/game-defender.png' }); await B.screenshot({ path: OUT + '/game-attacker.png' });
  check(await C.evaluate(() => window.TDC.V.defs.every(d => d.alive)), 'match running');
  // vs AI
  const D = await mk('D', 'Solo', { width: 390, height: 844 });
  await D.click('[data-act=vsai]'); await sleep(300);
  check(await D.evaluate(() => window.TDC.LS.seats[0] === 'ai'), 'vs AI: AI takes the attacker seat');
  await D.click('#btnReady'); await sleep(500);
  await D.evaluate(() => { for (const i of [2, 4, 7, 10, 12]) window.TDC.send({ c: 'build', k: 'archer', pad: i }); });
  await sleep(20000);
  const sd = await D.evaluate(() => ({ units: window.TDC.V.units.size, towers: window.TDC.V.towers.length, wave: window.TDC.V.wave, lives: window.TDC.V.myDef.lives }));
  check(sd.wave >= 1 && sd.towers >= 3, 'vs AI match runs: ' + JSON.stringify(sd));
  await D.screenshot({ path: OUT + '/game-vsai.png' });
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  console.log(fails ? 'LOBBY FAIL ' + fails : 'LOBBY OK');
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
