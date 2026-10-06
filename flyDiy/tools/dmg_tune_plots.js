#!/usr/bin/env node
// G1897 (DMG-TUNE): the sanity table (markdown + JSON), the group census and the SVG plots from the runs
// dmg_tune_evidence.js wrote. Pure: reads JSON, writes files.
//
//   node tools/dmg_tune_plots.js --before <sweep_before.json> --after <sweep_after.json>
//        --ratios-before <r0.json> --ratios-after <r1.json> --out reports/evidence/DMG-TUNE
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const OUT = opt('out') || 'reports/evidence/DMG-TUNE';
fs.mkdirSync(OUT, { recursive: true });
const load = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const B = load(opt('before')), A = load(opt('after'));
const LAB = { cub: 'the user\'s Cub', jodel: 'Jodel', metal: 'metal Cessna', floats: 'Cessna floats', twinFloats: 'twin floatplane' };
const CR = { taxi: '3 m/s taxi, trunk', noseover: 'nose-over, 35 cm stump', trunk0: '30 m/s trunk, centreline', trunk25: '30 m/s trunk, 2.5 m out', hard: 'hard landing 1.5 x limit sink', digin: 'float dig-in' };
const BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'], CRASHES = ['taxi', 'noseover', 'trunk0', 'trunk25', 'hard', 'digin'];
const SECS = ['engines', 'bracing', 'wings', 'tail', 'gear', 'fuselage', 'vessel'];
const find = (S, k, id, mode) => S.runs.find(r => r.k === k && r.id === id && r.mode === mode);

// ---- THE PLAUSIBLE REFERENCE, in words (every source AS RECALLED, not opened in this session: A0 opens them) ----
const REF = {
  taxi: { words: 'A taxiing aeroplane meeting a tree or a post at walking-to-jogging pace: the propeller strikes (a prop strike: engine teardown per Lycoming SB 533 / Continental SB96-11), the spinner and the cowl dent, a leading edge dents if a wing meets it. No primary structure breaks; the engine stays on its mount.',
    src: 'NTSB taxi-collision briefs (CA-class reports: "the propeller struck a pole/tree while taxiing", substantial damage to the propeller) - as recalled; DEFORM §7.1 #1',
    rule: r => r.broken <= 3 && !offHas(r, /eng|wing|stab|fin/) },
  noseover: { words: 'The wheels stopped by a stump or soft ground at 8-12 m/s: the aeroplane pitches over onto its nose or its back. The propeller strikes and bends, the cowl and nose are crushed, the gear may be torn from the stump, the fin and rudder are crushed if it goes over; a wing tip or a strut may crease. The wings stay on and are not shredded; the engine stays on its (perhaps bent) mount.',
    src: 'de Voogt & Louteiro 2024 (134 NTSB nose-overs, CC BY) and NTSB J-3 / PA-18 nose-over briefs ("damage to the propeller, rudder and vertical stabilizer"), AAIB G-BBPS (inverted) - as recalled, via DEFORM §7.1 #13 / §7.4',
    rule: r => !offHas(r, /eng|wing/) && (r.bySec.wings || 0) + (r.bySec.bracing || 0) <= 4 && (r.bySec.engines || 0) <= 6 },
  trunk0: { words: 'Into a tree on the centreline at 58 kt: the trunk stops the nose - the engine is driven back or torn from its mount, the firewall and cabin crush, the wings may tear off at their roots by their own inertia, the tail may separate. A non-survivable-class impact: a great deal breaks. The point here is only that it CRASHES and comes apart at its joints.',
    src: 'NTSB tree-collision reports ("both wings separated, the engine displaced aft") - as recalled; NASA Langley GA crash tests (TP-1042, TP-1477, TP-1699: high-wing singles at ~25-27 m/s into soil, the engine bay and firewall crushed; NASA 20160006503 for the 172) - as recalled via DEFORM §7.1',
    rule: r => r.crashed },
  trunk25: { words: 'A wing meets a tree 2.5 m out at 58 kt: that wing is cut or torn - at the trunk, or at its strut / root fitting - and the aeroplane slews round the tree and meets the ground. That wing and the strut or bracing near it break; the gear, a wing tip, the propeller may take the ground. The engine stays on, the tail stays on, the far wing is not shredded.',
    src: 'NTSB wing-strike reports ("the left wing struck a tree and separated outboard of the lift strut attach") - as recalled; DEFORM §7.4 "tree at speed" row',
    rule: r => r.crashed && !offHas(r, /eng|stab|fin|wing0R/) && (r.bySec.engines || 0) <= 6 },
  hard: { words: 'A touchdown at 1.5 x the gear\'s limit sink (FAR 23.473\'s V, as recalled), no lift: past FAR 23.727\'s reserve (1.2 V, no failure). The gear may yield (a spread spring-steel leg, a bottomed oleo, a stretched bungee) or break at a lug; the airframe takes no set; a tricycle may strike its propeller.',
    src: 'FAR 23.473 / 23.725 / 23.727 (as recalled); NASA 172 Test 1 breaks the gear at ~7 m/s (DEFORM §7.3)',
    rule: r => !offHas(r, /eng|wing|stab|fin|body/) && Object.keys(r.bySec).every(s => s === 'gear') },
  digin: { words: 'A float bow digs in on landing: a water loop or cartwheel, a wing into the water, the float struts\' fittings fail in overload, it capsizes. The engine stays on its mount.',
    src: 'NTSB ANC19FA035, TSB A18A0053 (as recalled, via DEFORM §7.4)',
    rule: r => !offHas(r, /eng/) },
};
const offHas = (r, re) => (r.off || []).some(o => o.parts.split('+').some(p => re.test(p)));
const offTxt = r => { const m = {}; for (const o of r.off || []) m[o.parts] = (m[o.parts] || 0) + o.m; const e = Object.entries(m).sort((a, b) => b[1] - a[1]);
  return e.length ? e.slice(0, 6).map(([p, kg]) => p + ' ' + kg.toFixed(0) + ' kg').join('; ') + (e.length > 6 ? '; +' + (e.length - 6) + ' pieces' : '') : '-'; };
