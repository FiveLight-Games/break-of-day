# Break of Day — project notes

## Versioning
- Player-facing version is `v0.NN`, +0.01 per shipped build. Shown in the main menu (build id in its tooltip).
- `BUILDS.json` is the build log: version, internal 6-char build id, commit, date, notes.
- Normal builds: `python3 build.py`. When shipping (commit + push): `python3 build.py --ship "short notes"` once, then commit.
- `version.json` carries the build id (drives client auto-reload) and the version.
