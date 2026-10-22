// ===================== Campaign: stages on a world map (DRAFT 2026-10-22) =====================
// Inlined into knights.html by build.py (at /*@CAMPAIGN@*/, after survival.js). A campaign run is a Survival run (BH.on) with BH.cp set:
// it keeps Survival's health / downing / revives / team experience and levels, but enemies come from each stage's encounters,
// every kill gives the team experience straight away (no gems), level-ups give skill points for a per-character skill tree
// (abilities, specials and boosts) instead of cards, and every enemy kind has its own behaviour and abilities (eAI).
// Host-authoritative: the host runs the stage, encounters, enemy AI and damage; guests get CMP in the snapshot (`cp`) and every
// telegraph / effect as an event (`ce`), so every screen draws the same warnings.
const CMP = { ph: 0, st: 0, sel: 0, done: 0, E: [], clrT: 0, tk: 0 }; // ph: 0 world map, 1 playing, 2 stage cleared, 3 defeated
const XPV = k => UK[k] && UK[k].heavy ? 10 : (UK[k] && UK[k].hp > 350 ? 3 : 1);
// ---- stages: the playable ground is a union of rectangles (`R`), the start is where the knights' stones are ([320, 245]),
// encounters (`E`) lock the players in a ring (`r`) until every wave is dead; a `g` encounter is just a group standing about (no ring);
// the last encounter is the boss fight; `P` = the road drawn across the ground
const STAGES = [
  { id: 'road', name: 'The Old Road', blurb: 'Footmen and the walking dead hold the road east.', th: 'grass', mul: 1, mx: 120, my: 330,
    R: [[110, 110, 930, 390], [800, 20, 1520, 330], [1380, 120, 1960, 470]], P: [[160, 250], [620, 250], [900, 190], [1150, 170], [1450, 230], [1690, 300], [1900, 310]],
    E: [{ g: 1, x: 430, y: 180, w: ['zombie*3'] }, { x: 640, y: 255, r: 105, w: ['foot*5,zombie*3', 'foot*4,skel*3'] }, { g: 1, x: 960, y: 300, w: ['foot*3,skel*1'] },
      { x: 1160, y: 175, r: 115, w: ['zombie*7,foot*3', 'skel*4,scout*3,foot*3', 'shield*2,foot*4'] }, { x: 1690, y: 300, r: 135, boss: 'chief', w: ['foot*6,shield*1', 'chief*1,foot*4'] }] },
  { id: 'wood', name: 'Darkwood', blurb: 'Gnoll packs and wolf riders hunt under the trees.', th: 'wood', mul: 1.35, mx: 300, my: 210,
    R: [[110, 130, 720, 400], [600, -320, 900, 400], [780, -420, 1520, -110], [1400, -420, 1820, 120]], P: [[160, 260], [520, 270], [750, 200], [760, -120], [900, -270], [1300, -260], [1600, -180], [1620, 0]],
    E: [{ x: 470, y: 260, r: 105, w: ['gnoll*6', 'gnoll*4,skel*3'] }, { g: 1, x: 750, y: 40, w: ['warg*2'] }, { x: 760, y: -200, r: 110, w: ['gnoll*5,naga*2', 'warg*3,gnoll*3'] },
      { g: 1, x: 1100, y: -330, w: ['naga*2,skel*2'] }, { x: 1250, y: -260, r: 115, w: ['naga*3,scout*4', 'gnoll*6,warg*2', 'troll*1,gnoll*3'] }, { x: 1610, y: -60, r: 140, boss: 'ent', w: ['gnoll*5,naga*2', 'ent*1,gnoll*4'] }] },
  { id: 'fort', name: 'Ironhold', blurb: 'The fort’s garrison, its necromancers and what they keep chained inside.', th: 'fort', mul: 1.8, mx: 480, my: 120,
    R: [[110, 120, 640, 390], [520, -40, 1660, 600]], P: [[160, 255], [560, 255], [900, 280], [1300, 280]],
    E: [{ x: 480, y: 255, r: 100, w: ['shield*3,foot*4', 'sapper*4,foot*3'] }, { g: 1, x: 780, y: 60, w: ['fknight*2'] }, { x: 820, y: 300, r: 120, w: ['fknight*2,shield*3', 'necro*2,skel*4,foot*3', 'sapper*5,ogre*1'] },
      { g: 1, x: 1080, y: 520, w: ['necro*1,skel*3'] }, { x: 1150, y: 120, r: 125, w: ['ogre*2,shield*2', 'golem*1,foot*4'] }, { x: 1350, y: 340, r: 165, boss: 'tarrasque', w: ['fknight*2,necro*2,shield*3', 'tarrasque*1,skel*4'] }] }
];
const cpS = () => STAGES[CMP.st] || STAGES[0];
const cpIn = (S, x, y, m = 0) => S.R.some(r => x >= r[0] + m && x <= r[2] - m && y >= r[1] + m && y <= r[3] - m);
function cpClampPt(S, x, y, m) { if (cpIn(S, x, y, m)) return [x, y]; let b = null, bd = 1e18; for (const r of S.R) { const px = cl(x, r[0] + m, r[2] - m), py = cl(y, r[1] + m, r[3] - m), d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; b = [px, py]; } } return b; }
const ARY = 0.62; // arena rings are ellipses r x r*ARY on the ground
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
  if (k === 's') { const [, x, y, kind] = e; for (let i = 0; i < 12; i++) { const a = rr(0, 6.28); (kind ? sparks : dust).push(kind ? { x, y: y - 3, vx: Math.cos(a) * rr(8, 25), vy: -rr(10, 40), t: 0, max: rr(0.4, 0.8) } : { x, y, vx: Math.cos(a) * rr(8, 25), vy: Math.sin(a) * 6, r: rr(1, 2), t: 0, max: rr(0.4, 0.8) }); } }
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
    case 'zombie': if (d < 28 && d > 10 && eCd(w, 'g')) { eSet(w, 'g', rr(5, 8)); eStart(w, 'grab', { a, dur: 0.38 }); cpEv(['l', w.x, w.y, a, 24, 3, 0.38, 0]); return true; }
      // lurches now and then
      if ((w.ai = w.ai || { lt: rr(1, 4) }).lt > 0) w.ai.lt -= dt; else { w.ai.lt = rr(3, 5); w.ai.lu = 0.6; } if (w.ai.lu > 0) { w.ai.lu -= dt; if (d > reach) { eGo(w, T.x, T.y, w.sp * 2.2, dt); return true; } } return false;
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
    case 'lunge': case 'grab': if (pre) return true; { const go = E.t - E.dur, L = E.k === 'lunge' ? 0.22 : 0.26, sp = E.k === 'lunge' ? 135 : 100; if (go < L) { w.x += Math.cos(E.a) * sp * dt; w.y += Math.sin(E.a) * sp * dt * ARY; cpLaneP(w, 4, E.k === 'lunge' ? 12 : 10); } else if (go > L + 0.35) w.ea = null; } return true;
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
// ---- stage running (host): encounters wake when a player comes close, lock the ring, send their waves; the last one ends the stage ----
function cpSpawn(k, x, y) { const S = cpS(); [x, y] = cpClampPt(S, x, y, 6); const w = spawnWalker(x, undefined, y, k); w.hp = w.max = Math.round(UK[k].hp * S.mul); return w; }
function cpEdgePt(cx, cy, R) { const a = rr(0, 6.28); return cpClampPt(cpS(), cx + Math.cos(a) * R, cy + Math.sin(a) * R * ARY, 8); }
const cpParse = s => s.split(',').map(p => { const [k, n] = p.split('*'); return [k.trim(), +n || 1]; });
let CPGRP = 0;
function cpWave(e, i, pre) { const list = cpParse(e.w[i]); for (const [k, n] of list) { const a0 = rr(0, 6.28); for (let j = 0; j < n; j++) {
    let x, y; if (pre || e.g) { const a = rr(0, 6.28), q = Math.sqrt(Math.random()) * (e.g ? 18 : e.r * 0.55); x = e.x + Math.cos(a) * q; y = e.y + Math.sin(a) * q * ARY; } else { const a = a0 + rr(-0.35, 0.35), R = (e.r || 100) + rr(8, 26); x = e.x + Math.cos(a) * R; y = e.y + Math.sin(a) * R * ARY; }
    const w = cpSpawn(k, x, y); w.enc = e.i; if (pre || e.g) { w.idle = 1; w.grp = e.i; } else cpEv(['s', w.x, w.y, 0]); } } }
