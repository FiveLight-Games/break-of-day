// Opening cinematic: real WebGL frames at each beat, world frozen during it, HUD hidden, then play starts.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/intro';
fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(__dirname, '..', 'index.html'))); }).listen(8767);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'three.min.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/supabase-js@2', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'supabase-mock.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8767/');
  await p.evaluate(() => localStorage.setItem('bod_name', 'Tester')); await p.reload();
  await p.click('[data-act=solo]'); await p.waitForTimeout(200); await p.click('.heroCard[data-h="ironvow"]').catch(() => { }); await p.click('#btnReady');
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!(window.BOD && window.BOD.G.intro && window.BOD.G.cur))); i++) await p.waitForTimeout(250);
  const el = () => p.evaluate(() => window.BOD.G.intro.el);
  const shots = [[1.0, 'title'], [3.6, 'enemy-core'], [6.2, 'lane-L'], [8.6, 'lane-M'], [11.0, 'lane-R'], [12.9, 'hero-swoop'], [16.0, 'hero-ground'], [18.0, 'blend']];
  const info = [];
  for (const [at, name] of shots) {
    while (await p.evaluate(() => !!window.BOD.G.intro) && (await el()) < at) await p.waitForTimeout(60);
    const st = await p.evaluate(() => ({ intro: !!window.BOD.G.intro, t: window.BOD.G.cur.t, hud: getComputedStyle(document.getElementById('hudBR')).visibility, cap: document.querySelector('#introCap b').textContent, capO: document.getElementById('introCap').style.opacity, ents: window.BOD.G.cur.e.length }));
    await p.screenshot({ path: `${OUT}/${name}.png` }); info.push([name, JSON.stringify(st)]);
  }
  for (let i = 0; i < 400 && await p.evaluate(() => !!window.BOD.G.intro); i++) await p.waitForTimeout(250);
  await p.waitForTimeout(3000);
  const after = await p.evaluate(() => ({ intro: !!window.BOD.G.intro, t: window.BOD.G.cur.t, hud: getComputedStyle(document.getElementById('hudBR')).visibility, fogOn: true }));
  await p.screenshot({ path: `${OUT}/gameplay.png` });
  info.forEach(r => console.log(r[0].padEnd(12), r[1]));
  console.log('after       ', JSON.stringify(after));
  const frozen = info.filter(r => JSON.parse(r[1]).intro).every(r => JSON.parse(r[1]).t === 0), hidHud = info.filter(r => JSON.parse(r[1]).intro).every(r => JSON.parse(r[1]).hud === 'hidden');
  const ok = frozen && hidHud && !after.intro && after.t > 1 && after.hud === 'visible' && !errs.length;
  console.log('frozen during intro', frozen, '| hud hidden', hidHud, '| errors', errs.length ? errs.join(' | ') : 'none'); console.log(ok ? 'INTRO OK' : 'INTRO FAIL');
  await b.close(); srv.close(); process.exit(ok ? 0 : 1);
})();
