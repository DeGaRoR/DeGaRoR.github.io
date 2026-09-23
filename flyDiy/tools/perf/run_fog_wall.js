// THE OWED PICTURE (FOG-MIST §1f): the wall a HEIGHT-BLIND visM puts in front of an eye that
// has climbed out of the mist.
//
// rh 0.85 (the user's ask), T 15 C:  rho0 = 0.0025 x ((0.85-0.70)/0.30)^2 = 0.000625 /m
//   -> T < 1 % at 4.6/rho0 = 7.4 km for an eye INSIDE the layer  -> a naive cut at 1.3x = 9600 m
//   Td = 12.5 C (Magnus) -> cloud base = 125 x 2.5 = ~312 m, so a 200 m eye is UNDER the deck
//   and ABOVE the 60 m mist lid: its level ray never enters the layer, so the honest visM is
//   the aerial perspective's alone - tens of km - and the far plane must stay long.
// W (the wrong cut, 9600 m) against R (full distance), back to back at four headings, because
// which way the chase camera happens to face decides whether distant terrain is even in frame.
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const FD = path.resolve(__dirname, '..', '..');   // flyDiy/, from flyDiy/tools/perf/
const PORT = process.env.FLYDIY_PORT || '8479';   // node tools/_serve.js <port> <root> --fallback <main checkout>
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene&day=2026-09-21T07:30';
const OUTD = path.join(FD, 'bench', 'fog'); fs.mkdirSync(OUTD, { recursive: true });
const CLEAN = "[...document.querySelectorAll('button,a,div')].filter(b=>/continue anyway/i.test(b.textContent||'')&&!b.children.length).forEach(x=>x.click());" +
              "['boot','ui','devPanel'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});";
const SET = "DAY_CLOCK.set({rh:0.85,rate:0});CLOUDS.S.driftK=0;ATMO.MIST.k=1;";
const CAM = az => `FLIGHT_PROBE.camSet(${az},0.07,130);`;
const FAR = m => `WORLD.camera.far=${m};WORLD.camera.updateProjectionMatrix();`;
const QUADS = m => `WORLD.scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.index&&o.geometry.index.count>3e5){o.geometry.computeBoundingSphere();const s=o.geometry.boundingSphere;const c=s.center.clone().applyMatrix4(o.matrixWorld);o.visible=c.distanceTo(WORLD.camera.position)-s.radius<${m};}});`;
const AZ = [0, 1.571, 3.142, 4.712];
const steps = [];
for (let i = 0; i < AZ.length; i++) {
  steps.push(CLEAN + SET + CAM(AZ[i]) + FAR(100000) + QUADS(1e9) + `'R${i} heading ${i} - FULL distance'`);
  steps.push(CLEAN + SET + CAM(AZ[i]) + FAR(9600) + QUADS(9600) + `'W${i} heading ${i} - the height-blind cut at 9600 m'`);
}
const args = ['tools/island_shot.js', '--url', URL, '--at', '-100,200,100', '--out', path.join(OUTD, 'wall.png'),
              '--wait', '20000', '--boot', '28000',
              '--eval', "JSON.stringify({rh:FLIGHT_PROBE.world().day.rh,base:FLIGHT_PROBE.world().day.cloudBase|0,vis:+FLIGHT_PROBE.world().day.visibilityKm.toFixed(1),rho0:+ATMO.MIST.rho0.toFixed(6),eyeY:WORLD.camera.position.y|0})"];
for (const st of steps) args.push('--step', st);
const r = spawnSync(process.execPath, args, { cwd: FD, encoding: 'utf8' });
fs.writeFileSync(path.join(__dirname, 'fog_wall.log'), r.stdout + r.stderr + '\ndone\n');
