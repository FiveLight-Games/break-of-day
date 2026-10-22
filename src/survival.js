// ===================== Survival: a bullet-hell run (BH) =====================
// Inlined into knights.html by build.py (at /*@SURVIVAL@*/). The run is host-authoritative like the rest of Knight Brawl:
// the host spawns, levels the team up, applies picked cards and deals all damage; guests get BH in the snapshot (`rn`)
// and every bullet volley as a spawn event (`bl`), which every screen flies the same way.
// Characters as they are now are their final form: a run starts with the basic attack only; level-up cards unlock
// each ability (Dash, Leap, Spin ...), the ult, the character's special upgrades (the things added to their kits over time)
// and stat boosts that go past the final form.
const BH = { on: 0, go: 0, t: 0, lvl: 1, xp: 0, need: 10, over: 0, pause: 0, spT: 0, elT: 60, boss: 0, best: 0 };
let BHMODE = (() => { const q = new URLSearchParams(location.search).get('mode'); if (q === 'box' || q === 'run') return q; try { return localStorage.getItem('kn_mode') || 'run'; } catch (e) { return 'run'; } })();
const BHC = { HP: 100, IV: 0.35, CONTACT: 5, REV: 2.5, REVR: 20, AUTO: 25, BR: 2.1, KR: 3.2, BMAX: 380 };
const BUL = []; let BEV = [];
const bhUp = (kn, id) => !BH.on || !!(kn && kn.ups && kn.ups.indexOf(id) >= 0);
const bhN = (kn, id) => kn && kn.ups ? kn.ups.reduce((a, u) => a + (u === id ? 1 : 0), 0) : 0;
const bhAb = (kn, slot) => bhUp(kn, 'a_' + slot);
// the ability slots a character has (from the controls editor's action list); the Time Traveler's weapon ability comes with his portal
const BHSLOT = { dash: 'Dash', leap: 'Leap', spin: 'Spin', breath: 'Breath', ult: 'Ult' };
const bhSlots = ch => { const A = (typeof CTL_ACTS !== 'undefined' && CTL_ACTS[ch]) || []; return A.map(a => a[0]).filter(s => BHSLOT[s] && !(ch === 'time' && s === 'leap')); };
const bhSlotName = (ch, s) => { const a = ((typeof CTL_ACTS !== 'undefined' && CTL_ACTS[ch]) || []).find(q => q[0] === s); return a ? a[1] : BHSLOT[s]; };
const bhLvSlot = ch => bhSlots(ch).includes('breath') ? 'breath' : 'spin';
// special upgrades: the things each kit gained over time, now earned in a run [id, name, what it does, ability it needs]
const BHSP = {
  knight: [['k_combo', 'Three-cut combo', 'Swings chain into a rising cut and a twirl, each with a longer light blade'], ['k_spinspd', 'Whirlwind', 'Spinning speeds you up to over twice your run', 'spin'], ['k_spinsz', 'Wide spin', 'The spin reaches 30% further', 'spin'], ['k_dash', 'Long blade dash', 'The dash goes 60% further and cuts a 40% wider path', 'dash']],
  priest: [['p_censer', 'Holy fire', 'The censer also burns away 3.5% of max health per second for 5s'], ['p_plow', 'Unstoppable', 'Walk straight through crowds, shoving and hurting them'], ['p_chain', 'Burning chain', 'While HOLY burns, the chain burns everyone it touches', 'spin']],
  fire: [['f_blue', 'Blue flame', 'Full-heat breath reaches 65% further and 35% wider'], ['f_coals', 'Bed of coals', 'Coals keep burning whoever walks on them', 'leap']],
  time: [['t_saber', 'Dashing slice', 'Saber swings carry you forward through enemies', 'spin'], ['t_bounce', 'Ricochet', 'Saws bounce on through up to 30 enemies (from 4)', 'spin'], ['t_skew', 'Skewer', 'Alien tentacles skewer up to 2 more enemies behind the first', 'spin']]
};
// stat boosts [name, what it does, most you can take]
const BHST = { dmg: ['Might', '+12% damage', 8], hp: ['Vigor', '+20 max health', 8], rgn: ['Second wind', '+0.6 health a second', 6], cdr: ['Focus', '8% shorter cooldowns', 5], spd: ['Fleet', '+7% move speed', 5], arm: ['Plating', 'Take 1 less damage from every hit', 5], xp: ['Insight', '+15% experience', 5] };
const bhDmg = kn => BH.on && kn ? 1 + 0.12 * bhN(kn, 'dmg') : 1;
const bhNeed = l => Math.round(6 + 4 * l + 0.35 * l * l);
function bhInit(kn) { Object.assign(kn, { rHp: BHC.HP, rHm: BHC.HP, rDn: 0, rRv: 0, rIv: 0, rPk: 0, ups: [], upSeen: (kn.in && kn.in.upN) || 0, kSeen: kn.kills || 0, pkT: 0 }); }
function bhStart() { Object.assign(BH, { on: BHMODE === 'run' ? 1 : 0, go: 0, t: 0, lvl: 1, xp: 0, need: bhNeed(1), over: 0, pause: 0, spT: 0, elT: 75, boss: 0 }); BUL.length = 0; BEV = []; for (const k in BHG) delete BHG[k]; BHUI.wait = -1; for (const kn of KN) bhInit(kn); bhUI(); }
// ---- cards ----
function bhPool(kn) { const ch = kn.kind || 'knight', P = [], slots = bhSlots(ch), have = s => bhAb(kn, s);
  for (const s of slots) if (!have(s) && (s !== 'ult' || (BH.lvl >= 6 && slots.some(q => q !== 'ult' && have(q))))) P.push(['a_' + s, 'Unlock: ' + bhSlotName(ch, s), s === 'ult' ? 'Your ultimate. It charges with kills as usual' : 'A new ability', 3, 'ab']);
  for (const [id, n, d, req] of BHSP[ch] || []) if (!bhUp(kn, id) && (!req || have(req))) P.push([id, n, d, 2, 'sp']);
  for (const [id, [n, d, mx]] of Object.entries(BHST)) if (bhN(kn, id) < mx) P.push([id, n, d, 1, 'st']);
  return P; }