function cpBegin(i) { const S = STAGES[i]; if (!S) return; Object.assign(CMP, { ph: 1, st: i, clrT: 0 }); CMP.E = S.E.map((e, j) => ({ s: 0, w: 0, t: 0 }));
  walkers = []; HDEAD = []; parts = []; blood = []; splats = []; BUL.length = 0; CPHZ = []; CPFX = []; BH.over = 0; BH.go = 1;
  LIVE().forEach((kn, j) => { const sx = 200 + (j % 2) * 26, sy = 230 + j * 14; kn.x = sx; kn.y = sy; kn.T = { x: sx - HOME.x, y: sy - HOME.y }; Object.assign(kn, { rDn: 0, rRv: 0, rHp: kn.rHm || BHC.HP, rIv: 1 }); });
  S.E.forEach((e, j) => { e.i = j; if (e.g) cpWave(e, 0, 1); else cpWave(e, 0, 1); }); camX = KN[ME].x; camY = KN[ME].y; }
function cpStep(dt) { if (!BH.cp) return; for (const f of CPFX) f.t += dt; CPFX = CPFX.filter(f => f.t < f.max);
  if (!AUTH() || CMP.ph !== 1) return; const S = cpS(), L = LIVE().filter(k => !k.rDn);
  // experience: every enemy killed by anyone, straight to the team
  for (const w of walkers) if (w.hp <= 0 && !w.gm) { w.gm = 1; BH.xp += XPV(w.k) * (1 + 0.15 * Math.max(0, ...LIVE().map(k => bhN(k, 'xp')))); }
  cpHz(dt);
  S.E.forEach((e, j) => { const st = CMP.E[j]; if (e.g || st.s === 2) return;
    const alive = walkers.some(w => w.enc === j && w.hp > 0);
    if (st.s === 0) { if (L.some(k => Math.hypot(k.x - e.x, (k.y - e.y) / ARY) < e.r * 0.9)) { st.s = 1; st.w = 0; for (const w of walkers) if (w.enc === j) w.idle = 0; if (e.boss) note('Boss: ' + UK[e.boss].n, 3.5); snd('roar', e.x, e.y); } return; }
    if (!alive) { st.t += dt; if (st.t > 1.4) { st.t = 0; if (st.w + 1 < e.w.length) { st.w++; cpWave(e, st.w, 0); } else { st.s = 2; snd('ult', e.x, e.y); if (j === S.E.length - 1) { CMP.ph = 2; cpSave({ done: CMP.done |= 1 << CMP.st, lvl: BH.lvl, xp: BH.xp }); } } } } else st.t = 0; });
  if (BH.over && CMP.ph === 1) CMP.ph = 3; }
