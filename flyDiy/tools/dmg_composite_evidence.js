#!/usr/bin/env node
// G2049 (DMG-COMPOSITE): the crash table - DMG-TUNE's standard crashes on the composite Jodel (glass; the carbon variant
// beside it) against the validated Jodel (wood) and the metal Cessna, damage ON with the certificate stamped; every
// build in its own child (its certificate once), JSON out, then the table and the pictures from the JSON.
//   node tools/dmg_composite_evidence.js --run <out.json> [--builds composite,compositeC,jodel,metal]
//   node tools/dmg_composite_evidence.js --table <in.json> <outdir>       crash_table.md, broken_by_part.svg, energy.svg
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const IDS = ['taxi', 'noseover', 'trunk0', 'trunk25', 'hard'];

if (argv[0] === '--child') {
  process.env.FLYDIY_CERT = '1';
  const M = require('./_dmg_composite_lib.js'), k = argv[1], t0 = Date.now();
  const out = { k, label: M.L.BUILDS[k].label, sheet: M.sheet(k), crashes: IDS.map(id => M.crash(k, id)) };
  out.s = (Date.now() - t0) / 1000;
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n', () => process.exit(0));
  return;
}

// ---- the references in words (ALL AS RECALLED - nothing opened in this session; A0 opens them) and a mechanical rule ----
const REF = {
  taxi: { text: 'A taxi into a post or a tree at walking pace: the propeller strikes, the spinner and a glass-fibre cowling crack, a wing\'s leading edge may crack locally. No primary structure breaks; no bond line lets go.',
    src: 'NTSB taxi-collision briefs (CA class), as for DMG-TUNE; composite cowlings "cracked" in the same briefs - as recalled',
    ok: r => r.lamBroken <= 2 && !r.groupsOff.some(g => /eng/.test(g)) },
  noseover: { text: 'Wheels stopped at 12 m/s: over onto the nose. On a composite aeroplane the cowling and the nose shell shatter (glass-fibre "cracked and delaminated"), the propeller breaks, the gear may tear out of its box; the wings stay on and are not shredded.',
    src: 'NTSB Glasair / Lancair / Long-EZ nose-gear and nose-over briefs ("the composite nose section was fractured", "the main gear leg separated from the fuselage") - as recalled',
    ok: r => !(r.bySec.wings > 0) && r.broken <= 20 },
  trunk0: { text: 'A tree on the centreline at 58 kt: a composite airframe comes apart BRITTLE - the shell splits along its bonds and fractures in large pieces with sharp edges, the wings separate at the root / spar carry-through, the tail boom breaks aft of the wing (the glider\'s classic failure); little plastic deformation, more of the energy into fracture and rebound than a metal airframe\'s crumpling.',
    src: 'BFU / AAIB glider field-landing and tree reports ("the fuselage broke behind the wing", "the GRP shell fractured"), NTSB high-energy Cirrus / Lancair reports ("the airplane was fragmented"), NASA Langley\'s composite GA crash tests (Jackson / Fasanella, AGATE, early 2000s: the floor and the shell delaminating) - as recalled',
    ok: r => r.crashed && r.off.length >= 2 && r.lamSet === 0 },
  trunk25: { text: 'A tree 2.5 m out on the wing at 58 kt: the struck wing is cut or torn off at its spar; the composite skin cracks and peels from the core around the strike; the engine stays on; the cabin shell holds.',
    src: 'NTSB / BFU wing-strike reports on composite singles and gliders ("the left wing separated outboard of the root", "the wing skin delaminated") - as recalled',
    ok: r => r.bySec.wings > 0 && !r.groupsOff.some(g => /eng/.test(g)) && r.lamSet === 0 },
  hard: { text: 'A drop at 1.5 x the FAR 23.473 limit sink, V_S0 forward, no lift: the gear takes it (or a leg breaks); the composite airframe does not crack (FAR 23.727: no failure at 1.2 x the limit drop energy).',
    src: 'FAR 23.473 / 23.727, as DMG-TUNE - as recalled',
    ok: r => r.lamBroken === 0 },
};
const COL = { composite: '#2a78d6', compositeC: '#eb6834', jodel: '#1baf7a', metal: '#eda100' };   // dataviz slots 1-4 (validated)
const NAME = { composite: 'Jodel in glass', compositeC: 'Jodel in carbon', jodel: 'Jodel (wood)', metal: 'metal Cessna' };
const LABEL = { taxi: '3 m/s taxi', noseover: 'nose-over', trunk0: '30 m/s centreline', trunk25: '30 m/s, 2.5 m out', hard: 'drop 1.5 x 23.473' };

