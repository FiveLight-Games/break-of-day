/* Break of Day — hand-built SVG art: ability icons, hero emblems, item icons */
(function (G) {
'use strict';
let uid = 0;
function frame(c1, c2, body) {
  const id = 'g' + (uid++);
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>
<radialGradient id="${id}b" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
<linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d2e0"/></linearGradient>
<linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3a00"/><stop offset=".55" stop-color="#ffa21a"/><stop offset="1" stop-color="#fff3a0"/></linearGradient>
<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#e8a82a"/></linearGradient>
<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a6a"/><stop offset="1" stop-color="#7a0010"/></linearGradient>
<filter id="${id}s"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".7"/></filter></defs>
<rect width="64" height="64" fill="url(#${id}b)"/><g filter="url(#${id}s)">${body.replace(/#M/g, `url(#${id}m)`).replace(/#F/g, `url(#${id}f)`).replace(/#GG/g, `url(#${id}g)`).replace(/#R/g, `url(#${id}r)`)}</g></svg>`;
}
const AB = {
  ironvow: [
    ['#4a6a9a', '#0e1a2e', `<path d="M30 12 L46 17 L44 34 Q40 46 30 52 Q20 46 16 34 L14 17 Z" fill="#M" stroke="#2a3a5a" stroke-width="2"/><path d="M30 17 V47 M19 28 H41" stroke="#3a6ad0" stroke-width="4"/><path d="M48 22 L58 18 M50 31 L60 31 M48 40 L58 45" stroke="#ffe27a" stroke-width="3" stroke-linecap="round"/>`],
    ['#8a6a2a', '#2a1a08', `<path d="M14 40 Q14 22 34 18 L40 16 L42 24 Q30 26 26 40 Z" fill="#GG" stroke="#5a3a10" stroke-width="2"/><path d="M12 38 h16 v6 h-16z" fill="#a07030"/><path d="M46 22 Q52 30 46 38 M51 17 Q60 30 51 43" stroke="#fff3b0" stroke-width="3" fill="none" stroke-linecap="round"/>`],
    ['#3a5a8a', '#0a1426', `<path d="M10 20 L24 32 L10 44 M24 20 L38 32 L24 44 M38 20 L52 32 L38 44" stroke="#M" stroke-width="6" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M4 26 h8 M2 32 h10 M4 38 h8" stroke="#9fd0ff" stroke-width="2" stroke-linecap="round"/>`],
    ['#9a7a2a', '#1a1206', `<circle cx="32" cy="34" r="22" fill="#ffd36b" opacity=".25"/><path d="M18 52 V24 h5 v-6 h5 v6 h8 v-6 h5 v6 h5 V52 Z" fill="#M" stroke="#3a3a4a" stroke-width="2"/><path d="M28 52 v-10 a4 4 0 0 1 8 0 v10" fill="#2a2a3a"/><path d="M32 8 v6" stroke="#ffe27a" stroke-width="3"/>`]],
  emberwitch: [
    ['#7a2a10', '#1a0604', `<path d="M8 50 Q24 40 34 30" stroke="#F" stroke-width="7" stroke-linecap="round" opacity=".7"/><circle cx="40" cy="24" r="12" fill="#F"/><circle cx="43" cy="21" r="5" fill="#fff6c0"/>`],
    ['#6a1a08', '#140402', `<ellipse cx="32" cy="52" rx="18" ry="5" fill="#ff7a1a" opacity=".6"/><path d="M32 6 Q44 20 40 30 Q48 26 46 40 Q44 54 32 54 Q20 54 18 40 Q16 26 24 30 Q20 18 32 6 Z" fill="#F"/><path d="M32 24 Q38 34 34 44 Q32 50 28 44 Q26 36 32 24Z" fill="#fff3a0"/>`],
    ['#5a1a3a', '#12040c', `<path d="M32 10 L35 27 L52 30 L35 34 L32 52 L29 34 L12 30 L29 27 Z" fill="#ffb8e0"/><circle cx="32" cy="31" r="5" fill="#fff"/><path d="M46 46 a10 10 0 1 1 -6 -18" stroke="#ff7ac8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="14" cy="14" r="2.5" fill="#fff"/><circle cx="50" cy="12" r="2" fill="#fff"/>`],
    ['#4a0e04', '#0c0200', `<g><path d="M6 6 L22 26" stroke="#ff9a2a" stroke-width="5" stroke-linecap="round" opacity=".7"/><circle cx="24" cy="28" r="7" fill="#F"/></g><g><path d="M24 2 L40 20" stroke="#ff9a2a" stroke-width="4" stroke-linecap="round" opacity=".7"/><circle cx="42" cy="22" r="5" fill="#F"/></g><g><path d="M30 20 L44 40" stroke="#ff9a2a" stroke-width="6" stroke-linecap="round" opacity=".7"/><circle cx="46" cy="44" r="9" fill="#F"/></g><path d="M10 56 h44" stroke="#ff5a1a" stroke-width="3"/>`]],
  thornshot: [
    ['#2a5a1a', '#061204', `<circle cx="38" cy="26" r="9" stroke="#c8ff7a" stroke-width="2.5" fill="none" opacity=".7"/><circle cx="26" cy="38" r="9" stroke="#c8ff7a" stroke-width="2.5" fill="none" opacity=".7"/><path d="M8 56 L54 10" stroke="#e8d8a8" stroke-width="3.5"/><path d="M54 10 L44 12 L52 20 Z" fill="#M"/><path d="M8 56 l2 -10 M8 56 l10 -2" stroke="#8aff5a" stroke-width="3"/>`],
    ['#1a4a14', '#041004', `<g stroke="#e8d8a8" stroke-width="3"><path d="M32 56 V14"/><path d="M32 56 L14 18"/><path d="M32 56 L50 18"/></g><g fill="#M"><path d="M32 8 l-5 9 h10z"/><path d="M12 12 l-1 10 l8 -4z"/><path d="M52 12 l1 10 l-8 -4z"/></g>`],
    ['#2a4a2a', '#061006', `<path d="M14 44 A18 18 0 1 1 46 46" stroke="#c8ff7a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M40 52 L48 44 L52 54 Z" fill="#c8ff7a"/><circle cx="32" cy="30" r="5" fill="#M"/>`],
    ['#3a4a0a', '#0c1002', `<circle cx="32" cy="32" r="20" stroke="#eaff5a" stroke-width="3" fill="none"/><circle cx="32" cy="32" r="10" stroke="#eaff5a" stroke-width="2" fill="none"/><path d="M32 4 v14 M32 46 v14 M4 32 h14 M46 32 h14" stroke="#eaff5a" stroke-width="3"/><circle cx="32" cy="32" r="3.5" fill="#ff3a3a"/>`]],
  bloodreaver: [
    ['#5a0a10', '#120204', `<path d="M10 44 Q32 4 56 30" stroke="#ff4a5a" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/><path d="M20 56 L40 22" stroke="#6a4a2a" stroke-width="5" stroke-linecap="round"/><path d="M34 14 Q50 10 54 24 Q44 26 40 34 Q34 24 34 14Z" fill="#M" stroke="#3a3a4a" stroke-width="1.5"/>`],
    ['#4a0a0e', '#100204', `<g stroke="#R" stroke-width="6" stroke-linecap="round"><path d="M16 12 L28 52"/><path d="M28 10 L38 52"/><path d="M40 12 L48 50"/></g><g stroke="#ffb0b0" stroke-width="1.5" stroke-linecap="round" opacity=".8"><path d="M17 15 L26 46"/><path d="M29 13 L36 46"/></g>`],
    ['#3a0a14', '#0c0204', `<path d="M8 50 Q26 4 50 40" stroke="#ff8a8a" stroke-width="3" stroke-dasharray="4 4" fill="none"/><ellipse cx="50" cy="48" rx="10" ry="4" fill="#R"/><path d="M42 48 l-6 -6 M58 48 l6 -6 M50 44 v-8" stroke="#ff4a5a" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="28" r="5" fill="#M"/>`],
    ['#2a0004', '#080000', `<circle cx="32" cy="30" r="20" fill="#R"/><circle cx="40" cy="24" r="16" fill="#2a0004" opacity=".55"/><path d="M32 30 Q40 42 36 50 Q32 56 28 50 Q24 42 32 30Z" fill="#ff2a3a" stroke="#ffb0b0" stroke-width="1.5"/>`]],
  lumen: [
    ['#8a6a1a', '#1a1204', `<g stroke="#fff3b0" stroke-width="3" stroke-linecap="round"><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l6 6M45 45l6 6M51 13l-6 6M19 45l-6 6"/></g><circle cx="32" cy="32" r="13" fill="#GG"/><circle cx="28" cy="28" r="5" fill="#fff"/>`],
    ['#2a6a3a', '#041208', `<path d="M32 52 Q10 36 12 22 Q14 10 26 12 Q30 13 32 18 Q34 13 38 12 Q50 10 52 22 Q54 36 32 52Z" fill="#5aff8a" stroke="#1a6a3a" stroke-width="2"/><path d="M32 22 v18 M23 31 h18" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`],
    ['#6a5a1a', '#141004', `<circle cx="32" cy="32" r="22" stroke="#ffe27a" stroke-width="2.5" fill="#ffe27a" fill-opacity=".12"/><circle cx="32" cy="32" r="14" stroke="#ffe27a" stroke-width="2" fill="none" stroke-dasharray="3 3"/><path d="M32 18 L44 39 H20 Z" stroke="#fff3b0" stroke-width="2.5" fill="none"/><circle cx="32" cy="32" r="3" fill="#fff"/>`],
    ['#9a5a1a', '#1a0c04', `<path d="M4 44 H60" stroke="#ffe27a" stroke-width="3"/><path d="M14 44 A18 18 0 0 1 50 44 Z" fill="#GG"/><g stroke="#fff3b0" stroke-width="3" stroke-linecap="round"><path d="M32 8v10M14 16l6 7M50 16l-6 7M6 30l9 3M58 30l-9 3"/></g><path d="M8 52 H56 M16 58 H48" stroke="#ffcf6a" stroke-width="2" opacity=".6"/>`]],
};
const HERO = {
  ironvow: ['#5a7aaa', '#101a2c', `<path d="M16 30 Q16 12 32 10 Q48 12 48 30 V44 Q40 52 32 54 Q24 52 16 44 Z" fill="#M" stroke="#2a3a5a" stroke-width="2"/><path d="M20 30 H44 V36 H20 Z" fill="#1a2238"/><path d="M32 10 V54" stroke="#9fb4d0" stroke-width="2"/><path d="M32 10 Q40 0 48 6" stroke="#3a6ad0" stroke-width="5" fill="none" stroke-linecap="round"/>`],
  emberwitch: ['#8a2a10', '#180604', `<path d="M10 46 L32 4 L46 40 Z" fill="#2a1414" stroke="#ff6a3d" stroke-width="2"/><path d="M4 46 Q32 36 60 46 Q32 54 4 46Z" fill="#3a1a1a" stroke="#ff6a3d" stroke-width="2"/><circle cx="34" cy="26" r="6" fill="#F"/><circle cx="26" cy="54" r="3" fill="#ffb0a0"/>`],
  thornshot: ['#2a6a1a', '#061204', `<path d="M14 54 Q14 20 32 10 Q50 20 50 54 Z" fill="#2a5a1a" stroke="#8aff5a" stroke-width="2"/><path d="M22 54 Q22 32 32 26 Q42 32 42 54 Z" fill="#0a1a06"/><circle cx="28" cy="40" r="2" fill="#c8ff7a"/><circle cx="36" cy="40" r="2" fill="#c8ff7a"/><path d="M52 6 Q62 32 52 58" stroke="#e8d8a8" stroke-width="3" fill="none"/>`],
  bloodreaver: ['#6a0a14', '#120204', `<path d="M18 26 Q32 14 46 26 V40 Q32 56 18 40 Z" fill="#3a1a1a" stroke="#c0283a" stroke-width="2"/><path d="M18 26 Q8 16 10 4 Q16 16 24 20 M46 26 Q56 16 54 4 Q48 16 40 20" fill="#e8e0d0"/><path d="M24 34 l6 3 M40 34 l-6 3" stroke="#ff2a2a" stroke-width="3" stroke-linecap="round"/>`],
  lumen: ['#9a7a2a', '#1a1404', `<ellipse cx="32" cy="12" rx="16" ry="5" fill="none" stroke="#ffe27a" stroke-width="3"/><path d="M14 58 Q16 30 32 22 Q48 30 50 58 Z" fill="#f4ecd8" stroke="#ffe08a" stroke-width="2"/><circle cx="32" cy="30" r="8" fill="#f0d0b0"/><path d="M32 40 v14 M25 47 h14" stroke="#e8a82a" stroke-width="3"/>`],
};
const ITEM = {
  ad: `<path d="M14 50 L44 14 L52 12 L50 20 L18 54 Z" fill="#M" stroke="#3a3a4a" stroke-width="1.5"/><path d="M12 42 L22 52 M10 54 l6 -6" stroke="#a07030" stroke-width="4" stroke-linecap="round"/>`,
  ap: `<path d="M20 56 L38 22" stroke="#7a5a3a" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="16" r="9" fill="#8ab8ff" stroke="#fff" stroke-width="2"/>`,
  armor: `<path d="M32 10 L50 16 L48 34 Q44 46 32 54 Q20 46 16 34 L14 16 Z" fill="#M" stroke="#3a3a4a" stroke-width="2"/>`,
  mr: `<path d="M16 14 Q32 6 48 14 L46 50 Q32 58 18 50 Z" fill="#6a4ac0" stroke="#c8b8ff" stroke-width="2"/><path d="M32 20 L36 32 L32 44 L28 32 Z" fill="#e0d8ff"/>`,
  hp: `<path d="M32 52 Q10 36 12 22 Q14 10 26 12 Q30 13 32 18 Q34 13 38 12 Q50 10 52 22 Q54 36 32 52Z" fill="#R" stroke="#ffb0b0" stroke-width="1.5"/>`,
  ms: `<path d="M18 12 h14 v24 l16 6 q4 2 4 8 v4 H16 Z" fill="#a0784a" stroke="#4a3018" stroke-width="2"/><path d="M6 26 h8 M4 34 h8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  crit: `<path d="M32 6 L37 27 L58 32 L37 37 L32 58 L27 37 L6 32 L27 27 Z" fill="#GG"/>`,
  ls: `<path d="M20 10 Q24 40 32 54 Q40 40 44 10 Q32 18 20 10Z" fill="#M" stroke="#3a3a4a" stroke-width="1.5"/><circle cx="32" cy="50" r="5" fill="#R"/>`,
  sv: `<circle cx="32" cy="32" r="18" fill="#3a1a5a" stroke="#c8a0ff" stroke-width="2"/><path d="M32 18 a14 14 0 0 1 0 28 a7 7 0 0 1 0 -14 a7 7 0 0 0 0 -14" fill="#c8a0ff"/>`,
  as: `<path d="M12 50 L40 14 M24 52 L52 18" stroke="#M" stroke-width="5" stroke-linecap="round"/><path d="M8 46 l8 8 M20 48 l8 8" stroke="#a07030" stroke-width="4" stroke-linecap="round"/>`,
  res: `<path d="M32 6 L46 26 L32 58 L18 26 Z" fill="#5a9aff" stroke="#e0f0ff" stroke-width="2"/>`,
  resr: `<path d="M32 6 L46 26 L32 58 L18 26 Z" fill="#5a9aff" stroke="#e0f0ff" stroke-width="2"/>`,
  card: `<rect x="12" y="16" width="40" height="30" rx="4" fill="#GG" stroke="#5a3a10" stroke-width="2"/><path d="M18 24 h18 M18 31 h12" stroke="#5a3a10" stroke-width="3"/><circle cx="44" cy="38" r="5" fill="#c0283a"/>`,
};
const W = { ad: 22, ap: 13, armor: 18, mr: 18, hp: 1.8, ms: 12, crit: 3500, ls: 4500, sv: 3500, as: 2200, res: 1.5, resr: 30 };
const RAR_BG = [['#3a3a3a', '#141414'], ['#5a5a5a', '#1a1a1a'], ['#1a5a24', '#04140a'], ['#1a3a7a', '#040c1e'], ['#4a1a7a', '#10041e'], ['#8a6a10', '#1e1404'], ['#8a1010', '#1e0404']];
function ability(hid, i) { const a = (AB[hid] || AB.ironvow)[i]; return frame(a[0], a[1], a[2]); }
function hero(hid) { const a = HERO[hid] || HERO.ironvow; return frame(a[0], a[1], a[2]); }
function item(it) {
  if (!it) return ''; let k = 'ad', best = -1;
  for (const s in it.s) { const v = it.s[s] * (W[s] || 1); if (v > best) { best = v; k = s; } }
  const bg = it.rar >= 0 ? RAR_BG[it.rar] : it.rar === -2 ? ['#1a5a6a', '#041418'] : ['#4a3a20', '#140e06'];
  return frame(bg[0], bg[1], ITEM[k] || ITEM.ad);
}
G.BOD_ICONS = { ability, hero, item, card: () => frame('#8a6a10', '#1e1404', ITEM.card) };
})(typeof window !== 'undefined' ? window : globalThis);
