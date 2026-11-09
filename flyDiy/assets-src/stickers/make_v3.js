// flyDiy livery stickers, third pass (9 Nov 2026): twelve logo marks in the swoosh style, one colour, no text.
// node make_v3.js -> svg/NN_id.svg, stickers_v3.html (review page), check/one_NN.html + check/all.html (big renders)
const fs = require('fs'), path = require('path');
const OUT = __dirname;
const D = [].concat(require('./marks_a.js'), require('./marks_b.js'), require('./marks_c.js'));
fs.mkdirSync(path.join(OUT, 'svg'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'check'), { recursive: true });
for (const f of fs.readdirSync(path.join(OUT, 'svg'))) fs.unlinkSync(path.join(OUT, 'svg', f));
D.forEach((d, k) => {
  d.n = String(k + 1).padStart(2, '0');
  const fix = s => s.replace(/ID_/g, 's_');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w} ${d.h}" width="${d.w * 3}" height="${d.h * 3}"><title>flyDiy sticker ${d.n}: ${d.name}</title><defs>${fix(d.defs)}<mask id="ink" maskUnits="userSpaceOnUse" x="0" y="0" width="${d.w}" height="${d.h}">${fix(d.mask)}</mask></defs><rect width="${d.w}" height="${d.h}" fill="#1c2742" mask="url(#ink)"/></svg>\n`;
  fs.writeFileSync(path.join(OUT, 'svg', `${d.n}_${d.id}.svg`), svg);
});
let uid = 0;
const svgEl = (d, cls, reuse) => {
  if (reuse) return `<svg class="${cls}" viewBox="0 0 ${d.w} ${d.h}" role="img" aria-label="${d.name}"><rect width="${d.w}" height="${d.h}" fill="currentColor" mask="url(#${reuse}m)"/></svg>`;
  const u = 'v' + (++uid) + '_'; d.u = u;
  const fix = s => s.replace(/ID_/g, u);
  return `<svg class="${cls}" viewBox="0 0 ${d.w} ${d.h}" role="img" aria-label="${d.name}"><defs>${fix(d.defs)}<mask id="${u}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${d.w}" height="${d.h}">${fix(d.mask)}</mask></defs><rect width="${d.w}" height="${d.h}" fill="currentColor" mask="url(#${u}m)"/></svg>`;
};
const cards = D.map(d => `
  <article class="card${d.w / d.h > 1.9 ? ' wide' : ''}">
    <div class="sheet">${svgEl(d, 'big')}</div>
    <div class="on">
      <div class="skin red">${svgEl(d, 'small', d.u)}</div>
      <div class="skin navy">${svgEl(d, 'small', d.u)}</div>
      <div class="skin alu">${svgEl(d, 'small', d.u)}</div>
    </div>
    <h2><span class="num">${d.n}</span> ${d.name}</h2>
    <p>${d.idea}</p>
    <p class="theme">${d.theme}</p>
  </article>`).join('');
const html = `<title>Alaska Marks v3</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* layout: a cutter's sheet - each mark on off-white backing in navy ink, then on three painted skins */
:root { --bg:#eef0ee; --fg:#1d2321; --muted:#5b6662; --sheet:#fbfaf6; --ink:#1c2742; --line:#d5dad7;
  --red:#a8322a; --navy:#1f3550; --alu:#b9bfc2; --display:'Barlow Condensed','Arial Narrow',Arial,sans-serif; --body:'Barlow',Arial,sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#161a19; --fg:#e7ebe9; --muted:#9aa5a0; --line:#2c3331; color-scheme:dark } }
:root[data-theme="dark"] { --bg:#161a19; --fg:#e7ebe9; --muted:#9aa5a0; --line:#2c3331; color-scheme:dark }
body { background:var(--bg); color:var(--fg); font-family:var(--body); font-size:15px; line-height:1.5;
  padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:20px 40px; }
header { max-width:68ch; display:grid; gap:6px; margin-bottom:20px }
h1 { font-family:var(--display); font-weight:700; font-size:2rem; letter-spacing:.02em; margin:0; text-wrap:balance }
header p { margin:0; color:var(--muted) }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:18px }
.card { display:grid; gap:8px; min-width:0; align-content:start }
.card.wide { grid-column:span 2 }
@media (max-width:600px) { .card.wide { grid-column:auto } }
.sheet { background:var(--sheet); color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:18px; display:flex; justify-content:center; align-items:center; min-height:220px }
.big { width:100%; max-height:260px; height:auto }
.on { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px }
.skin { border-radius:4px; padding:8px; display:flex; justify-content:center; align-items:center }
.skin .small { width:100%; height:64px }
.red { background:var(--red); color:#f4f1ea } .navy { background:var(--navy); color:#f4f1ea } .alu { background:var(--alu); color:#14181a }
h2 { font-family:var(--display); font-weight:600; font-size:1.2rem; margin:0; display:flex; gap:8px; align-items:baseline }
.num { font-variant-numeric:tabular-nums; color:var(--muted); font-size:.95rem; letter-spacing:.06em }
.card p { margin:0; color:var(--muted); font-size:.9rem; text-wrap:pretty }
.card p.theme { font-size:.8rem; letter-spacing:.04em; text-transform:uppercase }
footer { max-width:68ch; margin-top:24px; color:var(--muted); font-size:.9rem }
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&family=Barlow+Condensed:wght@600;700&display=swap">
<header>
  <h1>Alaska marks, third pass</h1>
  <p>Twelve logo marks after your inspiration sheet: bold silhouettes, tapered swooshes, zigzag snow lines, shapes that run into each other, no text. One colour, cut from vinyl: every gap is a real hole, so the plane's paint shows through. Each is shown on the backing sheet, then in white on red and navy, and in black on bare aluminium.</p>
</header>
<main class="grid">${cards}
</main>
<footer>Say which to keep, drop or change; numbers are enough (e.g. "keep 2, 7, 12, change 1").</footer>`;
fs.writeFileSync(path.join(OUT, 'stickers_v3.html'), html);
const big = d => { const u = 'b' + (++uid) + '_'; const fix = s => s.replace(/ID_/g, u); return `<svg viewBox="0 0 ${d.w} ${d.h}"><defs>${fix(d.defs)}<mask id="${u}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${d.w}" height="${d.h}">${fix(d.mask)}</mask></defs><rect width="${d.w}" height="${d.h}" fill="#1c2742" mask="url(#${u}m)"/></svg>`; };
fs.writeFileSync(path.join(OUT, 'check', 'all.html'), `<style>body{margin:0;background:#fbfaf6;font:12px Arial} .d{display:inline-block;width:350px;height:330px;margin:6px;vertical-align:top;border:1px solid #ccc} .d svg{width:100%;height:300px} b{display:block;padding:2px 4px}</style>` + D.map(d => `<div class="d"><b>${d.n} ${d.name}</b>${big(d)}</div>`).join(''));
D.forEach(d => fs.writeFileSync(path.join(OUT, 'check', `one_${d.n}.html`), `<style>body{margin:0;background:#fbfaf6} svg{width:100%;height:auto;display:block}</style>${big(d)}`));
console.log(D.length, 'marks; page', (html.length / 1024).toFixed(0), 'KB');
