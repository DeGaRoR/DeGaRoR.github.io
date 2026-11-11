// the plan page: per plane, drawn vs flown (before, after) side + top, the numbers; -> plan.html
const fs = require('fs');
const D = __dirname;
const L = k => JSON.parse(fs.readFileSync(D + '/ab_B_' + k + '.json'));
const LA = k => { try { return JSON.parse(fs.readFileSync(D + '/ab_A_' + k + '.json')); } catch (e) { return null; } };
const LH = k => { try { return JSON.parse(fs.readFileSync(D + '/ab_B_hoerner_' + k + '.json')); } catch (e) { return null; } };
const LR = k => { try { return JSON.parse(fs.readFileSync(D + '/ab_B_rod1.2_' + k + '.json')); } catch (e) { return null; } };
const STR = JSON.parse(fs.readFileSync(D + '/struct.json'));
const NAME = { chinook: 'Chinook', rufus: 'Rufus', twin: 'Twin busher floats 4b', birdman: 'Birdman', v8pusher: 'v8 pusher', v7twin: 'v7 twin',
  cub: 'Piper Cub', jodel: 'Jodel D112', c172: 'Metal Cessna', c172f: 'Metal Cessna on floats', stolcub: 'STOL Cub', pa18f: 'PA-18 on floats' };
const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
const arrow = (a, b, fmt, good) => {
  const d = b - a, cls = Math.abs(d) < 1e-9 ? 'same' : '';
  return `<span class="pair"><span class="num ${cls}">${fmt(a)}</span> <span class="arr">→</span> <span class="num ${cls ? 'same' : 'new'}">${fmt(b)}</span></span>`;
};
const pct = (a, b) => { const p = (b / a - 1) * 100; return (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(0) + ' %'; };

// ---- pictures (viewBox in metres; x aft, y up) ----
function outline(rows, key) {   // closed polygon, side: yt over, yb back; top: +w over, -w back
  if (!rows.length) return '';
  const up = rows.map(r => [r.x, key === 'side' ? r.yt : r.w]), dn = rows.slice().reverse().map(r => [r.x, key === 'side' ? r.yb : -r.w]);
  return up.concat(dn).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(3) + ' ' + (-p[1]).toFixed(3)).join(' ') + ' Z';
}
function rodRect(rod, last, key) {
  if (!rod) return '';
  const yc = key === 'side' ? 0.5 * (last.yb + last.yt) : 0, h = 0.5 * rod.d;
  return `M${rod.x0.toFixed(3)} ${(-(yc + h)).toFixed(3)} L${rod.x1.toFixed(3)} ${(-(yc + h)).toFixed(3)} L${rod.x1.toFixed(3)} ${(-(yc - h)).toFixed(3)} L${rod.x0.toFixed(3)} ${(-(yc - h)).toFixed(3)} Z`;
}
function picture(k, o, key) {
  const r = o.rec, a = o.before, b = o.after;
  const drawn = r.drawnAll.filter(q => q.w > 0.003).concat(r.cowl).sort((p, q) => p.x - q.x);
  // the drawn skin as one silhouette: the union, column by column
  const cols = new Map(); for (const q of drawn) { const kx = Math.round(q.x / 0.02); const c = cols.get(kx);
    if (!c) cols.set(kx, { x: kx * 0.02, w: q.w, yb: q.yb, yt: q.yt }); else { c.w = Math.max(c.w, q.w); c.yb = Math.min(c.yb, q.yb); c.yt = Math.max(c.yt, q.yt); } }
  const dr = [...cols.values()].sort((p, q) => p.x - q.x);
  const before = a.cowlSec.slice().reverse().concat(a.ST);
  const x0 = -1.5, x1 = 6.4, yT = key === 'side' ? 2.1 : 1.0, yB = key === 'side' ? -0.35 : -1.0, W = x1 - x0, H = yT - yB;
  const last = r.rows[r.rows.length - 1];
  const sep = b.wet && b.wet.xSep != null && b.wet.Ab > 1e-3 ? b.wet.xSep : null;
  let s = `<svg viewBox="${x0} ${-yT} ${W} ${H}" class="pic" role="img" aria-label="${NAME[k]}, ${key} view: the drawn body against the body flown before and after">`;
  // ground grid every metre
  for (let x = -1; x <= 6; x++) s += `<line x1="${x}" y1="${-yT}" x2="${x}" y2="${-yB}" class="grid"/>`;
  s += `<line x1="${x0}" y1="0" x2="${x1}" y2="0" class="axis"/>`;
  s += `<path d="${outline(dr, key)}" class="drawn"/>`;
  s += `<path d="${outline(before, key)}" class="before"/>`;
  s += `<path d="${outline(r.rows, key)}" class="after"/>`;
  if (r.rod) s += `<path d="${rodRect(r.rod, last, key)}" class="after rod"/>`;
  if (sep != null) { const q = r.rows.reduce((p, c) => Math.abs(c.x - sep) < Math.abs(p.x - sep) ? c : p);
    s += key === 'side' ? `<line x1="${sep}" y1="${-q.yt}" x2="${sep}" y2="${-q.yb}" class="base"/>` : `<line x1="${sep}" y1="${-q.w}" x2="${sep}" y2="${q.w}" class="base"/>`; }
  if (key === 'side') {
    for (const e of (b.engX || [])) if (e.m === 'pusher' && b.propD) s += `<line x1="${e.x + 0.12}" y1="${-(e.y + b.propD / 2)}" x2="${e.x + 0.12}" y2="${-(e.y - b.propD / 2)}" class="prop"/>`;
    const tri = (x, cls) => `<path d="M${x} 0.06 l-0.09 0.2 l0.18 0 Z" class="${cls}"/>`;
    s += tri(a.aftBlobX, 'mk-before') + tri(b.aftBlobX, 'mk-after');
    if (b.boomBlobX != null) s += tri(b.boomBlobX, 'mk-boom');
  }
  return s + '</svg>';
}

