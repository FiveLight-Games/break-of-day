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
  const at = d => { const f = Math.max(0, Math.min(LUT.length - 1.001, d / 4)), i = f | 0, t = f - i, A = LUT[i], B = LUT[i + 1]; let da = B[2] - A[2]; da = Math.atan2(Math.sin(da), Math.cos(da)); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + da * t]; };
  const dist = (px, py) => { let m = 1e9; for (const s of seg) { const vx = s.b[0] - s.a[0], vy = s.b[1] - s.a[1], t = Math.max(0, Math.min(1, ((px - s.a[0]) * vx + (py - s.a[1]) * vy) / (s.l * s.l))); m = Math.min(m, Math.hypot(px - s.a[0] - vx * t, py - s.a[1] - vy * t)); } return m; };
  return { P, seg, total, at, dist, gate: C[0] };
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
  archer: { n: 'Archer Post', cost: 60, r: 190, cd: 0.5, dmg: 26, dt: 'phys', d: 'Two archers in a wooden watchtower. Fast single-target arrows.' },
  cannon: { n: 'Bombard', cost: 100, r: 175, cd: 1.6, dmg: 52, splash: 46, dt: 'blast', d: 'A heavy gun on a stone column. Shells hit everything nearby.' },
  frost: { n: 'Frost Obelisk', cost: 90, r: 160, cd: 1.0, dmg: 30, slow: 1.6, dt: 'ice', d: 'An ice shard that chills its target, slowing it by half.' },
  flame: { n: 'Fire Brazier', cost: 120, r: 165, dps: 62, dt: 'fire', d: 'A burning beam from a raised fire bowl. Melts one target.' },
  storm: { n: 'Tesla Coil', cost: 140, r: 175, cd: 1.3, dmg: 40, chain: 5, dt: 'shock', d: 'Lightning that arcs to up to 5 enemies.' },
};
const TOWER_IDS = Object.keys(TOWERS);
const UNITS = {
  grunt: { n: 'Footman', hp: 150, sp: 46, r: 5.5, cost: 3, bounty: 1, dmg: 3, d: 'Cheap and sturdy. 3 damage to the base.' },
  runner: { n: 'Scout', hp: 85, sp: 70, r: 4.5, cost: 3, bounty: 1, dmg: 1, d: 'Fast and fragile. 1 damage to the base.' },
  brute: { n: 'Ogre', hp: 650, sp: 40, r: 8.5, cost: 12, bounty: 4, dmg: 12, d: 'Huge and slow. 12 damage to the base.' },
};
const UNIT_IDS = Object.keys(UNITS);
// gold is per second; kill gold is shared: every defender gets bounty / number of defenders
const RULES = { pulse: 15, length: 20 * 60, hpPer: 250, buildTime: 3, defGold: 230, defIncome: 1, atkGoldPer: 60, atkIncomePer: 2, atkGrowth: 0.2, investCost: 80, investGain: 0.8, speedCost: 90, speedStep: 0.1, speedMax: 5, sell: 0.7, hpPerMin: 0.05 };
const PRIORITIES = ['first', 'last', 'strong', 'close'];

