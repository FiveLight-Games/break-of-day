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
EDGEFADE = {'fire': 'lr'}
FADEBAND = {'priest': 0.4}  # how much of the figure (from the bottom) the fade covers; the Warpriest's starts at his elbows
def demist(im, kind=''):  # the painted portraits end in a white mist; fade the bottom 26% of the figure out to transparent instead
    import numpy as np
    from PIL import Image
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    rows = np.where((a[..., 3] > 12).any(axis=1))[0]; bot = rows[-1]; H = bot - rows[0]; b0 = bot - H * FADEBAND.get(kind, 0.26)
    t = np.clip((np.arange(a.shape[0])[:, None] - b0) / (bot - b0), 0, 1)
    a[..., 3] *= (1 - t * t * (3 - 2 * t)) ** 2.2
    # where the figure is cut off by the frame (EDGEFADE: the Firebreather's arms and headdress, the Warpriest's pauldrons), fade it out toward that side too,
    # over 12% of the figure's own width/height measured from its outermost pixels
    h, w = a.shape[:2]; sm = lambda u: u * u * (3 - 2 * u); al = a[..., 3] > 12
    cols = np.where(al.any(axis=0))[0]; top = rows[0]
    for side in EDGEFADE.get(kind, ''):
        if side == 't': d = np.arange(h, dtype=np.float32) - top; f = sm(np.clip(d / (H * 0.12), 0, 1)); a[..., 3] *= f[:, None]; continue
        W0 = cols[-1] - cols[0]; d = (np.arange(w, dtype=np.float32) - cols[0]) if side == 'l' else (cols[-1] - np.arange(w, dtype=np.float32))
        f = sm(np.clip(d / (W0 * 0.12), 0, 1)); a[..., 3] *= f[None, :]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
PMASKV = {'ninja': 0.33}  # brightest-only blues (his dark gi is blue-black)
PMASKNO = {'ogre', 'gi'}  # nothing in their paintings is the player's colour (the ogre's ice and lightning are blue)
def pmask(im, kind):  # 0-255 weight of the base blue (#3a7bd5) by hue, saturation and brightness
    import numpy as np
    if kind in PMASKNO: return None
    a = np.asarray(im.convert('RGBA')).astype(np.float32); r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); dd = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
    w = np.clip(1 - np.abs(h - 222) / 30, 0, 1) * np.clip((s - 0.25) / 0.2, 0, 1) * np.clip((mx - PMASKV.get(kind, 0.12)) / 0.1, 0, 1) * (a[..., 3] / 255)
    return (w * 255).astype(np.uint8)
def portraits():  # cutscene portraits: src/portraits/<kind>-<hex colour>.png -> webp data urls (up to 1100px tall, sharp on 3x phone screens) data urls keyed 'kind|#hex'
    import io
    from PIL import Image
    out = {}
    for f in sorted((d / 'portraits').glob('*.png')):
        kind, col = f.stem.rsplit('-', 1)
        im = demist(Image.open(f), f.stem.rsplit('-', 1)[0]); im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()); H = min(1100, im.height); k = H / im.height  # trimmed to the figure
        if H != im.height: im = im.resize((round(im.width * k), H), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'WEBP', quality=90, method=6)
        out[kind + '|#' + col.lower()] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
        m = pmask(im, kind)  # where the player's colour is painted (the blue set only); the page recolours those parts
        if m is not None and col.lower() == '3a7bd5':
            mi = Image.fromarray(m).resize((im.width // 2, im.height // 2), Image.BILINEAR); b = io.BytesIO(); mi.save(b, 'PNG', optimize=True)
            out[kind + '|mask'] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
    return json.dumps(out)
(root / 'knights.html').write_text((d / 'knights.html').read_text().replace('/*@SURVIVAL@*/', (d / 'survival.js').read_text()).replace('/*@STAGEKIT@*/', (d / 'stagekit.js').read_text()).replace('/*@CAMPAIGN@*/', (d / 'campaign.js').read_text()).replace('/*@STAGEDIT@*/', (d / 'stagedit.js').read_text()).replace("'__PORTRAITS__'", portraits()).replace('__BUILD__', build).replace("['__HELI_LIST__']", json.dumps([base64.b64encode((d / 'assets' / f'heli{i}.mp3').read_bytes()).decode() for i in range(1, 11)])).replace("'__HITMARK__'", json.dumps(base64.b64encode((d / 'assets' / 'hitmarker.mp3').read_bytes()).decode())).replace("'__OGCLIP_STORM__'", (d / 'anims' / 'storm-hook-right.baked.json').read_text()))  # Knight Brawl: a separate co-op mode page

# Pose Bench (src/anim.html -> anim.html): the Storm Ogre's art (the OGX closure) and the game's hook poses inlined from knights.html
_kn = (d / 'knights.html').read_text(); _o0 = _kn.index('const OGX = (() => {'); _o1 = _kn.index('\n})();', _kn.index('return { drawO2', _o0)) + 6
_h0 = _kn.index('const OGHK = '); _h1 = _kn.index('// where the fist is in the world', _h0)
# + the ogre's recorded animation library (src/ogre-anims.json, made by tools/record-ogre.js)
_lib = (d / 'ogre-anims.json').read_text() if (d / 'ogre-anims.json').exists() else '{"folders": []}'
# + the Knight's recorded ability animations (src/knight-anims.json, made by tools/record-knight.js)
_klib = (d / 'knight-anims.json').read_text() if (d / 'knight-anims.json').exists() else '{"clips": []}'
# + the Knight's drawing (body parts, sword, light blade) and his swing keys, for the Knight actor (wrapped in the bench's KNX closure)
_cut = lambda a, b: _kn[_kn.index(a):_kn.index(b, _kn.index(a))]
_line = lambda a: _kn[_kn.index(a):_kn.index('\n', _kn.index(a))]
_knx = '\n'.join([_line('function shade('), _line('function ik('), _line('const STEEL = '), _cut('function sword(c, g, a', '// ---------- knight state'), _cut('const G_ = [', '// light-blade size per swing'), _cut('function kfnS(', 'function kfn('), _cut('function leg(c, hip', '// ---------- enemies')])
(root / 'anim.html').write_text((d / 'anim.html').read_text().replace('/*@OGX@*/', _kn[_o0:_o1] + '\n' + _kn[_h0:_h1]).replace('/*@KNX@*/', _knx).replace('/*@OGLIB@*/', 'const OG_LIB = ' + _lib + ';\nconst KN_LIB = ' + _klib + ';'))
(root / 'audio').mkdir(exist_ok=True); (root / 'audio' / 'baroque-breakdown.mp3').write_bytes((d / 'assets' / 'baroque-breakdown.mp3').read_bytes())  # Knight Brawl music, served as a file (too big to inline)
(root / 'version.json').write_text(json.dumps({'version': build, 'v': ver}) + '\n')
print('v' + ver, 'build', build, len(out), 'bytes', '(shipped)' if shipping or known else '(unshipped)')