// ---- tables ----
function numbers(o, extra) {
  const a = o.before, b = o.after;
  const rows = [
    ['Body drag area (m²)', arrow(a.body, b.body, f3), pct(a.body, b.body)],
    ['  of which base', `<span class="num">${f3(b.base)}</span>`, b.wet && b.wet.Ab > 1e-3 ? f2(b.wet.Ab) + ' m² at x ' + f2(b.wet.xSep) : '—'],
    ['  of which rod', `<span class="num">${f3(b.rod)}</span>`, o.rec.rod ? 'Ø ' + (o.rec.rod.d * 1000).toFixed(0) + ' mm × ' + f2(o.rec.rod.x1 - o.rec.rod.x0) + ' m' : '—'],
    ['Whole aircraft axial CdA (m²)', arrow(a.axial, b.axial, f3), pct(a.axial, b.axial)],
    ['Aft side area × 0.31 (m²), at x', arrow(a.aftSide, b.aftSide, f2) + ' @ ' + arrow(a.aftBlobX, b.aftBlobX, f2), pct(a.aftSide, b.aftSide)],
    ['Cruise, 65 % power (km/h)', arrow(a.Vc, b.Vc, f1), (b.Vc - a.Vc >= 0 ? '+' : '−') + Math.abs(b.Vc - a.Vc).toFixed(1)],
    ['Stall Vs (km/h)', arrow(a.Vs, b.Vs, f1), ''],
    ['Climb (m/s)', arrow(a.climb, b.climb, f2), ''],
    ['Static margin (MAC)', arrow(a.sm, b.sm, f3), 'NP ' + arrow(a.npX, b.npX, f2)],
    ['Cn_beta (shakedown)', arrow(a.cnBeta, b.cnBeta, f3), pct(a.cnBeta, b.cnBeta)],
    ['Mass (kg)', arrow(a.mass, b.mass, f1), ''],
  ].concat(extra || []);
  return `<div class="tw"><table class="nums"><thead><tr><th>Row</th><th>Before → after</th><th>Change</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0].replace(/^  /, '<span class="ind"></span>')}</td><td>${r[1]}</td><td class="chg">${r[2]}</td></tr>`).join('')}</tbody></table></div>`;
}
function rodLayers(k, o) {
  const s = STR[k], r = o.rec, a = o.before, b = o.after, R = LR(k);
  if (!s) return '';
  return `<div class="tw"><table class="nums layers"><thead><tr><th>Layer</th><th>Today</th><th>Drawn</th><th>Verdict</th></tr></thead><tbody>
  <tr><td>Structure: geometry</td><td>lattice cone, ${f2(s.cone.ST[Math.floor(s.cone.ST.length * 0.7)].yt - s.cone.ST[Math.floor(s.cone.ST.length * 0.7)].yb)} m deep at 70 %</td><td>tube Ø ${(r.rod.d * 1000).toFixed(0)} mm</td><td><span class="pill warn">cone</span></td></tr>
  <tr><td>Structure: stiffness</td><td>tube element (G314): the drawn tube's EI, GJ</td><td>same</td><td><span class="pill ok">right</span></td></tr>
  <tr><td>Structure: mass</td><td>${f1(s.cone.mass)} kg (aft lattice ${f1(s.cone.aftKg)} kg, ${f2(s.cone.panels)} m² of bay faces)</td><td>${f1(s.rod.mass)} kg on the drawn tube</td><td><span class="pill warn">${f1(s.cone.mass - s.rod.mass)} kg phantom</span></td></tr>
  <tr><td>Structure: inertia, CG</td><td>Izz ${s.cone.Izz.toFixed(0)} kg·m², CG ${f3(s.cone.cg)}</td><td>Izz ${s.rod.Izz.toFixed(0)}, CG ${f3(s.rod.cg)}</td><td><span class="pill minor">${pct(s.cone.Izz, s.rod.Izz)}</span></td></tr>
  <tr><td>Aero: drag</td><td>cone to ${f2(a.ST[a.ST.length - 1].x)} m, ${f3(a.body)} m²</td><td>pod to ${f2(r.closeX)} m + base + rod, ${f3(b.body)} m²</td><td><span class="pill bad">phantom cone</span></td></tr>
  <tr><td>Aero: side area</td><td>${f2(a.aftSide)} m² at x ${f2(a.aftBlobX)}</td><td>${f2(b.aftSide)} m² at x ${f2(b.aftBlobX)}${R ? `; rod at Cd 1.2: ${f2(R.after.aftSide)} at ${f2(R.after.aftBlobX)}` : ''}</td><td><span class="pill bad">${pct(a.aftSide, b.aftSide)}</span></td></tr>
  <tr><td>Aero: yaw, pitch</td><td>Cn_β ${f3(a.cnBeta)}, SM ${f3(a.sm)}</td><td>Cn_β ${f3(b.cnBeta)}${R ? ` (Cd 1.2 rod: ${f3(R.after.cnBeta)})` : ''}, SM ${f3(b.sm)}</td><td><span class="pill minor">weathercocks less</span></td></tr>
  </tbody></table></div>`;
}
function card(k, opts) {
  const o = L(k), A = LA(k), Hh = LH(k);
  const alt = A ? `<p class="alt">Same geometry, other drag laws: Raymer's form factor on the drawn length (model A) gives body ${f3(A.after.body)} m², cruise ${f1(A.after.Vc)} km/h; Hoerner's own base law (B-H) ${f3(Hh.after.body)} m², ${f1(Hh.after.Vc)} km/h.</p>` : '';
  return `<article class="plane" id="p-${k}">
  <header><h3>${NAME[k]}</h3>${opts.tag ? `<span class="tag">${opts.tag}</span>` : ''}</header>
  ${opts.lede ? `<p>${opts.lede}</p>` : ''}
  <figure><div class="pics">${picture(k, o, 'side')}${picture(k, o, 'top')}</div>
  <figcaption>Side, then top, one scale (grid 1 m, x from the firewall). Grey: drawn. Dashed red: flown today. Blue: flown after (body, base line, rod).${o.before.engX && o.before.engX.some(e => e.m === 'pusher') ? ' Vertical line: the pusher disc.' : ''} Triangles: where the aft side force acts, today (red) and after (blue)${o.after.boomBlobX != null ? ', the booms\' own (green)' : ''}.</figcaption></figure>
  ${opts.layers ? rodLayers(k, o) : ''}
  ${numbers(o)}
  ${alt}
