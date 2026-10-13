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
- `src/game.js`: shared rules + `Sim` (runs on the host's browser at 20 ticks/s). Maps (one lane per defender into a shared base), 24px grid with 2x2 towers (`footFree`), 3s build time, shared base HP 250/defender, per-second income, kill gold split evenly, 20-min send window then finish-out, 8 attacker units with unlock minutes/packs/armor/resists (`UNITS`: Footman, Scout, Skeleton Horde, Ogre, Naga Myrmidon, Warg Rider, Ogre Warchief, Tarrasque), attacker upgrades (invest, unit speed +10%/level x5, new spawns only), defender spells (`SPELLS`: Meteor + Water Jet, free, 20s cooldowns; units have knockback `kb`/`lv`/`air`, synced via snapshot `mv`, jets via `jt`), AI attacker + defender bots (bots don't cast).
- `src/client.js`: menu, lobby (host-authoritative lobby state broadcast as `ls`), Supabase Realtime netcode (snapshots `s` at 5/s, inputs `in`), canvas renderer (flat vector, cached unit sprites, gore baked into ground tiles; deaths are jointed ragdolls via `rigFor`/`makeRag`/`stepRag` with limb loss scaled by how violent the kill was), HUD with build mode (drag from tray onto grid), spell bar (drag onto map or tap-then-tap), synthesized SFX + generative music (Web Audio, toggles in the in-game menu).
- Lobby directory reuses the Supabase table `bod_lobbies` + RPC `bod_open_lobbies(p_version)` (filters by build id).
- Tests: `node tests/lobby-test.js` (3 players + vs AI, mocked Supabase via tests/supabase-mock.js).
