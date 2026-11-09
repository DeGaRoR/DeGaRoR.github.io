// _hull_tip_probe.js - GATE HULL's page-side probe (run by _load_build's FLYDIY_JOIN_PROBE in the page's own context,
// after the last build): the tip floats as DRAWN (_cage_float.js CAGE_TIPFLOATS) and the join's datums, so the gate
// can stand them beside the flown records (HULL-B5)
return { tips: window.CAGE_TIPFLOATS || null, datum: window.CAGE_DATUM || null };
