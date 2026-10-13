(function () {
  function mkChannel(name, opts) {
    const key = (opts && opts.config && opts.config.presence && opts.config.presence.key) || Math.random() + '';
    const bus = window.__bus || (window.__bus = { subs: [] });
    const bc = { onmessage: null, postMessage(d) { const msg = { name, d }; bus.subs.forEach(s => { if (s !== bc && s.name === name && !s.closed) setTimeout(() => s.onmessage && s.onmessage({ data: d }), 0); }); if (window.__relayOut) window.__relayOut(JSON.stringify(msg)); }, close() { bc.closed = true; }, name };
    bus.subs.push(bc);
    if (!window.__relayIn) window.__relayIn = s => { const m = JSON.parse(s); window.__bus.subs.forEach(x => { if (x.name === m.name && !x.closed && x.onmessage) x.onmessage({ data: m.d }); }); };
    const handlers = []; let state = {}; let mine = null; let closed = false;
    const fire = () => handlers.filter(h => h.type === 'presence').forEach(h => h.cb());
    const ch = {
      on(type, filter, cb) { handlers.push({ type, event: filter.event, cb }); return ch; },
      subscribe(cb) { setTimeout(() => { cb && cb('SUBSCRIBED'); bc.postMessage({ k: 'hello', from: key }); }, 30); return ch; },
      track(p) { mine = p; state[key] = [p]; bc.postMessage({ k: 'pres', from: key, p }); fire(); return Promise.resolve(); },
      untrack() { mine = null; delete state[key]; bc.postMessage({ k: 'leave', from: key }); fire(); return Promise.resolve(); },
      presenceState() { return JSON.parse(JSON.stringify(state)); },
      send(m) { window.__sent = (window.__sent || 0) + 1; window.__bytes = (window.__bytes || 0) + JSON.stringify(m.payload).length; bc.postMessage({ k: 'b', event: m.event, payload: m.payload, from: key }); return Promise.resolve('ok'); },
      _close() { if (mine) bc.postMessage({ k: 'leave', from: key }); closed = true; bc.close(); }
    };
    bc.onmessage = e => { if (closed) return; const d = e.data;
      if (d.k === 'hello') { if (mine) bc.postMessage({ k: 'pres', from: key, p: mine }); }
      else if (d.k === 'pres') { state[d.from] = [d.p]; fire(); }
      else if (d.k === 'leave') { delete state[d.from]; fire(); }
      else if (d.k === 'b') handlers.filter(h => h.type === 'broadcast' && h.event === d.event).forEach(h => h.cb({ payload: d.payload })); };
    window.addEventListener('beforeunload', () => { if (mine) bc.postMessage({ k: 'leave', from: key }); });
    return ch;
  }
  // shared fake "bod_lobbies" table, synced between pages through the relay
  const db = window.__db = window.__db || {};
  const dbSend = (op, row) => { const m = { name: '__db', d: { op, row } }; if (window.__relayOut) window.__relayOut(JSON.stringify(m)); };
  window.__relayIn = s => { const m = JSON.parse(s); if (m.name === '__db') { const { op, row } = m.d; if (op === 'up') db[row.code] = row; else delete db[row.code]; return; } (window.__bus ? window.__bus.subs : []).forEach(x => { if (x.name === m.name && !x.closed && x.onmessage) x.onmessage({ data: m.d }); }); };
  const table = { upsert(row) { if (!(row.n >= 1 && row.n <= 4 && row.joined >= 0 && row.joined <= 4) || String(row.name).length > 40 || String(row.host).length > 20 || String(row.heroes).length > 120 || !(String(row.code).length >= 4 && String(row.code).length <= 8)) return Promise.resolve({ data: null, error: { message: 'violates check constraint (mock of bod_lobbies)' } }); const r = Object.assign({ created_at: (db[row.code] && db[row.code].created_at) || new Date().toISOString() }, row, { updated_at: Date.now() }); db[row.code] = r; dbSend('up', r); return Promise.resolve({ error: null }); },
    delete() { return { eq(k, v) { delete db[v]; dbSend('del', { code: v }); return Promise.resolve({ error: null }); } }; } };
  window.supabase = { createClient() { return { channel: mkChannel, removeChannel(ch) { ch._close(); }, from() { return table; },
    rpc(fn, args) { const now = Date.now(); return Promise.resolve({ data: Object.values(db).filter(r => r.version === args.p_version && now - r.updated_at < 20000 && r.joined < r.n), error: null }); } }; } };
})();
