/* Break of Day — authoritative simulation (runs on host / solo). No DOM. */
(function (G) {
'use strict';
const VERSION = '0.1.0';
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const d2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
const SPD = 1 / 55;               // movespeed stat -> units/sec
const DAY = 240, NIGHT = 60, CYC = 300, ECLIPSE_T = 1500, DT = 0.05;
const MODES = {
  standard: { name: 'Standard', desc: '~25 min · 4:00 days, 1:00 nights', day: 240, night: 60, eclipse: 1500, scale: 1, xp: 1, gold: 1, struct: 1 },
  long: { name: 'Long War', desc: '~45 min · 6:30 days, 2:30 nights', day: 390, night: 150, eclipse: 2700, scale: 0.56, xp: 0.6, gold: 0.8, struct: 1.4 },
};

// ---------------- MAP ----------------
const LANE_L = [[0, 108], [-30, 100], [-60, 87], [-74, 58], [-75, 0], [-74, -58], [-60, -87], [-30, -100], [0, -108]];
const LANES = { L: LANE_L, M: [[0, 108], [0, 54], [0, 0], [0, -54], [0, -108]], R: LANE_L.map(p => [-p[0], p[1]]) };
const LANE_INFO = {
  L: { name: 'Blightwood', theme: 'Undead', desc: 'Scourge-blighted forest held by ghouls and acolytes. Cheapest town upkeep. A Secret Shop hides behind the Ancient Treant.' },
  M: { name: 'Warpath', theme: 'Orc', desc: 'Orc grunts and troll headhunters hold the green road. Shortest path to the Core, but enemy waves are one warrior heavier.' },
  R: { name: 'Tidemarsh', theme: 'Naga', desc: 'Flooded stone causeway of the naga. Goldmire town has a gold mine (+3 gold/s each while held). Highest upkeep.' },
};
const MAP = {
  W: 112, H: 126,
  fountain: { x: 0, z: 111, r: 12 },
  cores: [{ team: 0, x: 0, z: 117 }, { team: 1, x: 0, z: -117 }],
  towers: [
    { team: 0, lane: 'L', x: -50, z: 91.5 }, { team: 0, lane: 'M', x: 0, z: 90 }, { team: 0, lane: 'R', x: 50, z: 91.5 },
    { team: 1, lane: 'L', x: -50, z: -91.5 }, { team: 1, lane: 'M', x: 0, z: -90 }, { team: 1, lane: 'R', x: 50, z: -91.5 }],
  towns: [
    { id: 'hollowmere', name: 'Hollowmere', lane: 'L', x: -74.3, z: 42, upkeep: 50, tier: 1 },
    { id: 'thornfield', name: 'Thornfield', lane: 'L', x: -74.6, z: -32, upkeep: 70, tier: 2 },
    { id: 'crossroads', name: 'Crossroads', lane: 'M', x: 0, z: 40, upkeep: 70, tier: 1 },
    { id: 'highgate', name: 'Highgate', lane: 'M', x: 0, z: -32, upkeep: 90, tier: 2 },
    { id: 'goldmire', name: 'Goldmire', lane: 'R', x: 74.3, z: 42, upkeep: 110, tier: 1, mine: true },
    { id: 'ashport', name: 'Ashport', lane: 'R', x: 74.6, z: -32, upkeep: 80, tier: 2 }],
  bosses: [
    { id: 'treant', name: 'Ancient Treant', lane: 'L', x: -93, z: 10, tier: 1, hp: 4200, ad: 85, armor: 30, mr: 30, as: 0.7, range: 3.5, r: 2.6, skills: ['slam', 'summon'] },
    { id: 'ogre', name: 'Ogre Warlord', lane: 'M', x: 17, z: 6, tier: 1, hp: 4000, ad: 105, armor: 35, mr: 20, as: 0.8, range: 3.2, r: 2.4, skills: ['slam', 'charge'] },
    { id: 'hydra', name: 'Mire Hydra', lane: 'R', x: 93, z: 10, tier: 1, hp: 3800, ad: 70, armor: 20, mr: 40, as: 1.0, range: 8, r: 2.6, skills: ['nova', 'slam'] },
    { id: 'bogwitch', name: 'Bog Witch', lane: 'L', x: -93, z: -64, tier: 2, hp: 6800, ad: 95, armor: 30, mr: 55, as: 0.9, range: 8, r: 2.2, skills: ['nova', 'summon', 'slam'], warden: 'L' },
    { id: 'golem', name: 'Iron Golem', lane: 'M', x: 18, z: -62, tier: 2, hp: 8200, ad: 130, armor: 65, mr: 25, as: 0.6, range: 3.5, r: 2.8, skills: ['slam', 'charge'], warden: 'M' },
    { id: 'dread', name: 'Dread Knight', lane: 'R', x: 93, z: -64, tier: 2, hp: 7200, ad: 140, armor: 45, mr: 40, as: 0.85, range: 3.2, r: 2.3, skills: ['charge', 'nova', 'slam'], warden: 'R' }],
  secretShop: { x: -101, z: 18 },
  shop: { x: -11, z: 102 },
  forge: { x: -104, z: -104 },
  camps: [
    { x: -38, z: 72, t: 'wolves' }, { x: 38, z: 72, t: 'wolves' },
    { x: -40, z: 28, t: 'trolls' }, { x: 40, z: 28, t: 'trolls' },
    { x: -42, z: -12, t: 'trolls' }, { x: 42, z: -12, t: 'trolls' },
    { x: -38, z: -52, t: 'ogres' }, { x: 38, z: -52, t: 'ogres' },
    { x: -22, z: -80, t: 'ogres' }, { x: 22, z: -80, t: 'ogres' }],
  encSpots: [[-22, 62], [22, 62], [-52, 8], [52, 8], [-28, -30], [28, -30], [-100, 62], [100, 62], [-100, -34], [100, -34], [-20, 22], [20, 22]],
};
// ---- world scale (bigger map) ----
const SX = 1.45, SZ = 1.75;
for (const k in LANES) LANES[k] = LANES[k].map(p => [p[0] * SX, p[1] * SZ]);
(() => {
  const pt = o => { o.x *= SX; o.z *= SZ; };
  MAP.W = Math.round(MAP.W * SX); MAP.H = Math.round(MAP.H * SZ); pt(MAP.fountain); MAP.fountain.r = 14;
  MAP.cores.forEach(pt); MAP.shop = { x: MAP.fountain.x - 11, z: MAP.fountain.z - 9 }; MAP.towers.forEach(pt); MAP.towns.forEach(pt); MAP.bosses.forEach(pt); pt(MAP.secretShop); pt(MAP.forge); MAP.camps.forEach(pt);
  MAP.encSpots = MAP.encSpots.map(p => [p[0] * SX, p[1] * SZ]);
})();
// ---- winding lanes: densify each lane and bend it; every lane has its own shape ----
const LANE_BEND = {
  L: z => 13 * Math.sin(z / 28) + 4 * Math.sin(z / 9 + 1),                                  // Blightwood: long S-curves
  M: z => { const p = (z / 46 + 0.25) % 1, tri = 4 * Math.abs((p < 0 ? p + 1 : p) - 0.5) - 1; return 11 * tri + 2.5 * Math.sin(z / 6); }, // Warpath: switchbacks
  R: z => 9 * Math.sin(z / 17 + 2) + 6 * Math.sin(z / 41),                                  // Tidemarsh: meandering causeway
};
const bendW = z => Math.max(0, Math.min(1, (165 - Math.abs(z)) / 40));
const laneShift = (k, z) => LANE_BEND[k](z) * bendW(z);
for (const k in LANES) {
  const P = LANES[k], out = [];
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3)); for (let j = 0; j < n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
  out.push(P[P.length - 1].slice());
  LANES[k] = out.map(p => [clamp(p[0] + laneShift(k, p[1]), -MAP.W + 14, MAP.W - 14), p[1]]);
}
function laneX(k, z) { const P = LANES[k]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if ((a[1] - z) * (b[1] - z) <= 0 && a[1] !== b[1]) return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]); } return P[0][0]; }
MAP.towns.forEach(t => { t.x = laneX(t.lane, t.z); });
MAP.towers.forEach(t => { t.x = laneX(t.lane, t.z); });
MAP.bosses.forEach(b => { b.x += laneShift(b.lane, b.z); });
MAP.secretShop.x += laneShift('L', MAP.secretShop.z);
const RIVER = x => 4 + 6 * Math.sin(x / SX / 19) + 2 * Math.sin(x / SX / 7);
function laneDistK(k, x, z) {
  const P = LANES[k]; let best = 1e9;
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1];
    if ((ax - x) * (ax - x) + (az - z) * (az - z) > best + 64 && (bx - x) * (bx - x) + (bz - z) * (bz - z) > best + 64) continue;
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1);
    const dd = d2(x, z, ax + vx * t, az + vz * t); if (dd < best) best = dd;
  }
  return Math.sqrt(best);
}
// Region theme of any point = nearest lane (L undead, M orc, R naga)
function laneOf(x, z) { const a = laneDistK('L', x, z), b = laneDistK('M', x, z), c = laneDistK('R', x, z); return a <= b && a <= c ? 'L' : c <= b ? 'R' : 'M'; }
function laneDist(x, z) {
  return Math.min(laneDistK('L', x, z), laneDistK('M', x, z), laneDistK('R', x, z));
}
const TOWN_BUFFS = {
  hollowmere: { n: 'Stone Walls', d: 'Armor & Magic Resist', s: [{ armor: 8, mr: 8 }, { armor: 16, mr: 16 }, { armor: 26, mr: 26 }] },
  thornfield: { n: 'Smithy', d: 'Attack Damage', s: [{ ad: 8 }, { ad: 17 }, { ad: 28 }] },
  crossroads: { n: 'Stables', d: 'Movespeed', s: [{ ms: 15 }, { ms: 30 }, { ms: 48 }] },
  highgate: { n: 'Mage Tower', d: 'Ability Power', s: [{ ap: 15 }, { ap: 32 }, { ap: 52 }] },
  goldmire: { n: 'Granary', d: 'Max HP', s: [{ hp: 100 }, { hp: 220 }, { hp: 360 }] },
  ashport: { n: 'Armory', d: 'Crit Chance & Attack Speed', s: [{ crit: 0.05, as: 0.08 }, { crit: 0.10, as: 0.16 }, { crit: 0.15, as: 0.25 }] },
};
const TIER_DRAIN = 1.2; // gold per second, per tier, per player
const inLane = (x, z) => laneDist(x, z) < 13 && z > -98 * SZ && z < 98 * SZ;

