// REAL-STAMP (REAL-FIGURES made perennial, 12 Nov 2026): what a real_check result was measured ON, so a report never
// shows a number flown on another aeroplane, another core or another reference without saying so.
//
// A result carries `stamp`:
//   build  { file, blob }   the build file's git blob id (the same id `git hash-object <file>` prints; a card: the blob of
//                           tools/_cage_design.js, which holds the ARCHETYPES rows - coarse: any card edit stales every card)
//   core   'd0af9a5bd665064a' flight_core.js's body-sha256 (its header line, written by tools/build.js)
//   harness  the blob of tools/real_check.js (the flight rig; a change is shown, not counted stale)
//   ref    { key, hash }    a hash of the REFS row (sorted keys) - the figures the result is scored against, without the
//                           row's trail (its sources and notes: refFlown)
//   plane  { key, hash }    a hash of the PLANES row without its labels (file, loads, water/land, sweep options...)
//   at     ISO date the result was flown;  backfilled: <commit> when the stamp was written afterwards (see --backfill)
//
// check(o, P, R) compares a result's stamp with the files as they are now:
//   fresh      every part matches
//   stale      the build, the core or the plane row changed: the numbers were flown on something else - re-fly
//   rescored   only the reference row changed: the report re-scores from the row every time, but the loads (MIN / TYP /
//              MTOW come from the row's weights) may have moved - re-fly to be sure
//   unstamped  a result from before the stamps
//
// Not covered: the join and load path (tools/_cage_*.js, _load_build.js) - a join change shows up as stale only when it
// rewrites the build file. Re-fly the set after a join change lands (FIT_AND_VALIDATE.md section 9).
//
// CLI:
//   node tools/_real_stamp.js                       the stamp state of every result real_report would read
//   node tools/_real_stamp.js --backfill=<dir> --at=<commit>
//        writes stamps into an evidence folder's results flown before the stamps, from the files AS THEY WERE at
//        <commit> (the commit whose tree was flown, as the folder's README states). Never overwrites an existing stamp.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const T = __dirname, ROOT = path.resolve(T, '..');

