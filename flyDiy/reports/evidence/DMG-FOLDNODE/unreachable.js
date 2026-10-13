#!/usr/bin/env node
// DMG-FOLDNODE (G2350) evidence: the flown bake's fake is unreachable without the test flag. The node page booted as
// every other gate boots it (no opts.fakeBake), damage OFF and ON, to the first roll-out: the flag unset, the fake
// never ran (FB.last never 'fake'), and the bake took the path it always took in node (the recording GL's zero
// read-back: no bake, no fold). Then the same boot WITH opts.fakeBake for contrast.
//   node reports/evidence/DMG-FOLDNODE/unreachable.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const { openPage } = require(path.join(ROOT, 'tools', '_page_node.js'));
async function one(q, fake) {
  const P = await openPage({ quiet: true, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, 'builds/cub_2026-09-20_corrected.json'), 'utf8') }, query: q, fakeBake: fake });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  const n0 = (W.FLYDIY_TRIPS || []).length; W.document.getElementById('bGo').click();
  await P.until(() => { const T = W.FLYDIY_TRIPS || []; const t = T[T.length - 1]; return T.length > n0 && t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'; }, 900000);
  await P.frames(10);
  const FB = W.FLOWN_BAKE, L = FB.FB.last, m = W.FLIGHT_PROBE.model(); let folds = 0; if (m && m.grp) m.grp.traverse(o => { if (o.userData && o.userData.flownMerge) folds++; });
  const r = { query: q, fakeBakeOpt: !!fake, flag: W.FLYDIY_TEST_FAKE_BAKE === undefined ? 'unset' : W.FLYDIY_TEST_FAKE_BAKE, last: L ? { hit: L.hit, fake: !!L.fake } : null, foldsInModel: folds, errors: P.errors.filter(e => !/impostor bake/.test(e)).length };
  P.close(); return r;
}
(async () => {
  const R = [await one('', false), await one('damage=1', false), await one('damage=1', true)];
  for (const r of R) console.log(JSON.stringify(r));
  const ok = R[0].flag === 'unset' && R[1].flag === 'unset' && !(R[0].last && R[0].last.fake) && !(R[1].last && R[1].last.fake) && R[0].foldsInModel === 0 && R[1].foldsInModel === 0 && R[2].last && R[2].last.fake && R[2].foldsInModel > 0;
  console.log('FAKE BAKE UNREACHABLE WITHOUT THE FLAG: ' + (ok ? 'PASS' : 'FAIL')); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