// ---------------- simulation ----------------
class Sim {
  constructor(o) {
    this.R = mulberry32(o.seed || 1);
    const defs = o.players.filter(p => p.role === 'def'), atk = o.players.find(p => p.role === 'atk');
    this.N = defs.length; this.L = layout(o.map, this.N); this.map = this.L.map;
    this.t = 0; this.tick = 0; this.nid = 1; this.over = null; this.events = []; this.towerVer = 1; this.hpMax = RULES.hpPer * this.N; this.hp = this.hpMax; this.closed = false;
    this.players = {};
    this.atk = { pid: atk.pid, name: atk.name, color: atk.color, race: atk.race, bot: !!atk.bot, gold: RULES.atkGoldPer * this.N, income: RULES.atkIncomePer * this.N, invest: 0, speed: 0, queue: [], sent: 0, leaked: 0, spent: 0, dmg: 0 };
    this.players[atk.pid] = this.atk;
    this.defs = defs.map((p, i) => { const d = { pid: p.pid, name: p.name, color: p.color, race: p.race, bot: !!p.bot, slot: i, gold: RULES.defGold, income: RULES.defIncome, kills: 0, built: 0, dmg: 0, shared: 0 }; this.players[p.pid] = d; return d; });
    this.units = []; this.towers = []; this.pulseT = RULES.pulse; this.wave = 0; this.spawnAt = []; this.pending = [];
    this.occ = new Uint8Array(this.L.cols * this.L.rows); this.grid = new Map();
  }
  // ---- inputs ----
  input(pid, c) {
    const P = this.players[pid]; if (!P || this.over) return;
    if (P === this.atk) {
      if (this.closed) return;
      if (c.c === 'send') { const U = UNITS[c.k]; if (!U) return; const lanes = c.lane === 'all' ? this.defs.map(d => d.slot) : [this.defs[c.lane]].filter(Boolean).map(d => d.slot); const n = Math.max(1, Math.min(10, c.n | 0 || 1)), cost = U.cost * lanes.length * n; if (!lanes.length || P.gold < cost) return; P.gold -= cost; P.spent += cost; for (const l of lanes) for (let i = 0; i < n; i++) P.queue.push([c.k, l]); }
      else if (c.c === 'speed') { if (P !== this.atk || this.closed || P.speed >= RULES.speedMax) return; const cost = this.speedCost(); if (P.gold < cost) return; P.gold -= cost; P.spent += cost; P.speed++; }
      else if (c.c === 'invest') { const cost = this.investCost(); if (P.gold < cost) return; P.gold -= cost; P.spent += cost; P.invest++; P.income += RULES.investGain * this.N; }
      return;
    }
    if (c.c === 'build') {
      const T = TOWERS[c.k], cc = c.c2 | 0, r = c.r | 0; if (!T || P.gold < T.cost || !footFree(this.L, cc, r, this.occ)) return;
      P.gold -= T.cost; P.built++;
      const t = { id: this.nid++, owner: pid, slot: P.slot, k: c.k, c: cc, r, x: (cc + FOOT / 2) * CELL, y: (r + FOOT / 2) * CELL, cd: 0, aim: Math.PI / 2, prio: 'first', spent: T.cost, kills: 0, ready: this.t + RULES.buildTime };
      this.towers.push(t); this.mark(t, 1); this.towerVer++;
    }
    else if (c.c === 'sell') { const i = this.towers.findIndex(t => t.id === c.id && t.owner === pid); if (i < 0) return; const t = this.towers[i]; P.gold += Math.floor(t.spent * RULES.sell); this.towers.splice(i, 1); this.mark(t, 0); this.towerVer++; this.ev(['sl', t.x, t.y]); }
    else if (c.c === 'prio') { const t = this.towers.find(t => t.id === c.id && t.owner === pid); if (t && PRIORITIES.includes(c.p)) { t.prio = c.p; this.towerVer++; } }
  }
  mark(t, v) { for (let j = 0; j < FOOT; j++) for (let i = 0; i < FOOT; i++) this.occ[(t.r + j) * this.L.cols + t.c + i] = v; }
  speedCost() { return Math.round(RULES.speedCost * this.N * Math.pow(1.6, this.atk.speed)); }
  investCost() { return Math.round(RULES.investCost * this.N * Math.pow(1.3, this.atk.invest)); }
  ev(e) { this.events.push(e); }
  mins() { return this.t / 60; }
  // ---- step ----
  step(dt) {
    if (this.over) return; this.t += dt; this.tick++;
    // steady income every second
    const per = dt; this.atk.gold += this.atk.income * per; if (!this.closed) this.atk.income += RULES.atkGrowth * this.N * per / RULES.pulse; for (const d of this.defs) d.gold += d.income * per;
    // after the time limit the attacker can't send any more; the match ends when the field is clear
    if (!this.closed && this.t >= RULES.length) { this.closed = true; this.atk.queue = []; this.ev(['closed']); }
    if (!this.closed) {
      this.pulseT -= dt;
      if (this.pulseT <= 0) {
        this.pulseT = Math.max(this.pulseT + RULES.pulse, 0.05); this.wave++;
        const q = this.atk.queue; this.atk.queue = []; this.atk.sent += q.length;
        const perLane = {}; q.forEach(([k, l]) => { perLane[l] = (perLane[l] || 0) + 1; this.spawnAt.push({ at: this.t + Math.min(10, perLane[l] * 0.1), k, l }); });
        this.ev(['w', this.wave, q.length]);
      }
    }
    if (this.spawnAt.length) { const due = this.spawnAt.filter(s => s.at <= this.t); if (due.length) { this.spawnAt = this.spawnAt.filter(s => s.at > this.t); due.forEach(s => this.spawn(s.k, s.l)); } }
    // units walk their lane into the shared base
    for (const u of this.units) {
      const lane = this.L.lanes[u.l]; u.d += u.sp * (u.slowU > this.t ? 0.5 : 1) * dt; u.burn = Math.max(0, u.burn - dt);
      if (u.d >= lane.total) { u.dead = 1; const dmg = UNITS[u.k].dmg; this.hp = Math.max(0, this.hp - dmg); this.atk.leaked++; this.atk.dmg += dmg; this.ev(['lk', u.id, dmg]); continue; }
      const p = lane.at(u.d); u.x = p[0] + Math.cos(p[2] + Math.PI / 2) * u.off; u.y = p[1] + Math.sin(p[2] + Math.PI / 2) * u.off;
    }
    this.units = this.units.filter(u => !u.dead);
    const GR = 120, grid = this.grid; grid.clear();
    for (const u of this.units) { const key = (u.x / GR | 0) * 4096 + Math.max(0, u.y / GR | 0); let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(u); }
    const near = (px, py, r, fn) => { const x0 = Math.max(0, (px - r) / GR | 0), x1 = (px + r) / GR | 0, y0 = Math.max(0, (py - r) / GR | 0), y1 = (py + r) / GR | 0; for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const b = grid.get(gx * 4096 + gy); if (b) for (const u of b) if (u.hp > 0 && (u.x - px) ** 2 + (u.y - py) ** 2 < r * r) fn(u); } };
    this.beams = [];
    for (const t of this.towers) {
      if (t.ready > this.t) continue;
      const T = TOWERS[t.k]; t.cd -= dt;
      let best = null, score = -Infinity;
      near(t.x, t.y, T.r, u => { const s = t.prio === 'first' ? u.d / this.L.lanes[u.l].total : t.prio === 'last' ? -u.d : t.prio === 'strong' ? u.hp : -((u.x - t.x) ** 2 + (u.y - t.y) ** 2); if (s > score) { score = s; best = u; } });
      if (!best) continue;
      t.aim = Math.atan2(best.y - t.y, best.x - t.x);
      if (T.dps) { this.beams.push(t.id, best.id); best.burn = 0.3; this.hurt(best, T.dps * dt, 'fire', t); continue; }
      if (t.cd > 0) continue; t.cd = T.cd;
      if (T.chain) {
        const hit = [best]; let cur = best;
        for (let i = 1; i < T.chain; i++) { let nb = null, nd = 1e9; near(cur.x, cur.y, 70, u => { if (hit.includes(u)) return; const d = (u.x - cur.x) ** 2 + (u.y - cur.y) ** 2; if (d < nd) { nd = d; nb = u; } }); if (!nb) break; hit.push(nb); cur = nb; }
        this.ev(['z', t.id, hit.map(u => u.id)]); hit.forEach(u => this.hurt(u, T.dmg, 'shock', t)); continue;
      }
      const fly = Math.hypot(best.x - t.x, best.y - t.y) / (t.k === 'cannon' ? 340 : t.k === 'archer' ? 560 : 420);
      this.ev(['s', t.id, best.id, Math.round(fly * 100)]);
      this.pending.push({ at: this.t + fly, t, u: best, x: best.x, y: best.y });
    }
    if (this.pending.length) {
      const due = this.pending.filter(p => p.at <= this.t); this.pending = this.pending.filter(p => p.at > this.t);
      for (const p of due) { const T = TOWERS[p.t.k], x = p.u.hp > 0 ? p.u.x : p.x, y = p.u.hp > 0 ? p.u.y : p.y; if (T.splash) near(x, y, T.splash, u => this.hurt(u, T.dmg, 'blast', p.t, x, y)); else if (p.u.hp > 0) { if (T.slow) p.u.slowU = this.t + T.slow; this.hurt(p.u, T.dmg, T.dt, p.t); } }
    }
    this.units = this.units.filter(u => u.hp > 0);
    if (this.hp <= 0) this.finish('atk');
    else if (this.closed && !this.units.length && !this.spawnAt.length) this.finish('def');
    if (this.atk.bot) this.botAttack(); for (const d of this.defs) if (d.bot) this.botDefend(d);
  }
  spawn(k, l) {
    const U = UNITS[k]; if (!this.L.lanes[l]) return;
    const hp = Math.round(U.hp * (1 + RULES.hpPerMin * this.mins()));
    const u = { id: this.nid++, k, l, d: -10 - this.R() * 20, off: Math.round(rr(this.R, -LANE + 10, LANE - 10)), sp: Math.round(U.sp * (1 + RULES.speedStep * this.atk.speed) * rr(this.R, 0.92, 1.08)), hp, max: hp, slowU: 0, burn: 0, x: 0, y: 0 };
    this.units.push(u); this.ev(['u', u.id, UNIT_IDS.indexOf(k), l, u.off, u.sp, Math.round(u.d)]);
  }
  hurt(u, amt, type, t, sx, sy) {
    if (u.hp <= 0) return;
    u.hp -= amt; const D = this.players[t.owner]; if (D) D.dmg += amt;
    if (u.hp <= 0) {
      u.hp = 0; t.kills++; if (D) D.kills++;
      const share = UNITS[u.k].bounty / this.N; for (const d of this.defs) { d.gold += share; d.shared += share; }
      this.ev(['d', u.id, type, Math.round(sx !== undefined ? sx : t.x), Math.round(sy !== undefined ? sy : t.y)]);
    }
  }
  finish(w) { this.over = { winner: w, t: this.t }; this.ev(['over', w]); }
  // ---- bots ----
  botAttack() {
    if (this.tick % 20 || this.closed) return; const A = this.atk;
    // upgrades on a schedule; save up for one that's due (but keep sending if it's far off)
    const wantSpd = A.speed < RULES.speedMax && A.speed < Math.floor(this.mins() / 3), wantInv = A.invest < this.mins() * 0.9 && this.mins() < 14;
    if (wantSpd && A.gold >= this.speedCost()) this.input(A.pid, { c: 'speed' });
    if (wantInv && A.gold >= this.investCost()) this.input(A.pid, { c: 'invest' });
    const need = wantSpd ? this.speedCost() : wantInv ? this.investCost() : 0;
    if (need && A.gold < need && A.gold + A.income * 25 >= need) return;
    const lanes = this.defs.length;
    let guard = 40; while (guard-- > 0) { const k = this.R() < 0.55 ? 'grunt' : this.R() < 0.75 ? 'runner' : 'brute'; const cost = UNITS[k].cost * lanes; if (A.gold < cost + A.income * 3) break; this.input(A.pid, { c: 'send', k, lane: 'all' }); }
  }
  botDefend(D) {
    if ((this.tick + D.slot * 5) % 20) return;
    const lane = this.L.lanes[D.slot];
    if (!this.botSpots) this.botSpots = {};
    if (!this.botSpots[D.slot]) { const s = []; for (let r = 0; r < this.L.rows; r += 2) for (let c = 0; c < this.L.cols; c += 2) { const x = (c + 1) * CELL, y = (r + 1) * CELL, d = lane.dist(x, y); if (d > LANE + 90 || d < LANE + 10) continue; let cov = 0; for (let q = 0; q < lane.total; q += 40) { const p = lane.at(q); if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < 175 * 175) cov++; } s.push([c, r, cov - y * 0.002]); } s.sort((a, b) => b[2] - a[2]); this.botSpots[D.slot] = s; }
    const mine = this.towers.filter(t => t.owner === D.pid), mix = ['archer', 'archer', 'cannon', 'frost', 'archer', 'flame', 'storm', 'cannon'], k = mix[mine.length % mix.length];
    if (D.gold < TOWERS[k].cost) return;
    const spot = this.botSpots[D.slot].find(([c, r]) => footFree(this.L, c, r, this.occ)); if (spot) this.input(D.pid, { c: 'build', k, c2: spot[0], r: spot[1] });
  }
  // ---- network snapshot (compact) ----
  snapshot(full) {
    const s = { t: Math.round(this.t * 100) / 100, pu: Math.round(this.pulseT * 10) / 10, wv: this.wave, hp: this.hp, cl: this.closed ? 1 : 0,
      a: [Math.floor(this.atk.gold), Math.round(this.atk.income * 10) / 10, this.atk.invest, this.investCost(), this.atk.queue.map(q => UNIT_IDS.indexOf(q[0]) * 10 + q[1]), this.atk.speed, this.speedCost()],
      df: this.defs.map(d => [Math.floor(d.gold), Math.round(d.income * 10) / 10, d.kills]),
      u: [], bm: this.beams || [], ev: this.events, over: this.over };
    for (const u of this.units) s.u.push(u.id, Math.round(u.d * 10) / 10, Math.round(u.hp / u.max * 100), (u.slowU > this.t ? 1 : 0) | (u.burn > 0 ? 2 : 0));
    if (full || this.sentTowerVer !== this.towerVer || this.towers.some(t => t.ready > this.t)) { s.tw = this.towers.map(t => [t.id, t.slot, TOWER_IDS.indexOf(t.k), t.c, t.r, PRIORITIES.indexOf(t.prio), t.kills, t.spent, Math.max(0, Math.round((t.ready - this.t) * 100))]); s.tv = this.towerVer; this.sentTowerVer = this.towerVer; }
    if (full) { s.full = 1; s.units = this.units.map(u => [u.id, UNIT_IDS.indexOf(u.k), u.l, u.off, u.sp, Math.round(u.d)]); }
    if (full || this.over) s.stats = this.stats();
    this.events = [];
    return s;
  }
  stats() { return { hp: this.hp, atk: { sent: this.atk.sent, leaked: this.atk.leaked, dmg: this.atk.dmg, spent: this.atk.spent, invest: this.atk.invest, speed: this.atk.speed }, defs: this.defs.map(d => ({ kills: d.kills, built: d.built, dmg: Math.round(d.dmg), shared: Math.round(d.shared) })) }; }
}

const API = { COLORS, RACES, MAPS, LANE, CELL, FOOT, STAGE_H, MAX_DEF, TOWERS, TOWER_IDS, UNITS, UNIT_IDS, RULES, PRIORITIES, Sim, layout, footFree, mulberry32 };
if (typeof module !== 'undefined') module.exports = API; else G.TD = API;
})(typeof window !== 'undefined' ? window : globalThis);
