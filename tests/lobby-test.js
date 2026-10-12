// Two/three browsers through the Connect-War-style menu: name → Host lobby / Find lobby / Find match → ready → start.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.env.OUT || __dirname;
const srv = http.createServer((q, r) => { r.setHeader('content-type', q.url.startsWith('/version.json') ? 'application/json' : 'text/html'); r.end(fs.readFileSync(path.join(__dirname, '..', q.url.startsWith('/version.json') ? 'version.json' : 'index.html'))); }).listen(8790);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [], pages = new Set();
  async function mk(tag, w = 844, h = 390) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(tag + ' ' + m.text()); });
    await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, process.env.REAL3 ? 'three.min.js' : 'three-mock.js'), 'utf8'), contentType: 'application/javascript' }));
    await p.route('**/supabase-js@2', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'supabase-mock.js'), 'utf8'), contentType: 'application/javascript' }));
    await p.route('**/fonts.g*/**', r => r.abort());
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); await p.goto('http://localhost:8790/'); return p;
  }
  const A = await mk('A'), B = await mk('B'), C = await mk('C', 390, 844);
  await sleep(500);
  console.log('A first screen:', (await A.textContent('#menuPanel')).replace(/\s+/g, ' ').trim().slice(0, 60));
  await A.screenshot({ path: OUT + '/m_name.png' });
  for (const [p, n] of [[A, 'Elijah'], [B, 'Guest'], [C, 'Third']]) { await p.fill('#nameIn', n); await p.click('#nameForm button[type=submit]'); await sleep(150); }
  console.log('A home:', (await A.textContent('#menuPanel')).replace(/\s+/g, ' ').trim().slice(0, 140));
  await A.screenshot({ path: OUT + '/m_home.png' }); await C.screenshot({ path: OUT + '/m_home_portrait.png' });
  // A hosts
  await A.click('[data-act=hostform]'); await sleep(150); await A.fill('#lobbyIn', 'Dawn Patrol'); await A.click('[data-max="3"]'); await A.click('[data-gm="long"]');
  await A.screenshot({ path: OUT + '/m_host.png' });
  await A.click('#hostForm button[type=submit]'); await sleep(600);
  console.log('A lobby:', (await A.textContent('#lobby .panel')).replace(/\s+/g, ' ').trim().slice(0, 160));
  // B finds lobby
  await B.click('[data-act=browse]'); await sleep(800);
  console.log('B browse:', (await B.textContent('#menuPanel')).replace(/\s+/g, ' ').trim().slice(0, 160));
  await B.screenshot({ path: OUT + '/m_browse.png' });
  await B.click('[data-joinlobby]'); await sleep(1200);
  await B.click('.heroCard[data-h="thornshot"]'); await sleep(150); await B.click('#btnReady'); await sleep(500);
  // C uses Find match (mode long) → should join the same lobby
  await C.click('[data-gm="long"]'); await C.click('[data-act=quick]'); await sleep(1800);
  console.log('C screen:', await C.evaluate(() => [...document.querySelectorAll('.screen,#game')].filter(e => !e.classList.contains('hidden')).map(e => e.id).join(',')), (await C.textContent('#lobbyTitle')));
  await C.click('.heroCard[data-h="lumen"]'); await C.click('#btnReady'); await sleep(700);
  console.log('A seats:', (await A.textContent('#playerList')).replace(/\s+/g, ' ').trim());
  await A.screenshot({ path: OUT + '/m_lobby.png' });
  console.log('A start enabled:', !(await A.isDisabled('#btnReady')), await A.textContent('#btnReady'));
  // lobby row advertised
  console.log('table rows:', JSON.stringify(await B.evaluate(() => Object.values(window.__db).map(r => [r.name, r.mode, r.joined + '/' + r.n, r.heroes]))));
  await A.click('#btnReady'); await sleep(2500);
  const st = p => p.evaluate(() => ({ run: window.BOD.G.running, md: window.BOD.G.cur && window.BOD.G.cur.md[0], heroes: window.BOD.G.cur && window.BOD.G.cur.h.map(h => h.n + ':' + h.hid).join(' ') }));
  console.log('A', JSON.stringify(await st(A))); console.log('B', JSON.stringify(await st(B))); console.log('C', JSON.stringify(await st(C)));
  console.log('table after start:', JSON.stringify(await B.evaluate(() => Object.keys(window.__db))));
  // Find match with nobody around → becomes quick-match host
  const D = await mk('D'); await D.fill('#nameIn', 'Solo'); await D.click('#nameForm button[type=submit]'); await sleep(100); await D.click('[data-act=quick]'); await sleep(1500);
  console.log('D quick:', await D.textContent('#lobbyTitle'), '|', (await D.textContent('#lobbyEyebrow')));
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  await b.close(); srv.close();
})().catch(e => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });
