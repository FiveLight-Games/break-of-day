// ===================== Campaign: stages on a world map (DRAFT 2026-10-22) =====================
// Inlined into knights.html by build.py (at /*@CAMPAIGN@*/, after survival.js). A campaign run is a Survival run (BH.on) with BH.cp set:
// it keeps Survival's health / downing / revives / team experience and levels, but enemies come from each stage's encounters,
// every kill gives the team experience straight away (no gems), level-ups give skill points for a per-character skill tree
// (abilities, specials and boosts) instead of cards, and every enemy kind has its own behaviour and abilities (eAI).
// Host-authoritative: the host runs the stage, encounters, enemy AI and damage; guests get CMP in the snapshot (`cp`) and every
// telegraph / effect as an event (`ce`), so every screen draws the same warnings.
const CMP = { ph: 0, st: 0, sel: 0, done: 0, E: [], clrT: 0, tk: 0, lk: -1 }; // ph: 0 world map, 1 playing, 2 stage cleared, 3 defeated
const XPV = k => UK[k] && UK[k].heavy ? 10 : (UK[k] && UK[k].hp > 350 ? 3 : 1);
// ---- stages (format 2, see stagekit.js): painted ground (S.g grid), props (S.O), placed enemies standing about (S.U: [kind, x, y]),
// screen locks (S.L: {x, y, w, h, wv: waves, boss}) and spawn points (S.SP: [type, x, y]); the built-in ones are generated from these specs
const GRASS_SC = [['tree', 3], ['bush', 2], ['rock', 2], ['tuft', 5], ['flowers', 3], ['stump', 1], ['log', 1]];
const STAGESPEC = [
  { id: 'road', name: 'The Old Road', blurb: 'Deserters and sellswords hold the road east, led by an ogre warchief.', th: 'grass', mul: 1, mp: [16, 66], seed: 11, props: 1500, scatter: GRASS_SC,
    pts: [[200, 420, 170], [800, 520, 160], [1400, 330, 170], [2000, 240, 180], [2600, 420, 170], [3300, 620, 210], [3900, 560, 170], [4500, 330, 180], [5100, 260, 170], [5700, 460, 180], [6300, 420, 210], [6800, 420, 210]],
    locks: [{ x: 1150, w: 540, h: 300, pre: 'foot*3', wv: ['foot*5', 'foot*4,scout*2'] }, { x: 2100, w: 540, h: 300, pre: 'scout*2', wv: ['foot*6,scout*2', 'shield*2,foot*4'] },
      { x: 3300, w: 560, h: 320, pre: 'foot*4', wv: ['foot*5,scout*3', 'shield*2,foot*5', 'fknight*1,foot*4'] }, { x: 4500, w: 540, h: 300, pre: 'shield*2', wv: ['fknight*2,foot*4', 'scout*5,foot*4'] },
      { x: 5450, w: 540, h: 300, wv: ['foot*6,shield*2', 'fknight*2,scout*3'] }, { x: 6400, w: 660, h: 360, pre: 'foot*3', wv: ['foot*6,shield*2', 'chief*1,foot*4'], boss: 'chief' }],
    groups: [[620, 0, 'foot*2'], [1650, -30, 'scout*2'], [2650, 20, 'foot*3'], [3880, -40, 'foot*2,scout*1'], [4950, 40, 'foot*3'], [5950, 0, 'shield*1,foot*2']],
    extra: [['house', 2860, -150, 1, 0, 0, 1], ['house', 2900, 165, 1, 1, 1, 1], ['house', 3720, -150, 1, 1, 0, 1], ['fence', 2790, -110, 1, 0, 0, 1], ['fence', 2816, -110, 1, 0, 0, 1], ['cart', 3760, 140, 1, 0, 0, 1], ['crate', 3680, -110, 1, 0, 0, 1], ['barrel', 3692, -106, 1, 0, 0, 1], ['crate', 2960, 185, 1, 0, 0, 1],
      ['banner', 6120, -150, 1, 0, 0, 1], ['banner', 6120, 150, 1, 0, 0, 1], ['tent', 6700, -150, 1, 0, 0, 1], ['tent', 6720, 160, 1, 1, 1, 1]] },
  { id: 'wood', name: 'Darkwood', blurb: 'Gnoll packs and wolf riders hunt under the trees.', th: 'wood', mul: 1.35, mp: [50, 36], seed: 23, base: 5, patch: 1, roadW: 12, props: 1700,
    scatter: [['pine', 3], ['tree', 2], ['dead', 1], ['bush', 2], ['rock', 2], ['stump', 2], ['log', 2], ['tuft', 3], ['bones', 1]], pools: [[2650, -110, 60], [4380, 110, 55]],
    pts: [[200, 420, 150], [800, 250, 140], [1300, 520, 150], [1900, 700, 160], [2400, 420, 140], [3000, 230, 170], [3500, 480, 150], [4100, 700, 170], [4700, 460, 150], [5300, 260, 170], [5900, 480, 160], [6550, 420, 220], [6850, 420, 220]],
    locks: [{ x: 1300, w: 520, h: 300, pre: 'gnoll*3', wv: ['gnoll*6', 'gnoll*4,warg*1'] }, { x: 2400, w: 520, h: 300, pre: 'warg*1', wv: ['gnoll*5,naga*2', 'warg*3,gnoll*3'] },
      { x: 3500, w: 540, h: 300, pre: 'naga*2', wv: ['naga*3,gnoll*3', 'gnoll*6,warg*2'] }, { x: 4700, w: 540, h: 300, wv: ['gnoll*6,naga*2', 'troll*1,gnoll*3'] },
      { x: 5650, w: 540, h: 300, pre: 'gnoll*3', wv: ['warg*3,naga*3', 'troll*1,warg*2,gnoll*3'] }, { x: 6600, w: 660, h: 360, wv: ['gnoll*5,naga*2', 'ent*1,gnoll*4'], boss: 'ent' }],
    groups: [[720, 0, 'gnoll*2'], [1850, 20, 'warg*1'], [2950, -20, 'gnoll*3'], [4100, 0, 'naga*2'], [5200, 20, 'gnoll*2,warg*1'], [6150, 0, 'naga*2']] },
  { id: 'fort', name: 'Ironhold', blurb: 'The fort’s garrison, its necromancers and what they keep chained inside.', th: 'fort', mul: 1.8, mp: [84, 62], seed: 37, base: 4, roadW: 0, props: 1300,
    scatter: [['pillar', 2], ['brazier', 2], ['crate', 1], ['barrel', 1], ['banner', 1], ['bones', 2]],
    zones: [[-1e9, 1800, { base: 1, road: 3, roadW: 22, edge: 'grass', scatter: GRASS_SC }], [3700, 4950, { scatter: [['grave', 5], ['pillar', 1], ['bones', 3], ['dead', 1], ['brazier', 1]] }]],
    pts: [[200, 420, 160], [1000, 420, 160], [1700, 400, 180], [2400, 300, 210], [3200, 330, 210], [3900, 560, 210], [4600, 600, 190], [5300, 380, 200], [6000, 300, 210], [6650, 420, 230], [6950, 420, 230]],
    locks: [{ x: 1100, w: 540, h: 300, pre: 'shield*2,foot*2', wv: ['shield*3,foot*4', 'sapper*4,foot*3'] }, { x: 2300, w: 560, h: 320, pre: 'fknight*1', wv: ['fknight*2,shield*3', 'sapper*5,ogre*1'], sp: ['gate', 'gate'] },
      { x: 3300, w: 560, h: 320, pre: 'foot*3', wv: ['ogre*2,shield*2', 'fknight*2,foot*5'], sp: ['gate', 'gate'] }, { x: 4300, w: 560, h: 320, pre: 'zombie*4', wv: ['zombie*8', 'skel*5,necro*2'], sp: ['grave', 'grave', 'grave', 'grave'] },
      { x: 5350, w: 560, h: 320, pre: 'skel*3', wv: ['golem*1,zombie*4', 'necro*2,skel*4,zombie*4'], sp: ['grave', 'gate', 'grave'] }, { x: 6650, w: 680, h: 380, pre: 'skel*4', wv: ['necro*2,skel*4,zombie*4', 'tarrasque*1,skel*4'], boss: 'tarrasque', sp: ['gate', 'gate', 'grave'] }],
    groups: [[700, 0, 'foot*2'], [1700, 0, 'shield*1,foot*2'], [2850, -20, 'foot*3'], [3850, 0, 'zombie*3'], [4850, 20, 'skel*3'], [6000, 0, 'necro*1,skel*2']],
    extra: [['wall', 1790, -165, 1, 0, 0, 1], ['wall', 1790, 160, 1, 0, 0, 1], ['banner', 1815, -140, 1, 0, 0, 1], ['banner', 1815, 135, 1, 0, 0, 1]] }];
const STAGES = STAGESPEC.map(skGen);
const cpS = () => STAGES[CMP.st] || STAGES[0];
const ARY = 0.62; // ground ellipses (telegraph rings) are r x r*ARY
// ---- save (this device): map progress, team level and experience, and my skill tree per character ----
const cpLoad = () => { try { return JSON.parse(localStorage.getItem('kn_camp') || '{}') || {}; } catch (e) { return {}; } };
const cpSave = o => { try { localStorage.setItem('kn_camp', JSON.stringify(Object.assign(cpLoad(), o))); } catch (e) { } };
// ---- the skill tree (per character): abilities (each needs its level), specials (each needs its ability or another special), boosts (ranks) ----
function cpTree(ch) { const N = [];
  for (const s of bhSlots(ch)) N.push({ id: 'a_' + s, c: 0, n: bhSlotName(ch, s), d: s === 'ult' ? 'Unlocks the ultimate' : 'Unlocks the ability', lv: bhLvOf(ch, s), req: null, mx: 1 });
  for (const [id, n, d, req] of BHSP[ch] || []) N.push({ id, c: 1, n, d, lv: (BHSPMIN[ch] || {})[id] || 1, req: req ? (BHSLOT[req] ? 'a_' + req : req) : null, mx: 1 });
  for (const [id, [n, d, mx]] of Object.entries(BHST)) N.push({ id, c: 2, n, d, lv: 1, req: null, mx });
  return N; }
const cpPts = kn => Math.max(0, BH.lvl - ((kn && kn.ups) || []).length);
function cpCan(kn, id) { const N = cpTree(kn.kind || 'knight').find(q => q.id === id); if (!N) return false; const own = bhN(kn, id);
  return own < N.mx && BH.lvl >= N.lv && (!N.req || (kn.ups || []).includes(N.req)) && cpPts(kn) > 0; }
function cpBuy(kn, id) { kn.ups = (kn.ups || []).concat([id]); if (id === 'hp') { kn.rHm += 20; kn.rHp += 20; } }
function cpRestore(kn, list) { kn.ups = []; kn.rHm = BHC.HP; for (const id of list || []) if (cpCan(kn, id)) cpBuy(kn, id); kn.rHp = Math.min(kn.rHp, kn.rHm); kn.upK = kn.kind || 'knight'; }
// ---- events: every telegraph / effect is one event the host makes and every screen draws (host keeps the damage) ----
// ['r', x, y, R, dur, col] warning ring that fills up; ['l', x, y, ang, len, half-width, dur, col] warning lane; ['b', x, y, R] impact;
// ['o', x0, y0, x1, y1, fly, R, kind] lobbed shot; ['p', x, y, R, dur] poison pool; ['h', id, dur, kind] aura on an enemy; ['s', x, y, kind] spawn puff
let CPE = [], CPFX = [], CPHZ = [];
const q1 = v => Math.round(v * 10) / 10;
function cpEv(e) { e = e.map((v, i) => i && typeof v === 'number' ? q1(v) : v); cpFxAdd(e); if (NET && NET.mode === 'host') CPE.push(e); }
function cpFxAdd(e) { const k = e[0]; CPFX.push({ e, t: 0, max: k === 'r' ? e[4] + 0.15 : k === 'l' ? e[6] + 0.1 : k === 'b' ? 0.5 : k === 'o' ? e[5] + 0.05 : k === 'p' ? e[4] : k === 'h' ? e[2] : 0.6 });
  if (k === 'b') { const [, x, y, R] = e; FX.push({ k: 'ring', x, y, t: 0, max: 0.45, s: R / SLAM_R }); for (let i = 0; i < 10 + R; i++) { const a = rr(0, 6.28), v = rr(14, 40) * R / 25; dust.push({ x: x + Math.cos(a) * R * 0.3, y: y + Math.sin(a) * R * 0.15, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, r: rr(1, 2), t: 0, max: rr(0.35, 0.7) }); }
    const me = KN[ME]; if (me && Math.hypot(me.x - x, me.y - y) < 160) shake = Math.max(shake, Math.min(0.5, R / 80)); snd('slam', x, y); }
  if (k === 's' && e[3] >= 2) { const [, x, y, kind] = e, f = CPFX[CPFX.length - 1]; f.max = 1.4; f.pp = []; for (let i = 0; i < (kind === 2 ? 14 : 10); i++) { const a = rr(0, 6.28); f.pp.push([x + rr(-5, 5), y - rr(0, kind === 2 ? 14 : 3), Math.cos(a) * rr(6, 22), kind === 2 ? rr(-6, 4) : -rr(18, 40), rr(0, 6.28), rr(0.6, 1.3)]); }
    for (let i = 0; i < 8; i++) { const a = rr(0, 6.28); dust.push({ x, y, vx: Math.cos(a) * rr(8, 22), vy: Math.sin(a) * 5, r: rr(1, 2.2), t: 0, max: rr(0.4, 0.9) }); } snd(kind === 3 ? 'slam' : 'swing', x, y); }
  else if (k === 's') { const [, x, y, kind] = e; for (let i = 0; i < 12; i++) { const a = rr(0, 6.28); (kind ? sparks : dust).push(kind ? { x, y: y - 3, vx: Math.cos(a) * rr(8, 25), vy: -rr(10, 40), t: 0, max: rr(0.4, 0.8) } : { x, y, vx: Math.cos(a) * rr(8, 25), vy: Math.sin(a) * 6, r: rr(1, 2), t: 0, max: rr(0.4, 0.8) }); } }
  if (k === 'o') snd('swing', e[1], e[2]); }
// host hazards: a hit that lands at a set moment, or a pool that hurts while it lasts
function cpHitP(x, y, R, dmg) { for (const kn of LIVE()) { if (kn.rDn) continue; if (Math.hypot(kn.x - x, (kn.y - y) / ARY) < R + 3 && !((kn.z || 0) > 6)) bhHurt(kn, dmg); } }
function cpLaneP(w, R, dmg) { w.ea.hit = w.ea.hit || []; for (const kn of LIVE()) { if (kn.rDn || w.ea.hit.includes(kn.i)) continue; if (Math.hypot(kn.x - w.x, (kn.y - w.y) * 1.3) < R + UK[w.k].r && !((kn.z || 0) > 6)) { bhHurt(kn, dmg); w.ea.hit.push(kn.i); } } }
function cpHz(dt) { for (const h of CPHZ) { h.t += dt; if (h.k === 'hit' && !h.done && h.t >= h.at) { h.done = 1; cpHitP(h.x, h.y, h.R, h.dmg); cpEv(['b', h.x, h.y, h.R]); }
    if (h.k === 'pool' && h.t >= h.at) { h.tk = (h.tk || 0) - dt; if (h.tk <= 0) { h.tk = 0.5; cpHitP(h.x, h.y, h.R, h.dmg); } } }
  CPHZ = CPHZ.filter(h => h.k === 'hit' ? !h.done : h.t < h.at + h.dur); }
