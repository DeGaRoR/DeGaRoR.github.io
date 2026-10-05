#!/usr/bin/env node
// G1823 (DMG-D1b WRECK INTEGRITY): the evidence, reports/evidence/DMG-D1b/ (node only):
//   component_<case>.svg   a wreck from above, BEFORE (the base's core: TREE-CRASH's any-break kill) and AFTER (this
//                          core: the strip component test), the same scenario flown by each, the strips filled by state:
//                          flying green, dropped red; the members by part, broken dashed pink
//   passthru_<case>.svg    the nose engine through the firewall: the same crash without the SUPPORT limiters and with
//                          them, at the moment the engine went deepest without (the engine's nodes ringed; the limiters
//                          green, solid while closed)
//   runs.json              every case's numbers
// node tools/dmg_integrity_evidence.js [--base <the base's flyDiy dir>] [--out <dir>]
//   (--base: a worktree of the base branch, built (tools/build.js); without it the BEFORE panels are skipped)
'use strict';
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2), arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

// the cases: [key, label, scenario, the time to draw (s after the first break)]
const COMP = [
  ['jodel', 'the Jodel, a trunk at 30 m/s 2.5 m out (the left wing)', { D: 40, agl: 4, V: 30, thr: 0, secs: 3, off: 2.5 }, 0.6],
  ['cub', 'the Cub, ONE diagonal in a wing\'s second bay broken (parked; nothing else)', { diag: true, off: 'diag' }, 0],
];

// ---- a child: fly one scenario with the lib at `libDir`, dump the frame `dt` s after the first break ----
if (argv[0] === '--frame') {
  const libDir = argv[1], c = COMP.find(x => x[0] + x[2].off === argv[2]);
  const L = require(path.join(libDir, '_treecrash_lib.js'));
  let snap = null, tB = null;
  // the frame hook by wrapping the sim's step (the base's lib has no onFrame)
  const C = L.core(), mk = C.makeSim;
  const hook = s => {
    const D = s.damage(); if (tB == null && D.breaks) tB = s.t;
    if (snap || tB == null || s.t < tB + c[3] - 1e-9) return;
    const S = s.damageStrips ? s.damageStrips() : null;
    snap = { t: s.t, tB, p: Array.from(s.p), beams: s.beams.map(b => [b.a, b.b, b.broken ? 1 : 0, b.supp ? 1 : 0]), broken: D.broken.slice(), dead: S ? Array.from(S.dead) : null,
      crashed: D.crashed, reason: D.reason, breaks: D.breaks };
  };
  C.makeSim = (...a) => { const sm = mk(...a), st = sm.step; sm.step = dt => { const r = st(dt); hook(sm); return r; }; return sm; };
  let def;
  if (c[2].diag) {
    // a diagonal of the left wing's second bay: a wing member between a front and a rear spar node of different stations
    def = L.defOf(c[0]); const sm = mk(def, null); sm.reset(0);
    const wl = def.nodes.map((nd, i) => i).filter(i => def.nodes[i].plane === 0 || def.nodes[i].plane == null).filter(i => /^W[FR]$/.test(def.nodes[i].tag || '') && def.nodes[i].p[2] < 0);
    const zs = [...new Set(wl.map(i => +def.nodes[i].p[2].toFixed(4)))].sort((a, b) => b - a);   // root outwards (z < 0)
    const bi = def.beams.findIndex(b => { const ta = def.nodes[b.a].tag, tb = def.nodes[b.b].tag, za = +def.nodes[b.a].p[2].toFixed(4), zb = +def.nodes[b.b].p[2].toFixed(4);
      return ta !== tb && /^W[FR]$/.test(ta) && /^W[FR]$/.test(tb) && Math.min(za, zb) === zs[2] && Math.max(za, zb) === zs[1] && b.grp < 0; });
    sm.damageBreak(bi); tB = 0; hook(sm);
    snap.diag = bi;
  } else def = L.atTrunk(c[0], c[2]).def;
  snap.strips = def.strips.map(st => ({ q: st.fIn != null ? [st.fIn, st.fOut, st.rOut, st.rIn] : st.w.map(w => w[0]) }));
  snap.part = def.parts.dmg ? def.parts.dmg.part : null;
  snap.tags = def.nodes.map(n => n.tag || '');
  // TREE-CRASH's rule, on its own broken list (what the base core flew with)
  const sets = def.strips.map(st => { const N = new Set(st.w.map(w => w[0])); for (const k of ['fIn', 'fOut', 'rIn', 'rOut']) if (st[k] != null) N.add(st[k]); return N; });
  snap.oldDead = def.strips.map((st, si) => snap.broken.some(bi => { const b = snap.beams[bi]; return sets[si].has(b[0]) && sets[si].has(b[1]); }) ? 1 : 0);
  console.log('SNAP ' + JSON.stringify(snap));
  process.exit(0);
}

