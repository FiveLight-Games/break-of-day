# Project notes

The previous game (Break of Day) was scrapped on 2026-10-13. Its full code (v0.15) is kept on the
`archive/break-of-day` branch. This repo is a clean slate for the next game.

## Versioning (standard for every game here)
- Player-facing version is `v0.NN`, +0.01 per shipped build; `v0.00` means nothing shipped yet. Show it in the game's main menu
  (put the internal build id in a tooltip, not on screen).
- `BUILDS.json` is the build log: version, internal 6-char build id, commit, date, notes.
- Normal builds: `python3 build.py`. When shipping (commit + push): `python3 build.py --ship "short notes"` once, then commit,
  then fill the previous entry's `commit` field on the next ship.
- `version.json` carries the build id (for client auto-reload) and the version.
- The page is served by GitHub Pages from `index.html` at the repo root.

## Current game: Hold the Line (working title) — 1vX tower defense
- `src/game.js`: shared rules + `Sim` (runs on the host's browser at 20 ticks/s). Maps (one lane per defender into a shared base), 24px grid with 2x2 towers (`footFree`), 3s build time, shared base HP 250/defender, per-second income, kill gold split evenly, 10s setup at the start (`RULES.setup`, no sends; unlock minutes and the 20-min window count from its end), full refund for towers sold within 10s of placing that haven't dealt damage (`refundable`), no waves: attacker sends spawn immediately (`spawnAt`, staggered per lane via `laneNext`), 20-min send window then finish-out, 19 attacker units with unlock minutes/packs/armor/resists and traits (`UNITS`; sapper sprints off-lane via `stepSapper` and knocks towers out (`t.off`), knight `charge`, troll `regen`, gnoll `packRage`, necro `raise` from `graves`, mammoth `spill`, shield `frontGuard`, golem/ent/ram damage multipliers), attacker upgrades (invest, unit speed +10%/level x5, new spawns only), defender spells (`SPELLS`: Meteor 125g + Water Jet 100g, 20s cooldowns; units have knockback `kb`/`lv`/`air`, synced via snapshot `mv`, jets via `jt`), AI attacker + defender bots (bots don't cast).
- `src/client.js`: menu, lobby (host-authoritative lobby state broadcast as `ls`), Supabase Realtime netcode (snapshots `s` at 5/s, inputs `in`), canvas renderer (flat vector, cached unit sprites, gore baked into ground tiles; deaths are jointed ragdolls via `rigFor`/`makeRag`/`stepRag` with limb loss scaled by how violent the kill was), HUD with build mode (drag from tray onto grid), spell bar (drag onto map or tap-then-tap), attacker panel built once and updated in place (keeps the unit row's scroll), synthesized SFX + generative music (Web Audio, toggles in the in-game menu).
- Lobby directory reuses the Supabase table `bod_lobbies` + RPC `bod_open_lobbies(p_version)` (filters by build id). The table CHECKs n/joined <= 4 (old game) but lobbies hold 5, so `lobbyRow()` stores capped values and the real count in `heroes` after a `|`. tests/supabase-mock.js enforces the same CHECKs.
- Tests: `node tests/lobby-test.js` (3 players + vs AI, mocked Supabase via tests/supabase-mock.js).