// ---- enemy behaviour (host): each kind moves its own way and has its own abilities, each with a warning first ----
// w.ea = the ability under way {k, t, a (angle), ...}; w.ec = ability cooldowns; w.ai = movement state. Returns true when it moved the enemy itself.
const eSlow = w => Math.min(w.pSl > 0 ? WP.PEN.ASLOW : w.sl > 0 ? WP.SLOWK : 1, 1 - OGHM.ZONE.MAX * (w.ogZs || 0), w.ogFs > 0 ? 1 - OG.SW.WSLK * w.ogFs / OG.SW.WSL : 1) * (w.bf > 0 ? 1.3 : 1) * (w.fz > 0 ? 1.5 : 1);
function eGo(w, tx, ty, sp, dt) { const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy); if (d < 0.5) return d; const m = Math.min(d, sp * eSlow(w) * dt); w.x += dx / d * m; w.y += dy / d * m; return d; }
const eCd = (w, k) => (w.ec && w.ec[k] || 0) <= 0, eSet = (w, k, v) => { (w.ec = w.ec || {})[k] = v; };
function eStart(w, k, o) { w.ea = Object.assign({ k, t: 0 }, o); w.atk = -1; if (UK[w.k].heavy) w.atkH = -1; }
const ang = (w, T) => Math.atan2(T.y - w.y, T.x - w.x);
function eAI(w, T, dx, dy, d, reach, U, dt) {
  if (!BH.cp || w.hp <= 0) return false;
  if (w.ec) for (const k in w.ec) w.ec[k] -= dt; if (w.bf > 0) w.bf -= dt; if (w.fz > 0) w.fz -= dt;
  // standing about until someone comes near (or it's hurt); then its whole group wakes
  if (w.idle) { if (LIVE().some(kn => !kn.rDn && Math.hypot(kn.x - w.x, kn.y - w.y) < 125) || w.hp < w.max) { for (const o of walkers) if (o.grp === w.grp) o.idle = 0; } else return true; }
  if (w.ea) return eTick(w, T, dx, dy, d, U, dt);
  if (w.atk >= 0) return false; // a club swing already under way plays out
  const k = w.k, a = Math.atan2(dy, dx), near = (n, R) => walkers.filter(o => o !== w && o.k === n && o.hp > 0 && Math.hypot(o.x - w.x, o.y - w.y) < R);
  switch (k) {
    case 'foot': if (d < 34 && d > 12 && eCd(w, 'l')) { eSet(w, 'l', rr(5, 8)); eStart(w, 'lunge', { a, dur: 0.42 }); cpEv(['l', w.x, w.y, a, 30, 3, 0.42, 0]); return true; } return false;
    case 'zombie': if (d < reach + 5 && eCd(w, 'g')) { eSet(w, 'g', rr(5, 8)); eStart(w, 'grab', { a, dur: 0.38 }); cpEv(['l', w.x, w.y, a, 14, 3, 0.38, 0]); return true; } return false; // a grab where it stands, no lunge
    case 'skel': case 'scout': { const S = k === 'skel' ? [70, 120, 'sh', [3.5, 5], 0.55] : [80, 130, 'dg', [3, 4.5], 0.35];
      if (k === 'scout' && d < 32 && eCd(w, 'roll')) { eSet(w, 'roll', 4.5); eStart(w, 'roll', { a: a + Math.PI + rr(-0.6, 0.6), dur: 0.3 }); return true; }
      if (d < 210 && d > 40 && eCd(w, S[2])) { eSet(w, S[2], rr(S[3][0], S[3][1])); eStart(w, 'shoot', { a, dur: S[4] }); cpEv(['l', w.x, w.y - 4, a, Math.min(d, 140), 0.8, S[4], 1]); return true; }
      if (d < reach + 1 && k === 'skel') return false; // cornered: club
      const ai = w.ai = w.ai || { dir: Math.random() < 0.5 ? 1 : -1, ft: rr(2, 4) }; if ((ai.ft -= dt) <= 0) { ai.dir *= -1; ai.ft = rr(2, 4); }
      const want = d < S[0] ? -1 : d > S[1] ? 1 : 0, px = -dy / d, py = dx / d; eGo(w, w.x + dx / d * want * 20 + px * ai.dir * 14, w.y + dy / d * want * 20 + py * ai.dir * 14, w.sp * (want < 0 ? 1 : 0.8), dt); return true; }
    case 'gnoll': { const pk = near('gnoll', 55); if (pk.length >= 2 && eCd(w, 'hw') && d < 140) { eSet(w, 'hw', 14); for (const o of pk.concat([w])) { o.fz = 5; eSet(o, 'hw', 14); cpEv(['h', o.id, 5, 0]); } snd('roar', w.x, w.y); }
      if (d > 36 && d < 62 && eCd(w, 'po')) { eSet(w, 'po', rr(5, 7)); eStart(w, 'leap', { x0: w.x, y0: w.y, x1: T.x, y1: T.y, dur: 0.45, fly: 0.42, R: 11, dmg: 12 }); cpEv(['r', T.x, T.y, 11, 0.45, 0]); return true; }
      // packs come at you from the sides
      if (d > 30) { const ai = w.ai = w.ai || { fa: (Math.random() < 0.5 ? 1 : -1) * rr(0.9, 2.1) }, oa = Math.atan2(-dy, -dx) + ai.fa * cl((d - 30) / 80, 0, 1); eGo(w, T.x + Math.cos(oa) * 26, T.y + Math.sin(oa) * 26, w.sp * (w.fz > 0 ? 1.2 : 1), dt); return true; } return false; }
    case 'warg': { if (d < 110 && eCd(w, 'ru')) { eSet(w, 'ru', rr(5, 7)); const L = d + 50; eStart(w, 'rush', { a, L, dur: 0.55, sp: 170 }); cpEv(['l', w.x, w.y, a, L, 6, 0.55, 0]); return true; }
      const ai = w.ai = w.ai || { ca: Math.atan2(-dy, -dx), dir: Math.random() < 0.5 ? 1 : -1 }; ai.ca += ai.dir * 1.1 * dt; eGo(w, T.x + Math.cos(ai.ca) * 62, T.y + Math.sin(ai.ca) * 62 * ARY, w.sp * 0.9, dt); return true; }
    case 'naga': { if (d < 150 && d > 30 && eCd(w, 'sp')) { eSet(w, 'sp', rr(4.5, 6)); eStart(w, 'spit', { a, tx: T.x + (T.vx || 0) * 0.3, ty: T.y + (T.vy || 0) * 0.3, dur: 0.4 }); return true; }
      const ai = w.ai = w.ai || { ph: rr(0, 6) }; ai.ph += dt * 3; if (d > 80 || d < 60) { const want = d > 80 ? 1 : -1, px = -dy / d, py = dx / d, s = Math.sin(ai.ph); eGo(w, w.x + dx / d * want * 20 + px * s * 18, w.y + dy / d * want * 20 + py * s * 18, w.sp, dt); return true; } return d > reach; }
    case 'shield': if (d < 46 && eCd(w, 'bs')) { eSet(w, 'bs', rr(7, 9)); const cx = w.x + Math.cos(a) * 8, cy = w.y + Math.sin(a) * 5; eStart(w, 'bash', { a, cx, cy, dur: 0.7 }); cpEv(['r', cx, cy, 30, 0.7, 0]); return true; }
      if (d > reach) { eGo(w, T.x, T.y, w.sp * 0.85, dt); return true; } return false;
    case 'necro': { const ns = walkers.filter(o => o.rz === w.id && o.hp > 0).length;
      if (ns < 6 && eCd(w, 'rz') && d < 200) { eSet(w, 'rz', rr(8, 10)); eStart(w, 'raise', { dur: 1.4 }); cpEv(['r', w.x, w.y, 22, 1.4, 2]); cpEv(['h', w.id, 1.4, 2]); return true; }
      if (d < 160 && eCd(w, 'bo')) { eSet(w, 'bo', rr(4.5, 6)); eStart(w, 'bolt', { a, dur: 0.5 }); cpEv(['l', w.x, w.y - 5, a, 70, 1.2, 0.5, 2]); return true; }
      const want = d < 90 ? -1 : d > 150 ? 1 : 0; if (want) { eGo(w, w.x + dx / d * want * 20, w.y + dy / d * want * 20, w.sp * (want < 0 ? 1.15 : 1), dt); return true; } return true; }
    case 'sapper': if (d < 20) { eStart(w, 'fuse', { dur: 0.7 }); cpEv(['r', w.x, w.y, 24, 0.7, 3]); cpEv(['h', w.id, 0.7, 3]); return true; } eGo(w, T.x, T.y, w.sp * 1.2, dt); return true;
    case 'ogre': if (d < 38 && eCd(w, 'sl')) { eSet(w, 'sl', rr(5, 7)); const cx = w.x + Math.cos(a) * 12, cy = w.y + Math.sin(a) * 7; eStart(w, 'slam', { cx, cy, R: 30, dmg: 18, dur: 0.85 }); cpEv(['r', cx, cy, 30, 0.85, 0]); return true; } return false;
    case 'fknight': if (d > 45 && d < 160 && eCd(w, 'la')) { eSet(w, 'la', rr(6, 8)); const L = d + 40; eStart(w, 'rush', { a, L, dur: 0.6, sp: 180, dmg: 18 }); cpEv(['l', w.x, w.y, a, L, 5, 0.6, 0]); return true; } return false;
    case 'troll': if (d > 45 && d < 170 && eCd(w, 'lp')) { eSet(w, 'lp', rr(6, 8)); eStart(w, 'leap', { x0: w.x, y0: w.y, x1: T.x, y1: T.y, dur: 0.9, fly: 0.6, R: 28, dmg: 22 }); cpEv(['r', T.x, T.y, 28, 0.9 + 0.6, 0]); return true; } return false;
    case 'chief': { const al = walkers.filter(o => o !== w && o.hp > 0 && !UK[o.k].heavy && Math.hypot(o.x - w.x, o.y - w.y) < 90);
      if (al.length >= 2 && eCd(w, 'wc')) { eSet(w, 'wc', 14); for (const o of al) { o.bf = 6; cpEv(['h', o.id, 6, 1]); } cpEv(['h', w.id, 1.2, 1]); snd('roar', w.x, w.y); }
      if (d < 44 && eCd(w, 'wh')) { eSet(w, 'wh', rr(5, 7)); eStart(w, 'slam', { cx: w.x, cy: w.y, R: 36, dmg: 20, dur: 0.65 }); cpEv(['r', w.x, w.y, 36, 0.65, 0]); return true; } return false; }
    case 'ent': if (d < 170 && eCd(w, 'rt')) { eSet(w, 'rt', rr(7, 9)); for (const kn of LIVE()) if (!kn.rDn && Math.hypot(kn.x - w.x, kn.y - w.y) < 200) { CPHZ.push({ k: 'hit', x: kn.x, y: kn.y, R: 14, dmg: 18, at: 0.9, t: 0 }); cpEv(['r', kn.x, kn.y, 14, 0.9, 4]); } eStart(w, 'cast', { dur: 0.9 }); return true; } return false;
    case 'golem': if (d > 50 && d < 210 && eCd(w, 'bd')) { eSet(w, 'bd', rr(5, 6.5)); eStart(w, 'throw', { tx: T.x, ty: T.y, dur: 0.5, fly: 1.1, R: 24, dmg: 20, kind: 0 }); return true; }
      if (d < 42 && eCd(w, 'st')) { eSet(w, 'st', rr(5, 7)); eStart(w, 'slam', { cx: w.x, cy: w.y, R: 32, dmg: 16, dur: 0.7 }); cpEv(['r', w.x, w.y, 32, 0.7, 0]); return true; } return false;
    case 'ram': case 'mammoth': { const big = k === 'mammoth';
      if (big && d < 46 && eCd(w, 'st')) { eSet(w, 'st', rr(6, 8)); eStart(w, 'slam', { cx: w.x, cy: w.y, R: 42, dmg: 20, dur: 0.75 }); cpEv(['r', w.x, w.y, 42, 0.75, 0]); return true; }
      if (eCd(w, 'ch') && d < 260) { eSet(w, 'ch', big ? rr(7, 9) : rr(4.5, 6)); const L = big ? 170 : 230; eStart(w, 'rush', { a, L, dur: 0.85, sp: big ? 140 : 190, dmg: big ? 24 : 26, stun: 1.1 }); cpEv(['l', w.x, w.y, a, L, big ? 12 : 10, 0.85, 0]); return true; } return false; }
    case 'tarrasque': { if (d < 58 && eCd(w, 'tl')) { eSet(w, 'tl', rr(6, 8)); eStart(w, 'slam', { cx: w.x, cy: w.y, R: 55, dmg: 22, dur: 0.85 }); cpEv(['r', w.x, w.y, 55, 0.85, 0]); return true; }
      if (eCd(w, 'rr') && d < 260) { eSet(w, 'rr', rr(8, 10)); const L = LIVE().filter(kn => !kn.rDn); for (let i = 0; i < 7; i++) { const kn = L[i % L.length], tx = kn.x + rr(-35, 35), ty = kn.y + rr(-22, 22); CPHZ.push({ k: 'hit', x: tx, y: ty, R: 17, dmg: 15, at: 0.5 + i * 0.12 + 1.1, t: 0 }); setTimeout(() => cpEv(['o', w.x, w.y - 30, tx, ty, 1.1, 17, 0]), (0.5 + i * 0.12) * 1000); } eStart(w, 'cast', { dur: 0.6 }); snd('roar', w.x, w.y); return true; }
      if (eCd(w, 'ro') && walkers.length < 70) { eSet(w, 'ro', rr(14, 18)); for (let i = 0; i < 5; i++) { const p = cpEdgePt(w.x, w.y, 150); const m = cpSpawn(i % 2 ? 'zombie' : 'foot', p[0], p[1]); cpEv(['s', p[0], p[1], 0]); } snd('roar', w.x, w.y); }
      if (eCd(w, 'ch') && d > 60 && d < 220) { eSet(w, 'ch', rr(8, 11)); const L = d + 70; eStart(w, 'rush', { a, L, dur: 1.0, sp: 120, dmg: 28, stun: 1.2 }); cpEv(['l', w.x, w.y, a, L, 16, 1.0, 0]); return true; } return false; }
  }
  return false; }
// an ability under way: warning first (`dur`), then the action
function eTick(w, T, dx, dy, d, U, dt) { const E = w.ea; E.t += dt; w.atk = -1; if (U.heavy) w.atkH = -1; const pre = E.t < E.dur;
  switch (E.k) {
    case 'lunge': case 'grab': if (pre) return true; { const go = E.t - E.dur, L = E.k === 'lunge' ? 0.22 : 0.26, sp = E.k === 'lunge' ? 135 : 100; if (go < L) { if (E.k === 'lunge') { w.x += Math.cos(E.a) * sp * dt; w.y += Math.sin(E.a) * sp * dt * ARY; } cpLaneP(w, 4, E.k === 'lunge' ? 12 : 10); } else if (go > L + 0.35) w.ea = null; } return true;
    case 'roll': { w.x += Math.cos(E.a) * 120 * dt; w.y += Math.sin(E.a) * 120 * dt * ARY; if (E.t >= E.dur) w.ea = null; } return true;
    case 'shoot': if (pre) return true; if (!E.fired) { E.fired = 1; if (w.k === 'skel') bhFire(w.x, w.y - 4, E.a, 1, 0, 95, 9, 0); else bhFire(w.x, w.y - 4, E.a, 2, 0.22, 110, 7, 0); } if (E.t > E.dur + 0.25) w.ea = null; return true;
    case 'bolt': if (pre) return true; if (!E.fired) { E.fired = 1; bhFire(w.x, w.y - 5, E.a, 3, 0.35, 60, 8, 1); } if (E.t > E.dur + 0.3) w.ea = null; return true;
    case 'leap': { if (pre) return true; const u = cl((E.t - E.dur) / E.fly, 0, 1); w.x = lerp(E.x0, E.x1, u); w.y = lerp(E.y0, E.y1, u); w.z = Math.sin(Math.PI * u) * (UK[w.k].heavy ? 34 : 18);
      if (u >= 1 && !E.hitDone) { E.hitDone = 1; w.z = 0; cpHitP(E.x1, E.y1, E.R, E.dmg); cpEv(['b', E.x1, E.y1, E.R]); } if (E.t > E.dur + E.fly + 0.4) w.ea = null; return true; }
    case 'rush': { if (pre) { w.ea.a = E.a; return true; } const go = E.t - E.dur, L = E.L / E.sp; if (go < L) { w.x += Math.cos(E.a) * E.sp * dt; w.y += Math.sin(E.a) * E.sp * dt * ARY; cpLaneP(w, 3, E.dmg || 14); if (Math.random() < dt * 30) dust.push({ x: w.x, y: w.y, vx: rr(-8, 8), vy: rr(-4, 4), r: rr(1, 2), t: 0, max: 0.5 }); }
      else if (go > L + (E.stun || 0.4)) w.ea = null; return true; }
    case 'bash': { if (pre) return true; if (!E.b) { E.b = 1; cpHitP(E.cx, E.cy, 30, 14); cpEv(['b', E.cx, E.cy, 30]); } if (E.t > E.dur + 0.25) { const a = Math.atan2(dy, dx), L = 95; eSet(w, 'bs', rr(7, 9)); eStart(w, 'rush', { a, L, dur: 0.45, sp: 150, dmg: 16, stun: 0.8 }); cpEv(['l', w.x, w.y, a, L, 5, 0.45, 0]); } return true; }
    case 'slam': if (pre) return true; if (!E.b) { E.b = 1; cpHitP(E.cx, E.cy, E.R, E.dmg); cpEv(['b', E.cx, E.cy, E.R]); } if (E.t > E.dur + 0.45) w.ea = null; return true;
    case 'spit': if (pre) return true; if (!E.f) { E.f = 1; cpEv(['o', w.x, w.y - 5, E.tx, E.ty, 0.8, 15, 1]); CPHZ.push({ k: 'hit', x: E.tx, y: E.ty, R: 15, dmg: 8, at: 0.8, t: 0 }); CPHZ.push({ k: 'pool', x: E.tx, y: E.ty, R: 15, dmg: 4, at: 0.8, dur: 3, t: 0 }); setTimeout(() => cpEv(['p', E.tx, E.ty, 15, 3]), 800); } if (E.t > E.dur + 0.3) w.ea = null; return true;
    case 'throw': if (pre) return true; if (!E.f) { E.f = 1; cpEv(['o', w.x, w.y - 14, E.tx, E.ty, E.fly, E.R, 0]); CPHZ.push({ k: 'hit', x: E.tx, y: E.ty, R: E.R, dmg: E.dmg, at: E.fly, t: 0 }); } if (E.t > E.dur + 0.4) w.ea = null; return true;
    case 'raise': if (pre) return true; { for (let i = 0; i < 2; i++) { const a = rr(0, 6.28), x = w.x + Math.cos(a) * 16, y = w.y + Math.sin(a) * 10, s = cpSpawn('skel', x, y); s.rz = w.id; cpEv(['s', x, y, 1]); } w.ea = null; } return true;
    case 'fuse': if (pre) return true; cpHitP(w.x, w.y, 24, 25); cpEv(['b', w.x, w.y, 24]); w.hp = 0; boom(w); w.ea = null; return true;
    case 'cast': if (E.t > E.dur) w.ea = null; return true;
  }
  w.ea = null; return false; }
