// Settings: joystick static/dynamic, drag-to-reposition controls (from menu and in-game), persistence.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/ctl'; fs.mkdirSync(OUT, { recursive: true });
const REAL = !!process.env.REAL3;
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(__dirname, '..', 'index.html'))); }).listen(8769);
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: REAL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); await p.addInitScript(() => { window.BOD_NO_INTRO = 1; });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, REAL ? 'three.min.js' : 'three-mock.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/supabase-js@2', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'supabase-mock.js'), 'utf8'), contentType: 'application/javascript' }));
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8769/'); await p.evaluate(() => localStorage.setItem('bod_name', 'Tester')); await p.reload();
  const rect = id => p.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, id);
  const ptr = (sel, type, x, y, id = 7) => p.evaluate(([sel, type, x, y, id]) => document.querySelector(sel).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: true })), [sel, type, x, y, id]);
  const drag = async (sel, x1, y1, x2, y2) => { await ptr(sel, 'pointerdown', x1, y1); for (let i = 1; i <= 6; i++) await ptr(sel, 'pointermove', x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6); await ptr(sel, 'pointerup', x2, y2); };
  // --- from the main menu
  await p.click('[data-act=settings]'); await p.waitForTimeout(100);
  check(await p.isVisible('#modal [data-joy=static]'), 'settings opens from main menu');
  await p.click('#modal [data-joy=static]'); await p.waitForTimeout(50);
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('bod_ctl') || localStorage.getItem('ctl') || '{}').joy === 'static' || window.BOD.CTL.joy === 'static'), 'static joystick saved');
  await p.screenshot({ path: OUT + '/settings.png' });
  await p.click('#setLayout'); await p.waitForTimeout(150);
  check(await p.isVisible('#hudEdit') && await p.isVisible('#abQ'), 'layout editor opens over a preview of the HUD');
  const q0 = await rect('abQ'), j0 = await rect('joy'), a0 = await rect('btnAtk');
  await drag('#hudEdit', q0.x, q0.y, q0.x - 330, q0.y - 40);
  await drag('#hudEdit', j0.x, j0.y, j0.x + 80, j0.y - 50);
  const q1 = await rect('abQ'), j1 = await rect('joy');
  check(Math.abs(q1.x - (q0.x - 330)) < 3 && Math.abs(q1.y - (q0.y - 40)) < 3, `ability 1 dragged (${q0.x.toFixed(0)},${q0.y.toFixed(0)}) -> (${q1.x.toFixed(0)},${q1.y.toFixed(0)})`);
  check(Math.abs(j1.x - (j0.x + 80)) < 3, 'joystick dragged');
  // can't be dragged off-screen
  const a1 = await rect('btnAtk'); await drag('#hudEdit', a1.x, a1.y, a1.x + 500, a1.y + 500); const a2 = await rect('btnAtk');
  check(a2.x + a2.w / 2 <= 916 && a2.y <= 412, 'attack button stays on screen when dragged past the edge');
  await p.screenshot({ path: OUT + '/editor-menu.png' });
  await p.click('#editDone'); await p.waitForTimeout(100);
  check(await p.isVisible('#menuPanel') && !(await p.isVisible('#hudEdit')), 'Done returns to the menu');
  // --- persisted into a match
  await p.reload(); await p.click('[data-act=solo]'); await p.waitForTimeout(200); await p.click('#btnReady');
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!(window.BOD && window.BOD.G.cur))); i++) await p.waitForTimeout(250);
  await p.waitForTimeout(300);
  const q2 = await rect('abQ'), j2 = await rect('joy');
  check(Math.abs(q2.x - q1.x) < 3 && Math.abs(j2.x - j1.x) < 3, 'custom layout survives reload into a match');
  // --- static joystick behaviour
  const cv = '#view canvas';
  await ptr(cv, 'pointerdown', 120, 120, 11);
  check(await p.evaluate(() => !window.BOD.G.look === false && !window.BOD.G.joyActive), 'static: touch away from the ring does not grab the joystick');
  await ptr(cv, 'pointerup', 120, 120, 11);
  const hz0 = await p.evaluate(() => window.BOD.G.me.z);
  await ptr(cv, 'pointerdown', j2.x + 5, j2.y + 5, 12); await ptr(cv, 'pointermove', j2.x, j2.y - 140, 12);
  const j3 = await rect('joy'); const knob = await p.evaluate(() => { const k = document.getElementById('joyKnob').getBoundingClientRect(); return k.top + k.height / 2; });
  check(Math.abs(j3.x - j2.x) < 2 && Math.abs(j3.y - j2.y) < 2, 'static: ring stays put while dragging');
  check(Math.abs((j2.y - knob) - 52 * await p.evaluate(() => window.BOD.uiScale ? 1 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')))) < 3, 'static: knob clamped to the ring');
  await p.waitForTimeout(900); const hz1 = await p.evaluate(() => window.BOD.G.me.z); await ptr(cv, 'pointerup', j2.x, j2.y - 140, 12);
  check(hz1 < hz0 - 1, `static: hero walks (z ${hz0} -> ${hz1})`);
  // --- in-game settings: switch to dynamic, move the joystick to the right side (left-handed layout)
  await p.click('#btnMenu'); await p.click('#mSettings'); await p.click('#modal [data-joy=dynamic]'); await p.click('#setLayout'); await p.waitForTimeout(100);
  check(await p.isVisible('#hudEdit'), 'layout editor opens in-game');
  const j4 = await rect('joy'); await drag('#hudEdit', j4.x, j4.y, 700, 330);
  await p.screenshot({ path: OUT + '/editor-game.png' });
  await p.click('#editDone');
  await ptr(cv, 'pointerdown', 300, 250, 13); const leftGrab = await p.evaluate(() => document.getElementById('joy').classList.contains('on')); await ptr(cv, 'pointerup', 300, 250, 13);
  await ptr(cv, 'pointerdown', 650, 200, 14); const rightGrab = await p.evaluate(() => document.getElementById('joy').classList.contains('on')); const j5 = await rect('joy'); await ptr(cv, 'pointerup', 650, 200, 14);
  check(!leftGrab && rightGrab && Math.abs(j5.x - 650) < 2, 'dynamic: joystick moved to the right half follows the thumb there');
  const j6 = await rect('joy'); check(Math.abs(j6.x - 700) < 3 && Math.abs(j6.y - 330) < 3, 'dynamic: returns to its rest spot on release');
  await p.screenshot({ path: OUT + '/game.png' });
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  console.log(fails ? 'CONTROLS FAIL ' + fails : 'CONTROLS OK');
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
