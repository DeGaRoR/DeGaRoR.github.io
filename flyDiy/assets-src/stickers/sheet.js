// flyDiy livery stickers: a contact sheet of svg/ (or another dir) -> a PNG.  node sheet.js <dir> <out.png> [ids,comma] [cell=360]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const dir = path.resolve(__dirname, process.argv[2] || 'svg'), out = process.argv[3] || path.join(__dirname, 'check', 'sheet.png');
const only = process.argv[4] ? process.argv[4].split(',') : null, cell = +(process.argv[5] || 360);
(async () => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg') && (!only || only.includes(f.slice(0, 2)))).sort();
  const html = `<body style="margin:0;background:#fbfaf6;font:13px Arial;display:flex;flex-wrap:wrap;width:${Math.min(4, files.length) * (cell + 12)}px">` +
    files.map(f => `<div style="width:${cell}px;margin:6px"><b>${f}</b><img style="width:${cell}px;height:${cell}px;object-fit:contain" src="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(dir, f))).toString('base64')}"></div>`).join('') + '</body>';
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: Math.min(4, files.length) * (cell + 12), height: 400 } });
  await pg.setContent(html); await pg.waitForTimeout(200);
  await pg.screenshot({ path: out, fullPage: true }); await br.close(); console.log(out);
})();