// ---- stage running (host): placed enemies stand about until someone comes near; walking onto a lock's screen locks it (the camera stays
// on it and players can't leave) and its waves flood in from its spawn points and the screen's edges; it opens when they're all dead
const cpParse = skParse;
function cpSpawn(k, x, y) { const S = cpS(); [x, y] = skNear(S, x, y); const w = spawnWalker(x, undefined, y, k); w.hp = w.max = Math.round(UK[k].hp * S.mul); w._px = w.x; w._py = w.y; return w; }
function cpEdgePt(cx, cy, R) { const a = rr(0, 6.28); return skNear(cpS(), cx + Math.cos(a) * R, cy + Math.sin(a) * R * ARY); }
const lkIn = (L, x, y, m = 0) => Math.abs(x - L.x) < L.w / 2 - m && Math.abs(y - L.y) < L.h / 2 - m;
// which lock each spawn point feeds: the nearest lock whose screen (grown by 220) holds it
function cpSPof(S) { return (S.SP || []).map(([tp, x, y]) => { let b = -1, bd = 1e9; (S.L || []).forEach((L, i) => { const d = Math.hypot(Math.max(0, Math.abs(x - L.x) - L.w / 2), Math.max(0, Math.abs(y - L.y) - L.h / 2)); if (d < 220 && d < bd) { bd = d; b = i; } }); return [tp, x, y, b]; }); }
const CPSPK = { woods: 2, grave: 3, gate: 4, cave: 4 };
let CPQ = []; // flood queue (host): [lock, kind, x, y, spawn type, delay]
function cpFlood(S, li, str) { const L = S.L[li], sps = cpSPof(S).filter(q => q[3] === li); let t = 0;
  for (const [k, n] of skParse(str)) { if (!UK[k]) continue; for (let q = 0; q < n; q++) { t += rr(0.12, 0.32); let x, y, tp = 'edge';
    if (sps.length && Math.random() < 0.65) { const s = sps[Math.floor(Math.random() * sps.length)]; x = s[1] + rr(-10, 10); y = s[2] + rr(-6, 6); tp = s[0]; }
    else { const sd = Math.floor(Math.random() * 4); if (sd < 2) { x = L.x + (sd ? 1 : -1) * (L.w / 2 + rr(10, 30)); y = L.y + rr(-0.4, 0.4) * L.h; } else { x = L.x + rr(-0.45, 0.45) * L.w; y = L.y + (sd === 2 ? 1 : -1) * (L.h / 2 + rr(8, 20)); } }
    CPQ.push([li, k, x, y, tp, t]); } } }
function cpBegin(i) { const S = STAGES[i]; if (!S) return; Object.assign(CMP, { ph: 1, st: i, clrT: 0, lk: -1 }); CMP.E = (S.L || []).map(() => ({ s: 0, w: 0, t: 0 })); CPQ = [];
  walkers = []; HDEAD = []; parts = []; blood = []; splats = []; BUL.length = 0; CPHZ = []; CPFX = []; BH.over = 0; BH.go = 1;
  CMP.cs = -1; CMP.csD = []; CMP.csW = 0; CMP.won = 0; const PS = skPS(S); LIVE().forEach(kn => { const j = Math.max(0, KN.indexOf(kn)) % 4, sx = PS[j][0], sy = PS[j][1]; kn.x = sx; kn.y = sy; kn._px = sx; kn._py = sy; kn.cpLk = -1; kn.T = { x: sx - HOME.x, y: sy - HOME.y }; Object.assign(kn, { rDn: 0, rRv: 0, rHp: kn.rHm || BHC.HP, rIv: 1 }); });
  // placed enemies: those on a lock's screen belong to it; the rest stand about in groups (anyone within 70 of another is in its group)
  const U = (S.U || []).filter(u => UK[u[0]]), gid = U.map(() => -1); let g = 0;
  U.forEach((u, a) => { if (gid[a] >= 0) return; gid[a] = ++g; const st = [a]; while (st.length) { const b = st.pop(); U.forEach((v, c) => { if (gid[c] < 0 && Math.hypot(v[1] - U[b][1], v[2] - U[b][2]) < 70) { gid[c] = g; st.push(c); } }); } });
  U.forEach((u, a) => { const w = cpSpawn(u[0], u[1], u[2]); w.idle = 1; w.grp = gid[a]; const li = (S.L || []).findIndex(L => lkIn(L, u[1], u[2])); if (li >= 0) { w.lk = li; w.grp = 'L' + li; } });
  camX = KN[ME].x; camY = KN[ME].y; const s0 = S.S || [260, 400]; for (let cy = Math.floor((s0[1] - 500) / SKCH); cy <= Math.floor((s0[1] + 500) / SKCH); cy++) for (let cx = Math.floor((s0[0] - 700) / SKCH); cx <= Math.floor((s0[0] + 900) / SKCH); cx++) skChunk(S, cx, cy);
  if (AUTH()) csTrig('start'); }
function cpStep(dt) { if (!BH.cp) return; for (const f of CPFX) f.t += dt; CPFX = CPFX.filter(f => f.t < f.max);
  if (!AUTH() || CMP.ph !== 1) return; const S = cpS(), L = LIVE().filter(k => !k.rDn);
  // experience: every enemy killed by anyone, straight to the team
  for (const w of walkers) if (w.hp <= 0 && !w.gm) { w.gm = 1; BH.xp += XPV(w.k) * (1 + 0.15 * Math.max(0, ...LIVE().map(k => bhN(k, 'xp')))); }
  cpHz(dt);
  // the flood: queued enemies step out of their spawn point (or in from the screen's edge) one after another
  for (const q of CPQ) q[5] -= dt; for (const q of CPQ) if (q[5] <= 0) { const w = cpSpawn(q[1], q[2], q[3]); w.lk = q[0]; w.idle = 0; cpEv(['s', w.x, w.y, CPSPK[q[4]] || 0]); } CPQ = CPQ.filter(q => q[5] > 0);
  (S.L || []).forEach((Lk, j) => { const st = CMP.E[j]; if (!st || st.s === 2) return;
    if (st.s === 0) { if (CMP.lk < 0 && L.some(k => lkIn(Lk, k.x, k.y, Math.min(Lk.w, Lk.h) * 0.18))) { st.s = 1; st.w = 0; st.t = 0; CMP.lk = j; for (const w of walkers) if (w.lk === j) w.idle = 0; cpFlood(S, j, Lk.wv[0] || ''); note(Lk.boss && UK[Lk.boss] ? 'Boss: ' + UK[Lk.boss].n : 'Locked in!', 2.5); snd('roar', Lk.x, Lk.y); csTrig('lock', j); } return; }
    const alive = walkers.filter(w => w.lk === j && w.hp > 0).length, more = st.w + 1 < Lk.wv.length, queued = CPQ.some(q => q[0] === j);
    if (!queued && alive <= (more ? 2 : 0)) { st.t += dt; if (st.t > (alive ? 0.6 : 1.2)) { st.t = 0; if (more) { st.w++; cpFlood(S, j, Lk.wv[st.w]); } else { st.s = 2; CMP.lk = -1; snd('ult', Lk.x, Lk.y);
      csTrig('clear', j); if (CMP.E.every(e => e.s === 2)) cpWin(); else note('GO!', 2); } } } else st.t = 0; });
  if (!(S.L || []).length && !walkers.some(w => w.hp > 0)) { CMP.clrT += dt; if (CMP.clrT > 2 && !CMP.won) { CMP.won = 1; cpWin(); } }
  if (BH.over && CMP.ph === 1) CMP.ph = 3; }
// keep everyone on the ground (sliding along its edge), out of solid props, and anyone on a locked screen on it
function cpSlide(S, o, rad) { if (skWalk(S, o.x, o.y)) return; const px = o._px ?? o.x, py = o._py ?? o.y;
  if (skWalk(S, o.x, py)) o.y = py; else if (skWalk(S, px, o.y)) o.x = px; else if (skWalk(S, px, py) && Math.hypot(px - o.x, py - o.y) < 40) { o.x = px; o.y = py; } else [o.x, o.y] = skNear(S, o.x, o.y); }
function cpClampK(kn) { if (!BH.cp || CMP.ph !== 1 || !kn) return; const S = cpS();
  if (!(kn.z > 8)) { cpSlide(S, kn); skPush(S, kn, 2.5); }
  const Lk = S.L && S.L[CMP.lk]; if (Lk) { if (kn.cpLk === CMP.lk || lkIn(Lk, kn.x, kn.y)) { kn.cpLk = CMP.lk; kn.x = cl(kn.x, Lk.x - Lk.w / 2 + 6, Lk.x + Lk.w / 2 - 6); kn.y = cl(kn.y, Lk.y - Lk.h / 2 + 6, Lk.y + Lk.h / 2 - 6); } } else kn.cpLk = -1;
  kn._px = kn.x; kn._py = kn.y; }
function cpClampW() { if (!BH.cp || CMP.ph !== 1) return; const S = cpS(); for (const w of walkers) { if (w.z > 1 || w.gr > 0) continue; cpSlide(S, w); skPush(S, w, UK[w.k].r * 0.6 || 1.5); w._px = w.x; w._py = w.y; } }
// the camera stays on a locked screen while you're on it
function cpCam(x, y, sc) { const K0 = KN[ME]; if (!BH.cp || CMP.ph !== 1 || !K0 || !(CMP.lk >= 0) || K0.cpLk !== CMP.lk) return [x, y]; const Lk = cpS().L[CMP.lk]; if (!Lk) return [x, y]; const hw = cv.width / 2 / sc, hh = cv.height / 2 / sc;
  return [Lk.w > hw * 2 ? cl(x, Lk.x - Lk.w / 2 + hw, Lk.x + Lk.w / 2 - hw) : Lk.x, Lk.h > hh * 2 ? cl(y, Lk.y - Lk.h / 2 + hh, Lk.y + Lk.h / 2 - hh) : Lk.y]; }
