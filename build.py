# Builds index.html. Player-facing version = v0.01 per shipped build (see BUILDS.json);
# the 6-char build id is the internal id used for auto-reload.
#   python3 build.py                 -> build; version = next unshipped number if sources changed since the last logged build
#   python3 build.py --ship "notes"  -> also record this build in BUILDS.json as a new version
import hashlib, json, pathlib, sys, datetime
root = pathlib.Path(__file__).parent; d = root / 'src'
sim = (d/'sim.js').read_text(); cli = (d/'client.js').read_text(); ico = (d/'icons.js').read_text(); tpl = (d/'index.template.html').read_text()
build = hashlib.sha1((sim + ico + cli + tpl).encode()).hexdigest()[-6:]
log_p = root / 'BUILDS.json'; log = json.loads(log_p.read_text()) if log_p.exists() else []
fmt = lambda n: '%d.%02d' % divmod(n, 100)
known = next((e for e in log if e['build'] == build), None)
ver = known['v'] if known else fmt(len(log) + 1)
if '--ship' in sys.argv and not known:
    notes = sys.argv[sys.argv.index('--ship') + 1] if len(sys.argv) > sys.argv.index('--ship') + 1 else ''
    log.append({'v': ver, 'build': build, 'commit': '', 'date': datetime.date.today().isoformat(), 'notes': notes})
    log_p.write_text('[\n' + ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in log) + '\n]\n')
out = tpl.replace('__BUILD__', build).replace('__VER__', ver).replace('/*__SIM__*/', sim.replace('</script', '<\\/script')).replace('/*__ICONS__*/', ico.replace('</script', '<\\/script')).replace('/*__CLIENT__*/', cli.replace('</script', '<\\/script'))
(root/'index.html').write_text(out)
(root/'version.json').write_text(json.dumps({'version': build, 'v': ver}) + '\n')
print('v' + ver, 'build', build, len(out), 'bytes', '(shipped)' if '--ship' in sys.argv or known else '(unshipped)')
