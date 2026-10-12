// Real-WebGL screenshot harness: node tests/shot.js out.png [w] [h] [setupJS]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [out, W = '915', H = '412', setup = ''] = process.argv.slice(2);
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(__dirname, '..', 'index.html'))); }).listen(+process.env.PORT || 8766);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  if (!process.env.INTRO) await p.addInitScript(() => { window.BOD_NO_INTRO = 1; });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | '))); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'three.min.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/supabase-js@2', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'supabase-mock.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:' + (+process.env.PORT || 8766) + '/');
  await p.evaluate(() => localStorage.setItem('bod_name', 'Tester')); await p.reload(); await p.click('[data-act=solo]'); await p.waitForTimeout(200); await p.click('#btnReady'); await p.waitForTimeout(2500);
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!(window.BOD && window.BOD.G.cur))); i++) await p.waitForTimeout(500);
  if (errs.length) console.log('early errors:', errs.join(' | '));
  if (setup) await p.evaluate(setup);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out });
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await b.close(); srv.close();
})();