const blobOf = buf => crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
const hashOf = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
// a stable serialisation: keys sorted, functions by their source
function canon(v) {
  if (v === undefined) return 'null';
  if (typeof v === 'function') return JSON.stringify(String(v));
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
// the PLANES row's fields that do not change what is flown
const PLANE_LABELS = ['label', 'short', 'note', 'listRow', 'supersededBy', 'next', 'dropped', 'test', 'group', 'official',
                      'provisional', 'engineNote', 'light', 'branch'];
const planeHash = P => { const q = {}; for (const k of Object.keys(P || {})) if (!PLANE_LABELS.includes(k)) q[k] = P[k]; return hashOf(canon(q)); };
// the REFS row's TRAIL - where a figure comes from (src, sources, from, note...) and a row's flaps, which no code reads -
// is left out, and a range [lo, hi] read in order, so documenting a row (tools/_realrefs_lint.js) does not stale the
// results flown against it
const REF_TRAIL = ['src', 'sources', 'from', 'note', 'geoSrc', 'lengthNote', 'variant'];
function refFlown(R) {
  const q = {};
  for (const k of Object.keys(R || {})) if (!REF_TRAIL.includes(k)) q[k] = R[k];
  if (q.rows) { const rows = {}; for (const k of Object.keys(q.rows)) { const r = Object.assign({}, q.rows[k]); for (const t of REF_TRAIL.concat(['flaps'])) delete r[t]; if (Array.isArray(r.v)) r.v = r.v.slice().sort((x, y) => x - y); rows[k] = r; } q.rows = rows; }
  return q;
}
const refHash = R => hashOf(canon(refFlown(R)));
const coreIdOf = text => { const m = String(text).match(/^\/\/ body-sha256: (\w+)$/m); return m ? m[1] : null; };

// a reader of files: now (the working tree) or at a commit
function reader(commit) {
  if (!commit) return rel => { const p = path.join(ROOT, rel); return fs.existsSync(p) ? fs.readFileSync(p) : null; };
  const prefix = cp.execSync('git rev-parse --show-prefix', { cwd: ROOT }).toString().trim();
  return rel => { try { return cp.execSync('git show ' + commit + ':' + prefix + rel, { cwd: ROOT, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };
}
function buildPart(P, read) {
  const rel = P.file || (P.card ? 'tools/_cage_design.js' : null);
  if (!rel) return null;
  // a plane flown from another branch (PLANES `branch:`) is checked against that branch's file when this tree has none
  const b = read(rel) || (P.branch ? reader('origin/' + P.branch)(rel) : null);
  return { file: rel, card: P.card || undefined, blob: b ? blobOf(b) : null };
}
// stampOf(key, P, R[, { core: <path to the flight_core.js flown>, commit }])
function stampOf(key, P, R, o = {}) {
  const read = reader(o.commit);
  const coreText = o.commit ? read('tools/flight_core.js') : fs.readFileSync(o.core || path.join(T, 'flight_core.js'));
  const h = read('tools/real_check.js');
  return { build: buildPart(P, read), core: coreIdOf(coreText), harness: h ? blobOf(h) : null,
           ref: { key: P.ref, hash: refHash(R) }, plane: { key, hash: planeHash(P) },
           at: o.at || new Date().toISOString() };
}
const short = s => (s ? String(s).slice(0, 9) : '-');
function check(o, P, R, now) {
  const s = o && o.stamp;
  if (!s) return { state: 'unstamped', why: ['flown before the stamps (12 Nov 2026)'] };
  now = now || stampOf(o.key, P, R);
  const stale = [], soft = [];
  if (!s.build || !now.build || s.build.blob !== now.build.blob || s.build.file !== now.build.file)
    stale.push('build ' + (s.build ? s.build.file + ' ' + short(s.build.blob) : '?') + ' -> ' + (now.build ? now.build.file + ' ' + short(now.build.blob) : 'none'));
  if (s.core !== now.core) stale.push('core ' + short(s.core) + ' -> ' + short(now.core));
  if (!s.plane || s.plane.hash !== now.plane.hash) stale.push('PLANES row edited');
  const refMoved = !s.ref || s.ref.key !== now.ref.key || s.ref.hash !== now.ref.hash;
  if (s.harness !== now.harness) soft.push('real_check.js edited since');
  if (stale.length) return { state: 'stale', why: stale.concat(refMoved ? ['reference row edited'] : []), soft };
  if (refMoved) return { state: 'rescored', why: ['reference row ' + (s.ref ? s.ref.key : '?') + ' edited since'], soft };
  return { state: 'fresh', why: [], soft };
}

function main() {
  const args = process.argv.slice(2), opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const RR = require(path.join(T, 'real_refs.js'));
  if (opt('backfill')) {
    const dir = path.resolve(opt('backfill')), at = opt('at');
    if (!at) { console.log('--backfill needs --at=<commit>: the commit whose tree was flown'); process.exit(2); }
    const read = reader(at), tmp = path.join(require('os').tmpdir(), 'real_refs_' + at + '_' + process.pid + '.js');
    fs.writeFileSync(tmp, read('tools/real_refs.js'));
    const OLD = require(tmp); fs.unlinkSync(tmp);
    const when = cp.execSync('git log -1 --format=%cI ' + at, { cwd: ROOT }).toString().trim();
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const p = path.join(dir, f), o = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!o.key) continue;
      if (o.stamp) { console.log(f + ': stamped already, left'); continue; }
      const P = OLD.PLANES[o.key], R = P && OLD.REFS[P.ref];
      if (!P || !R) { console.log(f + ': no PLANES / REFS row at ' + at + ', left unstamped'); continue; }
      o.stamp = Object.assign(stampOf(o.key, P, R, { commit: at, at: when }), { backfilled: at });
      fs.writeFileSync(p, JSON.stringify(o, null, 1));
      console.log(f + ': ' + o.stamp.build.file + ' ' + short(o.stamp.build.blob) + ', core ' + o.stamp.core);
    }
    return;
  }
  // the state of what the report reads (the newest result per plane, as real_report picks it)
  const ev = path.join(ROOT, 'reports', 'evidence'), by = {};
  for (const d of fs.readdirSync(ev).filter(d => /^REAL-CHECK-/.test(d)).sort())
    for (const f of fs.readdirSync(path.join(ev, d)).filter(f => f.endsWith('.json') && !f.endsWith('.shape.json'))) {
      try { const o = JSON.parse(fs.readFileSync(path.join(ev, d, f), 'utf8')); if (o.key && o.cases) by[o.key] = Object.assign(o, { _src: d + '/' + f }); } catch (e) {}
    }
  for (const k of Object.keys(by).sort()) {
    const P = RR.PLANES[k]; if (!P) { console.log(k.padEnd(12) + ' (no PLANES row)'); continue; }
    const c = check(by[k], P, RR.REFS[P.ref]);
    console.log(k.padEnd(12) + ' ' + c.state.padEnd(10) + ' ' + by[k]._src.padEnd(42) + ' ' + c.why.concat(c.soft || []).join('; '));
  }
}
if (require.main === module) main();
// THE LIVE SET: the PLANES rows the report stands behind - not taken out (dropped), replaced (supersededBy) or waiting
// (next); a row flown from another branch (branch:) only with o.branch
const liveKeys = (PLANES, o = {}) => Object.keys(PLANES).filter(k => (o.every || !(PLANES[k].dropped || PLANES[k].supersededBy || PLANES[k].next)) && (o.branch || !PLANES[k].branch));
module.exports = { liveKeys, stampOf, check, blobOf, planeHash, refHash, coreIdOf, canon };
