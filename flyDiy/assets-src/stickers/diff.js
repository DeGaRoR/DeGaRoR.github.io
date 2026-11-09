// flyDiy livery stickers: OLD vs NEW, PIXEL FOR PIXEL (LIVERY-STICKERS, 9 Nov 2026).
//   node diff.js [a=mask] [b=svg] [px=1200]  -> prints, per mark, the pixels whose coverage moved, and writes
//   check/diff_NN.png (a in red, b in blue: a pixel in only one shows its colour; both = black, neither = white)
// Each SVG is drawn by Chromium at px across, ink black on white, and read back. A pixel "moved" when its coverage
// differs by more than 50% (an edge that moved half a pixel or more); the anti-aliasing of an edge that sits where it
// sat moves by less. The mask files carry their ink colour in the mask's rect; the flat files in their one path.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const HERE = __dirname;
const A = process.argv[2] || 'mask', B = process.argv[3] || 'svg', PX = +(process.argv[4] || 1200);
(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage();
  await pg.setContent('<canvas id=c></canvas>');
  const files = fs.readdirSync(path.join(HERE, B)).filter(f => f.endsWith('.svg')).sort();
  fs.mkdirSync(path.join(HERE, 'check'), { recursive: true });
  let worst = 0;
  for (const f of files) {
    const ink = s => s.replace(/fill="#1c2742"/g, 'fill="#000"');
    const sa = ink(fs.readFileSync(path.join(HERE, A, f), 'utf8')), sb = ink(fs.readFileSync(path.join(HERE, B, f), 'utf8'));
    const r = await pg.evaluate(async ([sa, sb, PX]) => {
      const load = s => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no;
        im.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))); });
      const vb = sa.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), W = PX, H = Math.round(PX * +vb[2] / +vb[1]);
      const cov = async s => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(await load(s), 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data, o = new Float32Array(W * H); for (let i = 0; i < W * H; i++) o[i] = 1 - d[i * 4] / 255; return o; };
      const a = await cov(sa), b = await cov(sb);
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const im = g.createImageData(W, H);
      let moved = 0, inkA = 0, inkB = 0, sum = 0;
      for (let i = 0; i < W * H; i++) {
        inkA += a[i]; inkB += b[i]; sum += Math.abs(a[i] - b[i]);
        const m = Math.abs(a[i] - b[i]) > 0.5; if (m) moved++;
        const ka = a[i] > 0.5, kb = b[i] > 0.5;
        const col = ka && kb ? [0, 0, 0] : ka ? [230, 30, 30] : kb ? [30, 60, 230] : [255, 255, 255];
        im.data.set(col.concat(255), i * 4);
      }
      g.putImageData(im, 0, 0);
      return { W, H, moved, inkA, inkB, meanAbs: sum / (W * H), png: c.toDataURL('image/png') };
    }, [sa, sb, PX]);
    fs.writeFileSync(path.join(HERE, 'check', 'diff_' + f.slice(0, 2) + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    const pct = 100 * r.moved / (r.W * r.H);
    worst = Math.max(worst, pct);
    console.log(`${f.padEnd(26)} ${r.W}x${r.H}  moved ${String(r.moved).padStart(6)} px (${pct.toFixed(3)}%)  ink ${(r.inkB / r.inkA * 100 - 100).toFixed(3)}%  mean |d| ${r.meanAbs.toFixed(5)}`);
  }
  console.log('worst moved ' + worst.toFixed(3) + '% of the pixels');
  await br.close();
})();