// keep everyone on the stage, and inside a ring that's fighting (anyone already in can't leave; anyone outside can walk in)
function cpClampK(kn) { if (!BH.cp || CMP.ph !== 1 || !kn) return; const S = cpS(); [kn.x, kn.y] = cpClampPt(S, kn.x, kn.y, 4);
  S.E.forEach((e, j) => { const st = CMP.E[j]; if (e.g || !st || st.s !== 1) return; const dx = kn.x - e.x, dy = (kn.y - e.y) / ARY, d = Math.hypot(dx, dy), was = kn.cpIn && kn.cpIn[j];
    if (was && d > e.r) { kn.x = e.x + dx / d * e.r; kn.y = e.y + dy / d * e.r * ARY; } (kn.cpIn = kn.cpIn || {})[j] = d <= e.r; }); }
function cpClampW() { if (!BH.cp || CMP.ph !== 1) return; const S = cpS(); for (const w of walkers) if (!(w.z > 1)) [w.x, w.y] = cpClampPt(S, w.x, w.y, 3); }
// ---- sync ----
const cpPack = () => BH.cp ? [CMP.ph, CMP.st, CMP.sel, CMP.done, CMP.E.map(e => e.s * 16 + e.w)] : undefined;
const cpTakeEv = () => { const e = CPE; CPE = []; return e.length ? e : undefined; };
function cpApplySnap(S) { if (S.cp) { const [ph, st, sel, done, E] = S.cp; if (ph === 2 && CMP.ph !== 2) cpSave({ done, lvl: BH.lvl, xp: BH.xp }); Object.assign(CMP, { ph, st, sel, done }); CMP.E = E.map(v => ({ s: v >> 4, w: v & 15, t: 0 })); } if (S.ce) for (const e of S.ce) cpFxAdd(e); }
// ---- drawing ----
const CPTH = { grass: { out: '#24451c', tint: null, edge: '#1a3314', tree: ['#2f5e25', '#3f7a30'] }, wood: { out: '#11240f', tint: 'rgba(8,30,14,.32)', edge: '#0c1a0b', tree: ['#1d3d1a', '#2a5524'] }, fort: { out: '#2a2a2e', tint: 'rgba(60,55,50,.25)', edge: '#18181a', tree: null } };
let cpOff = null, CPDEC = null, CPDECS = -1;
function cpDecor(S) { const D = [], inAny = (x, y) => cpIn(S, x, y, -2); for (const r of S.R) { for (const [x0, y0, x1, y1] of [[r[0], r[1], r[2], r[1]], [r[0], r[3], r[2], r[3]], [r[0], r[1], r[0], r[3]], [r[2], r[1], r[2], r[3]]]) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 13); for (let i = 0; i <= n; i++) { const u = i / n, ox = (y0 === y1 ? 0 : (x0 === r[0] ? -1 : 1)) * rr(6, 14), oy = (x0 === x1 ? 0 : (y0 === r[1] ? -1 : 1)) * rr(6, 12), x = lerp(x0, x1, u) + ox + rr(-3, 3), y = lerp(y0, y1, u) + oy; if (!inAny(x, y)) D.push({ x, y, r: rr(7, 12), s: Math.random() }); } } }
  D.sort((a, b) => a.y - b.y); return D; }
