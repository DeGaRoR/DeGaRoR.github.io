// mxsheet.js <outdir> <evidence dir> - the mix-dead sheet and table as JPEGs, laid out in a headless Chrome page (file://)
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const [OUT, EV] = process.argv.slice(2).map(p => path.resolve(p));
const FLY = 'D:/Dev/DeGaRoR.github.io/.claude/worktrees/upbeat-williams-52587e/flyDiy';
const PORT = 9100 + (process.pid % 300);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const udd = path.join(require('os').tmpdir(), 'cdp_mx_' + PORT + '_' + Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const url = p => 'file:///' + p.replace(/\\/g, '/');
// ---- the pages ----
const ROWS = [['1stand', 'the stand, the chase camera after the roll-out (nearly, not exactly, the same frame)'], ['3alt300', '300 m over the densest stand'], ['4alt1000', '1 km over the densest stand']];
const css = '<style>body{margin:0;background:#15181c;color:#e8e8e8;font:15px/1.35 system-ui,Segoe UI,sans-serif}h1{font-size:20px;margin:14px 16px 4px}p{margin:2px 16px 10px;color:#b9c0c8}' +
  'table.g{border-collapse:separate;border-spacing:8px}td{vertical-align:top}td.l{width:150px;font-weight:600;padding-top:8px}img{width:960px;display:block}th{font-weight:600;text-align:left;padding:4px 8px}' +
  'table.t{border-collapse:collapse;margin:6px 16px 18px}table.t td,table.t th{border-bottom:1px solid #333a42;padding:4px 10px;font-variant-numeric:tabular-nums}.hi{color:#ffb86b}</style>';
let g = '<!doctype html><meta charset=utf-8>' + css + '<h1>Dead trees: today (left) vs the mixes\' own share (right) - gamer, Jolene near HOME</h1>' +
  '<p>The same frame in both columns (the stand: the chase camera after the roll-out, nearly the same). Right = <code>?mixdead=1</code> (the switch, OFF by default). Rows: noon then golden hour.</p><table class=g><tr><th></th><th>TODAY (the collection\'s share: pine_georgeous 53 % dead)</th><th>THE MIXES\' SHARE (?mixdead=1)</th></tr>';
for (const [k, lab] of ROWS) for (const day of ['noon', 'golden'])
  g += `<tr><td class=l>${lab}<br><span style="font-weight:400;color:#9aa3ad">${day}</span></td><td><img src="${url(path.join(OUT, 'raw', `mx_off_${k}_${day}.png`))}"></td><td><img src="${url(path.join(OUT, 'raw', `mx_on_${k}_${day}.png`))}"></td></tr>`;
g += '</table>';
fs.writeFileSync(path.join(OUT, 'mx_sheet.html'), g);
// the table: what each mix asks, what is dealt today, what is drawn near HOME
const pack = require(path.join(FLY, 'src/core/trees_pack.json'));
const cols = {}; for (const c of (Array.isArray(pack.collections) ? pack.collections : Object.values(pack.collections))) cols[c.name || c.key] = c;
const off = JSON.parse(fs.readFileSync(path.join(OUT, 'mx_off_census.json'))), on = JSON.parse(fs.readFileSync(path.join(OUT, 'mx_on_census.json')));
let t = '<!doctype html><meta charset=utf-8>' + css + '<h1>Dead trees: the share each mix asks for, against what is drawn</h1>' +
  '<p>TODAY every tree of a species is dealt its COLLECTION\'s share (trees_pack.json place.dead), whatever mix it stands in; the switch deals the MIX\'s own share (the collection\'s where the mix names none). Highlighted: where they differ.</p>' +
  '<table class=t><tr><th>mix</th><th>species</th><th>the mix asks</th><th>dealt today</th></tr>';
for (const m of Object.keys(pack.biomes.mixes)) for (const [sp, o] of Object.entries(pack.biomes.mixes[m].species)) {
  const c = cols[sp]; if (!c || c.kind !== 'tree') continue;
  const ask = o.dead === undefined ? null : +o.dead, today = (c.place && c.place.dead) || 0, d = ask !== null && Math.abs(ask - today) > 1e-9;
  t += `<tr${d ? ' class=hi' : ''}><td>${m}</td><td>${sp.replace(/\.glb$/, '')}</td><td>${ask === null ? '- (the collection\'s)' : (ask * 100).toFixed(0) + ' %'}</td><td>${(today * 100).toFixed(0)} %</td></tr>`;
}
t += '</table><h1>Drawn within 3 km of HOME (the planted trees, counted)</h1><table class=t><tr><th>subject</th><th>today: snags / living</th><th>dead</th><th>switch on: snags / living</th><th>dead</th></tr>';
let DS = 0; for (const k of Object.keys(off.keys)) { if (/^dead_/.test(k)) { DS += off.keys[k].live; t += `<tr><td>${k.replace(/\|/, ' | ')}</td><td colspan=4>a DEAD species: ${off.keys[k].live} standing, every one dead - the same with the switch</td></tr>`; continue; }
  const a = off.keys[k], b = on.keys[k] || { snags: 0, live: 0 }; const sa = a.snags / Math.max(1, a.snags + a.live), sb = b.snags / Math.max(1, b.snags + b.live);
  t += `<tr${Math.abs(sa - sb) > 0.02 ? ' class=hi' : ''}><td>${k.replace(/\.glb\|/, ' | ')}</td><td>${a.snags} / ${a.live}</td><td>${(sa * 100).toFixed(1)} %</td><td>${b.snags} / ${b.live}</td><td>${(sb * 100).toFixed(1)} %</td></tr>`; }
const LA = off.total.live - DS, LB = on.total.live - DS, all = (S, L) => ((S + DS) / Math.max(1, S + L + DS) * 100).toFixed(1);
t += `<tr><th>the living species</th><th>${off.total.snags} / ${LA}</th><th>${(off.total.snags / Math.max(1, off.total.snags + LA) * 100).toFixed(1)} %</th><th>${on.total.snags} / ${LB}</th><th>${(on.total.snags / Math.max(1, on.total.snags + LB) * 100).toFixed(1)} %</th></tr>` +
  `<tr><th>every tree dead, the dead species included</th><th></th><th>${all(off.total.snags, LA)} %</th><th></th><th>${all(on.total.snags, LB)} %</th></tr></table>` +
  `<p>The near tier at the stand (what is drawn as geometry): today ${off.census.tris.reduce((a, b) => a + b, 0).toLocaleString('en')} triangles, switch on ${on.census.tris.reduce((a, b) => a + b, 0).toLocaleString('en')} - the living trees that replace the snags carry 2-4x their triangles.</p>`;
fs.writeFileSync(path.join(OUT, 'mx_table.html'), t);
// ---- shoot them ----
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + udd, '--allow-file-access-from-files', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
(async () => {
  let tgt = null; for (let i = 0; i < 40 && !tgt; i++) { await sleep(300); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(x => x.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const W = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; W.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await cmd('Page.enable');
  for (const [html, jpg, w] of [['mx_sheet.html', 'mixdead_sheet.jpg', 2140], ['mx_table.html', 'mixdead_table.jpg', 1100]]) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: url(path.join(OUT, html)) }); await sleep(2500);
    const m = await cmd('Page.getLayoutMetrics'); const cs = m.result.cssContentSize || m.result.contentSize;
    const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.ceil(cs.height), scale: 1 } });
    fs.writeFileSync(path.join(EV, jpg), Buffer.from(r.result.data, 'base64')); console.log(jpg, w, Math.ceil(cs.height));
  }
  ws.close(); ch.kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
