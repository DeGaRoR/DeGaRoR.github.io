#!/usr/bin/env node
// GATE PILOTMATRIX (P0.3 of PILOT-ROADMAP-2026-09-14.md): the quick matrix
// as a RATCHET against tools/pilot_baseline.json — no cell may get worse
// than the committed baseline (see pilot_matrix.js `ratchet`). Known-bad
// cells stay known-bad until a pilot change fixes them and the baseline is
// moved forward BY HAND (a --out onto tools/pilot_baseline.json, said in
// the HANDOVER with the numbers). Full tier: ~13 min on a loaded machine.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, 'pilot_matrix.js'), '--set', 'quick', '--ratchet', path.join(__dirname, 'pilot_baseline.json')],
                    { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'] });
process.exit(r.status || 0);
