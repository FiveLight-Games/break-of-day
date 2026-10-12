const DW = require('../src/sim.js');
const players = DW.HERO_IDS.slice(0, 4).map((h, i) => ({ pid: 'p' + i, name: 'Bot' + i, hero: h }));
players.push({ pid: 'p4', name: 'Bot4', hero: 'lumen' });
const S = new DW.Sim({ seed: 12345, players: players.slice(0, 4) });
S.heroes.push; // noop
const lanes = ['L', 'M', 'R', 'M'];
let lastLog = 0, snapBytes = 0, snaps = 0, maxSnap = 0;
const buyOrder = ['sword', 'rod', 'pendant', 'vest', 'boots', 'warlord', 'titan', 'archstaff'];
for (let step = 0; step < 20 * 60 * 32 && !S.over; step++) {
  if (step % 10 === 0) {
    S.heroes.forEach((h, i) => {
      // level abilities
      while (h.pts > 0) { let done = false; for (const k of [3, 0, 1, 2]) if (S.canLevel(h, k)) { S.input(h.pid, { c: 'lvl', k }); done = true; break; } if (!done) S.input(h.pid, { c: 'lvl', k: 4 }); }
      if (h.dead) return;
      // shop at base
      for (const it of buyOrder) { if (h.gold > DW.ITEMS[it].c + 100 && h.items.indexOf(null) >= 0) S.input(h.pid, { c: 'buy', item: it }); }
      if (h.hp < h.maxhp * 0.3) { S.input(h.pid, { c: 'potion' }); if (!h.recall) S.input(h.pid, { c: 'recall' }); return; }
      if (h.recall) return;
      // cast at nearest enemy
      const tg = S.findTarget(h, 12);
      if (tg) { for (let k = 0; k < 4; k++) S.input(h.pid, { c: 'cast', k, x: tg.x, z: tg.z, id: tg.id }); if (!h.order) S.input(h.pid, { c: 'attack', id: tg.id }); return; }
      if (!h.order) { // walk lane toward enemy
        const P = DW.LANES[lanes[i]]; let best = 0; for (let j = 0; j < P.length; j++) if (P[j][1] < h.z - 3) { best = j; break; }
        const wp = P[best] || P[P.length - 1]; S.input(h.pid, { c: 'move', x: wp[0], z: wp[1] });
      }
    });
  }
  S.step();
  if (step % 2 === 0) { const s = JSON.stringify(S.snapshot(step % 40 === 0)); snapBytes += s.length; snaps++; if (s.length > maxSnap) maxSnap = s.length; }
  if (S.t - lastLog >= 120) {
    lastLog = S.t;
    const towns = S.ents.filter(e => e.kind === 'town' && e.team === 0).map(e => e.name).join(',');
    console.log(`t=${(S.t / 60).toFixed(1)}m ${S.phase} ents=${S.ents.length} ` + S.heroes.map(h => `${h.hid}:L${h.lvl} ${h.gold}g ${h.dead ? 'DEAD' : Math.round(h.hp)} z${Math.round(h.z)} d${h.st.deaths}`).join(' | ') + ` towns:[${towns}] bosses:${S.ents.filter(e => e.kind === 'boss').length}`);
  }
}
console.log('OVER', S.over, 'avg snap', Math.round(snapBytes / snaps), 'max', maxSnap);
console.log(JSON.stringify(S.heroes.map(h => ({ h: h.hid, lvl: h.lvl, st: h.st })), null, 0).slice(0, 1500));
// loot sample
const R = DW.mulberry32(7); for (let i = 0; i < 5; i++) console.log(JSON.stringify(DW.rollLoot(R, 2, 10)));
// town tier test
const S2 = new DW.Sim({ seed: 3, players: [{ pid: 'a', name: 'A', hero: 'lumen' }, { pid: 'b', name: 'B', hero: 'ironvow' }] });
const t = S2.ents.find(e => e.tid === 'crossroads'); t.guards.forEach(id => S2.byId.get(id).dead = true);
S2.heroes.forEach(h => { h.x = t.x; h.z = t.z + 2; });
for (let i = 0; i < 120; i++) S2.step();
console.log('town team', t.team, 'gold', S2.heroes.map(h => Math.floor(h.gold)));
S2.input('a', { c: 'tier', tid: 'crossroads', d: 1 }); S2.input('a', { c: 'tier', tid: 'crossroads', d: 1 });
const ms0 = S2.heroes[0].ms; for (let i = 0; i < 200; i++) S2.step();
console.log('tier', t.inv, 'ms before/after', ms0, S2.heroes[0].ms, 'gold', S2.heroes.map(h => Math.floor(h.gold)), S2.snapshot().m.map(m => m[0]).join(' / '));
// upgrades / rail / raid / merc test
{
const S3 = new DW.Sim({ seed: 9, players: [{ pid: 'a', name: 'A', hero: 'bloodreaver' }] });
const h = S3.heroes[0]; h.gold = 20000; h.lvl = 6;
const t1 = S3.ents.find(e => e.tid === 'hollowmere'); t1.guards.forEach(id => S3.byId.get(id).dead = true);
S3.input('a', { c: 'upg', k: 'railL' }); // should fail (town not held)
h.x = t1.x; h.z = t1.z; for (let i = 0; i < 100; i++) S3.step();
S3.input('a', { c: 'upg', k: 'railL' });
for (const k of ['sight', 'heal', 'merc', 'walls', 'drums', 'treasury']) S3.input('a', { c: 'upg', k });
h.x = 0; h.z = 110; S3.input('a', { c: 'merc' }); S3.input('a', { c: 'merc' }); S3.input('a', { c: 'merc' });
S3.input('a', { c: 'rail', lane: 'L', to: 1 }); let n = 0; while (h.rail && n < 400) { S3.step(); n++; }
console.log('rail arrived', Math.round(h.x), Math.round(h.z), 'in', (n * 0.05).toFixed(1) + 's', 'upg', JSON.stringify(S3.upg));
S3.input('a', { c: 'rail', lane: 'L', to: 0 }); n = 0; while (h.rail && n < 400) { S3.step(); n++; } console.log('rail home', Math.round(h.x), Math.round(h.z));
S3.spawnRaid(); for (let i = 0; i < 20 * 90; i++) S3.step();
const sn = S3.snapshot(true);
console.log('mercs', S3.ents.filter(e => e.kind === 'merc' && !e.dead).length, 'raiders alive', S3.ents.filter(e => e.kind === 'raider' && !e.dead).length, 'walls', S3.ents.filter(e => e.kind === 'wall' && !e.dead).map(w => Math.round(w.hp)).join(','), 'visible ents', sn.e.length, 'of', S3.ents.length, 'msgs:', sn.m.map(m => m[0]).slice(-8).join(' | '));
}
// long war mode
{
const S4 = new DW.Sim({ seed: 5, players: [{ pid: 'a', name: 'A', hero: 'thornshot' }], mode: 'long' });
let firstNight = null; while (S4.t < 2750) { S4.step(); if (!firstNight && S4.phase === 'night') firstNight = S4.t; }
console.log('long mode', S4.mode, 'first night at', firstNight.toFixed(0) + 's', 'cycle', S4.cyc, 'eclipse', S4.eclipse, 'day', S4.cycle, 'over', JSON.stringify(S4.over), 'core hp', S4.ents.find(e => e.kind === 'core' && e.team === 1).maxhp);
}
