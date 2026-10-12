# Break of Day

Co-op MOBA-style game vs the computer (1–4 players). Push lanes by day, hold towns, survive deadly nights, slay the Wardens and destroy the enemy Core.

**Play:** https://elijahwmaverick.github.io/break-of-day/

## Development
- Edit files in `src/` (`sim.js` = game rules/simulation, `client.js` = 3D, HUD, lobby, netcode, `index.template.html` = page + styles).
- Run `python3 build.py` to regenerate `index.html` (prints the build id).
- `node tests/sim-test.js` runs a headless full match with bot heroes.
- Online lobbies use Supabase Realtime (Connect War project). The host's browser runs the match; guests can rejoin after a disconnect.