// ---------------- ITEMS ----------------
const ITEMS = {
  sword: { n: 'Iron Sword', c: 300, s: { ad: 12 }, tier: 1 },
  rod: { n: 'Apprentice Rod', c: 300, s: { ap: 20 }, tier: 1 },
  boots: { n: 'Leather Boots', c: 300, s: { ms: 25 }, tier: 1 },
  pendant: { n: 'Ruby Pendant', c: 350, s: { hp: 180 }, tier: 1 },
  vest: { n: 'Chain Vest', c: 350, s: { armor: 18 }, tier: 1 },
  cloak: { n: 'Null Cloak', c: 350, s: { mr: 18 }, tier: 1 },
  charm: { n: 'Lucky Charm', c: 450, s: { crit: 0.10 }, tier: 1 },
  dagger: { n: 'Quick Dagger', c: 450, s: { as: 0.18 }, tier: 1 },
  fang: { n: 'Vampire Fang', c: 550, s: { ad: 8, ls: 0.08 }, tier: 1 },
  chalice: { n: 'Soul Chalice', c: 600, s: { ap: 20, sv: 0.08 }, tier: 1 },
  crystal: { n: 'Mana Crystal', c: 400, s: { res: 250, resr: 2 }, tier: 1 },
  warlord: { n: "Warlord's Edge", c: 2100, s: { ad: 45, crit: 0.2 }, tier: 2 },
  archstaff: { n: 'Archmage Staff', c: 2200, s: { ap: 90, res: 300 }, tier: 2 },
  titan: { n: 'Titan Plate', c: 2100, s: { hp: 500, armor: 40 }, tier: 2 },
  ward: { n: 'Ward of Ages', c: 2100, s: { hp: 400, mr: 45 }, tier: 2 },
  thirster: { n: 'Bloodthirster', c: 2500, s: { ad: 55, ls: 0.18 }, tier: 2 },
  walkers: { n: 'Windwalkers', c: 1100, s: { ms: 55, as: 0.15 }, tier: 2 },
  deadeye: { n: 'Deadeye Bow', c: 2400, s: { ad: 35, crit: 0.3, as: 0.2 }, tier: 2 },
  siphon: { n: 'Siphon Orb', c: 2300, s: { ap: 70, sv: 0.18, hp: 200 }, tier: 2 },
  dawnblade: { n: 'Daybreak Blade', c: 4000, s: { ad: 85, crit: 0.25, ls: 0.12 }, tier: 3, secret: true },
  sunfire: { n: 'Sunfire Aegis', c: 3800, s: { hp: 800, armor: 50, mr: 50 }, tier: 3, secret: true },
  codex: { n: 'Astral Codex', c: 4000, s: { ap: 170, sv: 0.2, res: 400 }, tier: 3, secret: true },
  zephyr: { n: 'Zephyr Treads', c: 3000, s: { ms: 90, as: 0.35, crit: 0.15 }, tier: 3, secret: true },
};
const VAULT = {
  halberd: { n: 'Kingsguard Halberd', c: 3200, s: { ad: 70, hp: 300, armor: 20 } },
  starcaller: { n: 'Starcaller Rod', c: 3400, s: { ap: 140, res: 300 } },
  phantom: { n: 'Phantom Cloak', c: 2800, s: { ms: 60, mr: 50, crit: 0.1 } },
  bloodstone: { n: 'Bloodstone Ring', c: 3000, s: { ls: 0.15, sv: 0.15, hp: 300 } },
  titanforge: { n: 'Titanforge Bulwark', c: 3300, s: { hp: 1000, armor: 40 } },
  stormstrike: { n: 'Stormstrike Blade', c: 3500, s: { ad: 60, as: 0.4, crit: 0.2 } },
  archon: { n: "Archon's Mantle", c: 3600, s: { ap: 100, mr: 60, hp: 400 } },
  huntertal: { n: "Hunter's Talisman", c: 3100, s: { crit: 0.3, ad: 40, ms: 30 } },
  runeplate: { n: 'Runeplate Cuirass', c: 3300, s: { armor: 55, mr: 55, ap: 40 } },
  quickfang: { n: 'Quickfang Daggers', c: 2900, s: { as: 0.5, ls: 0.1, ad: 25 } },
};
const CARD_CHANCE = { creep: 0.006, minion: 0.002, stalker: 0.02 };
const BASE_UPG = {
  railL: { n: "Blightwood Rail", cat: 'rail', lane: 'L', d: 'Rail segments: Base → 1st town → 2nd town → Forward Camp. Each segment needs its end town held (Forward Camp: Warden slain).', c: [800, 1200, 1600] },
  railM: { n: "Warpath Rail", cat: 'rail', lane: 'M', d: 'Rail segments: Base → 1st town → 2nd town → Forward Camp. Each segment needs its end town held (Forward Camp: Warden slain).', c: [800, 1200, 1600] },
  railR: { n: "Tidemarsh Rail", cat: 'rail', lane: 'R', d: 'Rail segments: Base → 1st town → 2nd town → Forward Camp. Each segment needs its end town held (Forward Camp: Warden slain).', c: [800, 1200, 1600] },
  sight: { n: 'Watchtowers', cat: 'jungle', d: 'Each level raises 2 watch posts deeper into the jungle and gives heroes +10% sight.', c: [700, 1400, 2100] },
  heal: { n: 'Jungle Healing Packs', cat: 'jungle', d: 'Four healing packs appear in the jungle. Touch one to restore 35% HP and resource (45s recharge).', c: [1000] },
  merc: { n: 'Mercenary Guild', cat: 'jungle', d: 'Hire mercenaries at base (250g, max 2 per hero). They follow you through the jungle but never enter lanes.', c: [1200] },
  walls: { n: 'Fortifications', cat: 'base', d: 'Walls and base turrets gain +40% HP and +15 Armor per level, and are fully repaired.', c: [800, 1600, 2400] },
  drums: { n: 'War Drums', cat: 'base', d: 'Allied lane minions gain +20% HP and damage per level.', c: [1000, 2000] },
  treasury: { n: 'Royal Treasury', cat: 'base', d: '+1 gold per second for every hero, per level.', c: [900, 1800] },
};
const sc = p => [p[0] * SX, p[1] * SZ, p[2]];
const WARD_SPOTS = [[[-30, 80], [30, 80]], [[-48, 20], [48, 20]], [[-35, -45], [35, -45]]].map(l => l.map(sc));
const HEAL_SPOTS = [[-52, 46], [52, 46], [-25, -5], [25, -5]].map(sc);
const WALLS = [[-25, 112, Math.PI / 2], [25, 112, Math.PI / 2], [-17, 95, -0.7], [17, 95, 0.7]].map(sc);
const TURRETS = [[-11, 101], [11, 101]].map(sc);
const RAID_PTS = [[-60, 70, 'west'], [60, 70, 'east'], [-45, 30, 'western jungle'], [45, 30, 'eastern jungle'], [-100, 95, 'far west'], [100, 95, 'far east']].map(sc);
// ---------------- TERRAIN: impassable forest, ruins, rocks (deterministic, shared with client) ----------------
const TER = (() => {
  const cs = 2, ox = -MAP.W, oz = -MAP.H, cols = Math.ceil(2 * MAP.W / cs), rows = Math.ceil(2 * MAP.H / cs);
  const blk = new Uint8Array(cols * rows), clear = new Uint8Array(cols * rows), R = mulberry32(424242);
  const ci = (x, z) => { const c = Math.floor((x - ox) / cs), r = Math.floor((z - oz) / cs); return (c < 0 || r < 0 || c >= cols || r >= rows) ? -1 : r * cols + c; };
  const cx = c => ox + (c + 0.5) * cs, cz = r => oz + (r + 0.5) * cs;
  const hash = (i, j) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz); const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w; };
  const noise = (x, z) => vn(x / 22, z / 22) * 0.6 + vn(x / 8, z / 8) * 0.3 + vn(x / 3, z / 3) * 0.1;
  const clearDisc = (x, z, r) => { for (let zz = z - r; zz <= z + r + 0.01; zz += cs) for (let xx = x - r; xx <= x + r + 0.01; xx += cs) if ((xx - x) ** 2 + (zz - z) ** 2 <= r * r) { const i = ci(xx, zz); if (i >= 0) clear[i] = 1; } };
  const clearLine = (x1, z1, x2, z2, w, wig) => { const L = Math.hypot(x2 - x1, z2 - z1) || 1, n = Math.ceil(L / 1.5), nx = -(z2 - z1) / L, nz = (x2 - x1) / L, ph = R() * 6; for (let s = 0; s <= n; s++) { const t = s / n, off = wig ? Math.sin(t * Math.PI * 2 + ph) * wig * Math.sin(t * Math.PI) : 0; clearDisc(x1 + (x2 - x1) * t + nx * off, z1 + (z2 - z1) * t + nz * off, w); } };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = cx(c), z = cz(r); if (laneDist(x, z) < 10.5 || Math.abs(z - RIVER(x)) < 4.5) clear[r * cols + c] = 1; }
  const pois = [], add = (x, z, r) => { clearDisc(x, z, r); pois.push([x, z]); };
  MAP.towns.forEach(t => clearDisc(t.x, t.z, 17)); MAP.bosses.forEach(b => add(b.x, b.z, 15)); MAP.camps.forEach(c => add(c.x, c.z, 10.5));
  MAP.encSpots.forEach(p => add(p[0], p[1], 7)); HEAL_SPOTS.forEach(p => add(p[0], p[1], 6)); WARD_SPOTS.forEach(l => l.forEach(p => add(p[0], p[1], 6)));
  add(MAP.forge.x, MAP.forge.z, 10); add(MAP.secretShop.x, MAP.secretShop.z, 11); RAID_PTS.forEach(p => add(p[0], p[1], 9));
  clearDisc(0, MAP.fountain.z + 6, 50); clearDisc(0, -MAP.fountain.z - 6, 50);
  const lanePts = []; for (const k in LANES) { const P = LANES[k]; for (let i = 0; i < P.length - 1; i++) for (let t = 0; t < 1; t += 0.08) lanePts.push([P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]); }
  for (const p of pois) {
    let best = null, bd = 1e9; for (const q of lanePts) { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; best = q; } }
    clearLine(p[0], p[1], best[0], best[1], 3.4, 6);
    pois.filter(q => q !== p).sort((a, b) => ((a[0] - p[0]) ** 2 + (a[1] - p[1]) ** 2) - ((b[0] - p[0]) ** 2 + (b[1] - p[1]) ** 2)).slice(0, 2).forEach(q => { if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 95) clearLine(p[0], p[1], q[0], q[1], 2.8, 9); });
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, x = cx(c), z = cz(r);
    if (Math.abs(x) > MAP.W - 7 || Math.abs(z) > MAP.H - 7) { blk[i] = 1; continue; }
    if (clear[i]) continue;
    if (noise(x + 500, z + 500) > 0.415) blk[i] = 1;
  }
  const ruins = [], rocks = []; let tries = 0;
  while (ruins.length < 30 && tries++ < 5000) {
    const x = (R() * 2 - 1) * (MAP.W - 20), z = (R() * 2 - 1) * (MAP.H - 20); if (laneDist(x, z) < 16) continue;
    const i0 = ci(x, z); if (i0 < 0 || clear[i0] || blk[i0]) continue;
    const a = R() * Math.PI, L = 9 + R() * 14, x2 = x + Math.cos(a) * L, z2 = z + Math.sin(a) * L, n = Math.ceil(L / 1.4);
    let ok = true; for (let s2 = 0; s2 <= n; s2++) { const j = ci(x + (x2 - x) * s2 / n, z + (z2 - z) * s2 / n); if (j < 0 || clear[j]) { ok = false; break; } } if (!ok) continue;
    const pts = []; for (let s2 = 0; s2 <= n; s2++) { if (s2 > 0 && s2 < n && R() < 0.14) continue; const px = x + (x2 - x) * s2 / n, pz = z + (z2 - z) * s2 / n; blk[ci(px, pz)] = 2; pts.push([px, pz, 0.6 + R() * 0.6]); }
    ruins.push({ a, pts });
  }
  tries = 0; while (rocks.length < 140 && tries++ < 4000) { const x = (R() * 2 - 1) * (MAP.W - 10), z = (R() * 2 - 1) * (MAP.H - 10), i = ci(x, z); if (i < 0 || clear[i] || blk[i]) continue; blk[i] = 3; rocks.push([x, z, 1 + R() * 1.2]); }
  const trees = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c; if (blk[i] !== 1) continue;
    const inner = c > 0 && r > 0 && c < cols - 1 && r < rows - 1 && blk[i - 1] && blk[i + 1] && blk[i - cols] && blk[i + cols];
    const p = inner ? 0.32 : 0.8; if (R() > p) continue;
    trees.push([cx(c) + (R() - 0.5) * 1.4, cz(r) + (R() - 0.5) * 1.4, inner ? 1.15 + R() * 0.5 : 0.8 + R() * 0.45, R() < 0.6 ? 0 : 1, R()]);
  }
  return { cs, ox, oz, cols, rows, blk, ci, trees, ruins, rocks };
})();
const blocked = (x, z) => { const i = TER.ci(x, z); return i < 0 || TER.blk[i] > 0; };
// ---------- bases (Heroes of the Storm style): a ring wall around each base, one gate per lane flanked by two towers ----------
const GATE_HALF = 3.6;
const BASES = (() => {
  const R = 44, out = [];
  for (const team of [0, 1]) {
    const cz = (team ? -1 : 1) * (MAP.fountain.z + 6), cx = 0, gates = [];
    for (const k of ['L', 'M', 'R']) {
      const P = team ? LANES[k].slice().reverse() : LANES[k]; let g = null;
      for (let i = 1; i < P.length && !g; i++) { const a = P[i - 1], b = P[i], da = Math.hypot(a[0] - cx, a[1] - cz), db = Math.hypot(b[0] - cx, b[1] - cz); if (da < R && db >= R) { const t = (R - da) / (db - da); g = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; } }
      gates.push({ lane: k, x: g[0], z: g[1], ang: Math.atan2(g[1] - cz, g[0] - cx), cells: [] });
    }
    out.push({ team, x: cx, z: cz, R, gates });
  }
  return out;
})();
// dynamic blocking layer: 1 = wall (blocks everyone), 2 = our gate (blocks all but team 0), 3 = enemy gate (blocks all but team 1)
const DYN = new Uint8Array(TER.cols * TER.rows);
(() => {
  for (let r = 0; r < TER.rows; r++) for (let c = 0; c < TER.cols; c++) {
    const x = TER.ox + (c + 0.5) * TER.cs, z = TER.oz + (r + 0.5) * TER.cs, i = r * TER.cols + c;
    for (const b of BASES) {
      const d = Math.hypot(x - b.x, z - b.z); if (Math.abs(d - b.R) > 1.6) continue;
      const th = Math.atan2(z - b.z, x - b.x); let gate = null;
      for (const g of b.gates) { let da = Math.abs(th - g.ang); if (da > Math.PI) da = 2 * Math.PI - da; if (da * b.R < GATE_HALF) gate = g; }
      if (gate) { DYN[i] = 2 + b.team; gate.cells.push(i); } else DYN[i] = 1;
    }
  }
})();
const dynBlocked = (team, x, z) => { const i = TER.ci(x, z); if (i < 0) return true; const d = DYN[i]; return d === 1 || (d === 2 && team !== 0) || (d === 3 && team !== 1); };
const blockedT = (team, x, z) => blocked(x, z) || dynBlocked(team, x, z);
function losT(team, x1, z1, x2, z2) { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(L / 1.2); for (let s = 1; s < n; s++) if (blockedT(team, x1 + (x2 - x1) * s / n, z1 + (z2 - z1) * s / n)) return false; return true; }
function los(x1, z1, x2, z2) { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(L / 1.2); for (let s = 1; s < n; s++) if (blocked(x1 + (x2 - x1) * s / n, z1 + (z2 - z1) * s / n)) return false; return true; }
function nearestFree(x, z) { if (!blocked(x, z)) return [x, z]; for (let r = 2; r < 24; r += 1.5) for (let a = 0; a < 6.283; a += 0.4) { const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r; if (!blocked(nx, nz)) return [nx, nz]; } return [x, z]; }
const NAV = (() => {
  const { cols, rows, cs, ox, oz, blk } = TER, N = cols * rows;
  const g = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N); let gen = 0;
  const hi = new Int32Array(N), hf = new Float32Array(N); let hs = 0;
  const push = (i, f) => { let k = hs++; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; hi[k] = hi[p]; hf[k] = hf[p]; k = p; } hi[k] = i; hf[k] = f; };
  const pop = () => { const top = hi[0], li = hi[--hs], lf = hf[hs]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hs) break; if (c + 1 < hs && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; hi[k] = hi[c]; hf[k] = hf[c]; k = c; } hi[k] = li; hf[k] = lf; return top; };
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1], DC = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
  return function astar(x1, z1, x2, z2, team) {
    const isB = j => { if (blk[j]) return true; const d = DYN[j]; return d === 1 || (d === 2 && team !== 0) || (d === 3 && team !== 1); };
    [x1, z1] = nearestFree(x1, z1); [x2, z2] = nearestFree(x2, z2);
    const s = TER.ci(x1, z1), t = TER.ci(x2, z2); if (s < 0 || t < 0) return null; if (s === t) return [[x2, z2]];
    gen++; hs = 0; const tc = t % cols, tr = (t / cols) | 0;
    const h = i => { const dx = Math.abs(i % cols - tc), dz = Math.abs(((i / cols) | 0) - tr); return (dx + dz - 0.586 * Math.min(dx, dz)); };
    g[s] = 0; seen[s] = gen; from[s] = -1; push(s, h(s)); let n = 0, found = false;
    while (hs > 0 && n++ < 30000) {
      const i = pop(); if (shut[i] === gen) continue; shut[i] = gen; if (i === t) { found = true; break; }
      const c = i % cols, r = (i / cols) | 0;
      for (let d = 0; d < 8; d++) {
        const nc = c + DX[d], nr = r + DZ[d]; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue; const j = nr * cols + nc; if (isB(j) || shut[j] === gen) continue;
        if (d >= 4 && (isB(r * cols + nc) || isB(nr * cols + c))) continue;
        const ng = g[i] + DC[d]; if (seen[j] === gen && ng >= g[j]) continue; seen[j] = gen; g[j] = ng; from[j] = i; push(j, ng + h(j));
      }
    }
    if (!found) return null;
    const cells = []; for (let i = t; i !== -1; i = from[i]) cells.push(i); cells.reverse();
    const pts = cells.map(i => [ox + (i % cols + 0.5) * cs, oz + (((i / cols) | 0) + 0.5) * cs]); pts[pts.length - 1] = [x2, z2];
    const out = []; let cur = [x1, z1], k = 0;
    while (k < pts.length - 1) { let far = k + 1; for (let m = pts.length - 1; m > k + 1; m--) if (losT(team, cur[0], cur[1], pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); cur = pts[far]; k = far; }
    if (!out.length) out.push([x2, z2]);
    return out;
  };
})();
const MERC_COST = 250;
const POTION_COST = 50, POTION_MAX = 5;
const STAT_NAMES = { hp: 'HP', ad: 'Attack Damage', ap: 'Ability Power', ms: 'Movespeed', ls: 'Lifesteal', sv: 'Spell Vamp', crit: 'Crit Chance', mr: 'Magic Resist', armor: 'Armor', as: 'Attack Speed', res: 'Max Resource', resr: 'Resource Regen' };
const PCT = { ls: 1, sv: 1, crit: 1, as: 1 };

// ---------------- LOOT ----------------
// 0 Poor(gray) 1 Common(white) 2 Uncommon(green) 3 Rare(blue) 4 Epic(purple) — procedural
// 5 Legendary(gold) — named: bosses, events, the hidden forge.  6 Mythic(red) — named, hidden methods only.
const RARITY = [
  { n: 'Poor', col: '#9d9d9d', aff: 0, m: 0.55 }, { n: 'Common', col: '#f2f2f2', aff: 1, m: 0.8 }, { n: 'Uncommon', col: '#2ee84a', aff: 2, m: 1 },
  { n: 'Rare', col: '#3a8dff', aff: 2, m: 1.25 }, { n: 'Epic', col: '#b05bff', aff: 3, m: 1.5 }, { n: 'Legendary', col: '#ffc62a', m: 1 }, { n: 'Mythic', col: '#ff3434', m: 1 }];
const LOOT_BASES = [['Blade', 'ad'], ['Staff', 'ap'], ['Plate', 'armor'], ['Mantle', 'mr'], ['Heart', 'hp'], ['Boots', 'ms'], ['Charm', 'crit'], ['Fang', 'ls'], ['Grimoire', 'sv'], ['Gauntlets', 'as']];
const POOR_PREFIX = ['Rusty', 'Cracked', 'Tattered', 'Bent', 'Moldy', 'Chipped'];
const AFFIX = { // prefix, suffix, min, max (at lvl 1), gold value per point
  ad: ['Savage', 'of Might', 4, 8, 22], ap: ['Arcane', 'of Sorcery', 7, 13, 13], armor: ['Ironbound', 'of the Bulwark', 4, 9, 18],
  mr: ['Warded', 'of Warding', 4, 9, 18], hp: ['Hearty', 'of Vigor', 45, 90, 1.8], ms: ['Swift', 'of Haste', 6, 12, 12],
  crit: ['Keen', 'of Precision', 0.02, 0.04, 3500], ls: ['Vampiric', 'of the Leech', 0.02, 0.04, 4500], sv: ['Soulbound', 'of Siphoning', 0.02, 0.04, 3500],
  as: ['Frenzied', 'of Fury', 0.04, 0.08, 2200]};
// rarity weights by level band [gray, white, green, blue, purple]
const RAR_BANDS = [[1, [55, 40, 5, 0, 0]], [6, [5, 30, 55, 10, 0]], [11, [0, 5, 35, 50, 10]], [16, [0, 0, 10, 50, 40]]];
function rarForLevel(R, lvl, bump) {
  let w = RAR_BANDS[0][1]; for (const b of RAR_BANDS) if (lvl >= b[0]) w = b[1];
  let roll = R() * w.reduce((x, y) => x + y, 0), ri = 0; while (ri < 4 && roll > w[ri]) { roll -= w[ri]; ri++; }
  return Math.min(4, ri + (bump || 0));
}
function makeProc(R, rar, lvl) {
  const rd = RARITY[rar], power = (1 + (lvl - 1) * 0.11) * rd.m;
  const base = LOOT_BASES[Math.floor(R() * LOOT_BASES.length)];
  const s = {}; let value = 0;
  const add = (k, mult) => { const a = AFFIX[k]; let v = (a[2] + (a[3] - a[2]) * R()) * (a[2] < 1 ? 1 + (power - 1) * 0.45 : power) * mult; v = a[2] < 1 ? Math.round(v * 1000) / 1000 : Math.max(1, Math.round(v)); s[k] = (s[k] || 0) + v; value += v * a[4]; };
  add(base[1], 1.5);
  const pool = Object.keys(AFFIX).filter(k => k !== base[1]), aff = [];
  const nAff = rd.aff + (rar === 3 && R() < 0.4 ? 1 : 0) + (rar === 4 && R() < 0.4 ? 1 : 0);
  for (let i = 0; i < nAff; i++) { const k = pool.splice(Math.floor(R() * pool.length), 1)[0]; aff.push(k); add(k, 0.8); }
  let name;
  if (rar === 0) name = POOR_PREFIX[Math.floor(R() * POOR_PREFIX.length)] + ' ' + base[0];
  else name = (aff[0] && rar >= 2 ? AFFIX[aff[0]][0] + ' ' : '') + base[0] + (aff[rar >= 2 ? 1 : 0] ? ' ' + AFFIX[aff[rar >= 2 ? 1 : 0]][1] : '');
  return { n: name, s, rar, c: Math.max(5, Math.round(value)), lv: lvl };
}
function rollLoot(R, lvl, bump) { return makeProc(R, rarForLevel(R, lvl, bump), lvl); }
const LEGENDARIES = {
  sunforged: { n: 'Sunforged Greatsword', s: { ad: 70, crit: 0.2, hp: 300 }, lore: 'Quenched in the first light of dawn.' },
  moonveil: { n: 'Moonveil Cowl', s: { ap: 110, mr: 40, sv: 0.1 } },
  wardenplate: { n: 'Wardenplate of Highgate', s: { hp: 900, armor: 60 } },
  thornwood: { n: 'Thornwood Longbow', s: { ad: 55, as: 0.35, crit: 0.25 } },
  hydraheart: { n: 'Heart of the Hydra', s: { hp: 600, ls: 0.12, sv: 0.12 } },
  ogresruin: { n: "Ogre's Ruin", s: { ad: 80, hp: 400, armor: 20 } },
  witchbane: { n: 'Witchbane Talisman', s: { mr: 70, ap: 80, hp: 250 } },
  treantbark: { n: "Treant's Living Bark", s: { armor: 50, mr: 50, hp: 500 } },
  dreadedge: { n: 'Dread Edge', s: { ad: 65, ls: 0.2, ms: 30 } },
  duskwalkers: { n: 'Duskwalkers', s: { ms: 80, as: 0.3, crit: 0.12 } },
  emberheart: { n: 'Emberheart Codex', s: { ap: 130, sv: 0.15 } },
  goldmirecrown: { n: 'Crown of Goldmire', s: { hp: 400, ap: 60, ad: 30, armor: 25, mr: 25 } },
};
const BOSS_LEGEND = { treant: ['treantbark', 'thornwood'], ogre: ['ogresruin', 'sunforged'], hydra: ['hydraheart', 'emberheart'], bogwitch: ['moonveil', 'witchbane'], golem: ['wardenplate', 'goldmirecrown'], dread: ['dreadedge', 'duskwalkers'] };
const MYTHICS = {
  dawnbringer: { n: 'Dawnbringer', s: { ad: 120, ap: 120, crit: 0.3, ls: 0.15, sv: 0.15 }, lore: 'The blade that ended the first night.' },
  eclipsecrown: { n: 'Crown of the Eclipse', s: { ap: 230, sv: 0.25, mr: 60, hp: 500 } },
  firstlight: { n: 'Aegis of the First Light', s: { hp: 1500, armor: 90, mr: 90 } },
  nightreaver: { n: 'Nightreaver', s: { ad: 150, crit: 0.4, as: 0.4, ls: 0.2 } },
};
function named(table, key, rar) { const d = table[key]; let v = 0; for (const k in d.s) v += d.s[k] * AFFIX[k][4]; return { n: d.n, s: Object.assign({}, d.s), rar, c: Math.round(v), key, lore: d.lore }; }
function rollLegendary(R, pool) { const keys = pool && pool.length && R() < 0.7 ? pool : Object.keys(LEGENDARIES); return named(LEGENDARIES, keys[Math.floor(R() * keys.length)], 5); }
function rollMythic(R) { const keys = Object.keys(MYTHICS); return named(MYTHICS, keys[Math.floor(R() * keys.length)], 6); }
function projStyle(e) {
  if (e.kind === 'hero') return { thornshot: 'a', emberwitch: 'f', lumen: 'h' }[e.hid] || 'o';
  if (e.structure) return 'b';
  const v = e.v, th = v.split('_')[2];
  if (v.startsWith('me_ranged')) return { L: 'g', M: 'S', R: 'w' }[th] || 'o';
  if (v.startsWith('me_siege')) return { L: 'm', M: 'r', R: 'w' }[th] || 'r';
  if (v.startsWith('c_archer')) return th === 'R' ? 'S' : 'a';
  if (v.startsWith('c_trollshaman')) return { L: 'g', M: 'g', R: 'w' }[th] || 'g';
  return { b_hydra: 'w', b_bogwitch: 'p', ma_ranged: 'o', ma_siege: 'r' }[v] || 'o';
}
const DROP_CHANCE = { minion: 0.05, creep: 0.12, stalker: 0.3, raider: 0.15, guard: 0.14 };