// ---- sync ----
const cpPack = () => BH.cp ? [CMP.ph, CMP.st, CMP.sel, CMP.done, CMP.E.map(e => e.s * 16 + e.w), CMP.lk, CMP.cs, CMP.cl] : undefined;
const CPDEFJ = STAGES.map(s => JSON.stringify(s));
let CPSYN = { h: '', n: 0 };
// the stage being played (or picked) goes to guests when it changes and now and then for anyone who joined late; a built-in stage goes as a flag
const cpStageSync = () => { if (!BH.cp) return; const i = CMP.ph === 0 ? CMP.sel : CMP.st, S = STAGES[i]; if (!S) return; const j = JSON.stringify(S), def = j === CPDEFJ[i];
  if (j !== CPSYN.h || ++CPSYN.n > (def ? 40 : 200)) { CPSYN.h = j; CPSYN.n = 0; return [i, def ? 0 : j, STAGES.length]; } };
const cpTakeEv = () => { const e = CPE; CPE = []; return e.length ? e : undefined; };
function cpApplySnap(S) { if (S.cp) { const [ph, st, sel, done, E, lk, cs, clx] = S.cp; CMP.cs = cs ?? -1; CMP.cl = clx || 0; if (ph === 2 && CMP.ph !== 2) cpSave({ done, lvl: BH.lvl, xp: BH.xp }); Object.assign(CMP, { ph, st, sel, done, lk: lk ?? -1 }); CMP.E = E.map(v => ({ s: v >> 4, w: v & 15, t: 0 })); } if (S.ce) for (const e of S.ce) cpFxAdd(e);
  if (S.cs) { const [i, j, n] = S.cs; while (STAGES.length < n) STAGES.push(JSON.parse(CPDEFJ[0])); const want = j === 0 ? CPDEFJ[i] : j; if (want && JSON.stringify(STAGES[i]) !== want) { try { STAGES[i] = JSON.parse(want); CPUI.last = ''; } catch (e) { } } } }
// ---- drawing ----
function cpFloor(c, t) { if (!BH.cp || CMP.ph === 0) return; const S = cpS(), sc = CAM.s, vw = cv.width / sc, vh = cv.height / sc, vx = camX - vw / 2 - 20, vy = camY - vh / 2 - 20;
  skGround(c, S, vx, vy, vx + vw + 40, vy + vh + 40, 2);
  for (const p of S.O || []) if (SKP[p[0]] && SKP[p[0]].flat && p[1] > vx - 20 && p[1] < vx + vw + 60 && p[2] > vy - 10 && p[2] < vy + vh + 50) skDrawProp(c, S, p); }
// props and the edge's trees go in the depth list (kind 15), only those in view
function cpProps(VL, VR) { if (!BH.cp || CMP.ph === 0) return []; const S = cpS(), vh = cv.height / CAM.s, T = camY - vh / 2 - 60, B = camY + vh / 2 + 50, o = [];
  for (const p of S.O || []) if (p[1] > VL - 40 && p[1] < VR + 40 && p[2] > T && p[2] < B && SKP[p[0]] && !SKP[p[0]].flat) o.push([p[2], 15, p]);
  for (const p of skEdge(S)) if (p[1] > VL - 40 && p[1] < VR + 40 && p[2] > T && p[2] < B) o.push([p[2], 15, p]); return o; }
const cpPropDraw = (c, p) => skDrawProp(c, cpS(), p);
// a locked screen: everything off it darkened, its edge marked; when no screen is locked an arrow points the way to the next one
function cpLockDraw(c, t) { if (!BH.cp || CMP.ph !== 1) return; const S = cpS(), Lk = S.L && S.L[CMP.lk], me = KN[ME];
  if (Lk) { const x0 = Lk.x - Lk.w / 2, y0 = Lk.y - Lk.h / 2, p = 0.55 + 0.45 * Math.sin(t * 6); c.save(); c.fillStyle = 'rgba(6,5,4,.45)'; c.beginPath(); c.rect(x0 - 4000, y0 - 4000, Lk.w + 8000, Lk.h + 8000); c.rect(x0, y0, Lk.w, Lk.h); c.fill('evenodd');
    c.strokeStyle = `rgba(255,${Lk.boss ? 70 : 150},60,${0.3 + 0.35 * p})`; c.lineWidth = 1.4; c.setLineDash([10, 6]); c.lineDashOffset = -t * 30; c.strokeRect(x0, y0, Lk.w, Lk.h); c.restore(); return; } }
const CPCOL = ['255,70,50', '255,230,140', '190,110,255', '255,170,40', '120,220,90'];
function cpGround(c, t) { if (!BH.cp) return; c.save();
  for (const f of CPFX) { const e = f.e, k = e[0];
    if (k === 's' && e[3] === 3) { c.globalAlpha = 0.7 * (1 - f.t / f.max); c.fillStyle = '#3a2a1a'; c.beginPath(); c.ellipse(e[1], e[2] + 0.5, 5, 2.2, 0, 0, 7); c.fill(); c.globalAlpha = 1; continue; }
    if (k === 'r') { const [, x, y, R, dur, ci] = e, u = cl(f.t / dur, 0, 1), col = CPCOL[ci] || CPCOL[0], fade = f.t > dur ? 1 - (f.t - dur) / 0.15 : 1; c.globalAlpha = fade; c.fillStyle = `rgba(${col},.16)`; c.beginPath(); c.ellipse(x, y, R, R * ARY, 0, 0, 7); c.fill(); c.fillStyle = `rgba(${col},.35)`; c.beginPath(); c.ellipse(x, y, R * u, R * ARY * u, 0, 0, 7); c.fill(); c.strokeStyle = `rgba(${col},.85)`; c.lineWidth = 0.8; c.beginPath(); c.ellipse(x, y, R, R * ARY, 0, 0, 7); c.stroke(); }
    else if (k === 'l') { const [, x, y, a, L, hw, dur, ci] = e, u = cl(f.t / dur, 0, 1), col = CPCOL[ci] || CPCOL[0], fade = f.t > dur ? 1 - (f.t - dur) / 0.1 : 1; c.globalAlpha = fade; c.save(); c.translate(x, y); c.scale(1, ARY); c.rotate(Math.atan2(Math.sin(a) / ARY, Math.cos(a))); const LL = L * Math.hypot(Math.cos(a), Math.sin(a) * ARY) / Math.hypot(Math.cos(a), Math.sin(a)); c.fillStyle = `rgba(${col},.14)`; c.fillRect(0, -hw - 1, LL, (hw + 1) * 2); c.fillStyle = `rgba(${col},.4)`; c.fillRect(0, -hw - 1, LL * u, (hw + 1) * 2); c.strokeStyle = `rgba(${col},.8)`; c.lineWidth = 0.6; c.strokeRect(0, -hw - 1, LL, (hw + 1) * 2); c.restore(); }
    else if (k === 'p') { const [, x, y, R, dur] = e, fade = Math.min(1, (dur - f.t) / 0.6, f.t / 0.2); c.globalAlpha = fade * 0.75; c.fillStyle = '#5fbf3a'; c.beginPath(); c.ellipse(x, y, R, R * ARY, 0, 0, 7); c.fill(); c.fillStyle = '#a6f06a'; for (let i = 0; i < 4; i++) { const a = i * 1.7 + t * 0.8, rr2 = R * 0.5; c.beginPath(); c.arc(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2 * ARY, 1 + 0.6 * Math.sin(t * 4 + i), 0, 7); c.fill(); } }
    else if (k === 'o') { const [, , , x1, y1, fly, R] = e, u = cl(f.t / fly, 0, 1); c.globalAlpha = 0.5 + 0.5 * u; c.strokeStyle = 'rgba(255,90,60,.8)'; c.lineWidth = 0.7; c.beginPath(); c.ellipse(x1, y1, R, R * ARY, 0, 0, 7); c.stroke(); c.fillStyle = 'rgba(255,90,60,.18)'; c.beginPath(); c.ellipse(x1, y1, R * u, R * ARY * u, 0, 0, 7); c.fill(); } }
  c.restore(); }
function cpAir(c, t) { if (!BH.cp) return; const WM = new Map(walkers.map(w => [w.id, w])); c.save();
  for (const f of CPFX) { const e = f.e, k = e[0];
    if (k === 's' && f.pp) { const kind = e[3], u = f.t; for (const [x0, y0, vx, vy, r0, life] of f.pp) { if (u > life) continue; c.globalAlpha = 1 - u / life; const x = x0 + vx * u + (kind === 2 ? Math.sin(u * 6 + r0) * 3 : 0), y = y0 + (kind === 2 ? vy * u + 9 * u * u : vy * u + 60 * u * u); if (kind !== 2 && y > y0 + 4) continue; c.fillStyle = kind === 2 ? (r0 > 3 ? '#4f7a34' : '#7a8a3a') : kind === 3 ? '#4a3824' : '#6a6460'; c.save(); c.translate(x, y); c.rotate(r0 + u * 4); c.fillRect(-1, -0.5, 2, 1); c.restore(); } c.globalAlpha = 1; continue; }
    if (k === 'o') { const [, x0, y0, x1, y1, fly, R, kind] = e, u = cl(f.t / fly, 0, 1), x = lerp(x0, x1, u), y = lerp(y0, y1, u) - Math.sin(Math.PI * u) * (30 + Math.hypot(x1 - x0, y1 - y0) * 0.25);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(lerp(x0, x1, u), lerp(y0, y1, u), 3, 1.4, 0, 0, 7); c.fill(); c.fillStyle = kind ? '#7ee05a' : '#6a6460'; c.beginPath(); c.arc(x, y, kind ? 2.2 : 3.4, 0, 7); c.fill(); c.strokeStyle = kind ? '#2f6a20' : '#2a2724'; c.lineWidth = 0.5; c.stroke(); }
    else if (k === 'h') { const w = WM.get(e[1]); if (!w) continue; const cols = ['255,90,50', '255,200,80', '170,100,255', '255,240,120'], col = cols[e[3]] || cols[0], fade = Math.min(1, (e[2] - f.t) / 0.3), s = UK[w.k].sc || 1;
      c.globalAlpha = fade * (0.35 + 0.2 * Math.sin(t * 9)); c.strokeStyle = `rgba(${col},1)`; c.lineWidth = 1; c.beginPath(); c.ellipse(w.x, w.y - 6 * s - (w.z || 0), 6 * s, 9 * s, 0, 0, 7); c.stroke();
      if (e[3] === 3) { c.globalAlpha = 1; c.fillStyle = Math.sin(t * 30) > 0 ? '#fff' : '#ffb030'; c.beginPath(); c.arc(w.x + 2, w.y - 9 - (w.z || 0), 1.2, 0, 7); c.fill(); } } }
  c.restore(); }
