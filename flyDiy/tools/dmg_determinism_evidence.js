#!/usr/bin/env node
// G2354-G2356 (DMG-DETERMINISM): the ensembles' evidence - node only.
//   node tools/dmg_determinism_evidence.js --run <out.json> --sets <label=core|this[@amp]>,... --cases <key/id>,... [--n 32] [--jobs 1]
//       each set's core (a built tools/flight_core.js from another tree, or `this`) flies every case as an ensemble of n
//       (_treecrash_lib ensemble: member 0 the run as it was, the others the start nudged 1e-9 m, seeded); appended to
//       <out.json> as it goes (a long run keeps what it has); `@amp` the nudge's size in metres (default 1e-9)
//   node tools/dmg_determinism_evidence.js --compare <in.json> <labelA> <labelB>    the rank test, field by field
//   node tools/dmg_determinism_evidence.js --svg <in.json> <out.svg> [--title t]     the ensembles drawn: every member a dot,
//       the median a bar, p10-p90 a band, per case and set (members broken; the work in kJ beside)
'use strict';
const path = require('path'), fs = require('fs');
const L = require('./_treecrash_lib.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };

if (argv[0] === '--run') {
  const out = argv[1], N = +opt('n', 32), J = +opt('jobs', 1);
  const sets = opt('sets', 'this=this').split(',').map(s => { const [label, c0] = s.split('='), [core, amp] = c0.split('@'); return { label, core: core === 'this' ? null : path.resolve(core), amp: amp ? +amp : null }; });
  const cases = opt('cases', 'jodel/trunk0').split(',').map(c => c.split('/'));
  const R = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { n: N, amp: L.ENS_AMP, rows: [] };
  (async () => {
    for (const S of sets) {
      const certDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'detev-'));
      for (const [k, id, dmg] of cases) {
        if (R.rows.some(r => r.set === S.label && r.key === k && r.id === id && (r.dmg || 'on') === (dmg || 'on'))) continue;
        const t0 = Date.now();
        const E = await L.ensemble(k, id, { n: N, jobs: J, core: S.core || undefined, certDir, dmg: dmg || 'on', o: S.amp ? { amp: S.amp } : {} });
        R.rows.push({ set: S.label, core: S.core, amp: S.amp || L.ENS_AMP, key: k, id, dmg: dmg || 'on', stats: E.stats, members: E.members.map(m => ({ seed: m.seed, hash: m.hash, broken: m.broken, pieces: m.pieces,
          work: +m.work.toFixed(1), mountOff: m.mountOff, cowlOff: m.cowlOff, crashed: m.crashed, wing: m.wing, finite: m.finite })), s: (Date.now() - t0) / 1000 });
        fs.writeFileSync(out, JSON.stringify(R));
        console.log(S.label.padEnd(10) + ' ' + (k + '/' + id).padEnd(16) + ' ' + L.ENS_FIELDS.map(f => f + ' ' + L.ensLine(E, f)).join('  ') + '  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
      }
      try { fs.rmSync(certDir, { recursive: true, force: true }); } catch (e) { /* stays */ }
    }
  })().catch(e => { console.error(e); process.exit(1); });
} else if (argv[0] === '--compare') {
  const R = JSON.parse(fs.readFileSync(argv[1], 'utf8')), A = argv[2], B = argv[3];
  for (const ra of R.rows.filter(r => r.set === A)) {
    const rb = R.rows.find(r => r.set === B && r.key === ra.key && r.id === ra.id && r.dmg === ra.dmg); if (!rb) continue;
    const c = L.ensCompare(ra, rb);
    console.log(ra.key + '/' + ra.id + ': ' + L.ENS_FIELDS.map(f => f + ' ' + c[f].a.median + ' -> ' + c[f].b.median + ' (p ' + c[f].p.toFixed(4) + (c[f].moved ? ', MOVED' : '') + ')').join(', '));
  }
} else if (argv[0] === '--svg') {
  const R = JSON.parse(fs.readFileSync(argv[1], 'utf8')), title = opt('title', 'The 30 m/s crashes as ensembles');
  const cases = [...new Set(R.rows.map(r => r.key + '/' + r.id + (r.dmg === 'off' ? '/off' : '')))], sets = [...new Set(R.rows.map(r => r.set))];
  const COL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#8f5bd6'];   // the dataviz palette's first slots
  const W = 1000, rowH = 26 * sets.length + 22, H = 96 + cases.length * rowH + 40, ml = 150, pw = W - ml - 250;
  const maxB = Math.max(...R.rows.flatMap(r => r.members.map(m => m.broken))) * 1.05 || 1, X = v => ml + v / maxB * pw;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif" font-size="11">` +
    `<style>.s{fill:#fcfcfb}.t{fill:#0b0b0b}.m{fill:#52514e}.g{stroke:#e4e3df}@media (prefers-color-scheme:dark){.s{fill:#1a1a19}.t{fill:#fff}.m{fill:#c3c2b7}.g{stroke:#383835}}</style>` +
    `<rect class="s" width="${W}" height="${H}"/><text class="t" x="16" y="24" font-size="14" font-weight="600">${title}</text>` +
    `<text class="m" x="16" y="42">members broken, one dot per member (every node's start nudged, seeded, by the size in the label); bar median, band p10-p90; right: broken, then the member work in kJ</text>`;
  sets.forEach((st, i) => { const x = 16 + i * 170; s += `<rect x="${x}" y="54" width="10" height="10" rx="2" fill="${COL[i % COL.length]}"/><text class="m" x="${x + 14}" y="63">${st}</text>`; });
  for (let v = 0; v <= maxB; v += maxB > 200 ? 50 : 25) s += `<line class="g" x1="${X(v)}" x2="${X(v)}" y1="76" y2="${H - 30}"/><text class="m" x="${X(v)}" y="${H - 16}" text-anchor="middle">${v}</text>`;
  cases.forEach((c, ci) => {
    const y0 = 84 + ci * rowH;
    s += `<text class="t" x="16" y="${y0 + 14}" font-weight="600">${c.replace('/', ' ')}</text>`;
    sets.forEach((st, si) => {
      const r = R.rows.find(q => q.set === st && q.key + '/' + q.id + (q.dmg === 'off' ? '/off' : '') === c); if (!r) return;
      const y = y0 + 12 + si * 26, col = COL[si % COL.length], b = r.stats.broken, w = r.stats.work;
      s += `<rect x="${X(b.p10)}" y="${y - 7}" width="${Math.max(1, X(b.p90) - X(b.p10))}" height="14" fill="${col}" opacity="0.18"/>`;
      for (const m of r.members) s += `<circle cx="${X(m.broken).toFixed(1)}" cy="${y}" r="2.6" fill="${col}" opacity="0.75"/>`;
      s += `<rect x="${X(b.median) - 1}" y="${y - 9}" width="2.5" height="18" fill="${col}"/>`;
      s += `<text class="m" x="${ml + pw + 10}" y="${y + 4}">${b.median} [${b.p10.toFixed(0)}-${b.p90.toFixed(0)}] · ${(w.median / 1000).toFixed(1)} kJ [${(w.p10 / 1000).toFixed(1)}-${(w.p90 / 1000).toFixed(1)}]</text>`;
    });
  });
  s += `<text class="m" x="${ml + pw / 2}" y="${H - 2}" text-anchor="middle">members broken</text></svg>`;
  fs.writeFileSync(argv[2], s);
  console.log('wrote ' + argv[2]);
}
