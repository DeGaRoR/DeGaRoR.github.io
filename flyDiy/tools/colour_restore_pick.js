// node tools/colour_restore_pick.js [ref] [--write]   (run from the repo root; ref defaults to HEAD)
//
// COLOUR-RESTORE: which plane files tools/colour_restore.js may convert. Every plane file under flyDiy/builds and
// flyDiy/futureDesigns/game/aircraft-candidates that carries skin colours (finish.sections.*.tint, finish.glass.tint,
// paint); per file the newest commit in its history (renames followed) that changed those colours, and whether that
// commit contains the decode fix ac0d2e1f2:
//   - it does not: the colours were picked under the double decode -> CONVERT;
//   - it does: they were picked as they draw today (the PC-6's teal, converted by hand in e6e1a8d05) -> LEAVE.
// A file whose followed history is empty (git --follow loses some copies) falls back to its plain history.
// --write puts the list in tools/colour_restore_files.json; without it the list is printed.
// Run it on the commit BEFORE the conversion (ref = that commit): once converted, every file's colours were last changed
// in a commit with the fix, and the list reads all LEAVE.
const { execFileSync } = require('child_process');
const fs = require('fs');
const args = process.argv.slice(2), write = args.includes('--write');
const ref = args.find(a => !a.startsWith('--')) || 'HEAD';
const g = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const FIX = 'ac0d2e1f2';
const files = g('-c', 'core.quotepath=off', 'ls-tree', '-r', '--name-only', ref, '--', 'flyDiy/builds',
  'flyDiy/futureDesigns/game/aircraft-candidates')
  .split('\n').filter(f => /\.json$/.test(f) && !/\/lists\/|\.edits\.json$|index\.json$/.test(f));
const colours = txt => {
  let j; try { j = JSON.parse(txt); } catch (e) { return null; }
  const s = j && (j.spec || j);
  if (!s || typeof s !== 'object' || (!s.paint && !s.finish)) return null;
  const f = s.finish || {}, o = {};
  for (const k in (f.sections || {})) if (f.sections[k] && f.sections[k].tint != null) o['s.' + k] = f.sections[k].tint;
  if (f.glass && f.glass.tint != null) o.glass = f.glass.tint;
  if (s.paint) { o.base = s.paint.base; o.trim = s.paint.trim; }
  return JSON.stringify(o);
};
const show = (c, p) => { try { return g('show', c + ':' + p); } catch (e) { return null; } };
const history = (f, follow) => {
  const lines = g('-c', 'core.quotepath=off', 'log', ...(follow ? ['--follow'] : []), '--format=@%H', '--name-only', ref, '--', f)
    .split('\n').filter(Boolean);
  const hist = [];                                     // [hash, path at that commit], newest first
  for (const l of lines) if (l[0] === '@') hist.push([l.slice(1), null]);
    else if (hist.length && !hist[hist.length - 1][1]) hist[hist.length - 1][1] = l;
  for (const h of hist) if (!h[1]) h[1] = f;
  return hist;
};
const res = [];
for (const f of files) {
  const now = colours(show(ref, f)); if (now == null) continue;
  let hist = history(f, true);
  if (!hist.length) hist = history(f, false);
  if (!hist.length) { res.push({ f, err: 'no history' }); continue; }
  let last = hist[hist.length - 1][0];
  for (let i = 0; i < hist.length; i++) {
    const pp = (hist[i + 1] && hist[i + 1][1]) || hist[i][1];
    const prevTxt = show(hist[i][0] + '~1', pp), prev = prevTxt == null ? null : colours(prevTxt);
    if (prev !== now) { last = hist[i][0]; break; }
  }
  let fixed = false; try { g('merge-base', '--is-ancestor', FIX, last); fixed = true; } catch (e) {}
  res.push({ f, last: last.slice(0, 9), date: g('log', '-1', '--format=%cs', last).trim(), convert: !fixed });
}
const out = {
  note: 'COLOUR-RESTORE: files converted by tools/colour_restore.js (colours last changed before ac0d2e1f2), and the ones left',
  ref: g('rev-parse', '--short=9', ref).trim(),
  convert: res.filter(r => r.convert).map(r => r.f),
  leave: res.filter(r => r.convert === false).map(r => r.f + ' (' + r.last + ' ' + r.date + ')'),
  errors: res.filter(r => r.err).map(r => r.f + ': ' + r.err),
};
if (write) fs.writeFileSync('flyDiy/tools/colour_restore_files.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
