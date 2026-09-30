#!/usr/bin/env node
// c2c_proof.js - THE EDITOR'S LIVE PATH, PROVED ON A LIVE PAGE (G842, C2c; the user's constraint of 2026-09-29: "draw a
// pier with a boat, see it built, save, reload, see it from the cache"). Drives a page kept up by tools/live_driver.js
// (KEEP_PREM=1 so the editor's save survives /reload; its own short profile; under the GPU lock):
//   node tools/perf/c2c_proof.js <cmdPort> <phase> [evidenceDir]
//   phase boot    the one loading, the roll-out, the flight paused
//   phase draw    the editor opened; a gravel road and a HARBOUR zone drawn on Jolene's west shore (G843: its houses reach
//                 the waterline and stand their piers and boats); waits until the new houses stand; their worker account
//                 (generated off the page's thread: the page's own generation count unchanged); a still; the save (the
//                 editor's autosave into flydiy.premises.game.jolene); the editor closed
//   phase after   (after /reload + boot) the saved zone composed at boot; its houses from the house worker's CACHE (the
//                 worker generated none of them); the same still
//   phase clear   the saved record removed (the fixture again)
//   phase shot    a still of a premises box (env BOX='x0,z0,x1,z1', YAW, PITCH, NAME)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = +process.argv[2], PHASE = process.argv[3], DIR = path.resolve(process.argv[4] || path.join(__dirname, 'c2c_evidence'));
const post = (p, body) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'POST' }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }); r.on('error', rej); r.end(body); });
const get = p => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }).on('error', rej));
const run = async body => { const v = await post('/run', body); try { return JSON.parse(v); } catch (e) { return v; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (body, ms, what) => { const t0 = Date.now(); for (;;) { const v = await run(body); if (v === true) return true; if (Date.now() - t0 > ms) throw new Error('timeout: ' + what + ' (' + JSON.stringify(v).slice(0, 200) + ')'); await sleep(1000); } };
const shot = async name => { fs.mkdirSync(DIR, { recursive: true }); const f = path.join(DIR, name + '.png'); await get('/shot?f=' + encodeURIComponent(f)); console.log('  still ' + path.relative(process.cwd(), f)); return f; };
// the drawing (premises coordinates = world on Jolene: anchor 0, 0, yaw 0), found on the headless compose (G843's probe)
const ROAD = { pts: [[250, -2760], [290, -2840], [310, -2920], [320, -2990]], w: 4, cls: 'gravel', graded: true, falloff: 6 };
const ZONE = { kind: 'harbour', poly: [[170, -2730], [400, -2730], [420, -3000], [200, -3010]], density: 1 };
const BOX = { x0: 200, z0: -2860, x1: 330, z1: -2740 };
const WORKER = 'return (() => { const R = WORLD.premises, S = HOUSE_WORKER && HOUSE_WORKER.stats ? HOUSE_WORKER.stats() : {}; return { built: S.built, hits: S.hits, misses: S.misses, on: S.on, here: R.hw ? R.hw.local : null, dispatched: R.hw ? R.hw.dispatched : null, tallies: R.stats.tallies, hitBase: R.stats.hitBase, hitWalk: R.stats.hitWalk, queued: R.stats.queued, houses: R.houses.size }; })();';
const HIDE = on => `const P = PREMISES_EDITOR, v = ${on ? "'hidden'" : "''"}; if (P.panel) P.panel.style.visibility = v; const V = document.getElementById('premView'); if (V) for (const c of V.children) c.style.visibility = v; const G = WORLD.premises.groups; G.outlines.visible = ${!on}; G.handles.visible = ${!on}; return 1;`;
const MINE = zid => `return (() => { const R = WORLD.premises, out = []; for (const [id, h] of R.houses) { if (String(id).indexOf(${JSON.stringify(zid + ':')}) !== 0) continue; let pier = 0, boats = 0, props = 0; const keys = []; h.grp.traverse(o => { const k = o.userData && o.userData.prop && (o.userData.prop.key || o.name); if (k) { props++; keys.push(k); if (/^pier_/.test(k)) pier++; if (/boat/.test(k)) boats++; } }); for (const g of h.extra || []) g.traverse(o => { const k = o.userData && o.userData.prop && (o.userData.prop.key || o.name); if (k && /boat/.test(k)) boats++; }); out.push({ id, failed: !!h.failed, tris: h.tris, pier, boats, props, obst: (h.grp.userData.obst || []).length, shape0: !!h.grp.userData.shape0 }); } return out; })();`;
async function view(name, yaw, pitch) {
  await run('PREMISES_EDITOR.openEditor(); return 1;');
  await until('return !!(PREMISES_EDITOR.open && PREMISES_EDITOR.ed);', 120000, 'the editor opened');
  await run(`const H = PREMISES_EDITOR.host; H.cameras.set('orbit'); H.cameras.frame(${JSON.stringify(BOX)}); H.cameras.look(${yaw}, ${pitch}); return 1;`); await run(HIDE(true));
  await sleep(4000);
  const f = await shot(name);
  await run(HIDE(false));
  return f;
}
(async () => {
  if (PHASE === 'boot') {
    await until('return !!(window.BOOT && BOOT.whenReady);', 240000, 'BOOT');
    await run('await BOOT.whenReady(); return 1;');
    for (let i = 0; i < 8; i++) { await run("[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent).forEach(x=>x.click()); return 1;"); await sleep(400); }
    const w0 = await run(WORKER); console.log('  at the shed: ' + JSON.stringify(w0));
    await run("[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)&&b.offsetParent).forEach(x=>x.click()); return 1;");
    await until("return window.BOOT && BOOT.state === 'gone';", 400000, 'the roll-out');
    await sleep(3000);
    console.log('  rolled out: ' + JSON.stringify(await run(WORKER)));
    console.log('  steps: ' + JSON.stringify(await run("return (window.BOOT && BOOT.log || []).filter(e => e.k === 'step' && /^(world|town|settle|parked)$/.test(e.id)).map(e => e.id + ' ' + e.ms);")));
    return;
  }
  if (PHASE === 'draw') {
    const w0 = await run(WORKER); console.log('  before the edit: ' + JSON.stringify(w0));
    await run('PREMISES_EDITOR.openEditor(); return 1;');
    await until('return !!(PREMISES_EDITOR.open && PREMISES_EDITOR.ed);', 120000, 'the editor opened');
    const rid = await run(`return PREMISES_EDITOR.ed.cmd('add', { layer: 'roads', entry: ${JSON.stringify(ROAD)} });`);
    const zid = await run(`return PREMISES_EDITOR.ed.cmd('add', { layer: 'zones', entry: ${JSON.stringify(ZONE)} });`);
    console.log('  drawn: road ' + rid + ', harbour zone ' + zid);
    const t0 = Date.now();
    for (let k = 0; ; k++) {
      const st = await run(`return (() => { const R = WORLD.premises, want = R.plots().filter(p => String(p.id).indexOf(${JSON.stringify(zid + ':')}) === 0).length; let n = 0; for (const [id, h] of R.houses) if (String(id).indexOf(${JSON.stringify(zid + ':')}) === 0 && !h.failed) n++; return { want, n, order: R.hw.order.length, due: !!R.hw.composeDue, epoch: R.hw.epoch, dispatched: R.hw.dispatched, placed: R.hw.placed, queued: R.stats.queued }; })();`);
      if (k % 5 === 0) console.log('  +' + ((Date.now() - t0) / 1000).toFixed(0) + ' s ' + JSON.stringify(st));
      if (st && st.want > 0 && st.n >= st.want) break;
      if (Date.now() - t0 > 400000) throw new Error('timeout: the harbour built ' + JSON.stringify(st));
      await sleep(2000);
    }
    const mine = await run(MINE(zid)), w1 = await run(WORKER);
    console.log('  built in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s: ' + JSON.stringify(mine));
    console.log('  worker after the edit: ' + JSON.stringify(w1) + '  (generated here on the page: ' + ((w1.here || 0) - (w0.here || 0)) + ')');
    await run(`const H = PREMISES_EDITOR.host; H.cameras.set('orbit'); H.cameras.frame(${JSON.stringify(BOX)}); H.cameras.look(0.9, 0.42); return 1;`); await run(HIDE(true));
    await sleep(5000);
    await shot('c2c_editor_1_drawn');
    await run(HIDE(false));
    const saved = await run(`return (() => { const k = Object.keys(localStorage).find(k => /^flydiy\\.premises\\.game/.test(k)); const v = k ? localStorage.getItem(k) : ''; return { key: k, bytes: v.length, zone: v.indexOf(${JSON.stringify(zid)}) >= 0, road: v.indexOf(${JSON.stringify(rid)}) >= 0, town: (v.match(/"mk_/g) || []).length }; })();`);
    console.log('  saved: ' + JSON.stringify(saved));
    await run('PREMISES_EDITOR.close(); return 1;');
    fs.writeFileSync(path.join(DIR, 'c2c_editor_ids.json'), JSON.stringify({ rid, zid, mine, w0, w1, saved }, null, 1));
    return;
  }
  if (PHASE === 'after') {
    const ids = JSON.parse(fs.readFileSync(path.join(DIR, 'c2c_editor_ids.json'), 'utf8'));
    const w = await run(WORKER), mine = await run(MINE(ids.zid));
    console.log('  after the reload: worker ' + JSON.stringify(w));
    console.log('  the saved harbour: ' + JSON.stringify(mine));
    await run(`const H = PREMISES_EDITOR; H.openEditor(); return 1;`);
    await until('return !!(PREMISES_EDITOR.open && PREMISES_EDITOR.ed);', 120000, 'the editor opened');
    await run(`const H = PREMISES_EDITOR.host; H.cameras.set('orbit'); H.cameras.frame(${JSON.stringify(BOX)}); H.cameras.look(0.9, 0.42); return 1;`); await run(HIDE(true));
    await sleep(5000);
    await shot('c2c_editor_2_reloaded');
    await run(HIDE(false)); await run('PREMISES_EDITOR.close(); return 1;');
    Object.assign(ids, { after: { w, mine } });
    fs.writeFileSync(path.join(DIR, 'c2c_editor_ids.json'), JSON.stringify(ids, null, 1));
    return;
  }
  if (PHASE === 'clear') { console.log(await run('for (const k of Object.keys(localStorage)) if (/^flydiy\\.premises\\.game/.test(k)) localStorage.removeItem(k); return 1;')); return; }
  if (PHASE === 'house') {   // env ZONE (id prefix of the houses), NAME; a still from four sides of the zone's IDX-th house
    const zone = process.env.ZONE || 'z_harbour', idx = +(process.env.IDX || 0);
    const at = await run(`return (() => { const R = WORLD.premises, L = []; for (const [id, h] of R.houses) if (id.indexOf(${JSON.stringify(zone)}) === 0 && h.grp) { const p = h.grp.position; L.push([id, p.x, p.z]); } L.sort(); const F = R.overlay.frame; return L.map(q => { const l = F.toLocal(q[1], q[2]); return [q[0], l[0], l[1]]; }); })();`);
    console.log('  houses of ' + zone + ': ' + JSON.stringify(at).slice(0, 300));
    if (!at || !at.length) throw new Error('no house of ' + zone);
    const h = at[Math.min(idx, at.length - 1)];
    await run('PREMISES_EDITOR.openEditor(); return 1;');
    await until('return !!(PREMISES_EDITOR.open && PREMISES_EDITOR.ed);', 120000, 'the editor opened');
    await run(HIDE(true));
    for (const [k, yaw] of [['n', 0], ['e', Math.PI / 2], ['s', Math.PI], ['w', -Math.PI / 2]]) {
      await run(`const H = PREMISES_EDITOR.host; H.cameras.set('orbit'); H.cameras.frame({ x0: ${h[1] - 18}, z0: ${h[2] - 18}, x1: ${h[1] + 18}, z1: ${h[2] + 18} }); H.cameras.look(${yaw}, ${+(process.env.PITCH || 0.32)}); return 1;`);
      await sleep(3500);
      await shot((process.env.NAME || 'c2c_house') + '_' + k);
    }
    await run(HIDE(false)); await run('PREMISES_EDITOR.close(); return 1;');
    return;
  }
  if (PHASE === 'shot') {
    const b = (process.env.BOX || '').split(',').map(Number);
    const bb = b.length === 4 ? { x0: b[0], z0: b[1], x1: b[2], z1: b[3] } : BOX;
    await run('PREMISES_EDITOR.openEditor(); return 1;');
    await until('return !!(PREMISES_EDITOR.open && PREMISES_EDITOR.ed);', 120000, 'the editor opened');
    await run(`const H = PREMISES_EDITOR.host; H.cameras.set('orbit'); H.cameras.frame(${JSON.stringify(bb)}); H.cameras.look(${+(process.env.YAW || 0.9)}, ${+(process.env.PITCH || 0.42)}); return 1;`); await run(HIDE(true));
    await sleep(6000);
    await shot(process.env.NAME || 'c2c_shot');
    await run(HIDE(false)); await run('PREMISES_EDITOR.close(); return 1;');
    return;
  }
  throw new Error('phase: boot | draw | after | clear | shot');
})().catch(e => { console.error('c2c_proof: ' + (e && e.message)); process.exit(1); });
