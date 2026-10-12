// buildings are solid: heroes walk around them, never through; no allied waves; held towns grow a palisade
const DW = require('../src/sim.js');
const S = new DW.Sim({ seed: 7, players: [{ pid: 'a', hero: 'bloodreaver' }] }); const h = S.heroes[0];
const F = DW.MAP.fountain; let fails = 0;
const inside = (x, z) => S.obs.some(o => { const vx = o.bx - o.ax, vz = o.bz - o.az, vv = vx * vx + vz * vz, t = vv ? Math.max(0, Math.min(1, ((x - o.ax) * vx + (z - o.az) * vz) / vv)) : 0; return Math.hypot(x - o.ax - vx * t, z - o.az - vz * t) < o.r - 0.05; });
const walk = (x1, z1, x2, z2, label) => {
  h.x = x1; h.z = z1; h.nav = null; S.input('a', { c: 'move', x: x2, z: z2 }); let through = 0, n = 0;
  while (h.order && n++ < 20 * 25) { S.step(); h.hp = h.maxhp; if (inside(h.x, h.z)) through++; }
  const d = Math.hypot(h.x - x2, h.z - z2); console.log(label.padEnd(26), 'inside-ticks', through, 'end dist', d.toFixed(1), 'secs', (n / 20).toFixed(1));
  if (through) fails++; return d;
};
S.step();
walk(F.x, F.z + 2 + 9, F.x, F.z + 2 - 9, 'across fountain');
walk(DW.MAP.shop.x, DW.MAP.shop.z + 6, DW.MAP.shop.x, DW.MAP.shop.z - 6, 'across shop stall');
const core = S.ents.find(e => e.kind === 'core' && e.team === 0); walk(core.x - 8, core.z, core.x + 8, core.z, 'across our core');
const tw = S.ents.find(e => e.kind === 'tower' && e.team === 0); walk(tw.x, tw.z + 5, tw.x, tw.z - 5, 'across a tower');
walk(DW.MAP.secretShop.x - 7, DW.MAP.secretShop.z, DW.MAP.secretShop.x + 7, DW.MAP.secretShop.z, 'across secret shop');
const town = S.ents.find(e => e.kind === 'town'); walk(town.x - 4, town.z, town.x + 4, town.z, 'through town well');
// walk INTO the fountain center: should stop at the rim, not jitter forever
h.x = F.x; h.z = F.z + 14; S.input('a', { c: 'move', x: F.x, z: F.z + 2 }); let n = 0; while (h.order && n++ < 400) S.step();
console.log('move into fountain: order cleared', !h.order, 'dist', Math.hypot(h.x - F.x, h.z - F.z - 2).toFixed(1)); if (h.order) fails++;
// a dash can't leave you inside a building
h.x = F.x; h.z = F.z + 2.5; S.step(); S.step(); console.log('teleported into fountain -> pushed out', !inside(h.x, h.z)); if (inside(h.x, h.z)) fails++;
// no allied minions over 3 minutes
for (let i = 0; i < 20 * 180; i++) { S.step(); h.hp = h.maxhp; }
const allies = S.ents.filter(e => e.kind === 'minion' && e.team === 0 && !e.dead).length, foes = S.ents.filter(e => e.kind === 'minion' && e.team === 1 && !e.dead).length;
console.log('allied minions', allies, 'enemy minions', foes, 'drums upgrade gone', !DW.BASE_UPG.drums); if (allies || !foes || DW.BASE_UPG.drums) fails++;
// palisade stamps on capture, clears on loss
const tn = S.ents.find(e => e.kind === 'town' && e.team === 2), cells = DW.FORT_CELLS[tn.tid];
tn.guards.forEach(id => { const g = S.byId.get(id); if (g) g.dead = true; }); h.x = tn.x; h.z = tn.z + 3; h.order = null;
for (let i = 0; i < 20 * 8 && tn.team !== 0; i++) { S.ents.forEach(o => { if (o.team === 1 && !o.structure && Math.hypot(o.x - tn.x, o.z - tn.z) < 14) o.dead = true; }); S.step(); h.hp = h.maxhp; }
const on = cells.filter(i => DW.DYN[i] === 1).length; console.log('town held', tn.team === 0, 'palisade cells', on, '/', cells.length);
// can still walk from inside the fort out through the lane opening to the jungle
const P = DW.TER; let jx = tn.x + 22, jz = tn.z; if (DW.blocked(jx, jz)) jx = tn.x - 22;
h.x = tn.x; h.z = tn.z + 3; S.input('a', { c: 'move', x: jx, z: jz }); n = 0; while (h.order && n++ < 20 * 30) { S.step(); h.hp = h.maxhp; }
console.log('walk out of held town', !h.order ? 'arrived' : 'STUCK', Math.hypot(h.x - jx, h.z - jz).toFixed(1)); if (h.order) fails++;
S.kill(tn); console.log('palisade cleared on loss', cells.every(i => DW.DYN[i] !== 1)); if (!cells.every(i => DW.DYN[i] !== 1)) fails++;
if (!on) fails++;
console.log(fails ? 'FAIL ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
