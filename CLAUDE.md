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