// ---- HUD: the world map, the stage-end screens, the skill tree ----
const CPUI = { el: null, tree: null, map: null, end: null, open: 0, last: '', sent: '' };
function cpEl(id, css) { let e = document.getElementById(id); if (!e) { e = document.createElement('div'); e.id = id; document.body.appendChild(e); } return e; }
function cpCss() { if (document.getElementById('cpCss')) return; const s = document.createElement('style'); s.id = 'cpCss'; s.textContent = `
#cpMap,#cpEnd{position:fixed;inset:0;z-index:60;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 40%,#2c3a26,#0e130c);color:#f3ead2;font:600 14px system-ui,sans-serif;padding:16px;box-sizing:border-box}
#cpMap h2,#cpEnd h2{margin:0;font:800 26px system-ui,sans-serif;letter-spacing:.04em}
#cpMap .mp{position:relative;width:min(92vw,620px);aspect-ratio:2/1;background:#3c4a2c;border:2px solid #6a5a36;border-radius:14px;box-shadow:inset 0 0 40px #0008}
#cpMap svg{position:absolute;inset:0;width:100%;height:100%}
#cpMap .nd{position:absolute;transform:translate(-50%,-50%);width:58px;height:58px;border-radius:50%;border:3px solid #c9a65a;background:#5a4a2a;color:#fff;font:800 18px system-ui;cursor:pointer;display:flex;align-items:center;justify-content:center}
#cpMap .nd.lock{filter:grayscale(1) brightness(.6);cursor:default}#cpMap .nd.done{background:#3d6a2a}#cpMap .nd.sel{box-shadow:0 0 0 4px #ffe08a,0 0 20px #ffcf40}
#cpMap .nl{position:absolute;transform:translate(-50%,0);font:700 12px system-ui;white-space:nowrap;text-shadow:0 1px 2px #000}
#cpMap .card{max-width:min(92vw,620px);text-align:center;opacity:.9;font-weight:500}
#cpMap button.go,#cpEnd button{padding:10px 22px;border-radius:10px;border:2px solid #c9a65a;background:#6a4a1a;color:#fff;font:800 16px system-ui;cursor:pointer}
#cpMap button.go[disabled]{opacity:.4}#cpMap .row,#cpEnd .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
#cpSk{position:fixed;left:50%;top:116px;transform:translateX(-50%);z-index:40;display:none;padding:6px 14px;border-radius:16px;border:2px solid #c9a65a;background:#3a2a10cc;color:#ffe9b0;font:800 13px system-ui;cursor:pointer}
#cpSk.has{animation:cpP 1s infinite}@keyframes cpP{50%{box-shadow:0 0 14px #ffcf40}}
#cpTree{position:fixed;inset:6% 4%;z-index:61;display:none;flex-direction:column;gap:8px;background:#141a12f2;border:2px solid #c9a65a;border-radius:14px;padding:14px;color:#f3ead2;font:500 13px system-ui;box-sizing:border-box}
#cpTree .hd{display:flex;justify-content:space-between;align-items:center;font:800 18px system-ui}#cpTree .hd button{padding:6px 14px;border-radius:8px;border:1px solid #c9a65a;background:#3a2a10;color:#fff;font:700 14px system-ui;cursor:pointer}
#cpTree .cols,#cpTree .cols *{touch-action:pan-y !important}#cpTree .cols{-webkit-overflow-scrolling:touch;overscroll-behavior:contain;flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;overflow:auto;min-height:0}#cpTree .col{display:flex;flex-direction:column;gap:6px}#cpTree .col b{font:800 12px system-ui;letter-spacing:.1em;opacity:.7}
#cpTree .nd{text-align:left;padding:8px 10px;border-radius:10px;border:2px solid #4a4a3a;background:#232a1e;color:#ddd;cursor:default;font:500 12px system-ui}
#cpTree .nd span{display:block;font:800 14px system-ui;color:#fff}#cpTree .nd em{display:block;font-style:normal;opacity:.75;margin-top:2px}#cpTree .nd i{display:block;font-style:normal;margin-top:4px;font:700 11px system-ui;color:#ffcf6a}
#cpTree .nd.own{border-color:#c9a65a;background:#3a3218}#cpTree .nd.can{border-color:#7ad06a;background:#20361a;cursor:pointer}#cpTree .nd.can:hover{background:#2a4a22}#cpTree .nd.lock{opacity:.5}
@media (max-width:640px){#cpTree .cols{grid-template-columns:1fr}}`; document.head.appendChild(s); }
const MAPXY = [[16, 66], [50, 36], [84, 62]], mapXY = i => (STAGES[i] && STAGES[i].mp) || MAPXY[i] || [10 + (i * 22) % 80, i % 2 ? 36 : 66];
function cpMapUI() { const el = cpEl('cpMap'); const host = AUTH(), un = i => i === 0 || (CMP.done >> (i - 1)) & 1, S = STAGES[CMP.sel] || STAGES[0];
  const key = [CMP.sel, CMP.done, host, BH.lvl, STAGES.length, STAGES.map(s2 => s2.name).join()].join(); if (CPUI.last === key && el.style.display === 'flex') return; CPUI.last = key; el.style.display = 'flex';
  el.innerHTML = `<h2>World Map</h2><div style="opacity:.8">Team level ${BH.lvl} · ${cpPts(KN[ME])} skill point${cpPts(KN[ME]) === 1 ? '' : 's'} to spend</div><div class="mp"><svg viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points="${STAGES.map((s2, i) => mapXY(i)[0] + ',' + mapXY(i)[1] / 2).join(' ')}" fill="none" stroke="#c9a65a" stroke-width=".8" stroke-dasharray="2 1.5"/></svg>${STAGES.map((s, i) => `<div class="nd ${un(i) ? '' : 'lock'} ${(CMP.done >> i) & 1 ? 'done' : ''} ${CMP.sel === i ? 'sel' : ''}" data-i="${i}" style="left:${mapXY(i)[0]}%;top:${mapXY(i)[1]}%">${(CMP.done >> i) & 1 ? '✓' : i + 1}</div><div class="nl" style="left:${mapXY(i)[0]}%;top:${mapXY(i)[1] + 14}%">${s.name}</div>`).join('')}</div>
  <div class="card"><b>${S.name}</b><br>${S.blurb}</div><div class="row">${host ? `<button class="go" id="cpGo" ${un(CMP.sel) ? '' : 'disabled'}>Start ${S.name}</button>` : '<div>Waiting for the host to choose a stage…</div>'}<button class="go" id="cpMapSk">Skills</button>${host ? '<button class="go sedBtn" id="cpSed">Map designer</button>' : ''}</div>`;
  el.querySelectorAll('.nd').forEach(n => n.onclick = () => { const i = +n.dataset.i; if (host && un(i)) { CMP.sel = i; cpMapUI(); } });
  const g = document.getElementById('cpGo'); if (g) g.onclick = () => { if (un(CMP.sel)) { cpBegin(CMP.sel); el.style.display = 'none'; } };
  document.getElementById('cpMapSk').onclick = () => cpTreeUI(1); const sd = document.getElementById('cpSed'); if (sd) sd.onclick = () => sedOpen(CMP.sel); }
function cpEndUI() { const el = cpEl('cpEnd'), win = CMP.ph === 2, host = AUTH(), key = 'e' + CMP.ph + host; if (CPUI.last === key && el.style.display === 'flex') return; CPUI.last = key; el.style.display = 'flex';
  el.innerHTML = `<h2>${win ? 'Stage cleared!' : 'Defeated'}</h2><div>${cpS().name} · team level ${BH.lvl}</div><div class="row">${host ? (win ? '<button id="cpBack">World map</button>' : '<button id="cpRetry">Try again</button><button id="cpBack">World map</button>') : '<div>Waiting for the host…</div>'}</div>`;
  const b = document.getElementById('cpBack'); if (b) b.onclick = () => { CMP.ph = 0; walkers = []; BH.over = 0; LIVE().forEach(k => Object.assign(k, { rDn: 0, rHp: k.rHm })); if (CMP.done >> CMP.sel & 1 && STAGES[CMP.sel + 1]) CMP.sel++; };
  const r = document.getElementById('cpRetry'); if (r) r.onclick = () => cpBegin(CMP.st); }
function cpTreeUI(open) { const el = cpEl('cpTree'), me = KN[ME]; if (open !== undefined) CPUI.open = open; if (!CPUI.open || !me) { el.style.display = 'none'; return; }
  const ch = me.kind || 'knight', N = cpTree(ch), key = 't' + ch + (me.ups || []).join() + BH.lvl; el.style.display = 'flex'; if (CPUI.tk === key) return; CPUI.tk = key; const sc0 = (el.querySelector('.cols') || {}).scrollTop || 0;
  const nm = id => (N.find(q => q.id === id) || {}).n || id, cols = ['Abilities', 'Specials', 'Boosts'];
  el.innerHTML = `<div class="hd"><span>${CNAME[ch] || ch} · Skill tree · ${cpPts(me)} point${cpPts(me) === 1 ? '' : 's'}</span><button id="cpTX">Close</button></div><div class="cols scrollOk">${cols.map((cn, ci) => `<div class="col"><b>${cn.toUpperCase()}</b>${N.filter(q => q.c === ci).map(q => { const own = bhN(me, q.id), can = cpCan(me, q.id), full = own >= q.mx;
    const why = full ? (q.mx > 1 ? 'Maxed' : 'Learned') : BH.lvl < q.lv ? 'Needs team level ' + q.lv : q.req && !(me.ups || []).includes(q.req) ? 'Needs ' + nm(q.req) : cpPts(me) ? 'Tap to learn (1 point)' : 'No points left';
    return `<button class="nd ${full ? 'own' : can ? 'can' : own ? 'own' : 'lock'}" data-id="${q.id}"><span>${q.n}${q.mx > 1 ? ` <small>${own}/${q.mx}</small>` : ''}</span><em>${q.d}</em><i>${why}</i></button>`; }).join('') || '<em style="opacity:.5">None yet</em>'}</div>`).join('')}</div>`;
  { const cc = el.querySelector('.cols'); if (cc) cc.scrollTop = sc0; } document.getElementById('cpTX').onclick = () => cpTreeUI(0);
  el.querySelectorAll('.nd.can').forEach(b => b.onclick = e => { e.stopPropagation(); const id = b.dataset.id, IN = me.in; IN.upN = (IN.upN || 0) + 1; IN.upC = id; if (typeof markIn === 'function') markIn(); if (AUTH()) { me.upSeen = IN.upN; if (cpCan(me, id)) cpBuy(me, id); } CPUI.tk = ''; setTimeout(() => cpTreeUI(), 120); }); }
function cpUI() { cpCss(); const on = BH.on && BH.cp, me = KN[ME], sk = cpEl('cpSk');
  if (!on || !me) { for (const id of ['cpMap', 'cpEnd', 'cpTree']) cpEl(id).style.display = 'none'; sk.style.display = 'none'; return; }
  const p = cpPts(me); sk.style.display = CMP.ph === 1 ? 'block' : 'none'; sk.textContent = 'Skills' + (p ? ' · ' + p : ''); sk.classList.toggle('has', p > 0); if (!sk.onclick) sk.onclick = () => cpTreeUI(CPUI.open ? 0 : 1);
  if (CMP.ph === 0) cpMapUI(); else cpEl('cpMap').style.display = 'none';
  if (CMP.ph >= 2) cpEndUI(); else cpEl('cpEnd').style.display = 'none';
  cpTreeUI();
  // my saved skills for this character: send them once (the host keeps what the team level allows); save whenever they change
  const ch = me.kind || 'knight', sv = cpLoad(); if (CPUI.sent !== ch + BH.lvl && me.kind) { CPUI.sent = ch + BH.lvl; const list = (sv.sk || {})[ch] || []; if (list.length && list.length > (me.ups || []).length) { const IN = me.in; IN.skN = (IN.skN || 0) + 1; IN.skS = list; if (typeof markIn === 'function') markIn(); if (AUTH()) { me.skSeen = IN.skN; cpRestore(me, list); } } }
  if (me.ups && me.ups.length && (me.upK === ch || !AUTH())) { const cur = (sv.sk || {})[ch] || []; if (me.ups.length >= cur.length && me.ups.join() !== cur.join()) cpSave({ sk: Object.assign(sv.sk || {}, { [ch]: me.ups.slice() }) }); } }
