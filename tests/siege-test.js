// Gate sentries, tower bonus vs lane minions, siege every 5th day, no jungle raid the night before/after a siege day.
const DW = require('../src/sim.js'); let fails = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) fails++; };
// lane camp mobs and gate defenders ignore each other
{ const S = new DW.Sim({ seed: 5, players: [{ pid: 'a', hero: 'ironvow' }] }); const h = S.heroes[0];
  const sen = S.ents.find(e => e.kind === 'sentry'), tw = S.ents.find(e => e.kind === 'tower' && e.team === 0 && e.lane === sen.lane);
  const g = S.ents.find(e => e.kind === 'guard' && e.lane === sen.lane); const hp0 = g.hp;
  g.homeX = sen.x; g.homeZ = sen.z + 1; g.x = sen.x + 1; g.z = sen.z + 1; g.leash = 30; // camp mob dragged right onto the sentries
  h.x = sen.x + 2; h.z = sen.z + 2; const sh0 = S.ents.filter(e => e.kind === 'sentry').reduce((a, e) => a + e.hp, 0), th0 = tw.hp; let heroHit = false;
  for (let i = 0; i < 20 * 8; i++) { S.step(); if (h.hp < h.maxhp) heroHit = true; h.hp = h.maxhp; h.x = sen.x + 2; h.z = sen.z + 2; h.order = null; }
  const sh1 = S.ents.filter(e => e.kind === 'sentry' && !e.dead).reduce((a, e) => a + e.hp, 0);
  check(!g.dead && g.hp >= hp0 * 0.999, `camp mob at the gate untouched by sentries/towers (hp ${Math.round(g.hp)}/${Math.round(hp0)})`);
  check(sh1 >= sh0 * 0.999 && tw.hp === th0, 'sentries and towers untouched by the camp mob');
  check(heroHit, 'camp mob still fights the hero');
}
for (const mode of (process.env.MODE ? process.env.MODE.split(',').filter(m => m !== 'none') : ['standard', 'long'])) {
  const S = new DW.Sim({ seed: 11, mode, players: [{ pid: 'a', hero: 'ironvow' }] }); const h = S.heroes[0];
  const sent = S.ents.filter(e => e.kind === 'sentry'); check(sent.length === 15, `${mode}: 15 gate sentries posted (${sent.length})`);
  // tower bonus
  const tw = S.ents.find(e => e.kind === 'tower' && e.team === 0), m = S.unitFrom(DW.MINION ? DW.MINION.melee : { hp: 460, ad: 21, armor: 8, mr: 0, as: 0.9, range: 1.8, ms: 300, r: 0.7 }, 'minion', 1, tw.x, tw.z - 5, 1, 'me_melee_M');
  const c = S.unitFrom({ hp: 460, ad: 21, armor: 8, mr: 0, as: 0.9, range: 1.8, ms: 300, r: 0.7 }, 'creep', 2, tw.x, tw.z - 5, 1, 'c_wolf');
  const d1 = S.damage(tw, m, 100, 'phys'), d2 = S.damage(tw, c, 100, 'phys'); m.dead = c.dead = true;
  check(Math.abs(d1 / d2 - 1.3) < 0.01, `${mode}: towers deal x${(d1 / d2).toFixed(2)} to lane minions`);
  // sentry respawn
  const s0 = sent[0]; s0.hp = 0; S.kill(s0); s0.dead = true;
  for (let i = 0; i < 20 * 27; i++) S.step();
  check(S.ents.some(e => e.kind === 'sentry' && !e.dead && e.id !== s0.id && Math.hypot(e.x - s0.homeX, e.z - s0.homeZ) < 3), `${mode}: fallen sentry returns after 25s`);
  // run to day 6, hero idles at base and is unkillable; allow raids (lvl 6)
  h.lvl = 6; const raids = [], sieges = []; let siegeSpawned = 0, siegeBroken = 0;
  const oRaid = S.spawnRaid.bind(S); S.spawnRaid = () => { raids.push(S.cycle); oRaid(); };
  const oPlan = S.planSiege.bind(S); S.planSiege = () => { sieges.push(S.cycle); oPlan(); };
  const oMsg = S.msg.bind(S); S.msg = (t, k) => { if (/SIEGE!/.test(t)) siegeSpawned++; if (/siege is broken/.test(t)) siegeBroken++; oMsg(t, k); };
  const gateMin = {}; let dayStart = null, worstDayDrop = 0, prevPh = S.phase; const target = S.M.day + S.M.night * 0 + S.cyc * 5 + 20; let maxAtGate = 0;
  const t0 = Date.now();
  while (S.t < target && !S.over) {
    S.step(); h.hp = h.maxhp; h.x = DW.MAP.fountain.x; h.z = DW.MAP.fountain.z; h.order = null;
    if (S.phase !== prevPh) { prevPh = S.phase; dayStart = S.phase === 'day' && S.cycle <= 2 ? Object.fromEntries(S.ents.filter(g => g.kind === 'gate' && g.team === 0 && !g.dead).map(g => [g.lane, g.hp / g.maxhp])) : null; }
    if (dayStart && S.tick % 20 === 0) for (const g of S.ents) if (g.kind === 'gate' && g.team === 0 && dayStart[g.lane] !== undefined) { const dd = dayStart[g.lane] - (g.dead ? 0 : g.hp / g.maxhp); if (dd > 0.3 && !g._rep) { g._rep = 1; console.log("  day", S.cycle, "gate", g.lane, "down", Math.round(dd * 100) + "%", "at t", Math.round(S.t), "into day", Math.round(S.t % S.cyc)); } worstDayDrop = Math.max(worstDayDrop, dd); }
    if (S.tick % 100 === 0) {
      for (const g of S.ents) if (g.kind === 'gate' && g.team === 0) gateMin[g.lane] = Math.min(gateMin[g.lane] ?? 1, g.hp / g.maxhp);
      const near = S.ents.filter(e => !e.dead && e.kind === 'minion' && e.team === 1 && DW.BASES[0].gates.some(g => Math.hypot(e.x - g.x, e.z - g.z) < 14)).length; maxAtGate = Math.max(maxAtGate, near);
    }
  }
  console.log(`  ${mode}: simulated to day ${S.cycle} in ${((Date.now() - t0) / 1000).toFixed(1)}s; raids on nights [${raids}] sieges planned on days [${sieges}] spawned ${siegeSpawned} broken ${siegeBroken}`);
  console.log(`  ${mode}: lowest gate HP`, JSON.stringify(Object.fromEntries(Object.entries(gateMin).map(([k, v]) => [k, Math.round(v * 100) + '%']))), 'peak enemy minions at a gate', maxAtGate);
  check(sieges.length === 1 && sieges[0] === 5, `${mode}: siege planned on day 5 only`);
  check(siegeSpawned === 1, `${mode}: siege army marched`);
  check(!raids.includes(4) && !raids.includes(5), `${mode}: no jungle raid on night 4 or 5`);
  check(worstDayDrop < 0.35, `${mode}: days 1-2 unattended: the steady daytime stream takes at most ${Math.round(worstDayDrop * 100)}% off a gate in one day (sentries + towers hold)`);
}
console.log(fails ? 'SIEGE FAIL ' + fails : 'SIEGE OK'); process.exit(fails ? 1 : 0);
