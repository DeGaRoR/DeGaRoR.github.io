// node elecshot.js <outdir> : the Instruments column's electrics, three cases, via a throwaway harness
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/workspace/DeGaRoR.github.io/flyDiy', OUT = process.argv[2];
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'application/javascript' }); r.end(b); }); });
srv.listen(8765, async () => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><base href="http://localhost:8765/">
<link rel="stylesheet" href="src/viewer/editor.css"><style>body{background:#1b1a18;margin:0} #edWrap{position:static!important;width:440px;height:auto!important;padding:10px} details{color:#ddd}</style></head>
<body><div id="edWrap"><div id="edProps"><div id="ui"></div></div></div>
<script>window.FLYDIY_ASSET_BASE='';</script>
<script src="vendor/three.min.js"></script><script src="src/core/00_registry.js"></script><script src="src/core/60_gen_spec.js"></script>
<script src="src/core/60b_gen_loft.js"></script><script src="src/core/60c_gen_energy.js"></script><script src="tools/_gear_kit.js"></script>
<script src="tools/_panel_gen.js"></script><script>window.CAGE_IN_GAME=true;window.__S=null;window.GARAGE_SPEC={get:()=>window.__S,update(){},set(){}};</script>
<script src="tools/_cage_panel.js"></script></body></html>`;
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 480, height: 1600 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('http://localhost:8765/harness', r => r.fulfill({ contentType: 'text/html', body: html }));
  await pg.goto('http://localhost:8765/harness'); await pg.waitForTimeout(800);
  const cases = { rotax582: { engine: 'rotax582_ivo', systems: { fit: 'basic' } },
                  a65_cub: { engine: 'a65_sensenich74', systems: { fit: 'basic' } },
                  alt_nobatt: { engine: 'o320_mccauley', systems: { fit: 'custom', items: ['asi','alt','turn','fuel','volts','tacho'], elec: { battery: 'none', alternator: 'alt60', starter: 'yes', vac: 'none' } } },
                  gen_only: { engine: 'o320_mccauley', systems: { fit: 'basic', elec: { battery: 'none', starter: 'none' } } } };
  for (const [k, S] of Object.entries(cases)) {
    await pg.evaluate(S => { S.energy = { kind: 'fuel', vessels: [{}] }; window.__S = S; const host = document.getElementById('ui'); host.innerHTML = '';
      CAGE_PANEL.fromSpec(S.systems); const e = CAGE_PANEL.panel(); host.appendChild(e); CAGE_PANEL.render();
      for (const d of host.querySelectorAll('details')) if (!d.dataset.g) d.open = false;
      const el = [...host.querySelectorAll('summary')].find(s => /^electrics/.test(s.textContent)); if (el) { el.parentNode.open = true; el.scrollIntoView(); } }, S);
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(s => /^electrics/.test(s.textContent)); s.parentNode.id = 'elecFold'; });
    await pg.locator('#elecFold').screenshot({ path: path.join(OUT, 'elec_' + k + '.png') }); const box = null;
    console.log(k, JSON.stringify(box), await pg.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(s => /^electrics/.test(s.textContent)); return s.parentNode.textContent.slice(0, 900).replace(/\n+/g, ' | '); }));
  }
  console.log('dbg', await pg.evaluate(() => { const t = document.querySelector('.dfTile'); const out = []; let e = t; while (e && e !== document.body) { const c = getComputedStyle(e); out.push((e.id || e.className || e.tagName) + ':' + c.display + '/' + c.visibility + '/' + c.opacity + '/' + c.color); e = e.parentElement; } return (t ? 'tile ' : 'NO TILE ') + out.join(' < '); }));
  console.log('errors', JSON.stringify(errs.slice(0, 5)));
  await b.close(); srv.close();
});
