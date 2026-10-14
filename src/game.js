// Shared game rules. The host's browser runs Sim; everyone else renders the host's snapshots.
(function (G) {
'use strict';
const rr = (R, a, b) => a + R() * (b - a);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------- players ----------------
const COLORS = [
  { id: 'red', n: 'Red', c: '#e04848' }, { id: 'blue', n: 'Blue', c: '#3a7ae0' }, { id: 'teal', n: 'Teal', c: '#22b8a8' },
  { id: 'purple', n: 'Purple', c: '#8a4ae0' }, { id: 'yellow', n: 'Yellow', c: '#f0c419' }, { id: 'orange', n: 'Orange', c: '#f07f19' },
  { id: 'green', n: 'Green', c: '#4cbb3a' }, { id: 'pink', n: 'Pink', c: '#f06aa8' }, { id: 'gray', n: 'Gray', c: '#a0a6ad' }, { id: 'brown', n: 'Brown', c: '#8a5a2c' }];
const RACES = [{ id: 'human', n: 'Human', on: true }, { id: 'orc', n: 'Orc' }, { id: 'elf', n: 'Elf' }, { id: 'dwarf', n: 'Dwarf' }];
const MAX_DEF = 4;

// ---------------- maps ----------------
// One shared base; each defender gets their own lane into it (lanes differ). Anyone can build anywhere.
const LANE = 50;         // half-width of a lane
const CELL = 24;         // build grid
const FOOT = 2;          // towers take FOOT x FOOT cells
const STAGE_H = 360;     // attacker staging ground above the map
const MAPS = [
  { id: 'greenvale', n: 'Greenvale', d: 'Forest roads that all lead to one keep.', on: true, theme: 'forest', W: 2400, H: 2000, base: [1200, 1870],
    lanes: [
      [[260, -150], [260, 120], [420, 330], [300, 570], [180, 830], [360, 1070], [620, 1180], [700, 1420], [900, 1640], [1100, 1790], [1200, 1870]],
      [[900, -150], [900, 100], [760, 300], [880, 520], [1110, 610], [1020, 860], [800, 1010], [860, 1250], [1080, 1390], [1060, 1600], [1160, 1770], [1200, 1870]],
      [[1500, -150], [1500, 80], [1690, 270], [1570, 490], [1340, 650], [1440, 890], [1690, 990], [1610, 1230], [1360, 1370], [1380, 1600], [1250, 1770], [1200, 1870]],
      [[2140, -150], [2140, 140], [1980, 370], [2120, 630], [2220, 890], [2020, 1090], [1800, 1250], [1700, 1490], [1500, 1690], [1300, 1810], [1200, 1870]]],
    // which lanes are used for 1..4 defenders
    use: { 1: [1], 2: [0, 3], 3: [0, 2, 3], 4: [0, 1, 2, 3] } },
  { id: 'redrock', n: 'Redrock Pass', d: 'Coming soon', on: false },
  { id: 'frostfen', n: 'Frostfen', d: 'Coming soon', on: false }];

function buildLane(C) {
  const P = [];
  for (let i = 0; i < C.length - 1; i++) {
    const p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(C.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.1) { const t2 = t * t, t3 = t2 * t; P.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); }
  }
  P.push(C[C.length - 1]);
  const seg = []; let total = 0;
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.01) continue; seg.push({ a, b, l, s: total }); total += l; }
  const LUT = []; { let si = 0; for (let d = 0; d <= total + 4; d += 4) { while (si < seg.length - 1 && d > seg[si].s + seg[si].l) si++; const s = seg[si], t = Math.min(1, Math.max(0, (d - s.s) / s.l)); LUT.push([s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t, Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0])]); } }
  // smooth the heading over ~48px so units offset from the centre line turn gradually instead of jumping at each joint
  { const n = LUT.length, W = 6, ang = LUT.map((_, i) => { const A = LUT[Math.max(0, i - W)], B = LUT[Math.min(n - 1, i + W)]; return Math.hypot(B[0] - A[0], B[1] - A[1]) > 0.01 ? Math.atan2(B[1] - A[1], B[0] - A[0]) : LUT[i][2]; }); ang.forEach((a, i) => LUT[i][2] = a); }
  // curvature (radians per px) for speed compensation: units on the inside of a bend walk a shorter line
  const curv = d => { const f = Math.max(1, Math.min(LUT.length - 2, Math.round(d / 4))); let da = LUT[f + 1][2] - LUT[f - 1][2]; da = Math.atan2(Math.sin(da), Math.cos(da)); return da / 8; };
  // how much centre-line distance a unit at lateral offset `off` covers per px it actually walks
  const offAt = (d, off) => { const q = at(d); return [q[0] - Math.sin(q[2]) * off, q[1] + Math.cos(q[2]) * off]; };
  const pace = (d, off) => { if (!off) return 1; const A = offAt(d - 3, off), B = offAt(d + 3, off), w = Math.hypot(B[0] - A[0], B[1] - A[1]); return Math.max(0.5, Math.min(2, 6 / Math.max(0.01, w))); };
  const at = d => { const f = Math.max(0, Math.min(LUT.length - 1.001, d / 4)), i = f | 0, t = f - i, A = LUT[i], B = LUT[i + 1]; let da = B[2] - A[2]; da = Math.atan2(Math.sin(da), Math.cos(da)); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + da * t]; };
  const dist = (px, py) => { let m = 1e9; for (const s of seg) { const vx = s.b[0] - s.a[0], vy = s.b[1] - s.a[1], t = Math.max(0, Math.min(1, ((px - s.a[0]) * vx + (py - s.a[1]) * vy) / (s.l * s.l))); m = Math.min(m, Math.hypot(px - s.a[0] - vx * t, py - s.a[1] - vy * t)); } return m; };
  return { P, seg, total, at, dist, curv, pace, gate: C[0] };
}
// everything static about a map for a given defender count: lanes, build grid, trees
const LAYOUTS = {};
function layout(mapId, nDef) {
  const key = mapId + ':' + nDef; if (LAYOUTS[key]) return LAYOUTS[key];
  const map = MAPS.find(m => m.id === mapId && m.on) || MAPS[0], use = map.use[Math.max(1, Math.min(4, nDef))];
  const lanes = use.map(i => buildLane(map.lanes[i]));
  const W = map.W, H = map.H, cols = Math.floor(W / CELL), rows = Math.floor(H / CELL), base = { x: map.base[0], y: map.base[1] };
  const laneDist = (x, y) => { let m = 1e9; for (const L of lanes) m = Math.min(m, L.dist(x, y)); return m; };
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
    if (r < 1 || c < 1 || c >= cols - 1 || r >= rows - 1 || laneDist(x, y) < LANE + CELL * 0.5 - 2 || Math.hypot(x - base.x, (y - base.y) * 1.3) < 150) blocked[r * cols + c] = 1;
  }
  // trees and rocks: decoration; building on top of one clears it
  const R = mulberry32(4242 + nDef), trees = [];
  for (let i = 0; i < 1400 && trees.length < 520; i++) { const x = R() * W, y = R() * H, s = 0.6 + R() * 0.6; if (laneDist(x, y) < LANE + 30 || Math.hypot(x - base.x, y - base.y) < 220 || y < 20) continue; trees.push({ id: trees.length, x, y, s, rock: R() < 0.15, v: Math.floor(R() * 4) }); }
  const L = { map, lanes, use, W, H, cols, rows, blocked, base, trees, laneDist };
  LAYOUTS[key] = L; return L;
}
const footFree = (L, c, r, occ) => { for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) { const cc = c + i, rr2 = r + j; if (cc < 0 || rr2 < 0 || cc >= L.cols || rr2 >= L.rows) return false; const k = rr2 * L.cols + cc; if (L.blocked[k] || (occ && occ[k])) return false; } return true; };