</article>`;
}

const official = ['cub', 'jodel', 'c172', 'c172f', 'stolcub', 'pa18f'];
const convRows = official.map(k => { const o = L(k), a = o.before, b = o.after, r = o.rec;
  const dl = (r.rows[r.rows.length - 1].x - r.rows[0].x), fl = a.ST[a.ST.length - 1].x + a.cowlLen;
  return `<tr><td>${NAME[k]}</td><td>${f2(fl)} → ${f2(dl)} m <span class="chg">(${((fl / dl - 1) * 100).toFixed(1)} %)</span></td><td>${arrow(a.body, b.body, f3)}</td><td>${arrow(a.Vc, b.Vc, f1)}</td><td>${arrow(a.sm, b.sm, f3)}</td><td>${arrow(a.cnBeta, b.cnBeta, f3)}</td></tr>`; }).join('');

const summary = ['chinook', 'rufus', 'twin'].map(k => { const o = L(k), a = o.before, b = o.after;
  return `<tr><td><a href="#p-${k}">${NAME[k]}</a></td><td>${f2(a.ST[a.ST.length - 1].x)} → ${f2(o.rec.rod ? o.rec.closeX : o.rec.closeX)} m</td><td>${arrow(a.body, b.body, f3)}</td><td>${arrow(a.Vc, b.Vc, f1)}</td><td>${arrow(a.sm, b.sm, f3)}</td><td>${arrow(a.cnBeta, b.cnBeta, f3)}</td></tr>`; }).join('');

const tpl = fs.readFileSync(D + '/plan_tpl.html', 'utf8');
const html = tpl.replace('{{SUMMARY}}', summary)
  .replace('{{RODS}}', [
    card('chinook', { tag: 'official · rod · pusher on the wing', layers: 1, lede: 'A short covered pod whose 25 cm panelled taper closes onto an 89 mm tube. Today the physics flies a full-section cone from the box to the tail post.' }),
    card('rufus', { tag: 'official · rod · open frame', layers: 1, lede: 'An open truss, no panels on its taper: the truss converges onto a 113 mm tube. In the new model the unpanelled taper is the tube (your ruling); the open frame keeps its open-frame row, now over the drawn box, and its end is a base.' }),
  ].join(''))
  .replace('{{RODS_MORE}}', ['birdman', 'v8pusher', 'v7twin'].map(k => card(k, { tag: { birdman: 'candidate · rod · panelled taper', v8pusher: 'candidate · rod · pusher on the bulkhead, short cabin', v7twin: 'fixture · rod · open frame, wing engines' }[k], layers: 1 })).join(''))
  .replace('{{TWIN}}', card('twin', { tag: 'official · twin booms · back cowl', lede: 'The pod ends on the pusher\'s back cowl (the cowl layer, PROPER-COWLS): 0.99 × 1.29 m at the box to a 0.31 × 0.37 m exit 0.58 m later. Today the tail-arm floor (60_gen_spec.js:6359) stretches the pod to 3.47 m, with the 1.91 m disc turning inside the phantom cone.' }))
  .replace('{{CONV}}', convRows)
  .replace('{{MODELS}}', ['chinook', 'rufus', 'twin', 'birdman', 'v8pusher', 'v7twin'].map(k => { const B = L(k), A = LA(k), H = LH(k);
    return `<tr><td>${NAME[k]}</td><td>${f3(B.before.body)} · ${f1(B.before.Vc)}</td><td>${f3(A.after.body)} · ${f1(A.after.Vc)}</td><td class="pick">${f3(B.after.body)} · ${f1(B.after.Vc)}</td><td>${f3(H.after.body)} · ${f1(H.after.Vc)}</td></tr>`; }).join(''));
fs.writeFileSync(D + '/plan.html', html);
console.log('plan.html', html.length);