// ---------------- HEROES ----------------
const v = (x, r) => Array.isArray(x) ? x[r - 1] : x;
const HEROES = {
  ironvow: {
    name: 'Ironvow', title: 'The Oathbound Knight', role: 'Tank', col: '#9fb4d0',
    res: { type: 'Resolve', max: 100, regen: 3, perLvl: 0, hurtGain: 3 },
    base: { hp: 740, ad: 52, ap: 0, ms: 325, ls: 0, sv: 0, crit: 0, mr: 32, armor: 34, as: 0.75, range: 2.6, hpr: 3 },
    grow: { hp: 98, ad: 3.2, armor: 3.4, mr: 2.1, as: 0.015, hpr: 0.35 },
    ab: [
      { n: 'Shield Bash', t: 'unit', range: 4.5, cd: [9, 8.5, 8, 7.5, 7], cost: 25, d: 'Bash an enemy for 60/95/130/165/200 (+100% AD) physical damage and stun it for 1-1.4s.',
        cast(S, h, r, x, z, tg) { S.damage(h, tg, [60, 95, 130, 165, 200][r - 1] + h.ad, 'phys', { spell: 1 }); S.stun(tg, 0.9 + r * 0.1, h); S.fx('burst', tg.x, tg.z, 2, '#cfe0ff'); } },
      { n: 'Rallying Cry', t: 'self', cd: 16, cost: 30, d: 'Allied heroes within 10 gain 15/20/25/30/35 Armor and MR for 5s. Taunts nearby enemies for 1.5s.',
        cast(S, h, r) { const b = 10 + r * 5; S.allyHeroes(h, 10).forEach(a => S.buff(a, 'rally', 5, { armor: b, mr: b })); S.enemiesNear(h, h.x, h.z, 7).forEach(e => { if (e.kind !== 'boss' || r >= 3) { e.tauntU = S.t + 1.5; e.tauntId = h.id; } }); S.fx('ring', h.x, h.z, 10, '#ffd36b'); } },
      { n: 'Valiant Charge', t: 'point', range: 10, cd: [13, 12, 11, 10, 9], cost: 30, d: 'Charge to a point, dealing 50/80/110/140/170 (+60% AD) physical damage and slowing enemies hit by 40%.',
        cast(S, h, r, x, z) { S.dash(h, x, z, 32, { hitR: 2.6, onPass(e) { S.damage(h, e, [50, 80, 110, 140, 170][r - 1] + 0.6 * h.ad, 'phys', { spell: 1 }); S.slow(e, 0.6, 1.5); } }); } },
      { n: 'Bastion', t: 'self', ult: 1, cd: [80, 70, 60], cost: 50, d: 'For 6s take 40/50/60% less damage and burn nearby enemies for 30/55/80 (+3% max HP) magic damage per second.',
        cast(S, h, r) { S.buff(h, 'bastion', 6, { dr: 0.3 + r * 0.1 }); S.aura(h, 6, 4.5, 0.5, e => S.damage(h, e, ([30, 55, 80][r - 1] + 0.03 * h.maxhp) * 0.5, 'magic', { spell: 1 }), '#ffd36b'); } }]
  },
  emberwitch: {
    name: 'Emberwitch', title: 'Mistress of Cinders', role: 'Mage', col: '#ff6a3d',
    res: { type: 'Mana', max: 420, regen: 2.6, perLvl: 45, regenLvl: 0.18 },
    base: { hp: 520, ad: 40, ap: 0, ms: 320, ls: 0, sv: 0, crit: 0, mr: 30, armor: 20, as: 0.65, range: 9, hpr: 1.5 },
    grow: { hp: 72, ad: 2, armor: 2, mr: 1.5, as: 0.012, hpr: 0.15, ap: 3 },
    ab: [
      { n: 'Firebolt', t: 'dir', range: 16, cd: 5, cost: [50, 55, 60, 65, 70], d: 'Hurl a firebolt that explodes on the first enemy hit for 80/125/170/215/260 (+75% AP) magic damage in an area.',
        cast(S, h, r, x, z) { S.skillshot(h, x, z, { range: 16, speed: 32, w: 1.1, col: '#ff7a2e', size: 0.7, st: 'F', onHit(e, p) { S.enemiesNear(h, p.x, p.z, 2.6).forEach(u => S.damage(h, u, [80, 125, 170, 215, 260][r - 1] + 0.75 * h.ap, 'magic', { spell: 1 })); S.fx('burst', p.x, p.z, 2.6, '#ff7a2e'); } }); } },
      { n: 'Flame Pillar', t: 'point', range: 13, cd: 12, cost: 80, d: 'After 0.8s, fire erupts at a location dealing 70/115/160/205/250 (+60% AP) magic damage and stunning for 1.2s.',
        cast(S, h, r, x, z) { S.telegraph(x, z, 3.5, 0.8, 0, () => { S.enemiesNear(h, x, z, 3.5).forEach(e => { S.damage(h, e, [70, 115, 160, 205, 250][r - 1] + 0.6 * h.ap, 'magic', { spell: 1 }); S.stun(e, 1.2, h); }); S.fx('pillar', x, z, 3.5, '#ff5a1e'); }); } },
      { n: 'Blink', t: 'point', range: 9, cd: [16, 14.5, 13, 11.5, 10], cost: 60, d: 'Teleport to a nearby location. Your next Firebolt within 3s costs no mana.',
        cast(S, h, r, x, z) { S.fx('blink', h.x, h.z, 2, '#ff9a5e'); [x, z] = nearestFree(x, z); h.x = x; h.z = z; h.order = null; S.fx('blink', x, z, 2, '#ff9a5e'); } },
      { n: 'Meteor Storm', t: 'point', ult: 1, range: 16, cd: [90, 80, 70], cost: 150, d: 'Call 7 meteors over 3s in a large area. Each deals 90/140/190 (+35% AP) magic damage.',
        cast(S, h, r, x, z) { S.telegraph(x, z, 7, 3.2, 0, null); for (let i = 0; i < 7; i++) { const a = S.R() * 6.283, d = Math.sqrt(S.R()) * 6, mx = x + Math.cos(a) * d, mz = z + Math.sin(a) * d; S.later(0.4 + i * 0.42, () => { S.telegraph(mx, mz, 2.8, 0.35, 0, () => { S.enemiesNear(h, mx, mz, 2.8).forEach(e => S.damage(h, e, [90, 140, 190][r - 1] + 0.35 * h.ap, 'magic', { spell: 1 })); S.fx('meteor', mx, mz, 2.8, '#ff4a10'); }); }); } } }]
  },
  thornshot: {
    name: 'Thornshot', title: 'Warden of the Wilds', role: 'Marksman', col: '#5fbf4a',
    res: { type: 'Energy', max: 100, regen: 11, perLvl: 0 },
    base: { hp: 560, ad: 56, ap: 0, ms: 330, ls: 0, sv: 0, crit: 0.05, mr: 28, armor: 22, as: 0.8, range: 10, hpr: 1.8 },
    grow: { hp: 80, ad: 3.5, armor: 2.5, mr: 1.3, as: 0.028, hpr: 0.2 },
    ab: [
      { n: 'Piercing Arrow', t: 'dir', range: 18, cd: [7, 6.5, 6, 5.5, 5], cost: 40, d: 'Fire an arrow that pierces all enemies for 40/70/100/130/160 (+110% AD) physical damage. Can crit.',
        cast(S, h, r, x, z) { S.skillshot(h, x, z, { range: 18, speed: 42, w: 1, pierce: 1, col: '#c8ff7a', size: 0.45, st: 'A', onHit(e) { S.damage(h, e, [40, 70, 100, 130, 160][r - 1] + 1.1 * h.ad, 'phys', { spell: 1, canCrit: 1 }); } }); } },
      { n: 'Volley', t: 'dir', range: 11, cd: 10, cost: 50, d: 'Fire 7 arrows in a cone, each dealing 30/45/60/75/90 (+50% AD) physical damage.',
        cast(S, h, r, x, z) { const base = Math.atan2(z - h.z, x - h.x); for (let i = -3; i <= 3; i++) { const a = base + i * 0.13; S.skillshot(h, h.x + Math.cos(a) * 11, h.z + Math.sin(a) * 11, { range: 11, speed: 36, w: 0.8, col: '#c8ff7a', size: 0.35, st: 'A', onHit(e) { S.damage(h, e, [30, 45, 60, 75, 90][r - 1] + 0.5 * h.ad, 'phys', { spell: 1 }); } }); } } },
      { n: 'Tumble', t: 'point', range: 5, cd: [8, 7, 6.5, 6, 5], cost: 30, d: 'Roll a short distance. Your next attack within 4s deals 40/60/80/100/120 (+50% AD) bonus damage.',
        cast(S, h, r, x, z) { S.dash(h, x, z, 26, {}); h.empower = { until: S.t + 4, bonus: [40, 60, 80, 100, 120][r - 1] + 0.5 * h.ad }; } },
      { n: "Hunter's Mark", t: 'dir', ult: 1, range: 60, cd: [70, 60, 50], cost: 70, d: 'Loose a huge arrow across the map. Deals 250/400/550 (+150% AD) physical damage to the first enemy, up to double against wounded targets.',
        cast(S, h, r, x, z) { S.skillshot(h, x, z, { range: 60, speed: 55, w: 1.6, col: '#eaff5a', size: 1.1, st: 'M', onHit(e) { const miss = 1 - e.hp / e.maxhp; S.damage(h, e, ([250, 400, 550][r - 1] + 1.5 * h.ad) * (1 + miss), 'phys', { spell: 1 }); S.fx('burst', e.x, e.z, 3, '#eaff5a'); } }); } }]
  },
  bloodreaver: {
    name: 'Bloodreaver', title: 'The Crimson Axe', role: 'Bruiser', col: '#c0283a',
    res: { type: 'Rage', max: 100, regen: 0, perLvl: 0, rage: 1 },
    base: { hp: 690, ad: 58, ap: 0, ms: 335, ls: 0.06, sv: 0, crit: 0, mr: 28, armor: 28, as: 0.72, range: 2.8, hpr: 2.2 },
    grow: { hp: 92, ad: 3.8, armor: 2.9, mr: 1.6, as: 0.02, hpr: 0.3 },
    ab: [
      { n: 'Cleave', t: 'self', cd: 6, cost: 0, gain: 15, d: 'Cleave around you for 50/80/110/140/170 (+90% AD) physical damage. Heal 12/16/20/24/28 per enemy hit. Generates 15 Rage.',
        cast(S, h, r) { let n = 0; S.enemiesNear(h, h.x, h.z, 4.5).forEach(e => { S.damage(h, e, [50, 80, 110, 140, 170][r - 1] + 0.9 * h.ad, 'phys', { spell: 1 }); n++; }); S.heal(h, h, Math.min(n, 5) * (8 + r * 4)); S.fx('ring', h.x, h.z, 4.5, '#ff3a4a'); } },
      { n: 'Frenzy', t: 'self', cd: 14, cost: 40, d: 'Gain 30/40/50/60/70% Attack Speed and 10% Lifesteal for 5s.',
        cast(S, h, r) { S.buff(h, 'frenzy', 5, { as: 0.2 + r * 0.1, ls: 0.1 }); S.fx('ring', h.x, h.z, 2.5, '#ff3a4a'); } },
      { n: 'Blood Leap', t: 'point', range: 9, cd: [12, 11, 10, 9, 8], cost: 0, gain: 10, d: 'Leap to a location, dealing 60/95/130/165/200 (+70% AD) physical damage on landing and slowing by 40%. Generates 10 Rage.',
        cast(S, h, r, x, z) { S.dash(h, x, z, 22, { over: 1, onEnd() { S.enemiesNear(h, h.x, h.z, 3.6).forEach(e => { S.damage(h, e, [60, 95, 130, 165, 200][r - 1] + 0.7 * h.ad, 'phys', { spell: 1 }); S.slow(e, 0.6, 1.8); }); S.fx('burst', h.x, h.z, 3.6, '#ff3a4a'); } }); } },
      { n: 'Crimson Pact', t: 'self', ult: 1, cd: [75, 65, 55], cost: 100, d: 'Spend 100 Rage: for 8s gain 40/60/80 Attack Damage, 25% Lifesteal and 20% Movespeed.',
        cast(S, h, r) { S.buff(h, 'pact', 8, { ad: 20 + r * 20, ls: 0.25, msP: 0.2 }); S.fx('pillar', h.x, h.z, 2.5, '#ff1a2a'); } }]
  },
  lumen: {
    name: 'Lumen', title: 'Herald of the Dawn', role: 'Support', col: '#ffe08a',
    res: { type: 'Mana', max: 400, regen: 3, perLvl: 42, regenLvl: 0.2 },
    base: { hp: 545, ad: 42, ap: 0, ms: 325, ls: 0, sv: 0, crit: 0, mr: 32, armor: 22, as: 0.65, range: 8, hpr: 2 },
    grow: { hp: 76, ad: 2.2, armor: 2.2, mr: 1.6, as: 0.012, hpr: 0.2, ap: 3 },
    ab: [
      { n: 'Radiant Orb', t: 'point', range: 12, cd: 6, cost: 50, d: 'Burst of light: enemies take 60/95/130/165/200 (+60% AP) magic damage, allied heroes heal 40/60/80/100/120 (+40% AP).',
        cast(S, h, r, x, z) { S.telegraph(x, z, 3.5, 0.35, 0, () => { S.enemiesNear(h, x, z, 3.5).forEach(e => S.damage(h, e, [60, 95, 130, 165, 200][r - 1] + 0.6 * h.ap, 'magic', { spell: 1 })); S.heroes.forEach(a => { if (!a.dead && d2(a.x, a.z, x, z) < 3.5 * 3.5 + 1) S.heal(h, a, 20 + r * 20 + 0.4 * h.ap); }); S.fx('burst', x, z, 3.5, '#fff1a8'); }); } },
      { n: 'Mend', t: 'self', cd: 9, cost: 70, d: 'Heal the most wounded allied hero within 12 (or yourself) for 80/120/160/200/240 (+80% AP) and grant 20 Armor for 3s.',
        cast(S, h, r) { let best = h, bp = h.hp / h.maxhp; S.allyHeroes(h, 12).forEach(a => { const p = a.hp / a.maxhp; if (p < bp) { bp = p; best = a; } }); S.heal(h, best, 40 + r * 40 + 0.8 * h.ap); S.buff(best, 'mend', 3, { armor: 20 }); S.fx('pillar', best.x, best.z, 1.5, '#9dffb0'); } },
      { n: 'Sanctuary', t: 'point', range: 10, cd: 18, cost: 90, d: 'Consecrate ground for 4s. Allied heroes inside regenerate 15/25/35/45/55 (+15% AP) HP per second and gain 15% Movespeed; enemies are slowed by 30%.',
        cast(S, h, r, x, z) { S.telegraph(x, z, 6, 4, 2, null); S.ticker(4, 0.5, () => { S.heroes.forEach(a => { if (!a.dead && d2(a.x, a.z, x, z) < 36) { S.heal(h, a, (5 + r * 10 + 0.15 * h.ap) * 0.5); S.buff(a, 'sanct', 0.6, { msP: 0.15 }); } }); S.enemiesNear(h, x, z, 6).forEach(e => S.slow(e, 0.7, 0.6)); }); } },
      { n: 'Dawnburst', t: 'self', ult: 1, cd: [100, 85, 70], cost: 180, d: 'All allied heroes anywhere heal 200/325/450 (+80% AP). Enemies within 8 take 150/250/350 (+70% AP) magic damage and are stunned 1.25s.',
        cast(S, h, r) { S.heroes.forEach(a => { if (!a.dead) { S.heal(h, a, 75 + r * 125 + 0.8 * h.ap); S.fx('pillar', a.x, a.z, 1.5, '#fff1a8'); } }); S.enemiesNear(h, h.x, h.z, 8).forEach(e => { S.damage(h, e, 50 + r * 100 + 0.7 * h.ap, 'magic', { spell: 1 }); S.stun(e, 1.25, h); }); S.fx('ring', h.x, h.z, 8, '#fff1a8'); } }]
  },
};
const HERO_IDS = Object.keys(HEROES);
const xpNext = l => 110 + l * 85;

// ---------------- UNIT TEMPLATES ----------------
const MINION = {
  melee: { hp: 460, ad: 21, armor: 8, mr: 0, as: 0.9, range: 1.8, ms: 300, r: 0.7, g: 20, xp: 40 },
  ranged: { hp: 300, ad: 25, armor: 0, mr: 8, as: 0.8, range: 8, ms: 300, r: 0.65, g: 15, xp: 32 },
  siege: { hp: 950, ad: 55, armor: 20, mr: 20, as: 0.5, range: 11, ms: 270, r: 1.1, g: 45, xp: 70, structMult: 2 },
  elite: { hp: 2200, ad: 58, armor: 30, mr: 25, as: 0.8, range: 2.4, ms: 290, r: 1.25, g: 95, xp: 150 },
  lieut: { hp: 5600, ad: 92, armor: 40, mr: 40, as: 0.8, range: 3, ms: 290, r: 1.6, g: 320, xp: 420 },
};
const CREEPS = {
  bandit: { hp: 520, ad: 30, armor: 12, mr: 10, as: 0.8, range: 2, ms: 300, r: 0.75, g: 28, xp: 50 },
  archer: { hp: 380, ad: 34, armor: 5, mr: 10, as: 0.75, range: 8, ms: 300, r: 0.7, g: 26, xp: 45 },
  wolf: { hp: 420, ad: 26, armor: 8, mr: 8, as: 1.0, range: 1.8, ms: 340, r: 0.75, g: 26, xp: 45 },
  troll: { hp: 760, ad: 40, armor: 16, mr: 12, as: 0.8, range: 2.2, ms: 300, r: 0.95, g: 40, xp: 70 },
  trollshaman: { hp: 520, ad: 42, armor: 8, mr: 22, as: 0.7, range: 8, ms: 300, r: 0.85, g: 38, xp: 65 },
  ogre: { hp: 1250, ad: 62, armor: 25, mr: 15, as: 0.65, range: 2.4, ms: 290, r: 1.25, g: 62, xp: 110 },
  rockgolem: { hp: 1600, ad: 55, armor: 40, mr: 30, as: 0.6, range: 2.4, ms: 270, r: 1.35, g: 75, xp: 130 },
  sapling: { hp: 320, ad: 24, armor: 10, mr: 10, as: 0.9, range: 1.8, ms: 320, r: 0.6, g: 10, xp: 15 },
  stalker: { hp: 900, ad: 48, armor: 18, mr: 18, as: 0.9, range: 2, ms: 345, r: 0.9, g: 45, xp: 70 },
};
// Preset enemy war camps along each lane: cleared camps stay cleared
const LANE_CAMPS = [
  { z: 118, mult: 1.5, troops: ['melee', 'melee', 'melee', 'ranged', 'ranged'] },
  { z: 8, mult: 2.4, troops: ['melee', 'melee', 'melee', 'ranged', 'ranged', 'elite'] },
  { z: -118, mult: 3.4, troops: ['melee', 'melee', 'melee', 'melee', 'ranged', 'ranged', 'elite', 'elite', 'lieut'] }];