// ---------------- Human race ----------------
const TOWERS = {
  stone: { n: 'Stone Thrower', cost: 30, r: 185, cd: 1, dmg: 23, volley: 1, throws: 1, dt: 'phys', d: 'A caveman on a patch of rocky ground who hurls rocks at one enemy. Level it up for more cavemen, bones, slings and a chieftain. Promotes into the Archer Post.', tip: 'One caveman, a rock every second. Level up for more throwers.' },
  ptero: { n: 'Pterodactyl Roost', cost: 90, r: 170, dmg: 140, splash: 20, fly: 230, bird: 1, dt: 'crush', d: 'A pterodactyl that flies out, drops a boulder on one enemy and everything around it, then flies home for another. The closer the lane, the faster it comes back. Promotes into the Bombard.', tip: 'Boulders that splash. Faster round trips near the lane.' },
  archer: { n: 'Archer Post', promo: 'stone', cost: 30, r: 190, cd: 1, dmg: 20, volley: 1, dt: 'phys', d: 'A wooden watch post full of archers, promoted from a Stone Thrower (it keeps its level). More archers, harder arrows and more range each level.', tip: 'A volley of arrows from 3 to 5 archers, with more range.' },
  cannon: { n: 'Bombard', promo: 'ptero', cost: 100, r: 200, cd: 1.2, dmg: 120, splash: 40, dt: 'blast', d: 'A heavy gun on a stone column. Shells hit everything nearby.', tip: 'Shells hit everything nearby. Best vs crowds.' },
  frost: { n: 'Frost Obelisk', cost: 90, r: 160, cd: 1.0, dmg: 30, slow: 1.6, dt: 'ice', d: 'An ice shard that chills its target, slowing it by half.', tip: 'Chills its target to half speed for 1.6s.' },
  flame: { n: 'Firebreather', cost: 100, r: 140, cone: 0.3, dps: 60, burn: 5, burnPct: 0.12, fuel: 4.5, reload: 1.8, refill: 2.5, dt: 'fire', d: 'A tribal fire-dancer. Breathes a cone of flame through his crossed torches: it burns everything inside and sets them alight for 5s. After 4.5s of breathing his torches go out and he relights them in the fire (1.8s); they top up while he dances.', tip: 'Cone of fire: hits whole clumps and sets them burning for 5s. Relights after 4.5s of fire.' },
  storm: { n: 'Tesla Coil', cost: 140, r: 175, cd: 1.3, dmg: 40, chain: 5, dt: 'shock', d: 'Lightning that arcs to up to 5 enemies.', tip: 'Lightning arcs to up to 5 enemies.' },
};
const TOWER_IDS = Object.keys(TOWERS), BUILD_IDS = TOWER_IDS.filter(k => !TOWERS[k].promo);
// levels 1-5: each level-up rebuilds the tower with a new look and stats
const LEVELS = {
  stone: { cost: [0, 35, 55, 80, 110], volley: [1, 2, 2, 2, 3], dmg: [23, 24, 33, 46, 43], cd: [1, 1, 0.8, 0.8, 0.8], range: [1, 1, 1.15, 1.3, 1.45], names: ['Stone Thrower', 'Two Throwers', 'Bone Yard', 'Slingers', "Chieftain's Circle"] },
  ptero: { cost: [0, 55, 80, 110, 150], dmg: [140, 190, 248, 312, 385], splash: [20, 22, 24, 26, 28], range: [1, 1.06, 1.12, 1.18, 1.24], fly: [230, 245, 260, 275, 290], names: ['Dead tree', 'Old snag', 'Rock snag', 'Crag', 'Peak'] },
  flame: { cost: [0, 70, 100, 140, 190], dps: [60, 72, 86, 102, 120], range: [1, 1.1, 1.2, 1.3, 1.4], wide: [1, 1.1, 1.2, 1.3, 1.4], names: ['Campfire', 'Twin torches', 'Pyre', 'Stone circle', 'White-hot pyre'] },
  archer: { cost: [0, 80, 110, 145, 190], volley: [1, 2, 3, 4, 5], dmg: [52, 40, 37, 37, 38], cd: [0.45, 0.5, 0.55, 0.6, 0.6], range: [1, 1, 1.15, 1.30, 1.45], names: ['Watch post', 'Watch post', 'Timber tower', 'Rough stone tower', 'Stone keep'] },
};
// promotions change a tower into another one (slots without `to` are still locked); keepLvl carries the level over
const PROMOTIONS = {
  stone: [{ n: 'Archer Post', to: 'archer', need: 3, cost: 90 }, { n: 'Promotion II', need: 5 }],
  ptero: [{ n: 'Promotion I', need: 3 }, { n: 'Promotion II', need: 5 }, { n: 'Bombard', to: 'cannon', need: 3, cost: 120 }],
  archer: [{ n: 'Promotion I', need: 3 }, { n: 'Promotion II', need: 5 }],
};
const lvlStat = (k, lvl, key) => { const L = LEVELS[k]; return L && L[key] ? L[key][Math.max(1, Math.min(5, lvl || 1)) - 1] : null; }; // towers only list the stats their levels change
const towerRange = (k, lvl) => TOWERS[k].r * (lvlStat(k, lvl, 'range') || 1);
const towerDmg = (k, lvl) => lvlStat(k, lvl, 'dmg') || TOWERS[k].dmg;
const hordeArmorOf = n => RULES.hordeArmor * Math.min(1, n / RULES.hordeMax);
const towerDps = (k, lvl) => lvlStat(k, lvl, 'dps') || TOWERS[k].dps;
const towerCone = (k, lvl) => (TOWERS[k].cone || 0) * (lvlStat(k, lvl, 'wide') || 1);
const towerVolley = (k, lvl) => lvlStat(k, lvl, 'volley') || TOWERS[k].volley || 1;
const towerCd = (k, lvl) => lvlStat(k, lvl, 'cd') || TOWERS[k].cd;
const towerSplash = (k, lvl) => lvlStat(k, lvl, 'splash') || TOWERS[k].splash || 0;
const towerFly = (k, lvl) => lvlStat(k, lvl, 'fly') || TOWERS[k].fly || 0;
const BIRD = { grab: 0.3, fall: 0.5 };
// a promotion starts the new tower at level 1, so levels bought past the requirement are credited at the sell rate (70%)
const promoCost = (q, lvl, k) => { const L = LEVELS[k]; let paid = 0; if (L) for (let l = q.need + 1; l <= (lvl || 1); l++) paid += L.cost[l - 1] || 0; return Math.max(0, Math.round(q.cost - paid * RULES.sell)); }; // pterodactyl: dip for a boulder, then the boulder's fall time
// ---------------- defender spells (free for now) ----------------
const SPELLS = {
  meteor: { n: 'Meteor', cost: 125, cd: 20, fall: 0.75, core: 45, edge: 165, fireR: 90, fireDur: 6, fireDps: 110, tip: 'Crushes everything at the center, blasts the edge back and leaves the ground burning.' },
  jet: { n: 'Water Jet', cost: 100, cd: 20, drop: 0.55, unfold: 1.45, life: 8, r: 200, cone: 0.34, dps: 18, tip: 'Drops a pump that unfolds and blasts oncoming enemies back with high-pressure water.' },
};
const SPELL_IDS = Object.keys(SPELLS);
const UNITS = {
  // unlock: minute the attacker can first send it. pack: units per send. armor: less damage from arrows and shells.
  grunt: { n: 'Footman', hp: 175, sp: 46, r: 5.5, cost: 5, bounty: 1.6, dmg: 3, body: 'human', unlock: 0, d: 'Cheap and sturdy. 3 damage to the base.' },
  runner: { n: 'Scout', hp: 85, sp: 70, r: 4.5, cost: 2, bounty: 0.7, dmg: 1, body: 'human', unlock: 0, d: 'Fast and fragile. 1 damage to the base.' },
  footknight: { n: 'Knight', hp: 420, sp: 42, r: 6.5, cost: 8, bounty: 2.5, dmg: 4, body: 'human', armor: 0.15, unlock: 0, d: 'An armoured foot knight: tougher than a Footman, lighter than an Ogre. Arrows and shells do 15% less. 4 damage.' },
  troop: { n: 'Scout Troop', swarm: 1, hp: 85, sp: 70, r: 4.5, cost: 10, pack: 6, bounty: 0.55, dmg: 1, body: 'human', unlock: 1, d: 'Six fast scouts per send. A horde: extra income, little bounty. 1 damage each.' },
  warband: { n: 'Footman Warband', swarm: 1, hp: 175, sp: 46, r: 5.5, cost: 25, pack: 6, bounty: 1.4, dmg: 1, body: 'human', unlock: 2, d: 'Six footmen per send. A horde: extra income, little bounty. 1 damage each.' },
  brute: { n: 'Ogre', hp: 650, sp: 40, r: 8.5, cost: 12, bounty: 4, dmg: 12, body: 'ogre', unlock: 2, d: 'Huge and slow. 12 damage to the base.' },
  zombie: { n: 'Zombie Horde', swarm: 1, hp: 70, sp: 24, r: 5, cost: 11, pack: 10, bounty: 0.2, dmg: 1, body: 'hum', unlock: 2, d: 'Ten shambling, hard-to-kill zombies per send. Slow, but they pile up. 1 damage each.' },
  skel: { n: 'Skeleton Horde', swarm: 1, hp: 32, sp: 50, r: 4.2, cost: 5, pack: 6, bounty: 0.25, dmg: 1, body: 'skel', unlock: 2, d: 'Six brittle skeletons per send. They swamp single-target towers. 1 damage each.' },
  gnoll: { n: 'Gnoll Pack', swarm: 1, hp: 120, sp: 60, r: 5, cost: 9, pack: 4, bounty: 0.8, dmg: 2, body: 'hum', unlock: 3, packRage: 0.15, d: 'Four gnolls. Each one that dies makes the rest 15% faster. 2 damage each.' },
  naga: { n: 'Naga Myrmidon', hp: 420, sp: 50, r: 6.5, cost: 10, bounty: 3, dmg: 5, body: 'naga', unlock: 4, slowRes: 0.5, pushRes: 0.7, d: 'Serpent warrior. Shrugs off half of any slow and most of the Water Jet. 5 damage.' },
  sapper: { n: 'Goblin Sapper', hp: 140, sp: 55, r: 4.5, cost: 40, noIncome: 1, bounty: 3, dmg: 4, fixedDmg: 1, body: 'hum', unlock: 5, sapper: { r: 140, sp: 165, stun: 4 }, d: 'Spots a tower within range, sprints straight at it and blows it up, knocking it out for 4s.' },
  warg: { n: 'Warg Rider', hp: 340, sp: 92, r: 7, cost: 11, bounty: 3, dmg: 6, body: 'warg', unlock: 6, d: 'An orc on a giant wolf. Very fast. 6 damage.' },
  shield: { n: 'Shieldwall', hp: 260, sp: 40, r: 6, cost: 16, pack: 4, bounty: 2, dmg: 3, body: 'hum', unlock: 7, frontGuard: 0.6, d: 'Four shield-bearers. Arrows from the front do 60% less. 3 damage each.' },
  knight: { n: 'Mounted Knight', hp: 520, sp: 56, r: 7.5, cost: 18, bounty: 4, dmg: 7, body: 'horse', unlock: 8, charge: { r: 180, mul: 2.2, t: 3 }, d: 'Charges at double speed for 3s when it first sees a tower. 7 damage.' },
  troll: { n: 'Troll Berserker', hp: 900, sp: 48, r: 8, cost: 22, bounty: 6, dmg: 10, body: 'hum', unlock: 9, regen: 0.03, d: 'Regenerates 3% health a second unless it was burned in the last 3s. 10 damage.' },
  chief: { n: 'Ogre Warchief', hp: 1700, sp: 36, r: 10.5, cost: 32, bounty: 10, dmg: 25, body: 'ogre', armor: 0.35, unlock: 10, d: 'Plated ogre lord. Arrows and shells do 35% less. 25 damage.' },
  necro: { n: 'Necromancer', hp: 380, sp: 38, r: 6, cost: 26, bounty: 8, dmg: 6, body: 'hum', unlock: 11, raise: { r: 130, every: 3, n: 3 }, d: 'Raises up to 3 fresh corpses near it as skeletons every 3s. Kill it first. 6 damage.' },
  ent: { n: 'Ent', hp: 2400, sp: 26, r: 12, cost: 45, bounty: 13, dmg: 30, body: 'ent', unlock: 12, fireMul: 2, d: 'A walking oak. Very tough, but fire does double damage. 30 damage.' },
  golem: { n: 'Iron Golem', hp: 2100, sp: 30, r: 11, cost: 40, bounty: 12, dmg: 20, body: 'hum', unlock: 12, shockMul: 0, iceMul: 2, d: 'Immune to the Tesla Coil. Frost does double damage. 20 damage.' },
  ram: { n: 'Siege Ram', hp: 3200, sp: 24, r: 13, cost: 55, bounty: 15, dmg: 45, body: 'ram', unlock: 13, armor: 0.2, fireMul: 0, d: 'Iron-capped battering ram. Can\'t burn; arrows and shells do 20% less. 45 damage.' },
  mammoth: { n: 'War Mammoth', hp: 4500, sp: 26, r: 18, cost: 90, bounty: 25, dmg: 60, body: 'mammoth', unlock: 14, spill: { k: 'grunt', n: 4 }, d: 'A mammoth with a war tower on its back. When it falls, 4 Footmen jump out. 60 damage.' },
  tarrasque: { n: 'Tarrasque', hp: 9000, sp: 17, r: 26, cost: 200, bounty: 120, dmg: 100, noScale: 1, body: 'beast', armor: 0.25, unstoppable: 1, unlock: 15, d: 'A walking catastrophe. Can\'t be slowed, pushed or one-shot. 100 damage.' },
};
{ const order = ['runner', 'grunt', 'footknight'], rest = Object.keys(UNITS).filter(k => !order.includes(k)), all = order.concat(rest), copy = { ...UNITS }; for (const k of Object.keys(UNITS)) delete UNITS[k]; for (const k of all) UNITS[k] = copy[k]; }
const UNIT_IDS = Object.keys(UNITS);
// base damage on a leak scales with the unit's share of its send cost (min 1); descriptions follow
function setLeakRate(r) { RULES.leakRate = r; for (const k of UNIT_IDS) { const U = UNITS[k]; if (U.fixedDmg) continue; U.dmg = Math.max(1, Math.round(U.cost / (U.pack || 1) * r)); U.d = U.d.replace(/\d+ damage/, U.dmg + ' damage'); } }
// gold is per second; kill gold is shared: every defender gets bounty / number of defenders
const RULES = { setup: 10, refundWindow: 10, sendOn: 30, sendOff: 15, hoardRate: 0.01, hoardMax: 0.65, hoardBank: 60, swarmIncome: 1.5, swarmBounty: 0.5, hordeMax: 200, hordeArmor: 0.15, unitSpeed: 0.95, pulse: 15, length: 20 * 60, hpPer: 300, leakRate: 0.5, buildTime: 3, levelTime: 1.5, defGold: 230, defIncome: 1, atkGoldPer: 30, atkIncomePer: 2, sendIncome: 0.0021, leakBounty: 0.5, shellLead: 14, investCost: 80, investGain: 0.8, speedCost: 90, speedStep: 0.05, speedMax: 5, sell: 0.7, hpPerMin: 0.05 };
setLeakRate(RULES.leakRate);
// attack rhythm: after setup, sends open for sendOn seconds, then a sendOff-second pause, repeating
function sendPhase(t) { if (t < RULES.setup) return { open: false, left: RULES.setup - t, setup: true }; const cyc = RULES.sendOn + RULES.sendOff, p = (t - RULES.setup) % cyc; return p < RULES.sendOn ? { open: true, left: RULES.sendOn - p } : { open: false, left: cyc - p }; }
const PRIORITIES = ['first', 'last', 'strong', 'close'];

