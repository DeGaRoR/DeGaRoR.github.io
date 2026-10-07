// G2353 (DMG-DETERMINISM): IS THIS GENERATED CORE THE ONE ITS TREE'S src/core BUILDS? tools/flight_core.js is generated
// and tracked: a tree whose generated files were put back from git (`git checkout -- tools/flight_core.js` before a
// commit, a stash, a fresh worktree) runs an OLDER core than its sources - DMG-COMPOSITE's 30 m/s "Jodel 154 -> 204"
// (G2048) was exactly that (the committed train-37 core, to the bit), not V8's optimiser. tools/build.js writes the
// sources' hash in the core's second line (`// body-sha256: <16 hex>` = sha256 of MANIFEST.core joined); this hashes
// them again and compares.
//   fresh(coreFile)        { ok, judged, header, now } - judged false when the core has no src/core / build.js beside it
//   assertFresh(coreFile)  throws on a stale core (FLYDIY_STALE_OK=1: never)
// Called by the core itself in node (src/core/90_node_exports.js) and by the crash library before it loads one (a core
// from before G2353 has no check of its own).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
function fresh(coreFile) {
  const tools = path.dirname(coreFile), src = path.join(tools, '..', 'src', 'core'), bjs = path.join(tools, 'build.js');
  if (!fs.existsSync(src) || !fs.existsSync(bjs)) return { ok: true, judged: false };
  const head = fs.readFileSync(coreFile, 'utf8').slice(0, 400).match(/^\/\/ body-sha256: (\w+)\n/m);
  if (!head) return { ok: true, judged: false };
  const files = require(bjs).MANIFEST.core, h = crypto.createHash('sha256');
  for (const f of files) h.update(fs.readFileSync(path.join(src, f), 'utf8'));
  const now = h.digest('hex').slice(0, 16);
  return { ok: now === head[1], judged: true, header: head[1], now };
}
function assertFresh(coreFile) {
  if (process.env.FLYDIY_STALE_OK === '1') return;
  const r = fresh(coreFile);
  if (!r.ok) throw new Error('STALE CORE: ' + coreFile + ' was built from other sources (body-sha256 ' + r.header + ', its src/core now ' + r.now +
    ') - run `node tools/build.js` first (FLYDIY_STALE_OK=1 loads it anyway)');
}
module.exports = { fresh, assertFresh };
