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
// ---- the pages (shsheet: the far-forest default, master vs the user's column 3) ----
const css = '<style>body{margin:0;background:#15181c;color:#e8e8e8;font:15px/1.35 system-ui,Segoe UI,sans-serif}h1{font-size:20px;margin:14px 16px 4px}p{margin:2px 16px 10px;color:#b9c0c8}' +
  'table.g{border-collapse:separate;border-spacing:8px}td{vertical-align:top}td.l{width:150px;font-weight:600;padding-top:8px}img{width:960px;display:block}th{font-weight:600;text-align:left;padding:4px 8px}</style>';
const ROWS = [['ctx_away', 'near trees round a larch snag, 290 m, front-lit', 'golden'], ['ctx_side', 'near trees round a larch snag, 290 m, side-lit', 'golden'],
  ['300m_noon', '300 m over the densest stand', 'noon'], ['300m_golden', '300 m over the densest stand', 'golden'],
  ['1000m_noon', '1 km over the densest stand', 'noon'], ['1000m_golden', '1 km over the densest stand', 'golden']];
let g = '<!doctype html><meta charset=utf-8>' + css + '<h1>The trees under their own shadows: today (left) vs your column 3 (right) - gamer, Jolene near HOME</h1>' +
  '<p>Where the world casts tree shadows (current / gamer / ultra): the far pictures at their 3D match, the near trees lifted x1.38. Presets without tree shadows unchanged. Same frame in both columns.</p>' +
  '<table class=g><tr><th></th><th>TODAY</th><th>COLUMN 3 (the new default)</th></tr>';
const src = (k, v) => /^ctx_/.test(k) ? path.join(OUT, `S_g_golden_context_larch_${k.slice(4)}_${v}.png`) : path.join(OUT, 'raw', 'sh_' + k + '_' + v + '.png');
for (const [k, lab, day] of ROWS) g += `<tr><td class=l>${lab}<br><span style="font-weight:400;color:#9aa3ad">${day}</span></td><td><img src="${url(src(k, 'master'))}"></td><td><img src="${url(src(k, 'col3'))}"></td></tr>`;
g += '</table>';
fs.writeFileSync(path.join(OUT, 'sh_sheet.html'), g);
// ---- shoot them ----
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + udd, '--allow-file-access-from-files', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
(async () => {
  let tgt = null; for (let i = 0; i < 40 && !tgt; i++) { await sleep(300); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(x => x.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const W = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; W.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await cmd('Page.enable');
  for (const [html, jpg, w] of [['sh_sheet.html', 'far_forest_col3_sheet.jpg', 2140]]) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: url(path.join(OUT, html)) }); await sleep(2500);
    const m = await cmd('Page.getLayoutMetrics'); const cs = m.result.cssContentSize || m.result.contentSize;
    const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 86, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.ceil(cs.height), scale: 1 } });
    fs.writeFileSync(path.join(EV, jpg), Buffer.from(r.result.data, 'base64')); console.log(jpg, w, Math.ceil(cs.height));
  }
  ws.close(); ch.kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
