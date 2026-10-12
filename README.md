# Break of Day

Co-op MOBA-style game vs the computer (1–4 players). Push lanes by day, hold towns, survive deadly nights, slay the Wardens and destroy the enemy Core.

**Play:** https://elijahwmaverick.github.io/break-of-day/

## Development
- Edit files in `src/` (`sim.js` = game rules/simulation, `client.js` = 3D, HUD, lobby, netcode, `index.template.html` = page + styles).
- Run `python3 build.py` to regenerate `index.html` (prints the build id).
- `node tests/quick-test.js` runs headless gameplay checks (attack tap/hold, walk-to-cast, outposts blocking waves, 12 min of bot play).
- `node tests/ability-test.js` casts every hero ability: skill shots fire immediately, area/targeted abilities aimed out of range walk into range then cast.
- `node tests/browser-test.js` runs a two-player lobby → match → rejoin → victory flow in headless Chromium (mocked network).
- `node tests/shot.js out.png [w] [h]` renders a real WebGL screenshot of a solo match.
- Online lobbies use Supabase Realtime (Connect War project). The host's browser runs the match; guests can rejoin after a disconnect.