// ---- host: skill purchases and restores sent by players; a character swap starts that player's tree afresh ----
function cpInputs() { if (!AUTH()) return; for (const kn of LIVE()) { const ch = kn.kind || 'knight';
    if (kn.upK !== ch) { kn.upK = ch; kn.ups = []; kn.rHm = BHC.HP; kn.rHp = Math.min(kn.rHp, kn.rHm); }
    if ((kn.in.skN || 0) !== (kn.skSeen || 0)) { kn.skSeen = kn.in.skN || 0; cpRestore(kn, kn.in.skS); }
    if ((kn.in.upN || 0) !== (kn.upSeen || 0)) { kn.upSeen = kn.in.upN || 0; if (cpCan(kn, kn.in.upC)) cpBuy(kn, kn.in.upC); } } }
addEventListener('keydown', e => { if (!BH.on || !BH.cp || e.repeat) return; if (e.code === 'KeyT' || e.code === 'KeyK') { cpTreeUI(CPUI.open ? 0 : 1); } else if (e.code === 'Escape' && CPUI.open) cpTreeUI(0); });
window.__cp = { CMP, STAGES, tp: (x, y) => { const k = KN[ME]; k.x = x; k.y = y; k.T = { x: x - HOME.x, y: y - HOME.y }; }, W: () => walkers.map(w => [w.k, Math.round(w.x), Math.round(w.y), w.ea ? w.ea.k : '', w.idle ? 1 : 0]), FX: () => CPFX.length, sp: (k, dx, dy) => { const m = KN[ME], w = cpSpawn(k, m.x + dx, m.y + dy); return w.id; }, begin: i => cpBegin(i), skip: all => { for (const w of walkers) if (all || w.lk !== undefined) { w.hp = 0; if (all) w.dead = 1; } } };
// ---- cutscenes: black bars top and bottom, close-up portraits of whoever is talking, text in the bottom bar ----
// stage field CS = [{tr: 'start'|'lock'|'clear'|'spot'|'end', i: lock index, x, y, r (spot), ln: [{w: speaker, s: 0 left / 1 right, n: name, t: text}]}]
// speakers: 'p1'..'p4' (that player's character, line skipped if nobody's there), a character kind, an enemy kind, or 'narr' (no picture)
const CSTR = [['start', 'Stage starts'], ['lock', 'Locked screen starts'], ['clear', 'Locked screen cleared'], ['spot', 'Someone reaches a spot'], ['end', 'Stage cleared']];
const CSCH = ['knight', 'fire', 'priest', 'time', 'ninja', 'ogre', 'rooster', 'gi'];
Object.assign(CMP, { cs: -1, cl: 0, csD: [], csW: 0 });
const csSeat = w => /^p[1-4]$/.test(w) ? +w[1] - 1 : -1;
const csHere = j => { const k = KN[j]; return !!k && LIVE().includes(k); };
const csOk = l => { const j = csSeat(l.w); return j < 0 || csHere(j); };
function csName(l) { if (l.n) return l.n; const j = csSeat(l.w); if (j >= 0) { const k = KN[j]; return (NET && NET.names && NET.names[j]) || (k && CNAME[k.kind || 'knight']) || 'Player ' + (j + 1); } if (l.w === 'narr') return ''; return CNAME[l.w] || (UK[l.w] && UK[l.w].n) || l.w; }
// host: start the first not-yet-played cutscene for this trigger
function csTrig(tr, i) { const S = cpS(), C = S && S.CS; if (!C || CMP.cs >= 0) return false; const k = C.findIndex((c, q) => !CMP.csD.includes(q) && c.tr === tr && (tr === 'start' || tr === 'end' || tr === 'spot' || (c.i | 0) === i) && (c.ln || []).some(csOk)); if (k < 0) return false;
  CMP.csD.push(k); CMP.cs = k; CMP.cl = (C[k].ln || []).findIndex(csOk); CMP.csT = 0; for (const kn of LIVE()) kn.csSeen = kn.in.csN || 0; return true; }
function csNext(skip) { const C = cpS().CS[CMP.cs], L = C ? C.ln || [] : []; let i = CMP.cl + 1; while (i < L.length && !csOk(L[i])) i++; CMP.csT = 0;
  if (skip || i >= L.length) { CMP.cs = -1; const w = CMP.csW; CMP.csW = 0; if (w === 1) cpWinNow(); else if (w === 2) cpWin(); } else CMP.cl = i; }
// stage won: an 'end' cutscene plays first
function cpWin() { if (CMP.cs >= 0) { CMP.csW = 2; return; } if (csTrig('end')) CMP.csW = 1; else cpWinNow(); }
function cpWinNow() { CMP.ph = 2; cpSave({ done: CMP.done |= 1 << CMP.st, lvl: BH.lvl, xp: BH.xp }); }
// runs every frame in a campaign: host reads advance/skip presses; while one plays the game is paused for everyone
function cpCutStep(dt) { if (AUTH() && CMP.ph === 1) { const S = cpS();
    if (CMP.cs < 0 && S.CS) S.CS.forEach((c, q) => { if (c.tr === 'spot' && !CMP.csD.includes(q) && LIVE().some(k => !k.rDn && Math.hypot(k.x - c.x, k.y - c.y) < (c.r || 60))) csTrig('spot'); });
    if (CMP.cs >= 0) { CMP.csT = (CMP.csT || 0) + dt; for (const kn of LIVE()) { if ((kn.in.csK || 0) !== (kn.csKS || 0)) { kn.csKS = kn.in.csK || 0; if (CMP.cs >= 0) csNext(1); }
      if ((kn.in.csN || 0) !== (kn.csSeen || 0)) { kn.csSeen = kn.in.csN || 0; if (CMP.cs >= 0 && CMP.csT > 0.25) csNext(); } } } }
  else if (CMP.ph !== 1 && AUTH()) CMP.cs = -1;
  csUI(); return CMP.cs >= 0 && CMP.ph === 1; }
// ---- portraits: the character or enemy drawn big, cropped to head and shoulders ----
const CSPIC = new Map();
const PORTRAITS = '__PORTRAITS__'; // filled by build.py from src/portraits
// close-up crop per character: [centre x, top, height] in his own units from his feet, facing right
const CSHEAD = { knight: [1, 17.5, 11], fire: [0, 23.5, 17], priest: [2.5, 24.5, 17], time: [0.5, 22, 13.5], ninja: [0.5, 14.5, 10], ogre: [0, 32, 20], rooster: [3, 20.5, 12], gi: [0.5, 15, 9] };
function csPic(w, col, kind) { const j = csSeat(w); if (j >= 0) { const k = KN[j]; kind = kind || (k && k.kind) || 'knight'; col = col || (k && k.col) || KCOLS[j]; w = kind; } if (w === 'narr') return '';
  // painted portraits: the one in his colour, else the blue one (until every colour is painted)
  if (CSCH.includes(w)) { const c0 = String(col || KCOLS[0]).toLowerCase(); const P = PORTRAITS[w + '|' + c0] || PORTRAITS[w + '|' + KCOLS[0]]; if (P) return P; }
  const isCh = CSCH.includes(w), key = w + '|' + (isCh ? col || KCOLS[0] : ''); if (CSPIC.has(key)) return CSPIC.get(key);
  const N = 520, cv0 = document.createElement('canvas'); cv0.width = cv0.height = N; const g = cv0.getContext('2d');
  try { if (isCh) { const k0 = K, kn = mkKnight(0); Object.assign(kn, { col: col || KCOLS[0], kind: w, st: 'fight', u: 1, kn: 0, hold: 1, pullUp: 1, f: 1, x: 0, y: 0 });
      if (w === 'fire') makeFire(kn); else if (w === 'priest') makePriest(kn); else if (w === 'time') makeTime(kn); else if (w === 'ninja') makeNinja(kn); else if (w === 'ogre') makeOgre(kn); else if (w === 'rooster') makeRooster(kn); else if (w === 'gi') makeGI(kn);
      Object.assign(kn, { st: 'fight', u: 1, kn: 0, hold: 1, x: 0, y: 0, f: 1 }); if (w === 'priest') Object.assign(kn, { hx: 14, hy: 6, hz: 0 }); K = kn;
      const H = CSHEAD[w] || CSHEAD.knight, S = 440 / H[2]; g.translate(N / 2 - H[0] * S, 30 + H[1] * S); g.scale(S, S);
      if (w === 'fire') drawFire(g, 1.2); else if (w === 'priest') drawPriest(g, 1.2); else if (w === 'time') drawTime(g, 1.2); else if (w === 'ninja') drawNinja(g, 1.2); else if (w === 'rooster') drawRooster(g, 1.2); else if (w === 'gi') drawGIK(g, 1.2); else if (w === 'ogre') drawStormOgre(g, 1.2); else drawKnight(g, 1.2); K = k0; const o = document.createElement('canvas'), cw = H[2] * 1.05 * S; o.width = 300; o.height = Math.round(300 / 1.05); o.getContext('2d').drawImage(cv0, N / 2 - cw / 2, 30, cw, H[2] * S, 0, 0, o.width, o.height); const u = o.toDataURL(); CSPIC.set(key, u); return u; }
    else if (UK[w]) { const U = UK[w], SB = U.sb || (['ogre', 'warg', 'naga', 'necro'].includes(w) ? SBB : SBS), s = N * 0.95 / Math.max(SB.w, SB.h); g.setTransform(s, 0, 0, s, N / 2 - (SB.x + SB.w / 2) * s, N / 2 - (SB.y + SB.h / 2) * s); NOHP = true; walkerLive(g, { x: 0, y: 0, k: w, ph: 0, hp: 1, max: 1, id: 1, atk: -1 }, 0, 1, -1, false); NOHP = false; } } catch (e) { NOHP = false; }
  // crop: the top of the figure, centred on where its top rows are
  const d = g.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = -1, y1 = -1; for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) if (d[(y * N + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { CSPIC.set(key, ''); return ''; }
  // the head: the first row wide enough not to be a sword or a spear, and the middle of the band under it
  const rowN = y => { let n = 0; for (let x = x0; x <= x1; x += 2) if (d[(y * N + x) * 4 + 3] > 20) n++; return n; }, need = Math.max(4, (x1 - x0) / 2 * 0.14); let hy = y0; while (hy < y1 && rowN(hy) < need) hy += 2;
  const bh = y1 - hy, hh = Math.max(40, bh * (UK[w] && UK[w].heavy ? 0.6 : 0.48)); let sx = 0, sn = 0; for (let y = hy; y < hy + bh * 0.2; y += 2) { let rx = 0, rn = 0; for (let x = x0; x <= x1; x += 2) if (d[(y * N + x) * 4 + 3] > 20) { rx += x; rn++; } if (rn >= need) { sx += rx; sn += rn; } }
  const cx = sn ? sx / sn : (x0 + x1) / 2, cw = hh * 1.05, o = document.createElement('canvas'); o.width = 300; o.height = Math.round(300 * (hh + bh * 0.08) / cw); y0 = hy - bh * 0.08;
  o.getContext('2d').drawImage(cv0, cx - cw / 2, y0, cw, hh + bh * 0.08, 0, 0, o.width, o.height); const u = o.toDataURL(); CSPIC.set(key, u); return u; }
// ---- the overlay (also used by the designer's preview) ----
let CSV = { k: '', at: 0, local: null };
function csCss() { if (document.getElementById('csCss')) return; const s = document.createElement('style'); s.id = 'csCss'; s.textContent = `
#cpCut{position:fixed;inset:0;z-index:90;display:none;pointer-events:auto;font:600 16px system-ui,sans-serif;color:#f3ead2;user-select:none;-webkit-user-select:none;touch-action:none}
body.csOn>*:not(canvas):not(#cpCut):not(script):not(style){visibility:hidden !important}
#cpCut .bt,#cpCut .bb{position:absolute;left:0;right:0;background:#000;transition:height .45s ease}
#cpCut .bt{top:0;height:0}#cpCut .bb{bottom:0;height:0}
#cpCut.on .bt{height:min(13vh,90px)}#cpCut.on .bb{height:min(27vh,190px)}
#cpCut .pt{position:absolute;bottom:min(27vh,190px);height:min(56vh,430px);max-width:44vw;object-fit:contain;object-position:bottom;transition:opacity .3s,transform .35s,filter .3s;opacity:0;filter:drop-shadow(0 0 10px rgba(0,0,0,.6))}
#cpCut .pl{left:4vw;transform:translateX(-30px)}#cpCut .pr{right:4vw;transform:translateX(30px) scaleX(-1)}
#cpCut .pt.in{opacity:1;transform:none}#cpCut .pr.in{transform:scaleX(-1)}#cpCut .pt.dim{filter:brightness(.38) drop-shadow(0 0 10px rgba(0,0,0,.6))}
#cpCut .tb{position:absolute;bottom:0;left:0;right:0;height:min(27vh,190px);box-sizing:border-box;padding:12px max(18px,6vw) 10px;display:flex;flex-direction:column;gap:6px;opacity:0;transition:opacity .3s .2s}
#cpCut.on .tb{opacity:1}#cpCut .nm{font:800 15px system-ui;letter-spacing:.06em;text-transform:uppercase;color:#ffd36a}#cpCut .nm.r{text-align:right}
#cpCut .tx{font:600 clamp(15px,2.3vw,21px)/1.35 system-ui;white-space:pre-wrap;overflow:auto}
#cpCut .ht{position:absolute;right:14px;bottom:8px;font:700 12px system-ui;opacity:.55}
#cpCut .sk{position:absolute;top:10px;right:12px;font:800 13px system-ui;padding:7px 12px;border-radius:8px;border:1px solid #6a5a36;background:#1c1a10;color:#f3ead2;opacity:0;transition:opacity .3s .3s}#cpCut.on .sk{opacity:.85}`;
  document.head.appendChild(s); }
function csEl() { let el = document.getElementById('cpCut'); if (el) return el; csCss(); el = document.createElement('div'); el.id = 'cpCut';
  el.innerHTML = `<div class="bt"></div><div class="bb"></div><img class="pt pl" alt=""><img class="pt pr" alt=""><div class="tb"><div class="nm"></div><div class="tx"></div></div><div class="ht">Tap to continue</div><button class="sk">Skip ▸▸</button>`;
  document.body.appendChild(el); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (e.target.classList.contains('sk')) csSkip(); else csTap(); }); return el; }
