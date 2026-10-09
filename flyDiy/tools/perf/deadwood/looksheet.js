// looksheet.js <outdir> <evidence dir> - the IMPOSTOR-LOOK sheet: 3D | A | B | D | S | D+S+c per frame, + the 1 km frames
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const [OUT, EV] = process.argv.slice(2).map(p => path.resolve(p));
const PORT = 9100 + (process.pid % 300);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const udd = path.join(require('os').tmpdir(), 'cdp_lk_' + PORT + '_' + Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const url = p => 'file:///' + p.replace(/\\/g, '/');
const V = [['A', 'A today'], ['B', 'B ao^4'], ['D', 'D fine AO'], ['S', 'S supersampled'], ['DSc', 'D+S+c']];
const J = {}; for (const [v] of V) for (const pr of ['g', 'p']) { const f = path.join(OUT, `L_${v}_${pr}_look.json`); if (fs.existsSync(f)) J[v + pr] = JSON.parse(fs.readFileSync(f)); }
const core = (v, pr, key, side, day) => { const j = J[v + pr]; const r = j && j.rows.find(x => x.key === key && x.side === side && x.day === day); return r ? r.core.toFixed(2) : '-'; };
const SUBJ = [['cedar_tree.glb|Cedar_LOD0', 'rungs', 'cedar'], ['larch_tree.glb|Larch_LOD0', 'rungs', 'larch'], ['spruce_tree.glb|Spruce_LOD0', 'rungs', 'spruce'], ['pine_georgeous.glb|Pine01_LOD0', 'rungs', 'pine'],
  ['larch_tree.glb|Larch_LOD0', 'snag', 'larch snag'], ['spruce_tree.glb|Spruce_LOD0', 'snag', 'spruce snag']];
const css = '<style>body{margin:0;background:#15181c;color:#e8e8e8;font:14px/1.3 system-ui,Segoe UI,sans-serif}h1{font-size:19px;margin:12px 14px 2px}h2{font-size:15px;margin:14px 14px 2px}p{margin:2px 14px 8px;color:#b9c0c8}' +
  'table{border-collapse:separate;border-spacing:5px}td{vertical-align:top;text-align:center;font-size:12px;color:#aab}td.l{width:120px;text-align:left;font-weight:600;color:#e8e8e8;vertical-align:middle}img{display:block;height:210px}img.w{height:auto;width:620px}th{font-weight:600;padding:2px}</style>';
let g = '<!doctype html><meta charset=utf-8>' + css + '<h1>Impostor look test - 3D | A today | B ao^4 | D fine AO | S supersampled bake | D+S+c (+ coverage-preserving mips)</h1>' +
  '<p>At the hand-over distance, front-lit. Under each picture: its brightness against the 3D (1.00 = equal). D\u2019s 3D wears the finer AO too (one source); the 3D column here is A\u2019s. Test branch only - the delivered trees are untouched.</p>';
for (const [pr, prn] of [['g', 'gamer'], ['p', 'potato']]) for (const day of ['golden', 'noon']) {
  g += `<h2>${prn}, ${day}</h2><table><tr><th></th><th>3D</th>${V.map(v => `<th>${v[1]}</th>`).join('')}</tr>`;
  for (const [k, ser, name] of SUBJ) {
    const base = `${k.replace(/[^a-z0-9]+/gi, '_')}_${ser}_away`;
    const geo = path.join(OUT, 'raw', `L_A_${pr}_${day}_${base}_geo.png`); if (!fs.existsSync(geo)) continue;
    g += `<tr><td class=l>${name}</td><td><img src="${url(geo)}"></td>`;
    for (const [v] of V) { const f = path.join(OUT, 'raw', `L_${v}_${pr}_${day}_${base}_pic.png`); g += `<td>${fs.existsSync(f) ? `<img src="${url(f)}">` : ''}${core(v, pr, k + '|' + ser, 'away', day)}</td>`; }
    g += '</tr>';
  }
  g += '</table>';
}
g += '<h2>1 km over the densest stand, gamer, golden</h2><table><tr>';
for (const [v, n] of V) { const f = path.join(OUT, 'raw', `L_${v}_g_golden_1km.png`); g += `<td>${n}${fs.existsSync(f) ? `<img class=w src="${url(f)}">` : ''}</td>`; if (v === 'B') g += '</tr><tr>'; }
g += '</tr></table>';
fs.writeFileSync(path.join(OUT, 'look_sheet.html'), g);
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + udd, '--allow-file-access-from-files', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
(async () => {
  let tgt = null; for (let i = 0; i < 40 && !tgt; i++) { await sleep(300); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(x => x.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const W = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; W.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await cmd('Page.enable'); const w = 2000;
  await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: url(path.join(OUT, 'look_sheet.html')) }); await sleep(3000);
  const m = await cmd('Page.getLayoutMetrics'); const cs = m.result.cssContentSize || m.result.contentSize;
  const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.ceil(cs.height), scale: 1 } });
  fs.mkdirSync(EV, { recursive: true }); fs.writeFileSync(path.join(EV, 'impostor_look_test_sheet.jpg'), Buffer.from(r.result.data, 'base64')); console.log('sheet', w, Math.ceil(cs.height));
  ws.close(); ch.kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