function bhRoll(kn, n = 3) { const P = bhPool(kn), out = []; while (out.length < n && P.length) { let s = P.reduce((a, c) => a + c[3], 0), r = Math.random() * s, i = 0; while ((r -= P[i][3]) > 0 && i < P.length - 1) i++; out.push(P.splice(i, 1)[0]); } return out; }
const bhValid = (kn, id) => bhPool(kn).some(c => c[0] === id);
function bhApply(kn, id) { kn.ups = (kn.ups || []).concat([id]); kn.rPk = Math.max(0, (kn.rPk || 0) - 1); kn.pkT = 0; if (id === 'hp') { kn.rHm += 20; kn.rHp += 20; } }
// ---- input gate: locked abilities don't fire (my own knight; the guest gates its own before it sends) ----
const BHG = {};
function bhGate(kn) { if (!BH.on || !kn || !kn.in) return; const IN = kn.in, ch = kn.kind || 'knight', S = bhSlots(ch), lock = s => S.includes(s) && !bhAb(kn, s);
  const cnt = (f, s) => { if (lock(s)) IN[f] = BHG[f] || 0; else BHG[f] = IN[f] || 0; };
  cnt('dashN', 'dash'); if (lock('dash')) IN.pl = null; cnt('leapN', 'leap'); cnt('coN', 'leap'); cnt('ultN', 'ult');
  const ls = bhLvSlot(ch); cnt('lvN', ls); if (lock(ls)) { IN.spin = false; IN.mnD = null; }
  if (kn.rDn || BH.over) { IN.mv = [0, 0]; IN.aim = null; IN.spin = false; IN.br = null; IN.pl = null; } }
