#!/usr/bin/env node
// G1857 (DMG-D4c THE WALL): THE YELLOW CENSUS, counted from the passes tools/dmg_wall_stills.js saved (<shot>_census.png:
// the aeroplane on flat colours by what it is; <shot>_face.png: the covering alone, its outside green, its inside face
// magenta) and the picture (<shot>.jpg). For every pixel of the census pass that is the INSIDE WALL (red), what lies
// behind it on the face pass:
//   - the covering's OUTSIDE (green): the inside stands out through the covering - a LEAK (`out`);
//   - NOTHING (the clear): the inside with no covering round it at all - torn away from its wall, riding off on its own
//     nodes, or hanging over a hole whose covering went without it - a LEAK too (`orphan`);
//   - the covering's INSIDE face (magenta): the cabin seen through a hole where the covering has gone, its far wall's
//     liner in front of that wall's own covering - what a torn fuselage shows, NOT a leak (`hole`).
// The bulkheads across the fuselage (the firewall, the fireproof sheet, a bulkhead: YELLOW in the census pass) are counted
// apart - a face across an opening, seen from outside once the engine has gone - with their share out through the covering.
// THE LEAK SHARE = (out + orphan) / (the covering's pixels + the other exterior skins' + the lining's): the share of
// what the outside of the aeroplane shows that is the inside leaking. The stripe and the registration are painted on the
// covering (green in the census pass), never a part of their own, so they never count. Also, on the picture: the share
// of the covering-or-inside pixels that are not the covering's yellow (hue 35-65 deg, saturation over 0.35) - the user's
// own eye (the stripe and the letters included: a constant of the view).
//   node tools/dmg_wall_census.js <dir> [--md out.md] [--json out.json]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const DIR = path.resolve(argv[0] || '.');
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
function findPlaywright() { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); }

async function main() {
  const shots = fs.readdirSync(DIR).filter(f => /_census\.png$/.test(f)).map(f => f.replace(/_census\.png$/, '')).sort();
  const { chromium } = findPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const rows = [];
  for (const s of shots) {
    const b64 = f => fs.existsSync(path.join(DIR, f)) ? fs.readFileSync(path.join(DIR, f)).toString('base64') : null;
    const pic = b64(s + '.jpg'), ids = b64(s + '_census.png'), face = b64(s + '_face.png');
    if (!ids || !face) continue;
    const c = await page.evaluate(async ([P, B, F]) => {
      const px = async (b64, t) => { const img = new Image(); img.src = 'data:image/' + t + ';base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const y = await px(B, 'png'), f = await px(F, 'png'), x = P ? await px(P, 'jpeg') : null, n = y.length / 4;
      const K = { cover: [0, 255, 0], skin: [0, 255, 255], wall: [255, 0, 0], bulk: [255, 255, 0], furn: [0, 0, 255], other: [255, 255, 255] };
      const c = { cover: 0, skin: 0, wall: 0, bulk: 0, furn: 0, other: 0, out: 0, orphan: 0, hole: 0, bulkOut: 0, bulkOpen: 0, furnOut: 0, outerPix: 0, notYellow: 0 };
      for (let i = 0; i < n; i++) {
        const r = y[4 * i], g = y[4 * i + 1], b = y[4 * i + 2];
        if (r + g + b < 30) continue;
        let best = null, bd = 60;
        for (const k in K) { const d = Math.abs(r - K[k][0]) + Math.abs(g - K[k][1]) + Math.abs(b - K[k][2]); if (d < bd) { bd = d; best = k; } }
        if (!best) continue;                               // a blended edge, or the world the pass did not hide (the trees)
        c[best]++;
        const fr = f[4 * i], fg = f[4 * i + 1], fb = f[4 * i + 2];
        const front = fg > 160 && fr < 100 && fb < 100, back = fr > 160 && fb > 160 && fg < 100, none = fr + fg + fb < 30;
        if (best === 'wall') { if (front) c.out++; else if (back) c.hole++; else if (none) c.orphan++; else c.hole++; }
        if (best === 'furn' && front) c.furnOut++;
        if (best === 'bulk') { if (front) c.bulkOut++; else c.bulkOpen++; }
        if (x && (best === 'cover' || best === 'skin' || best === 'wall')) {
          c.outerPix++;
          const R = x[4 * i] / 255, G = x[4 * i + 1] / 255, Bb = x[4 * i + 2] / 255, mx = Math.max(R, G, Bb), mn = Math.min(R, G, Bb), dl = mx - mn;
          let h = 0; if (dl > 0) { if (mx === R) h = 60 * (((G - Bb) / dl) % 6); else if (mx === G) h = 60 * ((Bb - R) / dl + 2); else h = 60 * ((R - G) / dl + 4); }
          if (h < 0) h += 360;
          if (!(h >= 35 && h <= 65 && (mx > 0 ? dl / mx : 0) > 0.35 && mx > 0.2)) c.notYellow++;
        }
      }
      const outer = c.cover + c.skin + c.wall;
      c.leak = outer ? (c.out + c.orphan) / outer : 0;
      c.leakOut = outer ? c.out / outer : 0; c.leakOrphan = outer ? c.orphan / outer : 0; c.holeShare = outer ? c.hole / outer : 0;
      c.notYellowShare = c.outerPix ? c.notYellow / c.outerPix : 0;
      c.bulkShare = (outer + c.bulk) ? c.bulk / (outer + c.bulk) : 0; c.bulkOutShare = (outer + c.bulk) ? c.bulkOut / (outer + c.bulk) : 0;
      return c;
    }, [pic, ids, face]);
    const m = /^(\w+)_(\d+)_(\w+)$/.exec(s) || [];
    rows.push(Object.assign({ shot: s, scene: m[1], cam: +m[2], tag: m[3] }, c));
  }
  await browser.close();
  const pct = v => (v * 100).toFixed(2) + ' %';
  const md = ['| shot | scene | camera | drawing | the covering px | the lining px | LEAK (out + orphan) | out through | orphan | the cabin through holes | bulkheads seen (out through) | not yellow (picture) |', '|---|---|---|---|---|---|---|---|---|---|---|---|']
    .concat(rows.map(r => '| ' + r.shot + ' | ' + r.scene + ' | ' + r.cam + ' | ' + r.tag + ' | ' + (r.cover + r.skin) + ' | ' + r.wall + ' | **' + pct(r.leak) + '** | ' + pct(r.leakOut) + ' | ' + pct(r.leakOrphan) + ' | ' + pct(r.holeShare) + ' | ' + pct(r.bulkShare) + ' (' + pct(r.bulkOutShare) + ') | ' + pct(r.notYellowShare) + ' |'));
  console.log(md.join('\n'));
  if (opt('md')) fs.writeFileSync(opt('md'), md.join('\n') + '\n');
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(rows, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