function cpFloor(c, t) { if (!BH.cp || CMP.ph === 0) return; const S = cpS(), TH = CPTH[S.th], sc = CAM.s, vw = cv.width / sc, vh = cv.height / sc, vx = camX - vw / 2 - 20, vy = camY - vh / 2 - 20;
  if (TH.tint) { c.fillStyle = TH.tint; c.fillRect(vx, vy, vw + 40, vh + 40); }
  if (S.th === 'fort') { c.fillStyle = '#7d766b'; for (const r of S.R) c.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); c.strokeStyle = 'rgba(40,36,30,.35)'; c.lineWidth = 0.6; c.beginPath(); for (let gx = Math.floor(vx / 16) * 16; gx < vx + vw + 40; gx += 16) { c.moveTo(gx, vy); c.lineTo(gx, vy + vh + 40); } for (let gy = Math.floor(vy / 11) * 11; gy < vy + vh + 40; gy += 11) { c.moveTo(vx, gy); c.lineTo(vx + vw + 40, gy); } c.stroke(); }
  // the road
  c.lineCap = c.lineJoin = 'round'; c.strokeStyle = S.th === 'fort' ? '#8f877a' : '#9a7a4c'; c.lineWidth = 34; c.beginPath(); S.P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); c.strokeStyle = S.th === 'fort' ? '#9d958a' : '#b08a5a'; c.lineWidth = 28; c.stroke();
  // outside the stage: dark ground (one offscreen layer with the stage cut out of it), then trees / walls along the edge
  if (!cpOff) cpOff = document.createElement('canvas'); if (cpOff.width !== cv.width || cpOff.height !== cv.height) { cpOff.width = cv.width; cpOff.height = cv.height; }
  const o = cpOff.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, cpOff.width, cpOff.height); o.fillStyle = TH.out; o.fillRect(0, 0, cpOff.width, cpOff.height); o.setTransform(c.getTransform());
  for (const r of S.R) o.clearRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.92; c.drawImage(cpOff, 0, 0); c.restore();
  if (CPDECS !== CMP.st || !CPDEC) { CPDEC = cpDecor(S); CPDECS = CMP.st; }
  for (const d of CPDEC) { if (d.x < vx - 20 || d.x > vx + vw + 60 || d.y < vy - 20 || d.y > vy + vh + 60) continue;
    if (TH.tree) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(d.x, d.y + d.r * 0.4, d.r, d.r * 0.45, 0, 0, 7); c.fill(); c.fillStyle = '#3b2a1a'; c.fillRect(d.x - 0.8, d.y - d.r * 0.6, 1.6, d.r * 0.9); c.fillStyle = TH.tree[0]; c.beginPath(); c.arc(d.x, d.y - d.r * 0.9, d.r * 0.8, 0, 7); c.fill(); c.fillStyle = TH.tree[1]; c.beginPath(); c.arc(d.x - d.r * 0.2, d.y - d.r * 1.05, d.r * 0.5, 0, 7); c.fill(); }
    else { c.fillStyle = '#4a4744'; c.fillRect(d.x - 7, d.y - 12, 14, 13); c.fillStyle = '#5d5955'; c.fillRect(d.x - 7, d.y - 12, 14, 3); c.strokeStyle = '#2c2a28'; c.lineWidth = 0.5; c.strokeRect(d.x - 7, d.y - 12, 14, 13); } }
  // encounter rings: a faint warning before, a glowing wall while it fights
  S.E.forEach((e, j) => { const st = CMP.E[j]; if (e.g || !st || st.s === 2) return; c.save(); if (st.s === 1) { const p = 0.6 + 0.4 * Math.sin(t * 5); c.strokeStyle = `rgba(255,${e.boss ? 60 : 120},40,${0.55 * p + 0.3})`; c.lineWidth = 2.2; c.shadowColor = '#ff6a2a'; c.shadowBlur = 8; }
    else { c.strokeStyle = e.boss ? 'rgba(255,80,60,.45)' : 'rgba(255,220,160,.28)'; c.lineWidth = 1; c.setLineDash([4, 4]); } c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * ARY, 0, 0, 7); c.stroke(); c.restore(); }); }