// ---- around each character's own step: downed players stand still; Fleet moves them further; Focus shortens any cooldown that just started ----
const BHCD = ['spinCd', 'dashCd', 'leapCd', 'slCd', 'swCd', 'hoCd', 'smCd', 'plCd', 'coCd', 'lvCd', 'wpCd', 'bkCd', 'sbCd', 'scCd', 'huCd', 'hlCd', 'trCd', 'nCd', 'kmCd', 'clCd', 'svCd', 'spCd', 'grCd', 'brCd', 'mnCd', 'bmCd'];
let BHPRE = null;
function bhPre(kn) { if (!BH.on) return; if (kn.rDn && kn.in) { kn.in.mv = [0, 0]; kn.in.aim = null; kn.in.spin = false; kn.in.br = null; } const o = { x: kn.x, y: kn.y }; for (const f of BHCD) if (typeof kn[f] === 'number') o[f] = kn[f]; BHPRE = o; }
function bhPost(kn) { if (!BH.on || !BHPRE) return; const o = BHPRE; BHPRE = null; const cd = Math.max(0.6, 1 - 0.08 * bhN(kn, 'cdr')), sp = 0.07 * bhN(kn, 'spd');
  if (cd < 1) for (const f of BHCD) if (typeof kn[f] === 'number' && o[f] !== undefined && kn[f] > o[f] + 0.05) kn[f] = o[f] + (kn[f] - o[f]) * cd;
  if (sp && !kn.rDn) { const dx = kn.x - o.x, dy = kn.y - o.y; if (Math.hypot(dx, dy) < 20) { kn.x += dx * sp; kn.y = cl(kn.y + dy * sp, 16, H - 4); } } }
// ---- damage to players ----
function bhHurt(kn, d) { if (!BH.on || !AUTH() || !kn || kn.rDn || kn.rIv > 0 || BH.over) return; d = Math.max(1, d - bhN(kn, 'arm')); kn.rHp -= d; kn.rIv = BHC.IV; kn.hits = (kn.hits || 0) + 1;
  if (kn.rHp <= 0) { kn.rHp = 0; kn.rDn = 1; kn.rRv = 0; for (let i = 0; i < 20; i++) { const a = rr(0, 6.28); sparks.push({ x: kn.x, y: kn.y - 6, vx: Math.cos(a) * rr(10, 40), vy: Math.sin(a) * rr(10, 30) - 10, t: 0, max: rr(0.4, 0.8) }); } } }
// ---- enemy fire: every volley is one event that every screen turns into the same bullets ----
// [x, y, angle, count, spread (>= 6.2 = full ring), speed, damage, colour index]
const BHCOL = ['#ff5a4a', '#c46bff', '#58d0ff', '#ffcf40', '#7dff6a'];
function bhFire(x, y, a, n, spr, spd, dmg, col) { const e = [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(a * 1000) / 1000, n, spr, spd, dmg, col]; bhVolley(e); if (NET && NET.mode === 'host') BEV.push(e); }
function bhVolley(e) { const [x, y, a, n, spr, spd, dmg, col] = e, ring = spr >= 6.2;
  for (let i = 0; i < n; i++) { const g = n === 1 ? a : ring ? a + i * Math.PI * 2 / n : a + (i / (n - 1) - 0.5) * spr; BUL.push({ x, y, vx: Math.cos(g) * spd, vy: Math.sin(g) * spd * 0.8, t: 0, d: dmg, c: col }); } }
