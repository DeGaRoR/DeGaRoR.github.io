#!/usr/bin/env node
// GATE PILOTACT (G630): THE PILOT'S HANDS — control-surface reversals per
// minute per phase group (taxi, take-off, climb, legs, downwind, base,
// final, landing), aileron and rudder, against absolute limits
// (pilot_matrix.js ACT_LIMIT). Three aeroplanes off HOME's stand: the stock
// build, the C172 archetype and the user's aluminium C172 build from the
// Jolene playtest (tools/fixtures/build_v10_cessnaMetal_2026-09-26.json).
// Before G630 the downwind's rudder square wave (a target heading nobody
// refreshed in PATH mode, differentiated across +-pi) read ~25/min against
// a limit of 12, and the ground's aileron chatter ~80-240/min; see the G630
// HANDOVER entry for the calibration. ~3-5 min on 3 jobs.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, 'pilot_matrix.js'), '--set', 'activity', '--activity', '--jobs', '3'],
                    { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'] });
process.exit(r.status || 0);