const { spawn } = require('child_process');
const child = k => new Promise(res => {
  const c = spawn(process.execPath, [__filename, '--child', k], { stdio: ['ignore', 'pipe', 'pipe'] });
  let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
  c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { k, err: se.slice(-1500) }); });
});

function svgBars(R, field, title, unit, fmt) {
  const W = 760, H = 330, ml = 56, mb = 58, mt = 52, pw = W - ml - 16, ph = H - mt - mb, keys = R.map(r => r.k);
  const val = (r, id) => { const c = r.crashes.find(x => x.id === id); return c ? field(c) : 0; };
  let max = 0; for (const r of R) for (const id of IDS) max = Math.max(max, val(r, id));
  const step = max > 200 ? 50 : max > 100 ? 25 : max > 40 ? 10 : max > 10 ? 5 : 1, top = Math.max(step, Math.ceil(max / step) * step);
  const gw = pw / IDS.length, bw = Math.min(26, (gw - 14) / keys.length - 2);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif" font-size="11">` +
    `<style>.s{fill:#fcfcfb}.t{fill:#0b0b0b}.m{fill:#52514e}.g{stroke:#e4e3df}@media (prefers-color-scheme:dark){.s{fill:#1a1a19}.t{fill:#fff}.m{fill:#c3c2b7}.g{stroke:#383835}}</style>` +
    `<rect class="s" width="${W}" height="${H}"/><text class="t" x="${ml}" y="20" font-size="14" font-weight="600">${title}</text>`;
  keys.forEach((k, i) => { const x = ml + i * 150; s += `<rect x="${x}" y="30" width="10" height="10" rx="2" fill="${COL[k]}"/><text class="m" x="${x + 14}" y="39">${NAME[k]}</text>`; });
  for (let v = 0; v <= top; v += step) { const y = mt + ph - v / top * ph; s += `<line class="g" x1="${ml}" x2="${ml + pw}" y1="${y}" y2="${y}"/><text class="m" x="${ml - 6}" y="${y + 4}" text-anchor="end">${v}</text>`; }
  s += `<text class="m" x="14" y="${mt + ph / 2}" transform="rotate(-90 14 ${mt + ph / 2})" text-anchor="middle">${unit}</text>`;
  IDS.forEach((id, g) => {
    const x0 = ml + g * gw + (gw - keys.length * (bw + 2)) / 2;
    keys.forEach((k, i) => { const v = val(R.find(r => r.k === k), id), h = Math.max(v > 0 ? 1.5 : 0, v / top * ph), x = x0 + i * (bw + 2), y = mt + ph - h;
      s += `<path d="M${x},${mt + ph}V${y + Math.min(4, h)}q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)}H${x + bw - Math.min(4, bw / 2)}q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)}V${mt + ph}Z" fill="${COL[k]}"><title>${NAME[k]} - ${LABEL[id]}: ${fmt(v)} ${unit}</title></path>` +
        `<text class="m" x="${x + bw / 2}" y="${y - 3}" text-anchor="middle" font-size="9">${fmt(v)}</text>`; });
    s += `<text class="t" x="${ml + g * gw + gw / 2}" y="${mt + ph + 18}" text-anchor="middle">${LABEL[id]}</text>`;
  });
  return s + '</svg>\n';
}