// who shoots what: [first delay, gap, range, pattern]
function bhShoot(w, T2, dt) { if (w.hp <= 0 || w.air || w.gr > 0 || w.ogFz > 0 || w.bT > 0 || w.dead) return; const U = UK[w.k];
  const d = Math.hypot(T2.x - w.x, T2.y - w.y); if (d > 210) return; if (BUL.length > BHC.BMAX && !UK[w.k].heavy) { w.sh = rr(1, 2); return; } if (w.sh === undefined) w.sh = rr(1, 3); if ((w.sh -= dt) > 0) return;
  const a = Math.atan2((T2.y - 5) - (w.y - 5 * U.sc), T2.x - w.x), y0 = w.y - 5 * U.sc;
  switch (w.k) {
    case 'skel': bhFire(w.x, y0, a, 1, 0, 70, 8, 0); w.sh = rr(3.5, 5); break;
    case 'scout': bhFire(w.x, y0, a, 2, 0.18, 85, 7, 0); w.sh = rr(3, 4); break;
    case 'naga': bhFire(w.x, y0, a, 3, 0.55, 60, 9, 2); w.sh = rr(3.2, 4); break;
    case 'necro': bhFire(w.x, y0, rr(0, 1), 8, 6.3, 42, 9, 1); w.sh = rr(4.5, 6); break;
    case 'troll': bhFire(w.x, y0, a, 5, 0.9, 65, 11, 0); w.sh = 2.4; break;
    case 'chief': bhFire(w.x, y0, rr(0, 1), 16, 6.3, 48, 12, 3); w.sh = 2.8; break;
    case 'ent': bhFire(w.x, y0, rr(0, 1), 22, 6.3, 34, 10, 4); w.sh = 3.2; break;
    case 'golem': case 'tarrasque': case 'mammoth': { // spiral: a short burst every 0.12s, turning
      w.spA = (w.spA || 0) + 0.38; w.spN = (w.spN || 0) + 1; const big = w.k === 'tarrasque'; bhFire(w.x, y0, w.spA, big ? 5 : 3, 6.3, big ? 52 : 46, big ? 14 : 11, big ? 1 : 3);
      if (w.spN % (big ? 24 : 14) === 0) { w.sh = big ? 1.6 : 2.6; if (big) bhFire(w.x, y0, a, 7, 1.1, 80, 14, 0); } else w.sh = 0.12; break; }
    default: w.sh = 99; } }
function bhBullets(dt) { const L = LIVE();
  for (let i = BUL.length - 1; i >= 0; i--) { const b = BUL[i]; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; let gone = b.t > 6 || b.y < -10 || b.y > H + 10;
    if (!gone) for (const kn of L) { if (kn.rDn) continue; const dx = kn.x - b.x, dy = (kn.y - 5 * (kn.sz || 1)) - b.y; if (dx * dx + dy * dy < (BHC.BR + BHC.KR * (kn.sz || 1)) ** 2 && !((kn.z || 0) > 6)) { if (AUTH()) { if (kn.rIv > 0) continue; bhHurt(kn, b.d); } gone = true; break; } }
    if (gone) BUL.splice(i, 1); } if (BUL.length > 1500) BUL.splice(0, BUL.length - 1500); }
// ---- spawning: from every side, harder as the clock runs ----
const BHKIND = [[0, 'foot', 1], [0, 'zombie', 1], [25, 'skel', 1], [50, 'scout', 0.7], [60, 'gnoll', 1], [90, 'warg', 0.6], [110, 'naga', 0.7], [130, 'shield', 0.6], [150, 'necro', 0.5], [170, 'ogre', 0.4], [200, 'fknight', 0.6], [220, 'sapper', 0.4]];
const BHELITE = [[75, 'troll'], [180, 'chief'], [300, 'golem'], [360, 'ent'], [420, 'ram'], [480, 'mammoth']];
function bhSpawnAt(kind, x, y, mul) { const w = spawnWalker(x, undefined, cl(y, 14, H - 6), kind); w.hp = w.max = Math.round(UK[kind].hp * mul); return w; }
function bhEdge(kn) { const sc = viewScale(), hw = cv.width / 2 / sc + 14, hh = cv.height / 2 / sc + 14, a = rr(0, Math.PI * 2), r = 1 / Math.max(Math.abs(Math.cos(a)) / hw, Math.abs(Math.sin(a)) / hh); return [kn.x + Math.cos(a) * r, kn.y - 6 + Math.sin(a) * r]; }
function bhSpawn(dt) { if (!BH.go || BH.over || !AUTH()) return; const L = LIVE().filter(k => !k.rDn); if (!L.length) return; const t = BH.t, mul = 1 + t / 150;
  if ((BH.elT -= dt) <= 0) { const el = BHELITE.filter(e => e[0] <= t), e = el.length ? el[Math.floor(Math.random() * el.length)] : null; BH.elT = Math.max(25, 60 - t / 20); if (e) { const p = bhEdge(L[Math.floor(Math.random() * L.length)]); bhSpawnAt(e[1], p[0], p[1], 1 + t / 200); } }
  if (t >= 600 + BH.boss * 240) { BH.boss++; const p = bhEdge(L[0]); bhSpawnAt('tarrasque', p[0], p[1], 1 + BH.boss * 0.6); note('The Tarrasque is coming', 4); }
  if ((BH.spT -= dt) > 0) return; BH.spT = 0.6; const cap = Math.min(700, 120 + t * 1.2 + 80 * (L.length - 1)); if (walkers.length >= cap) return;
  let budget = (2 + t / 14) * 0.6 * (1 + 0.6 * (L.length - 1)); const K2 = BHKIND.filter(k => k[0] <= t), tw = K2.reduce((a, k) => a + k[2], 0);
  while (budget > 0) { const kn = L[Math.floor(Math.random() * L.length)], p = bhEdge(kn), m = Math.min(Math.ceil(budget), 2 + Math.floor(Math.random() * 5)); budget -= m;
    for (let i = 0; i < m; i++) { let r = Math.random() * tw, k = K2[0]; for (const q of K2) { if ((r -= q[2]) <= 0) { k = q; break; } } bhSpawnAt(k[1], p[0] + rr(-8, 8), p[1] + rr(-6, 6), mul); } } }
