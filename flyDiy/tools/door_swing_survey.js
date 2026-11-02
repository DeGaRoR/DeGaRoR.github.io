// door_swing_survey.js [build.json ...] [--out <prefix>] [--snap-only] [--off] - THE DOOR-SWING TABLE (PILLAR-ANCHORS,
// 2026-11-02). Every build named (default: the repo's saved builds - builds/*.json, builds/candidates/*.json and the
// validated aeroplanes of tools/_load_build.js) goes through the game's own load door (LB.gameSpecFull: the join over
// what the editor drew), is drawn headless twice - AS SAVED and with the pillar snap on (`pilSnap` 1) - and each
// door is turned 0 -> 90 deg about its hinge (PILLAR_SITE.doorSwingReport). Printed: per build and door, the least
// clearance in mm, the angle, and the least to each kind of obstacle (the wing, the wing struts, the float struts,
// the booms, the anchors); RED under 20 mm. With --out, <prefix>.json (every number) and <prefix>.md (the table).
// Nothing is saved to a build: what snapping would change is for the user to decide, build by build.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const LB = require(path.join(T, '_load_build.js'));
const SH = require(path.join(T, '_scene_headless.js'));
const CF = require(path.join(T, 'flight_core.js'));

let files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--out'));
const VAL = Object.entries(LB.VALIDATED);
if (!files.length) {
  const dir = d => { try { return fs.readdirSync(path.join(ROOT, d)).filter(f => /\.json$/.test(f) && !/edits|index/.test(f)).map(f => path.join(d, f)); } catch (e) { return []; } };
  files = dir('builds').concat(dir('builds/candidates'));
  for (const [k, B] of VAL) if (!files.includes(B.build)) files.push('validated:' + k);
}
const PS = require(path.join(T, '_pillar_site.js'));
const rows = [];
for (const f of files) {
  let raw, label = f;
  try {
    if (f.startsWith('validated:')) {
      const B = LB.VALIDATED[f.slice(10)];
      raw = JSON.parse(fs.readFileSync(path.join(ROOT, B.build), 'utf8'));
      if (B.patch) raw = B.patch(raw);
      label = B.label + ' (' + B.build + ')';
    } else raw = JSON.parse(fs.readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), 'utf8'));
  } catch (e) { rows.push({ build: label, error: 'unreadable: ' + e.message }); continue; }
  let spec;
  try { spec = LB.gameSpecFull(raw).spec; } catch (e) { rows.push({ build: label, error: 'load door: ' + e.message.slice(0, 120) }); continue; }
  const one = over => {
    const r = SH.sceneBuild(spec, { garage: spec, inGame: true, over,
                                    resolved: () => CF.buildGen(JSON.parse(JSON.stringify(spec))).spec });
    const W = r.W;
    const R = W.CAGE2.cageResolve(r.built.spec);
    const rep = W.PILLAR_SITE.doorSwingReport(W.THREE, r.scene, r.built.sheet, R, r.FS,
      { edge: Math.round(+r.P.hgDoorEdge || 0), hinges: W.CAGE_HINGE && W.CAGE_HINGE.doors });
    const st = r.stat || '';
    // the layers' status segments are joined by '  ·  ' (their inner parts by ' · ')
    const seg = st.split('  ·  ').map(x => x.trim());
    const grab = k => seg.find(x => x.startsWith(k)) || null;
    return { rep, strut: grab('strut:'), floats: grab('floats:'), fittings: grab('fittings:'),
             pillars: W.PILLAR_SITE.pillarsOf(r.built.sheet, R, r.FS).pillars.map(p => p.key + (p.frame ? '*' : '')).join(' ') };
  };
  const t0 = Date.now();
  // --off: the first column with the snap explicitly off (a card born with it on, compared with what it was before)
  const saved = flag('snap-only') ? null : one(flag('off') ? { pilSnap: 0 } : {});
  const snap = one({ pilSnap: 1 });
  const row = { build: label, ms: Date.now() - t0, pillars: snap.pillars,
                saved: saved && { doors: saved.rep.doors.map(d => ({ key: d.key, minMM: d.minMM, deg: d.deg, who: d.who, byCat: d.byCat, onClosed: d.onClosed })), red: saved.rep.red,
                                  strut: saved.strut, floats: saved.floats, fittings: saved.fittings },
                snap: { doors: snap.rep.doors.map(d => ({ key: d.key, minMM: d.minMM, deg: d.deg, who: d.who, byCat: d.byCat, onClosed: d.onClosed })), red: snap.rep.red,
                        strut: snap.strut, floats: snap.floats, fittings: snap.fittings } };
  rows.push(row);
  const fmt = s => s ? s.doors.map(d => d.key + ' ' + d.minMM + (d.minMM < PS.SWING_RED_MM ? '!' : '') + '@' + d.deg).join(', ') || 'no doors' : '-';
  console.log(label + ': saved [' + fmt(row.saved) + '] snap [' + fmt(row.snap) + '] ' + row.ms + ' ms');
}

