(function () {
  function any() { const store = {}; const f = function () { }; return new Proxy(f, {
    get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'valueOf') return () => 0; if (k === 'toString') return () => '0'; if (k === 'then' || typeof k === 'symbol') return undefined; if (k in store) return store[k]; store[k] = any(); return store[k]; },
    set(t, k, v) { store[k] = v; return true; }, apply() { return any(); }, construct() { return any(); } }); }
  function vec(s) { const v = { x: s || 0, y: s || 0, z: s || 0, set(x, y, z) { v.x = x; v.y = y; v.z = z; return v; }, setScalar(a) { v.x = v.y = v.z = a; return v; }, copy(o) { return v; }, clone() { return vec(); }, project() { return v; }, lerp() { return v; }, setHex() { return v; }, getHex() { return 0; } }; return wrap(v); }
  function wrap(o) { return new Proxy(o, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'symbol' || k === 'then') return undefined; t[k] = any(); return t[k]; } }); }
  function obj() { const o = { position: vec(), rotation: vec(), scale: vec(1), userData: {}, children: [], visible: true, material: wrap({ color: vec(), opacity: 1, dispose() { } }), add(...a) { o.children.push(...a); }, remove() { }, lookAt() { }, updateProjectionMatrix() { }, setMatrixAt() { } }; return wrap(o); }
  window.THREE = new Proxy({}, { get(t, k) {
    if (k === 'WebGLRenderer') return function () { const r = obj(); r.domElement = document.createElement('canvas'); r.render = () => { window.__frames = (window.__frames || 0) + 1; }; return r; };
    if (k === 'Vector3' || k === 'Vector2' || k === 'Color') return function () { return vec(); };
    if (k === 'Raycaster') return function () { return wrap({ setFromCamera() { }, ray: wrap({ intersectPlane(pl, p) { return p; } }) }); };
    if (k === 'DoubleSide') return 2;
    return function () { return obj(); };
  } });
})();