const L = require('./_treecrash_lib.js'), I = require('./_dmg_integrity_lib.js');
const OUT = arg('--out') || path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D1b'), BASE = arg('--base');
fs.mkdirSync(OUT, { recursive: true });
const runs = {};
const f2 = x => x.toFixed(2);

// the wreck from above, in the cabin's frame (rings 1 and 3), strips filled
function topDown(snap, title, deadOf, W0) {
  const p = snap.p, tags = snap.tags, part = snap.part, T = {}; tags.forEach((t, i) => { if (t && T[t] == null) T[t] = i; });
  const cen = ts => { const c = [0, 0, 0]; for (const t of ts) for (let k = 0; k < 3; k++) c[k] += p[T[t]*3+k] / ts.length; return c; };
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return a.map(x => x / l); }, sub = (a, b) => a.map((x, k) => x - b[k]);
  const R1 = cen(['S1BL', 'S1BR', 'S1TL', 'S1TR']), R3 = cen(['S3BL', 'S3BR', 'S3TL', 'S3TR']), xA = nrm(sub(R3, R1));
  const up = sub(cen(['S1TL', 'S1TR', 'S3TL', 'S3TR']), cen(['S1BL', 'S1BR', 'S3BL', 'S3BR'])), dd = up[0]*xA[0] + up[1]*xA[1] + up[2]*xA[2], yU = nrm(up.map((x, k) => x - dd * xA[k]));
  const zR = [yU[1]*xA[2] - yU[2]*xA[1], yU[2]*xA[0] - yU[0]*xA[2], yU[0]*xA[1] - yU[1]*xA[0]];
  const loc = i => { const d = [p[i*3] - R1[0], p[i*3+1] - R1[1], p[i*3+2] - R1[2]]; return [d[0]*xA[0] + d[1]*xA[1] + d[2]*xA[2], d[0]*zR[0] + d[1]*zR[1] + d[2]*zR[2]]; };
  const W = W0 || 440, H = 440, sc = 34, X = q => W / 2 + q[1] * sc, Y = q => 70 + q[0] * sc;   // the nose up the page, right to the right
  let s = `<g><rect width="${W}" height="${H}" fill="#fff" stroke="#ddd"/><text x="8" y="16" font-weight="bold">${title}</text>`;
  const dead = deadOf(snap);
  snap.strips.forEach((st, si) => { const pts = st.q.map(i => { const q = loc(i); return X(q).toFixed(1) + ',' + Y(q).toFixed(1); }).join(' ');
    s += `<polygon points="${pts}" fill="${dead[si] ? '#e74c3c' : '#2ecc71'}" fill-opacity="${dead[si] ? 0.55 : 0.35}" stroke="none"/>`; });
  const col = q => q === 'body' ? '#555' : /^eng/.test(q) ? '#c0392b' : /^wing/.test(q) ? '#2e6db4' : /^(gear|tw|float)/.test(q) ? '#8e44ad' : '#16a085';
  for (const [a, b, br, sp] of snap.beams) { if (sp) continue; const A = loc(a), B = loc(b), q = part ? (part[a] === part[b] ? part[a] : 'joint') : 'body';
    s += br ? `<line x1="${X(A).toFixed(1)}" y1="${Y(A).toFixed(1)}" x2="${X(B).toFixed(1)}" y2="${Y(B).toFixed(1)}" stroke="#f1948a" stroke-width="0.7" stroke-dasharray="2,2"/>`
            : `<line x1="${X(A).toFixed(1)}" y1="${Y(A).toFixed(1)}" x2="${X(B).toFixed(1)}" y2="${Y(B).toFixed(1)}" stroke="${q === 'joint' ? '#e67e22' : col(q)}" stroke-width="0.9"/>`; }
  const nd = dead.reduce((a, x) => a + x, 0);
  s += `<text x="8" y="${H - 26}" fill="#333">${snap.breaks} members broken; ${nd} of ${snap.strips.length} strips dropped (red), ${snap.strips.length - nd} flying (green)</text>`;
  s += `<text x="8" y="${H - 10}" fill="#777">t ${f2(snap.t)} s (${f2(snap.t - snap.tB)} s after the first break); ${snap.crashed ? 'CRASHED: ' + snap.reason : ''}</text></g>`;
  return { svg: s, dropped: nd };
}