// the table: one line per build and door side (port, the 'P' doors; the starboard is the mirror and printed only
// when it differs)
const CATS = PS.SWING_CATS;
const cell = (s, key) => {
  const d = s && s.doors.find(x => x.key === key);
  if (!d) return '-';
  const c = CATS.map(k => d.byCat && d.byCat[k] ? k.replace('wing strut', 'w.strut').replace('float strut', 'f.strut') + ' ' + d.byCat[k].mm +
                          (d.byCat[k].mm < 60 && d.byCat[k].deg != null ? '@' + d.byCat[k].deg : '') : null).filter(Boolean);
  const on = Object.keys(d.onClosed || {});
  return (d.minMM < PS.SWING_RED_MM ? '**RED ' : '') + d.minMM + ' mm' + (d.deg != null ? ' @' + d.deg + '°' : '') + (d.minMM < PS.SWING_RED_MM ? '**' : '') +
         (c.length ? ' (' + c.join(', ') + ')' : '') + (on.length ? '; ON the closed door: ' + on.join(', ') : '');
};
const md = ['| build | door | as saved: least (by kind, mm) | with the pillar snap | what the snap changes |', '|---|---|---|---|---|'];
for (const r of rows) {
  if (r.error) { md.push(`| ${r.build} | - | ${r.error} | | |`); continue; }
  const keys = [...new Set([].concat((r.saved || r.snap).doors.map(d => d.key), r.snap.doors.map(d => d.key)))];
  if (!keys.length) { md.push(`| ${r.build} | (no doors) | | | |`); continue; }
  const chg = [r.snap.strut && /pillar|post/.test(r.snap.strut) ? 'lift strut foot ' + r.snap.strut.match(/(on the [^·]*(?:pillar|post)|NOT on a pillar[^·]*)/)[0].trim() : null,
               r.snap.floats && /struts on/.test(r.snap.floats) ? 'float ' + r.snap.floats.match(/struts on [^,]*(?:\([^)]*\))?/)[0] : null,
               r.snap.fittings && /off the doors/.test(r.snap.fittings) ? r.snap.fittings.match(/off the doors[^·]*/)[0].trim() : null].filter(Boolean).join('; ');
  for (const k of keys) {
    if (/:M$/.test(k) && cell(r.saved, k) === cell(r.saved, k.replace(/:M$/, ':P')) && cell(r.snap, k) === cell(r.snap, k.replace(/:M$/, ':P'))) continue;
    md.push(`| ${path.basename(r.build)} | ${k} | ${cell(r.saved, k)} | ${cell(r.snap, k)} | ${k === keys[0] ? chg || 'nothing' : ''} |`);
  }
}
const out = opt('out', null);
if (out) {
  fs.writeFileSync(out + '.json', JSON.stringify(rows, null, 1));
  fs.writeFileSync(out + '.md', md.join('\n') + '\n');
  console.log('-> ' + out + '.json, ' + out + '.md');
} else console.log(md.join('\n'));