// ---- the run's clock, experience, level-ups, revives, game over (host); the pause while anyone picks a card ----
function bhStep0(dt, t) { if (!BH.on) return false;
  bhGate(KN[ME]);
  if (AUTH()) { for (const kn of LIVE()) { if ((kn.in.upN || 0) !== (kn.upSeen || 0)) { kn.upSeen = kn.in.upN || 0; const id = kn.in.upC; if (kn.rPk > 0 && bhValid(kn, id)) bhApply(kn, id); }
      if (kn.rPk > 0) { kn.pkT = (kn.pkT || 0) + dt; if (kn.pkT > BHC.AUTO) { const c = bhRoll(kn, 1)[0]; if (c) bhApply(kn, c[0]); else kn.rPk = 0; } } }
    BH.pause = LIVE().some(k => k.rPk > 0) ? 1 : 0; }
  bhUI(); if (BH.pause || BH.over) { netTick(dt, t); return true; } return false; }
function bhStep(dt) { if (!BH.on) return; const L = LIVE();
  for (const kn of KN) { if (kn.rIv > 0) kn.rIv -= dt; }
  if (!BH.go && L.some(k => k.st && k.st !== 'kneel')) BH.go = 1;
  bhBullets(dt);
  if (!AUTH()) return;
  if (BH.go && !BH.over) BH.t += dt;
  for (const kn of L) { const dk = (kn.kills || 0) - (kn.kSeen || 0); kn.kSeen = kn.kills || 0; if (dk > 0 && dk < 5000) BH.xp += dk * (1 + 0.15 * bhN(kn, 'xp'));
    if (!kn.rDn && kn.rHp < kn.rHm) kn.rHp = Math.min(kn.rHm, kn.rHp + 0.6 * bhN(kn, 'rgn') * dt);
    if (kn.rDn) { const near = L.some(o => o !== kn && !o.rDn && Math.hypot(o.x - kn.x, o.y - kn.y) < BHC.REVR); kn.rRv = near ? kn.rRv + dt : Math.max(0, kn.rRv - dt * 0.5); if (kn.rRv >= BHC.REV) Object.assign(kn, { rDn: 0, rRv: 0, rHp: Math.round(kn.rHm * 0.5), rIv: 1.5 }); } }
  while (BH.xp >= BH.need) { BH.xp -= BH.need; BH.lvl++; BH.need = bhNeed(BH.lvl); for (const kn of L) kn.rPk = (kn.rPk || 0) + 1; snd('ult', L[0].x, L[0].y); }
  if (BH.go && L.length && L.every(k => k.rDn)) { BH.over = 1; BH.best = Math.max(BH.best, BH.t); } }
