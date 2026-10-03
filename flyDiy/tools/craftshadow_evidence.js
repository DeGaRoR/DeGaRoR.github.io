#!/usr/bin/env node
// craftshadow_evidence.js - CRAFT-SHADOW (G1410): the strips and difference images from craftshadow_frames.js's PNGs, composed
// in a headless Chromium canvas (no image package on the box) and written as small JPEGs.
//   node tools/craftshadow_evidence.js --spec <json file>
// spec: [{ out: 'path.jpg', title: '...', rows: [{ label, files: [png...] }], crop: [x, y, w, h], scale: 1, diff: true }]
// A strip row shows the frames side by side (wrapped at `cols`), then - diff: true - the difference of each frame to the one
// before it (|a - b| x 8, white = no change), with the count of pixels that changed (sum of |dRGB| > 12) under each.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
(async () => {
  const spec = JSON.parse(fs.readFileSync(opt('spec'), 'utf8'));
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();
  const out = [];
  for (const S of spec) {
    const rows = S.rows.map(r => ({ label: r.label, imgs: r.files.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')) }));
    const res = await page.evaluate(async ({ S, rows }) => {
      const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
      const [cx, cy, cw, ch] = S.crop, sc = S.scale || 1, cols = S.cols || 4, pad = 4, lab = 18, W = Math.round(cw * sc), H = Math.round(ch * sc);
      const blocks = [];
      for (const r of rows) {
        const imgs = []; for (const s of r.imgs) imgs.push(await load(s));
        const n = imgs.length, nr = Math.ceil(n / cols);
        blocks.push({ r, imgs, nr, h: lab + nr * (H + pad) + (S.diff ? nr * (H + pad) + 14 * nr : 0) });
      }
      const cv = document.createElement('canvas'); cv.width = cols * (W + pad) + pad; cv.height = 26 + blocks.reduce((a, b) => a + b.h + 8, 0);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#000'; g.font = 'bold 14px sans-serif'; g.fillText(S.title || '', pad, 17);
      const px = img => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch); return x.getImageData(0, 0, cw, ch); };
      let y = 26; const counts = [];
      for (const b of blocks) {
        g.fillStyle = '#000'; g.font = 'bold 13px sans-serif'; g.fillText(b.r.label, pad, y + 13); y += lab;
        const data = b.imgs.map(px); const cnt = [];
        for (let i = 0; i < b.imgs.length; i++) {
          const gx = pad + (i % cols) * (W + pad), gy = y + Math.floor(i / cols) * (H + pad) * (S.diff ? 2 : 1) + (S.diff ? Math.floor(i / cols) * 14 : 0);
          g.drawImage(b.imgs[i], cx, cy, cw, ch, gx, gy, W, H);
          g.fillStyle = '#ff0'; g.font = '11px sans-serif'; g.fillText('#' + i, gx + 3, gy + 12);
          if (S.diff) {
            const dy = gy + H + pad, A = data[i], B = data[i ? i - 1 : 0], D = new ImageData(cw, ch); let n = 0;
            for (let k = 0; k < A.data.length; k += 4) {
              const d = Math.abs(A.data[k] - B.data[k]) + Math.abs(A.data[k + 1] - B.data[k + 1]) + Math.abs(A.data[k + 2] - B.data[k + 2]);
              if (d > 12) n++;
              const v = Math.max(0, 255 - d * 8); D.data[k] = 255; D.data[k + 1] = v; D.data[k + 2] = v; D.data[k + 3] = 255;
            }
            const t = document.createElement('canvas'); t.width = cw; t.height = ch; t.getContext('2d').putImageData(D, 0, 0);
            g.drawImage(t, 0, 0, cw, ch, gx, dy, W, H); g.strokeStyle = '#999'; g.strokeRect(gx, dy, W, H);
            g.fillStyle = '#000'; g.font = '11px sans-serif'; g.fillText(i ? `#${i} - #${i - 1}: ${n} px changed` : '(first frame)', gx, dy + H + 11);
            cnt.push(i ? n : null);
          }
        }
        counts.push({ label: b.r.label, changed: cnt });
        y += b.h - lab + 8;
      }
      let q = 0.86, url = cv.toDataURL('image/jpeg', q);
      while (url.length * 0.75 > 245000 && q > 0.4) { q -= 0.08; url = cv.toDataURL('image/jpeg', q); }
      return { url, counts, w: cv.width, h: cv.height, q };
    }, { S, rows });
    fs.mkdirSync(path.dirname(S.out), { recursive: true });
    fs.writeFileSync(S.out, Buffer.from(res.url.split(',')[1], 'base64'));
    console.log(S.out, res.w + 'x' + res.h, 'q' + res.q.toFixed(2), (fs.statSync(S.out).size / 1024).toFixed(0) + ' KB', JSON.stringify(res.counts));
    out.push({ out: S.out, counts: res.counts });
  }
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('evidence:', e.stack); process.exit(1); });