const secTxt = r => SECS.filter(s => r.bySec[s]).map(s => s + ' ' + r.bySec[s]).join(', ') || '-';

// ---- the table ----
const rows = [];
for (const k of BUILDS) for (const id of CRASHES) {
  const b = find(B, k, id, 'cert'), a = find(A, k, id, 'cert'), p = find(A, k, id, 'phys') || find(B, k, id, 'phys');
  if (!a) continue;
  const R = REF[id];
  rows.push({ k, id, ref: R.words, src: R.src,
    before: b && { broken: b.broken, bySec: b.bySec, work: b.work, off: b.off, crashed: b.crashed, reason: b.reason, plausible: R.rule(b) },
    after: { broken: a.broken, bySec: a.bySec, setBySec: a.setBySec, work: a.work, off: a.off, crashed: a.crashed, reason: a.reason, gPeak: a.gPeak, prop: a.prop, plausible: R.rule(a) },
    physics: p && { broken: p.broken, bySec: p.bySec, work: p.work, off: p.off } });
}
fs.writeFileSync(path.join(OUT, 'sanity_table.json'), JSON.stringify({ before: B.at, after: A.at, specDir: A.specDir, rows }, null, 1));
let md = '# DMG-TUNE - the sanity table (G1897)\n\nEach validated aeroplane in the standard crashes, damage ON with the certificate stamped: members broken by ledger section, plastic work, what came off - BEFORE (the base, claude/dmg-integration 4300dc5) and AFTER (this branch), with D1a\'s physics limits (no certificate) as a third column, against a plausible reference written in words. **Every source is as recalled - nothing was opened in this session; A0 opens them before a number becomes a gate.** The Cessnas fly JOIN-PARITY\'s page-loaded spec (READY on claude/join-parity-g1985: the engine 65 cm forward of node\'s file); the others the file as written. "plausible" is the rule written beside each reference (tools/dmg_tune_plots.js REF), checked mechanically - it is a floor, not a proof.\n\n';
for (const id of CRASHES) {
  const rs = rows.filter(r => r.id === id); if (!rs.length) continue;
  md += '## ' + CR[id] + '\n\n**Reference:** ' + REF[id].words + '\n\n*Sources (as recalled):* ' + REF[id].src + '\n\n';
  md += '| build | before: broken (by section) / kJ / off | after: broken (by section) / kJ / off | physics only | plausible before -> after |\n|---|---|---|---|---|\n';
  for (const r of rs) {
    const c = x => x ? '**' + x.broken + '** (' + secTxt(x) + ') / ' + (x.work / 1000).toFixed(1) + ' kJ / off: ' + offTxt(x) : '-';
    md += '| ' + LAB[r.k] + ' | ' + c(r.before) + ' | ' + c(r.after) + (r.after.crashed ? '; CRASHED (' + r.after.reason + ')' : '') + ' | ' + (r.physics ? r.physics.broken + ' (' + secTxt(r.physics) + ')' : '-') + ' | ' + (r.before ? (r.before.plausible ? 'yes' : 'NO') : '-') + ' -> ' + (r.after.plausible ? 'yes' : '**NO**') + ' |\n';
  }
  md += '\n';
}
fs.writeFileSync(path.join(OUT, 'sanity_table.md'), md);