for (const c of COMP) {
  const id = c[0] + c[2].off, nm = 'component_' + c[0] + (c[2].diag ? '_diagonal' : c[2].off ? '_wing' : '_centre') + '.svg';
  const get = dir => { const r = spawnSync(process.execPath, [__filename, '--frame', dir, id], { encoding: 'utf8', maxBuffer: 1 << 28 }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('SNAP ')); if (!l) { console.error(r.stderr); return null; } return JSON.parse(l.slice(5)); };
  const after = get(__dirname), before = BASE ? get(path.join(BASE, 'tools')) : null;
  if (before && !before.part) before.part = after.part;   // (the same build's nodes: the base's def has no part list)
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${before ? 900 : 450}" height="480" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`;
  s += `<text x="8" y="14" font-weight="bold" font-size="12">${c[1]} - from above${c[2].diag ? '' : ', ' + c[3] + ' s after the first break'} (the nose up the page)</text><g transform="translate(0,26)">`;
  const out = { label: c[1] };
  if (before) { const b = topDown(before, 'BEFORE: the base (any break inside a strip kills it)', x => x.oldDead); s += b.svg; out.before = { breaks: before.breaks, dropped: b.dropped, reason: before.reason }; }
  const a = topDown(after, 'AFTER: the component test (only strips whose nodes parted)', x => x.dead); s += `<g transform="translate(${before ? 455 : 0},0)">` + a.svg + '</g>';
  out.after = { breaks: after.breaks, dropped: a.dropped, oldRuleOnSameBreaks: after.oldDead.reduce((x, y) => x + y, 0), reason: after.reason };
  s += '</g></svg>';
  fs.writeFileSync(path.join(OUT, nm), s); runs[nm] = out; console.log(nm, JSON.stringify(out));
}

// ---- the pass-through, without the limiters and with them ----
const PT = [
  ['metal', 'the metal Cessna, a severe nose-in on the ground (180 km/h, 10 m/s, 60 deg)', 'ground', { V: 50, sink: 10, pitch: 60, secs: 4 }],
  ['cub', 'the Cub, a trunk at 30 m/s on the centreline', 'trunk', { D: 40, agl: 4, V: 30, thr: 0, secs: 3, off: 0 }],
];
for (const [k, lab, kind, o] of PT) {
  const fly = (def, at) => { let pr = null, shot = null, eng = [], dUsed = def;
    const hook = { def, onStart: (s, d) => { dUsed = d; pr = I.makeProbe(s, d); eng = []; for (let i = 0; i < s.n; i++) if (/^eng/.test(d.parts.dmg.part[i])) eng.push(i); },
      onFrame: s => { pr.frame(s.t); if (at != null && !shot && s.t >= at - 1e-9) shot = { svg: I.draw(s, dUsed, { title: '', mark: eng, w: 900, h: 260 }), t: s.t }; } };
    if (kind === 'ground') I.groundCase(k, Object.assign({}, o, hook));
    else L.atTrunk(k, Object.assign({}, o, { onStart: hook.onStart, onFrame: hook.onFrame }));   // (atTrunk flies defOf's def: the toggle below)
    return { res: pr.res(), shot };
  };
  // the limiters off for the 'before': the cached def's list emptied (defOf's copies share its parts), then restored
  const dmg = L.defOf(k).parts.dmg, supp = dmg.supp, off = f => { dmg.supp = []; try { return f(); } finally { dmg.supp = supp; } };
  const withDef = L.defOf(k), noDef = I.noSupp(withDef);
  const b0 = off(() => fly(kind === 'ground' ? noDef : null, null)), engB = b0.res.filter(x => /^eng/.test(x.part)), tAt = engB.length ? engB[0].t : 1.4;
  const before = off(() => fly(kind === 'ground' ? noDef : null, tAt)), after = fly(kind === 'ground' ? withDef : null, tAt);
  const engD = R => R.filter(x => /^eng/.test(x.part)).map(x => ({ tag: x.tag, bay: x.bay, d: +x.d.toFixed(3), t: +x.t.toFixed(2), att: x.att }));
  const nm = 'passthru_' + k + '_' + kind + '.svg';
  const strip = sv => sv.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const eb = engD(before.res), ea = engD(after.res), dsc = E => E.length ? E.map(e => e.tag + ' ' + e.d.toFixed(2) + ' m into bay ' + e.bay + (e.att ? '' : ' (off its mount)')).join(', ') : 'none';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${2 * 318 + 30}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`;
  s += `<text x="8" y="14" font-weight="bold" font-size="12">${lab}: the engine (ringed) and the cabin, t ${f2(before.shot.t)} s</text>`;
  s += `<g transform="translate(0,22)">${strip(before.shot.svg)}<text x="8" y="14" font-weight="bold" fill="#c0392b">WITHOUT the SUPPORT limiters - the engine in the cabin: ${dsc(eb)}</text></g>`;
  s += `<g transform="translate(0,${22 + 318})">${strip(after.shot.svg)}<text x="8" y="14" font-weight="bold" fill="#1e8449">WITH them (green; solid = closed, pushing) - ${dsc(ea)}</text></g></svg>`;
  fs.writeFileSync(path.join(OUT, nm), s);
  runs[nm] = { label: lab, without: eb, with: ea, otherWith: after.res.filter(x => !/^eng/.test(x.part)).slice(0, 8).map(x => ({ part: x.part, tag: x.tag, bay: x.bay, d: +x.d.toFixed(3), t: +x.t.toFixed(2), att: x.att })) };
  console.log(nm, JSON.stringify(runs[nm]));
}
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(runs, null, 1) + '\n');
console.log('written to ' + OUT);