// ---- sync ----
const bhPack = () => BH.on ? [Math.round(BH.t * 10) / 10, BH.lvl, Math.round(BH.xp * 10) / 10, BH.need, BH.over, BH.pause, BH.go] : null;
const bhTakeEv = () => { const e = BEV; BEV = []; return e.length ? e : undefined; };
function bhApplySnap(S) { if (S.rn) { BH.on = 1; [BH.t, BH.lvl, BH.xp, BH.need, BH.over, BH.pause, BH.go] = S.rn; } else BH.on = 0; if (S.bl) for (const e of S.bl) bhVolley(e); }
function bhOwn(kn, v) { for (const f of ['rHp', 'rHm', 'rDn', 'rRv', 'rPk', 'ups']) if (v[f] !== undefined) kn[f] = v[f]; }
// ---- drawing: bullets glow over everything on the ground; health bars over each player; a revive ring round the downed ----
function bhDraw(c, t) { if (!BH.on) return; c.save();
  for (const b of BUL) { const col = BHCOL[b.c] || BHCOL[0], f = b.t < 0.08 ? b.t / 0.08 : 1; c.globalAlpha = 0.35 * f; c.fillStyle = col; c.beginPath(); c.arc(b.x, b.y, BHC.BR * 1.6, 0, 7); c.fill(); c.globalAlpha = f; c.beginPath(); c.arc(b.x, b.y, BHC.BR, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, BHC.BR * 0.5, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  for (const kn of LIVE()) { const top = kn.y - 20 * (kn.sz || 1) - (kn.z || 0) - (kn.kind === 'ogre' ? 14 : kn.kind === 'priest' ? 4 : 0), w = 12, k = cl((kn.rHp || 0) / (kn.rHm || 1), 0, 1);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(kn.x - w / 2 - 0.3, top - 0.3, w + 0.6, 1.8); c.fillStyle = k > 0.5 ? '#5fd35a' : k > 0.25 ? '#e8c440' : '#e8503a'; c.fillRect(kn.x - w / 2, top, w * k, 1.2);
    if (kn.rIv > 0 && !kn.rDn) { c.globalAlpha = 0.25; c.strokeStyle = '#fff'; c.lineWidth = 0.4; c.beginPath(); c.ellipse(kn.x, kn.y - 6, 7, 9, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
    if (kn.rDn) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.5; c.setLineDash([1.5, 1.2]); c.beginPath(); c.ellipse(kn.x, kn.y, BHC.REVR, BHC.REVR * 0.5, 0, 0, 7); c.stroke(); c.setLineDash([]);
      if (kn.rRv > 0) { c.strokeStyle = '#7dff9a'; c.lineWidth = 1; c.beginPath(); c.arc(kn.x, kn.y - 12, 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kn.rRv / BHC.REV); c.stroke(); }
      c.fillStyle = '#fff'; c.font = '700 3px system-ui'; c.textAlign = 'center'; c.fillText(LIVE().length > 1 ? 'DOWN · stand near to revive' : 'DOWN', kn.x, top - 1.5); } }
  c.restore(); }
// ---- HUD: clock, level and experience, my health; the card picker; game over ----
const BHUI = { wait: -1, waitT: 0, open: 0, cards: null };
function bhUI() { const on = !!BH.on, me = KN[ME]; document.body.classList.toggle('bh', on); const hud = document.getElementById('bhHud'); if (!hud) return;
  const ch = (me && me.kind) || CHAR || 'knight', S = bhSlots(ch); for (const s of Object.keys(BHSLOT)) document.body.classList.toggle('bhL-' + s, on && S.includes(s) && !(me && bhAb(me, s)));
  if (!on || !me) { hud.style.display = 'none'; bhPick(null); bhOver(false); return; } hud.style.display = '';
  const m = Math.floor(BH.t / 60), sec = Math.floor(BH.t % 60); document.getElementById('bhClock').textContent = BH.go ? m + ':' + String(sec).padStart(2, '0') : 'Pull your weapon to begin';
  document.getElementById('bhLv').textContent = 'Lv ' + BH.lvl; document.getElementById('bhXp').style.width = (100 * cl(BH.xp / BH.need, 0, 1)) + '%';
  document.getElementById('bhHp').style.width = (100 * cl((me.rHp || 0) / (me.rHm || 1), 0, 1)) + '%'; document.getElementById('bhHpT').textContent = Math.ceil(me.rHp || 0) + ' / ' + (me.rHm || 0);
  // the card picker: open while I have a pick; after choosing, wait for the host to take it (or 1.5s) before showing the next
  if (BHUI.wait >= 0 && ((me.ups || []).length > BHUI.wait || performance.now() - BHUI.waitT > 1500)) BHUI.wait = -1;
  if (me.rPk > 0 && BHUI.wait < 0 && !BH.over) { if (!BHUI.open) bhPick(bhRoll(me)); } else if (BHUI.open) bhPick(null);
  const pw = document.getElementById('bhWait'); if (pw) pw.style.display = BH.pause && !(me.rPk > 0) && !BH.over ? '' : 'none';
  bhOver(!!BH.over); }
function bhPick(cards) { const el = document.getElementById('bhCards'); if (!el) return; BHUI.cards = cards; BHUI.open = cards ? 1 : 0; if (!cards) { el.style.display = 'none'; return; }
  el.style.display = 'flex'; el.innerHTML = `<b>Level ${BH.lvl}! Pick one</b><div class="bhRow">${cards.map((c, i) => `<button class="bhCard bh-${c[4]}" data-i="${i}"><small>${c[4] === 'ab' ? 'Ability' : c[4] === 'sp' ? 'Special' : 'Boost'}${c[4] === 'st' && bhN(KN[ME], c[0]) ? ' · ' + (bhN(KN[ME], c[0]) + 1) : ''}</small><span>${c[1]}</span><em>${c[2]}</em><i>${i + 1}</i></button>`).join('')}</div>`;
  el.querySelectorAll('.bhCard').forEach(b => b.onclick = e => { e.stopPropagation(); bhChoose(+b.dataset.i); }); }
function bhChoose(i) { const c = BHUI.cards && BHUI.cards[i], me = KN[ME]; if (!c || !me) return; BHUI.wait = (me.ups || []).length; BHUI.waitT = performance.now(); const IN = me.in; IN.upN = (IN.upN || 0) + 1; IN.upC = c[0]; if (typeof markIn === 'function') markIn(); bhPick(null);
  if (AUTH()) { me.upSeen = IN.upN; if (me.rPk > 0) bhApply(me, c[0]); } }
function bhOver(show) { const el = document.getElementById('bhOver'); if (!el) return; if (!show) { el.style.display = 'none'; el.dataset.on = ''; return; } if (el.dataset.on) return; el.dataset.on = '1'; el.style.display = 'flex';
  const m = Math.floor(BH.t / 60), sec = Math.floor(BH.t % 60), kills = LIVE().reduce((a, k) => a + (k.kills || 0), 0);
  el.innerHTML = `<b>Overrun</b><p>Survived ${m}:${String(sec).padStart(2, '0')} · Level ${BH.lvl} · ${kills} kills</p>${AUTH() ? '<button class="big pri" id="bhAgain">Play again</button>' : '<p>Waiting for the host…</p>'}<button class="big" id="bhMenu">Back to start</button>`;
  const a = document.getElementById('bhAgain'); if (a) a.onclick = () => { setup(); bhStart(); }; document.getElementById('bhMenu').onclick = () => document.getElementById('restartBtn').click(); }
addEventListener('keydown', e => { if (!BHUI.open) return; const n = '123'.indexOf(e.key); if (n >= 0) { e.preventDefault(); e.stopImmediatePropagation(); bhChoose(n); } }, true);
window.__bh = { BH, BUL, roll: () => bhRoll(KN[ME]) };
window.__bhFire = bhFire;