// what's showing: [lines, index] from the game or a local preview
const csCur = () => { if (CSV.local) return [CSV.local.ln, CSV.local.i]; if (!BH.on || !BH.cp || CMP.ph !== 1 || !(CMP.cs >= 0)) return null; const C = cpS() && cpS().CS && cpS().CS[CMP.cs]; return C ? [C.ln || [], CMP.cl] : null; };
function csUI() { const cur = csCur(), el = document.getElementById('cpCut') || (cur && csEl()); if (!el) return;
  if (!cur || !cur[0][cur[1]]) { document.body.classList.remove('csOn'); if (el.classList.contains('on')) { el.classList.remove('on'); el.querySelectorAll('.pt').forEach(p => p.classList.remove('in')); setTimeout(() => { if (!el.classList.contains('on')) el.style.display = 'none'; }, 460); } CSV.k = ''; return; }
  document.body.classList.toggle('csOn', !CSV.local);
  const [L, i] = cur, l = L[i], key = (CSV.local ? 'L' : CMP.cs) + ':' + i; if (el.style.display !== 'block') { el.style.display = 'block'; void el.offsetWidth; } el.classList.add('on');
  if (CSV.k !== key) { CSV.k = key; CSV.at = performance.now();
    // each side shows the last speaker on it; the one talking now is lit, the other dimmed
    for (const sd of [0, 1]) { let q = -1; for (let z = i; z >= 0; z--) if ((L[z].s | 0) === sd && L[z].w !== 'narr' && (CSV.local || csOk(L[z]))) { q = z; break; } const im = el.querySelector(sd ? '.pr' : '.pl');
      if (q < 0) { im.classList.remove('in'); continue; } const src = csPic(L[q].w, CSV.local && CSV.local.col, CSV.local && csSeat(L[q].w) >= 0 ? CSV.local.kinds[csSeat(L[q].w)] : undefined); if (src && im.getAttribute('src') !== src) im.src = src; im.classList.toggle('in', !!src); im.classList.toggle('dim', q !== i); }
    const nm = el.querySelector('.nm'); nm.textContent = CSV.local && csSeat(l.w) >= 0 && !l.n ? CNAME[CSV.local.kinds[csSeat(l.w)]] : csName(l); nm.classList.toggle('r', (l.s | 0) === 1); }
  const n = Math.floor((performance.now() - CSV.at) / 1000 * 45), tx = el.querySelector('.tx'), s = l.t || ''; CSV.done = n >= s.length; const v = s.slice(0, n); if (tx.textContent !== v) tx.textContent = v; }
function csTap() { if (!CSV.done) { CSV.at = -1e9; return; } if (CSV.local) { const L = CSV.local; L.i++; if (L.i >= L.ln.length) csSkip(); return; }
  if (performance.now() - (CSV.tap || 0) < 200) return; CSV.tap = performance.now(); const me = KN[ME]; me.in.csN = (me.in.csN || 0) + 1; if (NET) NET.inDirty = 1; }
function csSkip() { if (CSV.local) { CSV.local = null; csUI(); if (CSV.lt) cancelAnimationFrame(CSV.lt); return; } const me = KN[ME]; me.in.csK = (me.in.csK || 0) + 1; if (NET) NET.inDirty = 1; }
addEventListener('keydown', e => { if (!csCur()) return; if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return; if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) csTap(); } else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); csSkip(); } }, true);
// the designer's preview: plays a cutscene locally; players 1-4 shown as you and three other characters
function csPreview(C) { const ln = (C.ln || []).filter(l => l.t || l.w); if (!ln.length) return; CSV.local = { ln, i: 0, col: MYCOL || KCOLS[0], kinds: [CHAR || 'knight', 'fire', 'priest', 'time'] }; CSV.k = ''; const loop = () => { if (!CSV.local) return; csUI(); CSV.lt = requestAnimationFrame(loop); }; loop(); }
// upper half of a character with no weapons, big, transparent background (for portrait art)
function csUpper(w, col) { const N = 1400, cv0 = document.createElement('canvas'); cv0.width = cv0.height = N; const g = cv0.getContext('2d'), k0 = K; NOWPN = true;
  try { const kn = mkKnight(0); Object.assign(kn, { col: col || KCOLS[0], kind: w, st: 'fight', u: 1, kn: 0, hold: 1, pullUp: 1, f: 1, x: 0, y: 0 });
    if (w === 'fire') makeFire(kn); else if (w === 'priest') makePriest(kn); else if (w === 'time') makeTime(kn); else if (w === 'ninja') makeNinja(kn); else if (w === 'ogre') makeOgre(kn); else if (w === 'rooster') makeRooster(kn); else if (w === 'gi') makeGI(kn);
    Object.assign(kn, { st: 'fight', u: 1, kn: 0, hold: 1, x: 0, y: 0, f: 1 }); if (w === 'priest') Object.assign(kn, { hx: 14, hy: 6, hz: 0 }); K = kn; const H = CSHEAD[w] || CSHEAD.knight, S = 1250 / (H[1] + 3);
    g.translate(N / 2 - H[0] * S, N - 60); g.scale(S, S); if (w === 'fire') drawFire(g, 1.2); else if (w === 'priest') drawPriest(g, 1.2); else if (w === 'time') drawTime(g, 1.2); else if (w === 'ninja') drawNinja(g, 1.2); else if (w === 'rooster') drawRooster(g, 1.2); else if (w === 'gi') drawGIK(g, 1.2); else if (w === 'ogre') drawStormOgre(g, 1.2); else drawKnight(g, 1.2); } catch (e) { console.warn(e); }
  K = k0; NOWPN = false; const d = g.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = -1, y1 = -1; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const hh = Math.round((y1 - y0) / 2), o = document.createElement('canvas'); o.width = x1 - x0 + 9; o.height = hh + 8; o.getContext('2d').drawImage(cv0, x0 - 4, y0 - 4, o.width, o.height, 0, 0, o.width, o.height); return o.toDataURL(); }
window.__cs = { upper: csUpper, pic: csPic, preview: csPreview, grid: () => { const c = document.createElement('canvas'); c.width = 1600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#444'; g.fillRect(0, 0, 1600, 400); const k0 = K;
  CSCH.forEach((w, i) => { g.save(); g.translate(100 + i * 200, 360); g.strokeStyle = '#888'; g.lineWidth = 1; g.font = '10px sans-serif'; g.fillStyle = '#fff'; for (let y = 0; y <= 60; y += 5) { g.beginPath(); g.moveTo(-90, -y * 5); g.lineTo(90, -y * 5); g.stroke(); if (y % 10 === 0) g.fillText(y, -90, -y * 5 - 1); } for (let x = -15; x <= 15; x += 5) { g.beginPath(); g.moveTo(x * 5, 0); g.lineTo(x * 5, -300); g.stroke(); }
    const kn = mkKnight(0); Object.assign(kn, { col: '#3a7bd5', kind: w, st: 'fight', u: 1, kn: 0, hold: 1, pullUp: 1, f: 1, x: 0, y: 0 }); if (w === 'fire') makeFire(kn); else if (w === 'priest') makePriest(kn); else if (w === 'time') makeTime(kn); else if (w === 'ninja') makeNinja(kn); else if (w === 'ogre') makeOgre(kn); else if (w === 'rooster') makeRooster(kn); else if (w === 'gi') makeGI(kn);
    Object.assign(kn, { st: 'fight', u: 1, kn: 0, hold: 1, x: 0, y: 0, f: 1 }); if (w === 'priest') Object.assign(kn, { hx: 14, hy: 6, hz: 0 }); K = kn; g.scale(5, 5);
    try { if (w === 'fire') drawFire(g, 1.2); else if (w === 'priest') drawPriest(g, 1.2); else if (w === 'time') drawTime(g, 1.2); else if (w === 'ninja') drawNinja(g, 1.2); else if (w === 'rooster') drawRooster(g, 1.2); else if (w === 'gi') drawGIK(g, 1.2); else if (w === 'ogre') drawStormOgre(g, 1.2); else drawKnight(g, 1.2); } catch (e) { } g.restore(); g.fillStyle = '#ff0'; g.fillText(w, 60 + i * 200, 390); }); K = k0; return c.toDataURL(); } };
