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
// ---- the pages (impsheet: IMPOSTOR-MATCH G2590-G2591, 3D | today | fixed at the hand-over, gamer + potato) ----
const css = '<style>body{margin:0;background:#15181c;color:#e8e8e8;font:15px/1.35 system-ui,Segoe UI,sans-serif}h1{font-size:20px;margin:14px 16px 4px}h2{font-size:16px;margin:16px 16px 4px}p{margin:2px 16px 10px;color:#b9c0c8}' +
  'table.g{border-collapse:separate;border-spacing:8px}td{vertical-align:middle}td.l{width:190px;font-weight:600}img{display:block;height:300px}img.w{height:auto;width:960px}th{font-weight:600;text-align:left;padding:4px 8px}</style>';
const SUBJ = [['cedar_tree_glb_Cedar_LOD0_rungs', 'cedar'], ['larch_tree_glb_Larch_LOD0_rungs', 'larch'], ['spruce_tree_glb_Spruce_LOD0_rungs', 'spruce'], ['pine_georgeous_glb_Pine01_LOD0_rungs', 'pine'],
  ['larch_tree_glb_Larch_LOD0_snag', 'larch snag'], ['pine_georgeous_glb_Pine01_LOD0_snag', 'pine snag'], ['spruce_tree_glb_Spruce_LOD0_snag', 'spruce snag'], ['dead_conifer_Coniferous_Dead_Tree_13_rungs', 'dead conifer']];
let g = '<!doctype html><meta charset=utf-8>' + css + '<h1>The pictures (impostors) against their 3D trees - each strip: 3D | the picture today | the picture fixed</h1>' +
  '<p>At the hand-over distance (gamer 130 m, potato 40 m), golden hour, sun behind the eye. Fixed: the trunk takes the bark\u2019s own tint (it wore the leaves\u2019), and each sheet\u2019s level is measured against its own 3D tree.</p>';
g += '<p>Two picks are left out because their frame missed the tree (gamer: the dead conifer framed a building; potato: the eye stood inside a pine). The level of each sheet is the mean of four runs (gamer + potato, golden + noon).</p>';
for (const [tag, lab] of [['I_g_v3', 'gamer'], ['I_p_v3', 'potato']]) {
  g += `<h2>${lab}</h2><table class=g>`;
  const SKIP = { I_g_v3: ['dead_conifer_Coniferous_Dead_Tree_13_rungs'], I_p_v3: ['pine_georgeous_glb_Pine01_LOD0_rungs'] };   // the picks whose frame missed the tree (a building, the eye inside a crown)
  for (const [k, name] of SUBJ) { if ((SKIP[tag] || []).includes(k)) continue; const f = path.join(OUT, `${tag}_${k}_away.png`); if (fs.existsSync(f)) g += `<tr><td class=l>${name}</td><td><img src="${url(f)}"></td></tr>`; }
  g += '</table>';
}
g += '<h2>1 km over the densest stand, gamer, golden: today | fixed</h2><table class=g><tr>';
for (const v of ['today', 'fixed']) { const f = path.join(OUT, 'raw', `I_g_v3_1km_${v}.png`); if (fs.existsSync(f)) g += `<td><img class=w src="${url(f)}"></td>`; }
g += '</tr></table>';
fs.writeFileSync(path.join(OUT, 'imp_sheet.html'), g);
// ---- shoot them ----
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + udd, '--allow-file-access-from-files', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
(async () => {
  let tgt = null; for (let i = 0; i < 40 && !tgt; i++) { await sleep(300); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(x => x.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const W = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; W.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await cmd('Page.enable');
  for (const [html, jpg, w] of [['imp_sheet.html', 'impostor_match_sheet.jpg', 2000]]) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: url(path.join(OUT, html)) }); await sleep(2500);
    const m = await cmd('Page.getLayoutMetrics'); const cs = m.result.cssContentSize || m.result.contentSize;
    const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.ceil(cs.height), scale: 1 } });
    fs.writeFileSync(path.join(EV, jpg), Buffer.from(r.result.data, 'base64')); console.log(jpg, w, Math.ceil(cs.height));
  }
  ws.close(); ch.kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