const CPCOL = ['255,70,50', '255,230,140', '190,110,255', '255,170,40', '120,220,90'];
function cpGround(c, t) { if (!BH.cp) return; c.save();
  for (const f of CPFX) { const e = f.e, k = e[0];
    if (k === 'r') { const [, x, y, R, dur, ci] = e, u = cl(f.t / dur, 0, 1), col = CPCOL[ci] || CPCOL[0], fade = f.t > dur ? 1 - (f.t - dur) / 0.15 : 1; c.globalAlpha = fade; c.fillStyle = `rgba(${col},.16)`; c.beginPath(); c.ellipse(x, y, R, R * ARY, 0, 0, 7); c.fill(); c.fillStyle = `rgba(${col},.35)`; c.beginPath(); c.ellipse(x, y, R * u, R * ARY * u, 0, 0, 7); c.fill(); c.strokeStyle = `rgba(${col},.85)`; c.lineWidth = 0.8; c.beginPath(); c.ellipse(x, y, R, R * ARY, 0, 0, 7); c.stroke(); }
    else if (k === 'l') { const [, x, y, a, L, hw, dur, ci] = e, u = cl(f.t / dur, 0, 1), col = CPCOL[ci] || CPCOL[0], fade = f.t > dur ? 1 - (f.t - dur) / 0.1 : 1; c.globalAlpha = fade; c.save(); c.translate(x, y); c.scale(1, ARY); c.rotate(Math.atan2(Math.sin(a) / ARY, Math.cos(a))); const LL = L * Math.hypot(Math.cos(a), Math.sin(a) * ARY) / Math.hypot(Math.cos(a), Math.sin(a)); c.fillStyle = `rgba(${col},.14)`; c.fillRect(0, -hw - 1, LL, (hw + 1) * 2); c.fillStyle = `rgba(${col},.4)`; c.fillRect(0, -hw - 1, LL * u, (hw + 1) * 2); c.strokeStyle = `rgba(${col},.8)`; c.lineWidth = 0.6; c.strokeRect(0, -hw - 1, LL, (hw + 1) * 2); c.restore(); }
    else if (k === 'p') { const [, x, y, R, dur] = e, fade = Math.min(1, (dur - f.t) / 0.6, f.t / 0.2); c.globalAlpha = fade * 0.75; c.fillStyle = '#5fbf3a'; c.beginPath(); c.ellipse(x, y, R, R * ARY, 0, 0, 7); c.fill(); c.fillStyle = '#a6f06a'; for (let i = 0; i < 4; i++) { const a = i * 1.7 + t * 0.8, rr2 = R * 0.5; c.beginPath(); c.arc(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2 * ARY, 1 + 0.6 * Math.sin(t * 4 + i), 0, 7); c.fill(); } }
    else if (k === 'o') { const [, , , x1, y1, fly, R] = e, u = cl(f.t / fly, 0, 1); c.globalAlpha = 0.5 + 0.5 * u; c.strokeStyle = 'rgba(255,90,60,.8)'; c.lineWidth = 0.7; c.beginPath(); c.ellipse(x1, y1, R, R * ARY, 0, 0, 7); c.stroke(); c.fillStyle = 'rgba(255,90,60,.18)'; c.beginPath(); c.ellipse(x1, y1, R * u, R * ARY * u, 0, 0, 7); c.fill(); } }
  c.restore(); }
