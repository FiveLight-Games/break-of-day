const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'index.html');
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(DIST)); }).listen(8765);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = []; const pages = new Set();
  async function mkPage(ctx, tag) {
    const p = await ctx.newPage({ viewport: { width: 900, height: 500 } });
    p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
    p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' CONSOLE ' + m.text()); });
    await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(__dirname + '/three-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.route('**/supabase-js@2', r => r.fulfill({ body: fs.readFileSync(__dirname + '/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.route('**/fonts.googleapis.com/**', r => r.abort()); await p.route('**/fonts.gstatic.com/**', r => r.abort());
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); p.on('close', () => pages.delete(p));
    await p.goto('http://localhost:8765/'); return p;
  }
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const A = await mkPage(ctxA, 'A'), B = await mkPage(ctxB, 'B');
  await A.fill('#nameIn', 'HostElijah'); await B.fill('#nameIn', 'Guest');
  await A.click('#btnCreate'); await sleep(400);
  const code = (await A.textContent('#lobbyCode')).trim(); console.log('room code', code);
  await sleep(300); console.log('B room list:', (await B.textContent('#roomList')).trim().slice(0, 80));
  await B.fill('#codeIn', code); await B.click('#btnJoin'); await sleep(400);
  await B.click('.heroCard[data-h="emberwitch"]'); await B.click('#btnReady'); await sleep(400);
  console.log('A players:', (await A.textContent('#playerList')).replace(/\s+/g, ' ').slice(0, 120));
  console.log('A start enabled:', !(await A.isDisabled('#btnReady')));
  await A.click('#btnReady'); await sleep(2500);
  const st = async p => p.evaluate(() => { const G = window.BOD.G; return { running: G.running, t: G.cur && G.cur.t, me: G.me && G.me.hid, heroes: G.cur && G.cur.h.map(h => h.n + ':' + h.hid), frames: window.__frames }; });
  console.log('A', JSON.stringify(await st(A))); console.log('B', JSON.stringify(await st(B)));
  // B plays: move, level, cast, shop, council
  await B.keyboard.press('b'); await sleep(300); await B.click('[data-buy="sword"]'); await sleep(400); await B.keyboard.press('Escape');
  await B.evaluate(() => { const s = window.BOD.send; s({ c: 'lvl', k: 0 }); s({ c: 'move', x: -10, z: 80 }); });
  await sleep(1500);
  await B.mouse.click(450, 250); await B.keyboard.press('q'); await B.keyboard.press('b'); await sleep(300);
  for (const t of ['adv', 'secret', 'merchant', 'inv', 'basic']) { await B.click(`[data-tab="${t}"]`); await sleep(120); }
  await B.keyboard.press('Escape'); await B.click('#btnTowns'); await sleep(200); await B.click('[data-wc="base"]'); await sleep(200);
  console.log('Base tab:', (await B.textContent('#modal')).replace(/\s+/g, ' ').slice(0, 200));
  await A.evaluate(() => window.BOD.G.sim.heroes.forEach(h => h.gold += 3000)); await sleep(1300);
  await B.click('[data-upg="sight"]'); await sleep(400); await B.keyboard.press('Escape');
  await B.click('#btnStats'); await sleep(200); await B.keyboard.press('Escape');
  await B.click('#btnHero'); await sleep(200); await B.keyboard.press('Escape');
  await B.click('.ab >> nth=0'); await sleep(100); await B.mouse.click(500, 200); await sleep(300);
  console.log('B after actions', JSON.stringify(await B.evaluate(() => { const m = window.BOD.G.me; return { g: m.g, rk: m.rk, items: m.it.filter(Boolean).map(i => i.n), x: m.x, z: m.z }; })));
  console.log('A upg', JSON.stringify(await A.evaluate(() => window.BOD.G.cur.upg)));
  console.log('net msgs sent by host', await A.evaluate(() => [window.__sent, Math.round(window.__bytes / window.__sent)]));
  // disconnect B, rejoin with same storage
  await B.close(); await sleep(1500);
  const B2 = await mkPage(ctxB, 'B2'); await sleep(300);
  console.log('rejoin visible:', await B2.isVisible('#btnRejoin'), (await B2.textContent('#btnRejoin')).trim());
  await B2.click('#btnRejoin'); await sleep(2000);
  console.log('B2', JSON.stringify(await st(B2)), 'netOv hidden:', await B2.evaluate(() => document.getElementById('netOv').classList.contains('hidden')));
  await B2.screenshot({ path: __dirname + '/hud.png' });
  // fast-forward host sim to night & raid, then win
  await A.evaluate(() => { const S = window.BOD.G.sim; S.heroes.forEach(h => h.lvl = 6); while (S.t < 242) S.step(); });
  await sleep(1500);
  console.log('night', await B2.evaluate(() => window.BOD.G.cur.ph), 'feed:', (await B2.textContent('#feed')).slice(0, 200));
  await A.evaluate(() => { const S = window.BOD.G.sim; const c = S.ents.find(e => e.kind === 'core' && e.team === 1); c.invuln = 0; S.damage(S.heroes[0], c, 1e7, 'true'); });
  await sleep(4500);
  console.log('end A:', (await A.textContent('#endTitle')), 'end B2:', (await B2.textContent('#endTitle')));
  console.log('end table rows', await B2.evaluate(() => document.querySelectorAll('#endStats tr').length));
  await B2.screenshot({ path: __dirname + '/end.png' });
  console.log('session cleared:', await B2.evaluate(() => localStorage.getItem('bod_session')));
  // solo
  const C = await mkPage(await browser.newContext(), 'C'); await C.click('#btnSolo'); await sleep(200); await C.click('.heroCard[data-h="lumen"]'); await C.click('#btnReady'); await sleep(1500);
  await C.evaluate(() => { const S = window.BOD.G.sim; for (let i = 0; i < 20 * 400; i++) S.step(); }); await sleep(800);
  console.log('solo', JSON.stringify(await st(C)));
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
