const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'index.html');
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(DIST)); }).listen(8765);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: process.env.REAL3 ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const errs = global.__errs = []; const pages = new Set();
  async function mkPage(ctx, tag) {
    const p = await ctx.newPage({ viewport: { width: 900, height: 500 } });
    p.on('pageerror', e => errs.push(tag + ' PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
    p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' CONSOLE ' + m.text()); });
    await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(__dirname + (process.env.REAL3 ? '/three.min.js' : '/three-mock.js'), 'utf8'), contentType: 'application/javascript' }));
    await p.route('**/supabase-js@2', r => r.fulfill({ body: fs.readFileSync(__dirname + '/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.route('**/fonts.googleapis.com/**', r => r.abort()); await p.route('**/fonts.gstatic.com/**', r => r.abort());
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    if (!process.env.INTRO) await p.addInitScript(() => { window.BOD_NO_INTRO = 1; });
    pages.add(p); p.on('close', () => pages.delete(p));
    await p.goto('http://localhost:8765/'); return p;
  }
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const A = await mkPage(ctxA, 'A'), B = await mkPage(ctxB, 'B');
  for (const [pg, n] of [[A, 'HostElijah'], [B, 'Guest']]) { await pg.fill('#nameIn', n); await pg.click('#nameForm button[type=submit]'); await sleep(150); }
  await A.click('[data-act=hostform]'); await sleep(150); await A.click('#hostForm button[type=submit]'); await sleep(400); await A.click('[data-lgm="long"]'); await sleep(300);
  const code = (await A.textContent('#lobbyCode')).replace('Code ', '').trim(); console.log('room code', code);
  await B.click('[data-act=browse]'); await sleep(800); console.log('B room list:', (await B.textContent('#menuPanel')).replace(/\s+/g, ' ').trim().slice(0, 80));
  await B.click('[data-joinlobby]'); await sleep(1200);
  await B.click('.heroCard[data-h="emberwitch"]'); await B.click('#btnReady'); await sleep(400);
  console.log('A players:', (await A.textContent('#playerList')).replace(/\s+/g, ' ').slice(0, 120));
  console.log('B sees mode:', await B.evaluate(() => document.querySelector('#modePick .mode.on').textContent));
  console.log('A start enabled:', !(await A.isDisabled('#btnReady')));
  await A.click('#btnReady'); await sleep(2500);
  const st = async p => p.evaluate(() => { const G = window.BOD.G; return { running: G.running, t: G.cur && G.cur.t, me: G.me && G.me.hid, heroes: G.cur && G.cur.h.map(h => h.n + ':' + h.hid), frames: window.__frames }; });
  console.log('A', JSON.stringify(await st(A))); console.log('B', JSON.stringify(await st(B)));
  for (let i = 0; i < 40 && !(await B.evaluate(() => !!(window.BOD.G.cur && window.BOD.G.me))); i++) await sleep(250);
  { const fa = await A.evaluate(() => window.__frames), fb = await B.evaluate(() => window.__frames); await sleep(3000); console.log('fps A/B', ((await A.evaluate(() => window.__frames)) - fa) / 3, ((await B.evaluate(() => window.__frames)) - fb) / 3, 'snap bytes', await A.evaluate(() => Math.round(window.__bytes / window.__sent))); }
  // B plays: move, level, cast, shop, council
  await A.evaluate(() => { const S = window.BOD.G.sim, h = S.heroes[1]; h.x = DW.MAP.shop.x; h.z = DW.MAP.shop.z + 2; }); await sleep(600);
  console.log('interact button:', await B.evaluate(() => !document.getElementById('btnInteract').classList.contains('hidden') && document.getElementById('btnInteract').textContent));
  await B.dispatchEvent('#btnInteract', 'pointerdown'); await sleep(300); await B.click('[data-buy="sword"]'); await sleep(400); await B.keyboard.press('Escape');
  await B.evaluate(() => { const s = window.BOD.send; s({ c: 'lvl', k: 0 }); s({ c: 'move', x: -10, z: 80 }); });
  await sleep(1500);
  await B.mouse.click(450, 250); await B.keyboard.press('q'); await B.keyboard.press('b'); await sleep(300);
  for (const t of ['adv', 'secret', 'merchant', 'inv', 'basic']) { await B.click(`[data-tab="${t}"]`); await sleep(120); }
  await B.keyboard.press('Escape'); await B.click('#btnTowns'); await sleep(200); await B.click('[data-wc="base"]'); await sleep(200);
  console.log('Base tab:', (await B.textContent('#modal')).replace(/\s+/g, ' ').slice(0, 200));
  await A.evaluate(() => window.BOD.G.sim.heroes.forEach(h => h.gold += 3000)); await sleep(1300);
  await B.click('[data-upg="sight"]'); await sleep(400); await B.keyboard.press('Escape');
  await B.click('#btnStats'); await sleep(200); await B.keyboard.press('Escape');
  await B.click('#hPortrait'); await sleep(200); await B.keyboard.press('Escape');
  await B.click('.ab >> nth=0'); await sleep(200); await B.dispatchEvent('#btnAtk', 'pointerdown'); await sleep(900); await B.dispatchEvent('#btnAtk', 'pointerup'); await sleep(300);
  console.log('B after actions', JSON.stringify(await B.evaluate(() => { const m = window.BOD.G.me; return { g: m.g, rk: m.rk, items: m.it.filter(Boolean).map(i => i.n), x: m.x, z: m.z }; })));
  console.log('A upg', JSON.stringify(await A.evaluate(() => window.BOD.G.cur.upg)));
  console.log('net msgs sent by host', await A.evaluate(() => [window.__sent, Math.round(window.__bytes / window.__sent)]));
  // disconnect B, rejoin with same storage
  await B.close(); await sleep(1500);
  const B2 = await mkPage(ctxB, 'B2'); await sleep(300);
  console.log('rejoin visible:', await B2.isVisible('[data-act=rejoin]'), (await B2.textContent('[data-act=rejoin]')).trim());
  await B2.click('[data-act=rejoin]'); await sleep(2000);
  console.log('B2', JSON.stringify(await st(B2)), 'netOv hidden:', await B2.evaluate(() => document.getElementById('netOv').classList.contains('hidden')));
  await B2.screenshot({ path: __dirname + '/hud.png' });
  // fast-forward host sim to night & raid, then win
  await A.evaluate(() => { const S = window.BOD.G.sim; S.heroes.forEach(h => h.lvl = 6); while (S.t < 392) S.step(); });
  await sleep(1500);
  console.log('night', await B2.evaluate(() => window.BOD.G.cur.ph + ' md=' + JSON.stringify(window.BOD.G.cur.md)), 'feed:', (await B2.textContent('#feed')).slice(0, 200));
  await A.evaluate(() => { const S = window.BOD.G.sim; const c = S.ents.find(e => e.kind === 'core' && e.team === 1); c.invuln = 0; S.damage(S.heroes[0], c, 1e7, 'true'); });
  await sleep(4500);
  console.log('end A:', (await A.textContent('#endTitle')), 'end B2:', (await B2.textContent('#endTitle')));
  console.log('end table rows', await B2.evaluate(() => document.querySelectorAll('#endStats tr').length));
  await B2.screenshot({ path: __dirname + '/end.png' });
  console.log('session cleared:', await B2.evaluate(() => localStorage.getItem('bod_session')));
  // solo
  const C = await mkPage(await browser.newContext(), 'C'); await C.fill('#nameIn', 'Soloist'); await C.click('#nameForm button[type=submit]'); await sleep(100); await C.click('[data-act=solo]'); await sleep(200); await C.click('.heroCard[data-h="lumen"]'); await C.click('#btnReady'); await sleep(1500);
  await C.evaluate(() => { const S = window.BOD.G.sim; for (let i = 0; i < 20 * 400; i++) S.step(); }); await sleep(800);
  console.log('solo', JSON.stringify(await st(C)));
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error('TEST FAIL', String(e).split('\n')[0]); console.error('PAGE ERRORS:', (global.__errs || []).slice(0, 6).join('\n')); process.exit(1); });
