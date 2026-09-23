// F2's first look: does it compile, does the field bake, and does the mist lie on the LAND?
// The same eye and heading that framed the ridges for the wall pictures (FOG-MIST §1f).
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const FD = path.resolve(__dirname, '..', '..');
const PORT = process.env.FLYDIY_PORT || '8479';
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene&day=2026-09-21T07:30';
const OUTD = path.join(FD, 'bench', 'fog'); fs.mkdirSync(OUTD, { recursive: true });
const SET = "DAY_CLOCK.set({rh:0.90,rate:0,cloudCover:0.15});CLOUDS.S.driftK=0;ATMO.MIST.k=1;FLIGHT_PROBE.camSet(1.571,0.07,130);";
const steps = [
  SET + "ATMO.MIST.relief=0;ATMO.MIST.patch=0;'A the flat slab - what we had'",
  SET + "ATMO.MIST.relief=1;ATMO.MIST.patch=0;'B ON THE LAND - the field, no patches'",
  SET + "ATMO.MIST.relief=1;ATMO.MIST.patch=0.85;'C PATCHY - banks that drift'",
  SET + "ATMO.MIST.relief=1;ATMO.MIST.patch=0.85;ATMO.MIST.k=2.2;'D patchy and thick'",
  SET + "ATMO.MIST.relief=0;ATMO.MIST.patch=0;'E back to flat - must equal A'",
];
const args = ['tools/island_shot.js', '--url', URL, '--at', '-100,200,100', '--out', path.join(OUTD, 'f2.png'),
              '--wait', '16000', '--boot', '40000', '--tries', '14', '--clean', '--log',
              '--eval', "JSON.stringify({field: ATMO.MIST.field ? {N:ATMO.MIST.field.N, ms:+ATMO.MIST.field.ms.toFixed(0), yHi:+ATMO.MIST.field.yHi.toFixed(0)} : null, rho0:+ATMO.MIST.rho0.toFixed(6)})"];
for (const st of steps) args.push('--step', st);
const r = spawnSync(process.execPath, args, { cwd: FD, encoding: 'utf8' });
fs.writeFileSync(path.join(__dirname, 'f2_shots.log'), r.stdout + r.stderr + '\ndone\n');