function cpAir(c, t) { if (!BH.cp) return; const WM = new Map(walkers.map(w => [w.id, w])); c.save();
  for (const f of CPFX) { const e = f.e, k = e[0];
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
#cpTree .cols{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;overflow:auto;min-height:0}#cpTree .col{display:flex;flex-direction:column;gap:6px}#cpTree .col b{font:800 12px system-ui;letter-spacing:.1em;opacity:.7}
#cpTree .nd{text-align:left;padding:8px 10px;border-radius:10px;border:2px solid #4a4a3a;background:#232a1e;color:#ddd;cursor:default;font:500 12px system-ui}
#cpTree .nd span{display:block;font:800 14px system-ui;color:#fff}#cpTree .nd em{display:block;font-style:normal;opacity:.75;margin-top:2px}#cpTree .nd i{display:block;font-style:normal;margin-top:4px;font:700 11px system-ui;color:#ffcf6a}
#cpTree .nd.own{border-color:#c9a65a;background:#3a3218}#cpTree .nd.can{border-color:#7ad06a;background:#20361a;cursor:pointer}#cpTree .nd.can:hover{background:#2a4a22}#cpTree .nd.lock{opacity:.5}
@media (max-width:640px){#cpTree .cols{grid-template-columns:1fr}}`; document.head.appendChild(s); }
const MAPXY = [[16, 66], [50, 36], [84, 62]];
function cpMapUI() { const el = cpEl('cpMap'); const host = AUTH(), un = i => i === 0 || (CMP.done >> (i - 1)) & 1, S = STAGES[CMP.sel] || STAGES[0];
  const key = [CMP.sel, CMP.done, host, BH.lvl].join(); if (CPUI.last === key && el.style.display === 'flex') return; CPUI.last = key; el.style.display = 'flex';
  el.innerHTML = `<h2>World Map</h2><div style="opacity:.8">Team level ${BH.lvl} · ${cpPts(KN[ME])} skill point${cpPts(KN[ME]) === 1 ? '' : 's'} to spend</div><div class="mp"><svg viewBox="0 0 100 50" preserveAspectRatio="none"><path d="M16,33 C30,10 40,15 50,18 S70,40 84,31" fill="none" stroke="#c9a65a" stroke-width=".8" stroke-dasharray="2 1.5"/></svg>${STAGES.map((s, i) => `<div class="nd ${un(i) ? '' : 'lock'} ${(CMP.done >> i) & 1 ? 'done' : ''} ${CMP.sel === i ? 'sel' : ''}" data-i="${i}" style="left:${MAPXY[i][0]}%;top:${MAPXY[i][1]}%">${(CMP.done >> i) & 1 ? '✓' : i + 1}</div><div class="nl" style="left:${MAPXY[i][0]}%;top:${MAPXY[i][1] + 14}%">${s.name}</div>`).join('')}</div>
  <div class="card"><b>${S.name}</b><br>${S.blurb}</div><div class="row">${host ? `<button class="go" id="cpGo" ${un(CMP.sel) ? '' : 'disabled'}>Start ${S.name}</button>` : '<div>Waiting for the host to choose a stage…</div>'}<button class="go" id="cpMapSk">Skills</button></div>`;
  el.querySelectorAll('.nd').forEach(n => n.onclick = () => { const i = +n.dataset.i; if (host && un(i)) { CMP.sel = i; cpMapUI(); } });
  const g = document.getElementById('cpGo'); if (g) g.onclick = () => { if (un(CMP.sel)) { cpBegin(CMP.sel); el.style.display = 'none'; } };
  document.getElementById('cpMapSk').onclick = () => cpTreeUI(1); }
function cpEndUI() { const el = cpEl('cpEnd'), win = CMP.ph === 2, host = AUTH(), key = 'e' + CMP.ph + host; if (CPUI.last === key && el.style.display === 'flex') return; CPUI.last = key; el.style.display = 'flex';
  el.innerHTML = `<h2>${win ? 'Stage cleared!' : 'Defeated'}</h2><div>${cpS().name} · team level ${BH.lvl}</div><div class="row">${host ? (win ? '<button id="cpBack">World map</button>' : '<button id="cpRetry">Try again</button><button id="cpBack">World map</button>') : '<div>Waiting for the host…</div>'}</div>`;
  const b = document.getElementById('cpBack'); if (b) b.onclick = () => { CMP.ph = 0; walkers = []; BH.over = 0; LIVE().forEach(k => Object.assign(k, { rDn: 0, rHp: k.rHm })); if (CMP.done >> CMP.sel & 1 && STAGES[CMP.sel + 1]) CMP.sel++; };
  const r = document.getElementById('cpRetry'); if (r) r.onclick = () => cpBegin(CMP.st); }
function cpTreeUI(open) { const el = cpEl('cpTree'), me = KN[ME]; if (open !== undefined) CPUI.open = open; if (!CPUI.open || !me) { el.style.display = 'none'; return; }
  const ch = me.kind || 'knight', N = cpTree(ch), key = 't' + ch + (me.ups || []).join() + BH.lvl; el.style.display = 'flex'; if (CPUI.tk === key) return; CPUI.tk = key;
  const nm = id => (N.find(q => q.id === id) || {}).n || id, cols = ['Abilities', 'Specials', 'Boosts'];
  el.innerHTML = `<div class="hd"><span>${CNAME[ch] || ch} · Skill tree · ${cpPts(me)} point${cpPts(me) === 1 ? '' : 's'}</span><button id="cpTX">Close</button></div><div class="cols">${cols.map((cn, ci) => `<div class="col"><b>${cn.toUpperCase()}</b>${N.filter(q => q.c === ci).map(q => { const own = bhN(me, q.id), can = cpCan(me, q.id), full = own >= q.mx;
    const why = full ? (q.mx > 1 ? 'Maxed' : 'Learned') : BH.lvl < q.lv ? 'Needs team level ' + q.lv : q.req && !(me.ups || []).includes(q.req) ? 'Needs ' + nm(q.req) : cpPts(me) ? 'Tap to learn (1 point)' : 'No points left';
    return `<button class="nd ${full ? 'own' : can ? 'can' : own ? 'own' : 'lock'}" data-id="${q.id}"><span>${q.n}${q.mx > 1 ? ` <small>${own}/${q.mx}</small>` : ''}</span><em>${q.d}</em><i>${why}</i></button>`; }).join('') || '<em style="opacity:.5">None yet</em>'}</div>`).join('')}</div>`;
  document.getElementById('cpTX').onclick = () => cpTreeUI(0);
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
window.__cp = { CMP, STAGES, tp: (x, y) => { const k = KN[ME]; k.x = x; k.y = y; k.T = { x: x - HOME.x, y: y - HOME.y }; }, W: () => walkers.map(w => [w.k, Math.round(w.x), Math.round(w.y), w.ea ? w.ea.k : '', w.idle ? 1 : 0]), FX: () => CPFX.length, sp: (k, dx, dy) => { const m = KN[ME], w = cpSpawn(k, m.x + dx, m.y + dy); return w.id; }, begin: i => cpBegin(i), skip: all => { for (const w of walkers) if (all || w.enc !== undefined) { w.hp = 0; if (all) w.dead = 1; } } };