// ---------------- simulation ----------------
class Sim {
  constructor(o) {
    this.R = mulberry32(o.seed || 1);
    const defs = o.players.filter(p => p.role === 'def'), atk = o.players.find(p => p.role === 'atk');
    this.N = defs.length; this.L = layout(o.map, this.N); this.map = this.L.map;
    this.t = 0; this.tick = 0; this.nid = 1; this.over = null; this.events = []; this.towerVer = 1; this.hpMax = RULES.hpPer * this.N; this.hp = this.hpMax; this.closed = false;
    this.players = {};
    this.atk = { pid: atk.pid, name: atk.name, color: atk.color, race: atk.race, bot: !!atk.bot, gold: RULES.atkGoldPer * this.N, hoard: 0, idle: 0, income: RULES.atkIncomePer * this.N, invest: 0, speed: 0, queue: [], sent: 0, leaked: 0, spent: 0, dmg: 0 };
    this.players[atk.pid] = this.atk;
    this.defs = defs.map((p, i) => { const d = { pid: p.pid, name: p.name, color: p.color, race: p.race, bot: !!p.bot, slot: i, gold: RULES.defGold, income: RULES.defIncome, kills: 0, built: 0, dmg: 0, shared: 0, scd: { meteor: 0, jet: 0 } }; this.players[p.pid] = d; return d; });
    this.noBotSpells = false; // bots only cast in emergencies (see botCast); bot-vs-bot tests can turn this off than ones that buy towers; revisit with upgrades
    this.meteors = []; this.fields = []; this.jets = []; this.graves = []; this.packDead = {}; this.packN = 0; this.laneNext = {};
    this.units = []; this.towers = []; this.pulseT = RULES.pulse; this.wave = 0; this.spawnAt = []; this.pending = [];
    this.occ = new Uint8Array(this.L.cols * this.L.rows); this.grid = new Map();
  }
  // ---- inputs ----
  input(pid, c) {
    const P = this.players[pid]; if (!P || this.over) return;
    if (P === this.atk) {
      if (this.closed) return;
      if (c.c === 'send') { const U = UNITS[c.k]; if (!U || !this.canSend() || this.mins() < U.unlock) return; const lanes = c.lane === 'all' ? this.defs.map(d => d.slot) : [this.defs[c.lane]].filter(Boolean).map(d => d.slot); const n = Math.max(1, Math.min(10, c.n | 0 || 1)), cost = U.cost * lanes.length * n; if (!lanes.length || P.gold < cost) return; this.atkSpend(cost); if (!U.noIncome) P.income += cost * (this.sendInc ?? RULES.sendIncome) * (U.swarm ? RULES.swarmIncome : 1); for (const l of lanes) for (let i = 0; i < n; i++) { const pk = U.pack || 1, pid = pk > 1 ? ++this.packN : 0; for (let j = 0; j < pk; j++) { const gap = j ? 0.07 : this.gate ? Math.max(0.1, U.cost / (this.gate * P.income / this.N)) : 0.1, at = Math.max(this.t, this.laneNext[l] || 0) + gap; this.laneNext[l] = at; this.spawnAt.push({ at, k: c.k, l, pk: pid }); } } P.sent += lanes.length * n; }
      else if (c.c === 'speed') { if (P !== this.atk || this.closed || P.speed >= RULES.speedMax) return; const cost = this.speedCost(); if (P.gold < cost) return; this.atkSpend(cost); P.speed++; }
      return;
    }
    if (c.c === 'build') {
      const T = TOWERS[c.k], cc = c.c2 | 0, r = c.r | 0; if (!T || T.promo || P.gold < T.cost || !footFree(this.L, cc, r, this.occ)) return;
      P.gold -= T.cost; P.built++;
      const t = { id: this.nid++, owner: pid, slot: P.slot, k: c.k, c: cc, r, x: (cc + FOOT / 2) * CELL, y: (r + FOOT / 2) * CELL, cd: 0, aim: Math.PI / 2, prio: 'first', spent: T.cost, kills: 0, ready: this.t + RULES.buildTime, placed: this.t, dealt: 0, lvl: 1 };
      this.towers.push(t); this.mark(t, 1); this.towerVer++;
    }
    else if (c.c === 'sell') { const i = this.towers.findIndex(t => t.id === c.id && t.owner === pid); if (i < 0) return; const t = this.towers[i]; P.gold += this.sellValue(t); this.towers.splice(i, 1); this.mark(t, 0); this.towerVer++; this.ev(['sl', t.x, t.y]); }
    else if (c.c === 'spell') {
      const S = SPELLS[c.k], x = +c.x, y = +c.y; if (!S || !(P.scd[c.k] <= this.t) || P.gold < S.cost || !(x >= 0 && x <= this.L.W && y >= -40 && y <= this.L.H)) return;
      P.scd[c.k] = this.t + S.cd; P.gold -= S.cost; P.spellGold = (P.spellGold || 0) + S.cost; const src = { owner: pid, kills: 0, x, y };
      if (c.k === 'meteor') { this.meteors.push({ x, y, at: this.t + S.fall, src }); this.ev(['sp', 0, Math.round(x), Math.round(y), P.slot]); }
      else {
        // which lane it sits on, how far along, and how far off-center
        let best = 1e18, l = 0, jd = 0;
        this.L.lanes.forEach((ln, li) => { for (let d = 0; d < ln.total; d += 8) { const q = ln.at(d), dd = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (dd < best) { best = dd; l = li; jd = d; } } });
        const ln = this.L.lanes[l], c0 = ln.at(jd), up = ln.at(Math.max(0, jd - 60)), off = (x - c0[0]) * -Math.sin(c0[2]) + (y - c0[1]) * Math.cos(c0[2]);
        const j = { id: this.nid++, x, y, t0: this.t, l, jd, off, aim: Math.atan2(up[1] - y, up[0] - x), fire: 0, src };
        this.jets.push(j); this.ev(['sp', 1, Math.round(x), Math.round(y), P.slot, j.id, Math.round(j.aim * 100)]);
      }
    }
    else if (c.c === 'level') {
      const t = this.towers.find(o => o.id === c.id && o.owner === pid), Lv = t && LEVELS[t.k]; if (!Lv || t.lvl >= 5 || t.ready > this.t) return;
      const cost = Lv.cost[t.lvl]; if (P.gold < cost) return;
      P.gold -= cost; t.spent += cost; t.lvl++; t.ready = this.t + RULES.levelTime; t.shots = null; t.cd = 0; this.towerVer++; this.ev(['lv', t.id, t.lvl]);
    }
    else if (c.c === 'promote') {
      const t = this.towers.find(o => o.id === c.id && o.owner === pid), q = t && (PROMOTIONS[t.k] || [])[c.i | 0];
      const pc = q && promoCost(q, t.lvl, t.k); if (!q || !q.to || (t.lvl || 1) < q.need || t.ready > this.t || P.gold < pc) return;
      P.gold -= pc; t.spent += pc; t.k = q.to; t.lvl = 1; t.ready = this.t + RULES.buildTime; t.shots = null; t.cd = 0; t.covLvl = -1; this.towerVer++; this.ev(['pr', t.id, TOWER_IDS.indexOf(q.to)]);
    }
    else if (c.c === 'prio') { const t = this.towers.find(t => t.id === c.id && t.owner === pid); if (t && PRIORITIES.includes(c.p)) { t.prio = c.p; this.towerVer++; } }
  }
  refundable(t) { return !t.dealt && this.t - t.placed < RULES.refundWindow; }
  sellValue(t) { return this.refundable(t) ? t.spent : Math.floor(t.spent * RULES.sell + 1e-6); }
  mark(t, v) { for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) this.occ[(t.r + j) * this.L.cols + t.c + i] = v; }
  speedCost() { return Math.round(RULES.speedCost * this.N * Math.pow(1.6, this.atk.speed)); }
  investCost() { return Math.round(RULES.investCost * this.N * Math.pow(1.3, this.atk.invest)); }
  ev(e) { this.events.push(e); }
  // hoarding tax (test flag `hoardTax`): a bank bigger than `free` seconds of income cuts income, down to 50% at `full` seconds
  // hoarding counter: +1%/s (max 65%) while his bank is over 60g during open sending; spending x% of his bank cuts it by x%
  hoardMul() { return this.hoardTax === false ? 1 : 1 - this.atk.hoard; }
  stepHoard(dt) { const A = this.atk; if (this.hoardTax === false || this.t < RULES.setup || this.closed || !this.canSend()) return; if (A.gold > RULES.hoardBank) A.hoard = Math.min(RULES.hoardMax, A.hoard + RULES.hoardRate * dt); }
  atkSpend(cost) { const A = this.atk, before = A.gold; A.gold -= cost; A.spent += cost; A.hoard *= before > 0 ? Math.max(0, A.gold) / before : 0; }
  hordeArmor(l) { return RULES.hordeArmor * Math.min(1, ((this.hordeN && this.hordeN[l]) || 0) / RULES.hordeMax); }
  canSend() { return this.noPause ? this.t >= RULES.setup : sendPhase(this.t).open; }
  mins() { return Math.max(0, this.t - RULES.setup) / 60; }
  // ---- step ----
  step(dt) {
    if (this.over) return; this.t += dt; this.tick++;
    // steady income every second
    const per = dt; this.stepHoard(dt); if (this.t >= RULES.setup) this.atk.gold += this.atk.income * per * this.hoardMul(); for (const d of this.defs) d.gold += d.income * per;
    // after the time limit the attacker can't send any more; the match ends when the field is clear
    if (!this.closed && this.t >= RULES.setup + RULES.length) { this.closed = true; this.atk.queue = []; this.ev(['closed']); }
    { const hc = this.hordeN = this.hordeN || []; hc.fill(0); for (const u of this.units) if (u.hp > 0) hc[u.l] = (hc[u.l] || 0) + 1; }
    if (this.spawnAt.length) { const due = this.spawnAt.filter(s => s.at <= this.t); if (due.length) { this.spawnAt = this.spawnAt.filter(s => s.at > this.t); due.forEach(s => this.spawn(s.k, s.l, s.pk ? { pk: s.pk } : null)); } }
    // units walk their lane into the shared base
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      if (u.bd) { if (u.burn > 0) { this.hurt(u, u.bd * dt, 'fire', u.bsrc); if (u.hp <= 0) continue; } else u.bd = 0; }
      const lane = this.L.lanes[u.l], air = u.air > 0;
      const U = UNITS[u.k], slow = u.slowU > this.t && !U.unstoppable ? 1 - 0.5 * (1 - (U.slowRes || 0)) : 1;
      if (u.run) { this.stepSapper(u, dt); continue; }
      let spd = u.sp * slow; if (U.packRage && u.pk) spd *= 1 + U.packRage * Math.min(3, this.packDead[u.pk] || 0); if (u.chargeUntil > this.t) spd *= U.charge.mul;
      if (U.regen && u.hp < u.max && !(u.burnLock > this.t)) u.hp = Math.min(u.max, u.hp + u.max * U.regen * dt);
      if ((U.charge && !u.charged || U.sapper) && (this.tick + u.id) % 5 === 0) this.scan(u, U);
      u.v = spd * (air ? 0 : 1) + (u.kb || 0); u.d = Math.max(-30, u.d + u.v * dt * (u.d > 0 ? lane.pace(u.d, u.off) : 1)); u.burn = Math.max(0, u.burn - dt);
      if (u.kb || u.lv) { u.kb *= Math.exp(-3.2 * dt); u.off = Math.max(-LANE + 6, Math.min(LANE - 6, u.off + (u.lv || 0) * dt)); u.lv *= Math.exp(-4 * dt); if (Math.abs(u.kb) < 1) u.kb = 0; if (Math.abs(u.lv) < 1) u.lv = 0; u.mvT = this.t; }
      if (air) u.air -= dt;
      if (u.free) { u.free = 0; const q = lane.at(u.d); u.x = q[0]; u.y = q[1]; } // back on the lane
      if (u.d >= lane.total) { u.dead = 1; const dmg = UNITS[u.k].dmg; this.hp = Math.max(0, this.hp - dmg); this.atk.leaked++; this.atk.dmg += dmg; const ls = UNITS[u.k].bounty * (UNITS[u.k].swarm ? RULES.swarmBounty : 1) * RULES.leakBounty / this.N; for (const d of this.defs) { d.gold += ls; d.shared += ls; } this.ev(['lk', u.id, dmg]); continue; }
      const p = lane.at(u.d); u.x = p[0] + Math.cos(p[2] + Math.PI / 2) * u.off; u.y = p[1] + Math.sin(p[2] + Math.PI / 2) * u.off;
    }
    this.units = this.units.filter(u => !u.dead);
    if (this.necros) this.stepNecros(dt);
    if (this.meteors.length || this.fields.length || this.jets.length) this.stepSpells(dt);
    const GR = 120, grid = this.grid; grid.clear();
    for (const u of this.units) { const key = (u.x / GR | 0) * 4096 + Math.max(0, u.y / GR | 0); let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(u); }
    const near = (px, py, r, fn) => { const x0 = Math.max(0, (px - r) / GR | 0), x1 = (px + r) / GR | 0, y0 = Math.max(0, (py - r) / GR | 0), y1 = (py + r) / GR | 0; for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const b = grid.get(gx * 4096 + gy); if (b) for (const u of b) if (u.hp > 0 && (u.x - px) ** 2 + (u.y - py) ** 2 < r * r) fn(u); } };
    this.beams = [];
    for (const t of this.towers) {
      if (t.ready > this.t || t.off > this.t) continue;
      const T = TOWERS[t.k]; t.cd -= dt;
      if (t.rl > this.t) continue; // Firebreather relighting his torches
      let best = null, score = -Infinity, alive = null, aScore = -Infinity;
      near(t.x, t.y, towerRange(t.k, t.lvl), u => { const s = t.prio === 'first' ? u.d / this.L.lanes[u.l].total : t.prio === 'last' ? -u.d : t.prio === 'strong' ? u.hp : -((u.x - t.x) ** 2 + (u.y - t.y) ** 2); if (s > score) { score = s; best = u; } if (T.volley && (u.inc || 0) < u.hp && s > aScore) { aScore = s; alive = u; } });
      if (T.volley && alive) best = alive;
      if (T.fuel) { if (t.fuel === undefined) t.fuel = T.fuel; if (!best) t.fuel = Math.min(T.fuel, t.fuel + dt * T.fuel / T.refill); }
      if (!best) continue;
      t.aim = Math.atan2(best.y - t.y, best.x - t.x);
      if (T.cone) { // Firebreather: everything inside the cone burns, and keeps burning for T.burn seconds
        this.beams.push(t.id, best.id); const half = towerCone(t.k, t.lvl), dps = towerDps(t.k, t.lvl), bd = dps * T.burnPct;
        near(t.x, t.y, towerRange(t.k, t.lvl), u => { let da = Math.atan2(u.y - t.y, u.x - t.x) - t.aim; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; if (Math.abs(da) > half && (u.x - t.x) ** 2 + (u.y - t.y) ** 2 > 400) return; this.hurt(u, dps * dt, 'fire', t); u.burn = T.burn; if (!(u.bd > bd)) { u.bd = bd; u.bsrc = t; } });
        t.fuel -= dt; if (t.fuel <= 0) { t.fuel = T.fuel; t.rl = this.t + T.reload; this.ev(['rl', t.id, Math.round(T.reload * 100)]); }
        continue; }
      if (T.dps) { this.beams.push(t.id, best.id); best.burn = 0.3; this.hurt(best, T.dps * dt, 'fire', t); continue; }
      if (T.volley && t.shots) { for (let i = 0; i < t.shots.length; i++) if (t.shots[i] >= 0 && this.t >= t.shots[i]) { t.shots[i] = -1; this.loose(t, best, i); } }
      if (t.cd > 0) continue; t.cd = towerCd(t.k, t.lvl);
      if (T.bird) { // fly out, drop a boulder where the target will be when it lands, fly home
        const fly = towerFly(t.k, t.lvl), d0 = Math.hypot(best.x - t.x, best.y - t.y), out = d0 / fly, tImp = BIRD.grab + out * 0.9 + BIRD.fall, R = towerRange(t.k, t.lvl);
        let ax = best.x, ay = best.y; if (!best.run) { const ln = this.L.lanes[best.l], q = ln.at(Math.min(ln.total, best.d + (best.v || 0) * tImp)); ax = q[0] + Math.cos(q[2] + Math.PI / 2) * best.off; ay = q[1] + Math.sin(q[2] + Math.PI / 2) * best.off; }
        const dd = Math.hypot(ax - t.x, ay - t.y); if (dd > R) { ax = t.x + (ax - t.x) * R / dd; ay = t.y + (ay - t.y) * R / dd; }
        t.cd = BIRD.grab + out * 0.9 + Math.hypot(ax - t.x, ay - t.y) / fly + 0.1;
        this.ev(['pt', t.id, best.id, Math.round(ax), Math.round(ay), Math.round(tImp * 100)]);
        this.pending.push({ at: this.t + tImp, t, u: best, x: ax, y: ay, fixed: 1, bd: towerDmg(t.k, t.lvl), sp: towerSplash(t.k, t.lvl) }); continue;
      }
      if (T.volley) { // plan this volley: each archer gets its own random moment
        const n = towerVolley(t.k, t.lvl), span = n > 1 ? 0.8 * t.cd : 0, slot = n > 1 ? span / n : 0, at = []; for (let i = 0; i < n; i++) at.push(this.t + i * slot + (n > 1 ? rr(this.R, 0, Math.max(0, slot - 0.09)) : 0));
        for (let i = at.length - 1; i > 0; i--) { const j = Math.floor(this.R() * (i + 1)); [at[i], at[j]] = [at[j], at[i]]; }
        t.shots = at; for (let i = 0; i < n; i++) if (at[i] <= this.t) { at[i] = -1; this.loose(t, best, i); }
        continue;
      }
      if (T.chain) {
        const hit = [best]; let cur = best;
        for (let i = 1; i < T.chain; i++) { let nb = null, nd = 1e9; near(cur.x, cur.y, 70, u => { if (hit.includes(u)) return; const d = (u.x - cur.x) ** 2 + (u.y - cur.y) ** 2; if (d < nd) { nd = d; nb = u; } }); if (!nb) break; hit.push(nb); cur = nb; }
        this.ev(['z', t.id, hit.map(u => u.id)]); hit.forEach(u => this.hurt(u, T.dmg, 'shock', t)); continue;
      }
      if (T.splash) { // Bombard: the shell lands on a fixed spot, led only a short way ahead of the target, never past max range
        const fly0 = Math.hypot(best.x - t.x, best.y - t.y) / 340, lead = Math.max(0, Math.min(RULES.shellLead, (best.v || 0) * fly0));
        let ax = best.x, ay = best.y; if (!best.run && lead > 0) { const q = this.L.lanes[best.l].at(Math.min(this.L.lanes[best.l].total, best.d + lead)); ax = q[0] + Math.cos(q[2] + Math.PI / 2) * best.off; ay = q[1] + Math.sin(q[2] + Math.PI / 2) * best.off; }
        const R = towerRange(t.k, t.lvl), dd = Math.hypot(ax - t.x, ay - t.y); if (dd > R) { ax = t.x + (ax - t.x) * R / dd; ay = t.y + (ay - t.y) * R / dd; }
        const fly = Math.hypot(ax - t.x, ay - t.y) / 340;
        this.ev(['s', t.id, best.id, Math.round(fly * 100), -1, Math.round(ax), Math.round(ay)]);
        this.pending.push({ at: this.t + fly, t, u: best, x: ax, y: ay, fixed: 1 }); continue;
      }
      const fly = Math.hypot(best.x - t.x, best.y - t.y) / (t.k === 'archer' ? 560 : 420);
      this.ev(['s', t.id, best.id, Math.round(fly * 100)]);
      this.pending.push({ at: this.t + fly, t, u: best, x: best.x, y: best.y });
    }
    if (this.pending.length) {
      const due = this.pending.filter(p => p.at <= this.t); this.pending = this.pending.filter(p => p.at > this.t);
      for (const p of due) { if (p.dmg) p.u.inc = Math.max(0, (p.u.inc || 0) - p.dmg); const T = TOWERS[p.t.k], x = p.u.hp > 0 && !p.fixed ? p.u.x : p.x, y = p.u.hp > 0 && !p.fixed ? p.u.y : p.y; const spl = p.sp || T.splash; if (spl) near(x, y, spl, u => this.hurt(u, p.bd || T.dmg, p.bd ? 'crush' : 'blast', p.t, x, y)); else if (p.u.hp > 0) { if (T.slow) p.u.slowU = this.t + T.slow; this.hurt(p.u, p.dmg || T.dmg, T.dt, p.t); } }
    }
    this.units = this.units.filter(u => u.hp > 0);
    if (this.hp <= 0) this.finish('atk');
    else if (this.closed && !this.units.length && !this.spawnAt.length) this.finish('def');
    if (this.atk.bot) this.botAttack(); for (const d of this.defs) if (d.bot) this.botDefend(d);
  }
  loose(t, u, who) { // one archer's arrow, or one caveman's rock (he winds up first; slings throw harder)
    const dmg = towerDmg(t.k, t.lvl), d = Math.hypot(u.x - t.x, u.y - t.y);
    if (TOWERS[t.k].throws) { const sling = t.lvl >= 4, wind = sling ? 0.28 : 0.3, fly = sling ? 0.12 + d / 450 : 0.35 + d / 300;
      this.ev(['th', t.id, u.id, who, Math.round(wind * 100), Math.round(fly * 100)]); u.inc = (u.inc || 0) + dmg;
      this.pending.push({ at: this.t + wind + fly, t, u, x: u.x, y: u.y, dmg }); return; }
    const fly = d / 560;
    this.ev(['s', t.id, u.id, Math.round(fly * 100), who]); u.inc = (u.inc || 0) + dmg;
    this.pending.push({ at: this.t + fly, t, u, x: u.x, y: u.y, dmg });
  }
  near(px, py, r, fn) { for (const u of this.units) if (u.hp > 0 && (u.x - px) ** 2 + (u.y - py) ** 2 < r * r) fn(u, Math.hypot(u.x - px, u.y - py)); }
  shove(u, dx, dy, along, side) { const U = UNITS[u.k]; if (U.unstoppable) return; const res = 1 - (U.pushRes || 0) * 0.5; along *= res; side *= res; const a = this.L.lanes[u.l].at(u.d)[2], tx = Math.cos(a), ty = Math.sin(a); u.kb = (u.kb || 0) + (dx * tx + dy * ty) * along; u.lv = (u.lv || 0) + (dx * -ty + dy * tx) * side; u.mvT = this.t; }
  stepSpells(dt) {
    const M = SPELLS.meteor, J = SPELLS.jet;
    for (const m of this.meteors) if (m.at <= this.t) {
      m.done = 1; this.ev(['mi', Math.round(m.x), Math.round(m.y)]);
      this.near(m.x, m.y, M.edge, (u, d) => {
        if (d < M.core) return this.hurt(u, UNITS[u.k].unstoppable ? 1500 : 1e6, 'meteor', m.src, m.x, m.y);
        const f = 1 - (d - M.core) / (M.edge - M.core); this.hurt(u, 120 + 380 * f, 'meteor', m.src, m.x, m.y);
        if (u.hp > 0) { this.shove(u, (u.x - m.x) / d, (u.y - m.y) / d, 420 * f, 160 * f); if (!UNITS[u.k].unstoppable) u.air = 0.35 + 0.3 * f; u.burn = 1.2; }
      });
      this.fields.push({ x: m.x, y: m.y, r: M.fireR, until: this.t + M.fireDur, tick: 0, src: m.src });
    }
    this.meteors = this.meteors.filter(m => !m.done);
    for (const f of this.fields) { f.tick -= dt; if (f.tick > 0) continue; f.tick = 0.2; this.near(f.x, f.y, f.r, u => { u.burn = 0.6; this.hurt(u, M.fireDps * 0.2, 'fire', f.src, f.x, f.y); }); }
    this.fields = this.fields.filter(f => f.until > this.t);
    for (const j of this.jets) {
      const age = this.t - j.t0;
      if (age >= J.drop && !j.landed) { // the payload crushes what it lands on
        j.landed = 1; this.near(j.x, j.y, 60, (u, d) => { if (d < 20) return this.hurt(u, UNITS[u.k].unstoppable ? 600 : 1e6, 'blast', j.src, j.x, j.y); const f = 1 - d / 60; this.shove(u, (u.x - j.x) / (d || 1), (u.y - j.y) / (d || 1), 200 * f, 160 * f); if (!UNITS[u.k].unstoppable) u.air = 0.2 + 0.2 * f; });
      }
      if (j.landed && age < J.unfold + J.life + 0.4) for (const u of this.units) { // a solid obstacle: walk around it
        if (u.l !== j.l || u.hp <= 0 || UNITS[u.k].unstoppable) continue; const dd = u.d - j.jd; if (dd < -45 || dd > 18) continue;
        const gap = Math.abs(u.off - j.off), clear = 20 + UNITS[u.k].r; if (gap >= clear) continue;
        u.lv = (u.lv || 0) + (u.off - j.off >= 0 ? 1 : -1) * (clear - gap) * 260 * dt; if (dd > -14) u.kb = Math.min(u.kb || 0, -u.sp * 0.6); u.mvT = this.t;
      }
      j.fire = 0; if (age < J.unfold || age > J.unfold + J.life) continue;
      let best = null, bs = 1e18; this.near(j.x, j.y, J.r, (u, d) => { const s2 = (u.l === j.l && u.d <= j.jd + 15 ? 0 : 1e6) + d * d; if (s2 < bs) { bs = s2; best = u; } });
      if (!best) continue; j.fire = 1;
      let da = Math.atan2(best.y - j.y, best.x - j.x) - j.aim; da = Math.atan2(Math.sin(da), Math.cos(da)); j.aim += da * Math.min(1, dt * 6);
      const ca = Math.cos(j.aim), sa = Math.sin(j.aim);
      this.near(j.x, j.y, J.r, (u, d) => {
        let off = Math.atan2(u.y - j.y, u.x - j.x) - j.aim; off = Math.atan2(Math.sin(off), Math.cos(off)); if (Math.abs(off) > J.cone) return;
        const f = (1 - d / J.r * 0.6) * (1 - Math.abs(off) / J.cone * 0.5), a = this.L.lanes[u.l].at(u.d)[2], tx = Math.cos(a), ty = Math.sin(a), U = UNITS[u.k], wt = U.unstoppable ? 0 : (1 - (U.pushRes || 0)) * (U.r >= 8 ? 0.35 : u.k === 'runner' ? 1.25 : 1);
        u.kb = Math.max(-260, (u.kb || 0) - (0.55 + 0.45 * Math.abs(ca * tx + sa * ty)) * 1500 * f * wt * dt); u.lv = (u.lv || 0) + (ca * -ty + sa * tx) * 500 * f * wt * dt; u.wet = this.t + 0.35; u.mvT = this.t;
        this.hurt(u, J.dps * dt, 'water', j.src, j.x, j.y);
      });
    }
    this.jets = this.jets.filter(j => this.t - j.t0 < J.unfold + J.life + 0.8);
  }
  spawn(k, l, o) {
    const U = UNITS[k]; if (!this.L.lanes[l]) return;
    const hp = Math.round(U.hp * (U.noScale ? 1 : 1 + RULES.hpPerMin * this.mins()));
    const m = Math.max(10, U.r + 4), u = { id: this.nid++, k, l, d: -10 - this.R() * 20, off: Math.round(rr(this.R, -LANE + m, LANE - m)), sp: Math.round(U.sp * (this.spdMul || RULES.unitSpeed) * (1 + (this.spdStep ?? RULES.speedStep) * this.atk.speed) * rr(this.R, 0.92, 1.08)), hp, max: hp, slowU: 0, burn: 0, x: 0, y: 0 };
    if (o) { if (o.d !== undefined) u.d = o.d; if (o.off !== undefined) u.off = o.off; if (o.pk) u.pk = o.pk; }
    if (U.raise) this.necros = (this.necros || 0) + 1;
    this.units.push(u); this.ev(['u', u.id, UNIT_IDS.indexOf(k), l, u.off, u.sp, Math.round(u.d)]); return u;
  }
  // knights notice towers and charge; sappers pick a tower and break off from the lane
  scan(u, U) {
    const R2 = (U.charge ? U.charge.r : U.sapper.r) ** 2; let best = null, bd = R2;
    for (const t of this.towers) { if (U.charge && t.ready > this.t) continue; if (U.sapper && (t.off > this.t || this.claimed(t))) continue; const d2 = (t.x - u.x) ** 2 + (t.y - u.y) ** 2; if (d2 < bd) { bd = d2; best = t; } }
    if (!best) return;
    if (U.charge) { u.charged = 1; u.chargeUntil = this.t + U.charge.t; this.ev(['ch', u.id]); }
    else { u.run = best.id; best.sapped = u.id; u.mvT = this.t; }
  }
  // a tower is claimed while a living sapper is sprinting at it
  claimed(t) { if (!t.sapped) return false; const s2 = this.units.find(o => o.id === t.sapped); if (s2 && s2.hp > 0 && s2.run === t.id) return true; t.sapped = 0; return false; }
  stepSapper(u, dt) {
    const U = UNITS[u.k], t = this.towers.find(o => o.id === u.run);
    if (!t) { u.run = 0; return; }   // tower sold: walk back onto the lane
    const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy), sp = U.sapper.sp * (u.slowU > this.t ? 0.6 : 1);
    if (d < 14) { t.off = this.t + U.sapper.stun; t.sapped = 0; this.towerVer++; u.dead = 1; u.hp = 0; this.ev(['sx', u.id, Math.round(t.x), Math.round(t.y), t.id]); return; }
    u.x += dx / d * Math.min(d, sp * dt); u.y += dy / d * Math.min(d, sp * dt); u.free = 1;
  }
  stepNecros(dt) {
    this.graves = this.graves.filter(g => this.t - g.t < 8); let alive = 0;
    for (const u of this.units) { const R2 = UNITS[u.k].raise; if (!R2 || u.hp <= 0) continue; alive++;
      u.raiseT = (u.raiseT || R2.every) - dt; if (u.raiseT > 0) continue; u.raiseT = R2.every;
      let n = 0; for (const g of this.graves) { if (n >= R2.n) break; if ((g.x - u.x) ** 2 + (g.y - u.y) ** 2 > R2.r * R2.r) continue; g.t = -99; n++; this.spawn('skel', g.l, { d: g.d, off: g.off }); this.ev(['rz', Math.round(g.x), Math.round(g.y), u.id]); }
      this.graves = this.graves.filter(g => g.t > 0); }
    this.necros = alive;
  }
  hurt(u, amt, type, t, sx, sy) {
    if (u.hp <= 0) return;
    const Ua = UNITS[u.k]; if (Ua.armor && (type === 'phys' || type === 'blast' || type === 'crush')) amt *= 1 - Ua.armor;
    if (type === 'fire' && Ua.fireMul !== undefined) amt *= Ua.fireMul; if (type === 'shock' && Ua.shockMul !== undefined) amt *= Ua.shockMul; if (type === 'ice' && Ua.iceMul) amt *= Ua.iceMul;
    if (type === 'fire' || type === 'meteor') u.burnLock = this.t + 3;
    if (Ua.frontGuard && type === 'phys' && t.x !== undefined) { const a = this.L.lanes[u.l].at(u.d)[2]; if ((t.x - u.x) * Math.cos(a) + (t.y - u.y) * Math.sin(a) > 0) amt *= 1 - Ua.frontGuard; }
    amt *= 1 - this.hordeArmor(u.l); // a crowded lane shields every unit on it
    if (amt <= 0) return;
    u.hp -= amt; const D = this.players[t.owner]; if (D) D.dmg += amt; if (t.k && !t.dealt) { t.dealt = 1; this.towerVer++; }
    if (u.hp <= 0) {
      u.hp = 0; t.kills++; if (D) D.kills++;
      const share = UNITS[u.k].bounty * (UNITS[u.k].swarm ? RULES.swarmBounty : 1) / this.N; for (const d of this.defs) { d.gold += share; d.shared += share; }
      this.ev(['d', u.id, type, Math.round(sx !== undefined ? sx : t.x), Math.round(sy !== undefined ? sy : t.y)]);
      if (u.pk) this.packDead[u.pk] = (this.packDead[u.pk] || 0) + 1;
      if (u.run) { const tt = this.towers.find(o => o.id === u.run); if (tt && tt.sapped === u.id) tt.sapped = 0; }
      if (!u.run) this.graves.push({ l: u.l, d: u.d, off: u.off, x: u.x, y: u.y, t: this.t });
      if (Ua.spill) for (let i = 0; i < Ua.spill.n; i++) this.spawn(Ua.spill.k, u.l, { d: u.d + rr(this.R, -12, 12), off: Math.max(-LANE + 10, Math.min(LANE - 10, u.off + rr(this.R, -20, 20))) });
    }
  }
  finish(w) { this.over = { winner: w, t: this.t }; this.ev(['over', w]); }
  // ---- bots ----
  botAttack() {
    if (this.tick % 20 || this.closed) return; const A = this.atk;
    // upgrades on a schedule; save up for one that's due (but keep sending if it's far off)
    const wantSpd = A.speed < RULES.speedMax && A.speed < Math.floor(this.mins() / 3), wantInv = false; // Invest was removed: income only grows by sending
    if (wantSpd && A.gold >= this.speedCost()) this.input(A.pid, { c: 'speed' });
    const need = wantSpd ? this.speedCost() : wantInv ? this.investCost() : 0;
    if (need && A.gold < need && A.gold + A.income * 8 >= need) return;
    if (!this.canSend() || (this.botHold && this.botHold())) return; // pause (or a test bot that chooses to hold its gold): upgrades only
    const lanes = this.defs.length;
    const W = { grunt: 22, runner: 12, footknight: 12, troop: 7, warband: 7, brute: 10, zombie: 12, skel: 14, gnoll: 10, naga: 10, sapper: 5, warg: 9, shield: 7, knight: 7, troll: 6, chief: 5, necro: 4, ent: 3, golem: 3, ram: 2, mammoth: 2 }, open = Object.keys(W).filter(k => this.mins() >= UNITS[k].unlock), tot = open.reduce((s2, k) => s2 + W[k], 0);
    if (this.mins() >= UNITS.tarrasque.unlock && !this.units.some(u => u.k === 'tarrasque')) { const c2 = UNITS.tarrasque.cost * lanes; if (A.gold >= c2) this.input(A.pid, { c: 'send', k: 'tarrasque', lane: 'all' }); else if (A.gold + A.income * 40 >= c2) return; }
    // test flag botMix: commit to each rolled unit and save for it, instead of re-rolling until something cheap comes up
    let guard = 40; while (guard-- > 0) { let k = this.botMix && A.want; if (!k) { let roll = this.R() * tot; k = open[0]; for (const o of open) { roll -= W[o]; if (roll <= 0) { k = o; break; } } } const cost = UNITS[k].cost * lanes; if (A.gold < cost + Math.min(A.income * 3, RULES.hoardBank * 0.5)) { if (this.botMix) A.want = k; break; } A.want = null; this.input(A.pid, { c: 'send', k, lane: 'all' }); }
  }
  botDefend(D) {
    if ((this.tick + D.slot * 5) % 20) return;
    const lane = this.L.lanes[D.slot];
    if (!this.botSpots) this.botSpots = {};
    if (!this.botSpots[D.slot]) { const s = []; for (let r = 0; r < this.L.rows; r += 2) for (let c = 0; c < this.L.cols; c += 2) { const x = (c + 1) * CELL, y = (r + 1) * CELL, d = lane.dist(x, y); if (d > LANE + 90 || d < LANE + 10) continue; let cov = 0; for (let q = 0; q < lane.total; q += 40) { const p = lane.at(q); if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < 175 * 175) cov++; } s.push([c, r, cov - y * 0.002, d]); } s.sort((a, b) => b[2] - a[2]); this.botSpots[D.slot] = s; }
    if (this.botCast(D, lane)) return;
    // pick a tower that answers what is walking down this lane
    const mine = this.towers.filter(t => t.owner === D.pid), seen = { swarm: 0, armor: 0, big: 0, golem: 0, ent: 0, ram: 0, n: 0 };
    for (const u of this.units) { if (u.l !== D.slot) continue; const U = UNITS[u.k]; seen.n++; if (U.pack) seen.swarm++; if (U.armor) seen.armor++; if (U.r >= 8) seen.big++; if (u.k === 'golem') seen.golem++; if (u.k === 'ent') seen.ent++; if (u.k === 'ram') seen.ram++; }
    // a big attacker bank (or a crowd on the lane) means a dump is coming: keep a Meteor's worth of gold and favour splash
    const A = this.atk, threat = false && (A.gold > Math.max(150 * this.N, A.income * 35) || seen.n >= 20), reserve = threat && D.scd.meteor <= this.t + 6 ? SPELLS.meteor.cost + 20 : 0;
    let k;
    if (mine.length < 2) k = 'stone';
    else if (threat && seen.n < 6) k = mine.length % 2 ? 'flame' : 'ptero';
    else if (seen.n) { const w = { stone: 3, ptero: 1 + seen.swarm * 0.6, storm: 0.5 + seen.swarm * 0.4 - seen.golem * 3, frost: 1 + seen.big * 0.5 + seen.golem * 2, flame: 1 + seen.swarm * 0.7 + seen.ent * 2 - seen.ram * 3 }; k = Object.keys(w).sort((a, b) => w[b] - w[a])[mine.length % 3 === 2 ? 1 : 0]; }
    else k = ['stone', 'stone', 'ptero', 'stone', 'stone', 'flame', 'frost', 'ptero'][mine.length % 8];
    // promote a maxed-out Stone Thrower into an Archer Post once the field is well built
    const pro = !this.noPromote && mine.length >= 6 && mine.find(o => o.k === 'stone' && o.lvl === 3 && o.ready <= this.t);
    if (pro && this.R() < 0.4) { const i = PROMOTIONS.stone.findIndex(q => q.to === 'archer'); if (D.gold - reserve >= promoCost(PROMOTIONS.stone[i], pro.lvl, pro.k) + 30) return this.input(D.pid, { c: 'promote', id: pro.id, i }); }
    const up = mine.length >= 4 && mine.filter(o => LEVELS[o.k] && o.lvl < 5 && o.ready <= this.t).sort((a, b) => a.lvl - b.lvl)[0];
    if (up && D.gold - reserve >= LEVELS[up.k].cost[up.lvl] && (mine.length >= 10 || this.R() < 0.45)) return this.input(D.pid, { c: 'level', id: up.id });
    if (D.gold - reserve < TOWERS[k].cost) return;
    // short-range towers hug the lane
    const near = TOWERS[k].r < 150, spot = (near && this.botSpots[D.slot].find(([c, r, , d]) => d < LANE + 36 && footFree(this.L, c, r, this.occ))) || this.botSpots[D.slot].find(([c, r]) => footFree(this.L, c, r, this.occ));; if (spot) this.input(D.pid, { c: 'build', k, c2: spot[0], r: spot[1] });
  }
  // bots cast too: a Meteor on the thickest clump (aimed where it will be), the Water Jet when the lane is being overrun
  // emergency spells only: units have already walked past every tower this bot owns on its lane and will reach the base before a new tower could matter
  botCast(D, lane) {
    if (this.t < RULES.setup || this.noBotSpells) return false;
    const towers = this.towers.filter(t => t.owner === D.pid && t.ready <= this.t); if (!towers.length) return false;
    let cover = 0;
    for (const t of towers) { if (t.covLvl !== t.lvl) { const R2 = towerRange(t.k, t.lvl) * 0.95; let m = 0; for (let d = 0; d < lane.total; d += 12) { const q = lane.at(d); if ((q[0] - t.x) ** 2 + (q[1] - t.y) ** 2 < R2 * R2) m = d; } t.cov = m; t.covLvl = t.lvl; } cover = Math.max(cover, t.cov); }
    const past = this.units.filter(u => u.l === D.slot && !u.run && u.hp > 0 && u.d > cover + 10); if (!past.length) return false;
    const front = past.reduce((m, u) => u.d > m.d ? u : m, past[0]), secs = (lane.total - front.d) / Math.max(10, front.sp), dmg = past.reduce((a, u) => a + UNITS[u.k].dmg, 0);
    if (dmg < 8 || secs > RULES.buildTime + 4) return false; // only worth a spell if the leak really hurts and a new tower can't be up in time
    const M = SPELLS.meteor, J = SPELLS.jet, big = past.some(u => UNITS[u.k].dmg >= 10);
    if ((past.length >= 4 || big) && D.scd.meteor <= this.t && D.gold >= M.cost) {
      let best = past[0], bs = 0; for (const u of past) { let s2 = 0; for (const o of past) if ((o.x - u.x) ** 2 + (o.y - u.y) ** 2 < 70 * 70) s2 += UNITS[o.k].dmg; if (s2 > bs) { bs = s2; best = u; } }
      const q = lane.at(Math.min(lane.total - 5, best.d + best.sp * M.fall * 0.8)); this.input(D.pid, { c: 'spell', k: 'meteor', x: q[0], y: q[1] }); return true; }
    if (front.d - cover < J.r * 0.75 && D.scd.jet <= this.t && D.gold >= J.cost) { const q = lane.at(Math.min(lane.total - 40, front.d + 90)); this.input(D.pid, { c: 'spell', k: 'jet', x: q[0], y: q[1] }); return true; }
    return false;
  }

  // ---- network snapshot (compact) ----
  snapshot(full) {
    const s = { t: Math.round(this.t * 100) / 100, pu: Math.round(this.pulseT * 10) / 10, wv: this.wave, hp: this.hp, cl: this.closed ? 1 : 0,
      a: [Math.floor(this.atk.gold), Math.round(this.atk.income * 100) / 100, this.atk.invest, this.investCost(), this.atk.queue.map(q => UNIT_IDS.indexOf(q[0]) * 10 + q[1]), this.atk.speed, this.speedCost(), Math.round(this.atk.hoard * 1000) / 1000],
      df: this.defs.map(d => [Math.floor(d.gold), Math.round(d.income * 10) / 10, d.kills, SPELL_IDS.map(k => Math.max(0, Math.round((d.scd[k] - this.t) * 10)))]),
      u: [], bm: this.beams || [], ev: this.events, over: this.over };
    for (const u of this.units) s.u.push(u.id, Math.round(u.d * 10) / 10, Math.round(u.hp / u.max * 100), (u.slowU > this.t ? 1 : 0) | (u.burn > 0 ? 2 : 0) | (u.wet > this.t ? 4 : 0) | (u.air > 0 ? 8 : 0));
    for (const u of this.units) if (u.mvT !== undefined && this.t - u.mvT < 0.4) (s.mv || (s.mv = [])).push(u.id, Math.round(u.off * 10) / 10, Math.round(u.v || 0));
    for (const u of this.units) if (u.run) (s.fr || (s.fr = [])).push(u.id, Math.round(u.x), Math.round(u.y));
    if (this.jets.length) s.jt = this.jets.map(j => [j.id, Math.round(j.aim * 100), j.fire]);
    if (full || this.sentTowerVer !== this.towerVer || this.towers.some(t => t.ready > this.t || t.off > this.t || this.refundable(t))) { s.tw = this.towers.map(t => [t.id, t.slot, TOWER_IDS.indexOf(t.k), t.c, t.r, PRIORITIES.indexOf(t.prio), t.kills, t.spent, Math.max(0, Math.round((t.ready - this.t) * 100)), Math.max(0, Math.round(((t.off || 0) - this.t) * 100)), this.refundable(t) ? Math.round((RULES.refundWindow - (this.t - t.placed)) * 100) : 0, t.lvl || 1]); s.tv = this.towerVer; this.sentTowerVer = this.towerVer; }
    if (full) { s.full = 1; s.units = this.units.map(u => [u.id, UNIT_IDS.indexOf(u.k), u.l, u.off, u.sp, Math.round(u.d)]); }
    if (full || this.over) s.stats = this.stats();
    this.events = [];
    return s;
  }
  stats() { return { hp: this.hp, atk: { sent: this.atk.sent, leaked: this.atk.leaked, dmg: this.atk.dmg, spent: this.atk.spent, invest: this.atk.invest, speed: this.atk.speed }, defs: this.defs.map(d => ({ kills: d.kills, built: d.built, dmg: Math.round(d.dmg), shared: Math.round(d.shared) })) }; }
}

const API = { COLORS, RACES, MAPS, LANE, CELL, FOOT, STAGE_H, MAX_DEF, TOWERS, TOWER_IDS, BUILD_IDS, LEVELS, PROMOTIONS, BIRD, promoCost, towerRange, towerDmg, towerDps, towerCone, towerVolley, towerCd, towerSplash, towerFly, hordeArmorOf, sendPhase, setLeakRate, UNITS, UNIT_IDS, SPELLS, SPELL_IDS, RULES, PRIORITIES, Sim, layout, footFree, mulberry32 };
if (typeof module !== 'undefined') module.exports = API; else G.TD = API;
})(typeof window !== 'undefined' ? window : globalThis);
