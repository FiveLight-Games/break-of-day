// Verifies every hero ability: skill shots hit, and point/unit abilities aimed beyond range walk into range then cast.
const DW = require('../src/sim.js');
function arena(hid) {
  const S = new DW.Sim({ seed: 7, players: [{ pid: 'a', hero: hid }] });
  S.ents.filter(e => !e.structure && e.kind !== 'hero').forEach(e => e.dead = true); S.step();
  const h = S.heroes[0]; h.lvl = 16; h.ranks = [5, 5, 5, 3]; S.recalc(h); h.hp = h.maxhp; h.res = h.resMax;
  const z0 = 60, x0 = DW.laneX('M', z0); h.x = x0; h.z = z0; h.face = -Math.PI / 2;
  return { S, h, x0, z0 };
}
function dummy(S, x, z) { const d = S.unitFrom({ hp: 99999, ad: 0, armor: 0, mr: 0, as: 0.01, range: 1, ms: 0, r: 0.9, g: 0, xp: 0 }, 'creep', 2, x, z, 1, 'c_bandit'); d.homeX = x; d.homeZ = z; d.leash = 99; d.aggro = 0; d.stunU = 1e9; return d; }
const res = [];
for (const hid of DW.HERO_IDS) {
  const H = DW.HEROES[hid];
  H.ab.forEach((ab, k) => {
    const { S, h, x0, z0 } = arena(hid);
    if (ab.t === 'self') { const d = dummy(S, x0 + 1.5, z0 - 2); const hp0 = d.hp; S.input('a', { c: 'cast', k, x: h.x, z: h.z }); for (let i = 0; i < 20 * 7; i++) { S.step(); h.res = h.resMax; } res.push([H.name, ab.n, 'self', h.cds[k] > 0 ? 'cast' : 'NOT CAST', Math.round(hp0 - d.hp)]); return; }
    const range = ab.range || 8, far = ab.t === 'dir' ? Math.min(range * 0.7, 14) : range * 2.2;
    const d = dummy(S, x0, z0 - far); const hp0 = d.hp;
    const sx = h.x, sz = h.z; S.input('a', { c: 'cast', k, x: d.x, z: d.z, id: d.id });
    let castAt = null, t0 = S.t;
    for (let i = 0; i < 20 * 12; i++) { S.step(); h.res = h.resMax; h.hp = h.maxhp; if (castAt === null && h.cds[k] > 0) castAt = { t: S.t - t0, dist: Math.hypot(h.x - d.x, h.z - d.z) }; }
    const walked = Math.hypot(h.x - sx, h.z - sz);
    res.push([H.name, ab.n, ab.t + (ab.t === 'dir' ? '' : ' @' + far.toFixed(0) + '/' + range), castAt ? 'cast after ' + castAt.t.toFixed(1) + 's at dist ' + castAt.dist.toFixed(1) : 'NOT CAST', Math.round(hp0 - d.hp), 'moved ' + walked.toFixed(1)]);
  });
}
console.table(res);
// out-of-range dir skillshot: should fire immediately toward target
const { S, h, x0, z0 } = arena('thornshot'); const d = dummy(S, x0, z0 - 30); S.input('a', { c: 'cast', k: 0, x: d.x, z: d.z }); S.step();
console.log('piercing arrow fired immediately at 30 units (range 18):', h.cds[0] > 0, 'projectiles', S.projs.length);
