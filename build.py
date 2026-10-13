# Builds index.html from src/index.template.html.
# Player-facing version is v0.NN: +0.01 per shipped build (logged in BUILDS.json). v0.00 = nothing shipped yet.
#   python3 build.py                 -> build (version = next number if this build isn't logged yet)
#   python3 build.py --ship "notes"  -> also record this build in BUILDS.json as a new version
import hashlib, json, pathlib, sys, datetime
root = pathlib.Path(__file__).parent; d = root / 'src'
srcs = sorted(p for p in d.rglob('*') if p.is_file())
blob = ''.join(p.read_text() for p in srcs)
build = hashlib.sha1(blob.encode()).hexdigest()[-6:]
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
out = tpl.replace('__BUILD__', build).replace('__VER__', ver).replace('/*__GAME__*/', safe('game.js')).replace('/*__CLIENT__*/', safe('client.js'))
(root / 'index.html').write_text(out)
(root / 'version.json').write_text(json.dumps({'version': build, 'v': ver}) + '\n')
print('v' + ver, 'build', build, len(out), 'bytes', '(shipped)' if shipping or known else '(unshipped)')