(async () => {
  if (argv[0] === '--run') {
    const ks = ((argv.find(a => a.startsWith('--builds=')) || '').slice(9) || 'composite,compositeC,jodel,metal').split(',');
    const R = await Promise.all(ks.map(child));
    fs.writeFileSync(argv[1], JSON.stringify(R));
    for (const r of R) console.log(r.k, r.err ? 'ERR ' + r.err : r.s.toFixed(0) + ' s');
    return;
  }
  if (argv[0] === '--table') {
    const R = JSON.parse(fs.readFileSync(argv[1], 'utf8')), dir = argv[2];
    const secs = c => Object.entries(c.bySec).map(([a, b]) => a + ' ' + b).join(', ') || '-';
    const off = c => c.off.slice(0, 6).map(o => o.parts + ' ' + o.m + ' kg').join('; ') + (c.off.length > 6 ? '; +' + (c.off.length - 6) + ' pieces' : '') || '-';
    let md = '# DMG-COMPOSITE - the crash table (G2049)\n\nDMG-TUNE\'s standard crashes (tools/_dmg_tune_lib.js), damage ON with the certificate stamped (genCertify, GEN_CERT_V unchanged), node only. ' +
      'The composite build is builds/composite_jodel_2026-10-07.json (the validated Jodel\'s geometry in E-glass); the carbon variant is the same file on the composite tile (reported, not gated). ' +
      '**Every source is as recalled - nothing was opened in this session.** "member work" is the members\' plastic and crack work (30_solver.js dmgW); "energy taken" the mechanical energy (kinetic + the weight\'s potential) taken out of the aeroplane between the run\'s first frame and its end (the trunk\'s and the ground\'s contact damping, friction and the members\' work); "back" how far the CG came back off its furthest point (the rebound). "laminate set" counts laminate members yielded and still whole (a brittle laminate has none).\n\n';
    md += '| build | mass kg | CG % MAC | V_S m/s | members (by material) | laminate seams |\n|---|---|---|---|---|---|\n';
    for (const r of R) { const s = r.sheet; md += `| ${NAME[r.k]} | ${s.mass} | ${s.cgMAC} | ${s.Vs} | ${JSON.stringify(s.mats)} | ${JSON.stringify(s.seams)} |\n`; }
    md += '\n';
    for (const id of IDS) {
      const F = REF[id];
      md += `## ${LABEL[id]}\n\n**Reference:** ${F.text}\n\n*Sources (as recalled):* ${F.src}\n\n| build | broken (by section) | laminate broken by how | laminate set | member work kJ | energy taken kJ | back m | off | plausible |\n|---|---|---|---|---|---|---|---|---|\n`;
      for (const r of R) { const c = r.crashes.find(x => x.id === id); if (!c) continue;
        md += `| ${NAME[r.k]} | **${c.broken}** (${secs(c)}) | ${JSON.stringify(c.lamBySeam)} | ${c.lamSet} | ${(c.work / 1000).toFixed(1)} | ${c.eTaken != null ? (c.eTaken / 1000).toFixed(1) : '-'} | ${c.back != null ? c.back.toFixed(2) : '-'} | ${off(c)}${c.crashed ? '; CRASHED (' + c.reason + ')' : ''} | ${/^composite/.test(r.k) ? (F.ok(c) ? 'yes' : 'NO') : '(reference build)'} |\n`; }
      md += '\n';
    }
    fs.writeFileSync(path.join(dir, 'crash_table.md'), md);
    fs.writeFileSync(path.join(dir, 'broken_by_crash.svg'), svgBars(R, c => c.broken, 'Members broken, by crash', 'members', v => String(v)));
    fs.writeFileSync(path.join(dir, 'member_work.svg'), svgBars(R, c => c.work / 1000, 'The members\' work (plastic + crack), by crash', 'kJ', v => v.toFixed(1)));
    console.log('wrote', dir);
  }
})();
