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

// ---------------- maps (pre-made; every defender gets an identical lane for fairness) ----------------
const LANE = 50; // half-width of a lane
const MAPS = [
  { id: 'greenvale', n: 'Greenvale', d: 'Winding forest roads. Every defender holds an identical lane.', on: true, theme: 'forest',
    region: { w: 1300, h: 1900 },
    path: [[650, -150], [650, 80], [430, 240], [250, 470], [360, 700], [800, 760], [1030, 960], [900, 1210], [470, 1270], [290, 1470], [440, 1690], [650, 1770], [650, 1880]] },
  { id: 'redrock', n: 'Redrock Pass', d: 'Coming soon', on: false },
  { id: 'frostfen', n: 'Frostfen', d: 'Coming soon', on: false }];
const STAGE_H = 360; // attacker staging ground above the lanes

function buildLane(map) {
  const C = map.path, P = [];
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
  // build pads: two rows along both sides of the lane
  const W = map.region.w, H = map.region.h, pads = [];
  for (let d = 120; d < total - 160; d += 48) {
    const [px, py, a] = at(d);
    for (const side of [-1, 1]) for (const off of [LANE + 44, LANE + 124]) {
      const x = px + Math.cos(a + Math.PI / 2) * side * off, y = py + Math.sin(a + Math.PI / 2) * side * off;
      if (x < 40 || y < 30 || x > W - 40 || y > H - 120) continue;
      if (dist(x, y) < LANE + 34) continue;
      if (pads.some(p => Math.hypot(p.x - x, p.y - y) < 74)) continue;
      pads.push({ x: Math.round(x), y: Math.round(y) });
    }
  }
  pads.forEach((p, i) => p.id = i);
  return { P, seg, total, at, dist, pads, castle: { x: C[C.length - 1][0], y: H - 70 }, gate: { x: C[0][0], y: 0 } };
}
const LANES = {}; for (const m of MAPS) if (m.on) LANES[m.id] = buildLane(m);
function worldOf(mapId, nDef) { const m = MAPS.find(x => x.id === mapId) || MAPS[0]; return { W: m.region.w * nDef, H: m.region.h, top: -STAGE_H, rw: m.region.w }; }

// ---------------- Human race ----------------
const TOWERS = {
  archer: { n: 'Archer Tower', cost: 60, r: 190, cd: 0.5, dmg: 26, dt: 'phys', d: 'Fast single-target arrows.' },
  cannon: { n: 'Cannon', cost: 100, r: 175, cd: 1.6, dmg: 52, splash: 46, dt: 'blast', d: 'Slow shells that hit everything nearby.' },
  frost: { n: 'Frost Spire', cost: 90, r: 160, cd: 1.0, dmg: 30, slow: 1.6, dt: 'ice', d: 'Chills its target, slowing it by half.' },
  flame: { n: 'Flame Brazier', cost: 120, r: 165, dps: 62, dt: 'fire', d: 'A burning beam that melts one target.' },
  storm: { n: 'Storm Spire', cost: 140, r: 175, cd: 1.3, dmg: 40, chain: 5, dt: 'shock', d: 'Lightning that arcs to up to 5 enemies.' },
};
const TOWER_IDS = Object.keys(TOWERS);
const UNITS = {
  grunt: { n: 'Footman', hp: 150, sp: 60, r: 5.5, cost: 3, bounty: 1, leak: 1, d: 'Cheap and sturdy.' },
  runner: { n: 'Scout', hp: 85, sp: 105, r: 4.5, cost: 3, bounty: 1, leak: 1, d: 'Fast and fragile.' },
  brute: { n: 'Ogre', hp: 650, sp: 40, r: 8.5, cost: 12, bounty: 4, leak: 3, d: 'Huge, slow, costs 3 lives on a leak.' },
};
const UNIT_IDS = Object.keys(UNITS);
const RULES = { pulse: 15, length: 20 * 60, lives: 25, defGold: 230, defIncome: 14, atkGoldPer: 60, atkIncomePer: 30, atkGrowth: 3, investCost: 80, investGain: 12, sell: 0.7, hpPerMin: 0.05 };
const PRIORITIES = ['first', 'last', 'strong', 'close'];

