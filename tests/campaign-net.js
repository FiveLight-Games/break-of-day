// Campaign over the mocked Supabase relay: host + guest; map, stage start, guest sees encounters + telegraphs, skills sync, stage clear saves on both
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/tmp/kn-shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = q.url.includes('knights') ? 'knights.html' : 'index.html'; r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(path.join(ROOT, f))); }).listen(8783);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [], pages = new Set();
  async function mk(tag, vp) { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.route('**/supabase-js@*/**', r => r.fulfill({ body: fs.readFileSync(ROOT + '/tests/supabase-mock.js', 'utf8'), contentType: 'application/javascript' }));
    await p.exposeFunction('__relayOut', msg => { for (const o of pages) if (o !== p && !o.isClosed()) o.evaluate(m => window.__relayIn && window.__relayIn(m), msg).catch(() => { }); });
    pages.add(p); await p.goto('http://localhost:8783/knights.html?mode=camp'); await p.evaluate(() => localStorage.removeItem('kn_camp')); await p.reload(); await sleep(300); return p; }
  const A = await mk('A', { width: 1000, height: 600 }), B = await mk('B', { width: 1000, height: 600 });
  await A.click('#lHost'); await sleep(300); const code = await A.evaluate(() => document.querySelector('.code').textContent);
  await B.evaluate(c => window.__join(c), code); await sleep(1500);
  const st = p => p.evaluate(() => { const C = __cp.CMP, me = window.__KN()[window.__NETS().me]; return JSON.stringify({ ph: C.ph, st: C.st, E: C.E.map(e => e.s).join(''), lvl: __bh.BH.lvl, walk: __cp.W().length, fx: __cp.FX(), ups: (me.ups || []).join(','), map: document.getElementById('cpMap').style.display }); });
  console.log('map A', await st(A)); console.log('map B', await st(B));
  await A.click('#cpGo'); await sleep(800);
  await A.keyboard.down('d'); await B.keyboard.down('a'); await sleep(1500); await A.keyboard.up('d'); await B.keyboard.up('a');
  await A.evaluate(() => { window.__bhGod = 1; const e = __cp.STAGES[0].E[0]; __cp.tp(e.x, e.y); const g = window.__KN()[1]; g.x = e.x + 20; g.y = e.y; g.T && (g.T.x = g.x, g.T.y = g.y); });
  await sleep(4000); console.log('fight A', await st(A)); console.log('fight B', await st(B)); await B.screenshot({ path: OUT + '/cp-guest.png' });
  await A.evaluate(() => { __cp.STAGES[0].E[1].w = ['naga*2']; __cp.STAGES[0].name = 'Edited'; }); await sleep(3500); console.log('stage synced to guest', await B.evaluate(() => __cp.STAGES[0].name + ' ' + __cp.STAGES[0].E[1].w));
  await A.evaluate(() => { __bh.BH.xp = __bh.BH.need + 1; }); await sleep(800);
  await B.keyboard.press('t'); await sleep(300); await B.click('#cpTree .nd.can'); await sleep(1200);
  console.log('skill A sees guest', await A.evaluate(() => (window.__KN()[1].ups || []).join(',')), 'B', await st(B));
  for (let j = 0; j < 40; j++) { await A.evaluate(() => { __cp.skip(); const C = __cp.CMP, S = __cp.STAGES[C.st]; const e = S.E.find((e, k) => !e.g && C.E[k].s !== 2); if (e) __cp.tp(e.x, e.y); }); await sleep(400); if (await A.evaluate(() => __cp.CMP.ph) !== 1) break; }
  await sleep(1000); console.log('end A', await st(A)); console.log('end B', await st(B));
  console.log('saves', await A.evaluate(() => localStorage.getItem('kn_camp')), await B.evaluate(() => localStorage.getItem('kn_camp')));
  console.log('errors', errs.slice(0, 6)); await b.close(); srv.close(); })();
