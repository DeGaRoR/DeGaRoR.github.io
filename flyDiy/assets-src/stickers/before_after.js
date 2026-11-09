// flyDiy livery stickers: BEFORE / AFTER of the polished marks, big and small.  node before_after.js <out.png> [ids=02,08,09,12]
// before = check/before (python3 flatten.py check/mask_v3 check/before, the masks as the user approved them), after = svg/
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const out = process.argv[2], ids = (process.argv[3] || '02,08,09,12').split(',');
const pick = (dir, id) => { const f = fs.readdirSync(path.join(__dirname, dir)).find(f => f.startsWith(id + '_')); return [f, fs.readFileSync(path.join(__dirname, dir, f))]; };
const img = (b, w, h, bg, fg) => `<div style="background:${bg};padding:6px;display:inline-block;margin:3px"><img style="width:${w}px;height:${h}px;object-fit:contain;${fg}" src="data:image/svg+xml;base64,${b.toString('base64')}"></div>`;
(async () => {
  let html = '<body style="margin:0;padding:10px;background:#eef0ee;font:14px Arial;width:1180px">';
  for (const id of ids) {
    const [fa, a] = pick('check/before', id), [, b] = pick('svg', id);
    const white = s => Buffer.from(s.toString().replace(/fill="#1c2742"/g, 'fill="#f4f1ea"'));
    html += `<div style="display:flex;gap:12px;align-items:center;margin:6px 0;background:#fbfaf6;padding:8px"><b style="width:120px">${fa.replace('.svg', '')}</b>` +
      `<div>before<br>${img(a, 230, 200, '#fbfaf6', '')}${img(white(a), 70, 60, '#a8322a', '')}${img(white(a), 36, 30, '#1f3550', '')}</div>` +
      `<div>after<br>${img(b, 230, 200, '#fbfaf6', '')}${img(white(b), 70, 60, '#a8322a', '')}${img(white(b), 36, 30, '#1f3550', '')}</div></div>`;
  }
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 2 });
  await pg.setContent(html + '</body>'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: out, fullPage: true }); await br.close(); console.log(out);
})();