// ---------------- simulation ----------------
class Sim {
  constructor(o) {
    this.R = mulberry32(o.seed || 1); this.map = MAPS.find(m => m.id === o.map && m.on) || MAPS[0]; this.lane = LANES[this.map.id];
    this.t = 0; this.tick = 0; this.nid = 1; this.over = null; this.events = []; this.towerVer = 1;
    const defs = o.players.filter(p => p.role === 'def'), atk = o.players.find(p => p.role === 'atk');
    this.N = defs.length; this.world = worldOf(this.map.id, this.N);
    this.players = {};
    this.atk = { pid: atk.pid, name: atk.name, color: atk.color, race: atk.race, bot: !!atk.bot, gold: RULES.atkGoldPer * this.N, income: RULES.atkIncomePer * this.N, invest: 0, queue: [], sent: 0, leaked: 0, spent: 0 };
    this.players[atk.pid] = this.atk;
    this.defs = defs.map((p, i) => { const d = { pid: p.pid, name: p.name, color: p.color, race: p.race, bot: !!p.bot, slot: i, ox: i * this.world.rw, gold: RULES.defGold, income: RULES.defIncome, lives: RULES.lives, alive: true, kills: 0, leaks: 0, built: 0, dmg: 0 }; this.players[p.pid] = d; return d; });
    this.units = []; this.towers = []; this.pulseT = RULES.pulse; this.wave = 0; this.votes = new Set();
    this.grid = new Map();
  }
  // ---- inputs from players ----
  input(pid, c) {
    const P = this.players[pid]; if (!P || this.over) return;
    if (c.c === 'vote') { if (P.bot || (P !== this.atk && !P.alive)) return; if (this.votes.has(pid)) this.votes.delete(pid); else this.votes.add(pid); return; }
    if (P === this.atk) {
      if (c.c === 'send') { const U = UNITS[c.k]; if (!U) return; const lanes = c.lane === 'all' ? this.defs.filter(d => d.alive).map(d => d.slot) : [this.defs[c.lane]].filter(d => d && d.alive).map(d => d.slot); const n = Math.max(1, Math.min(10, c.n | 0 || 1)), cost = U.cost * lanes.length * n; if (!lanes.length || P.gold < cost) return; P.gold -= cost; P.spent += cost; for (const l of lanes) for (let i = 0; i < n; i++) P.queue.push([c.k, l]); }
      else if (c.c === 'unqueue') { const i = P.queue.findIndex(q => q[0] === c.k); if (i >= 0) { P.gold += UNITS[c.k].cost; P.spent -= UNITS[c.k].cost; P.queue.splice(i, 1); } }
      else if (c.c === 'invest') { const cost = this.investCost(); if (P.gold < cost) return; P.gold -= cost; P.spent += cost; P.invest++; P.income += RULES.investGain * this.N; }
      return;
    }
    if (!P.alive) return;
    if (c.c === 'build') { const T = TOWERS[c.k], pad = this.lane.pads[c.pad]; if (!T || !pad || P.gold < T.cost || this.towers.some(t => t.owner === pid && t.pad === c.pad)) return; P.gold -= T.cost; P.built++; this.towers.push({ id: this.nid++, owner: pid, slot: P.slot, k: c.k, pad: c.pad, x: pad.x + P.ox, y: pad.y, cd: 0.3, aim: Math.PI / 2, prio: 'first', spent: T.cost, kills: 0 }); this.towerVer++; this.ev(['b', P.slot, c.pad]); }
    else if (c.c === 'sell') { const i = this.towers.findIndex(t => t.id === c.id && t.owner === pid); if (i < 0) return; const t = this.towers[i]; P.gold += Math.floor(t.spent * RULES.sell); this.towers.splice(i, 1); this.towerVer++; this.ev(['sl', t.x, t.y]); }
    else if (c.c === 'prio') { const t = this.towers.find(t => t.id === c.id && t.owner === pid); if (t && PRIORITIES.includes(c.p)) { t.prio = c.p; this.towerVer++; } }
  }
  voters() { return [this.atk, ...this.defs].filter(p => !p.bot && (p === this.atk || p.alive)); }
  earlyBonus(p) { return Math.round(p.income * 0.5 * Math.max(0, this.pulseT) / RULES.pulse); }
  investCost() { return Math.round(RULES.investCost * this.N * Math.pow(1.3, this.atk.invest)); }
  ev(e) { this.events.push(e); }
  mins() { return this.t / 60; }
  // ---- step ----
  step(dt) {
    if (this.over) return; this.t += dt; this.tick++;
    // early start: once every human still playing has voted, the wave goes now and voters get gold for the time skipped
    const voters = this.voters();
    if (voters.length && voters.every(p => this.votes.has(p.pid)) && this.pulseT > 0.5) {
      const frac = this.pulseT / RULES.pulse;
      for (const p of voters) { const b = Math.round(p.income * 0.5 * frac); p.gold += b; p.early = (p.early || 0) + b; }
      this.ev(['early', Math.round(this.pulseT)]); this.pulseT = 0;
    }
    // pulse: income for everyone, the attacker's queued wave marches
    this.pulseT -= dt;
    if (this.pulseT <= 0) {
      this.pulseT = Math.max(this.pulseT + RULES.pulse, 0.05); this.wave++; this.votes.clear();
      this.atk.gold += this.atk.income; this.atk.income += RULES.atkGrowth * this.N; for (const d of this.defs) if (d.alive) d.gold += d.income;
      const q = this.atk.queue; this.atk.queue = []; this.atk.sent += q.length;
      const per = {}; q.forEach(([k, l]) => { per[l] = (per[l] || 0) + 1; const j = per[l]; this.spawnAt = this.spawnAt || []; this.spawnAt.push({ at: this.t + Math.min(10, j * 0.1), k, l }); });
      this.ev(['w', this.wave, q.length]);
    }
    if (this.spawnAt && this.spawnAt.length) { const due = this.spawnAt.filter(s => s.at <= this.t); if (due.length) { this.spawnAt = this.spawnAt.filter(s => s.at > this.t); due.forEach(s => this.spawn(s.k, s.l)); } }
    // units walk their defender's lane
    const L = this.lane;
    for (const u of this.units) {
      u.d += u.sp * (u.slowU > this.t ? 0.5 : 1) * dt; u.burn = Math.max(0, u.burn - dt);
      if (u.d >= L.total) { u.dead = 1; const D = this.defs[u.l]; if (D.alive) { D.lives -= UNITS[u.k].leak; D.leaks++; this.atk.leaked++; this.ev(['lk', u.id, D.slot, UNITS[u.k].leak]); if (D.lives <= 0) { D.lives = 0; D.alive = false; this.ev(['out', D.slot]); for (const v of this.units) if (v.l === D.slot) v.dead = 1; } } continue; }
      const p = L.at(u.d); u.x = p[0] + Math.cos(p[2] + Math.PI / 2) * u.off + this.defs[u.l].ox; u.y = p[1] + Math.sin(p[2] + Math.PI / 2) * u.off;
    }
    this.units = this.units.filter(u => !u.dead);
    // spatial grid for targeting
    const GR = 120, grid = this.grid; grid.clear();
    for (const u of this.units) { const key = (u.x / GR | 0) * 4096 + (u.y / GR | 0); let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(u); }
    const near = (px, py, r, fn) => { const x0 = (px - r) / GR | 0, x1 = (px + r) / GR | 0, y0 = Math.max(0, (py - r) / GR | 0), y1 = (py + r) / GR | 0; for (let gx = Math.max(0, x0); gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const b = grid.get(gx * 4096 + gy); if (b) for (const u of b) if (u.hp > 0 && (u.x - px) ** 2 + (u.y - py) ** 2 < r * r) fn(u); } };
    this.beams = [];
    for (const t of this.towers) {
      const T = TOWERS[t.k]; t.cd -= dt;
      let best = null, score = -Infinity;
      near(t.x, t.y, T.r, u => { const s = t.prio === 'first' ? u.d : t.prio === 'last' ? -u.d : t.prio === 'strong' ? u.hp : -((u.x - t.x) ** 2 + (u.y - t.y) ** 2); if (s > score) { score = s; best = u; } });
      if (!best) continue;
      t.aim = Math.atan2(best.y - t.y, best.x - t.x);
      if (T.dps) { this.beams.push(t.id, best.id); best.burn = 0.3; this.hurt(best, T.dps * dt, 'fire', t); continue; }
      if (t.cd > 0) continue; t.cd = T.cd;
      if (T.chain) {
        const hit = [best]; let cur = best;
        for (let i = 1; i < T.chain; i++) { let nb = null, nd = 1e9; near(cur.x, cur.y, 70, u => { if (hit.includes(u)) return; const d = (u.x - cur.x) ** 2 + (u.y - cur.y) ** 2; if (d < nd) { nd = d; nb = u; } }); if (!nb) break; hit.push(nb); cur = nb; }
        this.ev(['z', t.id, hit.map(u => u.id)]); hit.forEach(u => this.hurt(u, T.dmg, 'shock', t)); continue;
      }
      // projectiles are cosmetic on screens; the host resolves the hit when the shell would land
      const dist = Math.hypot(best.x - t.x, best.y - t.y), fly = dist / (t.k === 'cannon' ? 340 : t.k === 'archer' ? 560 : 420);
      this.ev(['s', t.id, best.id, Math.round(fly * 100)]);
      this.pending = this.pending || []; this.pending.push({ at: this.t + fly, t, u: best, x: best.x, y: best.y });
    }
    if (this.pending && this.pending.length) {
      const due = this.pending.filter(p => p.at <= this.t); this.pending = this.pending.filter(p => p.at > this.t);
      for (const p of due) {
        const T = TOWERS[p.t.k], x = p.u.hp > 0 ? p.u.x : p.x, y = p.u.hp > 0 ? p.u.y : p.y;
        if (T.splash) near(x, y, T.splash, u => this.hurt(u, T.dmg, 'blast', p.t, x, y));
        else if (p.u.hp > 0) { if (T.slow) p.u.slowU = this.t + T.slow; this.hurt(p.u, T.dmg, T.dt, p.t); }
      }
    }
    this.units = this.units.filter(u => u.hp > 0);
    // end conditions
    if (!this.defs.some(d => d.alive)) this.finish('atk');
    else if (this.t >= RULES.length) this.finish('def');
    if (this.atk.bot) this.botAttack(); for (const d of this.defs) if (d.bot && d.alive) this.botDefend(d);
  }
  spawn(k, l) {
    const U = UNITS[k], D = this.defs[l]; if (!D || !D.alive) return;
    const hp = Math.round(U.hp * (1 + RULES.hpPerMin * this.mins()));
    const u = { id: this.nid++, k, l, d: -10 - this.R() * 20, off: Math.round(rr(this.R, -LANE + 10, LANE - 10)), sp: Math.round(U.sp * rr(this.R, 0.92, 1.08)), hp, max: hp, slowU: 0, burn: 0, x: 0, y: 0 };
    this.units.push(u); this.ev(['u', u.id, UNIT_IDS.indexOf(k), l, u.off, u.sp, Math.round(u.d)]);
  }
  hurt(u, amt, type, t, sx, sy) {
    if (u.hp <= 0) return;
    u.hp -= amt; const D = this.players[t.owner]; if (D) D.dmg += amt;
    if (u.hp <= 0) {
      u.hp = 0; t.kills++; if (D) { D.kills++; D.gold += UNITS[u.k].bounty; }
      this.ev(['d', u.id, type, Math.round(sx !== undefined ? sx : t.x), Math.round(sy !== undefined ? sy : t.y), Math.round(u.x), Math.round(u.y)]);
    }
  }
  finish(w) { this.over = { winner: w, t: this.t }; this.ev(['over', w]); }
  // ---- simple bots so a match can be tested with any number of humans ----
  botAttack() {
    if (this.tick % 20) return; const A = this.atk;
    if (A.invest < this.mins() * 0.9 && A.gold >= this.investCost() && this.mins() < 14) this.input(A.pid, { c: 'invest' });
    const lanes = this.defs.filter(d => d.alive).length; if (!lanes) return;
    let guard = 40; while (guard-- > 0) { const k = this.R() < 0.55 ? 'grunt' : this.R() < 0.75 ? 'runner' : 'brute'; const cost = UNITS[k].cost * lanes; if (A.gold < cost + (this.pulseT > 3 ? A.income * 0.2 : 0)) break; this.input(A.pid, { c: 'send', k, lane: 'all' }); }
  }
  botDefend(D) {
    if ((this.tick + D.slot * 5) % 20) return;
    const pads = this.lane.pads, mine = this.towers.filter(t => t.owner === D.pid), used = new Set(mine.map(t => t.pad));
    if (!this.padScore) this.padScore = pads.map(p => { let s = 0; for (let d = 0; d < this.lane.total; d += 40) { const q = this.lane.at(d); if ((q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 < 175 * 175) s++; } return s; });
    const mix = ['archer', 'archer', 'cannon', 'frost', 'archer', 'flame', 'storm', 'cannon'], k = mix[mine.length % mix.length];
    if (D.gold < TOWERS[k].cost) return;
    let best = -1, bs = -1; pads.forEach((p, i) => { if (used.has(i)) return; const s = this.padScore[i] - p.y * 0.002; if (s > bs) { bs = s; best = i; } });
    if (best >= 0) this.input(D.pid, { c: 'build', k, pad: best });
  }
  // ---- network snapshot (compact) ----
  snapshot(full) {
    const s = { t: Math.round(this.t * 100) / 100, pu: Math.round(this.pulseT * 10) / 10, wv: this.wave,
      a: [Math.floor(this.atk.gold), this.atk.income, this.atk.invest, this.investCost(), this.atk.queue.map(q => UNIT_IDS.indexOf(q[0]) * 10 + q[1])],
      df: this.defs.map(d => [Math.floor(d.gold), d.income, d.lives, d.alive ? 1 : 0, d.kills, d.leaks]),
      u: [], bm: this.beams || [], ev: this.events, over: this.over, vt: [this.voters().filter(p => this.votes.has(p.pid)).length, this.voters().length, [...this.votes]] };
    for (const u of this.units) s.u.push(u.id, Math.round(u.d * 10) / 10, Math.round(u.hp / u.max * 100), u.slowU > this.t ? 1 : 0 | (u.burn > 0 ? 2 : 0));
    if (full || this.sentTowerVer !== this.towerVer) { s.tw = this.towers.map(t => [t.id, t.slot, TOWER_IDS.indexOf(t.k), t.pad, PRIORITIES.indexOf(t.prio), t.kills, t.spent]); s.tv = this.towerVer; this.sentTowerVer = this.towerVer; }
    if (full) { s.full = 1; s.units = this.units.map(u => [u.id, UNIT_IDS.indexOf(u.k), u.l, u.off, u.sp, Math.round(u.d)]); s.stats = this.stats(); }
    this.events = [];
    return s;
  }
  stats() { return { atk: { sent: this.atk.sent, leaked: this.atk.leaked, spent: this.atk.spent, invest: this.atk.invest }, defs: this.defs.map(d => ({ kills: d.kills, leaks: d.leaks, built: d.built, dmg: Math.round(d.dmg), lives: d.lives })) }; }
}

const API = { COLORS, RACES, MAPS, LANES, LANE, STAGE_H, MAX_DEF, TOWERS, TOWER_IDS, UNITS, UNIT_IDS, RULES, PRIORITIES, Sim, worldOf, mulberry32 };
if (typeof module !== 'undefined') module.exports = API; else G.TD = API;
})(typeof window !== 'undefined' ? window : globalThis);
