import hashlib, pathlib
d = pathlib.Path(__file__).parent / 'src'
sim = (d/'sim.js').read_text(); cli = (d/'client.js').read_text(); tpl = (d/'index.template.html').read_text()
build = hashlib.sha1((sim + cli + tpl).encode()).hexdigest()[-6:]
out = tpl.replace('__BUILD__', build).replace('/*__SIM__*/', sim.replace('</script', '<\\/script')).replace('/*__CLIENT__*/', cli.replace('</script', '<\\/script'))
(d.parent/'index.html').write_text(out)
print('build', build, len(out), 'bytes')
