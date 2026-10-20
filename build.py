# Builds index.html from src/index.template.html.
# Player-facing version is v0.NN: +0.01 per shipped build (logged in BUILDS.json). v0.00 = nothing shipped yet.
#   python3 build.py                 -> build (version = next number if this build isn't logged yet)
#   python3 build.py --ship "notes"  -> also record this build in BUILDS.json as a new version
import hashlib, json, pathlib, sys, datetime
root = pathlib.Path(__file__).parent; d = root / 'src'
srcs = sorted(p for p in d.rglob('*') if p.is_file())
blob = b''.join(p.read_bytes() for p in srcs)
build = hashlib.sha1(blob).hexdigest()[-6:]
log_p = root / 'BUILDS.json'; log = json.loads(log_p.read_text()) if log_p.exists() else []
fmt = lambda n: '%d.%02d' % divmod(n, 100)
known = next((e for e in log if e['build'] == build), None)
shipping = '--ship' in sys.argv
ver = known['v'] if known else fmt(len(log) + 1) if shipping or log else fmt(len(log))
if shipping and not known:
    i = sys.argv.index('--ship'); notes = sys.argv[i + 1] if len(sys.argv) > i + 1 else ''
    log.append({'v': ver, 'build': build, 'commit': '', 'date': datetime.date.today().isoformat(), 'notes': notes})
    log_p.write_text('[\n' + ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in log) + '\n]\n' if log else '[]\n')
tpl = (d / 'index.template.html').read_text()
safe = lambda f: (d / f).read_text().replace('</script', '<\\/script')
import base64
assets = 'window.TD_ASSETS = { buildLoop: "data:audio/mpeg;base64,' + base64.b64encode((d / 'assets' / 'build-loop.mp3').read_bytes()).decode() + '" };'
out = tpl.replace('/*__LOG__*/[]', json.dumps([{'v': e['v'], 'date': e['date'], 'notes': e['notes']} for e in log], ensure_ascii=False).replace('</', '<\\/')).replace('__BUILD__', build).replace('__VER__', ver).replace('/*__GAME__*/', assets + '\n' + safe('game.js')).replace('/*__CLIENT__*/', safe('client.js').replace('const TD = window.TD;\n', 'const TD = window.TD;\n' + safe('tribe.js') + '\n', 1))
(root / 'index.html').write_text(out)
(root / 'knights.html').write_text((d / 'knights.html').read_text().replace('__BUILD__', build).replace("['__HELI_LIST__']", json.dumps([base64.b64encode((d / 'assets' / f'heli{i}.mp3').read_bytes()).decode() for i in range(1, 11)])).replace("'__HITMARK__'", json.dumps(base64.b64encode((d / 'assets' / 'hitmarker.mp3').read_bytes()).decode())))  # Knight Brawl: a separate co-op mode page

# Pose Bench (src/anim.html -> anim.html): the Storm Ogre's art (the OGX closure) and the game's hook poses inlined from knights.html
_kn = (d / 'knights.html').read_text(); _o0 = _kn.index('const OGX = (() => {'); _o1 = _kn.index('\n})();', _kn.index('return { drawO2', _o0)) + 6
_h0 = _kn.index('const OGHK = '); _h1 = _kn.index('// where the fist is in the world', _h0)
(root / 'anim.html').write_text((d / 'anim.html').read_text().replace('/*@OGX@*/', _kn[_o0:_o1] + '\n' + _kn[_h0:_h1]))
(root / 'audio').mkdir(exist_ok=True); (root / 'audio' / 'baroque-breakdown.mp3').write_bytes((d / 'assets' / 'baroque-breakdown.mp3').read_bytes())  # Knight Brawl music, served as a file (too big to inline)
(root / 'version.json').write_text(json.dumps({'version': build, 'v': ver}) + '\n')
print('v' + ver, 'build', build, len(out), 'bytes', '(shipped)' if shipping or known else '(unshipped)')
