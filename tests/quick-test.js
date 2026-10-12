const DW = require('../src/sim.js');
const t0 = Date.now();
// 1) attack: tap = one swing, hold = keeps attacking
{ const S = new DW.Sim({ seed: 3, players: [{ pid: 'a', hero: 'bloodreaver' }] }); const h = S.heroes[0];
  const c = DW.MAP.camps[0]; h.x = c.x + 6; h.z = c.z;
  S.input('a', { c: 'atk' }); let swings = 0, last = 0; for (let i = 0; i < 20 * 4; i++) { S.step(); h.hp = h.maxhp; if (h.atkAnim && h.atkAnim !== last) { swings++; last = h.atkAnim; } }
  console.log('tap swings', swings, 'order after', JSON.stringify(h.order));
  S.input('a', { c: 'atk', hold: 1 }); swings = 0; for (let i = 0; i < 20 * 4; i++) { S.step(); h.hp = h.maxhp; if (h.atkAnim !== last) { swings++; last = h.atkAnim; } }
  S.input('a', { c: 'atkEnd' }); for (let i = 0; i < 20 * 2; i++) S.step();
  console.log('hold swings (4s)', swings, 'after release', h.order ? 'attacking' : 'stopped');
  // 2) walk to cast: blood leap at 20 units
  h.ranks[2] = 1; h.x = 0; h.z = 120; const tx = 0, tz = 96; S.input('a', { c: 'cast', k: 2, x: tx, z: tz });
  let n = 0, leaped = false; while (n++ < 200) { S.step(); if (h.dash) leaped = true; if (leaped && !h.dash) break; }
  console.log('leap: walked then leapt', leaped, 'end dist to target', Math.hypot(h.x - tx, h.z - tz).toFixed(1));
}
// 3) enemy waves stop at held town
{ const S = new DW.Sim({ seed: 4, players: [{ pid: 'a', hero: 'ironvow' }] }); const h = S.heroes[0];
  const t = S.ents.find(e => e.tid === 'crossroads'); t.guards.forEach(id => S.byId.get(id).dead = true); h.x = t.x; h.z = t.z;
  for (let i = 0; i < 20 * 8; i++) { S.step(); h.hp = h.maxhp; } h.x = DW.MAP.fountain.x; h.z = DW.MAP.fountain.z; h.order = null;
  for (let i = 0; i < 20 * 150; i++) S.step();
  const past = S.ents.filter(e => e.kind === 'minion' && e.team === 1 && e.lane === 'M' && e.z > t.z + 2).length;
  console.log('town team', t.team, 'hp', Math.round(t.hp) + '/' + t.maxhp, 'garrison', S.ents.filter(e => e.kind === 'garrison').length, 'enemy minions past town', past);
}
// 4) 12 minutes of bots for runtime errors
{ const players = DW.HERO_IDS.slice(0, 4).map((h, i) => ({ pid: 'p' + i, name: 'B' + i, hero: h })); const S = new DW.Sim({ seed: 12345, players }); const lanes = ['L', 'M', 'R', 'M'];
  let bytes = 0, snaps = 0;
  for (let step = 0; step < 20 * 60 * 12 && !S.over; step++) {
    if (step % 10 === 0) S.heroes.forEach((h, i) => {
      while (h.pts > 0) { let d = false; for (const k of [3, 0, 1, 2]) if (S.canLevel(h, k)) { S.input(h.pid, { c: 'lvl', k }); d = true; break; } if (!d) S.input(h.pid, { c: 'lvl', k: 4 }); }
      if (h.dead) return; const tg = S.findTarget(h, 12);
      if (tg) { for (let k = 0; k < 4; k++) S.input(h.pid, { c: 'cast', k, auto: 1 }); S.input(h.pid, { c: 'atk', hold: 1, keep: 1 }); return; }
      if (!h.order) { const P = DW.LANES[lanes[i]]; let b = P.length - 1; for (let j = 0; j < P.length; j++) if (P[j][1] < h.z - 3) { b = j; break; } S.input(h.pid, { c: 'move', x: P[b][0], z: P[b][1] }); }
    });
    S.step(); if (step % 2 === 0) { const sn = JSON.stringify(S.snapshot(step % 40 === 0)); bytes += sn.length; snaps++; }
  }
  console.log('bots 12min ok; levels', S.heroes.map(h => h.lvl).join(','), 'deaths', S.heroes.map(h => h.st.deaths).join(','), 'avg snap', Math.round(bytes / snaps), 'ents', S.ents.length);
}
console.log('total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
