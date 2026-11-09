#!/usr/bin/env node
// cowl_study/crease_study.js - WHAT MAKES A NOSE BOXY (PROPER-COWLS, 8 Nov; the user: "identify the exact parameters
// that allow to match well ... the creasing, and therefore the boxy look of the plane, has to come from the plane's
// parameters"). For each build: the firewall's outline fitted with the cowl's own law (straight.js aftSection, the
// waist free), against the body's own rows.   node tools/cowl_study/crease_study.js <build.json>... > table.json
'use strict';
const ST = require('./straight.js');
const KEYS = ['topRound', 'botRound', 'crSill', 'crSillNose', 'crNoseCap', 'crKeel', 'crBand', 'crCap', 'noseCrown', 'noseW', 'noseH',
              'halfW', 'roofHalfW', 'waistY', 'roofY', 'keelY', 'aeroNose', 'topAngCeil', 'topAngRoof', 'topComp'];
const rows = [];
for (const f of process.argv.slice(2)) {
  let j; try { j = require(require('path').resolve(f)); } catch (e) { continue; }
  const spec = j.spec || j; if (!spec.cage) continue;
  try {
    const m = ST.measure(spec);
    if (!m.face || m.mount !== 0) continue;
    const P = m.P, tie = ST.aftSection(m, {}), fit = ST.aftSection(m, { free: true }), wid = ST.aftSection(m, { free: true, width: true }), widT = ST.aftSection(m, { width: true });
    const r = { build: f.split('/').pop().replace(/\.json$/, ''), fitTied: tie, fitFree: fit, fitWidth: wid, fitWidthTied: widT };
    for (const k of KEYS) r[k] = P[k];
    rows.push(r);
    console.error(r.build.padEnd(28), 'rms mm: tied', tie.rmsMM, 'free', fit.rmsMM, '+width', wid.rmsMM, 'tied+width', widT.rmsMM, '| w', widT.waist, 'sq', widT.sqTop, widT.sqBot, 'wT/wB', widT.wTop, widT.wBot, '| topR', P.topRound, 'botR', P.botRound, 'crSill', P.crSill, 'crSillNose', P.crSillNose, 'crKeel', P.crKeel);
  } catch (e) { console.error(f, 'ERR', e.message); }
}
console.log(JSON.stringify(rows, null, 1));