const CAMP_NAMES = { L: ['Bone Pickets', 'Ghoul Warren', 'Necropolis Bastion'], M: ['Raider Outpost', 'Warband Camp', "Warchief's Stronghold"], R: ['Tide Pickets', 'Myrmidon Shoal', "Sea Witch's Reef"] };
const LIEUT_NAMES = { L: 'Lich Lieutenant', M: 'Orc Warchief', R: 'Naga Sea Witch' };
const LIEUT_SKILLS = { L: ['nova', 'summon'], M: ['slam', 'charge'], R: ['nova', 'slam'] };
const CAMP_UNITS = { wolves: ['wolf', 'wolf', 'wolf'], trolls: ['troll', 'trollshaman', 'troll'], ogres: ['ogre', 'rockgolem'] };

// ---------------- SIM ----------------
class Sim {
  constructor(opts) {
    this.mode = MODES[opts.mode] ? opts.mode : 'standard'; this.M = MODES[this.mode]; this.cyc = this.M.day + this.M.night;
    this.seed = opts.seed >>> 0 || 1; this.R = mulberry32(this.seed);
    this.t = 0; this.tick = 0; this.ents = []; this.byId = new Map(); this.nid = 1;
    this.projs = []; this.timers = []; this.zones = []; this.fxq = []; this.msgq = []; this.heroes = [];
    this.over = null; this.cycle = 1; this.phase = 'day'; this.waveT = 6; this.waveN = 0; this.secretOpen = false; this.eclipse = false;
    this.campTimers = MAP.camps.map(() => 0); this.townBonus = {}; this.vault = []; this.upg = {}; for (const k in BASE_UPG) this.upg[k] = 0; this.raidPlan = null;
    this.setup(opts.players);
  }
  // ----- setup -----
  setup(players) {
    const SH = this.M.struct;
    for (const c of MAP.cores) this.mk(c.team ? 'core' : 'core', c.team, c.x, c.z, { hp: Math.round((c.team ? 12000 : 9000) * SH), ad: 160, armor: 50, mr: 50, as: 0.8, range: 12, r: 3.5, ms: 0, v: 'core', invuln: 1, structure: 1, g: 0, xp: 0, pc: c.team ? '#ff5a6a' : '#6ab0ff' });
    for (const b of BASES) for (const g of b.gates) {
      this.spawnGate(b, g);
      const tx = -Math.sin(g.ang), tz = Math.cos(g.ang), rx = Math.cos(g.ang), rz = Math.sin(g.ang);
      for (const sd of [-1, 1]) { const t = this.mk('tower', b.team, g.x + tx * 7.6 * sd - rx * 1.2, g.z + tz * 7.6 * sd - rz * 1.2, { hp: Math.round((b.team ? 3600 : 3000) * SH), ad: 120, armor: 45, mr: 45, as: 0.85, range: 12, r: 2, ms: 0, v: 'tower', invuln: b.team ? 1 : 0, structure: 1, g: 250, xp: 250, pc: b.team ? '#ff5a6a' : '#6ab0ff' }); t.lane = g.lane; }
    }
    this.spawnLaneCamps();
    for (const t of MAP.towns) {
      const e = this.mk('town', 2, t.x, t.z, { hp: 2500, ad: 70, armor: 40, mr: 40, as: 0.9, range: 9, r: 3.2, ms: 0, v: 'town', untarget: 1, structure: 1, g: 0, xp: 0, pc: '#9fd0ff' });
      Object.assign(e, { tid: t.id, name: t.name, lane: t.lane, upkeep: t.upkeep, ttier: t.tier, mine: !!t.mine, guards: [], cap: 0, inv: 0 });
      this.spawnGuards(e);
    }
    for (const b of MAP.bosses) {
      const e = this.mk('boss', 2, b.x, b.z, { hp: b.hp, ad: b.ad, armor: b.armor, mr: b.mr, as: b.as, range: b.range, ms: 300, r: b.r, v: 'b_' + b.id, g: 250 * b.tier, xp: 450 * b.tier, pc: '#b3ff6a' });
      Object.assign(e, { bid: b.id, name: b.name, btier: b.tier, skills: b.skills, warden: b.warden, homeX: b.x, homeZ: b.z, leash: 20, scd: {}, aggro: 9 });
    }
    MAP.camps.forEach((c, i) => this.spawnCamp(i));
    const starts = [[-3, 108], [3, 108], [-3, 104], [3, 104]].map(sc);
    players.forEach((p, i) => {
      const d = HEROES[p.hero] || HEROES.ironvow;
      const h = this.mk('hero', 0, starts[i % 4][0], starts[i % 4][1], { hp: d.base.hp, ad: d.base.ad, armor: d.base.armor, mr: d.base.mr, as: d.base.as, range: d.base.range, ms: d.base.ms, r: 0.9, v: 'h_' + (HEROES[p.hero] ? p.hero : 'ironvow'), g: 0, xp: 0, pc: d.col });
      Object.assign(h, {
        pid: p.pid, pname: p.name || ('Player ' + (i + 1)), hid: HEROES[p.hero] ? p.hero : 'ironvow', lvl: 1, xp: 0, gold: 600, items: [null, null, null, null, null, null],
        ranks: [0, 0, 0, 0], pts: 1, attr: 0, cds: [0, 0, 0, 0], res: d.res.rage ? 0 : d.res.max, resMax: d.res.max, buffs: [], order: null, pending: null,
        dash: null, recall: null, rail: null, respawnT: 0, member: false, pots: 2, potU: 0, empower: null, slot: i,
        st: { dealt: 0, phys: 0, magic: 0, toMinions: 0, toCreeps: 0, toBosses: 0, toStruct: 0, taken: 0, mitigated: 0, healing: 0, selfHeal: 0, maxHit: 0, crits: 0, minionKills: 0, creepKills: 0, bossKills: 0, structKills: 0, deaths: 0, goldEarned: 0, goldSpent: 0, upkeep: 0, towns: 0, casts: 0, looted: 0, ccTime: 0, xp: 0 }
      });
      this.heroes.push(h); this.recalc(h); h.hp = h.maxhp; h.res = d.res.rage ? 0 : h.resMax;
    });
    this.rotateVault();
    this.msg('Day 1 — push the lanes, secure towns, slay the Wardens. Destroy the enemy Core!', 'gold');
  }
  mk(kind, team, x, z, s) {
    const e = { id: this.nid++, kind, team, x, z, face: 0, hp: s.hp, maxhp: s.hp, ad: s.ad || 0, ap: 0, armor: s.armor || 0, mr: s.mr || 0, as: s.as || 1, range: s.range || 2, ms: s.ms || 300, r: s.r || 0.8, v: s.v || kind,
      atkCd: 0, stunU: 0, slowU: 0, slowM: 1, tauntU: 0, tauntId: 0, dead: false, tgt: 0, think: this.R() * 0.3, g: s.g || 0, xp: s.xp || 0, pc: s.pc || '#fff', ranged: (s.range || 2) > 4, structMult: s.structMult || 1, structure: s.structure || 0, invuln: s.invuln || 0, untarget: s.untarget || 0, ls: 0, sv: 0, crit: 0, dr: 0, combatT: 99, walkT: 0 };
    this.ents.push(e); this.byId.set(e.id, e); return e;
  }
  unitFrom(tpl, kind, team, x, z, mult, v) {
    const s = Object.assign({}, tpl); s.hp = Math.round(s.hp * mult); s.ad = s.ad * (0.6 + 0.4 * mult); s.v = v && v.startsWith('c_') && v.split('_').length === 2 ? v + '_' + laneOf(x, z) : v; s.g = Math.round(s.g * (1 + (mult - 1) * 0.5));
    return this.mk(kind, team, x, z, s);
  }
  spawnGuards(town) {
    const m = 1 + (town.ttier - 1) * 0.6 + (this.cycle - 1) * 0.25;
    const kinds = town.ttier > 1 ? ['bandit', 'bandit', 'archer', 'archer', 'bandit'] : ['bandit', 'bandit', 'archer', 'archer'];
    town.guards = kinds.map((k, i) => {
      const a = i / kinds.length * 6.283, e = this.unitFrom(CREEPS[k], 'creep', 2, town.x + Math.cos(a) * 4.5, town.z + Math.sin(a) * 4.5, m, 'c_' + k);
      e.homeX = e.x; e.homeZ = e.z; e.leash = 13; e.aggro = 8; return e.id;
    });
  }
  spawnCamp(i) {
    const c = MAP.camps[i], m = 1 + (this.mins()) * 0.045;
    const ids = CAMP_UNITS[c.t].map((k, j, arr) => {
      const a = j / arr.length * 6.283, e = this.unitFrom(CREEPS[k], 'creep', 2, c.x + Math.cos(a) * 2.2, c.z + Math.sin(a) * 2.2, m, 'c_' + k);
      e.homeX = e.x; e.homeZ = e.z; e.leash = 11; e.aggro = 6; e.camp = i; return e.id;
    });
    this.campTimers[i] = -1; MAP.camps[i].ids = ids;
  }
  mins() { return this.t / 60 * this.M.scale; }
  // ----- helpers exposed to abilities -----
  later(dt, fn) { this.timers.push({ at: this.t + dt, fn }); }
  ticker(dur, every, fn) { for (let t = 0; t < dur - 1e-6; t += every) this.later(t, fn); }
  telegraph(x, z, r, dur, kind, fn) { this.zones.push({ x, z, r, s: this.t, e: this.t + dur, k: kind || 0 }); if (fn) this.later(dur, fn); }
  fx(type, x, z, r, col) { this.fxq.push(['f', type, Math.round(x * 10) / 10, Math.round(z * 10) / 10, r, col]); }
  num(x, z, val, c) { if (this.fxq.length < 80) this.fxq.push(['n', Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(val), c]); }
  msg(text, c) { this.msgq.push([text, c || 'w']); }
  enemiesNear(src, x, z, r) { const out = []; for (const e of this.ents) { if (this.canHit(src, e) && d2(e.x, e.z, x, z) < (r + e.r * 0.6) ** 2) out.push(e); } return out; }
  allyHeroes(src, r) { return this.heroes.filter(a => !a.dead && d2(a.x, a.z, src.x, src.z) < r * r); }
  buff(h, id, dur, s) { h.buffs = h.buffs.filter(b => b.id !== id); h.buffs.push({ id, until: this.t + dur, s }); }
  stun(e, dur, src) { if (e.structure || e.dead) return; if (e.kind === 'boss') dur *= 0.5; if (e.stunU < this.t + dur) e.stunU = this.t + dur; if (src && src.st) src.st.ccTime += dur; }
  slow(e, mult, dur) { if (e.structure) return; e.slowM = Math.min(e.slowU > this.t ? e.slowM : 1, mult); e.slowU = Math.max(e.slowU, this.t + dur); }
  aura(h, dur, r, every, fn, col) { this.ticker(dur, every, () => { if (!h.dead) this.enemiesNear(h, h.x, h.z, r).forEach(fn); }); }
  dash(h, x, z, speed, o) { h.dash = { x, z, speed, hitR: o.hitR, onPass: o.onPass, onEnd: o.onEnd, over: o.over, hit: new Set() }; h.order = null; h.recall = null; }
  skillshot(h, x, z, o) {
    let dx = x - h.x, dz = z - h.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    this.projs.push({ id: this.nid++, x: h.x + dx, z: h.z + dz, vx: dx * o.speed, vz: dz * o.speed, life: o.range / o.speed, owner: h, w: o.w, pierce: o.pierce, onHit: o.onHit, hit: new Set(), col: o.col, size: o.size || 0.5, st: o.st || 'o' });
  }
  heal(src, tgt, amt) {
    if (tgt.dead || amt <= 0) return;
    const real = Math.min(amt, tgt.maxhp - tgt.hp); tgt.hp += real;
    if (src && src.st) { src.st.healing += real; if (src === tgt) src.st.selfHeal += real; }
    if (real >= 5 && (tgt.kind === 'hero')) this.num(tgt.x, tgt.z, real, 3);
  }
  canHit(a, b) {
    if (b.dead || b.untarget || a === b) return false;
    if (a.kind === 'hero') return b.team !== 0;
    if (a.kind === 'merc') return b.team === 1 || b.team === 2;
    if (a.team === 0) return b.team === 1;
    if (a.team === 1) return b.team === 0;
    if (a.team === 2) return b.team === 0 && (b.kind === 'hero' || b.id === a.tgt);
    return false;
  }
  // ----- combat -----
  damage(src, tgt, amt, type, o) {
    o = o || {};
    if (tgt.dead || tgt.untarget || amt <= 0) return 0;
    if (tgt.invuln) { if (src && src.kind === 'hero' && this.R() < 0.05) this.msg(tgt.kind === 'core' ? 'The Core is shielded — break a gate first.' : 'Sealed — defeat this lane\'s Warden boss first.', 'r'); return 0; }
    let crit = false;
    if ((o.auto || o.canCrit) && src.crit > 0 && this.R() < src.crit) { amt *= 1.75; crit = true; }
    if (src.nightFury) amt *= tgt.structure ? 1.3 : 2;
    if (tgt.structure && src.structMult) amt *= src.structMult;
    const res = type === 'phys' ? tgt.armor : type === 'magic' ? tgt.mr : 0;
    let mult = res >= 0 ? 100 / (100 + res) : 2 - 100 / (100 - res);
    mult *= (1 - (tgt.dr || 0)); if (tgt.kind === 'town') mult *= 0.65;
    if (tgt.nightFury) mult *= 0.5;
    if (tgt.kind === 'hero' && tgt.townWard && src.team === 1) mult *= 0.5;
    const dmg = amt * mult;
    tgt.hp -= dmg; tgt.combatT = 0; if (src) src.combatT = 0;
    if (src && src.kind === 'hero') {
      const s = src.st; s.dealt += dmg; if (type === 'phys') s.phys += dmg; else if (type === 'magic') s.magic += dmg;
      if (tgt.kind === 'minion') s.toMinions += dmg; else if (tgt.kind === 'creep' || tgt.kind === 'stalker') s.toCreeps += dmg; else if (tgt.kind === 'boss') s.toBosses += dmg; else if (tgt.structure) s.toStruct += dmg;
      if (dmg > s.maxHit) s.maxHit = dmg; if (crit) s.crits++;
      if (o.auto && src.ls > 0) this.heal(src, src, dmg * src.ls);
      if (o.spell && src.sv > 0) this.heal(src, src, dmg * src.sv);
      if (HEROES[src.hid].res.rage) src.res = Math.min(src.resMax, src.res + (o.auto ? 7 : 2));
      this.num(tgt.x, tgt.z, dmg, crit ? 4 : type === 'magic' ? 1 : 0);
    }
    if (tgt.kind === 'hero') {
      tgt.st.taken += dmg; tgt.st.mitigated += Math.max(0, amt - dmg);
      const rd = HEROES[tgt.hid].res; if (rd.hurtGain) tgt.res = Math.min(tgt.resMax, tgt.res + rd.hurtGain); if (rd.rage) tgt.res = Math.min(tgt.resMax, tgt.res + 3);
      if (tgt.recall) { tgt.recall = null; }
      this.num(tgt.x, tgt.z, dmg, 2);
    }
    if ((tgt.kind === 'creep' || tgt.kind === 'boss' || tgt.kind === 'guard') && src && src.team === 0) { if (!tgt.tgt || !this.byId.get(tgt.tgt) || this.byId.get(tgt.tgt).dead) tgt.tgt = src.id; if (tgt.kind === 'guard') this.campAlert(tgt, src); }
    if (tgt.hp <= 0) this.kill(tgt, src);
    return dmg;
  }
  autoHit(src, tgt) {
    let amt = src.ad;
    if (src.empower && src.empower.until > this.t) { amt += src.empower.bonus; src.empower = null; this.fx('burst', tgt.x, tgt.z, 1.5, '#c8ff7a'); }
    this.damage(src, tgt, amt, 'phys', { auto: 1 });
  }
  kill(e, src) {
    if (e.kind !== 'town') this.fxq.push(['d', e.v, Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10, Math.round(e.face * 100) / 100, e.team, e.id]);
    if (e.kind === 'town') {
      e.team = 2; e.untarget = 1; e.hp = e.maxhp; e.cap = 0; e.guards = []; e.inv = 0; e.pc = '#9fd0ff';
      this.ents.forEach(g => { if (g.kind === 'garrison' && g.town === e.id) g.dead = true; }); this.fx('ruin', e.x, e.z, 8, '#ff6a2a');
      this.msg(e.name + ' has fallen to the enemy!', 'r'); return;
    }
    if (e.kind === 'hero') {
      e.dead = true; e.hp = 0; e.st.deaths++; e.order = null; e.pending = null; e.dash = null; e.recall = null; e.rail = null; e.dir = null; e.buffs = [];
      e.respawnT = (6 + e.lvl * 1.6) * (this.phase === 'night' ? 0.6 : 1);
      this.msg(e.pname + ' (' + HEROES[e.hid].name + ') has fallen! Respawn in ' + Math.ceil(e.respawnT) + 's', 'r');
      return;
    }
    e.dead = true; e.hp = 0;
    // bounty
    const near = this.heroes.filter(h => !h.dead && d2(h.x, h.z, e.x, e.z) < 18 * 18);
    const killer = src && src.kind === 'hero' ? src : null;
    if (e.team !== 0) {
      if (e.kind === 'boss') {
        const mythic = e.warden && this.phase === 'night';
        this.heroes.forEach(h => { this.giveGold(h, e.g); this.giveXp(h, e.xp); h.st.bossKills++; this.giveItem(h, rollLegendary(this.R, BOSS_LEGEND[e.bid])); if (this.R() < 0.15) this.giveCard(h); if (mythic) this.giveItem(h, rollMythic(this.R)); });
        this.msg(e.name + ' slain! Every hero receives ' + e.g + ' gold and a Legendary.', 'gold');
        if (mythic) this.msg('Something ancient stirs beneath the night sky…', 'r6');
        if (e.warden) { this.ents.forEach(t => { if ((t.kind === 'tower' || t.kind === 'gate') && t.team === 1 && t.lane === e.warden) t.invuln = 0; }); this.msg('The ' + LANE_INFO[e.warden].name + ' enemy gate and towers are no longer sealed!', 'gold'); }
        if (e.bid === 'treant') { this.secretOpen = true; this.msg('The Secret Shop in the Blightwood is now open!', 'gold'); }
      } else {
        const share = near.length > 1 ? 0.8 : 1;
        near.forEach(h => this.giveXp(h, e.xp * share));
        if (killer) { this.giveGold(killer, e.g); this.num(e.x, e.z, e.g, 5); }
        near.forEach(h => { if (h !== killer) this.giveGold(h, Math.round(e.g * (killer ? 0.4 : 0.5))); });
        if (killer) { if (e.kind === 'minion') killer.st.minionKills++; else if (e.structure) killer.st.structKills++; else killer.st.creepKills++; }
        if (e.structure) { this.heroes.forEach(h => { if (!near.includes(h)) { this.giveGold(h, e.g); this.giveXp(h, e.xp * 0.5); } }); }
        const lvlSrc = killer || near[0];
        if (lvlSrc && CARD_CHANCE[e.kind] && this.R() < CARD_CHANCE[e.kind] * (e.lootBoost ? 5 : 1)) this.dropLoot(e.x, e.z, { card: 1, n: 'Member Card', rar: 5, s: {}, c: 0 });
        if (lvlSrc && DROP_CHANCE[e.kind] && this.R() < DROP_CHANCE[e.kind] * (e.lootBoost || 1) * (e.v === 'c_ogre' || e.v === 'c_rockgolem' ? 1.6 : 1)) this.dropLoot(e.x, e.z, rollLoot(this.R, lvlSrc.lvl, e.lootBoost > 1 ? 1 : 0));
      }
      if (e.kind === 'tower' && e.team === 1) this.msg('Enemy ' + LANE_INFO[e.lane].name + ' tower destroyed!', 'gold');
      if (e.kind === 'gate' && e.team === 1) { e.gdef.cells.forEach(i => DYN[i] = 0); this.msg('The enemy ' + LANE_INFO[e.lane].name + ' gate is broken! The enemy Core is exposed.', 'gold'); const c = this.ents.find(c => c.kind === 'core' && c.team === 1); if (c) c.invuln = 0; }
      if (e.kind === 'guard') { const c = this.camps2[e.camp]; if (c && !c.cleared && c.ids.every(id => { const u = this.byId.get(id); return !u || u.dead; })) this.campCleared(c); }
      if (e.kind === 'core' && e.team === 1) this.end(true);
      if (e.camp !== undefined) { const c = MAP.camps[e.camp]; if (c.ids.every(id => { const u = this.byId.get(id); return !u || u.dead; })) this.campTimers[e.camp] = this.t + 60; }
    } else {
      if (e.kind === 'tower') this.msg('Our ' + LANE_INFO[e.lane].name + ' tower has been destroyed!', 'r');
      if (e.kind === 'gate') { e.gdef.cells.forEach(i => DYN[i] = 0); this.msg('Our ' + LANE_INFO[e.lane].name + ' gate has fallen! The Core is vulnerable.', 'r'); const c = this.ents.find(c => c.kind === 'core' && c.team === 0); if (c) c.invuln = 0; }
      if (e.kind === 'core') this.end(false);
    }
  }
  giveGold(h, g) { g = Math.round(g * this.M.gold); h.gold += g; h.st.goldEarned += g; }
  giveXp(h, x) {
    if (h.lvl >= 20) return; x *= this.M.xp; h.xp += x; h.st.xp += x;
    while (h.lvl < 20 && h.xp >= xpNext(h.lvl)) { h.xp -= xpNext(h.lvl); h.lvl++; h.pts++; this.recalc(h); h.hp = Math.min(h.maxhp, h.hp + h.maxhp * 0.1); this.fx('lvl', h.x, h.z, 2, '#ffe27a'); }
    if (h.lvl >= 20) h.xp = 0;
  }
  giveItem(h, it) {
    const i = h.items.indexOf(null); h.st.looted++;
    if (i < 0) { const g = Math.round(it.c * 0.6); this.giveGold(h, g); this.msg(h.pname + "'s bags are full — " + it.n + ' sold for ' + g + 'g', 'w'); return; }
    h.items[i] = it; this.recalc(h); if (it.rar >= 3) this.msgq.push([h.pname + ' found ' + it.n, 'r' + it.rar]); else this.msgq.push(['Picked up ' + it.n, 'p' + h.pid]);
  }
  dropLoot(x, z, it) {
    const e = this.mk('loot', 2, x + (this.R() - 0.5), z + (this.R() - 0.5), { hp: 1, r: 0.6, v: it.card ? 'loot_card' : 'loot_' + it.rar, ms: 0 });
    e.untarget = 1; e.item = it; e.expire = this.t + (it.rar >= 3 ? 150 : 75);
  }
  stepLoot(e) {
    if (this.t > e.expire) { e.dead = true; return; }
    for (const h of this.heroes) { if (h.dead) continue; if (e.item.card ? h.member : h.items.indexOf(null) < 0) continue; if (d2(h.x, h.z, e.x, e.z) < 2.4 * 2.4) { e.dead = true; if (e.item.card) this.giveCard(h); else this.giveItem(h, e.item); return; } }
  }
  forge(h, slots, fail) {
    if (d2(h.x, h.z, MAP.forge.x, MAP.forge.z) > 7 * 7) return fail('You must stand at the forge');
    if (!Array.isArray(slots) || slots.length !== 3 || new Set(slots).size !== 3) return fail('Place three items in the forge');
    const its = slots.map(i => h.items[i]); if (its.some(x => !x || x.rar === undefined || x.rar < 0)) return fail('Only found items can be forged');
    const r = its[0].rar; if (its.some(x => x.rar !== r)) return fail('All three items must share a rarity');
    if (r >= 6) return fail('Mythics cannot be reforged');
    let out; if (r <= 3) out = makeProc(this.R, r + 1, h.lvl); else if (r === 4) out = rollLegendary(this.R); else out = rollMythic(this.R);
    slots.forEach(i => h.items[i] = null); h.items[slots[0]] = out; this.recalc(h); h.st.looted++;
    this.fx('pillar', MAP.forge.x, MAP.forge.z, 2, RARITY[out.rar].col);
    if (r >= 4) this.msg(h.pname + ' forged ' + out.n + '!', 'r' + out.rar); else this.msgq.push(['Forged ' + out.n, 'p' + h.pid]);
  }
  end(win) { if (this.over) return; this.over = { win, t: this.t }; this.msg(win ? 'VICTORY! The enemy Core is destroyed!' : 'DEFEAT! Our Core has fallen.', win ? 'gold' : 'r'); }
  // ----- hero stats -----
  recalc(h) {
    const d = HEROES[h.hid], L = h.lvl - 1, b = d.base, g = d.grow;
    const s = { hp: b.hp + g.hp * L + h.attr * 25, ad: b.ad + g.ad * L + h.attr * 3, ap: (g.ap || 0) * L + h.attr * 5, armor: b.armor + g.armor * L, mr: b.mr + g.mr * L, as: g.as * L, ms: b.ms, msP: 0, ls: b.ls, sv: b.sv, crit: b.crit, res: 0, resr: 0, dr: 0 };
    for (const it of h.items) if (it) for (const k in it.s) s[k] = (s[k] || 0) + it.s[k];
    for (const bf of h.buffs) for (const k in bf.s) s[k] = (s[k] || 0) + bf.s[k];
    for (const k in this.townBonus) s[k] = (s[k] || 0) + this.townBonus[k];
    const old = h.maxhp; h.maxhp = Math.round(s.hp); if (h.maxhp > old && !h.dead) h.hp += h.maxhp - old; h.hp = Math.min(h.hp, h.maxhp);
    h.ad = s.ad; h.ap = s.ap; h.armor = s.armor; h.mr = s.mr; h.as = Math.min(2.5, b.as * (1 + s.as)); h.ms = Math.min(600, s.ms * (1 + s.msP));
    h.ls = s.ls; h.sv = s.sv; h.crit = Math.min(1, s.crit); h.dr = Math.min(0.8, s.dr); h.range = b.range; h.hpr = b.hpr + (g.hpr || 0) * L;
    if (d.res.type === 'Mana') { h.resMax = d.res.max + d.res.perLvl * L + s.res; h.resRegen = d.res.regen + (d.res.regenLvl || 0) * L + s.resr; }
    else { h.resMax = d.res.max; h.resRegen = d.res.regen + s.resr * 0.5; }
    h.statView = { ad: s.ad, ap: s.ap, ms: h.ms, ls: s.ls, sv: s.sv, crit: h.crit, mr: s.mr, armor: s.armor, hp: h.maxhp, as: h.as };
  }
  // ----- inputs -----
  input(pid, c) {
    const h = this.heroes.find(x => x.pid === pid); if (!h || this.over) return;
    const fail = m => this.msgq.push([m, 'p' + pid]);
    switch (c.c) {
      case 'move': if (h.dead) return; h.order = { t: 'move', x: c.x, z: c.z }; h.pending = null; h.dir = null; h.recall = null; h.rail = null; break;
      case 'attack': { if (h.dead) return; const e = this.byId.get(c.id); if (e && this.canHit(h, e)) { h.order = { t: 'attack', id: e.id }; h.pending = null; h.recall = null; } break; }
      case 'stop': h.order = null; h.pending = null; h.dir = null; break;
      case 'dir': {
        if (h.dead) return;
        if (!c.x && !c.z) { h.dir = null; break; }
        const l = Math.hypot(c.x, c.z) || 1; h.dir = { x: c.x / l, z: c.z / l }; h.order = null; h.pending = null; h.recall = null; h.rail = null; break;
      }
      case 'atk': {
        if (h.dead) return; const cur = h.order && h.order.t === 'attack' ? this.byId.get(h.order.id) : null;
        const tg = (c.keep && cur && this.canHit(h, cur)) ? cur : this.pickAttack(h, c.id); if (!tg) break;
        const same = cur && cur === tg; h.order = { t: 'attack', id: tg.id, hold: !!c.hold, once: !c.hold, t0: same ? h.order.t0 : this.t }; h.dir = null; h.recall = null; h.pending = null; break;
      }
      case 'atkEnd': if (h.order && h.order.t === 'attack') { h.order.hold = false; h.order.once = true; } break;
      case 'cast': if (!h.dead) this.cast(h, c.k, c.x, c.z, c.id, fail, c.auto); break;
      case 'lvl': {
        const k = c.k; if (h.pts <= 0) return;
        if (k === 4) { h.attr++; h.pts--; this.recalc(h); return; }
        if (!this.canLevel(h, k)) return fail('Cannot rank up that ability yet');
        h.ranks[k]++; h.pts--; break;
      }
      case 'buy': {
        if (c.loot !== undefined) { const enc = this.ents.find(e => e.kind === 'enc' && e.sub === 'merchant' && !e.dead && d2(e.x, e.z, h.x, h.z) < 49); if (!enc) return fail('Too far from the merchant'); const it = enc.stock[c.loot]; if (!it) return; const price = Math.round(it.c * 1.5); if (h.gold < price) return fail('Not enough gold'); if (h.items.indexOf(null) < 0) return fail('Inventory full'); h.gold -= price; h.st.goldSpent += price; enc.stock[c.loot] = null; h.items[h.items.indexOf(null)] = it; this.recalc(h); return; }
        if (c.item === 'potion') { if (!this.shopAccess(h).any) return fail('No shop nearby'); if (h.pots >= POTION_MAX) return fail('Potion limit reached'); if (h.gold < POTION_COST) return fail('Not enough gold'); h.gold -= POTION_COST; h.st.goldSpent += POTION_COST; h.pots++; return; }
        if (c.vault) { if (!h.member) return fail('Members only'); if (!this.shopAccess(h).any) return fail('No shop nearby'); if (!this.vault.includes(c.vault)) return fail('No longer in stock'); const it = VAULT[c.vault]; if (h.gold < it.c) return fail('Not enough gold'); const slot = h.items.indexOf(null); if (slot < 0) return fail('Inventory full'); h.gold -= it.c; h.st.goldSpent += it.c; h.items[slot] = { n: it.n, s: Object.assign({}, it.s), c: it.c, key: c.vault, rar: -2 }; this.recalc(h); return; }
        const it = ITEMS[c.item]; if (!it) return; const acc = this.shopAccess(h);
        if (it.secret ? !acc.secret : !acc.normal) return fail(it.secret ? 'Must be at the Secret Shop' : 'No shop nearby — base anytime, owned towns at night');
        if (h.gold < it.c) return fail('Not enough gold'); const slot = h.items.indexOf(null); if (slot < 0) return fail('Inventory full');
        h.gold -= it.c; h.st.goldSpent += it.c; h.items[slot] = { n: it.n, s: Object.assign({}, it.s), c: it.c, key: c.item, rar: -1 }; this.recalc(h); break;
      }
      case 'sell': { const it = h.items[c.slot]; if (!it) return; const g = Math.round(it.c * (this.shopAccess(h).any ? 0.5 : 0.25)); h.gold += g; h.items[c.slot] = null; this.recalc(h); break; }
      case 'upg': this.buyUpgrade(h, c.k, fail); break;
      case 'rail': if (!h.dead) this.rideRail(h, c.lane, c.to, fail); break;
      case 'merc': if (!h.dead) this.hireMerc(h, fail); break;
      case 'forge': if (!h.dead) this.forge(h, c.slots, fail); break;
      case 'potion': if (h.dead) return; if (h.pots <= 0) return fail('No potions'); if (h.potU > this.t) return fail('Already drinking'); h.pots--; h.potU = this.t + 8; break;
      case 'tier': {
        const t = this.ents.find(e => e.kind === 'town' && e.tid === c.tid); if (!t) return;
        if (t.team !== 0) return fail('You must hold ' + t.name + ' to fund it');
        const n = clamp(t.inv + (c.d > 0 ? 1 : -1), 0, 3); if (n === t.inv) return;
        if (n > t.inv && this.heroes.some(x => x.gold < n * TIER_DRAIN * 10)) return fail('Every hero needs ' + Math.ceil(n * TIER_DRAIN * 10) + 'g (10s of drain) to fund tier ' + n);
        t.inv = n; this.msg(h.pname + ' set ' + t.name + ' ' + TOWN_BUFFS[t.tid].n + ' to tier ' + n + (n ? ' (' + (n * TIER_DRAIN).toFixed(1) + 'g/s each)' : ''), 'gold'); break;
      }
      case 'recall': if (h.dead) return; h.dir = null; h.order = null; h.pending = null; h.recall = { dest: 'base', at: this.t + 6, total: 6 }; break;
      case 'way': {
        if (h.dead) return; if (this.phase !== 'night') return fail('Waygates only work at night');
        let dest; if (c.dest === 'base') dest = 'base'; else { const tn = this.ents.find(e => e.kind === 'town' && e.tid === c.dest && e.team === 0); if (!tn) return fail('You do not hold that town'); dest = tn.tid; }
        h.order = null; h.pending = null; h.recall = { dest, at: this.t + 2, total: 2 }; break;
      }
    }
  }
  canLevel(h, k) {
    if (k === 3) { const need = [6, 11, 16][h.ranks[3]]; return need !== undefined && h.lvl >= need; }
    return h.ranks[k] < 5 && h.ranks[k] < Math.ceil(h.lvl / 2);
  }
  shopAccess(h) {
    const atBase = d2(h.x, h.z, MAP.shop.x, MAP.shop.z) < 8 * 8;
    const atTown = this.phase === 'night' && this.ents.some(e => e.kind === 'town' && e.team === 0 && d2(e.x, e.z, h.x, h.z) < 9 * 9);
    const secret = this.secretOpen && d2(h.x, h.z, MAP.secretShop.x, MAP.secretShop.z) < 8 * 8;
    return { normal: atBase || atTown || secret, secret, any: atBase || atTown || secret };
  }
  pickAttack(h, id) {
    const want = id ? this.byId.get(id) : null; if (want && this.canHit(h, want)) return want;
    let best = null, bs = 1e9; const R2 = (h.range + 7) ** 2;
    for (const o of this.ents) {
      if (!this.canHit(h, o)) continue; const dd = d2(h.x, h.z, o.x, o.z); if (dd > R2 + o.r * o.r * 4) continue;
      let sc = Math.sqrt(dd); if (o.structure) sc += 8; if (o.team === 2 && o.tgt !== h.id) sc += 4; if (o.invuln) sc += 50;
      if (sc < bs) { bs = sc; best = o; }
    }
    return best;
  }
  cast(h, k, x, z, id, fail, auto) {
    const ab = HEROES[h.hid].ab[k], r = h.ranks[k];
    if (auto && ab && ab.t !== 'self') {
      const tg = this.pickAttack(h, id); const rng = (ab.range || 8) + (ab.t === 'unit' ? 3 : 1);
      if (tg && !tg.structure && d2(tg.x, tg.z, h.x, h.z) < rng * rng) { x = tg.x; z = tg.z; id = tg.id; }
      else { if (ab.t === 'unit') return fail('No target in range'); const dd = ab.t === 'dir' ? ab.range : Math.min(ab.range, 6); x = h.x + Math.cos(h.face) * dd; z = h.z + Math.sin(h.face) * dd; id = undefined; }
    }
    if (!ab || !r) return fail('Ability not learned');
    if (h.cds[k] > 0) return fail(ab.n + ' is on cooldown');
    if (h.stunU > this.t) return fail('Stunned!');
    if (h.dash) return;
    let cost = v(ab.cost, r);
    if (h.hid === 'emberwitch' && k === 0 && h.blinkFree > this.t) cost = 0;
    if (h.res < cost) return fail('Not enough ' + HEROES[h.hid].res.type);
    let tg = null;
    if (ab.t === 'unit') {
      tg = id ? this.byId.get(id) : null;
      if (!tg || !this.canHit(h, tg)) { let best = 9; for (const e of this.ents) if (this.canHit(h, e) && !e.structure) { const dd = d2(e.x, e.z, x, z); if (dd < best) { best = dd; tg = e; } } }
      if (!tg || !this.canHit(h, tg)) return fail('No target');
      if (d2(tg.x, tg.z, h.x, h.z) > (ab.range + tg.r) ** 2) { h.pending = { k, id: tg.id }; h.order = { t: 'chase', id: tg.id }; return; }
    } else if (ab.t === 'point' || ab.t === 'dir') {
      if (x === undefined || isNaN(x)) { x = h.x + Math.cos(h.face) * 5; z = h.z + Math.sin(h.face) * 5; }
      if (ab.t === 'point') {
        x = clamp(x, -MAP.W, MAP.W); z = clamp(z, -MAP.H, MAP.H);
        const dx = x - h.x, dz = z - h.z, l = Math.hypot(dx, dz);
        if (l > ab.range + 0.3) { if (!auto && !h.castNow && l < ab.range * 4) { h.pending = { k, x, z }; h.order = { t: 'castmove' }; h.dir = null; return; } x = h.x + dx / l * ab.range; z = h.z + dz / l * ab.range; }
      }
      if (Math.abs(x - h.x) + Math.abs(z - h.z) > 0.01) h.face = Math.atan2(z - h.z, x - h.x);
    }
    const fx0 = h.x, fz0 = h.z;
    if (ab.cast(this, h, r, x, z, tg) === false) return;
    this.fxq.push(['a', h.id, h.hid, k, Math.round(fx0 * 10) / 10, Math.round(fz0 * 10) / 10, Math.round(x * 10) / 10, Math.round(z * 10) / 10, tg ? tg.id : 0]);
    h.res -= cost; if (ab.gain) h.res = Math.min(h.resMax, h.res + ab.gain);
    h.cds[k] = v(ab.cd, r); h.st.casts++; h.recall = null; h.combatT = 0;
    if (h.hid === 'emberwitch' && k === 2) h.blinkFree = this.t + 3;
    if (h.hid === 'emberwitch' && k === 0) h.blinkFree = 0;
    if (ab.t === 'self' || ab.t === 'unit') { if (h.order && h.order.t === 'chase') h.order = null; }
  }
  // ----- movement -----
  moveToward(e, tx, tz, dt, stopDist) {
    if (e.stunU > this.t) return false;
    const dx = tx - e.x, dz = tz - e.z, l = Math.hypot(dx, dz);
    if (l <= (stopDist || 0.15) + 0.02) return true;
    let sp = e.ms * SPD * (e.slowU > this.t ? e.slowM : 1) * (e.nightFury ? 1.15 : 1);
    const step = Math.min(l - (stopDist || 0), sp * dt);
    let nx = clamp(e.x + dx / l * step, -MAP.W, MAP.W), nz = clamp(e.z + dz / l * step, -MAP.H, MAP.H);
    const T = e.team; if (blockedT(T, nx, nz) && !blockedT(T, e.x, e.z)) { if (!blockedT(T, nx, e.z)) nz = e.z; else if (!blockedT(T, e.x, nz)) nx = e.x; else { e.stuck = (e.stuck || 0) + dt; return false; } }
    e.x = nx; e.z = nz; e.face = Math.atan2(dz, dx); e.walkT = 0.15;
    return false;
  }
  navTo(e, tx, tz, dt, stop) {
    stop = stop || 0.15; if (d2(e.x, e.z, tx, tz) <= stop * stop) { e.nav = null; return true; }
    let N = e.nav;
    if (!N || d2(N.tx, N.tz, tx, tz) > 9 || this.t > N.t + 1.5 || (e.stuck || 0) > 0.4) {
      e.stuck = 0;
      const pts = losT(e.team, e.x, e.z, tx, tz) ? [[tx, tz]] : (NAV(e.x, e.z, tx, tz, e.team) || [[tx, tz]]);
      N = e.nav = { tx, tz, t: this.t, pts };
    }
    if (N.pts.length > 1) { const p = N.pts[0]; if (this.moveToward(e, p[0], p[1], dt, 0.6)) N.pts.shift(); return false; }
    const r = this.moveToward(e, tx, tz, dt, stop); if (r) e.nav = null; return r;
  }
  attackStep(e, tg, dt) {
    const rr = e.range + tg.r + e.r * 0.4;
    if (d2(e.x, e.z, tg.x, tg.z) > rr * rr) { if (e.kind === 'minion') this.moveToward(e, tg.x, tg.z, dt, rr * 0.9); else this.navTo(e, tg.x, tg.z, dt, rr * 0.9); return; }
    e.face = Math.atan2(tg.z - e.z, tg.x - e.x);
    if (e.atkCd <= 0 && e.stunU <= this.t) {
      e.atkCd = 1 / e.as; e.atkAnim = this.t;
      if (e.ranged) this.projs.push({ id: this.nid++, x: e.x, z: e.z, tid: tg.id, speed: e.structure ? 26 : 22, owner: e, col: e.pc, size: e.structure ? 0.6 : 0.35, auto: 1, st: projStyle(e) });
      else this.autoHit(e, tg);
    }
  }
  findTarget(e, rad, filter) {
    let best = null, bs = rad * rad;
    for (const o of this.ents) {
      if (!this.canHit(e, o) || (filter && !filter(o))) continue;
      let dd = d2(e.x, e.z, o.x, o.z) - o.r * o.r; if (o.structure) dd += 12;
      if (dd < bs) { bs = dd; best = o; }
    }
    return best;
  }
  // ----- main step -----
  step() {
    const dt = DT; this.t += dt; this.tick++;
    const S = this;
    // phase
    const pt = this.t % this.cyc, phase = pt < this.M.day ? 'day' : 'night', cyc = Math.floor(this.t / this.cyc) + 1;
    if (phase !== this.phase) { this.phase = phase; if (phase === 'night') this.onNight(); else { this.cycle = cyc; this.onDay(); } }
    if (!this.eclipse && this.t >= this.M.eclipse) { this.eclipse = true; this.msg('ECLIPSE! The enemy unleashes everything — end it now!', 'r'); }
    // waves
    this.waveT -= dt;
    if (this.waveT <= 0) { this.waveT = this.eclipse ? 20 : 30; this.waveN++; this.spawnWave(); }
    // raids
    if (this.raidPlan && this.t >= this.raidPlan.at) { this.raidPlan = null; this.spawnRaid(); }
    // camps
    this.campTimers.forEach((tm, i) => { if (tm > 0 && this.t >= tm) this.spawnCamp(i); });
    // timers
    if (this.timers.length) { const due = this.timers.filter(t => t.at <= this.t); this.timers = this.timers.filter(t => t.at > this.t); due.forEach(t => t.fn()); }
    this.zones = this.zones.filter(z => z.e > this.t);
    // night fury flags (every 0.5s)
    if (this.tick % 10 === 0) for (const e of this.ents) { if (e.team === 1 && !e.structure) e.nightFury = (this.phase === 'night' || this.eclipse) && inLane(e.x, e.z); }
    // gold/xp trickle
    if (this.tick % 20 === 0) {
      const mine = this.ents.some(e => e.kind === 'town' && e.mine && e.team === 0);
      this.heroes.forEach(h => { this.giveGold(h, 2 + this.upg.treasury + (mine && this.phase === 'day' ? 3 : 0)); this.giveXp(h, 1.5); });
      const bonus = {};
      for (const t of this.ents) {
        if (t.kind !== 'town' || t.team !== 0 || !t.inv) continue;
        const cost = Math.round(t.inv * TIER_DRAIN * 10) / 10;
        if (this.heroes.some(h => h.gold < cost)) { t.inv--; this.msg(t.name + ' ' + TOWN_BUFFS[t.tid].n + ' dropped to tier ' + t.inv + ' — not enough gold.', 'r'); if (!t.inv) continue; }
        const c2 = t.inv * TIER_DRAIN;
        this.heroes.forEach(h => { h.gold -= c2; h.st.upkeep += c2; });
        const b = TOWN_BUFFS[t.tid].s[t.inv - 1]; for (const k in b) bonus[k] = (bonus[k] || 0) + b[k];
      }
      this.townBonus = bonus;
    }
    // heroes
    for (const h of this.heroes) this.stepHero(h, dt);
    // units
    for (const e of this.ents) {
      if (e.dead || e.kind === 'hero') continue;
      if (e.atkCd > 0) e.atkCd -= dt; e.combatT += dt; if (e.walkT > 0) e.walkT -= dt;
      if (e.kind === 'minion') this.stepMinion(e, dt);
      else if (e.kind === 'creep' || e.kind === 'boss') this.stepNeutral(e, dt);
      else if (e.kind === 'stalker') this.stepStalker(e, dt);
      else if (e.structure && !e.untarget) this.stepStructure(e, dt);
      else if (e.kind === 'town') this.stepTown(e, dt);
      else if (e.kind === 'enc') this.stepEnc(e, dt);
      else if (e.kind === 'loot') this.stepLoot(e);
      else if (e.kind === 'raider') this.stepRaider(e, dt);
      else if (e.kind === 'merc') this.stepMerc(e, dt);
      else if (e.kind === 'garrison') this.stepGarrison(e, dt);
      else if (e.kind === 'guard') this.stepGuard(e, dt);
      else if (e.kind === 'heal') this.stepHeal(e);
    }
    // separation for small units
    if (this.tick % 2 === 0) {
      const arr = this.ents.filter(e => !e.dead && !e.structure && e.kind !== 'enc' && e.kind !== 'loot' && e.kind !== 'heal' && e.kind !== 'ward');
      for (let i = 0; i < arr.length; i++) { const a = arr[i]; for (let j = i + 1; j < arr.length; j++) { const b = arr[j]; const dx = b.x - a.x, dz = b.z - a.z; const min = (a.r + b.r) * 0.85; if (dx > min || dx < -min || dz > min || dz < -min) continue; const l = Math.hypot(dx, dz) || 0.01; if (l < min) { const p = (min - l) * 0.5, px = dx / l * p, pz = dz / l * p; const wa = a.kind === 'boss' ? 0.1 : 1, wb = b.kind === 'boss' ? 0.1 : 1; if (!blockedT(a.team, a.x - px * wa, a.z - pz * wa)) { a.x -= px * wa; a.z -= pz * wa; } if (!blockedT(b.team, b.x + px * wb, b.z + pz * wb)) { b.x += px * wb; b.z += pz * wb; } } } }
    }
    // projectiles
    for (const p of this.projs) {
      if (p.tid) {
        const t = this.byId.get(p.tid); if (!t || t.dead || t.untarget) { p.done = 1; continue; }
        const dx = t.x - p.x, dz = t.z - p.z, l = Math.hypot(dx, dz), st = p.speed * dt;
        if (l < st + t.r * 0.5) { p.done = 1; if (!p.owner.dead || p.owner.structure) { if (p.owner.kind === 'hero') this.autoHit(p.owner, t); else this.damage(p.owner, t, p.owner.ad, 'phys', { auto: 1 }); } }
        else { p.x += dx / l * st; p.z += dz / l * st; }
      } else {
        p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt; if (p.life <= 0) p.done = 1;
        for (const e of this.ents) {
          if (p.done) break; if (p.hit.has(e.id) || !this.canHit(p.owner, e) || e.structure) continue;
          if (d2(e.x, e.z, p.x, p.z) < (p.w + e.r) ** 2) { p.hit.add(e.id); p.onHit(e, p); if (!p.pierce) p.done = 1; }
        }
      }
    }
    this.projs = this.projs.filter(p => !p.done);
    // cleanup
    if (this.tick % 10 === 0) { this.ents = this.ents.filter(e => { if (e.dead && e.kind !== 'hero') { this.byId.delete(e.id); return false; } return true; }); }
  }
  stepHero(h, dt) {
    const d = HEROES[h.hid];
    if (h.dead) {
      h.respawnT -= dt;
      if (h.respawnT <= 0) {
        const owned = this.ents.filter(e => e.kind === 'town' && e.team === 0).sort((a, b) => a.z - b.z);
        const sp = owned[0] || MAP.fountain;
        h.dead = false; h.x = sp.x + (this.R() - 0.5) * 3; h.z = sp.z + 4 + this.R() * 2; h.buffs = []; this.recalc(h); h.hp = h.maxhp; if (!d.res.rage) h.res = h.resMax;
        this.msg(h.pname + ' respawned at ' + (owned[0] ? owned[0].name : 'base'), 'w'); this.fx('spawn', h.x, h.z, 2, '#fff1a8');
      }
      return;
    }
    // buffs & stats
    const nb = h.buffs.length; h.buffs = h.buffs.filter(b => b.until > this.t);
    if (nb !== h.buffs.length || this.tick % 10 === 0) this.recalc(h);
    for (let i = 0; i < 4; i++) if (h.cds[i] > 0) h.cds[i] = Math.max(0, h.cds[i] - dt);
    if (h.atkCd > 0) h.atkCd -= dt; h.combatT += dt; if (h.walkT > 0) h.walkT -= dt;
    // regen
    const inFountain = d2(h.x, h.z, MAP.fountain.x, MAP.fountain.z) < MAP.fountain.r * MAP.fountain.r;
    const town = this.ents.find(e => e.kind === 'town' && e.team === 0 && d2(e.x, e.z, h.x, h.z) < 81);
    h.townWard = !!town;
    let regen = h.hpr; if (inFountain) regen += h.maxhp * 0.08; else if (town && this.phase === 'night') regen += h.maxhp * 0.025;
    if (h.potU > this.t) regen += 250 / 8;
    h.hp = Math.min(h.maxhp, h.hp + regen * dt);
    if (d.res.rage) { if (h.combatT > 4) h.res = Math.max(0, h.res - 6 * dt); }
    else { let rr = h.resRegen; if (inFountain) rr += h.resMax * 0.08; h.res = Math.min(h.resMax, h.res + rr * dt); }
    // recall
    if (h.recall) {
      if (h.recall.at <= this.t) {
        if (h.recall.dest === 'base') { h.x = MAP.fountain.x + (this.R() - 0.5) * 4; h.z = MAP.fountain.z; }
        else { const tn = this.ents.find(e => e.kind === 'town' && e.tid === h.recall.dest && e.team === 0); if (tn) { h.x = tn.x; h.z = tn.z + 4; } }
        this.fx('blink', h.x, h.z, 2, '#9fd0ff'); h.recall = null;
      }
      return;
    }
    // rail
    if (h.rail) {
      const R = h.rail, p = R.path[R.i]; if (!p) { h.rail = null; } else {
        const dx = p[0] - h.x, dz = p[1] - h.z, l = Math.hypot(dx, dz), st = 30 * dt;
        if (l <= st) { h.x = p[0]; h.z = p[1]; R.i++; if (R.i >= R.path.length) { h.rail = null; this.fx('blink', h.x, h.z, 1.5, '#ffd36b'); } }
        else { h.x += dx / l * st; h.z += dz / l * st; h.face = Math.atan2(dz, dx); }
        return;
      }
    }
    // dash
    if (h.dash) {
      const D = h.dash; const dx = D.x - h.x, dz = D.z - h.z, l = Math.hypot(dx, dz), st = D.speed * dt;
      if (D.onPass) this.enemiesNear(h, h.x, h.z, D.hitR).forEach(e => { if (!D.hit.has(e.id)) { D.hit.add(e.id); D.onPass(e); } });
      const nx = l <= st ? D.x : h.x + dx / l * st, nz = l <= st ? D.z : h.z + dz / l * st;
      if (D.over ? dynBlocked(h.team, nx, nz) : blockedT(h.team, nx, nz)) { h.dash = null; if (D.onEnd) D.onEnd(); }
      else if (l <= st) { h.x = D.x; h.z = D.z; h.dash = null; if (blocked(h.x, h.z)) [h.x, h.z] = nearestFree(h.x, h.z); if (D.onEnd) D.onEnd(); }
      else { h.x = nx; h.z = nz; h.face = Math.atan2(dz, dx); }
      return;
    }
    if (h.stunU > this.t) return;
    if (h.dir) { this.moveToward(h, h.x + h.dir.x * 4, h.z + h.dir.z * 4, dt, 0); return; }
    const o = h.order;
    if (o && o.t === 'move') { if (this.navTo(h, o.x, o.z, dt)) h.order = null; return; }
    if (o && o.t === 'castmove' && h.pending) {
      const P = h.pending, ab = d.ab[P.k];
      if (d2(P.x, P.z, h.x, h.z) <= (ab.range + 0.2) ** 2) { h.pending = null; h.order = null; h.castNow = 1; this.cast(h, P.k, P.x, P.z, undefined, m => this.msgq.push([m, 'p' + h.pid])); h.castNow = 0; }
      else this.navTo(h, P.x, P.z, dt, ab.range * 0.92);
      return;
    }
    if (o && (o.t === 'attack' || o.t === 'chase')) {
      let tg = this.byId.get(o.id);
      if (!tg || !this.canHit(h, tg)) {
        if (o.t === 'attack' && o.hold) { const n = this.pickAttack(h); if (n) { o.id = n.id; o.t0 = this.t; return; } }
        h.order = null; h.pending = null; return;
      }
      if (h.pending) {
        const ab = d.ab[h.pending.k];
        if (d2(tg.x, tg.z, h.x, h.z) <= (ab.range + tg.r) ** 2) { const pk = h.pending.k; h.pending = null; h.order = { t: 'attack', id: tg.id }; this.cast(h, pk, tg.x, tg.z, tg.id, m => this.msgq.push([m, 'p' + h.pid])); }
        else this.navTo(h, tg.x, tg.z, dt, 1);
        return;
      }
      this.attackStep(h, tg, dt);
      if (o.once && h.atkAnim >= o.t0) h.order = null;
      return;
    }
  }
  stepMinion(e, dt) {
    e.think -= dt;
    let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (e.tauntU > this.t) { const t2 = this.byId.get(e.tauntId); if (t2 && !t2.dead) tg = t2; }
    if (e.think <= 0) {
      e.think = 0.3;
      if (!(e.tauntU > this.t)) {
        if (!tg || tg.dead || !this.canHit(e, tg) || d2(e.x, e.z, tg.x, tg.z) > 12 * 12) tg = this.findTarget(e, 9);
        // re-prioritize: units over structures
        if (tg && tg.structure) { const u = this.findTarget(e, 8, o => !o.structure); if (u) tg = u; }
      }
      e.tgt = tg ? tg.id : 0;
    }
    if (e.team === 1) { const bt = this.frontTown(e.lane, e.z); if (bt && e.z > bt.z - 10 && (!tg || tg.dead || d2(tg.x, tg.z, e.x, e.z) > 81)) { this.attackStep(e, bt, dt); return; } }
    if (tg && !tg.dead && this.canHit(e, tg)) { this.attackStep(e, tg, dt); return; }
    // follow lane
    const P = LANES[e.lane]; let wi = e.wp; if (wi < 0 || wi >= P.length) return;
    const wp = P[wi];
    if (this.moveToward(e, wp[0] + e.ox, wp[1], dt, 1.2)) e.wp += e.team === 0 ? 1 : -1;
  }
  stepNeutral(e, dt) {
    e.think -= dt;
    let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (tg && (tg.dead || tg.untarget || d2(tg.x, tg.z, e.homeX, e.homeZ) > (e.leash + 4) ** 2)) { tg = null; e.tgt = 0; }
    if (e.tauntU > this.t) { const t2 = this.byId.get(e.tauntId); if (t2 && !t2.dead) tg = t2; }
    if (e.think <= 0) {
      e.think = 0.35;
      if (!tg) { const h = this.heroes.find(h => !h.dead && d2(h.x, h.z, e.x, e.z) < e.aggro * e.aggro); if (h) { tg = h; e.tgt = h.id; } }
    }
    const away = d2(e.x, e.z, e.homeX, e.homeZ);
    if (!tg) { if (away > 0.5) this.navTo(e, e.homeX, e.homeZ, dt, 0.3); else e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.06 * dt); return; }
    if (away > e.leash * e.leash) { e.tgt = 0; e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.2); return; }
    if (e.kind === 'boss') this.bossSkills(e, tg);
    if (e.kind === 'boss' && e.hp < e.maxhp * 0.3 && !e.enraged) { e.enraged = 1; e.as *= 1.5; this.msg(e.name + ' is enraged!', 'r'); }
    if (!e.casting || e.casting < this.t) this.attackStep(e, tg, dt);
  }
  bossSkills(e, tg) {
    if (e.stunU > this.t || (e.casting && e.casting > this.t)) return;
    for (const sk of e.skills) {
      if ((e.scd[sk] || 0) > this.t) continue;
      const ad = e.ad * (1 + (this.mins()) * 0.03);
      if (sk === 'slam' && d2(tg.x, tg.z, e.x, e.z) < 100) {
        const x = tg.x, z = tg.z; e.scd.slam = this.t + 8; e.casting = this.t + 1.2;
        this.telegraph(x, z, 4.5, 1.2, 1, () => { if (e.dead) return; this.heroes.forEach(h => { if (!h.dead && d2(h.x, h.z, x, z) < 4.5 * 4.5 + 1) { this.damage(e, h, ad * 2.2, 'phys'); this.stun(h, 0.8); } }); this.fx('burst', x, z, 4.5, '#ffb35a'); });
        return;
      }
      if (sk === 'nova') {
        e.scd.nova = this.t + 11; e.casting = this.t + 1.5; const x = e.x, z = e.z;
        this.telegraph(x, z, 8, 1.5, 1, () => { if (e.dead) return; this.heroes.forEach(h => { if (!h.dead && d2(h.x, h.z, x, z) < 64) { this.damage(e, h, ad * 1.9, 'magic'); this.slow(h, 0.5, 2.5); } }); this.fx('ring', x, z, 8, '#b06bff'); });
        return;
      }
      if (sk === 'charge' && d2(tg.x, tg.z, e.x, e.z) > 25) {
        e.scd.charge = this.t + 12; e.casting = this.t + 1.4; const x = tg.x, z = tg.z;
        this.telegraph(x, z, 3.5, 0.9, 1, () => { if (e.dead) return; e.x = x; e.z = z; this.heroes.forEach(h => { if (!h.dead && d2(h.x, h.z, x, z) < 3.5 * 3.5 + 1) { this.damage(e, h, ad * 1.8, 'phys'); this.stun(h, 0.6); } }); this.fx('burst', x, z, 3.5, '#ff6a3a'); });
        return;
      }
      if (sk === 'summon') {
        e.scd.summon = this.t + 18;
        for (let i = 0; i < 3; i++) { const a = this.R() * 6.283, s = this.unitFrom(CREEPS.sapling, 'creep', 2, e.x + Math.cos(a) * 3, e.z + Math.sin(a) * 3, 1 + this.mins() / 10, e.bid === 'bogwitch' ? 'c_toad' : 'c_sapling'); s.homeX = e.homeX; s.homeZ = e.homeZ; s.leash = 20; s.aggro = 12; s.tgt = tg.id; }
        this.fx('ring', e.x, e.z, 3, '#7aff6a');
        return;
      }
    }
  }
  stepStalker(e, dt) {
    e.think -= dt;
    let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (e.think <= 0) {
      e.think = 0.4;
      if (!tg || !this.canHit(e, tg) || !inLane(tg.x, tg.z)) {
        tg = null; let best = 30 * 30;
        for (const h of this.heroes) { if (h.dead || h.townWard || !inLane(h.x, h.z)) continue; const dd = d2(h.x, h.z, e.x, e.z); if (dd < best) { best = dd; tg = h; } }
        if (!tg) tg = this.findTarget(e, 7);
      }
      e.tgt = tg ? tg.id : 0;
    }
    if (tg && !tg.dead && this.canHit(e, tg)) { this.attackStep(e, tg, dt); if (!inLane(e.x, e.z)) { e.tgt = 0; } return; }
    if (this.navTo(e, e.px, e.pz, dt, 1)) { const P = LANES[e.lane], i = 1 + Math.floor(this.R() * (P.length - 2)); e.px = P[i][0] + (this.R() - 0.5) * 8; e.pz = P[i][1] + (this.R() - 0.5) * 20; }
  }
  stepStructure(e, dt) {
    if (e.atkCd > 0) { /* handled */ }
    e.think -= dt; let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (e.think <= 0) {
      e.think = 0.25;
      if (!tg || !this.canHit(e, tg) || d2(e.x, e.z, tg.x, tg.z) > (e.range + tg.r) ** 2) {
        tg = this.findTarget(e, e.range + 1, o => !o.structure);
        // protect heroes: prefer whoever hits allied heroes - simplified to units first
      }
      e.tgt = tg ? tg.id : 0;
    }
    if (tg && !tg.dead && d2(e.x, e.z, tg.x, tg.z) <= (e.range + tg.r) ** 2 && e.atkCd <= 0) {
      e.atkCd = 1 / e.as;
      this.projs.push({ id: this.nid++, x: e.x, z: e.z, tid: tg.id, speed: 26, owner: e, col: e.pc, size: 0.6, auto: 1, st: 'b' });
    }
    if (e.kind === 'town') {
      this.stepTown(e, dt);
      if (e.team === 0 && this.tick % 20 === 0) { const n = this.ents.filter(g => g.kind === 'garrison' && g.town === e.id && !g.dead).length; e.garT += 1; if (n < 2 + (e.inv || 0) && e.garT >= 40) { e.garT = 0; this.spawnGarrison(e); } }
    }
  }
  stepTown(e, dt) {
    if (e.team !== 2) return;
    const guardsAlive = e.guards.some(id => { const g = this.byId.get(id); return g && !g.dead; });
    const near = this.heroes.some(h => !h.dead && d2(h.x, h.z, e.x, e.z) < 7 * 7);
    const foes = this.ents.some(o => o.team === 1 && !o.dead && !o.structure && d2(o.x, o.z, e.x, e.z) < 10 * 10);
    if (!guardsAlive && near && !foes) {
      e.cap += dt;
      if (e.cap >= 4) {
        e.team = 0; e.untarget = 0; e.cap = 0; e.pc = '#6ab0ff'; this.fortify(e); this.fx('capture', e.x, e.z, 9, '#ffd36b');
        this.heroes.forEach(h => { this.giveGold(h, 100); if (d2(h.x, h.z, e.x, e.z) < 100) h.st.towns++; });
        this.msg(e.name + ' secured! +100 gold each. Upkeep ' + this.upkeepOf(e) + 'g at nightfall. Respawns and Waygates now use it.', 'gold');
      }
    } else e.cap = Math.max(0, e.cap - dt * 2);
  }
  stepEnc(e, dt) {
    if (e.used) return;
    const h = this.heroes.find(h => !h.dead && d2(h.x, h.z, e.x, e.z) < (e.sub === 'ambush' ? 7 : 3.5) ** 2);
    if (!h) return;
    if (e.sub === 'chest') {
      if (e.guards.some(id => { const g = this.byId.get(id); return g && !g.dead; })) return;
      e.used = 1; e.dead = true; this.fx('burst', e.x, e.z, 2, '#ffd36b');
      this.heroes.forEach(x => { this.giveItem(x, this.R() < 0.12 ? rollLegendary(this.R) : rollLoot(this.R, x.lvl, 1)); if (this.R() < 0.1) this.giveCard(x); });
      this.msg(h.pname + ' opened a treasure chest — loot for everyone!', 'gold');
    } else if (e.sub === 'shrine') {
      e.used = 1; const kinds = [['Shrine of Might', { ad: 20 + this.t / 30, ap: 30 + this.t / 20 }], ['Shrine of Haste', { msP: 0.25, as: 0.3 }], ['Shrine of Fortitude', { armor: 30, mr: 30, hp: 300 }]];
      const k = kinds[Math.floor(this.R() * kinds.length)];
      this.allyHeroes(e, 12).forEach(a => this.buff(a, 'shrine', 120, k[1])); this.fx('pillar', e.x, e.z, 3, '#7af0ff');
      this.msg(k[0] + ' empowers nearby heroes for 2 minutes!', 'gold');
    } else if (e.sub === 'ambush') {
      e.used = 1; e.dead = true; const m = 1 + this.t / 300;
      for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283, c = this.unitFrom(CREEPS[i < 3 ? 'bandit' : 'archer'], 'creep', 2, e.x + Math.cos(a) * 6, e.z + Math.sin(a) * 6, m * 1.2, 'c_' + (i < 3 ? 'bandit' : 'archer')); c.homeX = e.x; c.homeZ = e.z; c.leash = 16; c.aggro = 14; c.tgt = h.id; c.g *= 2; c.lootBoost = 5; }
      this.msg('Ambush! Bandits leap from hiding!', 'r');
    }
  }
  fortify(t) {
    const m = (1 + 0.3 * (this.cycle - 1)) * this.M.struct;
    t.maxhp = Math.round(4200 * m); t.hp = t.maxhp; t.armor = t.mr = 50; t.ad = 95 * (1 + 0.15 * (this.cycle - 1)); t.range = 12; t.as = 1; t.garT = 0;
    for (let i = 0; i < 2; i++) this.spawnGarrison(t);
  }
  spawnGarrison(t) {
    const m = 1 + this.mins() * 0.08, a = this.R() * 6.283;
    const g = this.mk('garrison', 0, t.x + Math.cos(a) * 4, t.z - 5 + Math.sin(a) * 2, { hp: Math.round(1000 * m), ad: 40 * m, armor: 30, mr: 25, as: 0.9, range: 2.2, ms: 320, r: 0.9, v: 'garrison', g: 0, xp: 0 });
    g.town = t.id; g.homeX = g.x; g.homeZ = g.z;
  }
  stepGarrison(e, dt) {
    const t = this.byId.get(e.town); if (!t || t.team !== 0) { e.dead = true; return; }
    e.think -= dt; let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (e.think <= 0) { e.think = 0.3; if (!tg || tg.dead || !this.canHit(e, tg) || d2(tg.x, tg.z, e.homeX, e.homeZ) > 16 * 16) { tg = this.findTarget(e, 12, x => d2(x.x, x.z, e.homeX, e.homeZ) < 16 * 16); } e.tgt = tg ? tg.id : 0; }
    if (tg && !tg.dead) { this.attackStep(e, tg, dt); return; }
    if (this.navTo(e, e.homeX, e.homeZ, dt, 0.5)) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.03 * dt);
  }
  frontTown(lane, z) { let best = null; for (const t of this.ents) if (t.kind === 'town' && t.team === 0 && t.lane === lane && t.z > z - 2 && (!best || t.z < best.z)) best = t; return best; }
  frontSpawn(lane) { let best = null; for (const t of this.ents) if (t.kind === 'town' && t.team === 0 && t.lane === lane && (!best || t.z < best.z)) best = t; return best; }
  upkeepOf(t) { return Math.round(t.upkeep * (1 + 0.3 * (this.cycle - 1))); }
  onNight() {
    this.msg('Night falls. Lanes are deadly — enemies in lanes grow far stronger. The jungle is unchanged. Town shops and Waygates are open.', 'p');
    // upkeep
    let owned = this.ents.filter(e => e.kind === 'town' && e.team === 0).sort((a, b) => b.z - a.z);
    const alive = this.heroes; let pool = alive.reduce((s, h) => s + h.gold, 0);
    let cost = owned.reduce((s, t) => s + this.upkeepOf(t), 0);
    while (owned.length && cost > pool) { const lost = owned.pop(); cost -= this.upkeepOf(lost); lost.team = 2; lost.untarget = 1; lost.guards = []; lost.inv = 0; lost.pc = '#9fd0ff'; this.msg('Could not pay upkeep for ' + lost.name + ' — it is abandoned.', 'r'); }
    if (cost > 0) {
      let remaining = cost; const share = cost / alive.length;
      alive.forEach(h => { const p = Math.min(h.gold, Math.round(share)); h.gold -= p; h.st.upkeep += p; remaining -= p; });
      alive.slice().sort((a, b) => b.gold - a.gold).forEach(h => { if (remaining > 0) { const p = Math.min(h.gold, remaining); h.gold -= p; h.st.upkeep += p; remaining -= p; } });
      this.msg('Paid ' + cost + 'g upkeep for ' + owned.length + ' town' + (owned.length > 1 ? 's' : '') + '.', 'gold');
    }
    // jungle raid
    if (this.heroes.some(h => h.lvl >= 5) && this.R() < 0.75) this.raidPlan = { at: this.t + 5 + this.R() * 25 };
    // nightstalkers patrol lanes
    for (const ln of ['L', 'M', 'R']) {
      const n = 1 + this.cycle;
      for (let i = 0; i < n; i++) {
        const P = LANES[ln], wp = P[1 + Math.floor(this.R() * (P.length - 2))];
        const s = this.unitFrom(CREEPS.stalker, 'stalker', 1, wp[0] + (this.R() - 0.5) * 6, wp[1] + (this.R() - 0.5) * 20, 1 + this.cycle * 0.35, 'stalker');
        s.lane = ln; s.px = s.x; s.pz = s.z; s.g = 60; s.xp = 90;
      }
    }
  }
  onDay() {
    this.msg('Day ' + this.cycle + ' dawns. The lanes are safer — push forward!', 'gold');
    for (const e of this.ents) if (e.kind === 'stalker') { e.dead = true; }
    for (const e of this.ents) if (e.kind === 'enc' && !e.used) e.dead = true;
    for (const t of this.ents) if (t.kind === 'town' && t.team === 2 && !t.guards.some(id => { const g = this.byId.get(id); return g && !g.dead; })) this.spawnGuards(t);
    this.buildWalls(true);
    this.rotateVault(); if (this.heroes.some(h => h.member)) this.msg('The Members\' Vault has new stock.', 'gold');
    this.spawnEncounters();
  }
  spawnGate(b, g) {
    const e = this.mk('gate', b.team, g.x, g.z, { hp: Math.round((b.team ? 6000 : 5000) * this.M.struct * (b.team ? 1 : 1 + 0.4 * (this.upg ? this.upg.walls : 0))), armor: 60, mr: 60, r: 3.4, ms: 0, v: 'gate', invuln: b.team && !this.wardenDown(g.lane) ? 1 : 0, structure: 1, g: 300, xp: 300 });
    e.lane = g.lane; e.face = g.ang + Math.PI / 2; e.gdef = g; e.base = b.team; g.cells.forEach(i => DYN[i] = 2 + b.team); return e;
  }
  wardenDown(lane) { const w = MAP.bosses.find(x => x.warden === lane); return w && !this.ents.some(o => o.kind === 'boss' && o.bid === w.id && !o.dead); }
  spawnLaneCamps() {
    this.camps2 = [];
    for (const ln of ['L', 'M', 'R']) LANE_CAMPS.forEach((cd, ti) => {
      const z = cd.z, x = laneX(ln, z), camp = { id: this.camps2.length, lane: ln, tier: ti + 1, name: CAMP_NAMES[ln][ti], x, z, ids: [], cleared: false };
      cd.troops.forEach((k, j) => {
        const a = j / cd.troops.length * 6.283 + ti, rr = k === 'lieut' ? 0 : k === 'elite' ? 2.2 : 4.2 + (j % 2) * 1.4;
        const e = this.unitFrom(MINION[k], 'guard', 1, x + Math.cos(a) * rr * 0.8, z + Math.sin(a) * rr * 0.6, cd.mult, 'me_' + k + '_' + ln);
        e.homeX = e.x; e.homeZ = e.z; e.leash = k === 'lieut' ? 22 : 16; e.aggro = 10; e.camp = camp.id; e.lane = ln; e.face = Math.PI / 2;
        if (k === 'lieut') { e.name = LIEUT_NAMES[ln]; e.skills = LIEUT_SKILLS[ln]; e.scd = {}; e.lieut = 1; }
        camp.ids.push(e.id);
      });
      this.camps2.push(camp);
    });
  }
  stepGuard(e, dt) {
    e.think -= dt;
    let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (tg && (tg.dead || !this.canHit(e, tg) || d2(tg.x, tg.z, e.homeX, e.homeZ) > (e.leash + 6) ** 2)) { tg = null; e.tgt = 0; }
    if (e.tauntU > this.t) { const t2 = this.byId.get(e.tauntId); if (t2 && !t2.dead) tg = t2; }
    if (e.think <= 0) { e.think = 0.35; if (!tg) { const n = this.findTarget(e, e.aggro, o => !o.structure); if (n) { tg = n; e.tgt = n.id; this.campAlert(e, n); } } }
    const away = d2(e.x, e.z, e.homeX, e.homeZ);
    if (!tg) { if (away > 0.5) this.navTo(e, e.homeX, e.homeZ, dt, 0.3); else e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.05 * dt); return; }
    if (away > e.leash * e.leash) { e.tgt = 0; e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.1); return; }
    if (e.lieut) this.bossSkills(e, tg);
    if (!e.casting || e.casting < this.t) this.attackStep(e, tg, dt);
  }
  campAlert(e, src) { const c = this.camps2 && this.camps2[e.camp]; if (!c) return; for (const id of c.ids) { const u = this.byId.get(id); if (u && !u.dead && !u.tgt && d2(u.x, u.z, e.x, e.z) < 400) u.tgt = src.id; } }
  campCleared(c) {
    c.cleared = true; const g = 70 * c.tier, xp = 90 * c.tier;
    this.heroes.forEach(h => { this.giveGold(h, g); this.giveXp(h, xp); });
    this.msg(c.name + ' destroyed! +' + g + ' gold each.', 'gold'); this.fx('capture', c.x, c.z, 8, '#ffd36b');
    if (c.tier === 3) this.dropLoot(c.x, c.z, this.R() < 0.35 ? rollLegendary(this.R) : rollLoot(this.R, Math.max(...this.heroes.map(h => h.lvl)), 2));
  }
  buildWalls(repair) {
    const lv = this.upg.walls, hpM = 1 + 0.4 * lv;
    for (const b of BASES) { if (b.team) continue; for (const g of b.gates) { let e = this.ents.find(o => o.kind === 'gate' && o.gdef === g && !o.dead); if (!e && repair) { e = this.spawnGate(b, g); this.msg('Masons rebuilt the ' + LANE_INFO[g.lane].name + ' gate.', 'w'); } if (e) { e.maxhp = Math.round(5000 * this.M.struct * hpM); e.armor = e.mr = 60 + 15 * lv; if (repair) e.hp = e.maxhp; } } }
    for (const t of this.ents) if (t.kind === 'tower' && t.team === 0 && !t.dead) { t.maxhp = Math.round(3000 * this.M.struct * hpM); t.armor = t.mr = 45 + 15 * lv; t.ad = 120 * (1 + 0.25 * lv); if (repair) t.hp = t.maxhp; }
  }
  _oldBuildWalls(repair) {
    const lv = this.upg.walls, hpM = 1 + 0.4 * lv, arm = 40 + 15 * lv;
    WALLS.forEach((w, i) => {
      let e = this.ents.find(o => o.kind === 'wall' && o.slot === i && !o.dead);
      if (!e) { e = this.mk('wall', 0, w[0], w[1], { hp: 2400, armor: arm, mr: arm, r: 2.6, ms: 0, v: 'wall', structure: 1, g: 0, xp: 0 }); e.slot = i; e.face = w[2]; if (repair) this.msg('Masons rebuilt a breached wall.', 'w'); }
      e.maxhp = Math.round(2400 * hpM); e.armor = e.mr = arm; if (repair) e.hp = e.maxhp;
    });
    TURRETS.forEach((t, i) => {
      let e = this.ents.find(o => o.kind === 'turret' && o.slot === i && !o.dead);
      if (!e) { e = this.mk('turret', 0, t[0], t[1], { hp: 2000, ad: 110, armor: arm, mr: arm, as: 0.9, range: 11, r: 1.5, ms: 0, v: 'turret', structure: 1, g: 0, xp: 0, pc: '#6ab0ff' }); e.slot = i; }
      e.maxhp = Math.round(2000 * hpM); e.armor = e.mr = arm; e.ad = 110 * (1 + 0.25 * lv); if (repair) e.hp = e.maxhp;
    });
  }
  buyUpgrade(h, k, fail) {
    const U = BASE_UPG[k]; if (!U) return; const lv = this.upg[k];
    if (lv >= U.c.length) return fail(U.n + ' is fully upgraded'); const cost = U.c[lv];
    if (U.cat === 'rail' && !this.railSegOk(U.lane, lv + 1)) return fail('Segment ' + (lv + 1) + ' needs ' + this.railStations(U.lane)[lv + 1].n + (lv + 1 === 3 ? ' (slay the Warden)' : ' held'));
    if (h.gold < cost) return fail('Not enough gold (' + cost + 'g)');
    h.gold -= cost; h.st.goldSpent += cost; this.upg[k]++;
    this.msg(h.pname + ' purchased ' + U.n + (U.c.length > 1 ? ' ' + this.upg[k] : '') + '!', 'gold');
    if (k === 'walls') this.buildWalls(true);
    if (k === 'sight') WARD_SPOTS[lv].forEach(p => { const w = this.mk('ward', 0, p[0], p[1], { hp: 1, r: 0.8, ms: 0, v: 'ward' }); w.untarget = 1; });
    if (k === 'heal') HEAL_SPOTS.forEach(p => { const w = this.mk('heal', 0, p[0], p[1], { hp: 1, r: 1, ms: 0, v: 'healpack' }); w.untarget = 1; w.cdU = 0; });
  }
  stepHeal(e) {
    if (e.cdU > this.t) return;
    const h = this.heroes.find(h => !h.dead && d2(h.x, h.z, e.x, e.z) < 2.5 * 2.5 && (h.hp < h.maxhp * 0.98 || h.res < h.resMax * 0.9));
    if (!h) return; e.cdU = this.t + 45;
    this.heal(h, h, h.maxhp * 0.35); if (!HEROES[h.hid].res.rage) h.res = Math.min(h.resMax, h.res + h.resMax * 0.35); this.fx('pillar', e.x, e.z, 1.6, '#6aff8a');
  }
  railStations(lane) {
    const towns = MAP.towns.filter(t => t.lane === lane).sort((a, b) => b.z - a.z);
    const P = LANES[lane]; let fx = P[0][0];
    for (let i = 0; i < P.length - 1; i++) { const A = P[i], B = P[i + 1]; const FZ = -66 * SZ; if ((A[1] - FZ) * (B[1] - FZ) <= 0) { fx = A[0] + (B[0] - A[0]) * ((FZ - A[1]) / (B[1] - A[1])); break; } }
    const warden = MAP.bosses.find(b => b.warden === lane);
    return [
      { n: 'Base', x: MAP.fountain.x, z: MAP.fountain.z, r: 18, ok: true },
      ...towns.map(t => { const e = this.ents.find(o => o.kind === 'town' && o.tid === t.id); return { n: t.name, x: t.x, z: t.z, r: 10, ok: !!e && e.team === 0, tid: t.id }; }),
      { n: 'Forward Camp', x: fx, z: -66 * SZ, r: 10, ok: !this.ents.some(o => o.kind === 'boss' && o.bid === warden.id && !o.dead) }];
  }
  railSegOk(lane, seg) { const st = this.railStations(lane)[seg]; return st && st.ok; }
  rideRail(h, lane, to, fail) {
    const lv = this.upg['rail' + lane] || 0, S = this.railStations(lane);
    if (!lv) return fail('Buy a ' + LANE_INFO[lane].name + ' rail segment first');
    if (!(to >= 0 && to <= lv)) return fail('That station is not connected yet');
    if (!S[to].ok) return fail(S[to].n + ' is not under your control');
    let from = -1; for (let i = 0; i <= lv; i++) if (S[i].ok && d2(h.x, h.z, S[i].x, S[i].z) < S[i].r * S[i].r) { from = i; break; }
    if (from < 0) return fail('Stand at a rail station on this lane');
    if (from === to) return;
    const P = LANES[lane], z0 = S[from].z, z1 = S[to].z;
    let path = P.filter(p => (p[1] < z0 - 2 && p[1] > z1 + 2) || (p[1] > z0 + 2 && p[1] < z1 - 2)).map(p => [p[0], p[1]]);
    path.sort((a, b) => z1 < z0 ? b[1] - a[1] : a[1] - b[1]);
    path.push([S[to].x + (to ? 3 : 0), S[to].z + (to ? 3 : 0)]);
    h.rail = { path, i: 0 }; h.order = null; h.pending = null; h.recall = null; this.fx('blink', h.x, h.z, 1.5, '#ffd36b');
  }
  hireMerc(h, fail) {
    if (!this.upg.merc) return fail('Build the Mercenary Guild first');
    if (d2(h.x, h.z, MAP.fountain.x, MAP.fountain.z) > 18 * 18) return fail('Hire mercenaries at the base');
    if (this.ents.filter(e => e.kind === 'merc' && !e.dead && e.owner === h.id).length >= 2) return fail('You already lead 2 mercenaries');
    if (h.gold < MERC_COST) return fail('Not enough gold'); h.gold -= MERC_COST; h.st.goldSpent += MERC_COST;
    const m = 1 + this.mins() * 0.07; const e = this.mk('merc', 0, h.x + 2, h.z + 2, { hp: Math.round(850 * m), ad: 42 * m, armor: 25 + this.mins(), mr: 20, as: 0.9, range: 2.2, ms: 330, r: 0.9, v: 'merc', g: 0, xp: 0 });
    e.owner = h.id; this.msg(h.pname + ' hired a mercenary.', 'w');
  }
  stepMerc(e, dt) {
    const o = this.byId.get(e.owner); const ok = p => !inLane(p.x, p.z);
    e.think -= dt; let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (e.think <= 0) {
      e.think = 0.3;
      if (!tg || tg.dead || !this.canHit(e, tg) || !ok(tg)) { tg = null; const ot = o && o.order && o.order.id ? this.byId.get(o.order.id) : null; if (ot && !ot.dead && this.canHit(e, ot) && ok(ot) && d2(ot.x, ot.z, e.x, e.z) < 16 * 16) tg = ot; else tg = this.findTarget(e, 8, x => ok(x) && (x.team === 1 || x.tgt === e.id || (o && x.tgt === o.id))); }
      e.tgt = tg ? tg.id : 0;
    }
    if (tg && !tg.dead) { this.attackStep(e, tg, dt); if (inLane(e.x, e.z)) { e.tgt = 0; } return; }
    if (o && !o.dead && d2(o.x, o.z, e.x, e.z) > 5 * 5) { const nx = e.x + (o.x - e.x) * 0.1, nz = e.z + (o.z - e.z) * 0.1; if (ok({ x: nx, z: nz }) || inLane(e.x, e.z)) this.navTo(e, o.x, o.z, dt, 3); }
  }
  spawnRaid() {
    const o = RAID_PTS[Math.floor(this.R() * RAID_PTS.length)];
    const n = 3 + this.cycle + this.heroes.length, m = 1 + this.cycle * 0.3;
    const pool = this.cycle < 3 ? ['wolf', 'wolf', 'troll', 'trollshaman'] : ['wolf', 'troll', 'trollshaman', 'ogre', 'rockgolem'];
    for (let i = 0; i < n; i++) {
      const k = pool[Math.floor(this.R() * pool.length)], a = this.R() * 6.283;
      const e = this.unitFrom(CREEPS[k], 'raider', 1, o[0] + Math.cos(a) * 3, o[1] + Math.sin(a) * 3, m, 'c_' + k); e.g = Math.round(e.g * 1.5); e.xp = Math.round(e.xp * 1.3);
    }
    this.msg('A jungle warband (' + n + ') is marching on the base from the ' + o[2] + '!', 'r');
  }
  stepRaider(e, dt) {
    e.think -= dt; let tg = e.tgt ? this.byId.get(e.tgt) : null;
    if (e.think <= 0) {
      e.think = 0.35;
      if (!tg || tg.dead || !this.canHit(e, tg) || tg.invuln) {
        tg = this.findTarget(e, 9, x => !x.invuln);
        if (!tg && d2(e.x, e.z, BASES[0].x, BASES[0].z) < 80 * 80) { let best = 1e9; for (const o of this.ents) { if (o.dead || o.team !== 0 || !o.structure || o.invuln || o.kind === 'town') continue; const dd = d2(o.x, o.z, e.x, e.z) - (o.kind === 'gate' ? 400 : 0); if (dd < best) { best = dd; tg = o; } } }
      }
      e.tgt = tg ? tg.id : 0;
    }
    if (tg && !tg.dead) { this.attackStep(e, tg, dt); return; }
    this.navTo(e, MAP.fountain.x, MAP.fountain.z, dt, 6);
  }
  rotateVault() { const k = Object.keys(VAULT); this.vault = []; while (this.vault.length < 4) { const x = k.splice(Math.floor(this.R() * k.length), 1)[0]; this.vault.push(x); } }
  giveCard(h) { if (h.member) { this.giveGold(h, 300); return; } h.member = true; this.msg(h.pname + ' found a Member Card! A hidden menu opens at the shop…', 'gold'); }
  spawnEncounters() {
    const spots = MAP.encSpots.slice(); const n = 4;
    for (let i = 0; i < n && spots.length; i++) {
      const sp = spots.splice(Math.floor(this.R() * spots.length), 1)[0];
      const r = this.R(), sub = r < 0.35 ? 'chest' : r < 0.6 ? 'shrine' : r < 0.8 ? 'merchant' : 'ambush';
      const e = this.mk('enc', 2, sp[0], sp[1], { hp: 1, untarget: 1, r: 1.2, v: 'e_' + sub, ms: 0 }); e.sub = sub; e.untarget = 1; e.guards = [];
      if (sub === 'chest') { const m = 1 + this.t / 400; for (let j = 0; j < 3; j++) { const a = j / 3 * 6.283, c = this.unitFrom(CREEPS[j ? 'bandit' : 'archer'], 'creep', 2, sp[0] + Math.cos(a) * 3, sp[1] + Math.sin(a) * 3, m, 'c_' + (j ? 'bandit' : 'archer')); c.homeX = c.x; c.homeZ = c.z; c.leash = 10; c.aggro = 7; e.guards.push(c.id); } }
      if (sub === 'merchant') { const lv = Math.max(1, Math.round(this.heroes.reduce((a, h) => a + h.lvl, 0) / this.heroes.length)); e.stock = [rollLoot(this.R, lv, 1), rollLoot(this.R, lv, 1), this.R() < 0.15 ? rollLegendary(this.R) : rollLoot(this.R, lv, 1)]; }
    }
  }
  spawnWave() {
    const min = this.mins();
    for (const team of [0, 1]) {
      const mult = team === 1 ? 1 + 0.075 * min + (this.eclipse ? 0.4 : 0) : (1 + 0.05 * min) * (1 + 0.2 * this.upg.drums);
      for (const ln of ['L', 'M', 'R']) {
        const kinds = ['melee', 'melee', 'melee', 'ranged', 'ranged'];
        if (team === 1 && ln === 'M') kinds.push('melee');
        if (this.waveN % 3 === 0) kinds.push('siege');
        if (team === 1 && this.eclipse) kinds.push('siege', 'melee');
        const P = LANES[ln]; let start = team === 0 ? P[0] : P[P.length - 1], wp0 = team === 0 ? 1 : P.length - 2;
        if (team === 0) { if (this.phase === 'night' && !this.eclipse) continue; const ft = this.frontSpawn(ln); if (ft) { start = [ft.x, ft.z - 14]; wp0 = P.findIndex(p => p[1] < ft.z - 14); if (wp0 < 0) wp0 = P.length - 1; } }
        kinds.forEach((k, i) => {
          const e = this.unitFrom(MINION[k], 'minion', team, start[0] + (i % 3 - 1) * 1.6, start[1] + (team ? -1 : 1) * (Math.floor(i / 3) * 1.8 + 4), mult, team ? 'me_' + k + '_' + ln : 'ma_' + k);
          e.lane = ln; e.wp = wp0; e.ox = (i % 3 - 1) * 1.2; e.structMult = MINION[k].structMult || 1;
        });
      }
    }
  }
  // ----- snapshot -----
  snapshot(full) {
    const r1 = n => Math.round(n * 10) / 10;
    const vs = [], vsrc = [];
    const sightM = 1 + 0.1 * this.upg.sight;
    for (const o of this.ents) {
      if (o.dead || o.team !== 0) continue;
      let r = 0;
      if (o.kind === 'hero') r = 15 * sightM; else if (o.kind === 'ward') r = 22; else if (o.kind === 'core') r = 18; else if (o.structure) r = 13; else if (o.kind === 'merc') r = 10; else if (o.kind === 'minion') r = 9;
      if (o.kind === 'garrison') r = 11; if (o.kind === 'town') r = 22; if (!r) continue; const L = o.kind === 'hero' || o.kind === 'ward' || o.kind === 'merc' || o.kind === 'garrison'; vsrc.push([o.x, o.z, r * r, L]); if (o.kind !== 'minion') vs.push([r1(o.x), r1(o.z), Math.round(r), L ? 1 : 0]);
    }
    const seen = o => { for (const v of vsrc) if (d2(o.x, o.z, v[0], v[1]) < v[2] && (!v[3] || los(v[0], v[1], o.x, o.z))) return true; return false; };
    this.seenFn = seen;
    const e = [];
    for (const o of this.ents) {
      if (o.dead) continue;
      if (o.team !== 0 && !o.structure && o.kind !== 'boss' && !seen(o)) continue;
      let f = 0; if (o.stunU > this.t) f |= 1; if (o.nightFury) f |= 2; if (o.invuln) f |= 4; if (o.untarget) f |= 8; if (o.walkT > 0) f |= 16; if (o.atkAnim && this.t - o.atkAnim < 0.25) f |= 32; if (o.slowU > this.t) f |= 64; if (o.enraged) f |= 128; if (o.cdU > this.t) f |= 256; if (o.dash) f |= 512; if (o.rail) f |= 1024;
      e.push([o.id, o.v, o.team, r1(o.x), r1(o.z), Math.round(o.hp), Math.round(o.maxhp), Math.round(o.face * 100) / 100, f]);
    }
    const H = this.heroes.map(h => ({
      id: h.id, pid: h.pid, n: h.pname, hid: h.hid, lvl: h.lvl, xp: Math.round(h.xp), xn: xpNext(h.lvl), g: Math.floor(h.gold), hp: Math.round(h.hp), mhp: h.maxhp, res: Math.round(h.res), mres: Math.round(h.resMax),
      cd: h.cds.map(c => Math.round(c * 10) / 10), rk: h.ranks, pts: h.pts, attr: h.attr, it: h.items, dead: h.dead, rt: Math.ceil(h.respawnT), pots: h.pots,
      sv: h.statView, rc: h.recall ? [h.recall.dest, Math.round((h.recall.at - this.t) * 10) / 10, h.recall.total] : null, bf: h.buffs.map(b => [b.id, Math.ceil(b.until - this.t)]), st: (full || this.over) ? h.st : undefined,
      shop: this.shopAccess(h), mem: h.member, x: r1(h.x), z: r1(h.z), ac: [Math.max(0, Math.round(h.atkCd * 100) / 100), Math.round(100 / h.as) / 100], tw: h.townWard, tg: h.order && h.order.id ? h.order.id : 0, rail: !!h.rail
    }));
    const towns = this.ents.filter(o => o.kind === 'town').map(o => ({ id: o.id, tid: o.tid, n: o.name, team: o.team, cap: Math.round(o.cap * 10) / 10, up: this.upkeepOf(o), inv: o.inv, guards: o.guards.filter(id => { const g = this.byId.get(id); return g && !g.dead; }).length, mine: o.mine, x: o.x, z: o.z }));
    const encs = this.ents.filter(o => o.kind === 'enc' && !o.dead && !o.used && seen(o)).map(o => ({ id: o.id, sub: o.sub, x: o.x, z: o.z, stock: o.stock || null }));
    const s = {
      t: Math.round(this.t * 100) / 100, md: [this.mode, this.M.day, this.cyc, this.M.eclipse], vault: this.vault, ph: this.phase, cy: this.cycle, ec: this.eclipse, so: this.secretOpen, e, h: H, towns, encs,
      p: this.projs.map(p => [p.id, r1(p.x), r1(p.z), p.col, p.size, p.st || 'o']),
      z: this.zones.map(z => [r1(z.x), r1(z.z), z.r, Math.round((this.t - z.s) / (z.e - z.s) * 100) / 100, z.k]),
      fx: this.fxq, m: this.msgq, over: this.over, vs, upg: this.upg, rails: ['L', 'M', 'R'].map(l => this.railStations(l).map(st => [st.n, r1(st.x), r1(st.z), st.ok ? 1 : 0, st.r]))
    };
    this.fxq = []; this.msgq = [];
    return s;
  }
}
const API = { BASES, DYN, GATE_HALF, blockedT, LANE_CAMPS, CAMP_NAMES, LIEUT_NAMES, laneOf, laneDistK, laneX, TER, blocked, los, RIVER, SX, SZ, RAID_PTS, WARD_SPOTS, MODES, BASE_UPG, MERC_COST, HEAL_SPOTS, VAULT, LEGENDARIES, MYTHICS, rollLegendary, rollMythic, makeProc, VERSION, TOWN_BUFFS, TIER_DRAIN, Sim, HEROES, HERO_IDS, ITEMS, MAP, LANES, LANE_INFO, STAT_NAMES, PCT, RARITY, POTION_COST, DAY, NIGHT, CYC, ECLIPSE_T, DT, xpNext, laneDist, rollLoot, mulberry32 };
if (typeof module !== 'undefined') module.exports = API; else G.DW = API;
})(typeof window !== 'undefined' ? window : globalThis);
