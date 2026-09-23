// THE WALL, properly aimed (FOG-MIST §1f). Two misses taught the rule:
//   - a cut only SHOWS where terrain rises THROUGH the mist's lid - from above the layer,
//     distant GROUND is seen by looking down through the mist and dies at ~4 km anyway, so on
//     flat muskeg no cut is visible; only mountains betray it;
//   - and the cut must be SHORTER than those mountains stand (9600 m left Jolene's peaks inside).
// So: the mountain heading (az 1.571 - the one that framed the ridges at 200 m), rh 0.85, and
// cuts at 6000 / 4000 / 2500 m against full distance, same eye, back to back.
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const FD = path.resolve(__dirname, '..', '..');   // flyDiy/, from flyDiy/tools/perf/
const PORT = process.env.FLYDIY_PORT || '8479';   // node tools/_serve.js <port> <root> --fallback <main checkout>
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene&day=2026-09-21T07:30';
const OUTD = path.join(FD, 'bench', 'fog'); fs.mkdirSync(OUTD, { recursive: true });
const CLEAN = "[...document.querySelectorAll('button,a,div')].filter(b=>/continue anyway/i.test(b.textContent||'')&&!b.children.length).forEach(x=>x.click());" +
              "['boot','ui','devPanel'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});";
const SET = "DAY_CLOCK.set({rh:0.85,rate:0,cloudCover:0.15});CLOUDS.S.driftK=0;ATMO.MIST.k=1;FLIGHT_PROBE.camSet(1.571,0.07,130);";
const FAR = m => `WORLD.camera.far=${m};WORLD.camera.updateProjectionMatrix();`;
const QUADS = m => `WORLD.scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.index&&o.geometry.index.count>3e5){o.geometry.computeBoundingSphere();const s=o.geometry.boundingSphere;const c=s.center.clone().applyMatrix4(o.matrixWorld);o.visible=c.distanceTo(WORLD.camera.position)-s.radius<${m};}});`;
const steps = [
  CLEAN + SET + FAR(100000) + QUADS(1e9) + "'R full distance - the ridges stand out of the mist'",
  CLEAN + SET + FAR(6000) + QUADS(6000) + "'W6 cut at 6000 m'",
  CLEAN + SET + FAR(4000) + QUADS(4000) + "'W4 cut at 4000 m'",
  CLEAN + SET + FAR(2500) + QUADS(2500) + "'W2 cut at 2500 m - well inside the ridges'",
  CLEAN + SET + FAR(100000) + QUADS(1e9) + "'R2 full again'",
];
const args = ['tools/island_shot.js', '--url', URL, '--at', '-100,200,100', '--out', path.join(OUTD, 'wall2.png'),
              '--wait', '20000', '--boot', '28000',
              '--eval', "JSON.stringify({rh:FLIGHT_PROBE.world().day.rh,base:FLIGHT_PROBE.world().day.cloudBase|0,vis:+FLIGHT_PROBE.world().day.visibilityKm.toFixed(1),rho0:+ATMO.MIST.rho0.toFixed(6)})"];
for (const st of steps) args.push('--step', st);
const r = spawnSync(process.execPath, args, { cwd: FD, encoding: 'utf8' });
fs.writeFileSync(path.join(__dirname, 'fog_wall2.log'), r.stdout + r.stderr + '\ndone\n');
