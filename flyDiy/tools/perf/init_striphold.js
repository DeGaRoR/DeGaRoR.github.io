// init_striphold.js - boot_perf --init-file: PERF-WORLDBUILD's switch that FORCES the near-first landing path
// (?nearfirst=1): every strip is held coarse at the load even if the worker has already finished it, so the row
// measures the landings (FLYDIY_STRIPW.landMax, lastLandS, the recorder's 'deliver' events). GATE STRIPWORKER does the same.
window.FLYDIY_STRIPW_HOLD = true;