// ---- the group census (Q2) ----
const census = S => { const c = { releases: 0, single: 0, byHow: {}, list: [] };
  for (const r of S.runs) { if (r.mode !== 'cert' || !r.groups) continue; for (const g of r.groups) { c.releases++; const h = /-/.test(g.how) || Math.abs(g.byR) < 0.9 ? 'cluster cut' : g.how; c.byHow[h] = (c.byHow[h] || 0) + 1;
    const one = g.n0 > 1 && g.othersMax < 0.9 && !/-/.test(g.how) && Math.abs(g.byR) >= 0.9; /* (a trigger under its own limit was a cluster's cut, D3) */ if (one) c.single++; c.list.push({ k: r.k, id: r.id, key: g.key, how: !/-/.test(g.how) && Math.abs(g.byR) < 0.9 ? 'a cluster\'s cut (D3)' : g.how, othersMax: +g.othersMax.toFixed(2), n0: g.n0, single: one }); } }
  return c; };
const cB = census(B), cA = census(A);
fs.writeFileSync(path.join(OUT, 'groups.json'), JSON.stringify({ before: cB, after: cA }, null, 1));
let gm = '# DMG-TUNE - the break-group census (G1894)\n\nEvery group that let go in the standard crashes (the certificate stamped), with the member that released it, how it went, and the largest load of the group\'s OTHER members (over their own limits) one substep before. "one member" = a group of several that went while every other member was under 0.9 of its limit.\n\n';
gm += '| | releases | released by one member | by how |\n|---|---|---|---|\n';
gm += '| before (any member broken takes the group) | ' + cB.releases + ' | ' + cB.single + ' | ' + JSON.stringify(cB.byHow) + ' |\n';
gm += '| after (one member never; a third of the strength broken - severed or kinked) | ' + cA.releases + ' | ' + cA.single + ' | ' + JSON.stringify(cA.byHow) + ' |\n\n';
for (const [lab, c] of [['BEFORE', cB], ['AFTER', cA]]) {
  gm += '### ' + lab + '\n\n| build | crash | group | members (type 0) | released by | the others\' largest share |\n|---|---|---|---|---|---|\n';
  for (const g of c.list) gm += '| ' + LAB[g.k] + ' | ' + CR[g.id] + ' | ' + g.key + ' | ' + g.n0 + ' | ' + g.how + (g.single ? ' **(one member)**' : '') + ' | ' + g.othersMax + ' |\n';
  gm += '\n';
}
fs.writeFileSync(path.join(OUT, 'groups.md'), gm);

// ---- SVG helpers (light + dark via the SVG's own style; the categorical slots in fixed order; <title> = hover) ----
const PAL = { light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'], dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const style = n => '<style>.bg{fill:#fcfcfb}.t1{fill:#0b0b0b}.t2{fill:#52514e}.grid{stroke:#e4e3de}' + Array.from({ length: n }, (_, i) => '.s' + i + '{fill:' + PAL.light[i] + '}').join('')
  + '@media (prefers-color-scheme: dark){.bg{fill:#1a1a19}.t1{fill:#ffffff}.t2{fill:#c3c2b7}.grid{stroke:#3a3a37}' + Array.from({ length: n }, (_, i) => '.s' + i + '{fill:' + PAL.dark[i] + '}').join('') + '}'
  + 'text{font-family:system-ui,-apple-system,Segoe UI,sans-serif}</style>';

// 1. members broken per section per crash, before / after (stacked horizontal bars, one panel per crash)
{
  const W = 980, rowH = 18, gap = 6, left = 210, right = 70;
  const panels = CRASHES.filter(id => rows.some(r => r.id === id));
  let max = 0; for (const r of rows) for (const x of [r.before, r.after]) if (x) max = Math.max(max, x.broken);
  max = Math.ceil(max / 50) * 50;
  const sx = v => left + (W - left - right) * v / max;
  let y = 70, body = '';
  for (const id of panels) {
    body += '<text class="t1" x="16" y="' + y + '" font-size="14" font-weight="600">' + esc(CR[id]) + '</text>'; y += 10;
    for (const r of rows.filter(q => q.id === id)) for (const [lab, x] of [['before', r.before], ['after', r.after]]) {
      if (!x) continue;
      body += '<text class="t2" x="' + (left - 8) + '" y="' + (y + 13) + '" font-size="11" text-anchor="end">' + esc(LAB[r.k] + ' - ' + lab) + '</text>';
      let x0 = 0;
      SECS.forEach((s, i) => { const v = x.bySec[s] || 0; if (!v) return; const w = sx(x0 + v) - sx(x0);
        body += '<rect class="s' + i + '" x="' + (sx(x0) + (x0 ? 1 : 0)).toFixed(1) + '" y="' + y + '" width="' + Math.max(1, w - (x0 ? 1 : 0)).toFixed(1) + '" height="' + rowH + '" rx="2"><title>' + esc(LAB[r.k] + ', ' + CR[id] + ', ' + lab + ': ' + s + ' ' + v) + '</title></rect>'; x0 += v; });
      body += '<text class="t1" x="' + (sx(x0) + 6) + '" y="' + (y + 13) + '" font-size="11"' + (lab === 'after' ? ' font-weight="600"' : '') + '>' + x.broken + (x.plausible === false ? ' x' : '') + '</text>';
      y += rowH + 2;
    }
    y += gap + 18;
  }
  const H = y + 10;
  let grid = ''; for (let v = 0; v <= max; v += 50) grid += '<line class="grid" x1="' + sx(v) + '" x2="' + sx(v) + '" y1="56" y2="' + (H - 20) + '"/><text class="t2" x="' + sx(v) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle">' + v + '</text>';
  let leg = ''; SECS.forEach((s, i) => { leg += '<rect class="s' + i + '" x="' + (16 + i * 120) + '" y="34" width="12" height="12" rx="2"/><text class="t1" x="' + (32 + i * 120) + '" y="44" font-size="12">' + s + '</text>'; });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + style(SECS.length) + '<rect class="bg" width="100%" height="100%"/>'
    + '<text class="t1" x="16" y="22" font-size="16" font-weight="600">Members broken per ledger section: before (base) and after (DMG-TUNE); x = fails its reference</text>'
    + leg + grid + body + '</svg>';
  fs.writeFileSync(path.join(OUT, 'broken_by_part.svg'), svg);
}

// 2. the stamp over the physics per member class (Q1): the median and the 10-90 % band, before and after
{
  const R0 = load(opt('ratios-before')), R1 = load(opt('ratios-after'));
  const cls = r => (r.gear ? 'gear' : r.sec) + (r.seam === 'fitting' ? ' joint' : r.seam ? ' seam' : '');
  const stats = R => { const m = {}; for (const b of R) for (const r of b.rows) { const k = b.k + '|' + cls(r); (m[k] = m[k] || []).push(r.fu / r.pfu); }
    const o = {}; for (const [k, a] of Object.entries(m)) { a.sort((x, y) => x - y); const q = f => a[Math.min(a.length - 1, Math.floor(f * a.length))]; o[k] = { n: a.length, p10: q(0.1), med: q(0.5), p90: q(0.9), floor: a.filter(x => Math.abs(x - a[0]) < 1e-6).length }; } return o; };
  const s0 = stats(R0), s1 = stats(R1);
  fs.writeFileSync(path.join(OUT, 'stamp_ratio.json'), JSON.stringify({ before: s0, after: s1, note: 'fu (the stamped tension break) over the member\'s D1a physics break, per build and member class' }, null, 1));
  const keys = Object.keys(s1).filter(k => !/\|gear/.test(k)).sort();
  const W = 980, left = 260, right = 40, rowH = 16, H = 80 + keys.length * (rowH + 6) + 40;
  const sx = v => left + (W - left - right) * v;
  let body = '', y = 70;
  for (const k of keys) {
    const [b, c] = k.split('|');
    body += '<text class="t2" x="' + (left - 8) + '" y="' + (y + 12) + '" font-size="11" text-anchor="end">' + esc(LAB[b] + ' - ' + c + ' (' + s1[k].n + ')') + '</text>';
    for (const [j, S] of [[0, s0[k]], [1, s1[k]]]) { if (!S) continue; const yy = y + j * 8;
      body += '<rect class="s' + j + '" x="' + sx(S.p10).toFixed(1) + '" y="' + yy + '" width="' + Math.max(2, sx(S.p90) - sx(S.p10)).toFixed(1) + '" height="6" rx="2" opacity="0.55"><title>' + esc(LAB[b] + ' ' + c + (j ? ' after' : ' before') + ': 10-90 % ' + S.p10.toFixed(2) + '-' + S.p90.toFixed(2) + ', median ' + S.med.toFixed(2)) + '</title></rect>'
        + '<rect class="s' + j + '" x="' + (sx(S.med) - 2).toFixed(1) + '" y="' + (yy - 1) + '" width="4" height="8" rx="1"/>'; }
    y += rowH + 6;
  }
  let grid = ''; for (let v = 0; v <= 1.0001; v += 0.1) grid += '<line class="grid" x1="' + sx(v) + '" x2="' + sx(v) + '" y1="56" y2="' + (H - 24) + '"/><text class="t2" x="' + sx(v) + '" y="' + (H - 8) + '" font-size="10" text-anchor="middle">' + v.toFixed(1) + '</text>';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + style(2) + '<rect class="bg" width="100%" height="100%"/>'
    + '<text class="t1" x="16" y="22" font-size="16" font-weight="600">Stamped break force / the member\'s physics break (1.0 = its material x section)</text>'
    + '<rect class="s0" x="16" y="34" width="12" height="12" rx="2"/><text class="t1" x="32" y="44" font-size="12">before (kappa 0.1 everywhere)</text><rect class="s1" x="236" y="34" width="12" height="12" rx="2"/><text class="t1" x="252" y="44" font-size="12">after (the wing 0.1, the rest 0.5) - bar 10-90 %, tick the median</text>'
    + grid + body + '</svg>';
  fs.writeFileSync(path.join(OUT, 'stamp_ratio.svg'), svg);
}
console.log('wrote', OUT);
